// api/videoStream.ts
// Platform B — Secure Video Streaming API (Vercel Serverless Function)
//
// Handles ALL Platform B backend operations in a SINGLE file:
//   POST  /api/videoStream  { action: 'submit' }   → ingest a video URL
//   GET   /api/videoStream  ?action=meta&videoId=  → get stream/embed tokens
//   GET   /api/videoStream  ?action=info&videoId=  → get total size / chunk count
//   GET   /api/videoStream  ?action=chunk&videoId= → serve one chunk (anti-IDM)
//   GET   /api/videoStream  ?action=embed&videoId= → proxy embed HTML
//   GET   /api/videoStream  ?action=health         → health check
//
// Uses Firebase Admin for Firestore (no Supabase dependency).
// All secrets live in Vercel Environment Variables — never hardcoded in production.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import admin from 'firebase-admin';

// ─── Configuration ─────────────────────────────────────────────────────────────
// In production set these as Vercel env vars. The fallback strings are for
// local development only and MUST be changed before going live.

const CONFIG = {
  MASTER_SECURITY_STRING:
    process.env.VIDEO_SECURITY_STRING || 'CHANGE_ME_IN_VERCEL_ENV_VIDEO_SECURITY_STRING',
  TOKEN_SECRET:
    process.env.VIDEO_TOKEN_SECRET || 'CHANGE_ME_IN_VERCEL_ENV_VIDEO_TOKEN_SECRET',
  /** 8 MB chunks — large enough for smooth buffering, small enough IDM can't use partials */
  CHUNK_SIZE: 8 * 1024 * 1024,
  /** Allowed origins for CORS (set VIDEO_ALLOWED_ORIGIN in Vercel env) */
  ALLOWED_ORIGIN: process.env.VIDEO_ALLOWED_ORIGIN || '*',
};

// ─── Firebase Admin ────────────────────────────────────────────────────────────
// Uses static import of firebase-admin (same pattern as payment.ts) to avoid
// the gRPC OpenSSL DECODER routines::unsupported error caused by dynamic imports
// of the modular firebase-admin/firestore subpackage on Node 18+.

let _db: admin.firestore.Firestore | null = null;

function getFirestoreDb(): admin.firestore.Firestore {
  if (_db) return _db;

  if (!admin.apps.length) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        'Missing Firebase Admin credentials. Set FIREBASE_ADMIN_PROJECT_ID, ' +
          'FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY in Vercel env vars.'
      );
    }

    privateKey = privateKey.trim().replace(/^["']|["']$/g, '');
    privateKey = privateKey.replace(/\\n/g, '\n');

    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  }

  _db = admin.app().firestore();
  return _db;
}

// ─── CORS helper ──────────────────────────────────────────────────────────────

function setCorsHeaders(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin as string | undefined;
  const allowed = CONFIG.ALLOWED_ORIGIN;

  if (allowed === '*' || (origin && (allowed === origin || allowed.split(',').map(s => s.trim()).includes(origin)))) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else {
    res.setHeader('Access-Control-Allow-Origin', allowed);
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, X-Security-String, X-Stream-Token, X-Chunk-Token, Authorization, Accept, Origin, X-Requested-With'
  );
  res.setHeader(
    'Access-Control-Expose-Headers',
    'X-Next-Chunk-Token, X-Total-Size, X-Chunk-Index, X-Is-Last-Chunk, Content-Range, Content-Length'
  );
  res.setHeader('Access-Control-Max-Age', '86400');
}

// ─── Token helpers ────────────────────────────────────────────────────────────

function generateStreamToken(videoId: string): string {
  const expiry = Date.now() + 5 * 60 * 1000; // 5 min
  const payload = `stream:${videoId}:${expiry}`;
  const sig = crypto.createHmac('sha256', CONFIG.TOKEN_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

function validateStreamToken(token: string, videoId: string): boolean {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length !== 4 || parts[0] !== 'stream') return false;
    const [, vid, expiry, sig] = parts;
    if (vid !== videoId) return false;
    if (Date.now() > parseInt(expiry, 10)) return false;
    const expected = crypto
      .createHmac('sha256', CONFIG.TOKEN_SECRET)
      .update(`stream:${vid}:${expiry}`)
      .digest('hex');
    if (sig.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

function generateChunkToken(videoId: string, chunkIndex: number): string {
  const expiry = Date.now() + 30 * 1000; // 30 sec
  const payload = `chunk:${videoId}:${chunkIndex}:${expiry}`;
  const sig = crypto.createHmac('sha256', CONFIG.TOKEN_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

function validateChunkToken(token: string, videoId: string, chunkIndex: number): boolean {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length !== 5 || parts[0] !== 'chunk') return false;
    const [, vid, idx, expiry, sig] = parts;
    if (vid !== videoId) return false;
    if (parseInt(idx, 10) !== chunkIndex) return false;
    if (Date.now() > parseInt(expiry, 10)) return false;
    const expected = crypto
      .createHmac('sha256', CONFIG.TOKEN_SECRET)
      .update(`chunk:${vid}:${idx}:${expiry}`)
      .digest('hex');
    if (sig.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

// ─── Security guards ──────────────────────────────────────────────────────────

function isAllowedUA(req: VercelRequest): boolean {
  const ua = (req.headers['user-agent'] || '').toLowerCase();
  const blocked = [
    'idm/', 'internet download manager', 'fdm', 'free download manager',
    'wget', 'curl/', 'aria2', 'uget', 'getright', 'flashget', 'dap/',
    'download accelerator', 'go-http-client', 'python-requests', 'libwww',
    'java/', 'okhttp', 'httpie',
  ];
  return !blocked.some((b) => ua.includes(b));
}

function isAllowedReferer(req: VercelRequest): boolean {
  const referer = (req.headers['referer'] || req.headers['origin'] || '') as string;
  if (!referer) return true;
  const allowed = CONFIG.ALLOWED_ORIGIN === '*'
    ? []
    : CONFIG.ALLOWED_ORIGIN.split(',').map((s) => s.trim());
  if (allowed.length === 0) return true;
  return allowed.some((o) => referer.startsWith(o));
}

// ─── URL converters ───────────────────────────────────────────────────────────

type ConvertResult =
  | { success: true; streamUrl: string; isEmbed: boolean; isGoogleDrive?: boolean }
  | { success: false; message: string };

function convertDropboxUrl(url: string): ConvertResult {
  try {
    let directUrl = url;
    if (!url.includes('raw=1')) {
      if (url.includes('dl=0')) directUrl = url.replace('dl=0', 'raw=1');
      else if (url.includes('dl=1')) directUrl = url.replace('dl=1', 'raw=1');
      else directUrl = url + (url.includes('?') ? '&' : '?') + 'raw=1';
    }
    return { success: true, streamUrl: directUrl, isEmbed: false };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

function convertGoogleDriveUrl(url: string): ConvertResult {
  try {
    const matchFile = url.match(/\/file\/d\/([^/?]+)/);
    const matchOpen = url.match(/[?&]id=([^&]+)/);
    const fileId = matchFile ? matchFile[1] : matchOpen ? matchOpen[1] : null;
    if (fileId) {
      return {
        success: true,
        streamUrl: `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`,
        isEmbed: false,
        isGoogleDrive: true,
      };
    }
    return { success: false, message: 'Invalid Google Drive URL' };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

function convertYouTubeUrl(url: string): ConvertResult {
  try {
    const urlObj = new URL(url);
    const videoId = urlObj.hostname.includes('youtu.be')
      ? urlObj.pathname.slice(1)
      : urlObj.searchParams.get('v');
    if (videoId) {
      return {
        success: true,
        streamUrl: `https://www.youtube.com/embed/${videoId}`,
        isEmbed: true,
      };
    }
    return { success: false, message: 'Invalid YouTube URL' };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

function convertVimeoUrl(url: string): ConvertResult {
  try {
    const urlObj = new URL(url);
    const videoId = urlObj.pathname.split('/').filter(Boolean)[0];
    if (videoId) {
      return {
        success: true,
        streamUrl: `https://player.vimeo.com/video/${videoId}`,
        isEmbed: true,
      };
    }
    return { success: false, message: 'Invalid Vimeo URL' };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

function convertDailymotionUrl(url: string): ConvertResult {
  try {
    const urlObj = new URL(url);
    const videoId = urlObj.pathname.split('/').filter((p) => p && p !== 'video')[0];
    if (videoId) {
      return {
        success: true,
        streamUrl: `https://www.dailymotion.com/embed/video/${videoId}`,
        isEmbed: true,
      };
    }
    return { success: false, message: 'Invalid Dailymotion URL' };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

const converters: Record<string, (url: string) => ConvertResult> = {
  dropbox: convertDropboxUrl,
  gdrive: convertGoogleDriveUrl,
  youtube: convertYouTubeUrl,
  vimeo: convertVimeoUrl,
  dailymotion: convertDailymotionUrl,
};

// ─── Action handlers ──────────────────────────────────────────────────────────

/**
 * POST { action:'submit', sourceUrl, platform, label, createdBy }
 * → Converts URL, stores record in Firestore 'securedVideos', returns proxyUrl
 */
async function handleSubmit(req: VercelRequest, res: VercelResponse) {
  const { sourceUrl, platform, label, createdBy } = req.body || {};

  if (!sourceUrl || !platform || !createdBy) {
    return res.status(400).json({ success: false, message: 'sourceUrl, platform, and createdBy are required' });
  }

  const converter = converters[String(platform).toLowerCase()];
  if (!converter) {
    return res.status(400).json({ success: false, message: `Unsupported platform: ${platform}` });
  }

  const converted = converter(String(sourceUrl));
  if (!converted.success) {
    return res.status(400).json({ success: false, message: converted.message });
  }

  const db = getFirestoreDb();

  const record = {
    originalUrl: sourceUrl,
    streamUrl: converted.streamUrl,
    platform: String(platform).toLowerCase(),
    isEmbed: converted.isEmbed,
    isGoogleDrive: (converted as any).isGoogleDrive || false,
    label: label || '',
    createdBy: String(createdBy),
    createdAt: new Date().toISOString(),
    accessCount: 0,
  };

  const docRef = await db.collection('securedVideos').add(record);
  const videoId: string = docRef.id;

  // The proxyUrl stored in content.videoUrl — uses our internal scheme
  const proxyUrl = `secured://${videoId}`;

  return res.status(200).json({
    success: true,
    proxyUrl,
    videoId,
    platform: record.platform,
  });
}

/**
 * GET ?action=meta&videoId=
 * Requires header: x-security-string
 * Returns stream tokens (for direct files) or proxyUrl (for embeds)
 */
async function handleMeta(req: VercelRequest, res: VercelResponse) {
  const videoId = String(req.query.videoId || '');
  const secKey = req.headers['x-security-string'] as string | undefined;

  if (!secKey || secKey.trim() !== CONFIG.MASTER_SECURITY_STRING.trim()) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  if (!videoId) {
    return res.status(400).json({ success: false, message: 'videoId is required' });
  }

  const db = getFirestoreDb();
  const docSnap = await db.collection('securedVideos').doc(videoId).get();

  if (!docSnap.exists) {
    return res.status(404).json({ success: false, message: 'Video not found' });
  }

  const videoData = docSnap.data()!;

  // Fire-and-forget access count increment
  db.collection('securedVideos')
    .doc(videoId)
    .update({ accessCount: (videoData.accessCount || 0) + 1, lastAccessedAt: new Date().toISOString() })
    .catch(() => {});

  if (videoData.isEmbed) {
    return res.status(200).json({
      success: true,
      type: 'embed',
      embedUrl: videoData.streamUrl,
      platform: videoData.platform,
    });
  }

  // Direct video: issue stream + first chunk tokens
  const streamToken = generateStreamToken(videoId);
  const firstChunkToken = generateChunkToken(videoId, 0);

  return res.status(200).json({
    success: true,
    type: 'video',
    chunkUrl: `/api/videoStream?action=chunk&videoId=${videoId}`,
    streamToken,
    firstChunkToken,
    platform: videoData.platform,
  });
}

/**
 * GET ?action=info&videoId=
 * Requires header: x-stream-token
 * Returns totalSize, totalChunks, chunkSize, contentType
 */
async function handleInfo(req: VercelRequest, res: VercelResponse) {
  const videoId = String(req.query.videoId || '');
  const token = (req.headers['x-stream-token'] || req.query.token) as string | undefined;

  if (!token || !validateStreamToken(token, videoId)) {
    return res.status(403).json({ success: false, message: 'Forbidden: invalid stream token' });
  }
  if (!isAllowedUA(req)) return res.status(403).json({ success: false, message: 'Forbidden: blocked client' });

  const db = getFirestoreDb();
  const docSnap = await db.collection('securedVideos').doc(videoId).get();
  if (!docSnap.exists) return res.status(404).json({ success: false, message: 'Video not found' });

  const videoData = docSnap.data()!;

  const fetchHeaders: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  };
  if (videoData.isGoogleDrive) fetchHeaders['Referer'] = 'https://drive.google.com/';

  // Dynamic import of node-fetch (ESM compatible in Vercel)
  const { default: fetch } = await import('node-fetch');
  const headRes = await (fetch as any)(videoData.streamUrl, {
    method: 'HEAD',
    headers: fetchHeaders,
    redirect: 'follow',
  });

  const totalSize = parseInt(headRes.headers.get('content-length') || '0', 10);
  const totalChunks = totalSize > 0 ? Math.ceil(totalSize / CONFIG.CHUNK_SIZE) : null;

  // FIX: Always return 'video/mp4'. Dropbox/GDrive return 'application/octet-stream'
  // which is not a valid MSE codec — passing it to addSourceBuffer() causes a crash.
  return res.status(200).json({
    success: true,
    totalSize,
    totalChunks,
    chunkSize: CONFIG.CHUNK_SIZE,
    contentType: 'video/mp4',
  });
}

/**
 * GET ?action=chunk&videoId=&chunk=N
 * Requires header: x-chunk-token
 * Core anti-IDM endpoint — streams one chunk, returns token for next chunk in header
 */
async function handleChunk(req: VercelRequest, res: VercelResponse) {
  const videoId = String(req.query.videoId || '');
  const chunkIndex = parseInt(String(req.query.chunk || '0'), 10);
  const chunkToken = (req.headers['x-chunk-token'] || req.query.chunkToken) as string | undefined;

  if (!chunkToken || !validateChunkToken(chunkToken, videoId, chunkIndex)) {
    return res.status(403).send('Forbidden: invalid chunk token');
  }
  if (!isAllowedUA(req)) return res.status(403).send('Forbidden: blocked client');
  if (!isAllowedReferer(req)) return res.status(403).send('Forbidden: invalid origin');

  const db = getFirestoreDb();
  const docSnap = await db.collection('securedVideos').doc(videoId).get();
  if (!docSnap.exists) return res.status(404).send('Video not found');

  const videoData = docSnap.data()!;
  const byteStart = chunkIndex * CONFIG.CHUNK_SIZE;
  const byteEnd = byteStart + CONFIG.CHUNK_SIZE - 1;

  const fetchHeaders: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    Accept: '*/*',
    Range: `bytes=${byteStart}-${byteEnd}`,
  };
  if (videoData.isGoogleDrive) fetchHeaders['Referer'] = 'https://drive.google.com/';

  const { default: fetch } = await import('node-fetch');
  const upstream = await (fetch as any)(videoData.streamUrl, {
    headers: fetchHeaders,
    redirect: 'follow',
  });

  // 416 = Range Not Satisfiable — past end of file
  if (upstream.status === 416) {
    return res.status(204).send('');
  }

  if (!upstream.ok && upstream.status !== 206) {
    return res.status(upstream.status).send('Upstream source error');
  }

  const contentRange  = upstream.headers.get('content-range');
  const contentLength = upstream.headers.get('content-length');

  // FIX 1: Always force Content-Type to 'video/mp4'.
  // Dropbox/GDrive return 'application/octet-stream' which is NOT a valid MSE
  // MIME type — addSourceBuffer() crashes immediately when it sees this.

  // FIX 2: Detect isLastChunk when upstream returns 200 (no Content-Range header).
  // Small GDrive files and some CDNs skip range responses and return the full
  // file as a single 200. Without this, endOfStream() never fires and video hangs.
  let isLastChunk = false;
  if (contentRange) {
    const match = contentRange.match(/bytes (\d+)-(\d+)\/(\d+)/);
    if (match) {
      const totalSize = parseInt(match[3], 10);
      isLastChunk = byteEnd >= totalSize - 1;
    }
  } else if (upstream.status === 200) {
    // Full file returned in one response — there will be no more chunks
    isLastChunk = true;
  }

  const nextChunkToken = isLastChunk ? '' : generateChunkToken(videoId, chunkIndex + 1);

  // FIX 3: Strip ETag and Last-Modified before forwarding to client.
  // Without this, the browser caches the chunk response and on a subsequent
  // request (e.g. React StrictMode double-invoke, retry, or seek) it sends
  // If-None-Match / If-Modified-Since. Dropbox honours these with HTTP 304
  // "Not Modified" — an empty body — which the client tries to appendBuffer()
  // causing the SourceBuffer detach / corruption errors you saw in the logs.
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Vary', '*');
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('X-Next-Chunk-Token', nextChunkToken);
  res.setHeader('X-Chunk-Index', String(chunkIndex));
  res.setHeader('X-Is-Last-Chunk', String(isLastChunk));
  res.removeHeader('ETag');
  res.removeHeader('Last-Modified');
  res.removeHeader('X-Powered-By');
  if (contentLength) res.setHeader('Content-Length', contentLength);
  if (contentRange)  res.setHeader('Content-Range', contentRange);

  res.status(206);
  // Pipe upstream body directly to response for memory efficiency
  upstream.body.pipe(res as any);
}

/**
 * GET ?action=embed&videoId=
 * Requires: ?key=MASTER_SECURITY_STRING
 * Proxies embed HTML for YouTube/Vimeo/Dailymotion
 */
async function handleEmbed(req: VercelRequest, res: VercelResponse) {
  const videoId = String(req.query.videoId || '');
  const key = (req.query.key || req.headers['x-security-string']) as string | undefined;

  if (!key || key.trim() !== CONFIG.MASTER_SECURITY_STRING.trim()) {
    return res.status(403).send('Forbidden');
  }

  const db = getFirestoreDb();
  const docSnap = await db.collection('securedVideos').doc(videoId).get();
  if (!docSnap.exists) return res.status(404).send('Not found');

  const videoData = docSnap.data()!;
  const { default: fetch } = await import('node-fetch');
  const upstream = await (fetch as any)(videoData.streamUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });

  if (!upstream.ok) return res.status(upstream.status).send('Embed error');

  res.setHeader('Content-Type', 'text/html');
  res.send(await upstream.text());
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(req, res);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    if (req.method === 'POST') {
      const action = req.body?.action;

      if (action === 'submit') return await handleSubmit(req, res);

      return res.status(400).json({ success: false, message: `Unknown POST action: ${action}` });
    }

    if (req.method === 'GET') {
      const action = String(req.query.action || 'health');

      if (action === 'meta') return await handleMeta(req, res);
      if (action === 'info') return await handleInfo(req, res);
      if (action === 'chunk') return await handleChunk(req, res);
      if (action === 'embed') return await handleEmbed(req, res);

      if (action === 'health') {
        return res.status(200).json({
          status: 'ok',
          service: 'videoStream',
          timestamp: new Date().toISOString(),
        });
      }

      return res.status(400).json({ success: false, message: `Unknown action: ${action}` });
    }

    return res.status(405).json({ success: false, message: 'Method not allowed' });
  } catch (error: any) {
    console.error('[videoStream] Unhandled error:', error);
    // Don't expose internal details in production
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      });
    }
  }
}
