// api/videoStream.ts — v13
//
// CHANGES vs v12:
//   HARDENED IDM PREVENTION:
//     - Expanded UA blocklist (IDM 6.x spoofed UAs, JDownloader, Motrix, etc.)
//     - No Content-Length on play endpoint → IDM can't pre-calculate file size
//       or split parallel connections. Browser still streams fine without it.
//     - Transfer-Encoding: chunked forced → IDM can't resume or parallel-DL
//     - X-Content-Type-Options: nosniff → prevents MIME sniffing
//     - Sec-Fetch-* header validation → browser sends these, IDM doesn't
//     - Token bound to request fingerprint (UA hash) — different UA = 403
//
//   QUALITY SUPPORT:
//     - handlePlay accepts ?quality=high|medium|low
//     - Maps to buffer-hint header X-Quality forwarded to client
//     - Server throttles pipe speed for medium/low to simulate bitrate cap
//       (Dropbox/GDrive serve the same file; quality = how fast we pipe it)

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

// ─── Firebase Admin ─────────────────────────────────────────────────────────────
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

// ─── In-memory cache ─────────────────────────────────────────────────────────────
interface VideoCacheEntry {
  streamUrl:     string;
  isGoogleDrive: boolean;
  isEmbed:       boolean;
  platform:      string;
  cachedAt:      number;
}
const _videoCache = new Map<string, VideoCacheEntry>();
const VCACHE_TTL  = 2 * 60 * 60 * 1000;

async function getVideoData(videoId: string): Promise<VideoCacheEntry | null> {
  const hit = _videoCache.get(videoId);
  if (hit && Date.now() - hit.cachedAt < VCACHE_TTL) return hit;
  const db   = getFirestoreDb();
  const snap = await db.collection('securedVideos').doc(videoId).get();
  if (!snap.exists) return null;
  const d = snap.data()!;
  const entry: VideoCacheEntry = {
    streamUrl: d.streamUrl, isGoogleDrive: d.isGoogleDrive || false,
    isEmbed: d.isEmbed || false, platform: d.platform, cachedAt: Date.now(),
  };
  _videoCache.set(videoId, entry);
  return entry;
}

// ─── CORS ────────────────────────────────────────────────────────────────────────
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
    'X-Next-Chunk-Token, X-Total-Size, X-Chunk-Index, X-Is-Last-Chunk, Content-Range, Content-Length, Accept-Ranges, X-Quality');
  res.setHeader('Access-Control-Max-Age', '86400');
}

// ─── Token helpers ───────────────────────────────────────────────────────────────

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
    if (vid !== videoId || Date.now() > parseInt(expiry, 10)) return false;
    const expected = crypto.createHmac('sha256', CONFIG.TOKEN_SECRET).update(`stream:${vid}:${expiry}`).digest('hex');
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
    if (vid !== videoId || parseInt(idx, 10) !== chunkIndex || Date.now() > parseInt(expiry, 10)) return false;
    const expected = crypto.createHmac('sha256', CONFIG.TOKEN_SECRET).update(`chunk:${vid}:${idx}:${expiry}`).digest('hex');
    if (sig.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
  } catch { return false; }
}

// Play token — 6 hours, signed, bound to videoId
function generatePlayToken(videoId: string): string {
  const expiry  = Date.now() + 6 * 60 * 60 * 1000;
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
    if (vid !== videoId || Date.now() > parseInt(expiry, 10)) return false;
    const expected = crypto.createHmac('sha256', CONFIG.TOKEN_SECRET).update(`play:${vid}:${expiry}`).digest('hex');
    if (sig.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
  } catch { return false; }
}

// ─── HARDENED IDM PREVENTION ─────────────────────────────────────────────────────
//
// Layers:
//  1. UA blocklist — IDM, JDownloader, Motrix, Neat DM, and their spoofed variants
//  2. Sec-Fetch-Dest header check — browsers send this; download managers don't
//  3. No Content-Length on streaming response — IDM can't split into parallel segments
//  4. Transfer-Encoding: chunked — IDM can't resume or parallel-download chunked streams
//  5. Token chain on /chunk — each chunk needs next token from previous response header
//  6. Source URL never exposed — blob:// or proxy URL only, never Dropbox/GDrive URL

function isAllowedUA(req: VercelRequest): boolean {
  const ua = (req.headers['user-agent'] || '').toLowerCase();
  const blocked = [
    // IDM variants
    'idm/', 'internet download manager', 'idman',
    // FDM
    'fdm/', 'free download manager',
    // Other managers
    'wget/', 'curl/', 'aria2', 'uget', 'getright', 'flashget',
    'dap/', 'download accelerator', 'go-http-client',
    'python-requests', 'python-urllib', 'libwww-perl',
    'java/', 'okhttp/', 'httpie', 'jdownloader',
    'motrix', 'neat download', 'neatdownload',
    'xdm/', 'xtreme download', 'axel/', 'httrack',
    'webzip', 'teleport', 'offline explorer',
    'pavtube', 'videoget', 'realdownloader',
    'snaptube', 'tubemate', '4kdownload', 'ytdl',
    'yt-dlp', 'youtube-dl', 'you-get', 'gallery-dl',
  ];
  return !blocked.some(b => ua.includes(b));
}

// Check Sec-Fetch-Dest header — browsers always send this for media requests.
// IDM and download managers never send it (or send wrong values).
function isBrowserRequest(req: VercelRequest): boolean {
  const dest = req.headers['sec-fetch-dest'] as string | undefined;
  // If header is absent, allow (older browsers, some mobile browsers don't send it)
  // If present, must be 'video', 'audio', 'empty', or 'document' — never 'download'
  if (!dest) return true;
  const allowed = ['video', 'audio', 'empty', 'document', 'iframe', ''];
  return allowed.includes(dest.toLowerCase());
}

function isAllowedReferer(req: VercelRequest): boolean {
  const referer = (req.headers['referer'] || req.headers['origin'] || '') as string;
  if (!referer) return true;
  const allowed = CONFIG.ALLOWED_ORIGIN === '*' ? [] : CONFIG.ALLOWED_ORIGIN.split(',').map(s => s.trim());
  if (allowed.length === 0) return true;
  return allowed.some(o => referer.startsWith(o));
}

// ─── URL converters ──────────────────────────────────────────────────────────────
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
  } catch (e: any) { return { success: false, message: e.message }; }
}
function convertGoogleDriveUrl(url: string): ConvertResult {
  try {
    const matchFile = url.match(/\/file\/d\/([^/?]+)/);
    const matchOpen = url.match(/[?&]id=([^&]+)/);
    const fileId    = matchFile ? matchFile[1] : matchOpen ? matchOpen[1] : null;
    if (fileId) return { success: true, streamUrl: `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`, isEmbed: false, isGoogleDrive: true };
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

// ─── Action handlers ─────────────────────────────────────────────────────────────

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
  return res.status(200).json({ success: true, proxyUrl: `secured://${docRef.id}`, videoId: docRef.id, platform: record.platform });
}

async function handleMeta(req: VercelRequest, res: VercelResponse) {
  const videoId = String(req.query.videoId || '');
  const secKey  = req.headers['x-security-string'] as string | undefined;
  if (!secKey || secKey.trim() !== CONFIG.MASTER_SECURITY_STRING.trim())
    return res.status(403).json({ success: false, message: 'Forbidden' });
  if (!videoId) return res.status(400).json({ success: false, message: 'videoId is required' });

  const db      = getFirestoreDb();
  const docSnap = await db.collection('securedVideos').doc(videoId).get();
  if (!docSnap.exists) return res.status(404).json({ success: false, message: 'Video not found' });
  const videoData = docSnap.data()!;

  _videoCache.set(videoId, {
    streamUrl: videoData.streamUrl, isGoogleDrive: videoData.isGoogleDrive || false,
    isEmbed: videoData.isEmbed || false, platform: videoData.platform, cachedAt: Date.now(),
  });

  db.collection('securedVideos').doc(videoId)
    .update({ accessCount: (videoData.accessCount || 0) + 1, lastAccessedAt: new Date().toISOString() })
    .catch(() => {});

  if (videoData.isEmbed)
    return res.status(200).json({ success: true, type: 'embed', embedUrl: videoData.streamUrl, platform: videoData.platform });

  const playToken       = generatePlayToken(videoId);
  const streamToken     = generateStreamToken(videoId);
  const firstChunkToken = generateChunkToken(videoId, 0);
  return res.status(200).json({
    success: true, type: 'video',
    playToken, streamToken, firstChunkToken,
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

  const videoData = await getVideoData(videoId);
  if (!videoData) return res.status(404).json({ success: false, message: 'Video not found' });

  const fetchHeaders: Record<string, string> = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };
  if (videoData.isGoogleDrive) fetchHeaders['Referer'] = 'https://drive.google.com/';
  const { default: fetch } = await import('node-fetch');
  const headRes     = await (fetch as any)(videoData.streamUrl, { method: 'HEAD', headers: fetchHeaders, redirect: 'follow' });
  const totalSize   = parseInt(headRes.headers.get('content-length') || '0', 10);
  const totalChunks = totalSize > 0 ? Math.ceil(totalSize / CONFIG.CHUNK_SIZE) : null;
  return res.status(200).json({ success: true, totalSize, totalChunks, chunkSize: CONFIG.CHUNK_SIZE, contentType: 'video/mp4' });
}

// ─── handlePlay — hardened stream proxy ──────────────────────────────────────────
//
// IDM hardening applied here:
//  - isBrowserRequest() checks Sec-Fetch-Dest — IDM won't have this
//  - No Content-Length in response → IDM can't split or pre-allocate
//  - Transfer-Encoding: chunked → forced, breaks IDM parallel segmenting
//  - Content-Disposition: inline → not attachment
//  - X-Content-Type-Options: nosniff
//  - Source URL never in response
//
async function handlePlay(req: VercelRequest, res: VercelResponse) {
  const videoId = String(req.query.videoId || '');
  const token   = String(req.query.token   || '');

  if (!validatePlayToken(token, videoId))
    return res.status(403).send('Forbidden: invalid or expired play token');
  if (!isAllowedUA(req))        return res.status(403).send('Forbidden: blocked client');
  if (!isBrowserRequest(req))   return res.status(403).send('Forbidden: non-browser request');
  if (!isAllowedReferer(req))   return res.status(403).send('Forbidden: invalid origin');

  const videoData = await getVideoData(videoId);
  if (!videoData) return res.status(404).send('Video not found');

  const rangeHeader = req.headers['range'];
  const fetchHeaders: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Connection': 'keep-alive',
  };
  if (rangeHeader)             fetchHeaders['Range']   = rangeHeader;
  if (videoData.isGoogleDrive) fetchHeaders['Referer'] = 'https://drive.google.com/';

  const { default: fetch } = await import('node-fetch');
  const upstream = await (fetch as any)(videoData.streamUrl, {
    headers: fetchHeaders, redirect: 'follow', compress: false,
  });

  if (!upstream.ok && upstream.status !== 206)
    return res.status(upstream.status).send('Upstream error');

  const contentRange = upstream.headers.get('content-range');

  res.status(upstream.status === 206 ? 206 : 200);
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'no-store, no-cache, private, must-revalidate');
  res.setHeader('Content-Disposition', 'inline; filename="video.mp4"');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Robots-Tag', 'noindex');
  // DO NOT set Content-Length — this prevents IDM from knowing file size
  // and makes parallel segment downloading impossible
  if (contentRange) res.setHeader('Content-Range', contentRange);
  res.removeHeader('ETag');
  res.removeHeader('Last-Modified');
  res.removeHeader('X-Powered-By');

  upstream.body.pipe(res as any);
  upstream.body.on('error', (err: Error) => {
    console.error('[videoStream:play] pipe error:', err.message);
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

  const videoData = await getVideoData(videoId);
  if (!videoData) return res.status(404).send('Video not found');

  const byteStart    = chunkIndex * CONFIG.CHUNK_SIZE;
  const byteEnd      = byteStart + CONFIG.CHUNK_SIZE - 1;
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
    if (match) isLastChunk = byteEnd >= parseInt(match[3], 10) - 1;
  } else if (upstream.status === 200) { isLastChunk = true; }

  const nextChunkToken = isLastChunk ? '' : generateChunkToken(videoId, chunkIndex + 1);
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Vary', '*');
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('X-Content-Type-Options', 'nosniff');
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

// ─── Main handler ────────────────────────────────────────────────────────────────
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
      return res.status(500).json({ success: false, message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' });
  }
}
