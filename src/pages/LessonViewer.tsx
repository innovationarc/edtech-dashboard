// src/pages/LessonViewer.tsx — v6: Progressive playback via mp4box.js + MSE
//
// WHY THIS APPROACH:
//   Previous versions downloaded the ENTIRE video before playing (blob-concat).
//   For a 20MB video on a 300 KB/s mobile connection = 65 seconds wait.
//   This version starts playing after ~2-3MB (the first few seconds of video).
//
// HOW IT WORKS:
//   1. Chunks arrive via our token-chain API (1MB each, anti-IDM protected)
//   2. Each chunk is fed to mp4box.js (pure JS, loaded from CDN)
//   3. mp4box.js converts unfragmented MP4 → fragmented MP4 segments on-the-fly
//   4. Segments are fed to MSE/SourceBuffer — browser can decode immediately
//   5. Playback starts after ~2-3 chunks (moov box parsed + first segments ready)
//
// WHY mp4box.js SOLVES THE "unfragmented MP4" ERROR:
//   MSE requires fragmented MP4. Standard Dropbox/GDrive files are unfragmented.
//   mp4box.js reads the raw bytes, parses the MP4 structure, and re-emits proper
//   fMP4 segments with correct moof+mdat boxes that MSE accepts.
//   This is exactly how production video platforms handle arbitrary MP4 files.
//
// FALLBACK:
//   If mp4box.js fails (network error, unusual MP4 variant), falls back to the
//   blob-concat approach from v5. Users see the full download but video still works.
//
// ANTI-DOWNLOAD PROTECTION (unchanged):
//   Token-chained chunks, raw URL never exposed, right-click/keyboard blocked.

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, FileText, ExternalLink, Download, Shield,
  AlertCircle, Loader2, Play, Clock, BookOpen, Lock,
} from 'lucide-react';
import { contentLibraryService, LibraryContent } from '../services/contentLibraryService';
import { videoStreamService } from '../services/videoStreamService';
import { useDashboard } from '../contexts/DashboardContext';

const SECURITY_STRING =
  (import.meta as any).env?.VITE_VIDEO_SECURITY_STRING ||
  'CHANGE_ME_IN_VITE_ENV_VITE_VIDEO_SECURITY_STRING';

const CHUNK_SIZE = 1 * 1024 * 1024; // must match server CONFIG.CHUNK_SIZE

const DEBUG  = true;
const log    = (...a: any[]) => { if (DEBUG) console.log('[LessonViewer]', ...a); };
const logErr = (...a: any[]) => console.error('[LessonViewer ERROR]', ...a);

function formatDuration(s: number): string {
  if (!s || isNaN(s) || !isFinite(s)) return '0:00';
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), ss = Math.floor(s%60);
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
  return `${m}:${String(ss).padStart(2,'0')}`;
}
function formatMinutes(mins: number): string {
  if (!mins) return '—';
  const h = Math.floor(mins/60), m = Math.round(mins%60);
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}
function formatBytes(b: number): string {
  if (b < 1024*1024) return `${(b/1024).toFixed(0)} KB`;
  return `${(b/(1024*1024)).toFixed(1)} MB`;
}

function injectAntiPiracy() {
  document.addEventListener('contextmenu', e => e.preventDefault(), true);
  document.addEventListener('keydown', e => {
    const ctrl = e.ctrlKey || e.metaKey;
    if (e.key === 'F12') { e.preventDefault(); return; }
    if (ctrl && ['s','u','p','i','j','c'].includes(e.key.toLowerCase())) { e.preventDefault(); return; }
    if (ctrl && e.shiftKey && ['i','j','c'].includes(e.key.toLowerCase())) { e.preventDefault(); return; }
    if (e.key === 'PrintScreen') { e.preventDefault(); return; }
  }, true);
  try { (window as any).MediaRecorder = undefined; } catch {}
  try {
    const nav = navigator as any;
    if (nav.mediaDevices?.getDisplayMedia)
      nav.mediaDevices.getDisplayMedia = () => Promise.reject(new Error('Disabled.'));
    const orig = nav.mediaDevices?.getUserMedia?.bind(nav.mediaDevices);
    if (orig) nav.mediaDevices.getUserMedia = (c: any) =>
      c?.video ? Promise.reject(new Error('Disabled.')) : orig(c);
  } catch {}
}

function useDevToolsDetection(onOpen: () => void, onClose: () => void) {
  useEffect(() => {
    let open = false;
    const check = () => {
      const isOpen = window.outerWidth - window.innerWidth > 160 || window.outerHeight - window.innerHeight > 160;
      if (isOpen && !open)  { open = true;  onOpen();  }
      if (!isOpen && open)  { open = false; onClose(); }
    };
    const id = setInterval(check, 1000);
    window.addEventListener('resize', check);
    return () => { clearInterval(id); window.removeEventListener('resize', check); };
  }, [onOpen, onClose]);
}

type PlayerState = 'idle' | 'loading' | 'buffering' | 'playing' | 'paused' | 'error' | 'devtools';

// ─── Load mp4box.js from CDN (once) ───────────────────────────────────────────
let mp4boxPromise: Promise<any> | null = null;
function loadMp4Box(): Promise<any> {
  if (mp4boxPromise) return mp4boxPromise;
  mp4boxPromise = new Promise((resolve, reject) => {
    if ((window as any).MP4Box) { resolve((window as any).MP4Box); return; }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mp4box@0.5.2/dist/mp4box.all.min.js';
    script.onload  = () => resolve((window as any).MP4Box);
    script.onerror = () => { mp4boxPromise = null; reject(new Error('Failed to load mp4box.js')); };
    document.head.appendChild(script);
  });
  return mp4boxPromise;
}

// ─── Fetch one chunk with cache-busting ──────────────────────────────────────
async function fetchChunk(
  videoId: string, idx: number, token: string
): Promise<{ buffer: ArrayBuffer; nextToken: string; isLast: boolean }> {
  const url = `${window.location.origin}/api/videoStream?action=chunk&videoId=${encodeURIComponent(videoId)}&chunk=${idx}&_t=${Date.now()}`;
  const res = await fetch(url, { headers: { 'x-chunk-token': token }, cache: 'no-store' });
  if (res.status === 204) return { buffer: new ArrayBuffer(0), nextToken: '', isLast: true };
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buffer    = await res.arrayBuffer();
  const nextToken = res.headers.get('x-next-chunk-token') || '';
  const isLast    = res.headers.get('x-is-last-chunk') === 'true';
  log(`chunk ${idx}: ${buffer.byteLength}b isLast=${isLast}`);
  return { buffer, nextToken, isLast };
}

// ─── Promise-based SourceBuffer append ───────────────────────────────────────
function waitForSBUpdate(sb: SourceBuffer): Promise<void> {
  if (!sb.updating) return Promise.resolve();
  return new Promise((res, rej) => {
    sb.addEventListener('updateend', () => res(), { once: true });
    sb.addEventListener('error',     () => rej(new Error('SB update error')), { once: true });
  });
}
async function appendToSB(ms: MediaSource, sb: SourceBuffer, data: ArrayBuffer): Promise<void> {
  if (ms.readyState !== 'open') return;
  await waitForSBUpdate(sb);
  if (ms.readyState !== 'open') return;
  await new Promise<void>((resolve, reject) => {
    sb.addEventListener('updateend', () => resolve(), { once: true });
    sb.addEventListener('error',     () => reject(new Error('SB append error')), { once: true });
    try { sb.appendBuffer(data); }
    catch (e: any) { reject(e); }
  });
}

// ─── SESSION: abort signal ────────────────────────────────────────────────────
interface Session { stopped: boolean }

// ─── MODE A: Progressive playback via mp4box.js + MSE ────────────────────────
async function runProgressivePipeline(
  videoId:    string,
  firstToken: string,
  video:      HTMLVideoElement,
  session:    Session,
  onProgress: (chunks: number, bytes: number) => void,
  onPlaying:  () => void,
  onError:    (msg: string) => void,
): Promise<void> {
  const MP4Box = await loadMp4Box();
  if (session.stopped) return;

  const ms = new MediaSource();
  const msUrl = URL.createObjectURL(ms);
  video.src = msUrl;
  video.preload = 'auto';

  log('MSE+mp4box pipeline starting');

  await new Promise<void>((resolveSourceOpen, rejectSourceOpen) => {
    ms.addEventListener('sourceopen', () => resolveSourceOpen(), { once: true });
    ms.addEventListener('error', () => rejectSourceOpen(new Error('MediaSource error')), { once: true });
    // Safety timeout
    setTimeout(() => rejectSourceOpen(new Error('sourceopen timeout')), 10000);
  });

  if (session.stopped) { URL.revokeObjectURL(msUrl); return; }
  log('sourceopen OK');

  // mp4box pipeline state
  const mp4boxFile = MP4Box.createFile();
  let sb: SourceBuffer | null = null;
  let sbReady = false;
  const segmentQueue: ArrayBuffer[] = [];
  let processingQueue = false;
  let playStarted = false;
  let allChunksFeeded = false;
  let pendingEOS = false;

  // Drain the segment queue sequentially into SourceBuffer
  async function drainQueue() {
    if (processingQueue || !sb || !sbReady) return;
    processingQueue = true;
    while (segmentQueue.length > 0 && ms.readyState === 'open') {
      if (session.stopped) break;
      const seg = segmentQueue.shift()!;
      try {
        await appendToSB(ms, sb, seg);
      } catch (e: any) {
        logErr('SB append failed:', e.message);
        break;
      }
      // Try to play once we have some data
      if (!playStarted && sb.buffered.length > 0) {
        const buffered = sb.buffered.end(sb.buffered.length - 1) - sb.buffered.start(0);
        if (buffered >= 2) { // 2 seconds buffered → start playing
          playStarted = true;
          onPlaying();
          video.play().catch(e => log('autoplay blocked:', e.message));
        }
      }
    }
    processingQueue = false;

    // If all chunks fed and queue empty, call endOfStream
    if (allChunksFeeded && segmentQueue.length === 0 && pendingEOS) {
      pendingEOS = false;
      if (ms.readyState === 'open') {
        try { ms.endOfStream(); log('endOfStream called'); } catch {}
      }
      if (!playStarted) { playStarted = true; onPlaying(); video.play().catch(() => {}); }
    }
  }

  // mp4box: called when moov box is parsed (knows codec + track info)
  mp4boxFile.onReady = (info: any) => {
    if (session.stopped) return;
    log('mp4box onReady, tracks:', info.tracks?.length);

    const videoTrack = info.videoTracks?.[0];
    const audioTrack = info.audioTracks?.[0];
    if (!videoTrack) { onError('No video track found in MP4'); return; }

    const codecs = audioTrack
      ? `${videoTrack.codec},${audioTrack.codec}`
      : videoTrack.codec;
    const mimeType = `video/mp4; codecs="${codecs}"`;
    log('mimeType:', mimeType);

    if (!MediaSource.isTypeSupported(mimeType)) {
      // Fallback to generic mp4
      log('codec not supported, trying generic video/mp4');
    }

    try {
      sb = ms.addSourceBuffer(MediaSource.isTypeSupported(mimeType) ? mimeType : 'video/mp4');
      sb.mode = 'segments';
    } catch (e: any) {
      onError(`addSourceBuffer failed: ${e.message}`);
      return;
    }

    sbReady = true;

    // Set segmentation options for all tracks
    for (const track of info.tracks) {
      mp4boxFile.setSegmentOptions(track.id, null, { nbSamples: 200 });
    }

    // initializeSegmentation returns init segments (one per track)
    const initSegs = mp4boxFile.initializeSegmentation();
    for (const { buffer } of initSegs) {
      segmentQueue.push(buffer);
    }
    drainQueue();
  };

  // mp4box: called whenever a new fMP4 segment is ready
  mp4boxFile.onSegment = (id: number, user: any, buffer: ArrayBuffer, sampleNum: number) => {
    if (session.stopped) return;
    segmentQueue.push(buffer);
    mp4boxFile.releaseUsedSamples(id, sampleNum);
    drainQueue();
  };

  mp4boxFile.onError = (e: string) => {
    logErr('mp4box error:', e);
    if (!session.stopped) onError(`MP4 parse error: ${e}`);
  };

  // Chunk download loop — feeds raw bytes into mp4box as they arrive
  let token = firstToken, idx = 0, totalBytes = 0;

  while (token && !session.stopped) {
    let buffer: ArrayBuffer, nextToken: string, isLast: boolean;
    try {
      ({ buffer, nextToken, isLast } = await fetchChunk(videoId, idx, token));
    } catch (e: any) {
      if (idx > 0) {
        log('network error — treating as end of stream:', e.message);
        break;
      }
      throw e;
    }

    if (buffer.byteLength === 0) { log('empty chunk → EOS'); break; }

    // Tag the buffer with its file offset (mp4box requirement)
    (buffer as any).fileStart = idx * CHUNK_SIZE;
    mp4boxFile.appendBuffer(buffer);

    totalBytes += buffer.byteLength;
    idx++;
    token = nextToken;
    onProgress(idx, totalBytes);

    if (isLast || !nextToken) break;
  }

  if (session.stopped) { URL.revokeObjectURL(msUrl); return; }

  // Signal to mp4box that all data has been provided
  mp4boxFile.flush();
  allChunksFeeded = true;
  pendingEOS = true;

  // Give the queue a chance to drain
  await drainQueue();

  // If the queue didn't drain synchronously, wait a bit
  await new Promise<void>(resolve => setTimeout(resolve, 500));
  if (pendingEOS) {
    pendingEOS = false;
    if (ms.readyState === 'open') {
      try { ms.endOfStream(); } catch {}
    }
    if (!playStarted) { playStarted = true; onPlaying(); video.play().catch(() => {}); }
  }

  log('pipeline complete');
}

// ─── MODE B: Fallback blob-concat (unchanged from v5) ────────────────────────
async function runBlobFallback(
  videoId:    string,
  firstToken: string,
  video:      HTMLVideoElement,
  session:    Session,
  onProgress: (chunks: number, bytes: number) => void,
  onPlaying:  () => void,
  onError:    (msg: string) => void,
): Promise<void> {
  log('blob fallback mode');
  const chunks: ArrayBuffer[] = [];
  let token = firstToken, idx = 0, totalBytes = 0;

  while (token && !session.stopped) {
    let buffer: ArrayBuffer, nextToken: string, isLast: boolean;
    try {
      ({ buffer, nextToken, isLast } = await fetchChunk(videoId, idx, token));
    } catch (e: any) {
      if (chunks.length > 0) { log('network error → EOS fallback'); break; }
      if (!session.stopped) onError(e.message);
      return;
    }
    if (buffer.byteLength === 0) break;
    chunks.push(buffer);
    totalBytes += buffer.byteLength;
    idx++;
    token = nextToken;
    onProgress(idx, totalBytes);
    if (isLast || !nextToken) break;
  }

  if (session.stopped || chunks.length === 0) return;

  const blob    = new Blob(chunks, { type: 'video/mp4' });
  const blobUrl = URL.createObjectURL(blob);
  video.src = blobUrl;
  video.load();
  video.addEventListener('loadedmetadata', () => {
    if (!session.stopped) {
      onPlaying();
      setTimeout(() => {
        if (!session.stopped && video.paused) video.play().catch(() => {});
      }, 100);
    }
  }, { once: true });
  video.addEventListener('canplay', () => {
    if (!session.stopped) setImmediate?.(() => {}) || setTimeout(() => {}, 0);
  }, { once: true });
  // Revoke after video starts
  video.addEventListener('playing', () => {
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
  }, { once: true });
}

// ==================== COMPONENT ====================

const LessonViewer: React.FC = () => {
  const { contentId } = useParams<{ courseId: string; contentId: string }>();
  const navigate   = useNavigate();
  const location   = useLocation();
  const { user }   = useDashboard();

  const [content,          setContent]          = useState<LibraryContent | null>(null);
  const [loadingContent,   setLoadingContent]   = useState(true);
  const [contentError,     setContentError]     = useState('');
  const [playerState,      setPlayerState]      = useState<PlayerState>('idle');
  const [playerError,      setPlayerError]      = useState('');
  const [isEmbed,          setIsEmbed]          = useState(false);
  const [embedUrl,         setEmbedUrl]         = useState('');
  const [currentTime,      setCurrentTime]      = useState(0);
  const [duration,         setDuration]         = useState(0);
  const [downloadedChunks, setDownloadedChunks] = useState(0);
  const [downloadedBytes,  setDownloadedBytes]  = useState(0);
  const [isVideoHidden,    setIsVideoHidden]    = useState(false);

  const videoRef    = useRef<HTMLVideoElement>(null);
  const sessionRef  = useRef<Session>({ stopped: false });
  const alive       = useRef(true);
  const initLockRef = useRef('');
  const devToolsRef = useRef(false);

  useEffect(() => { injectAntiPiracy(); }, []);

  useDevToolsDetection(
    useCallback(() => {
      devToolsRef.current = true;
      setIsVideoHidden(true);
      setPlayerState('devtools');
      videoRef.current?.pause();
    }, []),
    useCallback(() => {
      devToolsRef.current = false;
      setIsVideoHidden(false);
      setPlayerState(p => p === 'devtools' ? 'playing' : p);
    }, []),
  );

  const cleanup = useCallback(() => {
    sessionRef.current.stopped = true;
    sessionRef.current = { stopped: false }; // fresh session for next init
    if (alive.current && videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
      } catch {}
    }
  }, []);

  const initPlayer = useCallback(async (videoUrl: string) => {
    if (initLockRef.current === videoUrl) { log('duplicate — skip'); return; }
    initLockRef.current = videoUrl;

    cleanup();
    const session = sessionRef.current;

    setPlayerState('loading');
    setPlayerError('');
    setDownloadedChunks(0);
    setDownloadedBytes(0);
    setIsEmbed(false);
    setEmbedUrl('');
    setDuration(0);
    setCurrentTime(0);

    if (!videoUrl.startsWith('secured://')) {
      const v = videoRef.current;
      if (v) { v.src = videoUrl; v.load(); }
      initLockRef.current = '';
      return;
    }

    const videoId = videoStreamService.extractVideoId(videoUrl);
    if (!videoId) {
      setPlayerError('Invalid video reference.');
      setPlayerState('error');
      initLockRef.current = '';
      return;
    }

    try {
      log('fetching metadata...');
      const meta = await videoStreamService.getVideoMetadata(videoId, SECURITY_STRING);
      if (!alive.current || session.stopped) { initLockRef.current = ''; return; }

      if (meta.type === 'embed') {
        setIsEmbed(true); setEmbedUrl(meta.embedUrl); setPlayerState('playing');
        initLockRef.current = ''; return;
      }

      const v = videoRef.current;
      if (!v) throw new Error('Video element unavailable');

      setPlayerState('buffering');

      const onProgress = (chunks: number, bytes: number) => {
        if (!alive.current || session.stopped) return;
        setDownloadedChunks(chunks);
        setDownloadedBytes(bytes);
      };
      const onPlaying = () => {
        if (!alive.current || session.stopped || devToolsRef.current) return;
        setPlayerState('playing');
      };
      const onError = (msg: string) => {
        if (!alive.current || session.stopped) return;
        setPlayerError(msg);
        setPlayerState('error');
      };

      // Try progressive (mp4box) first, fall back to blob-concat if it fails
      try {
        await runProgressivePipeline(videoId, meta.firstChunkToken, v, session, onProgress, onPlaying, onError);
      } catch (e: any) {
        if (session.stopped) { initLockRef.current = ''; return; }
        log('progressive pipeline failed, falling back to blob:', e.message);
        setPlayerState('buffering');
        setDownloadedChunks(0);
        setDownloadedBytes(0);
        // Refresh token for fallback
        const meta2 = await videoStreamService.getVideoMetadata(videoId, SECURITY_STRING);
        if (!alive.current || session.stopped) { initLockRef.current = ''; return; }
        await runBlobFallback(videoId, meta2.firstChunkToken, v, session, onProgress, onPlaying, onError);
      }

    } catch (err: any) {
      logErr('initPlayer error:', err);
      if (alive.current) { setPlayerError(err.message || 'Failed to load video.'); setPlayerState('error'); }
    } finally {
      initLockRef.current = '';
    }
  }, [cleanup]);

  useEffect(() => {
    if (!contentId) return;
    alive.current = true;
    const passed = (location.state as any)?.contentData;
    if (passed) { setContent(passed); setLoadingContent(false); }
    else {
      (async () => {
        try {
          setLoadingContent(true);
          const data = await contentLibraryService.fetchContentData(contentId);
          if (!alive.current) return;
          if (!data) { setContentError('Content not found.'); return; }
          setContent(data);
        } catch (err: any) {
          if (alive.current) setContentError(err.message || 'Failed to load content.');
        } finally {
          if (alive.current) setLoadingContent(false);
        }
      })();
    }
    return () => { alive.current = false; cleanup(); };
  }, [contentId, cleanup]);

  useEffect(() => {
    if (content?.videoUrl) initPlayer(content.videoUrl);
  }, [content, initPlayer]);

  const onTimeUpdate     = () => { if (videoRef.current) setCurrentTime(videoRef.current.currentTime); };
  const onDurationChange = () => { if (videoRef.current?.duration) setDuration(videoRef.current.duration); };
  const onPlay           = () => { if (alive.current && !devToolsRef.current) setPlayerState('playing'); };
  const onPause          = () => { if (alive.current && playerState !== 'devtools') setPlayerState('paused'); };
  const onEnded          = () => setPlayerState('idle');
  const onVideoError     = () => {
    const v = videoRef.current;
    if (v?.error && v.src && v.src !== window.location.href) {
      logErr('video error:', v.error.code, v.error.message);
      setPlayerError('Playback error. Please retry.');
      setPlayerState('error');
    }
  };
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    const r = e.currentTarget.getBoundingClientRect();
    v.currentTime = ((e.clientX - r.left) / r.width) * duration;
  };
  const handlePlayPause = () => {
    const v = videoRef.current;
    if (!v) return;
    v.paused ? v.play().catch(() => {}) : v.pause();
  };
  const handleRetry = () => { initLockRef.current = ''; if (content?.videoUrl) initPlayer(content.videoUrl); };

  const getNoteHref    = () => content?.noteSource === 'gdrive' ? content?.noteGDriveDownloadUrl||null : content?.noteUrl||null;
  const getNotePreview = () => content?.noteSource === 'gdrive' ? content?.noteGDrivePreviewUrl||null : content?.noteUrl||null;

  const playPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const isBuffering   = playerState === 'buffering';
  const isLoading     = playerState === 'loading';
  const showProgress  = isBuffering || isLoading;

  const statusLabel = (() => {
    if (isLoading)   return 'Preparing…';
    if (isBuffering && downloadedBytes === 0) return 'Starting secure stream…';
    if (isBuffering) return `Downloading… ${formatBytes(downloadedBytes)} (chunk ${downloadedChunks})`;
    return '';
  })();

  // ==================== RENDER ====================

  if (loadingContent) return (
    <div className="min-h-screen bg-[#080a10] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 size={32} className="text-violet-400 animate-spin" />
        <p className="text-sm text-white/30">Loading content…</p>
      </div>
    </div>
  );
  if (contentError) return (
    <div className="min-h-screen bg-[#080a10] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-rose-500/8 border border-rose-500/20 rounded-2xl p-8 text-center">
        <AlertCircle size={32} className="text-rose-400 mx-auto mb-4" />
        <p className="text-white/70 mb-4">{contentError}</p>
        <button onClick={() => navigate(-1)} className="text-sm text-white/40 hover:text-white">← Go back</button>
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        .secure-video-wrap { -webkit-user-select:none; user-select:none; -webkit-user-drag:none; }
        .secure-video-wrap video { pointer-events:none; display:block; width:100%; }
        .secure-video-wrap video::-webkit-media-controls-download-button,
        .secure-video-wrap video::-webkit-media-controls-timeline,
        .secure-video-wrap video::-webkit-media-controls-enclosure { display:none !important; }
        .player-controls { pointer-events:auto; }
        @keyframes fadeSlideUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:none} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .anim-up   { animation:fadeSlideUp .4s cubic-bezier(.22,1,.36,1) both; }
        .anim-up-1 { animation:fadeSlideUp .4s .06s cubic-bezier(.22,1,.36,1) both; }
        .anim-up-2 { animation:fadeSlideUp .4s .12s cubic-bezier(.22,1,.36,1) both; }
        .anim-up-3 { animation:fadeSlideUp .4s .18s cubic-bezier(.22,1,.36,1) both; }
        .scrubber:hover .scrubber-thumb { opacity:1 !important; }
        .spin-ring { animation: spin 1.2s linear infinite; transform-origin: center; }
      `}</style>

      <div className="min-h-screen bg-[#080a10] text-white select-none" onContextMenu={e => e.preventDefault()}>
        <div className="fixed inset-0 pointer-events-none"
          style={{background:'radial-gradient(ellipse 65% 35% at 50% -5%,rgba(139,92,246,.12) 0%,transparent 65%)'}}/>

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-6">

          <button onClick={() => navigate(-1)}
            className="anim-up flex items-center gap-2 text-sm text-white/35 hover:text-white/80 transition-colors mb-6 group focus:outline-none px-3 py-1.5 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/8">
            <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5"/>
            Back to Library
          </button>

          <div className="anim-up-1 relative rounded-2xl overflow-hidden border border-white/8 bg-[#0d0f1a] mb-6 shadow-2xl shadow-black/60">

            {playerState === 'devtools' && (
              <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#080a10]">
                <Lock size={36} className="text-rose-400 mb-3"/>
                <p className="text-white/60 text-sm font-medium">DevTools detected</p>
                <p className="text-white/25 text-xs mt-1">Close DevTools to resume</p>
              </div>
            )}

            {isEmbed && embedUrl && (
              <div className="relative w-full" style={{paddingBottom:'56.25%'}}>
                <iframe src={embedUrl} className="absolute inset-0 w-full h-full"
                  allow="autoplay; fullscreen; encrypted-media" allowFullScreen
                  referrerPolicy="no-referrer"
                  sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
                  title={content?.title||'Video'} style={{border:'none',pointerEvents:'auto'}}/>
              </div>
            )}

            {!isEmbed && content?.videoUrl && (
              <div className="relative secure-video-wrap bg-black" style={{minHeight:'220px'}}>
                <video
                  ref={videoRef}
                  style={{
                    display: (isVideoHidden || showProgress) ? 'none' : 'block',
                    maxHeight:'70vh', minHeight:'220px', background:'#000',
                  }}
                  playsInline
                  controlsList="nodownload nofullscreen noremoteplayback"
                  disablePictureInPicture
                  onTimeUpdate={onTimeUpdate} onDurationChange={onDurationChange}
                  onPlay={onPlay} onPause={onPause} onEnded={onEnded} onError={onVideoError}
                  onContextMenu={e => e.preventDefault()}
                />

                {/* Loading/buffering overlay */}
                {showProgress && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black" style={{minHeight:'220px'}}>
                    <div className="text-center px-8 max-w-xs">
                      <div className="relative mx-auto mb-5 w-16 h-16">
                        {/* Outer ring spins */}
                        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 64 64">
                          <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(139,92,246,0.12)" strokeWidth="3"/>
                          <circle cx="32" cy="32" r="28" fill="none"
                            stroke="rgb(139,92,246)" strokeWidth="3"
                            strokeDasharray="44 132" strokeLinecap="round"
                            className="spin-ring"/>
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Shield size={18} className="text-violet-400"/>
                        </div>
                      </div>
                      <p className="text-white/60 text-sm font-medium">{statusLabel}</p>
                      {isBuffering && downloadedBytes > 0 && (
                        <p className="text-white/20 text-xs mt-2">
                          Video will start automatically
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {playerState === 'error' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-center p-6" style={{minHeight:'220px'}}>
                    <AlertCircle size={32} className="text-rose-400 mb-3"/>
                    <p className="text-white/60 text-sm mb-4 max-w-xs">{playerError}</p>
                    <button onClick={handleRetry}
                      className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm rounded-xl transition-colors font-medium">
                      Try Again
                    </button>
                  </div>
                )}

                {(playerState === 'playing' || playerState === 'paused') && !isVideoHidden && (
                  <div className="player-controls absolute bottom-0 left-0 right-0 px-4 pb-3 pt-10
                                  bg-gradient-to-t from-black/95 via-black/60 to-transparent">
                    <div className="scrubber relative h-1.5 bg-white/15 rounded-full cursor-pointer mb-3 group"
                      onClick={handleSeek}>
                      <div className="absolute inset-y-0 left-0 bg-violet-500 rounded-full transition-all duration-100"
                        style={{width:`${playPct}%`}}/>
                      <div className="scrubber-thumb absolute top-1/2 w-4 h-4 bg-white rounded-full shadow-lg"
                        style={{left:`${playPct}%`,transform:'translateX(-50%) translateY(-50%)',opacity:0}}/>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button onClick={handlePlayPause}
                          className="player-controls text-white/80 hover:text-white text-lg w-8 h-8 flex items-center justify-center">
                          {playerState === 'paused' ? '▶' : '⏸'}
                        </button>
                        <span className="text-xs text-white/40 font-mono tabular-nums">
                          {formatDuration(currentTime)} / {formatDuration(duration)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-green-400/60">
                        <Shield size={10}/><span>Secure</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!content?.videoUrl && !loadingContent && (
              <div className="flex flex-col items-center justify-center h-48">
                <Play size={36} className="text-white/10 mb-3"/>
                <p className="text-white/25 text-sm">No video attached</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 space-y-4">
              <div className="anim-up-2 rounded-2xl border border-white/6 bg-[#0d0f1a] p-5 sm:p-6">
                <div className="flex items-start gap-3 mb-3">
                  <span className={`flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border mt-0.5
                    ${content?.type==='lesson'?'bg-violet-500/15 text-violet-300 border-violet-500/20':'bg-amber-500/15 text-amber-300 border-amber-500/20'}`}>
                    {content?.type==='lesson'?<Play size={10}/>:<BookOpen size={10}/>}
                    {content?.type==='lesson'?'Lesson':'Trick'}
                  </span>
                  {content?.videoUrl?.startsWith('secured://') && (
                    <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/10 text-green-400/80 border border-green-500/15 mt-1">
                      <Shield size={9}/> Protected
                    </span>
                  )}
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-white leading-snug mb-2">{content?.title||'Untitled'}</h1>
                {content?.subject && <p className="text-sm text-white/35 mb-3">{content.subject}</p>}
                {content?.description && <p className="text-sm text-white/50 leading-relaxed mt-3 pt-3 border-t border-white/5">{content.description}</p>}
              </div>
              <div className="anim-up-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {content?.duration && (
                  <div className="rounded-xl border border-white/6 bg-[#0d0f1a] px-4 py-3 flex items-center gap-3">
                    <Clock size={16} className="text-white/25"/>
                    <div><p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold mb-0.5">Duration</p>
                    <p className="text-sm text-white/70 font-medium">{formatMinutes(content.duration)}</p></div>
                  </div>
                )}
                {content?.subject && (
                  <div className="rounded-xl border border-white/6 bg-[#0d0f1a] px-4 py-3 flex items-center gap-3">
                    <BookOpen size={16} className="text-white/25"/>
                    <div><p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold mb-0.5">Subject</p>
                    <p className="text-sm text-white/70 font-medium truncate">{content.subject}</p></div>
                  </div>
                )}
                {content?.videoUrl?.startsWith('secured://') && (
                  <div className="rounded-xl border border-green-500/15 bg-green-500/5 px-4 py-3 flex items-center gap-3">
                    <Shield size={16} className="text-green-400/60"/>
                    <div><p className="text-[10px] text-green-400/40 uppercase tracking-widest font-semibold mb-0.5">Security</p>
                    <p className="text-sm text-green-400/70 font-medium">Protected</p></div>
                  </div>
                )}
              </div>
            </div>

            <div className="anim-up-3 space-y-3">
              {(content?.noteUrl || content?.noteGDrivePreviewUrl) ? (
                <div className="rounded-2xl border border-white/6 bg-[#0d0f1a] p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <FileText size={15} className="text-emerald-400/70"/>
                    <span className="text-sm font-semibold text-white/70">Class Notes</span>
                  </div>
                  <div className="space-y-2">
                    {getNotePreview() && (
                      <a href={getNotePreview()!} target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-emerald-500/8 border border-emerald-500/15 text-emerald-300/80 hover:bg-emerald-500/15 transition-all text-sm font-medium group">
                        <span className="flex items-center gap-2"><ExternalLink size={13}/>Preview Notes</span>
                        <span className="text-xs group-hover:translate-x-0.5 transition-transform">→</span>
                      </a>
                    )}
                    {getNoteHref() && (
                      <a href={getNoteHref()!} target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-white/4 border border-white/8 text-white/50 hover:bg-white/7 hover:text-white/80 transition-all text-sm font-medium group">
                        <span className="flex items-center gap-2"><Download size={13}/>Download PDF</span>
                        <span className="text-xs group-hover:translate-x-0.5 transition-transform">→</span>
                      </a>
                    )}
                    {content?.noteSource === 'gdrive' && <p className="text-[10px] text-white/20 text-center pt-1">via Google Drive</p>}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/5 bg-white/2 p-5 text-center">
                  <FileText size={20} className="text-white/10 mx-auto mb-2"/>
                  <p className="text-xs text-white/20">No notes attached</p>
                </div>
              )}
              <div className="rounded-2xl border border-white/5 bg-white/2 p-4 space-y-2">
                <p className="text-[10px] uppercase tracking-widest text-white/20 font-semibold mb-2">Content Protection</p>
                {['Token-chained download (anti-IDM)','Source URL never exposed','Screen capture blocked','Download disabled'].map(f => (
                  <div key={f} className="flex items-center gap-2">
                    <Shield size={10} className="text-green-400/40 flex-shrink-0"/>
                    <span className="text-[11px] text-white/25">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default LessonViewer;
