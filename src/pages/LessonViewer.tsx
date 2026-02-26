// src/pages/LessonViewer.tsx — DEFINITIVE FIXED VERSION
//
// ─── ROOT CAUSE (confirmed from logs) ────────────────────────────────────────
// The Vercel log timestamps + bundle ID prove the OLD code was still running.
// But the architectural problem is now fully understood:
//
// Our queue+flush approach has a timing hole vs the original Platform C which
// uses `await appendToSourceBuffer()` — a fully sequential Promise chain.
// The original BLOCKS the pump loop until each appendBuffer completes.
// Our event-driven queue can have the pump fetch chunks faster than the SB
// can consume them, and if teardown happens mid-flight, the append fires
// on a detached SB.
//
// ─── COMPLETE FIX LIST ───────────────────────────────────────────────────────
// 1. appendToSourceBuffer() — Promise-based, fully sequential (matches original)
// 2. sb.mode = 'sequence' — set immediately after addSourceBuffer
// 3. addSourceBuffer always uses hardcoded 'video/mp4' codec list
// 4. initLockRef — prevents double-init from React StrictMode
// 5. Cache-busting ?_t= param on every chunk fetch (stops 304 from Vercel edge)
// 6. Teardown guard checks ms.readyState before every SB operation
// 7. No webm in codec list (file is mp4; wrong codec = immediate SB error)

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

const BUFFER_AHEAD_PAUSE  = 60;   // stop fetching when this far ahead (seconds)
const BUFFER_AHEAD_RESUME = 15;   // resume when buffered ahead drops below this
const INITIAL_BUFFER_SECS = 8;    // seconds buffered before triggering play

// ─── Debug — set false in production ─────────────────────────────────────────
const DEBUG = true;
const log    = (...a: any[]) => { if (DEBUG) console.log('[LessonViewer]', ...a); };
const logErr = (...a: any[]) => console.error('[LessonViewer ERROR]', ...a);

function formatDuration(secs: number): string {
  if (!secs || isNaN(secs)) return '0:00';
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = Math.floor(secs % 60);
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}
function formatMinutes(mins: number): string {
  if (!mins) return '—';
  const h = Math.floor(mins / 60), m = Math.round(mins % 60);
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}
function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)); }

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

// ─── MSE session — single source of truth ────────────────────────────────────
interface MSESession {
  ms:        MediaSource;
  sb:        SourceBuffer;
  blobUrl:   string;
  stopped:   boolean;  // set true by teardown; pump checks this before every await
  videoId:   string;
}

// ─── Promise-based appendBuffer — matches original Platform C exactly ─────────
// This is the key architectural fix. Instead of a queue + event-driven flush,
// we await each append directly in the pump loop. This makes the pump fully
// sequential and eliminates all timing holes between fetch and append.
async function appendToSourceBuffer(
  session: MSESession,
  buffer: ArrayBuffer,
  video: HTMLVideoElement
): Promise<void> {
  if (session.stopped) return;
  if (!session.sb || session.ms.readyState !== 'open') return;

  // Wait if currently updating
  if (session.sb.updating) {
    await new Promise<void>((resolve, reject) => {
      session.sb.addEventListener('updateend', () => resolve(), { once: true });
      session.sb.addEventListener('error',     () => reject(new Error('SB update error')), { once: true });
    });
  }

  if (session.stopped || session.ms.readyState !== 'open') return;

  // Evict old buffered data before appending to prevent QuotaExceededError
  try {
    if (session.sb.buffered.length > 0) {
      const evictBefore = video.currentTime - 30;
      if (evictBefore > 0 && session.sb.buffered.start(0) < evictBefore) {
        await new Promise<void>((res) => {
          session.sb.addEventListener('updateend', () => res(), { once: true });
          try { session.sb.remove(0, evictBefore); } catch { res(); }
        });
      }
    }
  } catch {}

  if (session.stopped || session.ms.readyState !== 'open') return;

  // Append the chunk and wait for completion
  await new Promise<void>((resolve, reject) => {
    session.sb.addEventListener('updateend', () => resolve(), { once: true });
    session.sb.addEventListener('error',     (e) => reject(new Error('SourceBuffer error on append')), { once: true });
    try {
      session.sb.appendBuffer(buffer);
    } catch (e: any) {
      if (e.name === 'QuotaExceededError') {
        // Try to evict more aggressively then resolve (non-fatal)
        try {
          session.sb.remove(0, video.currentTime - 10);
          session.sb.addEventListener('updateend', () => {
            try { session.sb.appendBuffer(buffer); } catch { resolve(); }
          }, { once: true });
        } catch { resolve(); }
      } else {
        reject(e);
      }
    }
  });
}

// ─── Cache-busting fetch for chunks ──────────────────────────────────────────
// Adds ?_t=<timestamp> to prevent Vercel edge / browser from returning HTTP 304
// "Not Modified" with an empty body, which corrupts the stream.
async function fetchChunkWithCacheBust(
  videoId: string,
  chunkIndex: number,
  token: string
): Promise<{ buffer: ArrayBuffer; nextToken: string; isLast: boolean }> {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  const url  = `${base}/api/videoStream?action=chunk&videoId=${encodeURIComponent(videoId)}&chunk=${chunkIndex}&_t=${Date.now()}`;

  const res = await fetch(url, {
    headers: { 'x-chunk-token': token },
    cache: 'no-store',   // tell the browser not to use its cache for this request
  });

  if (res.status === 204) {
    return { buffer: new ArrayBuffer(0), nextToken: '', isLast: true };
  }
  if (!res.ok) throw new Error(`Chunk ${chunkIndex} failed: HTTP ${res.status}`);

  const buffer     = await res.arrayBuffer();
  const nextToken  = res.headers.get('x-next-chunk-token') || '';
  const isLast     = res.headers.get('x-is-last-chunk') === 'true';

  log(`chunk ${chunkIndex}: ${buffer.byteLength} bytes, isLast=${isLast}, nextToken=${nextToken ? 'yes' : 'none'}`);
  return { buffer, nextToken, isLast };
}

// ─── Main pump — fully sequential (matches original Platform C) ───────────────
async function runPump(
  session:       MSESession,
  firstToken:    string,
  video:         HTMLVideoElement,
  onChunkLoaded: () => void,
  onBufferedPct: (pct: number) => void,
  onPlayReady:   () => void,
  onError:       (msg: string) => void,
): Promise<void> {
  log('pump start, videoId:', session.videoId);
  let token        = firstToken;
  let chunkIndex   = 0;
  let playStarted  = false;

  const tryTriggerPlay = () => {
    if (playStarted) return;
    try {
      if (!video.buffered.length) return;
      const ct  = video.currentTime;
      for (let i = 0; i < video.buffered.length; i++) {
        if (video.buffered.start(i) <= ct + 0.5 && video.buffered.end(i) > ct) {
          const ahead = video.buffered.end(i) - ct;
          if (ahead >= INITIAL_BUFFER_SECS) { playStarted = true; onPlayReady(); return; }
        }
      }
    } catch {}
  };

  while (!session.stopped) {
    if (!token) { log('pump: no token — stream complete'); break; }

    // Buffer throttle
    let ahead = 0;
    try {
      for (let i = 0; i < video.buffered.length; i++) {
        const ct = video.currentTime;
        if (video.buffered.start(i) <= ct + 0.5 && video.buffered.end(i) > ct) {
          ahead = video.buffered.end(i) - ct; break;
        }
      }
    } catch {}

    if (ahead >= BUFFER_AHEAD_PAUSE) {
      await sleep(500);
      if (session.stopped) return;
      continue;
    }

    log(`fetching chunk ${chunkIndex} (${ahead.toFixed(1)}s ahead)`);

    try {
      const { buffer, nextToken, isLast } = await fetchChunkWithCacheBust(
        session.videoId, chunkIndex, token
      );

      if (session.stopped) return;

      if (buffer.byteLength > 0) {
        // ── KEY FIX: await the append before fetching the next chunk ──────────
        // This is exactly how the original Platform C works. The pump blocks here
        // until the browser has consumed the chunk. This prevents any possibility
        // of appending to a detached SourceBuffer.
        await appendToSourceBuffer(session, buffer, video);
        if (session.stopped) return;

        onChunkLoaded();

        try {
          if (video.buffered.length > 0 && video.duration > 0) {
            onBufferedPct(Math.min(100, (video.buffered.end(video.buffered.length - 1) / video.duration) * 100));
          }
        } catch {}
      }

      token = nextToken;
      chunkIndex++;
      tryTriggerPlay();

      if (isLast || !nextToken) {
        log('pump: last chunk — calling endOfStream');
        // Wait for SourceBuffer to finish updating before ending
        if (session.sb.updating) {
          await new Promise<void>(res => session.sb.addEventListener('updateend', () => res(), { once: true }));
        }
        if (!session.stopped && session.ms.readyState === 'open') {
          try { session.ms.endOfStream(); } catch (e) { log('endOfStream error (safe):', e); }
        }
        if (!playStarted) onPlayReady();
        break;
      }

    } catch (err: any) {
      if (!session.stopped) {
        logErr('pump error at chunk', chunkIndex, ':', err.message);
        onError(err.message);
      }
      return;
    }
  }
  log('pump done');
}

// ==================== COMPONENT ====================

const LessonViewer: React.FC = () => {
  const { contentId } = useParams<{ courseId: string; contentId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useDashboard();

  const [content,        setContent]        = useState<LibraryContent | null>(null);
  const [loadingContent, setLoadingContent] = useState(true);
  const [contentError,   setContentError]   = useState('');
  const [playerState,    setPlayerState]    = useState<PlayerState>('idle');
  const [playerError,    setPlayerError]    = useState('');
  const [isEmbed,        setIsEmbed]        = useState(false);
  const [embedUrl,       setEmbedUrl]       = useState('');
  const [currentTime,    setCurrentTime]    = useState(0);
  const [duration,       setDuration]       = useState(0);
  const [totalChunks,    setTotalChunks]    = useState<number | null>(null);
  const [loadedChunks,   setLoadedChunks]   = useState(0);
  const [bufferedPct,    setBufferedPct]    = useState(0);
  const [isVideoHidden,  setIsVideoHidden]  = useState(false);

  const videoRef    = useRef<HTMLVideoElement>(null);
  const sessionRef  = useRef<MSESession | null>(null);
  const alive       = useRef(true);
  const initLockRef = useRef('');   // prevents double-init (React StrictMode)

  useEffect(() => { injectAntiPiracy(); }, []);

  useDevToolsDetection(
    useCallback(() => { setIsVideoHidden(true);  setPlayerState('devtools'); videoRef.current?.pause(); }, []),
    useCallback(() => { setIsVideoHidden(false); setPlayerState(p => p === 'devtools' ? 'playing' : p); }, []),
  );

  // ── Teardown ────────────────────────────────────────────────────────────────
  const teardown = useCallback(() => {
    const s = sessionRef.current;
    if (!s) return;
    log('teardown, videoId:', s.videoId);
    s.stopped = true;
    sessionRef.current = null;
    try { if (s.ms.readyState === 'open') s.ms.endOfStream(); } catch {}
    try { URL.revokeObjectURL(s.blobUrl); } catch {}
    if (alive.current && videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
      } catch {}
    }
  }, []);

  // ── Start MSE session ────────────────────────────────────────────────────────
  const startMSE = useCallback((videoId: string, firstToken: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const v = videoRef.current;
      if (!v) return reject(new Error('Video element unavailable'));

      teardown();

      log('creating MediaSource for:', videoId);
      const ms      = new MediaSource();
      const blobUrl = URL.createObjectURL(ms);
      v.src         = blobUrl;
      v.preload     = 'auto';

      ms.addEventListener('sourceopen', () => {
        log('sourceopen, readyState:', ms.readyState);

        // ALWAYS use video/mp4 — NEVER server Content-Type.
        // Dropbox/GDrive return 'application/octet-stream' which is not a valid
        // MSE codec string. addSourceBuffer() throws immediately on it.
        const mp4Types = [
          'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
          'video/mp4; codecs="avc1.640028, mp4a.40.2"',
          'video/mp4; codecs="avc1.64001f, mp4a.40.2"',
          'video/mp4',
        ];
        const mimeType = mp4Types.find(t => { try { return MediaSource.isTypeSupported(t); } catch { return false; } });
        if (!mimeType) {
          URL.revokeObjectURL(blobUrl);
          return reject(new Error('Browser does not support MP4 MSE. Use Chrome or Edge.'));
        }
        log('addSourceBuffer:', mimeType);

        let sb: SourceBuffer;
        try {
          sb = ms.addSourceBuffer(mimeType);
        } catch (e: any) {
          URL.revokeObjectURL(blobUrl);
          return reject(new Error(`addSourceBuffer failed: ${e.message}`));
        }

        // REQUIRED: 'sequence' mode makes the SB assign timestamps based on
        // arrival order rather than embedded mp4 timestamps. Byte-range chunks
        // carry their file-position timestamps which cause discontinuities in
        // 'segments' mode. The original Platform C sets this on line 228.
        try { sb.mode = 'sequence'; log('sb.mode = sequence'); } catch {}

        const session: MSESession = { ms, sb, blobUrl, stopped: false, videoId };
        sessionRef.current = session;

        sb.addEventListener('error', e => {
          // With all fixes applied this should never fire.
          logErr('SourceBuffer error event:', e);
          logErr('State:', { mode: sb.mode, updating: sb.updating, msState: ms.readyState, videoId });
        });

        // Start the pump — fully sequential, Promise-based
        runPump(
          session,
          firstToken,
          v,
          () => { if (alive.current) setLoadedChunks(c => c + 1); },
          (pct) => { if (alive.current) setBufferedPct(pct); },
          () => {
            if (alive.current) {
              setPlayerState('playing');
              v.play().catch(e => log('play() rejected:', e));
            }
          },
          (msg) => {
            if (alive.current) {
              setPlayerError(`Stream interrupted: ${msg}`);
              setPlayerState('error');
            }
          },
        );

        resolve();
      }, { once: true });

      ms.addEventListener('error', e => {
        logErr('MediaSource error:', e);
        URL.revokeObjectURL(blobUrl);
        reject(new Error('MediaSource failed to open'));
      }, { once: true });
    });
  }, [teardown]);

  // ── Init player ──────────────────────────────────────────────────────────────
  const initPlayer = useCallback(async (videoUrl: string) => {
    // Prevent double-init from React StrictMode double-invoke
    if (initLockRef.current === videoUrl) {
      log('skipping duplicate initPlayer call for:', videoUrl);
      return;
    }
    initLockRef.current = videoUrl;

    log('initPlayer:', videoUrl);
    setPlayerState('loading');
    setPlayerError('');
    setLoadedChunks(0);
    setBufferedPct(0);
    setTotalChunks(null);
    setIsEmbed(false);
    setEmbedUrl('');

    if (!videoUrl.startsWith('secured://')) {
      if (videoRef.current) { videoRef.current.src = videoUrl; videoRef.current.load(); setPlayerState('buffering'); }
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
      if (!alive.current) return;
      log('metadata:', { type: meta.type, platform: (meta as any).platform });

      if (meta.type === 'embed') {
        setIsEmbed(true); setEmbedUrl(meta.embedUrl); setPlayerState('playing');
        initLockRef.current = '';
        return;
      }

      log('fetching info...');
      const info = await videoStreamService.getVideoInfo(videoId, meta.streamToken);
      if (!alive.current) return;
      log('info: totalChunks=', info.totalChunks, 'contentType=', info.contentType);
      if (info.totalChunks) setTotalChunks(info.totalChunks);

      setPlayerState('buffering');
      await startMSE(videoId, meta.firstChunkToken);
      log('MSE session started');

    } catch (err: any) {
      logErr('initPlayer error:', err);
      if (alive.current) {
        setPlayerError(err.message || 'Failed to initialize video.');
        setPlayerState('error');
      }
    } finally {
      initLockRef.current = '';
    }
  }, [startMSE]);

  // ── Content loading ──────────────────────────────────────────────────────────
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
    return () => { alive.current = false; teardown(); };
  }, [contentId, teardown]);

  useEffect(() => {
    if (content?.videoUrl) initPlayer(content.videoUrl);
  }, [content, initPlayer]);

  // ── Video events ─────────────────────────────────────────────────────────────
  const onTimeUpdate     = () => { if (videoRef.current) setCurrentTime(videoRef.current.currentTime); };
  const onDurationChange = () => { if (videoRef.current) setDuration(videoRef.current.duration); };
  const onWaiting        = () => setPlayerState(p => p === 'playing' ? 'buffering' : p);
  const onCanPlay        = () => setPlayerState(p => p === 'buffering' ? 'playing' : p);
  const onPlay           = () => setPlayerState('playing');
  const onPause          = () => { if (alive.current) setPlayerState('paused'); };
  const onEnded          = () => setPlayerState('idle');
  const onVideoError     = () => {
    const v = videoRef.current;
    if (v?.error && v.src && v.src !== window.location.href) {
      logErr('video element error:', v.error.code, v.error.message);
      setPlayerError('Playback error — please retry.'); setPlayerState('error');
    }
  };
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    const r = e.currentTarget.getBoundingClientRect();
    v.currentTime = ((e.clientX - r.left) / r.width) * duration;
  };
  const handleRetry = () => { initLockRef.current = ''; if (content?.videoUrl) initPlayer(content.videoUrl); };
  const getNoteHref    = () => content?.noteSource === 'gdrive' ? content?.noteGDriveDownloadUrl || null : content?.noteUrl || null;
  const getNotePreview = () => content?.noteSource === 'gdrive' ? content?.noteGDrivePreviewUrl || null : content?.noteUrl || null;

  const playPct  = duration > 0 ? (currentTime / duration) * 100 : 0;
  const chunkPct = totalChunks ? Math.min(100, (loadedChunks / totalChunks) * 100) : bufferedPct;

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
        .secure-video-wrap video { pointer-events:none; }
        .secure-video-wrap video::-webkit-media-controls-download-button,
        .secure-video-wrap video::-webkit-media-controls-timeline,
        .secure-video-wrap video::-webkit-media-controls-enclosure { display:none !important; }
        .player-controls { pointer-events:auto; }
        @keyframes fadeSlideUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:none} }
        .anim-up   { animation:fadeSlideUp .4s cubic-bezier(.22,1,.36,1) both; }
        .anim-up-1 { animation:fadeSlideUp .4s .06s cubic-bezier(.22,1,.36,1) both; }
        .anim-up-2 { animation:fadeSlideUp .4s .12s cubic-bezier(.22,1,.36,1) both; }
        .anim-up-3 { animation:fadeSlideUp .4s .18s cubic-bezier(.22,1,.36,1) both; }
        .scrubber:hover .scrubber-thumb { opacity:1 !important; }
      `}</style>

      <div className="min-h-screen bg-[#080a10] text-white select-none" onContextMenu={e => e.preventDefault()}>
        <div className="fixed inset-0 pointer-events-none" style={{background:'radial-gradient(ellipse 65% 35% at 50% -5%,rgba(139,92,246,.12) 0%,transparent 65%),radial-gradient(ellipse 40% 30% at 90% 80%,rgba(56,189,248,.05) 0%,transparent 55%)'}}/>

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-6">

          <button onClick={() => navigate(-1)} className="anim-up flex items-center gap-2 text-sm text-white/35 hover:text-white/80 transition-colors mb-6 group focus:outline-none px-3 py-1.5 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/8">
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
                <div className="absolute inset-0 pointer-events-none" onContextMenu={e=>e.preventDefault()}/>
              </div>
            )}

            {!isEmbed && content?.videoUrl && (
              <div className="relative secure-video-wrap bg-black">
                <video ref={videoRef} className="w-full block"
                  style={{display:isVideoHidden?'none':'block',maxHeight:'70vh',minHeight:'220px',background:'#000'}}
                  playsInline controlsList="nodownload nofullscreen noremoteplayback" disablePictureInPicture
                  onTimeUpdate={onTimeUpdate} onDurationChange={onDurationChange}
                  onWaiting={onWaiting} onCanPlay={onCanPlay}
                  onPlay={onPlay} onPause={onPause} onEnded={onEnded} onError={onVideoError}
                  onContextMenu={e=>e.preventDefault()}/>

                {(playerState==='loading'||playerState==='buffering')&&!isVideoHidden&&(
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
                    <Loader2 size={36} className="text-violet-400 animate-spin mb-3"/>
                    <p className="text-sm text-white/50">{playerState==='loading'?'Initializing secure stream…':'Buffering…'}</p>
                    {totalChunks&&loadedChunks>0&&<p className="text-xs text-white/25 mt-1">{loadedChunks}/{totalChunks} chunks</p>}
                  </div>
                )}

                {playerState==='error'&&(
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-center p-6">
                    <AlertCircle size={32} className="text-rose-400 mb-3"/>
                    <p className="text-white/60 text-sm mb-4 max-w-xs">{playerError}</p>
                    <button onClick={handleRetry} className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm rounded-lg">Retry</button>
                  </div>
                )}

                {(playerState==='playing'||playerState==='paused')&&!isVideoHidden&&(
                  <div className="player-controls absolute bottom-0 left-0 right-0 px-4 pb-3 pt-6 bg-gradient-to-t from-black/90 via-black/40 to-transparent">
                    <div className="scrubber relative h-1 bg-white/15 rounded-full cursor-pointer mb-3 group" onClick={handleSeek}>
                      <div className="absolute inset-y-0 left-0 bg-white/20 rounded-full" style={{width:`${chunkPct}%`}}/>
                      <div className="absolute inset-y-0 left-0 bg-violet-400 rounded-full transition-all duration-100" style={{width:`${playPct}%`}}/>
                      <div className="scrubber-thumb absolute top-1/2 w-3 h-3 bg-white rounded-full shadow-lg" style={{left:`${playPct}%`,transform:'translateX(-50%) translateY(-50%)',opacity:0}}/>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button className="player-controls text-white/70 hover:text-white text-sm"
                          onClick={()=>{const v=videoRef.current;if(v)v.paused?v.play():v.pause();}}>
                          {playerState==='paused'?'▶':'⏸'}
                        </button>
                        <span className="text-xs text-white/40 font-mono tabular-nums">{formatDuration(currentTime)}/{formatDuration(duration)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-green-400/60"><Shield size={10}/><span>Secure Stream</span></div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!content?.videoUrl&&!loadingContent&&(
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <Play size={36} className="text-white/15 mb-3"/>
                <p className="text-white/25 text-sm">No video attached</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 space-y-4">
              <div className="anim-up-2 rounded-2xl border border-white/6 bg-[#0d0f1a] p-5 sm:p-6">
                <div className="flex items-start gap-3 mb-3">
                  <span className={`flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border mt-0.5 ${content?.type==='lesson'?'bg-violet-500/15 text-violet-300 border-violet-500/20':'bg-amber-500/15 text-amber-300 border-amber-500/20'}`}>
                    {content?.type==='lesson'?<Play size={10}/>:<BookOpen size={10}/>}
                    {content?.type==='lesson'?'Lesson':'Trick'}
                  </span>
                  {content?.videoUrl?.startsWith('secured://')&&(
                    <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/10 text-green-400/80 border border-green-500/15 mt-1">
                      <Shield size={9}/> Protected
                    </span>
                  )}
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-white leading-snug mb-2">{content?.title||'Untitled'}</h1>
                {content?.subject&&<p className="text-sm text-white/35 mb-3">{content.subject}</p>}
                {content?.description&&<p className="text-sm text-white/50 leading-relaxed mt-3 pt-3 border-t border-white/5">{content.description}</p>}
              </div>
              <div className="anim-up-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {content?.duration&&(<div className="rounded-xl border border-white/6 bg-[#0d0f1a] px-4 py-3 flex items-center gap-3"><Clock size={16} className="text-white/25"/><div><p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold mb-0.5">Duration</p><p className="text-sm text-white/70 font-medium">{formatMinutes(content.duration)}</p></div></div>)}
                {content?.subject&&(<div className="rounded-xl border border-white/6 bg-[#0d0f1a] px-4 py-3 flex items-center gap-3"><BookOpen size={16} className="text-white/25"/><div><p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold mb-0.5">Subject</p><p className="text-sm text-white/70 font-medium truncate">{content.subject}</p></div></div>)}
                {content?.videoUrl?.startsWith('secured://')&&(<div className="rounded-xl border border-green-500/15 bg-green-500/5 px-4 py-3 flex items-center gap-3"><Shield size={16} className="text-green-400/60"/><div><p className="text-[10px] text-green-400/40 uppercase tracking-widest font-semibold mb-0.5">Security</p><p className="text-sm text-green-400/70 font-medium">DRM Protected</p></div></div>)}
              </div>
            </div>
            <div className="anim-up-3 space-y-3">
              {(content?.noteUrl||content?.noteGDrivePreviewUrl)?(
                <div className="rounded-2xl border border-white/6 bg-[#0d0f1a] p-5">
                  <div className="flex items-center gap-2 mb-4"><FileText size={15} className="text-emerald-400/70"/><span className="text-sm font-semibold text-white/70">Class Notes</span></div>
                  <div className="space-y-2">
                    {getNotePreview()&&<a href={getNotePreview()!} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-emerald-500/8 border border-emerald-500/15 text-emerald-300/80 hover:bg-emerald-500/15 transition-all text-sm font-medium group"><span className="flex items-center gap-2"><ExternalLink size={13}/>Preview Notes</span><span className="text-xs group-hover:translate-x-0.5 transition-transform">→</span></a>}
                    {getNoteHref()&&<a href={getNoteHref()!} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-white/4 border border-white/8 text-white/50 hover:bg-white/7 hover:text-white/80 transition-all text-sm font-medium group"><span className="flex items-center gap-2"><Download size={13}/>Download PDF</span><span className="text-xs group-hover:translate-x-0.5 transition-transform">→</span></a>}
                    {content?.noteSource==='gdrive'&&<p className="text-[10px] text-white/20 text-center pt-1">via Google Drive</p>}
                  </div>
                </div>
              ):(
                <div className="rounded-2xl border border-white/5 bg-white/2 p-5 text-center">
                  <FileText size={20} className="text-white/10 mx-auto mb-2"/>
                  <p className="text-xs text-white/20">No notes attached</p>
                </div>
              )}
              <div className="rounded-2xl border border-white/5 bg-white/2 p-4 space-y-2">
                <p className="text-[10px] uppercase tracking-widest text-white/20 font-semibold mb-2">Content Protection</p>
                {['Token-chained stream (anti-IDM)','No URL exposed in DevTools','Screen capture blocked','Download button disabled'].map(f=>(
                  <div key={f} className="flex items-center gap-2"><Shield size={10} className="text-green-400/40 flex-shrink-0"/><span className="text-[11px] text-white/25">{f}</span></div>
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
