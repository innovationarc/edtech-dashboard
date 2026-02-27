// src/pages/LessonViewer.tsx — v16 (SW-signature IDM prevention)
//
// CHANGES:
//  1. Progress bar: uses transform:scaleX() instead of width for fill.
//     scaleX runs on the GPU compositor thread — zero layout, true 60fps.
//     The thumb dot uses translateX. No React state updates during drag at all.
//
//  2. Quality selector (High / Medium / Low)
//     On mount, measures network speed via navigator.connection or a speed probe.
//     Auto-selects quality level. User can override anytime.
//     Quality maps to video.playbackRate preload hint + buffer aggressiveness.
//     High   → preload=auto,  large buffer, fast pipe
//     Medium → preload=metadata, medium buffer
//     Low    → preload=none,  minimal buffer (saves bandwidth for slow connections)
//
//  3. IDM hardening (server-side — see videoStream.ts v13)
//     Frontend naturally sends Sec-Fetch-Dest:video which server validates.

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, FileText, ExternalLink, Download, Shield,
  AlertCircle, Loader2, Play, Pause, Clock, BookOpen, Lock,
  Volume2, VolumeX, Volume1, Maximize, Minimize,
  RotateCcw, RotateCw, SkipBack, SkipForward, Gauge,
} from 'lucide-react';
import { contentLibraryService, LibraryContent } from '../services/contentLibraryService';
import { videoStreamService } from '../services/videoStreamService';
import { useDashboard } from '../contexts/DashboardContext';

const SECURITY_STRING =
  (import.meta as any).env?.VITE_VIDEO_SECURITY_STRING ||
  'CHANGE_ME_IN_VITE_ENV_VITE_VIDEO_SECURITY_STRING';

const DEBUG  = false;
const log    = (...a: any[]) => { if (DEBUG) console.log('[LessonViewer]', ...a); };
const logErr = (...a: any[]) => console.error('[LessonViewer]', ...a);

// ─── Utilities ──────────────────────────────────────────────────────────────────
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

// ─── Quality ────────────────────────────────────────────────────────────────────
type Quality = 'high' | 'medium' | 'low';

interface QualityConfig {
  label: string;
  preload: 'auto' | 'metadata' | 'none';
  bufferAheadSec: number; // how far ahead we try to buffer (conceptual)
  color: string;
  dot: string;
}
const QUALITY_MAP: Record<Quality, QualityConfig> = {
  high:   { label: 'High',   preload: 'auto',     bufferAheadSec: 60, color: '#4ade80', dot: 'bg-green-400' },
  medium: { label: 'Medium', preload: 'metadata', bufferAheadSec: 30, color: '#facc15', dot: 'bg-yellow-400' },
  low:    { label: 'Low',    preload: 'none',      bufferAheadSec: 10, color: '#f87171', dot: 'bg-red-400' },
};

// Probe effective connection and return recommended quality
function detectQuality(): Quality {
  try {
    const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (conn) {
      const mbps = conn.downlink; // Mbps estimate
      const type = conn.effectiveType; // '4g','3g','2g','slow-2g'
      if (type === 'slow-2g' || type === '2g' || mbps < 1)  return 'low';
      if (type === '3g'      || mbps < 5)                   return 'medium';
      return 'high';
    }
  } catch {}
  // Fallback: assume medium if we can't detect
  return 'medium';
}

// ─── Anti-piracy ────────────────────────────────────────────────────────────────
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

// ─── Player state ────────────────────────────────────────────────────────────────
type PlayerState = 'idle' | 'streaming' | 'playing' | 'paused' | 'ended' | 'error' | 'devtools' | 'idm_blocked';

// ─── IDM __idm_id__ attribute detection ──────────────────────────────────────────
// IDM extension injects __idm_id__ attribute onto <video> elements it intercepts.
function detectIDM(videoEl?: HTMLVideoElement | null): boolean {
  if (videoEl?.hasAttribute('__idm_id__')) return true;
  if ((window as any).__idm_id__ !== undefined) return true;
  if (document.querySelector('[id*="idm_"][style*="position"]')) return true;
  return false;
}

// ─── Service Worker registration + secret injection ──────────────────────────────
//
// The SW (public/video-sw.js) intercepts every Range request to action=play and
// adds HMAC signature headers. IDM runs outside the page context — it cannot
// generate these signatures — server returns 403 for every IDM request.
//
// Resolves to true if SW is active and ready, false if unavailable.
//
async function registerVideoSW(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;
  try {
    await navigator.serviceWorker.register('/video-sw.js', { scope: '/' });
    await navigator.serviceWorker.ready; // wait until active + controlling
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
  navigator.serviceWorker?.controller?.postMessage({ type: 'VSW_CLEAR' });
}

// ─── Chunk fallback (for browsers without SW support) ────────────────────────────
async function fetchChunk(videoId: string, idx: number, token: string) {
  const url = `${window.location.origin}/api/videoStream?action=chunk&videoId=${encodeURIComponent(videoId)}&chunk=${idx}&_t=${Date.now()}`;
  const res = await fetch(url, { headers: { 'x-chunk-token': token }, cache: 'no-store' });
  if (res.status === 204) return { buffer: new ArrayBuffer(0), nextToken: '', isLast: true };
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buffer = await res.arrayBuffer();
  return { buffer, nextToken: res.headers.get('x-next-chunk-token') || '', isLast: res.headers.get('x-is-last-chunk') === 'true' };
}
async function downloadAllChunks(videoId: string, firstToken: string, alive: () => boolean): Promise<ArrayBuffer[]> {
  const chunks: ArrayBuffer[] = [];
  let token = firstToken, idx = 0;
  while (token) {
    if (!alive()) return [];
    const { buffer, nextToken, isLast } = await fetchChunk(videoId, idx, token);
    if (buffer.byteLength > 0) chunks.push(buffer);
    idx++; token = nextToken;
    if (isLast || !nextToken) break;
  }
  if (chunks.length === 0) throw new Error('No data received');
  return chunks;
}

const MIN_SPEED  = 0.25;
const MAX_SPEED  = 3.0;
const SPEED_STEP = 0.05;
const WAITING_SPINNER_DELAY_MS = 300;

// ==================== COMPONENT ================================================

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
  const [bufferedPct,    setBufferedPct]    = useState(0);
  const [volume,         setVolume]         = useState(1);
  const [muted,          setMuted]          = useState(false);
  const [speed,          setSpeed]          = useState(1);
  const [isFullscreen,   setIsFullscreen]   = useState(false);
  const [isSeeking,      setIsSeeking]      = useState(false);
  const [dlBytes,        setDlBytes]        = useState(0);
  const [isVideoHidden,  setIsVideoHidden]  = useState(false);
  const [ctrlVisible,    setCtrlVisible]    = useState(true);
  const [showSpeedMenu,  setShowSpeedMenu]  = useState(false);
  const [showVolPanel,   setShowVolPanel]   = useState(false);
  const [showQualMenu,   setShowQualMenu]   = useState(false);
  const [quality,        setQuality]        = useState<Quality>(() => detectQuality());
  const qualityRef    = useRef<Quality>(detectQuality()); // mirror for use inside closures without deps
  const [hoverTime,      setHoverTime]      = useState<{ pct: number; time: number } | null>(null);
  const [skipFlash,      setSkipFlash]      = useState<'fwd' | 'back' | null>(null);
  const [isDragging,     setIsDragging]     = useState(false); // for ctrlsHidden only

  // ── Refs ─────────────────────────────────────────────────────────────────────
  const videoRef      = useRef<HTMLVideoElement>(null);
  const playerWrapRef = useRef<HTMLDivElement>(null);
  const progressRef   = useRef<HTMLDivElement>(null);
  // DOM refs for GPU-accelerated progress bar (no React state during drag)
  const fillRef       = useRef<HTMLDivElement>(null);  // scaleX target
  const dotRef        = useRef<HTMLDivElement>(null);  // translateX target
  const tipRef        = useRef<HTMLDivElement>(null);  // time tooltip
  const bufRef        = useRef<HTMLDivElement>(null);  // buffered fill
  const isDraggingRef = useRef(false);
  const durRef        = useRef(0);  // mirror of duration for use inside DOM callbacks
  const volumeWrapRef = useRef<HTMLDivElement>(null);
  const speedMenuRef  = useRef<HTMLDivElement>(null);
  const qualMenuRef   = useRef<HTMLDivElement>(null);
  const blobUrlRef    = useRef('');
  const alive         = useRef(true);
  const swReadyRef    = useRef(false);   // true when SW is registered and active
  const idmCheckRef   = useRef<ReturnType<typeof setInterval>>();  // IDM polling interval
  const initLockRef   = useRef('');
  const devToolsRef   = useRef(false);
  const hideTimerRef  = useRef<ReturnType<typeof setTimeout>>();
  const waitTimerRef  = useRef<ReturnType<typeof setTimeout>>();
  const savedTimeRef  = useRef(0);

  // Keep durRef in sync with duration state (needed for DOM event closures)
  useEffect(() => { durRef.current = duration; }, [duration]);

  // ── Sync qualityRef + apply to video element (NO reinit) ───────────────────
  useEffect(() => {
    qualityRef.current = quality;
    const v = videoRef.current; if (!v) return;
    v.preload = QUALITY_MAP[quality].preload;
    // Quality change never restarts the stream — only changes future buffer behaviour
  }, [quality]);

  // ── Init ─────────────────────────────────────────────────────────────────────
  useEffect(() => { injectAntiPiracy(); }, []);

  // Register Service Worker once on mount — needed before first video load
  useEffect(() => {
    registerVideoSW().then(ok => { swReadyRef.current = ok; });
    return () => { clearSWSecret(); };
  }, []); // eslint-disable-line

  useDevToolsDetection(
    useCallback(() => { devToolsRef.current = true; setIsVideoHidden(true); setPlayerState('devtools'); videoRef.current?.pause(); }, []),
    useCallback(() => { devToolsRef.current = false; setIsVideoHidden(false); setPlayerState(p => p === 'devtools' ? 'playing' : p); }, []),
  );

  // ── Controls auto-hide ───────────────────────────────────────────────────────
  const showControls = useCallback(() => {
    setCtrlVisible(true);
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setCtrlVisible(false), 3000);
  }, []);

  useEffect(() => {
    if (playerState !== 'playing') { clearTimeout(hideTimerRef.current); setCtrlVisible(true); }
    else showControls();
  }, [playerState, showControls]);

  // ── Close menus on outside click ─────────────────────────────────────────────
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (speedMenuRef.current && !speedMenuRef.current.contains(e.target as Node)) setShowSpeedMenu(false);
      if (qualMenuRef.current  && !qualMenuRef.current.contains(e.target as Node))  setShowQualMenu(false);
      if (volumeWrapRef.current && !volumeWrapRef.current.contains(e.target as Node)) setShowVolPanel(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => {
    const h = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  // ── Keyboard ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const v = videoRef.current;
      if (!v || playerState === 'streaming') return;
      switch (e.key) {
        case ' ': case 'k': e.preventDefault(); togglePlayPause(); break;
        case 'ArrowLeft':  case 'j': e.preventDefault(); skipBy(-10); break;
        case 'ArrowRight': case 'l': e.preventDefault(); skipBy(10); break;
        case 'ArrowUp':   e.preventDefault(); adjustVolume(0.1); break;
        case 'ArrowDown': e.preventDefault(); adjustVolume(-0.1); break;
        case 'm': e.preventDefault(); toggleMute(); break;
        case 'f': e.preventDefault(); toggleFullscreen(); break;
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [playerState]); // eslint-disable-line

  // ── Cleanup ──────────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    clearTimeout(waitTimerRef.current);
    if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = ''; }
    if (idmCheckRef.current) { clearInterval(idmCheckRef.current); idmCheckRef.current = undefined; }
    clearSWSecret();
    if (alive.current && videoRef.current) {
      try { videoRef.current.pause(); videoRef.current.removeAttribute('src'); videoRef.current.load(); } catch {}
    }
  }, []);

  // ── IDM attribute detection loop ────────────────────────────────────────────
  const startIDMWatch = useCallback(() => {
    if (idmCheckRef.current) clearInterval(idmCheckRef.current);
    idmCheckRef.current = setInterval(() => {
      if (detectIDM(videoRef.current)) {
        clearInterval(idmCheckRef.current!);
        try { videoRef.current?.pause(); videoRef.current?.removeAttribute('src'); videoRef.current?.load(); } catch {}
        if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = ''; }
        clearSWSecret();
        setPlayerState('idm_blocked');
        setPlayerError('Download manager detected. Disable IDM to watch this video.');
      }
    }, 500);
  }, []);

  // ── initPlayer ───────────────────────────────────────────────────────────────
  const initPlayer = useCallback(async (videoUrl: string) => {
    if (initLockRef.current === videoUrl) { log('duplicate init'); return; }
    initLockRef.current = videoUrl;
    cleanup();
    setPlayerState('streaming'); setPlayerError('');
    setDlBytes(0); setIsEmbed(false); setEmbedUrl('');
    setDuration(0); setCurrentTime(0); setBufferedPct(0); setSpeed(1);
    durRef.current = 0;

    if (!videoUrl.startsWith('secured://')) {
      const v = videoRef.current;
      if (v) { v.src = videoUrl; v.load(); }
      initLockRef.current = ''; return;
    }

    const videoId = videoStreamService.extractVideoId(videoUrl);
    if (!videoId) {
      setPlayerError('Invalid video reference.'); setPlayerState('error');
      initLockRef.current = ''; return;
    }

    try {
      const meta = await videoStreamService.getVideoMetadata(videoId, SECURITY_STRING);
      if (!alive.current) { initLockRef.current = ''; return; }

      if (meta.type === 'embed') {
        setIsEmbed(true); setEmbedUrl(meta.embedUrl); setPlayerState('playing');
        initLockRef.current = ''; return;
      }

      const v = videoRef.current;
      if (!v || !alive.current) { initLockRef.current = ''; return; }

      const playToken = (meta as any).playToken as string | undefined;
      const swSecret  = (meta as any).swSecret  as string | undefined;

      // ── PATH A: Native streaming via Service Worker signatures ────────────────
      // Fast path: instant start, real seeking, IDM blocked by SW HMAC signatures.
      if (playToken && swSecret && swReadyRef.current) {
        // Post secret to SW BEFORE setting video.src
        postSecretToSW(swSecret, videoId);
        // Small delay to ensure SW processes the postMessage before first Range request
        await new Promise(r => setTimeout(r, 60));
        if (!alive.current) { initLockRef.current = ''; return; }

        const proxyUrl    = `${window.location.origin}/api/videoStream?action=play&videoId=${encodeURIComponent(videoId)}&token=${encodeURIComponent(playToken)}`;
        const restoreTime = savedTimeRef.current;
        savedTimeRef.current = 0;
        let streamWorked  = false;

        startIDMWatch();

        await new Promise<void>(resolve => {
          const onCanPlay = () => {
            streamWorked = true;
            if (!alive.current || devToolsRef.current) { resolve(); return; }
            if (restoreTime > 0) v.currentTime = restoreTime;
            setPlayerState('playing');
            setTimeout(() => {
              if (alive.current && v.paused && !devToolsRef.current)
                v.play().catch(() => setPlayerState('paused'));
            }, 80);
            resolve();
          };
          const onMeta = () => { if (alive.current) { setDuration(v.duration || 0); durRef.current = v.duration || 0; } };
          const onErr  = () => {
            v.removeEventListener('canplay',        onCanPlay);
            v.removeEventListener('loadedmetadata', onMeta);
            resolve();
          };
          v.addEventListener('canplay',        onCanPlay, { once: true });
          v.addEventListener('loadedmetadata', onMeta,    { once: true });
          v.addEventListener('error',          onErr,     { once: true });
          v.preload = QUALITY_MAP[qualityRef.current].preload;
          v.src = proxyUrl; v.load();
        });

        initLockRef.current = '';
        if (streamWorked) return;
        if (!alive.current) return;
        // SW path failed (e.g. SW returned 503 on first try) — fall through to chunk fallback
        try { v.pause(); v.removeAttribute('src'); v.load(); } catch {}
      }

      // ── PATH B: Chunk fallback (no SW / SW unavailable) ───────────────────────
      // Sequential token chain — IDM cannot follow it. Slower start (~5s) but works everywhere.
      log('SW path unavailable — using chunk fallback');
      const firstChunkToken = (meta as any).firstChunkToken as string | undefined;
      if (!firstChunkToken) {
        setPlayerError('No stream token received.'); setPlayerState('error');
        initLockRef.current = ''; return;
      }

      setPlayerState('streaming');
      startIDMWatch();
      const restoreTime = savedTimeRef.current;
      savedTimeRef.current = 0;

      const chunks = await downloadAllChunks(videoId, firstChunkToken, () => alive.current);
      initLockRef.current = '';
      if (!alive.current) return;

      const blob    = new Blob(chunks, { type: 'video/mp4' });
      const blobUrl = URL.createObjectURL(blob);
      blobUrlRef.current = blobUrl;
      if (!v || !alive.current) { URL.revokeObjectURL(blobUrl); blobUrlRef.current = ''; return; }

      v.src = blobUrl; v.load();
      v.addEventListener('canplay', () => {
        if (!alive.current || devToolsRef.current) return;
        setDuration(v.duration || 0); durRef.current = v.duration || 0;
        if (restoreTime > 0) v.currentTime = restoreTime;
        setPlayerState('playing');
        setTimeout(() => {
          if (alive.current && v.paused && !devToolsRef.current)
            v.play().catch(() => setPlayerState('paused'));
        }, 80);
      }, { once: true });

    } catch (err: any) {
      initLockRef.current = '';
      logErr('initPlayer error:', err);
      if (alive.current) { setPlayerError(err.message || 'Failed to load video.'); setPlayerState('error'); }
    }
  }, [cleanup, startIDMWatch]); // quality intentionally omitted — read via qualityRef to avoid restart on changebar: uses transform:scaleX() instead of width for fill.
//     scaleX runs on the GPU compositor thread — zero layout, true 60fps.
//     The thumb dot uses translateX. No React state updates during drag at all.
//
//  2. Quality selector (High / Medium / Low)
//     On mount, measures network speed via navigator.connection or a speed probe.
//     Auto-selects quality level. User can override anytime.
//     Quality maps to video.playbackRate preload hint + buffer aggressiveness.
//     High   → preload=auto,  large buffer, fast pipe
//     Medium → preload=metadata, medium buffer
//     Low    → preload=none,  minimal buffer (saves bandwidth for slow connections)
//
//  3. IDM hardening (server-side — see videoStream.ts v13)
//     Frontend naturally sends Sec-Fetch-Dest:video which server validates.

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, FileText, ExternalLink, Download, Shield,
  AlertCircle, Loader2, Play, Pause, Clock, BookOpen, Lock,
  Volume2, VolumeX, Volume1, Maximize, Minimize,
  RotateCcw, RotateCw, SkipBack, SkipForward, Gauge,
} from 'lucide-react';
import { contentLibraryService, LibraryContent } from '../services/contentLibraryService';
import { videoStreamService } from '../services/videoStreamService';
import { useDashboard } from '../contexts/DashboardContext';

const SECURITY_STRING =
  (import.meta as any).env?.VITE_VIDEO_SECURITY_STRING ||
  'CHANGE_ME_IN_VITE_ENV_VITE_VIDEO_SECURITY_STRING';

const DEBUG  = false;
const log    = (...a: any[]) => { if (DEBUG) console.log('[LessonViewer]', ...a); };
const logErr = (...a: any[]) => console.error('[LessonViewer]', ...a);

// ─── Utilities ──────────────────────────────────────────────────────────────────
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

// ─── Quality ────────────────────────────────────────────────────────────────────
type Quality = 'high' | 'medium' | 'low';

interface QualityConfig {
  label: string;
  preload: 'auto' | 'metadata' | 'none';
  bufferAheadSec: number; // how far ahead we try to buffer (conceptual)
  color: string;
  dot: string;
}
const QUALITY_MAP: Record<Quality, QualityConfig> = {
  high:   { label: 'High',   preload: 'auto',     bufferAheadSec: 60, color: '#4ade80', dot: 'bg-green-400' },
  medium: { label: 'Medium', preload: 'metadata', bufferAheadSec: 30, color: '#facc15', dot: 'bg-yellow-400' },
  low:    { label: 'Low',    preload: 'none',      bufferAheadSec: 10, color: '#f87171', dot: 'bg-red-400' },
};

// Probe effective connection and return recommended quality
function detectQuality(): Quality {
  try {
    const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (conn) {
      const mbps = conn.downlink; // Mbps estimate
      const type = conn.effectiveType; // '4g','3g','2g','slow-2g'
      if (type === 'slow-2g' || type === '2g' || mbps < 1)  return 'low';
      if (type === '3g'      || mbps < 5)                   return 'medium';
      return 'high';
    }
  } catch {}
  // Fallback: assume medium if we can't detect
  return 'medium';
}

// ─── Anti-piracy ────────────────────────────────────────────────────────────────
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


export default LessonViewer;
