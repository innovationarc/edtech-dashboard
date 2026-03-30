// src/pages/LessonViewer.tsx — v17
//
// BASE: v16
//
// NEW IN v17:
//  SW-gate: page shows a loading screen until the Service Worker is confirmed
//  active. This eliminates the first-visit race condition where initPlayer
//  ran before the SW was ready, causing chunk fallback instead of fast streaming.
//
// NEW IN v16 — IDM Prevention (3 layers):
//  1. Service Worker (public/video-sw.js): intercepts every Range request to
//     action=play and adds HMAC signature headers. IDM is a separate process —
//     it bypasses the SW entirely → no headers → server returns 403.
//     Result: instant start + real seeking preserved. IDM gets 403 on every byte.
//
//  2. IDM __idm_id__ attribute detection (500ms poll):
//     IDM extension injects __idm_id__ onto <video> elements it captures.
//     Detected → video stops, blob revoked, SW secret cleared, blocked overlay.
//
//  3. Chunk token chain fallback (automatic, SW unavailable browsers):
//     Sequential single-use tokens in custom header — IDM cannot follow the chain.

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, FileText, ExternalLink, Download, Shield,
  AlertCircle, Loader2, Play, Pause, Clock, BookOpen, Lock,
  Volume2, VolumeX, Volume1, Maximize, Minimize,
  RotateCcw, RotateCw, SkipBack, SkipForward, Settings,
} from 'lucide-react';
import { contentLibraryService, LibraryContent } from '../services/contentLibraryService';
import { videoStreamService } from '../services/videoStreamService';
import { useDashboard } from '../contexts/DashboardContext';
import { contentProgressService } from '../services/contentProgressService';

// ─── App theme helpers (mirrors ComingSoon / LiveExam) ────────────────────────
const hexRgb = (hex: string) => {
  if (!hex || hex.length < 7) return '124,58,237';
  return `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`;
};
const THEME_BG: Record<string,string> = {
  dark:'#0d1117', light:'#ebe8e1', slate:'#0f172a',
  ocean:'#0c1a2e', forest:'#0a1f14', purple:'#1e1b4b',
  pink:'#831843', sunset:'#1c0a00',
};

const SECURITY_STRING =
  (import.meta as any).env?.VITE_VIDEO_SECURITY_STRING ||
  'CHANGE_ME_IN_VITE_ENV_VITE_VIDEO_SECURITY_STRING';

// Bunny CDN hostname — set VITE_BUNNY_CDN_HOSTNAME in .env (e.g. myzone.b-cdn.net)
// Used to detect Bunny-uploaded videos and route them through the signed-URL path.
const BUNNY_CDN_HOSTNAME = (import.meta as any).env?.VITE_BUNNY_CDN_HOSTNAME || '';

const DEBUG = false;
const log    = (...a: any[]) => { if (DEBUG) console.log('[LessonViewer]', ...a); };
const logErr = (...a: any[]) => console.error('[LessonViewer ERROR]', ...a);

// ─── Utilities ────────────────────────────────────────────────────────────────
function fmtTime(s: number): string {
  if (!s || isNaN(s) || !isFinite(s)) return '0:00';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  return `${m}:${String(ss).padStart(2, '0')}`;
}
function fmtMinutes(mins: number): string {
  if (!mins) return '—';
  const h = Math.floor(mins / 60), m = Math.round(mins % 60);
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}
function fmtBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function clamp(v: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, v)); }

// ─── Anti-piracy ──────────────────────────────────────────────────────────────
function injectAntiPiracy() {
  document.addEventListener('contextmenu', e => e.preventDefault(), true);
  document.addEventListener('keydown', e => {
    const ctrl = e.ctrlKey || e.metaKey;
    if (e.key === 'F12') { e.preventDefault(); return; }
    if (ctrl && ['s', 'u', 'p', 'i', 'j', 'c'].includes(e.key.toLowerCase())) { e.preventDefault(); return; }
    if (ctrl && e.shiftKey && ['i', 'j', 'c'].includes(e.key.toLowerCase())) { e.preventDefault(); return; }
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
      if (isOpen && !open) { open = true; onOpen(); }
      if (!isOpen && open) { open = false; onClose(); }
    };
    const id = setInterval(check, 1000);
    window.addEventListener('resize', check);
    return () => { clearInterval(id); window.removeEventListener('resize', check); };
  }, [onOpen, onClose]);
}

// ─── IDM detection ────────────────────────────────────────────────────────────
// IDM extension injects __idm_id__ attribute onto <video> elements it captures.
function detectIDM(videoEl?: HTMLVideoElement | null): boolean {
  if (videoEl?.hasAttribute('__idm_id__')) return true;
  if ((window as any).__idm_id__ !== undefined) return true;
  if (document.querySelector('[id*="idm_"][style*="position"]')) return true;
  return false;
}

// ─── Service Worker helpers ───────────────────────────────────────────────────
// SW (public/video-sw.js) intercepts Range requests to action=play and adds
// HMAC signature headers. IDM is a separate OS process — bypasses SW entirely
// → no headers → server returns 403 on every IDM request.
async function registerVideoSW(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;
  try {
    await navigator.serviceWorker.register('/video-sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    return true;
  } catch (err) {
    console.warn('[LessonViewer] SW registration failed:', err);
    return false;
  }
}
function postSecretToSW(secret: string, videoId: string) {
  const ctrl = navigator.serviceWorker?.controller;
  if (ctrl) {
    ctrl.postMessage({ type: 'VSW_INIT', secret, videoId });
  } else {
    // SW just activated — wait for controllerchange then post
    navigator.serviceWorker?.addEventListener('controllerchange', () => {
      navigator.serviceWorker?.controller?.postMessage({ type: 'VSW_INIT', secret, videoId });
    }, { once: true });
  }
}
function clearSWSecret() {
  try {
    navigator.serviceWorker?.controller?.postMessage({ type: 'VSW_CLEAR' });
  } catch {}
}

// ─── Chunk fetch (blob fallback — IDM-proof token chain) ─────────────────────
async function fetchChunk(videoId: string, idx: number, token: string) {
  const url = `${window.location.origin}/api/videoStream?action=chunk&videoId=${encodeURIComponent(videoId)}&chunk=${idx}&_t=${Date.now()}`;
  const res = await fetch(url, { headers: { 'x-chunk-token': token }, cache: 'no-store' });
  if (res.status === 204) return { buffer: new ArrayBuffer(0), nextToken: '', isLast: true };
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buffer = await res.arrayBuffer();
  return {
    buffer,
    nextToken: res.headers.get('x-next-chunk-token') || '',
    isLast: res.headers.get('x-is-last-chunk') === 'true',
  };
}
async function downloadAllChunks(
  videoId: string, firstToken: string,
  alive: () => boolean, onProgress: (n: number, b: number) => void,
): Promise<ArrayBuffer[] | null> {
  const chunks: ArrayBuffer[] = [];
  let token = firstToken, idx = 0, totalBytes = 0;
  while (token) {
    if (!alive()) return null;
    try {
      const { buffer, nextToken, isLast } = await fetchChunk(videoId, idx, token);
      if (buffer.byteLength === 0) break;
      chunks.push(buffer); totalBytes += buffer.byteLength; idx++;
      token = nextToken; onProgress(idx, totalBytes);
      if (isLast || !nextToken) break;
    } catch (err: any) {
      if (chunks.length > 0) break;
      throw err;
    }
  }
  if (chunks.length === 0) throw new Error('No data received from server');
  return chunks;
}

// ─── Player state ─────────────────────────────────────────────────────────────
type PlayerState = 'idle' | 'streaming' | 'downloading' | 'playing' | 'paused' | 'ended' | 'error' | 'devtools' | 'idm_blocked';

const MIN_SPEED  = 0.25;
const MAX_SPEED  = 3.0;
const SPEED_STEP = 0.05;

// ==================== COMPONENT ==============================================

const LessonViewer: React.FC = () => {
  const { courseId, contentId } = useParams<{ courseId: string; contentId: string }>();
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user, theme, primaryColor, accentColor } = useDashboard();
  // Note: theme/primaryColor/accentColor are consumed below in the T token block

  // ── Content ────────────────────────────────────────────────────────────────
  const [content,        setContent]        = useState<LibraryContent | null>(null);
  const [loadingContent, setLoadingContent] = useState(true);
  const [contentError,   setContentError]   = useState('');

  // ── Player ─────────────────────────────────────────────────────────────────
  const [swReady,      setSwReady]      = useState(false);  // gates player init until SW is confirmed active
  const [playerState,  setPlayerState]  = useState<PlayerState>('idle');
  const [playerError,  setPlayerError]  = useState('');
  const [isEmbed,      setIsEmbed]      = useState(false);
  const [embedUrl,     setEmbedUrl]     = useState('');

  // ── Playback values ────────────────────────────────────────────────────────
  const [currentTime,  setCurrentTime]  = useState(0);
  const [duration,     setDuration]     = useState(0);
  const [bufferedPct,  setBufferedPct]  = useState(0);
  const [volume,       setVolume]       = useState(1);
  const [muted,        setMuted]        = useState(false);
  const [speed,        setSpeed]        = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSeeking,    setIsSeeking]    = useState(false);

  // ── Download fallback ──────────────────────────────────────────────────────
  const [dlBytes,     setDlBytes]     = useState(0);

  // ── UI ─────────────────────────────────────────────────────────────────────
  const [isVideoHidden, setIsVideoHidden] = useState(false);
  const [ctrlVisible,   setCtrlVisible]   = useState(true);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showVolPanel,  setShowVolPanel]  = useState(false);
  const [isDragging,    setIsDragging]    = useState(false);
  const [dragVisualPct, setDragVisualPct] = useState(0);
  const [hoverInfo,     setHoverInfo]     = useState<{ pct: number; time: number } | null>(null);
  const [skipFlash,     setSkipFlash]     = useState<'fwd' | 'back' | null>(null);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const videoRef      = useRef<HTMLVideoElement>(null);
  const playerWrapRef = useRef<HTMLDivElement>(null);
  const progressRef   = useRef<HTMLDivElement>(null);
  const volumeWrapRef = useRef<HTMLDivElement>(null);
  const speedMenuRef  = useRef<HTMLDivElement>(null);
  const blobUrlRef    = useRef('');
  const alive         = useRef(true);
  const swReadyRef    = useRef(false);
  const idmCheckRef   = useRef<ReturnType<typeof setInterval>>();
  const initLockRef   = useRef('');
  const devToolsRef   = useRef(false);
  const hideTimerRef  = useRef<ReturnType<typeof setTimeout>>();
  const savedTimeRef  = useRef(0);
  const lastProgressUpdate = useRef(0); // Track last progress save timestamp

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => { injectAntiPiracy(); }, []);

  // Register Service Worker — gates ALL player init until complete.
  // This eliminates the first-visit race condition (SW not ready when initPlayer runs).
  useEffect(() => {
    registerVideoSW().then(ok => {
      swReadyRef.current = ok;
      log('SW ready:', ok);
      setSwReady(true);  // unlock the player — content will now load
    });
    return () => { clearSWSecret(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Controls auto-hide ─────────────────────────────────────────────────────
  const showControls = useCallback(() => {
    setCtrlVisible(true);
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setCtrlVisible(false), 3000);
  }, []);

  useEffect(() => {
    if (playerState !== 'playing') {
      clearTimeout(hideTimerRef.current);
      setCtrlVisible(true);
    } else {
      showControls();
    }
  }, [playerState, showControls]);

  // ── Close menus on outside click ───────────────────────────────────────────
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (speedMenuRef.current && !speedMenuRef.current.contains(e.target as Node))
        setShowSpeedMenu(false);
      if (volumeWrapRef.current && !volumeWrapRef.current.contains(e.target as Node))
        setShowVolPanel(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => {
    const h = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const v = videoRef.current;
      if (!v || playerState === 'streaming' || playerState === 'downloading') return;
      switch (e.key) {
        case ' ': case 'k': e.preventDefault(); togglePlayPause(); break;
        case 'ArrowLeft':  case 'j': e.preventDefault(); skipBy(-10); break;
        case 'ArrowRight': case 'l': e.preventDefault(); skipBy(10);  break;
        case 'ArrowUp':   e.preventDefault(); adjustVolume(0.1);  break;
        case 'ArrowDown': e.preventDefault(); adjustVolume(-0.1); break;
        case 'm': e.preventDefault(); toggleMute();        break;
        case 'f': e.preventDefault(); toggleFullscreen();  break;
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [playerState]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cleanup ────────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = ''; }
    if (idmCheckRef.current) { clearInterval(idmCheckRef.current); idmCheckRef.current = undefined; }
    clearSWSecret();
    if (alive.current && videoRef.current) {
      try { videoRef.current.pause(); videoRef.current.removeAttribute('src'); videoRef.current.load(); } catch {}
    }
  }, []);

  // ── IDM detection loop ─────────────────────────────────────────────────────
  const startIDMWatch = useCallback(() => {
    if (idmCheckRef.current) clearInterval(idmCheckRef.current);
    idmCheckRef.current = setInterval(() => {
      if (detectIDM(videoRef.current)) {
        clearInterval(idmCheckRef.current!);
        idmCheckRef.current = undefined;
        try { videoRef.current?.pause(); videoRef.current?.removeAttribute('src'); videoRef.current?.load(); } catch {}
        if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = ''; }
        clearSWSecret();
        setPlayerState('idm_blocked');
        setPlayerError('Download manager detected. Please disable IDM to watch this video.');
      }
    }, 500);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // initPlayer
  // ─────────────────────────────────────────────────────────────────────────────
  const initPlayer = useCallback(async (videoUrl: string) => {
    if (initLockRef.current === videoUrl) { log('duplicate init — skipping'); return; }
    initLockRef.current = videoUrl;
    log('initPlayer:', videoUrl);
    cleanup();

    setPlayerState('streaming');
    setPlayerError('');
    setDlBytes(0);
    setIsEmbed(false); setEmbedUrl('');
    setDuration(0); setCurrentTime(0); setBufferedPct(0);
    setSpeed(1);

    // ── PATH C: Bunny CDN video (uploaded via videoUploadService) ─────────────
    // Detected by CDN hostname prefix. Flow:
    //   1. Call backend bunny-meta → gets raw URL from Firestore, signs it
    //   2. Browser uses short-lived Bunny Token Auth signed URL (CDN-direct, fast)
    //   3. Raw URL never reaches browser — Bunny validates token on every request
    //   4. __idm_id__ detection still active for layer-2 IDM protection
    if (BUNNY_CDN_HOSTNAME && videoUrl.startsWith(`https://${BUNNY_CDN_HOSTNAME}/`)) {
      try {
        log('Bunny CDN video — fetching signed URL...');
        const bunnyMeta = await videoStreamService.getBunnySignedUrl(contentId!, SECURITY_STRING);
        if (!alive.current) { initLockRef.current = ''; return; }

        const v = videoRef.current;
        if (!v) { initLockRef.current = ''; return; }

        const restoreTime = savedTimeRef.current;
        savedTimeRef.current = 0;

        startIDMWatch();

        await new Promise<void>(resolve => {
          const onCanPlay = () => {
            if (!alive.current || devToolsRef.current) { resolve(); return; }
            if (restoreTime > 0) v.currentTime = restoreTime;
            log('Bunny canplay — CDN streaming works!');
            setPlayerState('playing');
            setTimeout(() => {
              if (alive.current && v.paused && !devToolsRef.current)
                v.play().catch(e => { log('autoplay blocked:', e.message); setPlayerState('paused'); });
            }, 100);
            resolve();
          };
          const onMetaLoaded = () => { if (alive.current) setDuration(v.duration || 0); };
          const onError = () => {
            logErr('Bunny playback error');
            if (alive.current) { setPlayerError('Video failed to load. Please retry.'); setPlayerState('error'); }
            resolve();
          };
          v.addEventListener('canplay',        onCanPlay,    { once: true });
          v.addEventListener('loadedmetadata', onMetaLoaded, { once: true });
          v.addEventListener('error',          onError,      { once: true });
          v.src = bunnyMeta.signedUrl; v.load(); v.preload = 'auto';
        });

        initLockRef.current = '';
        return;
      } catch (err: any) {
        initLockRef.current = '';
        logErr('Bunny meta error:', err);
        if (alive.current) { setPlayerError(err.message || 'Failed to load video.'); setPlayerState('error'); }
        return;
      }
    }

    // ── Non-secured direct URL (fallback — shouldn't normally appear in prod) ──
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
      if (!alive.current) { initLockRef.current = ''; return; }
      log('meta type:', meta.type);

      if (meta.type === 'embed') {
        setIsEmbed(true); setEmbedUrl(meta.embedUrl); setPlayerState('playing');
        initLockRef.current = ''; return;
      }

      const v = videoRef.current;
      if (!v || !alive.current) { initLockRef.current = ''; return; }

      const playToken = (meta as any).playToken as string | undefined;
      const swSecret  = (meta as any).swSecret  as string | undefined;

      // ── PATH A: Native Range streaming via Service Worker signatures ──────
      // Fast: instant start, real seeking. IDM blocked: it bypasses the SW →
      // no HMAC headers → server 403.
      if (playToken && swSecret && swReadyRef.current) {
        // Post secret BEFORE setting video.src so first Range request is signed
        postSecretToSW(swSecret, videoId);
        // Small delay to ensure SW processes postMessage before video fires Range
        await new Promise(r => setTimeout(r, 60));
        if (!alive.current) { initLockRef.current = ''; return; }

        const proxyUrl    = `${window.location.origin}/api/videoStream?action=play&videoId=${encodeURIComponent(videoId)}&token=${encodeURIComponent(playToken)}`;
        const restoreTime = savedTimeRef.current;
        savedTimeRef.current = 0;
        let streamWorked = false;

        startIDMWatch();

        await new Promise<void>(resolve => {
          const onCanPlay = () => {
            streamWorked = true;
            if (!alive.current || devToolsRef.current) { resolve(); return; }
            if (restoreTime > 0) v.currentTime = restoreTime;
            log('canplay — SW streaming works!');
            setPlayerState('playing');
            setTimeout(() => {
              if (alive.current && v.paused && !devToolsRef.current)
                v.play().catch(e => { log('autoplay blocked:', e.message); setPlayerState('paused'); });
            }, 100);
            resolve();
          };
          const onMetaLoaded = () => { if (alive.current) setDuration(v.duration || 0); };
          const onError = () => {
            log('SW streaming failed — trying chunk fallback');
            v.removeEventListener('canplay',        onCanPlay);
            v.removeEventListener('loadedmetadata', onMetaLoaded);
            resolve();
          };
          v.addEventListener('canplay',        onCanPlay,    { once: true });
          v.addEventListener('loadedmetadata', onMetaLoaded, { once: true });
          v.addEventListener('error',          onError,      { once: true });
          v.src = proxyUrl; v.load(); v.preload = 'auto';
        });

        initLockRef.current = '';
        if (streamWorked) return;
        if (!alive.current) return;
        // SW path failed — clear and fall through to chunk fallback
        try { v.pause(); v.removeAttribute('src'); v.load(); } catch {}
      }

      // ── PATH B: Chunk token-chain fallback (SW unavailable / failed) ──────
      // Slower (downloads all chunks first), but IDM-proof everywhere.
      log('using chunk fallback');
      const firstChunkToken = (meta as any).firstChunkToken as string | undefined;
      if (!firstChunkToken) {
        setPlayerError('No stream token received.');
        setPlayerState('error');
        initLockRef.current = '';
        return;
      }

      setPlayerState('downloading');
      startIDMWatch();
      const restoreTimeFallback = savedTimeRef.current;
      savedTimeRef.current = 0;

      const chunks = await downloadAllChunks(
        videoId, firstChunkToken,
        () => alive.current,
        (_, b) => { if (alive.current) setDlBytes(b); },
      );

      initLockRef.current = '';
      if (!chunks || !alive.current) return;

      const blob    = new Blob(chunks, { type: 'video/mp4' });
      const blobUrl = URL.createObjectURL(blob);
      log(`blob: ${fmtBytes(blob.size)}`);
      blobUrlRef.current = blobUrl;
      if (!v || !alive.current) { URL.revokeObjectURL(blobUrl); blobUrlRef.current = ''; return; }

      v.src = blobUrl; v.load();
      v.addEventListener('loadedmetadata', () => {
        if (!alive.current || devToolsRef.current) return;
        setDuration(v.duration || 0);
        if (restoreTimeFallback > 0) v.currentTime = restoreTimeFallback;
        setPlayerState('playing');
        setTimeout(() => {
          if (alive.current && v.paused && !devToolsRef.current)
            v.play().catch(e => { log('autoplay blocked:', e.message); setPlayerState('paused'); });
        }, 100);
      }, { once: true });

    } catch (err: any) {
      initLockRef.current = '';
      logErr('initPlayer error:', err);
      if (alive.current) { setPlayerError(err.message || 'Failed to load video.'); setPlayerState('error'); }
    }
  }, [cleanup, startIDMWatch]);

  // ── Content loading ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!contentId || !swReady) return;  // wait for SW before loading anything
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
        } finally { if (alive.current) setLoadingContent(false); }
      })();
    }
    return () => { alive.current = false; cleanup(); };
  }, [contentId, cleanup, swReady]);

  useEffect(() => { if (content?.videoUrl) initPlayer(content.videoUrl); }, [content, initPlayer]);

  // ── Video element events ───────────────────────────────────────────────────
  const onTimeUpdate = () => {
    const v = videoRef.current; if (!v) return;
    setCurrentTime(v.currentTime);
    if (v.buffered.length > 0 && v.duration)
      setBufferedPct((v.buffered.end(v.buffered.length - 1) / v.duration) * 100);
    
    // Track progress every 10 seconds or when reaching 70% milestone
    const now = Date.now();
    const timeSinceLastUpdate = (now - lastProgressUpdate.current) / 1000;
    const watchPercentage = v.duration > 0 ? (v.currentTime / v.duration) * 100 : 0;
    
    if (
      user &&
      contentId &&
      content &&
      v.duration > 0 &&
      (timeSinceLastUpdate >= 10 || (watchPercentage >= 70 && timeSinceLastUpdate >= 5))
    ) {
      lastProgressUpdate.current = now;
      console.log('[LessonViewer] Saving progress:', {
        contentId, courseId, watchPercentage: watchPercentage.toFixed(1) + '%',
        currentTime: v.currentTime.toFixed(1), duration: v.duration.toFixed(1),
      });
      contentProgressService.updateVideoProgress(
        contentId,
        user.uid,
        v.currentTime,
        v.duration,
        content.subject || 'General',
        content.title,
        content.type as 'lesson' | 'note' | 'trick',
        courseId || undefined
      ).catch((err) => {
        console.error('[LessonViewer] Failed to save progress:', err);
      });
    }
  };

  // Force-save progress on pause/end — catches seek-to-end scenario
  const saveProgressNow = useCallback(() => {
    const v = videoRef.current;
    if (!v || !user || !contentId || !content || v.duration <= 0) return;
    const watchPercentage = (v.currentTime / v.duration) * 100;
    if (watchPercentage < 1) return; // ignore if barely started
    console.log('[LessonViewer] Force-saving on pause/end:', {
      contentId, courseId, watchPercentage: watchPercentage.toFixed(1) + '%',
    });
    lastProgressUpdate.current = Date.now();
    contentProgressService.updateVideoProgress(
      contentId,
      user.uid,
      v.currentTime,
      v.duration,
      content.subject || 'General',
      content.title,
      content.type as 'lesson' | 'note' | 'trick',
      courseId || undefined
    ).catch((err) => {
      console.error('[LessonViewer] Force-save failed:', err);
    });
  }, [user, contentId, content, courseId]); // eslint-disable-line react-hooks/exhaustive-deps
  const onDurationChange = () => { if (videoRef.current?.duration) setDuration(videoRef.current.duration); };
  const onPlay    = () => { if (alive.current && !devToolsRef.current) { setPlayerState('playing'); setIsSeeking(false); } };
  const onPause   = () => { if (alive.current && playerState !== 'devtools') { setPlayerState('paused'); saveProgressNow(); } };
  const onEnded   = () => { setPlayerState('ended'); saveProgressNow(); };
  const onWaiting = () => setIsSeeking(true);
  const onPlaying = () => setIsSeeking(false);
  const onVolChange = () => {
    const v = videoRef.current; if (!v) return;
    setVolume(v.volume); setMuted(v.muted);
  };
  const onVideoError = () => {
    const v = videoRef.current;
    if (v?.error && v.src && v.src !== window.location.href) {
      logErr('video error:', v.error.code, v.error.message);
      setPlayerError('Playback error. Please retry.');
      setPlayerState('error');
    }
  };

  // ── Player control functions ───────────────────────────────────────────────
  const togglePlayPause = () => {
    const v = videoRef.current; if (!v) return;
    showControls();
    if (playerState === 'ended') { v.currentTime = 0; v.play().catch(() => {}); return; }
    v.paused ? v.play().catch(() => {}) : v.pause();
  };
  const skipBy = (secs: number) => {
    const v = videoRef.current; if (!v || !duration) return;
    v.currentTime = clamp(v.currentTime + secs, 0, duration);
    setSkipFlash(secs > 0 ? 'fwd' : 'back');
    setTimeout(() => setSkipFlash(null), 700);
    showControls();
  };
  const adjustVolume = (delta: number) => {
    const v = videoRef.current; if (!v) return;
    const nv = clamp(v.volume + delta, 0, 1);
    v.volume = nv; v.muted = nv === 0;
    setVolume(nv); setMuted(nv === 0);
  };
  const toggleMute = () => {
    const v = videoRef.current; if (!v) return;
    v.muted = !v.muted; setMuted(v.muted);
  };
  const setSpeedTo = (s: number) => {
    const clamped = Math.round(clamp(s, MIN_SPEED, MAX_SPEED) / SPEED_STEP) * SPEED_STEP;
    const v = videoRef.current; if (v) v.playbackRate = clamped;
    setSpeed(parseFloat(clamped.toFixed(2)));
  };
  const toggleFullscreen = () => {
    const el = playerWrapRef.current; if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  };
  const handleRetry = () => {
    savedTimeRef.current = videoRef.current?.currentTime || 0;
    initLockRef.current = '';
    if (content?.videoUrl) initPlayer(content.videoUrl);
  };

  // ── Progress bar interaction ───────────────────────────────────────────────
  const pctFromMouse = (clientX: number): number => {
    const el = progressRef.current; if (!el) return 0;
    const r = el.getBoundingClientRect();
    return clamp((clientX - r.left) / r.width, 0, 1);
  };
  const commitSeek = (pct: number) => {
    const v = videoRef.current; if (!v || !duration) return;
    const t = pct * duration;
    if (typeof (v as any).fastSeek === 'function') (v as any).fastSeek(t);
    else v.currentTime = t;
    setCurrentTime(t);
  };
  const onProgressMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startPct = pctFromMouse(e.clientX);
    setIsDragging(true);
    setDragVisualPct(startPct * 100);
    const onMove = (ev: MouseEvent) => setDragVisualPct(pctFromMouse(ev.clientX) * 100);
    const onUp   = (ev: MouseEvent) => {
      const finalPct = pctFromMouse(ev.clientX);
      setDragVisualPct(finalPct * 100);
      commitSeek(finalPct);
      setIsDragging(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  };
  const onProgressTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    const getPct = (touches: TouchList) => {
      const r = progressRef.current!.getBoundingClientRect();
      return clamp((touches[0].clientX - r.left) / r.width, 0, 1);
    };
    setIsDragging(true);
    setDragVisualPct(getPct(e.touches) * 100);
    const onMove = (ev: TouchEvent) => { ev.preventDefault(); setDragVisualPct(getPct(ev.touches) * 100); };
    const onEnd  = (ev: TouchEvent) => {
      const finalPct = getPct(ev.changedTouches);
      setDragVisualPct(finalPct * 100);
      commitSeek(finalPct);
      setIsDragging(false);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend',  onEnd);
    };
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend',  onEnd);
  };
  const onProgressHover = (e: React.MouseEvent) => {
    const pct = pctFromMouse(e.clientX);
    setHoverInfo({ pct: pct * 100, time: pct * duration });
  };

  // ── Derived values ─────────────────────────────────────────────────────────
  const playPct         = isDragging ? dragVisualPct : (duration > 0 ? (currentTime / duration) * 100 : 0);
  const showLoadOverlay = playerState === 'streaming' || playerState === 'downloading';
  const showPlayerCtrls = (playerState === 'playing' || playerState === 'paused' || playerState === 'ended') && !isVideoHidden;
  const ctrlsHidden     = playerState === 'playing' && !ctrlVisible && !isDragging && !showSpeedMenu && !showVolPanel;
  const VolumeIcon      = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const getNoteHref     = () => content?.noteSource === 'gdrive' ? content?.noteGDriveDownloadUrl || null : content?.noteUrl || null;
  const getNotePreview  = () => content?.noteSource === 'gdrive' ? content?.noteGDrivePreviewUrl  || null : content?.noteUrl || null;

  // ── Loading screen ─────────────────────────────────────────────────────────
  // SW gate — wait for service worker before showing anything.
  // Prevents the first-visit race condition (chunk fallback instead of fast stream).
  const isLight = theme === 'light';
  const darkMode = !isLight;
  const pRgb    = hexRgb(primaryColor);
  const baseBg  = THEME_BG[theme] ?? '#0d1117';
  const T = {
    text:    isLight ? '#111827' : 'rgba(255,255,255,0.88)',
    text2:   isLight ? '#6b7280' : 'rgba(255,255,255,0.45)',
    text3:   isLight ? '#9ca3af' : 'rgba(255,255,255,0.28)',
    border:  isLight ? 'rgba(0,0,0,0.09)'      : `rgba(${pRgb},0.18)`,
    surface: isLight ? 'rgba(0,0,0,0.04)'      : 'rgba(255,255,255,0.04)',
    cardBg:  isLight ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.04)',
    inputBg: isLight ? 'rgba(0,0,0,0.06)'      : 'rgba(255,255,255,0.08)',
    divider: isLight ? 'rgba(0,0,0,0.07)'      : 'rgba(255,255,255,0.06)',
    primary: primaryColor,
    accent:  accentColor,
    gradient: `linear-gradient(135deg,${primaryColor} 0%,${accentColor} 100%)`,
    playerBg: darkMode ? '#000' : '#0a0a0a',
    panelBg:  darkMode ? '#12121e' : '#1a1a2e',
    prg:      primaryColor,
  };

  if (!swReady) return (
    <div style={{ minHeight: '100vh', background: baseBg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div style={{ position: 'relative', width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 64 64" fill="none">
          <circle cx="32" cy="32" r="27" stroke={`rgba(${pRgb},.15)`} strokeWidth="3" />
          <circle cx="32" cy="32" r="27" stroke={primaryColor} strokeWidth="3"
            strokeDasharray="40 130" strokeLinecap="round"
            style={{ animation: 'lv-spin .85s linear infinite', transformOrigin: 'center' }} />
        </svg>
        <Shield size={20} style={{ color: primaryColor, opacity: 0.7, position: 'relative', zIndex: 1 }} />
      </div>
      <p style={{ color: T.text3, fontSize: 13, fontWeight: 500, letterSpacing: '0.05em', fontFamily: "'Outfit',sans-serif" }}>Securing stream…</p>
      <style>{`@keyframes lv-spin { to { transform:rotate(360deg); } }`}</style>
    </div>
  );

  if (loadingContent) return (
    <div style={{ minHeight: '100vh', background: baseBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: `rgba(${pRgb},0.25)`, borderTopColor: primaryColor }} />
    </div>
  );
  if (contentError) return (
    <div style={{ minHeight: '100vh', background: baseBg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ maxWidth: 400, width: '100%', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 20, padding: '32px 28px', textAlign: 'center', fontFamily: "'Outfit',sans-serif" }}>
        <AlertCircle size={32} style={{ color: '#f87171', margin: '0 auto 16px' }} />
        <p style={{ color: T.text2, marginBottom: 16, fontSize: 14 }}>{contentError}</p>
        <button onClick={() => navigate(-1)} style={{ fontSize: 13, color: T.text3, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>← Go back</button>
      </div>
    </div>
  );

  // ==================== RENDER ================================================
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap');

        .sv { -webkit-user-select:none; user-select:none; -webkit-user-drag:none; }
        .sv video { display:block; width:100%; height:100%; object-fit:contain; pointer-events:none; }
        .sv video::-webkit-media-controls,
        .sv video::-webkit-media-controls-enclosure { display:none !important; }

        .wm {
          position:absolute; top:13px; z-index:30;
          font-family:'Outfit', system-ui, sans-serif;
          font-size:11px; font-weight:700; letter-spacing:.13em; text-transform:uppercase;
          color:rgba(255,255,255,.18); text-shadow:0 1px 6px rgba(0,0,0,.7);
          pointer-events:none; user-select:none; white-space:nowrap;
        }
        .wm-right { right:14px; }
        .wm-left  { left:14px; }

        .prg { position:relative; height:5px; cursor:pointer; transition:height .15s; touch-action:none; }
        .prg:hover, .prg.drag { height:7px; }
        .prg-track { position:absolute; inset:0; background:rgba(255,255,255,.16); border-radius:99px; overflow:visible; }
        .prg-buf   { position:absolute; top:0; left:0; height:100%; background:rgba(255,255,255,.25); border-radius:99px; pointer-events:none; }
        .prg-fill  { position:absolute; top:0; left:0; height:100%; background:var(--lv-primary,#7c3aed); border-radius:99px; pointer-events:none; }
        .prg-fill.smooth { transition:width .08s linear; }
        .prg-dot   { position:absolute; top:50%; width:15px; height:15px; border-radius:50%;
                     background:#fff; transform:translateX(-50%) translateY(-50%);
                     box-shadow:0 0 0 3px var(--lv-primary-a55,rgba(124,58,237,.55)); opacity:0;
                     transition:opacity .15s; pointer-events:none; }
        .prg:hover .prg-dot, .prg.drag .prg-dot { opacity:1; }
        .prg-tip { position:absolute; bottom:calc(100% + 9px); background:rgba(8,8,18,.95);
                   border:1px solid rgba(255,255,255,.12);
                   color:#fff; font-size:11px; font-weight:600; padding:3px 9px;
                   border-radius:8px; transform:translateX(-50%);
                   pointer-events:none; white-space:nowrap; font-family:'Outfit',sans-serif; }

        .cb { display:inline-flex; align-items:center; justify-content:center;
              background:transparent; border:none; color:rgba(255,255,255,.70);
              border-radius:9px; padding:7px; cursor:pointer; flex-shrink:0;
              transition:color .1s, background .1s; -webkit-tap-highlight-color:transparent; }
        .cb:hover { color:#fff; background:rgba(255,255,255,.1); }
        .cb:active { background:rgba(255,255,255,.16); }
        .cb.on { color:var(--lv-primary,#a78bfa); }

        .vol-panel {
          position:absolute; bottom:calc(100% + 10px); left:50%;
          transform:translateX(-50%);
          background:#0e0e1c; border:1px solid rgba(255,255,255,.12);
          border-radius:16px; padding:14px 10px 10px;
          display:flex; flex-direction:column; align-items:center; gap:10px;
          box-shadow:0 20px 60px rgba(0,0,0,.85);
          z-index:300; min-width:44px;
          animation:lvFadeUp .15s ease;
        }
        @keyframes lvFadeUp {
          from { opacity:0; transform:translateX(-50%) translateY(8px); }
          to   { opacity:1; transform:translateX(-50%) translateY(0); }
        }
        .vol-pct { font-size:11px; font-weight:700; color:rgba(255,255,255,.5);
                   font-variant-numeric:tabular-nums; min-width:32px; text-align:center; font-family:'Outfit',sans-serif; }
        .vol-vert-wrap { position:relative; width:4px; height:90px;
                         background:rgba(255,255,255,.14); border-radius:99px;
                         cursor:pointer; touch-action:none; }
        .vol-vert-fill { position:absolute; bottom:0; left:0; width:100%;
                         background:var(--lv-primary,#7c3aed); border-radius:99px; pointer-events:none; }
        .vol-vert-dot  { position:absolute; left:50%; width:13px; height:13px; border-radius:50%;
                         background:#fff; transform:translateX(-50%) translateY(50%);
                         box-shadow:0 0 0 2px var(--lv-primary-a50,rgba(124,58,237,.5)); pointer-events:none; }

        .spd-panel {
          position:absolute; bottom:calc(100% + 10px); right:0;
          background:#0e0e1c; border:1px solid rgba(255,255,255,.12);
          border-radius:16px; padding:12px;
          display:flex; flex-direction:column; gap:8px; align-items:center;
          box-shadow:0 20px 60px rgba(0,0,0,.85);
          z-index:300; min-width:136px;
          animation:lvFadeUp .15s ease;
        }
        .spd-label { font-size:10px; text-transform:uppercase; letter-spacing:.08em;
                     color:rgba(255,255,255,.28); font-weight:600; font-family:'Outfit',sans-serif; }
        .spd-value { font-size:22px; font-weight:800; color:#fff;
                     font-variant-numeric:tabular-nums; line-height:1; font-family:'Outfit',sans-serif; }
        .spd-row { display:flex; align-items:center; gap:8px; width:100%; }
        .spd-btn { display:flex; align-items:center; justify-content:center;
                   width:32px; height:32px; border-radius:9px; border:none; cursor:pointer;
                   background:rgba(255,255,255,.08); color:rgba(255,255,255,.8);
                   font-size:18px; font-weight:700; transition:background .1s;
                   flex-shrink:0; -webkit-tap-highlight-color:transparent; font-family:'Outfit',sans-serif; }
        .spd-btn:hover { background:rgba(255,255,255,.15); }
        .spd-btn:active { background:var(--lv-primary-a30,rgba(124,58,237,.3)); }
        .spd-bar-wrap { flex:1; height:4px; background:rgba(255,255,255,.14);
                        border-radius:99px; overflow:hidden; }
        .spd-bar-fill { height:100%; background:var(--lv-primary,#7c3aed); border-radius:99px; transition:width .1s; }
        .spd-presets { display:flex; gap:5px; flex-wrap:wrap; justify-content:center; }
        .spd-preset { font-size:11px; font-weight:600; padding:4px 8px; border-radius:7px;
                      border:1px solid rgba(255,255,255,.1); background:transparent;
                      color:rgba(255,255,255,.45); cursor:pointer; font-family:'Outfit',sans-serif;
                      transition:all .1s; -webkit-tap-highlight-color:transparent; }
        .spd-preset:hover { background:rgba(255,255,255,.08); color:#fff; }
        .spd-preset.active { background:var(--lv-primary-a25,rgba(124,58,237,.25)); border-color:var(--lv-primary,#7c3aed); color:var(--lv-primary,#a78bfa); }

        .ctrl-wrap { transition:opacity .22s ease, transform .18s ease; }
        .ctrl-wrap.hide { opacity:0 !important; transform:translateY(5px); pointer-events:none; }

        .skip-flash { position:absolute; top:50%; left:50%;
                      transform:translate(-50%,-50%);
                      display:flex; align-items:center; gap:6px;
                      background:rgba(0,0,0,.65); border-radius:14px;
                      padding:10px 20px; color:#fff; font-size:14px; font-weight:600;
                      pointer-events:none; animation:lvSfade .65s ease-out forwards;
                      font-family:'Outfit',sans-serif; }
        @keyframes lvSfade {
          0%   { opacity:1; transform:translate(-50%,-50%) scale(1); }
          60%  { opacity:.85; }
          100% { opacity:0; transform:translate(-50%,-62%) scale(.91); }
        }

        .lv-spin-ring { animation:lv-spin .85s linear infinite; transform-origin:center; }
        @keyframes lv-spin { to { transform:rotate(360deg); } }

        @keyframes lvFadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
        .au  { animation:lvFadeUp .4s cubic-bezier(.22,1,.36,1) both; }
        .au1 { animation:lvFadeUp .4s .06s cubic-bezier(.22,1,.36,1) both; }
        .au2 { animation:lvFadeUp .4s .12s cubic-bezier(.22,1,.36,1) both; }
        .au3 { animation:lvFadeUp .4s .18s cubic-bezier(.22,1,.36,1) both; }

        /* Responsive player tweaks */
        @media(max-width:480px){
          .prg { height:6px; }
          .prg:hover,.prg.drag { height:8px; }
          .prg-dot { width:18px; height:18px; }
          .cb { padding:8px; }
          .spd-panel { right:-20px; }
        }
      `}</style>

      {/* CSS custom properties for theme-aware player colours */}
      <style>{`
        :root {
          --lv-primary: ${primaryColor};
          --lv-primary-a55: rgba(${pRgb},.55);
          --lv-primary-a50: rgba(${pRgb},.50);
          --lv-primary-a30: rgba(${pRgb},.30);
          --lv-primary-a25: rgba(${pRgb},.25);
        }
      `}</style>

      <div style={{ minHeight: '100vh', background: baseBg, color: T.text, fontFamily: "'Outfit',sans-serif", userSelect: 'none' }} onContextMenu={e => e.preventDefault()}>
        {/* Ambient background glow */}
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', background: `radial-gradient(ellipse 70% 40% at 50% -5%, rgba(${pRgb},.14) 0%, transparent 70%)`, zIndex: 0 }} />

        <div style={{ position: 'relative', maxWidth: 1024, margin: '0 auto', padding: '0 16px 56px', zIndex: 1 }}>
          <div style={{ paddingTop: 24, paddingBottom: 4 }}>
            <button onClick={() => navigate(-1)}
              className="au"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 500, color: T.text3, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: '7px 14px', cursor: 'pointer', marginBottom: 20, fontFamily: "'Outfit',sans-serif", transition: 'color .15s, background .15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = T.text; (e.currentTarget as HTMLButtonElement).style.background = isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.08)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = T.text3; (e.currentTarget as HTMLButtonElement).style.background = T.surface; }}
            >
              <ArrowLeft size={14} /> Back
            </button>
          </div>

          {/* ════ PLAYER CARD ════════════════════════════════════════════════ */}
          <div className="au1" style={{ borderRadius: 20, overflow: 'hidden', border: `1px solid rgba(${pRgb},.18)`, background: '#000', marginBottom: 24, boxShadow: `0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(${pRgb},.08)` }}>

            {playerState === 'devtools' && (
              <div style={{ aspectRatio: '16/9', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#080a10' }}>
                <Lock size={32} style={{ color: '#f87171', marginBottom: 12 }} />
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, fontWeight: 500, fontFamily: "'Outfit',sans-serif" }}>DevTools detected</p>
                <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, marginTop: 4, fontFamily: "'Outfit',sans-serif" }}>Close DevTools to resume</p>
              </div>
            )}

            {isEmbed && embedUrl && (
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                <iframe src={embedUrl} className="absolute inset-0 w-full h-full"
                  allow="autoplay; fullscreen; encrypted-media" allowFullScreen
                  referrerPolicy="no-referrer"
                  sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
                  title={content?.title || 'Video'} style={{ border: 'none', pointerEvents: 'auto' }} />
              </div>
            )}

            {!isEmbed && content?.videoUrl && (
              <div
                ref={playerWrapRef}
                className="sv relative bg-black"
                style={{ aspectRatio: '16/9', minHeight: 200 }}
                onMouseMove={showControls}
                onMouseLeave={() => { if (playerState === 'playing') setCtrlVisible(false); }}
                onTouchStart={showControls}
              >
                {user?.userId && <div className="wm wm-left">{user.userId}</div>}
                <div className="wm wm-right">Edtech</div>

                <video
                  ref={videoRef}
                  className="absolute inset-0 w-full h-full"
                  style={{ display: isVideoHidden || showLoadOverlay ? 'none' : 'block' }}
                  playsInline
                  controlsList="nodownload nofullscreen noremoteplayback"
                  disablePictureInPicture
                  onTimeUpdate={onTimeUpdate}
                  onDurationChange={onDurationChange}
                  onPlay={onPlay} onPause={onPause} onEnded={onEnded}
                  onWaiting={onWaiting} onPlaying={onPlaying}
                  onVolumeChange={onVolChange}
                  onError={onVideoError}
                  onContextMenu={e => e.preventDefault()}
                  onClick={togglePlayPause}
                />

                {/* Loading overlay */}
                {showLoadOverlay && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#000', gap: 20 }}>
                    <div style={{ position: 'relative', width: 80, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 80 80" fill="none">
                        <circle cx="40" cy="40" r="34" stroke={`rgba(${pRgb},.15)`} strokeWidth="3.5" />
                        <circle cx="40" cy="40" r="34" stroke={primaryColor} strokeWidth="3.5"
                          strokeDasharray="50 163" strokeLinecap="round" className="lv-spin-ring" />
                      </svg>
                      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', animation: 'lv-spin 3s linear infinite reverse', transformOrigin: 'center' }} viewBox="0 0 80 80" fill="none">
                        <circle cx="40" cy="40" r="26" stroke={`rgba(${pRgb},.1)`} strokeWidth="2" strokeDasharray="8 6" strokeLinecap="round" />
                      </svg>
                      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" style={{ position: 'relative', zIndex: 1 }}>
                        <path d="M4 6C4 4.9 4.9 4 6 4H13V20H6C4.9 20 4 19.1 4 18V6Z" fill={`rgba(${pRgb},.6)`} />
                        <path d="M15 4H22C23.1 4 24 4.9 24 6V18C24 19.1 23.1 20 22 20H15V4Z" fill={`rgba(${pRgb},.4)`} />
                        <rect x="13" y="4" width="2" height="16" fill={`rgba(${pRgb},1)`} opacity="0.8" />
                        <path d="M6 20C6 21.1 6.9 22 8 22H20C21.1 22 22 21.1 22 20H6Z" fill={`rgba(${pRgb},.3)`} />
                        <circle cx="14" cy="14" r="5.5" fill="rgba(0,0,0,.35)" />
                        <path d="M12.3 11.5L17.2 14L12.3 16.5V11.5Z" fill="white" />
                      </svg>
                    </div>
                    <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 13, fontWeight: 500, letterSpacing: '0.02em', fontFamily: "'Outfit',sans-serif" }}>
                      {playerState === 'downloading' && dlBytes > 0 ? `Loading… ${fmtBytes(dlBytes)}` : 'Loading…'}
                    </p>
                  </div>
                )}

                {/* Mid-play buffering spinner */}
                {isSeeking && !showLoadOverlay && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <svg className="w-12 h-12" viewBox="0 0 48 48" fill="none">
                      <circle cx="24" cy="24" r="19" stroke="rgba(255,255,255,.15)" strokeWidth="3" />
                      <circle cx="24" cy="24" r="19" stroke="rgba(255,255,255,.7)" strokeWidth="3"
                        strokeDasharray="30 90" strokeLinecap="round" className="lv-spin-ring" />
                    </svg>
                  </div>
                )}

                {/* Skip flash */}
                {skipFlash && (
                  <div className="skip-flash">
                    {skipFlash === 'fwd' ? <><RotateCw size={16} /><span>+10s</span></> : <><RotateCcw size={16} /><span>–10s</span></>}
                  </div>
                )}

                {/* IDM blocked overlay */}
                {playerState === 'idm_blocked' && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.94)', textAlign: 'center', padding: 24, zIndex: 20 }}>
                    <Shield size={36} style={{ color: '#f87171', marginBottom: 12 }} />
                    <p style={{ color: '#fff', fontWeight: 600, fontSize: 15, marginBottom: 8, fontFamily: "'Outfit',sans-serif" }}>Download Manager Detected</p>
                    <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, maxWidth: 280, lineHeight: 1.6, fontFamily: "'Outfit',sans-serif" }}>
                      Please disable IDM or similar download software, then refresh the page to watch this video.
                    </p>
                  </div>
                )}

                {/* Error overlay */}
                {playerState === 'error' && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.9)', textAlign: 'center', padding: 24 }}>
                    <AlertCircle size={30} style={{ color: '#f87171', marginBottom: 12 }} />
                    <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, marginBottom: 16, maxWidth: 280, lineHeight: 1.6, fontFamily: "'Outfit',sans-serif" }}>{playerError}</p>
                    <button onClick={handleRetry}
                      style={{ padding: '10px 24px', background: T.gradient, color: '#fff', fontSize: 13, fontWeight: 600, borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
                      Try Again
                    </button>
                  </div>
                )}

                {/* Ended overlay */}
                {playerState === 'ended' && !isVideoHidden && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.42)', pointerEvents: 'none' }}>
                    <button
                      style={{ pointerEvents: 'auto', width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.22)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background .15s' }}
                      onClick={togglePlayPause}
                      onMouseEnter={e => (e.currentTarget.style.background='rgba(255,255,255,0.26)')}
                      onMouseLeave={e => (e.currentTarget.style.background='rgba(255,255,255,0.16)')}
                    >
                      <RotateCcw size={28} style={{ color: '#fff' }} />
                    </button>
                  </div>
                )}

                {/* ════ CONTROLS ════════════════════════════════════════════ */}
                {showPlayerCtrls && (
                  <div className={`ctrl-wrap absolute inset-x-0 bottom-0 ${ctrlsHidden ? 'hide' : ''}`}>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent pointer-events-none" />

                    <div className="relative px-3 pb-3 pt-10">

                      {/* Progress bar */}
                      <div
                        ref={progressRef}
                        className={`prg mb-3 ${isDragging ? 'drag' : ''}`}
                        onMouseDown={onProgressMouseDown}
                        onTouchStart={onProgressTouchStart}
                        onMouseMove={onProgressHover}
                        onMouseLeave={() => setHoverInfo(null)}
                      >
                        <div className="prg-track">
                          <div className="prg-buf" style={{ width: `${bufferedPct}%` }} />
                          <div className={`prg-fill${isDragging ? '' : ' smooth'}`} style={{ width: `${playPct}%` }} />
                          <div className="prg-dot" style={{ left: `${playPct}%` }} />
                        </div>
                        {hoverInfo !== null && (
                          <div className="prg-tip" style={{ left: `${hoverInfo.pct}%` }}>
                            {fmtTime(hoverInfo.time)}
                          </div>
                        )}
                      </div>

                      {/* Controls row */}
                      <div className="flex items-center gap-0.5">

                        <button className="cb" onClick={togglePlayPause}
                          title={playerState === 'playing' ? 'Pause (Space)' : 'Play (Space)'}>
                          {playerState === 'playing' ? <Pause size={20} /> : playerState === 'ended' ? <RotateCcw size={18} /> : <Play size={20} />}
                        </button>

                        <button className="cb" onClick={() => skipBy(-10)} title="Back 10s"><SkipBack size={17} /></button>
                        <button className="cb" onClick={() => skipBy(10)}  title="Forward 10s"><SkipForward size={17} /></button>

                        {/* Volume */}
                        <div className="relative flex-shrink-0" ref={volumeWrapRef}>
                          <button className={`cb ${showVolPanel ? 'on' : ''}`}
                            onClick={() => setShowVolPanel(v => !v)} title="Volume (M)">
                            <VolumeIcon size={18} />
                          </button>
                          {showVolPanel && (() => {
                            const TRACK_H = 90;
                            const volPct  = muted ? 0 : volume;
                            const fillH   = volPct * TRACK_H;
                            const dotBot  = fillH;
                            const applyVol = (clientY: number) => {
                              const el = document.getElementById('vol-vert-track');
                              if (!el) return;
                              const r = el.getBoundingClientRect();
                              const val = clamp(1 - (clientY - r.top) / r.height, 0, 1);
                              const v = videoRef.current; if (!v) return;
                              v.volume = val; v.muted = val === 0;
                              setVolume(val); setMuted(val === 0);
                            };
                            const onTrackDown = (e: React.MouseEvent) => {
                              e.preventDefault(); e.stopPropagation();
                              applyVol(e.clientY);
                              const mm = (ev: MouseEvent) => applyVol(ev.clientY);
                              const mu = () => { window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', mu); };
                              window.addEventListener('mousemove', mm);
                              window.addEventListener('mouseup', mu);
                            };
                            const onTrackTouch = (e: React.TouchEvent) => {
                              e.preventDefault(); e.stopPropagation();
                              applyVol(e.touches[0].clientY);
                              const tm = (ev: TouchEvent) => { ev.preventDefault(); applyVol(ev.touches[0].clientY); };
                              const tu = () => { window.removeEventListener('touchmove', tm); window.removeEventListener('touchend', tu); };
                              window.addEventListener('touchmove', tm, { passive: false });
                              window.addEventListener('touchend', tu);
                            };
                            return (
                              <div className="vol-panel">
                                <span className="vol-pct">{Math.round(volPct * 100)}%</span>
                                <div id="vol-vert-track" className="vol-vert-wrap"
                                  onMouseDown={onTrackDown} onTouchStart={onTrackTouch}>
                                  <div className="vol-vert-fill" style={{ height: fillH }} />
                                  <div className="vol-vert-dot"  style={{ bottom: dotBot }} />
                                </div>
                                <button className="cb" style={{ padding: 4 }} onClick={toggleMute} title="Mute (M)">
                                  <VolumeIcon size={16} />
                                </button>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Time */}
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontFamily: 'ui-monospace,monospace', fontVariantNumeric: 'tabular-nums', marginLeft: 6, flexShrink: 0 }}>
                          {fmtTime(currentTime)}
                          <span style={{ color: 'rgba(255,255,255,0.22)', margin: '0 4px' }}>/</span>
                          {fmtTime(duration)}
                        </span>

                        {/* spacer */}
                        <div style={{ flex: 1 }} />

                        {/* Speed */}
                        <div className="relative flex-shrink-0" ref={speedMenuRef}>
                          <button className={`cb text-[11px] font-bold px-1.5 min-w-[40px] ${showSpeedMenu ? 'on' : ''}`}
                            onClick={() => setShowSpeedMenu(s => !s)} title="Playback speed">
                            {speed === 1 ? '1×' : `${speed}×`}
                          </button>
                          {showSpeedMenu && (() => {
                            const presets = [0.5, 1, 1.5, 2, 2.5, 3];
                            const pct     = ((speed - MIN_SPEED) / (MAX_SPEED - MIN_SPEED)) * 100;
                            return (
                              <div className="spd-panel">
                                <span className="spd-label">Speed</span>
                                <span className="spd-value">{speed.toFixed(2)}×</span>
                                <div className="spd-row">
                                  <button className="spd-btn" onClick={() => setSpeedTo(speed - SPEED_STEP)}>−</button>
                                  <div className="spd-bar-wrap"><div className="spd-bar-fill" style={{ width: `${pct}%` }} /></div>
                                  <button className="spd-btn" onClick={() => setSpeedTo(speed + SPEED_STEP)}>+</button>
                                </div>
                                <div className="spd-presets">
                                  {presets.map(p => (
                                    <button key={p} className={`spd-preset ${speed === p ? 'active' : ''}`} onClick={() => setSpeedTo(p)}>
                                      {p === 1 ? '1×' : `${p}×`}
                                    </button>
                                  ))}
                                </div>
                                {speed !== 1 && (
                                  <button className="spd-preset" style={{ width: '100%', marginTop: 2 }} onClick={() => setSpeedTo(1)}>
                                    Reset to 1×
                                  </button>
                                )}
                              </div>
                            );
                          })()}
                        </div>

                        {/* Fullscreen */}
                        <button className="cb ml-0.5" onClick={toggleFullscreen} title="Fullscreen (F)">
                          {isFullscreen ? <Minimize size={17} /> : <Maximize size={17} />}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Mobile double-tap seek zones */}
                {showPlayerCtrls && !showLoadOverlay && (
                  <>
                    <div className="absolute inset-y-0 left-0 w-1/3"
                      style={{ bottom: 60, pointerEvents: 'auto' }}
                      onDoubleClick={() => skipBy(-10)} />
                    <div className="absolute inset-y-0 right-0 w-1/3"
                      style={{ bottom: 60, pointerEvents: 'auto' }}
                      onDoubleClick={() => skipBy(10)} />
                  </>
                )}
              </div>
            )}

            {!content?.videoUrl && !loadingContent && (
              <div style={{ aspectRatio: '16/9', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
                <Play size={32} style={{ color: 'rgba(255,255,255,0.1)', marginBottom: 12 }} />
                <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13, fontFamily: "'Outfit',sans-serif" }}>No video attached</p>
              </div>
            )}
          </div>

          {/* ── Responsive CSS for metadata layout ── */}
          <style>{`
            .lv-meta { display:grid; grid-template-columns:1fr; gap:14px; }
            .lv-meta-left { display:flex; flex-direction:column; gap:12px; }
            .lv-meta-right { display:flex; flex-direction:column; gap:12px; }
            .lv-chips { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
            .lv-note-a {
              display:flex; align-items:center; justify-content:space-between;
              gap:8px; padding:13px 16px; border-radius:14px; font-size:13px;
              font-weight:500; text-decoration:none; transition:opacity .15s;
            }
            .lv-note-a:hover { opacity:.82; }
            @media(min-width:640px){
              .lv-chips { grid-template-columns:repeat(3,1fr); }
            }
            @media(min-width:900px){
              .lv-meta { grid-template-columns:1fr 320px; }
            }
          `}</style>

          {/* ── Content metadata ── */}
          <div className="lv-meta au2">

            {/* ── LEFT: title + chips ── */}
            <div className="lv-meta-left">

              {/* Title card */}
              <div style={{ background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 18, padding: '20px 22px' }}>
                {/* Type badge only — clean, no clutter */}
                <div style={{ marginBottom: 10 }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                    background: `rgba(${pRgb},0.14)`,
                    color: primaryColor,
                    border: `1px solid rgba(${pRgb},0.22)`,
                  }}>
                    {content?.type === 'lesson' ? <Play size={10} /> : <BookOpen size={10} />}
                    {content?.type === 'lesson' ? 'Lesson' : content?.type === 'trick' ? 'Trick' : 'Content'}
                  </span>
                </div>

                <h1 style={{ color: T.text, fontWeight: 800, fontSize: 'clamp(17px,4vw,24px)', lineHeight: 1.3, margin: '0 0 5px', letterSpacing: '-0.02em' }}>
                  {content?.title || 'Untitled'}
                </h1>
                {content?.subject && (
                  <p style={{ color: T.text3, fontSize: 13, margin: 0, fontWeight: 500 }}>{content.subject}</p>
                )}
                {content?.description && (
                  <p style={{ color: T.text2, fontSize: 13, lineHeight: 1.7, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.divider}`, marginBottom: 0 }}>
                    {content.description}
                  </p>
                )}
              </div>

              {/* Info chips — duration + subject, responsive grid */}
              {(content?.duration || content?.subject) && (
                <div className="lv-chips">
                  {content?.duration && (
                    <div style={{ background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 14, padding: '13px 15px', display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 10, background: `rgba(${pRgb},0.12)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Clock size={15} style={{ color: primaryColor }} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 10, color: T.text3, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700, margin: '0 0 2px' }}>Duration</p>
                        <p style={{ fontSize: 14, color: T.text, fontWeight: 700, margin: 0 }}>{fmtMinutes(content.duration)}</p>
                      </div>
                    </div>
                  )}
                  {content?.subject && (
                    <div style={{ background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 14, padding: '13px 15px', display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(139,92,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <BookOpen size={15} style={{ color: '#a78bfa' }} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 10, color: T.text3, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700, margin: '0 0 2px' }}>Subject</p>
                        <p style={{ fontSize: 14, color: T.text, fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{content.subject}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── RIGHT: notes card only ── */}
            <div className="lv-meta-right">
              {(content?.noteUrl || content?.noteGDrivePreviewUrl) ? (
                <div style={{ background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 18, padding: '18px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FileText size={15} style={{ color: '#34d399' }} />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Class Notes</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {getNotePreview() && (
                      <a href={getNotePreview()!} target="_blank" rel="noopener noreferrer"
                        className="lv-note-a"
                        style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.18)', color: 'rgba(110,231,183,0.9)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><ExternalLink size={14} /> Preview Notes</span>
                        <span style={{ fontSize: 13 }}>→</span>
                      </a>
                    )}
                    {getNoteHref() && (
                      <a href={getNoteHref()!} target="_blank" rel="noopener noreferrer"
                        className="lv-note-a"
                        style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.text2 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Download size={14} /> Download PDF</span>
                        <span style={{ fontSize: 13 }}>→</span>
                      </a>
                    )}
                    {content?.noteSource === 'gdrive' && (
                      <p style={{ fontSize: 10, color: T.text3, textAlign: 'center', paddingTop: 2, margin: 0 }}>via Google Drive</p>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 18, padding: '24px 20px', textAlign: 'center' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: T.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                    <FileText size={20} style={{ color: T.text3, opacity: 0.5 }} />
                  </div>
                  <p style={{ fontSize: 13, color: T.text3, margin: 0, fontWeight: 500 }}>No notes attached</p>
                </div>
              )}
            </div>

          </div>

        </div>
      </div>
    </>
  );
};

export default LessonViewer;
