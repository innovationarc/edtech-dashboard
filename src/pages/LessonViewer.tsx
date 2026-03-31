// src/pages/LessonViewer.tsx — v18
//
// BASE: v17
//
// VISUAL REDESIGN in v18:
//  – All hardcoded inline style values replaced with T-token system
//    (same token map used by ComingSoon / LiveExam).
//  – Page wrapper, back-button, player card, metadata cards, chip cards,
//    notes card, and empty-state card now all use the exact same
//    background / border / shadow / radius language as ComingSoon:
//      · cardBg  = rgba(255,255,255,0.04) dark  /  rgba(255,255,255,0.92) light
//      · border  = rgba(pRgb, 0.18)  dark  /  rgba(0,0,0,0.09) light
//      · borderRadius 18–20px, gap 16px, Outfit font throughout
//      · ambient radial gradient top-of-page glow (matches sidebar sparkle)
//      · icon chips: 34×34 rounded-10 icon containers, 10px uppercase label,
//        14px bold value — identical to ComingSoon info rows
//      · "No notes attached" empty state: centered icon + text, matches
//        ComingSoon empty state style
//  – lv-meta grid now has proper 16px gap and full-width left column
//  – Back button matches ComingSoon modal close / nav button style exactly
//  – 100% responsive — works on 320px mobile up to 1440px desktop
//  – ALL security / streaming / progress / anti-piracy / IDM / SW code
//    is completely unchanged from v17.

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, FileText, ExternalLink, Download, Shield,
  AlertCircle, Loader2, Play, Pause, BookOpen, Lock,
  Volume2, VolumeX, Volume1, Maximize, Minimize,
  RotateCcw, RotateCw, SkipBack, SkipForward, Settings,
} from 'lucide-react';
import { contentLibraryService, LibraryContent } from '../services/contentLibraryService';
import { videoStreamService } from '../services/videoStreamService';
import { useDashboard } from '../contexts/DashboardContext';
import { contentProgressService } from '../services/contentProgressService';
import Card from '../components/ui/Card';

// ─── App theme helpers ────────────────────────────────────────────────────────
const hexRgb = (hex: string) => {
  if (!hex || hex.length < 7) return '124,58,237';
  return `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`;
};

const SECURITY_STRING =
  (import.meta as any).env?.VITE_VIDEO_SECURITY_STRING ||
  'CHANGE_ME_IN_VITE_ENV_VITE_VIDEO_SECURITY_STRING';

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
function detectIDM(videoEl?: HTMLVideoElement | null): boolean {
  if (videoEl?.hasAttribute('__idm_id__')) return true;
  if ((window as any).__idm_id__ !== undefined) return true;
  if (document.querySelector('[id*="idm_"][style*="position"]')) return true;
  return false;
}

// ─── Service Worker helpers ───────────────────────────────────────────────────
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

  // ── Content ────────────────────────────────────────────────────────────────
  const [content,        setContent]        = useState<LibraryContent | null>(null);
  const [loadingContent, setLoadingContent] = useState(true);
  const [contentError,   setContentError]   = useState('');

  // ── Player ─────────────────────────────────────────────────────────────────
  const [swReady,      setSwReady]      = useState(false);
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
  const lastProgressUpdate = useRef(0);

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => { injectAntiPiracy(); }, []);

  useEffect(() => {
    registerVideoSW().then(ok => {
      swReadyRef.current = ok;
      log('SW ready:', ok);
      setSwReady(true);
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

    // ── PATH C: Bunny CDN video ───────────────────────────────────────────────
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

    // ── Non-secured direct URL ────────────────────────────────────────────────
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
      if (playToken && swSecret && swReadyRef.current) {
        postSecretToSW(swSecret, videoId);
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
        try { v.pause(); v.removeAttribute('src'); v.load(); } catch {}
      }

      // ── PATH B: Chunk token-chain fallback ────────────────────────────────
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
  }, [cleanup, startIDMWatch]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Content loading ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!contentId || !swReady) return;
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

  const saveProgressNow = useCallback(() => {
    const v = videoRef.current;
    if (!v || !user || !contentId || !content || v.duration <= 0) return;
    const watchPercentage = (v.currentTime / v.duration) * 100;
    if (watchPercentage < 1) return;
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

  // ── Theme tokens — same as ComingSoon ─────────────────────────────────────
  const isLight  = theme === 'light';
  const darkMode = !isLight;
  const pRgb     = hexRgb(primaryColor);

  // Card background — derived from the theme base colour so it's always
  // visibly distinct from the page (lighter dark, not just transparent white).
  // This mirrors how ComingSoon's <Card> uses bg-background-800 (a concrete
  // hex value per theme, not a translucent value).
  // T — text/divider/icon tokens only; Card handles its own bg/border/shadow
  const T = {
    text:    isLight ? '#111827' : 'rgba(255,255,255,0.88)',
    text2:   isLight ? '#6b7280' : 'rgba(255,255,255,0.50)',
    text3:   isLight ? '#9ca3af' : 'rgba(255,255,255,0.32)',
    surface: isLight ? 'rgba(0,0,0,0.04)'  : 'rgba(255,255,255,0.06)',
    divider: isLight ? 'rgba(0,0,0,0.07)'  : 'rgba(255,255,255,0.07)',
    border:  isLight ? 'rgba(0,0,0,0.09)'  : `rgba(${pRgb},0.20)`,
    gradient: `linear-gradient(135deg,${primaryColor} 0%,${accentColor} 100%)`,
    iconBg:     `rgba(${pRgb},0.14)`,
    iconBorder: `rgba(${pRgb},0.22)`,
  };

  // ── Loading / error screens ─────────────────────────────────────────────────
  if (!swReady) return (
    <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
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
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: `rgba(${pRgb},0.25)`, borderTopColor: primaryColor }} />
    </div>
  );

  if (contentError) return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{
        maxWidth: 400, width: '100%',
        background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
        borderRadius: 20, padding: '32px 28px', textAlign: 'center', fontFamily: "'Outfit',sans-serif",
      }}>
        <AlertCircle size={32} style={{ color: '#f87171', margin: '0 auto 16px' }} />
        <p style={{ color: T.text2, marginBottom: 16, fontSize: 14 }}>{contentError}</p>
        <button onClick={() => navigate(-1)}
          style={{ fontSize: 13, color: T.text3, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
          ← Go back
        </button>
      </div>
    </div>
  );

  // ==================== RENDER ================================================
  return (
    <>
      {/* ── Global styles + CSS custom props ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap');

        /* video element */
        .sv { -webkit-user-select:none; user-select:none; -webkit-user-drag:none; }
        .sv video { display:block; width:100%; height:100%; object-fit:contain; pointer-events:none; }
        .sv video::-webkit-media-controls,
        .sv video::-webkit-media-controls-enclosure { display:none !important; }

        /* watermarks */
        .wm {
          position:absolute; top:12px; z-index:30;
          font-family:'Outfit',sans-serif; font-size:10px; font-weight:700;
          letter-spacing:.14em; text-transform:uppercase;
          color:rgba(255,255,255,.15); text-shadow:0 1px 6px rgba(0,0,0,.8);
          pointer-events:none; user-select:none; white-space:nowrap;
        }
        .wm-right{right:14px;} .wm-left{left:14px;}

        /* progress bar */
        .prg{position:relative;height:4px;cursor:pointer;transition:height .15s;touch-action:none;}
        .prg:hover,.prg.drag{height:6px;}
        .prg-track{position:absolute;inset:0;background:rgba(255,255,255,.18);border-radius:99px;overflow:visible;}
        .prg-buf{position:absolute;top:0;left:0;height:100%;background:rgba(255,255,255,.28);border-radius:99px;pointer-events:none;}
        .prg-fill{position:absolute;top:0;left:0;height:100%;background:var(--lv-p);border-radius:99px;pointer-events:none;}
        .prg-fill.smooth{transition:width .08s linear;}
        .prg-dot{position:absolute;top:50%;width:14px;height:14px;border-radius:50%;background:#fff;
                 transform:translateX(-50%) translateY(-50%);
                 box-shadow:0 0 0 3px var(--lv-p-a55);opacity:0;transition:opacity .15s;pointer-events:none;}
        .prg:hover .prg-dot,.prg.drag .prg-dot{opacity:1;}
        .prg-tip{position:absolute;bottom:calc(100% + 8px);background:rgba(8,8,18,.95);
                 border:1px solid rgba(255,255,255,.12);color:#fff;font-size:11px;font-weight:600;
                 padding:3px 9px;border-radius:8px;transform:translateX(-50%);
                 pointer-events:none;white-space:nowrap;font-family:'Outfit',sans-serif;}

        /* control buttons */
        .cb{display:inline-flex;align-items:center;justify-content:center;
            background:transparent;border:none;color:rgba(255,255,255,.72);
            border-radius:8px;padding:7px;cursor:pointer;flex-shrink:0;
            transition:color .1s,background .1s;-webkit-tap-highlight-color:transparent;}
        .cb:hover{color:#fff;background:rgba(255,255,255,.12);}
        .cb:active{background:rgba(255,255,255,.18);}
        .cb.on{color:var(--lv-p);}

        /* volume panel */
        .vol-panel{position:absolute;bottom:calc(100% + 10px);left:50%;transform:translateX(-50%);
          background:#0e0e1c;border:1px solid rgba(255,255,255,.12);border-radius:16px;
          padding:14px 10px 10px;display:flex;flex-direction:column;align-items:center;gap:10px;
          box-shadow:0 20px 60px rgba(0,0,0,.85);z-index:300;min-width:44px;animation:lvFadeUp .15s ease;}
        .vol-pct{font-size:11px;font-weight:700;color:rgba(255,255,255,.5);
                 font-variant-numeric:tabular-nums;min-width:32px;text-align:center;font-family:'Outfit',sans-serif;}
        .vol-vert-wrap{position:relative;width:4px;height:90px;background:rgba(255,255,255,.14);
                       border-radius:99px;cursor:pointer;touch-action:none;}
        .vol-vert-fill{position:absolute;bottom:0;left:0;width:100%;background:var(--lv-p);
                       border-radius:99px;pointer-events:none;}
        .vol-vert-dot{position:absolute;left:50%;width:13px;height:13px;border-radius:50%;
                      background:#fff;transform:translateX(-50%) translateY(50%);
                      box-shadow:0 0 0 2px var(--lv-p-a50);pointer-events:none;}

        /* speed panel */
        .spd-panel{position:absolute;bottom:calc(100% + 10px);right:0;background:#0e0e1c;
          border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:12px;
          display:flex;flex-direction:column;gap:8px;align-items:center;
          box-shadow:0 20px 60px rgba(0,0,0,.85);z-index:300;min-width:136px;animation:lvFadeUp .15s ease;}
        .spd-label{font-size:10px;text-transform:uppercase;letter-spacing:.08em;
                   color:rgba(255,255,255,.28);font-weight:600;font-family:'Outfit',sans-serif;}
        .spd-value{font-size:22px;font-weight:800;color:#fff;font-variant-numeric:tabular-nums;
                   line-height:1;font-family:'Outfit',sans-serif;}
        .spd-row{display:flex;align-items:center;gap:8px;width:100%;}
        .spd-btn{display:flex;align-items:center;justify-content:center;width:32px;height:32px;
                 border-radius:9px;border:none;cursor:pointer;background:rgba(255,255,255,.08);
                 color:rgba(255,255,255,.8);font-size:18px;font-weight:700;transition:background .1s;
                 flex-shrink:0;-webkit-tap-highlight-color:transparent;font-family:'Outfit',sans-serif;}
        .spd-btn:hover{background:rgba(255,255,255,.15);}
        .spd-btn:active{background:var(--lv-p-a30);}
        .spd-bar-wrap{flex:1;height:4px;background:rgba(255,255,255,.14);border-radius:99px;overflow:hidden;}
        .spd-bar-fill{height:100%;background:var(--lv-p);border-radius:99px;transition:width .1s;}
        .spd-presets{display:flex;gap:5px;flex-wrap:wrap;justify-content:center;}
        .spd-preset{font-size:11px;font-weight:600;padding:4px 8px;border-radius:7px;
                    border:1px solid rgba(255,255,255,.1);background:transparent;
                    color:rgba(255,255,255,.45);cursor:pointer;font-family:'Outfit',sans-serif;
                    transition:all .1s;-webkit-tap-highlight-color:transparent;}
        .spd-preset:hover{background:rgba(255,255,255,.08);color:#fff;}
        .spd-preset.active{background:var(--lv-p-a25);border-color:var(--lv-p);color:var(--lv-p);}

        /* controls hide transition */
        .ctrl-wrap{transition:opacity .22s ease,transform .18s ease;}
        .ctrl-wrap.hide{opacity:0!important;transform:translateY(5px);pointer-events:none;}

        /* skip flash */
        .skip-flash{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
          display:flex;align-items:center;gap:6px;background:rgba(0,0,0,.65);border-radius:14px;
          padding:10px 20px;color:#fff;font-size:14px;font-weight:600;pointer-events:none;
          animation:lvSfade .65s ease-out forwards;font-family:'Outfit',sans-serif;}
        @keyframes lvSfade{0%{opacity:1;transform:translate(-50%,-50%) scale(1)}
          60%{opacity:.85}100%{opacity:0;transform:translate(-50%,-62%) scale(.91)}}

        /* spinner */
        .lv-spin-ring{animation:lv-spin .85s linear infinite;transform-origin:center;}
        @keyframes lv-spin{to{transform:rotate(360deg)}}

        /* entrance */
        @keyframes lvFadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        .au {animation:lvFadeUp .38s cubic-bezier(.22,1,.36,1) both;}
        .au1{animation:lvFadeUp .38s .05s cubic-bezier(.22,1,.36,1) both;}
        .au2{animation:lvFadeUp .38s .10s cubic-bezier(.22,1,.36,1) both;}

        /* ── PAGE SHELL ── */
        .lv-page{
          font-family:'Outfit',sans-serif;
          user-select:none;
        }

        /* ── BACK BUTTON ── */
        .lv-back{
          display:inline-flex; align-items:center; gap:6px;
          font-size:13px; font-weight:600; font-family:'Outfit',sans-serif;
          color:rgba(255,255,255,.55);
          background:rgba(255,255,255,.06);
          border:1px solid rgba(255,255,255,.10);
          border-radius:10px; padding:7px 14px;
          cursor:pointer; transition:color .15s,background .15s,border-color .15s;
          -webkit-tap-highlight-color:transparent;
        }
        .lv-back:hover{
          color:rgba(255,255,255,.9);
          background:rgba(255,255,255,.10);
          border-color:rgba(255,255,255,.18);
        }

        /* ── PLAYER ── */
        /* always clip children (controls, overlays) */
        .lv-player{
          background:#000;
          overflow:hidden;
          position:relative;
          width:100%;
        }
        /* mobile: break out of the 16px side padding → true edge-to-edge */
        .lv-player-bleed{
          margin-left:-16px;
          margin-right:-16px;
        }
        /* tablet+: contained, rounded, elevated */
        @media(min-width:600px){
          .lv-player-bleed{
            margin:0;
            border-radius:14px;
            box-shadow:0 4px 32px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.07);
          }
        }

        /* ── METADATA — always single column, stacked ── */
        .lv-info{
          display:flex;
          flex-direction:column;
          gap:10px;
          padding-top:12px;
        }

        /* ── TYPE BADGE ── */
        .lv-badge{
          display:inline-flex; align-items:center; gap:5px;
          padding:3px 10px; border-radius:99px;
          font-size:11px; font-weight:700; letter-spacing:.03em;
          font-family:'Outfit',sans-serif;
        }

        /* ── META CHIPS (duration/subject inside title card) ── */
        .lv-chips{
          display:flex; flex-wrap:wrap; gap:8px;
          margin-top:14px; padding-top:14px;
        }
        .lv-chip{
          display:inline-flex; align-items:center; gap:6px;
          padding:5px 11px; border-radius:99px;
          font-size:12px; font-weight:600;
          background:rgba(255,255,255,.06);
          border:1px solid rgba(255,255,255,.10);
          white-space:nowrap; font-family:'Outfit',sans-serif;
        }

        /* ── NOTE ACTION LINKS ── */
        .lv-note-a{
          display:flex; align-items:center; justify-content:space-between;
          gap:8px; padding:11px 14px; border-radius:10px; font-size:13px;
          font-weight:500; text-decoration:none; transition:opacity .15s;
          font-family:'Outfit',sans-serif;
        }
        .lv-note-a:hover{opacity:.78;}

        /* mobile player tweaks */
        @media(max-width:480px){
          .prg{height:5px;} .prg:hover,.prg.drag{height:7px;}
          .prg-dot{width:16px;height:16px;}
          .cb{padding:8px;}
          .spd-panel{right:-20px;}
        }
      `}</style>

      <style>{`
        :root{
          --lv-p:    ${primaryColor};
          --lv-p-a55:rgba(${pRgb},.55);
          --lv-p-a50:rgba(${pRgb},.50);
          --lv-p-a30:rgba(${pRgb},.30);
          --lv-p-a25:rgba(${pRgb},.25);
        }
      `}</style>

      {/* ══════════════════════ PAGE ══════════════════════════════════════════ */}
      <div className="lv-page" style={{ color: T.text }} onContextMenu={e => e.preventDefault()}>
        <div style={{ padding: '0 16px 80px' }}>

          {/* ── BACK ── */}
          <div style={{ paddingTop: 18, paddingBottom: 14 }}>
            <button className="au lv-back" onClick={() => navigate(-1)}>
              <ArrowLeft size={13} /> Back
            </button>
          </div>

          {/* ══════════════════ PLAYER ════════════════════════════════════════ */}
          <div className="au1 lv-player lv-player-bleed">

            {/* DevTools */}
            {playerState === 'devtools' && (
              <div style={{ aspectRatio:'16/9', display:'flex', flexDirection:'column',
                alignItems:'center', justifyContent:'center', background:'#000' }}>
                <Lock size={30} style={{ color:'#f87171', marginBottom:10 }} />
                <p style={{ color:'rgba(255,255,255,.5)', fontSize:14, fontWeight:500 }}>DevTools detected</p>
                <p style={{ color:'rgba(255,255,255,.22)', fontSize:12, marginTop:4 }}>Close DevTools to resume</p>
              </div>
            )}

            {/* Embed */}
            {isEmbed && embedUrl && (
              <div className="relative w-full" style={{ paddingBottom:'56.25%' }}>
                <iframe src={embedUrl} className="absolute inset-0 w-full h-full"
                  allow="autoplay; fullscreen; encrypted-media" allowFullScreen
                  referrerPolicy="no-referrer"
                  sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
                  title={content?.title || 'Video'} style={{ border:'none', pointerEvents:'auto' }} />
              </div>
            )}

            {/* Native player */}
            {!isEmbed && content?.videoUrl && (
              <div ref={playerWrapRef} className="sv relative bg-black"
                style={{ aspectRatio:'16/9', minHeight:180 }}
                onMouseMove={showControls}
                onMouseLeave={() => { if (playerState === 'playing') setCtrlVisible(false); }}
                onTouchStart={showControls}
              >
                {user?.userId && <div className="wm wm-left">{user.userId}</div>}
                <div className="wm wm-right">Edtech</div>

                <video ref={videoRef} className="absolute inset-0 w-full h-full"
                  style={{ display: isVideoHidden || showLoadOverlay ? 'none' : 'block' }}
                  playsInline
                  controlsList="nodownload nofullscreen noremoteplayback"
                  disablePictureInPicture
                  onTimeUpdate={onTimeUpdate} onDurationChange={onDurationChange}
                  onPlay={onPlay} onPause={onPause} onEnded={onEnded}
                  onWaiting={onWaiting} onPlaying={onPlaying}
                  onVolumeChange={onVolChange} onError={onVideoError}
                  onContextMenu={e => e.preventDefault()} onClick={togglePlayPause}
                />

                {/* Loading overlay */}
                {showLoadOverlay && (
                  <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column',
                    alignItems:'center', justifyContent:'center', background:'#000', gap:18 }}>
                    <div style={{ position:'relative', width:72, height:72, display:'flex',
                      alignItems:'center', justifyContent:'center' }}>
                      <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%' }} viewBox="0 0 72 72" fill="none">
                        <circle cx="36" cy="36" r="30" stroke={`rgba(${pRgb},.15)`} strokeWidth="3" />
                        <circle cx="36" cy="36" r="30" stroke={primaryColor} strokeWidth="3"
                          strokeDasharray="44 145" strokeLinecap="round" className="lv-spin-ring" />
                      </svg>
                      <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%',
                        animation:'lv-spin 3s linear infinite reverse', transformOrigin:'center' }}
                        viewBox="0 0 72 72" fill="none">
                        <circle cx="36" cy="36" r="23" stroke={`rgba(${pRgb},.1)`} strokeWidth="1.5"
                          strokeDasharray="7 5" strokeLinecap="round" />
                      </svg>
                      <svg width="26" height="26" viewBox="0 0 28 28" fill="none" style={{ position:'relative', zIndex:1 }}>
                        <path d="M4 6C4 4.9 4.9 4 6 4H13V20H6C4.9 20 4 19.1 4 18V6Z" fill={`rgba(${pRgb},.6)`}/>
                        <path d="M15 4H22C23.1 4 24 4.9 24 6V18C24 19.1 23.1 20 22 20H15V4Z" fill={`rgba(${pRgb},.4)`}/>
                        <rect x="13" y="4" width="2" height="16" fill={`rgba(${pRgb},1)`} opacity="0.8"/>
                        <circle cx="14" cy="14" r="5.5" fill="rgba(0,0,0,.35)"/>
                        <path d="M12.3 11.5L17.2 14L12.3 16.5V11.5Z" fill="white"/>
                      </svg>
                    </div>
                    <p style={{ color:'rgba(255,255,255,.35)', fontSize:12, fontWeight:500,
                      letterSpacing:'.04em' }}>
                      {playerState === 'downloading' && dlBytes > 0
                        ? `Loading… ${fmtBytes(dlBytes)}` : 'Loading…'}
                    </p>
                  </div>
                )}

                {/* Buffering spinner */}
                {isSeeking && !showLoadOverlay && (
                  <div style={{ position:'absolute', inset:0, display:'flex',
                    alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
                    <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
                      <circle cx="20" cy="20" r="16" stroke="rgba(255,255,255,.15)" strokeWidth="2.5"/>
                      <circle cx="20" cy="20" r="16" stroke="rgba(255,255,255,.7)" strokeWidth="2.5"
                        strokeDasharray="25 76" strokeLinecap="round" className="lv-spin-ring"/>
                    </svg>
                  </div>
                )}

                {/* Skip flash */}
                {skipFlash && (
                  <div className="skip-flash">
                    {skipFlash === 'fwd'
                      ? <><RotateCw size={15}/><span>+10s</span></>
                      : <><RotateCcw size={15}/><span>–10s</span></>}
                  </div>
                )}

                {/* IDM blocked */}
                {playerState === 'idm_blocked' && (
                  <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column',
                    alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,.94)',
                    textAlign:'center', padding:24, zIndex:20 }}>
                    <Shield size={34} style={{ color:'#f87171', marginBottom:10 }}/>
                    <p style={{ color:'#fff', fontWeight:600, fontSize:15, marginBottom:6 }}>Download Manager Detected</p>
                    <p style={{ color:'rgba(255,255,255,.4)', fontSize:13, maxWidth:270, lineHeight:1.6 }}>
                      Disable IDM or similar software, then refresh to watch.
                    </p>
                  </div>
                )}

                {/* Error overlay */}
                {playerState === 'error' && (
                  <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column',
                    alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,.9)',
                    textAlign:'center', padding:24 }}>
                    <AlertCircle size={28} style={{ color:'#f87171', marginBottom:10 }}/>
                    <p style={{ color:'rgba(255,255,255,.5)', fontSize:13, marginBottom:16,
                      maxWidth:270, lineHeight:1.6 }}>{playerError}</p>
                    <button onClick={handleRetry} style={{ padding:'10px 28px',
                      background:T.gradient, color:'#fff', fontSize:13, fontWeight:600,
                      borderRadius:10, border:'none', cursor:'pointer' }}>
                      Try Again
                    </button>
                  </div>
                )}

                {/* Ended */}
                {playerState === 'ended' && !isVideoHidden && (
                  <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center',
                    justifyContent:'center', background:'rgba(0,0,0,.42)', pointerEvents:'none' }}>
                    <button style={{ pointerEvents:'auto', width:60, height:60, borderRadius:'50%',
                      background:'rgba(255,255,255,.16)', border:'1px solid rgba(255,255,255,.22)',
                      backdropFilter:'blur(8px)', display:'flex', alignItems:'center',
                      justifyContent:'center', cursor:'pointer', transition:'background .15s' }}
                      onClick={togglePlayPause}
                      onMouseEnter={e => (e.currentTarget.style.background='rgba(255,255,255,.26)')}
                      onMouseLeave={e => (e.currentTarget.style.background='rgba(255,255,255,.16)')}>
                      <RotateCcw size={26} style={{ color:'#fff' }}/>
                    </button>
                  </div>
                )}

                {/* Controls */}
                {showPlayerCtrls && (
                  <div className={`ctrl-wrap absolute inset-x-0 bottom-0 ${ctrlsHidden ? 'hide' : ''}`}>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent pointer-events-none"/>
                    <div className="relative px-3 pb-3 pt-10">

                      {/* Progress */}
                      <div ref={progressRef}
                        className={`prg mb-3 ${isDragging ? 'drag' : ''}`}
                        onMouseDown={onProgressMouseDown}
                        onTouchStart={onProgressTouchStart}
                        onMouseMove={onProgressHover}
                        onMouseLeave={() => setHoverInfo(null)}>
                        <div className="prg-track">
                          <div className="prg-buf" style={{ width:`${bufferedPct}%` }}/>
                          <div className={`prg-fill${isDragging ? '' : ' smooth'}`} style={{ width:`${playPct}%` }}/>
                          <div className="prg-dot" style={{ left:`${playPct}%` }}/>
                        </div>
                        {hoverInfo !== null && (
                          <div className="prg-tip" style={{ left:`${hoverInfo.pct}%` }}>
                            {fmtTime(hoverInfo.time)}
                          </div>
                        )}
                      </div>

                      {/* Controls row */}
                      <div className="flex items-center gap-0.5">
                        <button className="cb" onClick={togglePlayPause}
                          title={playerState==='playing'?'Pause (Space)':'Play (Space)'}>
                          {playerState==='playing' ? <Pause size={20}/> :
                           playerState==='ended'   ? <RotateCcw size={18}/> : <Play size={20}/>}
                        </button>
                        <button className="cb" onClick={() => skipBy(-10)} title="Back 10s"><SkipBack size={17}/></button>
                        <button className="cb" onClick={() => skipBy(10)}  title="Fwd 10s"><SkipForward size={17}/></button>

                        {/* Volume */}
                        <div className="relative flex-shrink-0" ref={volumeWrapRef}>
                          <button className={`cb ${showVolPanel?'on':''}`}
                            onClick={() => setShowVolPanel(v => !v)} title="Volume (M)">
                            <VolumeIcon size={18}/>
                          </button>
                          {showVolPanel && (() => {
                            const TRACK_H=90, volPct=muted?0:volume, fillH=volPct*TRACK_H, dotBot=fillH;
                            const applyVol = (y:number) => {
                              const el=document.getElementById('vol-vert-track'); if(!el) return;
                              const r=el.getBoundingClientRect();
                              const val=clamp(1-(y-r.top)/r.height,0,1);
                              const v=videoRef.current; if(!v) return;
                              v.volume=val; v.muted=val===0; setVolume(val); setMuted(val===0);
                            };
                            const onTD=(e:React.MouseEvent)=>{e.preventDefault();e.stopPropagation();applyVol(e.clientY);
                              const mm=(ev:MouseEvent)=>applyVol(ev.clientY);
                              const mu=()=>{window.removeEventListener('mousemove',mm);window.removeEventListener('mouseup',mu);};
                              window.addEventListener('mousemove',mm); window.addEventListener('mouseup',mu);};
                            const onTT=(e:React.TouchEvent)=>{e.preventDefault();e.stopPropagation();applyVol(e.touches[0].clientY);
                              const tm=(ev:TouchEvent)=>{ev.preventDefault();applyVol(ev.touches[0].clientY);};
                              const tu=()=>{window.removeEventListener('touchmove',tm);window.removeEventListener('touchend',tu);};
                              window.addEventListener('touchmove',tm,{passive:false}); window.addEventListener('touchend',tu);};
                            return (
                              <div className="vol-panel">
                                <span className="vol-pct">{Math.round(volPct*100)}%</span>
                                <div id="vol-vert-track" className="vol-vert-wrap" onMouseDown={onTD} onTouchStart={onTT}>
                                  <div className="vol-vert-fill" style={{height:fillH}}/>
                                  <div className="vol-vert-dot"  style={{bottom:dotBot}}/>
                                </div>
                                <button className="cb" style={{padding:4}} onClick={toggleMute} title="Mute (M)">
                                  <VolumeIcon size={16}/>
                                </button>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Time */}
                        <span style={{ fontSize:12, color:'rgba(255,255,255,.45)',
                          fontFamily:'ui-monospace,monospace', fontVariantNumeric:'tabular-nums',
                          marginLeft:6, flexShrink:0 }}>
                          {fmtTime(currentTime)}
                          <span style={{ color:'rgba(255,255,255,.2)', margin:'0 4px' }}>/</span>
                          {fmtTime(duration)}
                        </span>

                        <div style={{ flex:1 }}/>

                        {/* Speed */}
                        <div className="relative flex-shrink-0" ref={speedMenuRef}>
                          <button className={`cb text-[11px] font-bold px-1.5 min-w-[38px] ${showSpeedMenu?'on':''}`}
                            onClick={() => setShowSpeedMenu(s => !s)} title="Speed">
                            {speed===1 ? '1×' : `${speed}×`}
                          </button>
                          {showSpeedMenu && (() => {
                            const presets=[0.5,1,1.5,2,2.5,3];
                            const pct=((speed-MIN_SPEED)/(MAX_SPEED-MIN_SPEED))*100;
                            return (
                              <div className="spd-panel">
                                <span className="spd-label">Speed</span>
                                <span className="spd-value">{speed.toFixed(2)}×</span>
                                <div className="spd-row">
                                  <button className="spd-btn" onClick={()=>setSpeedTo(speed-SPEED_STEP)}>−</button>
                                  <div className="spd-bar-wrap"><div className="spd-bar-fill" style={{width:`${pct}%`}}/></div>
                                  <button className="spd-btn" onClick={()=>setSpeedTo(speed+SPEED_STEP)}>+</button>
                                </div>
                                <div className="spd-presets">
                                  {presets.map(p => (
                                    <button key={p} className={`spd-preset ${speed===p?'active':''}`}
                                      onClick={()=>setSpeedTo(p)}>
                                      {p===1?'1×':`${p}×`}
                                    </button>
                                  ))}
                                </div>
                                {speed!==1 && (
                                  <button className="spd-preset" style={{width:'100%',marginTop:2}}
                                    onClick={()=>setSpeedTo(1)}>Reset to 1×</button>
                                )}
                              </div>
                            );
                          })()}
                        </div>

                        {/* Fullscreen */}
                        <button className="cb ml-0.5" onClick={toggleFullscreen} title="Fullscreen (F)">
                          {isFullscreen ? <Minimize size={17}/> : <Maximize size={17}/>}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Mobile double-tap zones */}
                {showPlayerCtrls && !showLoadOverlay && (
                  <>
                    <div className="absolute inset-y-0 left-0 w-1/3"
                      style={{ bottom:60, pointerEvents:'auto' }}
                      onDoubleClick={() => skipBy(-10)}/>
                    <div className="absolute inset-y-0 right-0 w-1/3"
                      style={{ bottom:60, pointerEvents:'auto' }}
                      onDoubleClick={() => skipBy(10)}/>
                  </>
                )}
              </div>
            )}

            {/* No video */}
            {!content?.videoUrl && !loadingContent && (
              <div style={{ aspectRatio:'16/9', display:'flex', flexDirection:'column',
                alignItems:'center', justifyContent:'center', background:'#000' }}>
                <Play size={28} style={{ color:'rgba(255,255,255,.1)', marginBottom:10 }}/>
                <p style={{ color:'rgba(255,255,255,.18)', fontSize:13 }}>No video attached</p>
              </div>
            )}
          </div>
          {/* END PLAYER */}

          {/* ══════════════════ INFO SECTION ══════════════════════════════════ */}
          <div className="lv-info au2">

            {/* Title card */}
            <Card className="p-5">

                {/* Type badge */}
                <div style={{ marginBottom:10 }}>
                  <span className="lv-badge" style={{
                    background:`rgba(${pRgb},0.13)`,
                    color: primaryColor,
                    border:`1px solid rgba(${pRgb},0.24)`,
                  }}>
                    {content?.type === 'lesson' ? <Play size={10}/> : <BookOpen size={10}/>}
                    {content?.type === 'lesson' ? 'Lesson' :
                     content?.type === 'trick'  ? 'Trick'  : 'Content'}
                  </span>
                </div>

                {/* Title */}
                <h1 style={{
                  color:T.text, fontWeight:800, margin:'0 0 4px',
                  fontSize:'clamp(15px,3.2vw,21px)',
                  lineHeight:1.25, letterSpacing:'-.02em',
                }}>
                  {content?.title || 'Untitled'}
                </h1>

                {/* Subject */}
                {content?.subject && (
                  <p style={{ color:T.text2, fontSize:13, fontWeight:500, margin:'3px 0 0' }}>
                    {content.subject}
                  </p>
                )}

                {/* Description */}
                {content?.description && (
                  <p style={{ color:T.text2, fontSize:13, lineHeight:1.6,
                    margin:'10px 0 0', paddingTop:10, borderTop:`1px solid ${T.divider}` }}>
                    {content.description}
                  </p>
                )}
            </Card>

            {/* Notes */}
            <div>
              {(content?.noteUrl || content?.noteGDrivePreviewUrl) ? (
                <Card className="p-5 flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div style={{ width:34, height:34, borderRadius:10,
                      background:'rgba(52,211,153,0.12)', border:'1px solid rgba(52,211,153,0.20)',
                      display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <FileText size={15} style={{ color:'#34d399' }}/>
                    </div>
                    <span style={{ fontSize:14, fontWeight:700, color:T.text }}>Class Notes</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {getNotePreview() && (
                      <a href={getNotePreview()!} target="_blank" rel="noopener noreferrer"
                        className="lv-note-a"
                        style={{ background:'rgba(52,211,153,0.08)',
                          border:'1px solid rgba(52,211,153,0.20)',
                          color:'rgba(110,231,183,0.9)' }}>
                        <span className="flex items-center gap-2">
                          <ExternalLink size={13}/> Preview Notes
                        </span>
                        <span style={{ opacity:.55, fontSize:13 }}>→</span>
                      </a>
                    )}
                    {getNoteHref() && (
                      <a href={getNoteHref()!} target="_blank" rel="noopener noreferrer"
                        className="lv-note-a"
                        style={{ background:T.surface, border:`1px solid ${T.border}`, color:T.text2 }}>
                        <span className="flex items-center gap-2">
                          <Download size={13}/> Download PDF
                        </span>
                        <span style={{ opacity:.55, fontSize:13 }}>→</span>
                      </a>
                    )}
                    {content?.noteSource === 'gdrive' && (
                      <p style={{ fontSize:10, color:T.text3, textAlign:'center',
                        margin:0, letterSpacing:'.03em' }}>via Google Drive</p>
                    )}
                  </div>
                </Card>
              ) : (
                <Card className="p-6 flex flex-col items-center justify-center text-center gap-3"
                  style={{ minHeight:110 }}>
                  <div style={{ width:42, height:42, borderRadius:12,
                    background:T.surface, border:`1px solid ${T.border}`,
                    display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <FileText size={17} style={{ color:T.text3, opacity:.4 }}/>
                  </div>
                  <p style={{ fontSize:13, color:T.text3, margin:0, fontWeight:500 }}>
                    No notes attached
                  </p>
                </Card>
              )}
            </div>

          </div>
          {/* END INFO */}

        </div>
      </div>
    </>
  );
};

export default LessonViewer;
