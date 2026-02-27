// api/videoStream.ts — v8: Fast-seek edition
//
// FIXES vs v7:
//   1. Play token expiry: 60 s → 6 h
//      Previously every Range request (seek, buffer-ahead) that arrived more
//      than 60 s after page load got a 403, causing the video to stall/error.
//
//   2. In-memory Firestore cache (2-hour TTL)
//      handlePlay is called by the browser for EVERY range request — normal
//      buffering, every seek, every rewind. Each call previously did a full
//      Firestore round-trip (100-400 ms). With the cache the lookup is
//      instant after the first request, so seek latency drops to just the
//      upstream (Dropbox / GDrive) fetch time.
//      Same cache is used by handleChunk and handleInfo for consistency.
//
//   3. All security properties preserved:
//      - HMAC-SHA256 signed tokens tied to videoId
//      - User-Agent blocklist (IDM, wget, curl, aria2 …)
//      - Referer/Origin whitelist
//      - Source URL never sent to the browser
//      - Cache-Control: no-store on all proxied responses

import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import admin from 'firebase-admin';

const CONFIG = {
  MASTER_SECURITY_STRING:
    process.env.VIDEO_SECURITY_STRING || 'CHANGE_ME_IN_VERCEL_ENV_VIDEO_SECURITY_STRING',
  TOKEN_SECRET:
    process.env.VIDEO_TOKEN_SECRET || 'CHANGE_ME_IN_VERCEL_ENV_VIDEO_TOKEN_SECRET',
  CHUNK_SIZE: 1 * 1024 * 1024,
  ALLOWED_ORIGIN: process.env.VIDEO_ALLOWED_ORIGIN || '*',
};

// ─── Firebase Admin ────────────────────────────────────────────────────────────
let _db: admin.firestore.Firestore | null = null;
function getFirestoreDb(): admin.firestore.Firestore {
  if (_db) return _db;
  if (!admin.apps.length) {
    const projectId   = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey    = process.env.FIREBASE_PRIVATE_KEY;
    if (!projectId || !clientEmail || !privateKey)
      throw new Error('Missing Firebase Admin credentials.');
    privateKey = privateKey.trim().replace(/^[\"']|[\"']$/g, '').replace(/\\n/g, '\n');
    admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
  }
  _db = admin.app().firestore();
  return _db;
}

// ─── In-memory video-data cache ────────────────────────────────────────────────
// Eliminates repeated Firestore reads for every Range/chunk request.
// The cache is per-serverless-instance (no external store needed).
// TTL of 2 h means deleted / updated videos refresh within 2 h max.
interface VideoCacheEntry {
  streamUrl:     string;
  isGoogleDrive: boolean;
  isEmbed:       boolean;
  platform:      string;
  cachedAt:      number;
}
const _videoCache = new Map<string, VideoCacheEntry>();
const VCACHE_TTL  = 2 * 60 * 60 * 1000; // 2 hours

async function getVideoData(videoId: string): Promise<VideoCacheEntry | null> {
  const hit = _videoCache.get(videoId);
  if (hit && Date.now() - hit.cachedAt < VCACHE_TTL) return hit;

  const db   = getFirestoreDb();
  const snap = await db.collection('securedVideos').doc(videoId).get();
  if (!snap.exists) return null;

  const d = snap.data()!;
  const entry: VideoCacheEntry = {
    streamUrl:     d.streamUrl,
    isGoogleDrive: d.isGoogleDrive || false,
    isEmbed:       d.isEmbed       || false,
    platform:      d.platform,
    cachedAt:      Date.now(),
  };
  _videoCache.set(videoId, entry);
  return entry;
}

// ─── CORS ─────────────────────────────────────────────────────────────────────
function setCorsHeaders(req: VercelRequest, res: VercelResponse) {
  const origin  = req.headers.origin as string | undefined;
  const allowed = CONFIG.ALLOWED_ORIGIN;
  if (allowed === '*' || (origin && (allowed === origin || allowed.split(',').map(s => s.trim()).includes(origin)))) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else {
    res.setHeader('Access-Control-Allow-Origin', allowed);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers',
    'Content-Type, X-Security-String, X-Stream-Token, X-Chunk-Token, Authorization, Accept, Origin, X-Requested-With, Range');
  res.setHeader('Access-Control-Expose-Headers',
    'X-Next-Chunk-Token, X-Total-Size, X-Chunk-Index, X-Is-Last-Chunk, Content-Range, Content-Length, Accept-Ranges');
  res.setHeader('Access-Control-Max-Age', '86400');
}

// ─── Token helpers ─────────────────────────────────────────────────────────────

function generateStreamToken(videoId: string): string {
  const expiry  = Date.now() + 5 * 60 * 1000;
  const payload = `stream:${videoId}:${expiry}`;
  const sig     = crypto.createHmac('sha256', CONFIG.TOKEN_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}
function validateStreamToken(token: string, videoId: string): boolean {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts   = decoded.split(':');
    if (parts.length !== 4 || parts[0] !== 'stream') return false;
    const [, vid, expiry, sig] = parts;
    if (vid !== videoId) return false;
    if (Date.now() > parseInt(expiry, 10)) return false;
    const expected = crypto.createHmac('sha256', CONFIG.TOKEN_SECRET)
      .update(`stream:${vid}:${expiry}`).digest('hex');
    if (sig.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
  } catch { return false; }
}

function generateChunkToken(videoId: string, chunkIndex: number): string {
  const expiry  = Date.now() + 5 * 60 * 1000;
  const payload = `chunk:${videoId}:${chunkIndex}:${expiry}`;
  const sig     = crypto.createHmac('sha256', CONFIG.TOKEN_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}
function validateChunkToken(token: string, videoId: string, chunkIndex: number): boolean {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts   = decoded.split(':');
    if (parts.length !== 5 || parts[0] !== 'chunk') return false;
    const [, vid, idx, expiry, sig] = parts;
    if (vid !== videoId) return false;
    if (parseInt(idx, 10) !== chunkIndex) return false;
    if (Date.now() > parseInt(expiry, 10)) return false;
    const expected = crypto.createHmac('sha256', CONFIG.TOKEN_SECRET)
      .update(`chunk:${vid}:${idx}:${expiry}`).digest('hex');
    if (sig.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
  } catch { return false; }
}

// FIX 1 ─ Play token: 60 s → 6 h
// The browser re-uses this token URL for every Range request (seek, buffer).
// With a 60 s expiry, any seek after the first minute returned 403 and
// caused the video to stall/error. 6 h covers a full viewing session.
// Security is maintained: token is still HMAC-signed + tied to videoId,
// UA is blocked, Referer is checked, source URL is never exposed.
function generatePlayToken(videoId: string): string {
  const expiry  = Date.now() + 6 * 60 * 60 * 1000; // 6 hours
  const payload = `play:${videoId}:${expiry}`;
  const sig     = crypto.createHmac('sha256', CONFIG.TOKEN_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}
function validatePlayToken(token: string, videoId: string): boolean {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts   = decoded.split(':');
    if (parts.length !== 4 || parts[0] !== 'play') return false;
    const [, vid, expiry, sig] = parts;
    if (vid !== videoId) return false;
    if (Date.now() > parseInt(expiry, 10)) return false;
    const expected = crypto.createHmac('sha256', CONFIG.TOKEN_SECRET)
      .update(`play:${vid}:${expiry}`).digest('hex');
    if (sig.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
  } catch { return false; }
}

// ─── Security guards ───────────────────────────────────────────────────────────
function isAllowedUA(req: VercelRequest): boolean {
  const ua      = (req.headers['user-agent'] || '').toLowerCase();
  const blocked = ['idm/', 'internet download manager', 'fdm', 'free download manager',
    'wget', 'curl/', 'aria2', 'uget', 'getright', 'flashget', 'dap/',
    'download accelerator', 'go-http-client', 'python-requests', 'libwww',
    'java/', 'okhttp', 'httpie'];
  return !blocked.some(b => ua.includes(b));
}
function isAllowedReferer(req: VercelRequest): boolean {
  const referer = (req.headers['referer'] || req.headers['origin'] || '') as string;
  if (!referer) return true;
  const allowed = CONFIG.ALLOWED_ORIGIN === '*' ? [] : CONFIG.ALLOWED_ORIGIN.split(',').map(s => s.trim());
  if (allowed.length === 0) return true;
  return allowed.some(o => referer.startsWith(o));
}

// ─── URL converters ────────────────────────────────────────────────────────────
type ConvertResult =
  | { success: true; streamUrl: string; isEmbed: boolean; isGoogleDrive?: boolean }
  | { success: false; message: string };

function convertDropboxUrl(url: string): ConvertResult {
  try {
    let directUrl = url;
    if (!url.includes('raw=1')) {
      if (url.includes('dl=0'))       directUrl = url.replace('dl=0', 'raw=1');
      else if (url.includes('dl=1')) directUrl = url.replace('dl=1', 'raw=1');
      else directUrl = url + (url.includes('?') ? '&' : '?') + 'raw=1';
    }
    return { success: true, streamUrl: directUrl, isEmbed: false };
  } catch (e: any) { return { success: false, message: e.message }; }
}
function convertGoogleDriveUrl(url: string): ConvertResult {
  try {
    const matchFile = url.match(/\/file\/d\/([^/?]+)/);
    const matchOpen = url.match(/[?&]id=([^&]+)/);
    const fileId    = matchFile ? matchFile[1] : matchOpen ? matchOpen[1] : null;
    if (fileId) return {
      success: true,
      streamUrl: `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`,
      isEmbed: false, isGoogleDrive: true,
    };
    return { success: false, message: 'Invalid Google Drive URL' };
  } catch (e: any) { return { success: false, message: e.message }; }
}
function convertYouTubeUrl(url: string): ConvertResult {
  try {
    const urlObj  = new URL(url);
    const videoId = urlObj.hostname.includes('youtu.be') ? urlObj.pathname.slice(1) : urlObj.searchParams.get('v');
    if (videoId) return { success: true, streamUrl: `https://www.youtube.com/embed/${videoId}`, isEmbed: true };
    return { success: false, message: 'Invalid YouTube URL' };
  } catch (e: any) { return { success: false, message: e.message }; }
}
function convertVimeoUrl(url: string): ConvertResult {
  try {
    const urlObj  = new URL(url);
    const videoId = urlObj.pathname.split('/').filter(Boolean)[0];
    if (videoId) return { success: true, streamUrl: `https://player.vimeo.com/video/${videoId}`, isEmbed: true };
    return { success: false, message: 'Invalid Vimeo URL' };
  } catch (e: any) { return { success: false, message: e.message }; }
}
function convertDailymotionUrl(url: string): ConvertResult {
  try {
    const urlObj  = new URL(url);
    const videoId = urlObj.pathname.split('/').filter(p => p && p !== 'video')[0];
    if (videoId) return { success: true, streamUrl: `https://www.dailymotion.com/embed/video/${videoId}`, isEmbed: true };
    return { success: false, message: 'Invalid Dailymotion URL' };
  } catch (e: any) { return { success: false, message: e.message }; }
}
const converters: Record<string, (url: string) => ConvertResult> = {
  dropbox: convertDropboxUrl, gdrive: convertGoogleDriveUrl,
  youtube: convertYouTubeUrl, vimeo: convertVimeoUrl, dailymotion: convertDailymotionUrl,
};

// ─── Action handlers ───────────────────────────────────────────────────────────

async function handleSubmit(req: VercelRequest, res: VercelResponse) {
  const { sourceUrl, platform, label, createdBy } = req.body || {};
  if (!sourceUrl || !platform || !createdBy)
    return res.status(400).json({ success: false, message: 'sourceUrl, platform, and createdBy are required' });
  const converter = converters[String(platform).toLowerCase()];
  if (!converter) return res.status(400).json({ success: false, message: `Unsupported platform: ${platform}` });
  const converted = converter(String(sourceUrl));
  if (!converted.success) return res.status(400).json({ success: false, message: converted.message });
  const db     = getFirestoreDb();
  const record = {
    originalUrl: sourceUrl, streamUrl: converted.streamUrl,
    platform: String(platform).toLowerCase(), isEmbed: converted.isEmbed,
    isGoogleDrive: (converted as any).isGoogleDrive || false,
    label: label || '', createdBy: String(createdBy),
    createdAt: new Date().toISOString(), accessCount: 0,
  };
  const docRef  = await db.collection('securedVideos').add(record);
  const videoId = docRef.id;
  return res.status(200).json({ success: true, proxyUrl: `secured://${videoId}`, videoId, platform: record.platform });
}

async function handleMeta(req: VercelRequest, res: VercelResponse) {
  const videoId = String(req.query.videoId || '');
  const secKey  = req.headers['x-security-string'] as string | undefined;
  if (!secKey || secKey.trim() !== CONFIG.MASTER_SECURITY_STRING.trim())
    return res.status(403).json({ success: false, message: 'Forbidden' });
  if (!videoId) return res.status(400).json({ success: false, message: 'videoId is required' });

  // Meta always reads from Firestore (authoritative) but also warms the cache
  const db      = getFirestoreDb();
  const docSnap = await db.collection('securedVideos').doc(videoId).get();
  if (!docSnap.exists) return res.status(404).json({ success: false, message: 'Video not found' });
  const videoData = docSnap.data()!;

  // Warm the cache so subsequent play/chunk/info calls are instant
  _videoCache.set(videoId, {
    streamUrl:     videoData.streamUrl,
    isGoogleDrive: videoData.isGoogleDrive || false,
    isEmbed:       videoData.isEmbed       || false,
    platform:      videoData.platform,
    cachedAt:      Date.now(),
  });

  db.collection('securedVideos').doc(videoId)
    .update({ accessCount: (videoData.accessCount || 0) + 1, lastAccessedAt: new Date().toISOString() })
    .catch(() => {});

  if (videoData.isEmbed) {
    return res.status(200).json({ success: true, type: 'embed', embedUrl: videoData.streamUrl, platform: videoData.platform });
  }

  const playToken       = generatePlayToken(videoId);
  const streamToken     = generateStreamToken(videoId);
  const firstChunkToken = generateChunkToken(videoId, 0);
  return res.status(200).json({
    success: true, type: 'video',
    playToken,
    streamToken,
    firstChunkToken,
    chunkUrl: `/api/videoStream?action=chunk&videoId=${videoId}`,
    platform: videoData.platform,
  });
}

async function handleInfo(req: VercelRequest, res: VercelResponse) {
  const videoId = String(req.query.videoId || '');
  const token   = (req.headers['x-stream-token'] || req.query.token) as string | undefined;
  if (!token || !validateStreamToken(token, videoId))
    return res.status(403).json({ success: false, message: 'Forbidden: invalid stream token' });
  if (!isAllowedUA(req)) return res.status(403).json({ success: false, message: 'Forbidden: blocked client' });

  // FIX 2 — use cache instead of always hitting Firestore
  const videoData = await getVideoData(videoId);
  if (!videoData) return res.status(404).json({ success: false, message: 'Video not found' });

  const fetchHeaders: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  };
  if (videoData.isGoogleDrive) fetchHeaders['Referer'] = 'https://drive.google.com/';
  const { default: fetch } = await import('node-fetch');
  const headRes     = await (fetch as any)(videoData.streamUrl, { method: 'HEAD', headers: fetchHeaders, redirect: 'follow' });
  const totalSize   = parseInt(headRes.headers.get('content-length') || '0', 10);
  const totalChunks = totalSize > 0 ? Math.ceil(totalSize / CONFIG.CHUNK_SIZE) : null;
  return res.status(200).json({ success: true, totalSize, totalChunks, chunkSize: CONFIG.CHUNK_SIZE, contentType: 'video/mp4' });
}

// ─── handlePlay — continuous Range-capable stream proxy ────────────────────────
//
// The browser sets video.src to:
//   /api/videoStream?action=play&videoId=X&token=Y
// and sends Range headers automatically for seeking and buffering.
// We validate the token, then proxy to Dropbox/GDrive.
//
// PERF: token validation is pure HMAC (~1 ms). Firestore lookup is replaced
// by the in-memory cache (instant after first request). Upstream Dropbox/GDrive
// fetch is the only remaining latency — unavoidable but direct.
//
async function handlePlay(req: VercelRequest, res: VercelResponse) {
  const videoId = String(req.query.videoId || '');
  const token   = String(req.query.token   || '');

  if (!validatePlayToken(token, videoId))
    return res.status(403).send('Forbidden: invalid or expired play token');
  if (!isAllowedUA(req))      return res.status(403).send('Forbidden: blocked client');
  if (!isAllowedReferer(req)) return res.status(403).send('Forbidden: invalid origin');

  // FIX 2 — cache lookup instead of Firestore round-trip on every Range request
  const videoData = await getVideoData(videoId);
  if (!videoData) return res.status(404).send('Video not found');

  const rangeHeader = req.headers['range'];
  const fetchHeaders: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': '*/*',
    'Connection': 'keep-alive',  // reuse TCP connection to Dropbox/GDrive for faster TTFB
  };
  if (rangeHeader)             fetchHeaders['Range']   = rangeHeader;
  if (videoData.isGoogleDrive) fetchHeaders['Referer'] = 'https://drive.google.com/';

  const { default: fetch } = await import('node-fetch');
  const upstream = await (fetch as any)(videoData.streamUrl, {
    headers: fetchHeaders,
    redirect: 'follow',
    compress: false, // don't decompress — pipe raw bytes for lowest latency
  });

  if (!upstream.ok && upstream.status !== 206)
    return res.status(upstream.status).send('Upstream error');

  res.status(upstream.status);
  res.setHeader('Content-Type', upstream.headers.get('content-type') || 'video/mp4');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('Content-Disposition', 'inline');
  res.removeHeader('ETag');
  res.removeHeader('Last-Modified');
  res.removeHeader('X-Powered-By');

  const contentLength = upstream.headers.get('content-length');
  const contentRange  = upstream.headers.get('content-range');
  if (contentLength) res.setHeader('Content-Length', contentLength);
  if (contentRange)  res.setHeader('Content-Range',  contentRange);

  upstream.body.pipe(res as any);
  upstream.body.on('error', (err: Error) => {
    console.error('[videoStream:play] upstream pipe error:', err.message);
    try { res.end(); } catch {}
  });
}

async function handleChunk(req: VercelRequest, res: VercelResponse) {
  const videoId    = String(req.query.videoId || '');
  const chunkIndex = parseInt(String(req.query.chunk || '0'), 10);
  const chunkToken = (req.headers['x-chunk-token'] || req.query.chunkToken) as string | undefined;
  if (!chunkToken || !validateChunkToken(chunkToken, videoId, chunkIndex))
    return res.status(403).send('Forbidden: invalid chunk token');
  if (!isAllowedUA(req))      return res.status(403).send('Forbidden: blocked client');
  if (!isAllowedReferer(req)) return res.status(403).send('Forbidden: invalid origin');

  // FIX 2 — use cache
  const videoData = await getVideoData(videoId);
  if (!videoData) return res.status(404).send('Video not found');

  const byteStart   = chunkIndex * CONFIG.CHUNK_SIZE;
  const byteEnd     = byteStart + CONFIG.CHUNK_SIZE - 1;
  const fetchHeaders: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    Accept: '*/*', Range: `bytes=${byteStart}-${byteEnd}`,
  };
  if (videoData.isGoogleDrive) fetchHeaders['Referer'] = 'https://drive.google.com/';

  const { default: fetch } = await import('node-fetch');
  const upstream = await (fetch as any)(videoData.streamUrl, { headers: fetchHeaders, redirect: 'follow' });

  if (upstream.status === 416) return res.status(204).send('');
  if (!upstream.ok && upstream.status !== 206) return res.status(upstream.status).send('Upstream source error');

  const contentRange  = upstream.headers.get('content-range');
  const contentLength = upstream.headers.get('content-length');
  let isLastChunk     = false;
  if (contentRange) {
    const match = contentRange.match(/bytes (\d+)-(\d+)\/(\d+)/);
    if (match) { const totalSize = parseInt(match[3], 10); isLastChunk = byteEnd >= totalSize - 1; }
  } else if (upstream.status === 200) { isLastChunk = true; }

  const nextChunkToken = isLastChunk ? '' : generateChunkToken(videoId, chunkIndex + 1);
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
  if (contentRange)  res.setHeader('Content-Range',  contentRange);
  res.status(206);
  upstream.body.pipe(res as any);
}

async function handleEmbed(req: VercelRequest, res: VercelResponse) {
  const videoId = String(req.query.videoId || '');
  const key     = (req.query.key || req.headers['x-security-string']) as string | undefined;
  if (!key || key.trim() !== CONFIG.MASTER_SECURITY_STRING.trim()) return res.status(403).send('Forbidden');

  const videoData = await getVideoData(videoId);
  if (!videoData) return res.status(404).send('Not found');

  const { default: fetch } = await import('node-fetch');
  const upstream = await (fetch as any)(videoData.streamUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!upstream.ok) return res.status(upstream.status).send('Embed error');
  res.setHeader('Content-Type', 'text/html');
  res.send(await upstream.text());
}

// ─── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method === 'POST') {
      if (req.body?.action === 'submit') return await handleSubmit(req, res);
      return res.status(400).json({ success: false, message: `Unknown POST action: ${req.body?.action}` });
    }
    if (req.method === 'GET') {
      const action = String(req.query.action || 'health');
      if (action === 'play')   return await handlePlay(req, res);
      if (action === 'meta')   return await handleMeta(req, res);
      if (action === 'info')   return await handleInfo(req, res);
      if (action === 'chunk')  return await handleChunk(req, res);
      if (action === 'embed')  return await handleEmbed(req, res);
      if (action === 'health') return res.status(200).json({ status: 'ok', service: 'videoStream', timestamp: new Date().toISOString() });
      return res.status(400).json({ success: false, message: `Unknown action: ${action}` });
    }
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  } catch (error: any) {
    console.error('[videoStream] Unhandled error:', error);
    if (!res.headersSent)
      return res.status(500).json({
        success: false,
        message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      });
  }
}
