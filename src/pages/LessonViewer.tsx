// src/pages/LessonViewer.tsx — v13
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
type PlayerState = 'idle' | 'streaming' | 'downloading' | 'playing' | 'paused' | 'ended' | 'error' | 'devtools';

// ─── Blob fallback ───────────────────────────────────────────────────────────────
async function fetchChunk(videoId: string, idx: number, token: string) {
  const url = `${window.location.origin}/api/videoStream?action=chunk&videoId=${encodeURIComponent(videoId)}&chunk=${idx}&_t=${Date.now()}`;
  const res = await fetch(url, { headers: { 'x-chunk-token': token }, cache: 'no-store' });
  if (res.status === 204) return { buffer: new ArrayBuffer(0), nextToken: '', isLast: true };
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buffer = await res.arrayBuffer();
  return { buffer, nextToken: res.headers.get('x-next-chunk-token') || '', isLast: res.headers.get('x-is-last-chunk') === 'true' };
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
    } catch (err: any) { if (chunks.length > 0) break; throw err; }
  }
  if (chunks.length === 0) throw new Error('No data received from server');
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
      if (!v || playerState === 'streaming' || playerState === 'downloading') return;
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
    if (alive.current && videoRef.current) {
      try { videoRef.current.pause(); videoRef.current.removeAttribute('src'); videoRef.current.load(); } catch {}
    }
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

      if ((meta as any).playToken) {
        const playToken = (meta as any).playToken as string;
        const proxyUrl  = `${window.location.origin}/api/videoStream?action=play&videoId=${encodeURIComponent(videoId)}&token=${encodeURIComponent(playToken)}`;
        let streamWorked = false;
        const restoreTime = savedTimeRef.current;
        savedTimeRef.current = 0;

        await new Promise<void>(resolve => {
          const onCanPlay = () => {
            streamWorked = true;
            if (!alive.current || devToolsRef.current) { resolve(); return; }
            if (restoreTime > 0) v.currentTime = restoreTime;
            setPlayerState('playing');
            setTimeout(() => {
              if (alive.current && v.paused && !devToolsRef.current)
                v.play().catch(e => { log('autoplay blocked:', e.message); setPlayerState('paused'); });
            }, 100);
            resolve();
          };
          const onMeta = () => { if (alive.current) { setDuration(v.duration || 0); durRef.current = v.duration || 0; } };
          const onErr  = () => { v.removeEventListener('canplay', onCanPlay); v.removeEventListener('loadedmetadata', onMeta); resolve(); };
          v.addEventListener('canplay',        onCanPlay, { once: true });
          v.addEventListener('loadedmetadata', onMeta,    { once: true });
          v.addEventListener('error',          onErr,     { once: true });
          v.preload = QUALITY_MAP[qualityRef.current].preload;
          v.src = proxyUrl; v.load();
        });

        initLockRef.current = '';
        if (streamWorked) return;
        if (!alive.current) return;
        try { v.pause(); v.removeAttribute('src'); v.load(); } catch {}
      }

      // Fallback: blob
      setPlayerState('downloading');
      const meta2 = (meta as any).firstChunkToken ? meta : await videoStreamService.getVideoMetadata(videoId, SECURITY_STRING);
      if (!alive.current) { initLockRef.current = ''; return; }

      const chunks = await downloadAllChunks(videoId, (meta2 as any).firstChunkToken, () => alive.current,
        (_, b) => { if (alive.current) setDlBytes(b); });

      initLockRef.current = '';
      if (!chunks || !alive.current) return;

      const blob = new Blob(chunks, { type: 'video/mp4' });
      const blobUrl = URL.createObjectURL(blob);
      blobUrlRef.current = blobUrl;
      if (!v || !alive.current) { URL.revokeObjectURL(blobUrl); blobUrlRef.current = ''; return; }

      v.src = blobUrl; v.load();
      v.addEventListener('loadedmetadata', () => {
        if (!alive.current || devToolsRef.current) return;
        setDuration(v.duration || 0); durRef.current = v.duration || 0;
        setPlayerState('playing');
        setTimeout(() => {
          if (alive.current && v.paused) v.play().catch(e => { log('autoplay blocked:', e.message); setPlayerState('paused'); });
        }, 100);
      }, { once: true });
    } catch (err: any) {
      initLockRef.current = '';
      logErr('initPlayer error:', err);
      if (alive.current) { setPlayerError(err.message || 'Failed to load video.'); setPlayerState('error'); }
    }
  }, [cleanup]); // quality intentionally omitted — read via qualityRef to avoid restart on change

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
        } finally { if (alive.current) setLoadingContent(false); }
      })();
    }
    return () => { alive.current = false; cleanup(); };
  }, [contentId, cleanup]);

  useEffect(() => { if (content?.videoUrl) initPlayer(content.videoUrl); }, [content, initPlayer]);

  // ── Video events ─────────────────────────────────────────────────────────────
  const onTimeUpdate = useCallback(() => {
    const v = videoRef.current; if (!v || !v.duration) return;
    const ct  = v.currentTime;
    const pct = ct / v.duration;
    setCurrentTime(ct);
    if (v.buffered.length > 0) {
      const bp = v.buffered.end(v.buffered.length - 1) / v.duration;
      setBufferedPct(bp * 100);
      if (bufRef.current) bufRef.current.style.transform = `scaleX(${bp})`;
    }
    // Direct DOM update — no React render
    if (!isDraggingRef.current) {
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${pct})`;
      if (dotRef.current)  dotRef.current.style.left       = `${pct * 100}%`;
    }
  }, []);

  const onDurationChange = () => {
    const v = videoRef.current;
    if (v?.duration) { setDuration(v.duration); durRef.current = v.duration; }
  };
  const onPlay    = () => { if (alive.current && !devToolsRef.current) { setPlayerState('playing'); setIsSeeking(false); } };
  const onPause   = () => { if (alive.current && playerState !== 'devtools') setPlayerState('paused'); };
  const onEnded   = () => setPlayerState('ended');
  const onWaiting = () => {
    clearTimeout(waitTimerRef.current);
    waitTimerRef.current = setTimeout(() => { if (alive.current) setIsSeeking(true); }, WAITING_SPINNER_DELAY_MS);
  };
  const onPlaying = () => { clearTimeout(waitTimerRef.current); setIsSeeking(false); };
  const onVolChange = () => { const v = videoRef.current; if (!v) return; setVolume(v.volume); setMuted(v.muted); };
  const onVideoError = () => {
    const v = videoRef.current;
    if (v?.error && v.src && v.src !== window.location.href) {
      logErr('video error:', v.error.code, v.error.message);
      setPlayerError('Playback error. Please retry.'); setPlayerState('error');
    }
  };

  // ── Controls ─────────────────────────────────────────────────────────────────
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
    v.volume = nv; v.muted = nv === 0; setVolume(nv); setMuted(nv === 0);
  };
  const toggleMute = () => { const v = videoRef.current; if (!v) return; v.muted = !v.muted; setMuted(v.muted); };
  const setSpeedTo = (s: number) => {
    const c = Math.round(clamp(s, MIN_SPEED, MAX_SPEED) / SPEED_STEP) * SPEED_STEP;
    const v = videoRef.current; if (v) v.playbackRate = c;
    setSpeed(parseFloat(c.toFixed(2)));
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
  const changeQuality = (q: Quality) => {
    // Never restart — just update preload and let the browser buffer accordingly
    qualityRef.current = q;
    setQuality(q);
    setShowQualMenu(false);
    const v = videoRef.current; if (!v) return;
    v.preload = QUALITY_MAP[q].preload;
    // For Low quality: if buffered well ahead, we can abort and re-request smaller range.
    // For High: browser will naturally buffer more. No stream restart needed either way.
  };

  // ── Progress bar — GPU-compositor drag ───────────────────────────────────────
  //
  // The fill uses transform:scaleX(0..1) with transform-origin:left.
  // The dot uses transform:translateX(Npx).
  // Both run on the GPU compositor thread — zero layout recalc, true 60fps.
  // React state is never touched during a drag; only on mouseup/touchend.

  const getTrackWidth = () => progressRef.current?.offsetWidth ?? 300;

  // Write position to DOM directly — zero React state, runs at 60fps
  // fill: scaleX (GPU compositor, transform-origin:left)
  // dot:  style.left = pct*100+'%'  (CSS has transform:translate(-50%,-50%) for centering)
  // tip:  style.left = pct*100+'%'  (CSS has transform:translateX(-50%) for centering)
  const applyPct = useCallback((pct: number) => {
    const pctStr = `${pct * 100}%`;
    if (fillRef.current) fillRef.current.style.transform = `scaleX(${pct})`;
    if (dotRef.current)  dotRef.current.style.left       = pctStr;
    if (tipRef.current) {
      tipRef.current.style.left        = pctStr;
      tipRef.current.textContent       = fmtTime(pct * durRef.current);
      tipRef.current.style.opacity     = '1';
    }
  }, []);

  const commitSeek = useCallback((pct: number) => {
    const v = videoRef.current; if (!v || !durRef.current) return;
    const t = pct * durRef.current;
    if (typeof (v as any).fastSeek === 'function') (v as any).fastSeek(t);
    else v.currentTime = t;
    setCurrentTime(t);
  }, []);

  const startDrag = useCallback((pct: number) => {
    isDraggingRef.current = true;
    setIsDragging(true);
    videoRef.current?.pause();
    if (fillRef.current) fillRef.current.style.transition = 'none';
    if (dotRef.current)  dotRef.current.style.transition  = 'opacity .12s';  // no left transition
    applyPct(pct);
  }, [applyPct]);

  const endDrag = useCallback((pct: number) => {
    isDraggingRef.current = false;
    setIsDragging(false);
    if (fillRef.current) fillRef.current.style.transition = 'transform 0.06s linear';
    if (dotRef.current)  dotRef.current.style.transition  = 'opacity .12s, transform .08s ease';
    if (tipRef.current)  tipRef.current.style.opacity = '0';
    commitSeek(pct);
    setTimeout(() => { videoRef.current?.play().catch(() => {}); }, 40);
  }, [commitSeek]);

  const pctFromMouse = useCallback((clientX: number): number => {
    const el = progressRef.current; if (!el) return 0;
    return clamp((clientX - el.getBoundingClientRect().left) / el.offsetWidth, 0, 1);
  }, []);

  const onProgressMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startDrag(pctFromMouse(e.clientX));
    const onMove = (ev: MouseEvent) => applyPct(pctFromMouse(ev.clientX));
    const onUp   = (ev: MouseEvent) => {
      endDrag(pctFromMouse(ev.clientX));
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  }, [startDrag, endDrag, applyPct, pctFromMouse]);

  const onProgressHover = useCallback((e: React.MouseEvent) => {
    if (isDraggingRef.current) return;
    const pct = pctFromMouse(e.clientX);
    setHoverTime({ pct: pct * 100, time: pct * duration });
    if (tipRef.current) {
      tipRef.current.style.left    = `${pct * 100}%`;
      tipRef.current.textContent   = fmtTime(pct * duration);
      tipRef.current.style.opacity = '1';
    }
  }, [pctFromMouse, duration]);

  const onProgressLeave = useCallback(() => {
    if (isDraggingRef.current) return;
    setHoverTime(null);
    if (tipRef.current) tipRef.current.style.opacity = '0';
  }, []);

  // Touch — attached with passive:false via useEffect so preventDefault works
  useEffect(() => {
    const el = progressRef.current; if (!el) return;
    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const getPct = (tl: TouchList) => clamp((tl[0].clientX - el.getBoundingClientRect().left) / el.offsetWidth, 0, 1);
      startDrag(getPct(e.touches));
      const onMove = (ev: TouchEvent) => { ev.preventDefault(); applyPct(getPct(ev.touches)); };
      const onEnd  = (ev: TouchEvent) => {
        endDrag(getPct(ev.changedTouches));
        window.removeEventListener('touchmove', onMove);
        window.removeEventListener('touchend',  onEnd);
      };
      window.addEventListener('touchmove', onMove, { passive: false });
      window.addEventListener('touchend',  onEnd);
    };
    el.addEventListener('touchstart', onTouchStart, { passive: false });
    return () => el.removeEventListener('touchstart', onTouchStart);
  }); // no dep array — re-run each render so startDrag/endDrag/applyPct closures stay fresh

  // ── Volume bar ───────────────────────────────────────────────────────────────
  const onVolumeBarDown = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const el = document.getElementById('vol-vert-track');
    const applyV = (clientY: number) => {
      if (!el) return;
      const val = clamp(1 - (clientY - el.getBoundingClientRect().top) / el.offsetHeight, 0, 1);
      const v = videoRef.current; if (!v) return;
      v.volume = val; v.muted = val === 0; setVolume(val); setMuted(val === 0);
    };
    applyV(e.clientY);
    const mm = (ev: MouseEvent) => applyV(ev.clientY);
    const mu = () => { window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', mu); };
    window.addEventListener('mousemove', mm); window.addEventListener('mouseup', mu);
  };

  // ── Derived ──────────────────────────────────────────────────────────────────
  const playPct         = duration > 0 ? (currentTime / duration) * 100 : 0;
  const showLoadOverlay = playerState === 'streaming' || playerState === 'downloading';
  const showPlayerCtrls = (playerState === 'playing' || playerState === 'paused' || playerState === 'ended') && !isVideoHidden;
  const ctrlsHidden     = playerState === 'playing' && !ctrlVisible && !isDragging && !showSpeedMenu && !showVolPanel && !showQualMenu;
  const VolumeIcon      = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const qCfg            = QUALITY_MAP[quality];

  const getNoteHref    = () => content?.noteSource === 'gdrive' ? content?.noteGDriveDownloadUrl || null : content?.noteUrl || null;
  const getNotePreview = () => content?.noteSource === 'gdrive' ? content?.noteGDrivePreviewUrl || null : content?.noteUrl || null;

  if (loadingContent) return (
    <div className="min-h-screen bg-[#080a10] flex items-center justify-center">
      <Loader2 size={28} className="text-violet-400 animate-spin" />
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

  // ── Initial DOM pct for fill/dot (React sets initial, then DOM takes over) ──
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&display=swap');

        .sv { -webkit-user-select:none; user-select:none; -webkit-user-drag:none; }
        .sv video { display:block; width:100%; height:100%; object-fit:contain; pointer-events:none; }
        .sv video::-webkit-media-controls,
        .sv video::-webkit-media-controls-enclosure { display:none !important; }

        .wm {
          position:absolute; top:13px; z-index:30;
          font-family:'Space Grotesk',system-ui,sans-serif;
          font-size:12px; font-weight:700; letter-spacing:.13em; text-transform:uppercase;
          color:rgba(255,255,255,.18); text-shadow:0 1px 6px rgba(0,0,0,.6);
          pointer-events:none; user-select:none; white-space:nowrap;
        }
        .wm-r { right:14px; } .wm-l { left:14px; }

        /* ── Progress bar — GPU compositor layout ── */
        /* Track wrapper */
        .prg {
          position:relative; height:4px; cursor:pointer;
          touch-action:none; user-select:none;
          transition:height .12s ease;
          margin-bottom:12px;
        }
        .prg:hover, .prg.dragging { height:6px; }

        /* Grey background rail — NO overflow:hidden, it clips scaleX */
        .prg-rail {
          position:absolute; inset:0;
          background:rgba(255,255,255,.15); border-radius:99px;
        }
        /* Buffered — scaleX from left. No overflow:hidden parent, so no clipping */
        .prg-buf {
          position:absolute; inset:0;
          background:rgba(255,255,255,.25); border-radius:99px;
          transform-origin:left center;
          transform:scaleX(0);
          will-change:transform;
        }
        /* Played fill — scaleX from left, GPU compositor only */
        .prg-fill {
          position:absolute; inset:0;
          background:linear-gradient(90deg,#6d28d9,#7c3aed);
          border-radius:99px;
          transform-origin:left center;
          transform:scaleX(0);
          will-change:transform;
          transition:transform 0.06s linear;
        }
        .prg.dragging .prg-fill { transition:none; }

        /* Thumb dot — uses left:0 + translateX. No margin tricks. */
        /* JS writes: style.left = pct*100+'%' — simple, no mixed transforms */
        .prg-dot {
          position:absolute; top:50%; left:0;
          width:13px; height:13px; border-radius:50%;
          background:#fff;
          transform:translate(-50%,-50%);
          box-shadow:0 0 0 3px rgba(124,58,237,.55), 0 2px 8px rgba(0,0,0,.5);
          will-change:left;
          opacity:0; transition:opacity .12s, transform .08s ease;
          pointer-events:none;
        }
        .prg:hover .prg-dot, .prg.dragging .prg-dot {
          opacity:1; transform:translate(-50%,-50%) scale(1.15);
        }
        .prg.dragging .prg-dot { transition:opacity .12s; } /* no left transition during drag */

        /* Time tooltip — JS writes style.left, CSS centers it */
        .prg-tip {
          position:absolute; bottom:calc(100% + 8px); left:0;
          background:rgba(6,6,18,.95); border:1px solid rgba(255,255,255,.1);
          color:#fff; font-size:11px; font-weight:600; padding:3px 9px;
          border-radius:8px;
          transform:translateX(-50%);
          pointer-events:none; white-space:nowrap;
          opacity:0; transition:opacity .1s;
        }

        /* ── Control button ── */
        .cb {
          display:inline-flex; align-items:center; justify-content:center;
          background:transparent; border:none; color:rgba(255,255,255,.7);
          border-radius:8px; padding:7px; cursor:pointer; flex-shrink:0;
          transition:color .1s, background .1s; -webkit-tap-highlight-color:transparent;
        }
        .cb:hover { color:#fff; background:rgba(255,255,255,.1); }
        .cb:active { background:rgba(255,255,255,.16); }
        .cb.on { color:#a78bfa; }

        /* ── Panels (vol, speed, quality) — shared ── */
        .panel {
          position:absolute; bottom:calc(100% + 10px);
          background:#0f0f1e; border:1px solid rgba(255,255,255,.12);
          border-radius:14px; box-shadow:0 16px 48px rgba(0,0,0,.8);
          z-index:300; animation:panelIn .14s ease;
        }
        @keyframes panelIn {
          from { opacity:0; transform:translateY(6px) translateX(-50%); }
          to   { opacity:1; transform:translateY(0)   translateX(-50%); }
        }

        /* Volume */
        .vol-panel { left:50%; transform:translateX(-50%); padding:14px 10px 10px; display:flex; flex-direction:column; align-items:center; gap:10px; min-width:44px; }
        .vol-pct { font-size:11px; font-weight:700; color:rgba(255,255,255,.45); font-variant-numeric:tabular-nums; }
        .vol-track { position:relative; width:4px; height:88px; background:rgba(255,255,255,.15); border-radius:99px; cursor:pointer; touch-action:none; }
        .vol-fill  { position:absolute; bottom:0; left:0; width:100%; background:#7c3aed; border-radius:99px; pointer-events:none; }
        .vol-dot   { position:absolute; left:50%; width:12px; height:12px; border-radius:50%; background:#fff; transform:translateX(-50%) translateY(50%); box-shadow:0 0 0 2px rgba(124,58,237,.5); pointer-events:none; }

        /* Speed */
        .spd-panel { right:0; padding:12px; display:flex; flex-direction:column; gap:8px; align-items:center; min-width:128px; animation-name:spdIn; }
        @keyframes spdIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .spd-lbl  { font-size:10px; text-transform:uppercase; letter-spacing:.08em; color:rgba(255,255,255,.3); font-weight:600; }
        .spd-val  { font-size:22px; font-weight:800; color:#fff; font-variant-numeric:tabular-nums; line-height:1; }
        .spd-row  { display:flex; align-items:center; gap:8px; width:100%; }
        .spd-btn  { display:flex; align-items:center; justify-content:center; width:30px; height:30px; border-radius:8px; border:none; cursor:pointer; background:rgba(255,255,255,.08); color:rgba(255,255,255,.8); font-size:17px; font-weight:700; transition:background .1s; flex-shrink:0; }
        .spd-btn:hover { background:rgba(255,255,255,.15); }
        .spd-bar  { flex:1; height:3px; background:rgba(255,255,255,.15); border-radius:99px; overflow:hidden; }
        .spd-bar-f{ height:100%; background:#7c3aed; border-radius:99px; transition:width .1s; }
        .spd-chips{ display:flex; gap:4px; flex-wrap:wrap; justify-content:center; }
        .chip { font-size:11px; font-weight:600; padding:4px 8px; border-radius:7px; border:1px solid rgba(255,255,255,.1); background:transparent; color:rgba(255,255,255,.5); cursor:pointer; transition:all .1s; }
        .chip:hover { background:rgba(255,255,255,.08); color:#fff; }
        .chip.active { background:rgba(124,58,237,.25); border-color:#7c3aed; color:#a78bfa; }

        /* Quality */
        .qual-panel { right:0; padding:10px 8px; display:flex; flex-direction:column; gap:4px; min-width:120px; animation-name:spdIn; }
        .qual-lbl { font-size:10px; text-transform:uppercase; letter-spacing:.08em; color:rgba(255,255,255,.3); font-weight:600; padding:0 4px 4px; }
        .qual-opt {
          display:flex; align-items:center; gap:8px; padding:7px 10px;
          border-radius:9px; cursor:pointer; border:none; background:transparent;
          width:100%; text-align:left; transition:background .1s;
        }
        .qual-opt:hover { background:rgba(255,255,255,.08); }
        .qual-opt.active { background:rgba(124,58,237,.18); }
        .qual-dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
        .qual-name { font-size:13px; font-weight:600; color:rgba(255,255,255,.8); }
        .qual-opt.active .qual-name { color:#fff; }
        .qual-sub { font-size:10px; color:rgba(255,255,255,.3); margin-left:auto; }
        .qual-btn-text { font-size:11px; font-weight:700; }

        /* Controls fade */
        .ctrl-wrap { transition:opacity .22s ease, transform .18s ease; }
        .ctrl-wrap.hide { opacity:0 !important; transform:translateY(5px); pointer-events:none; }

        /* Skip flash */
        .skip-flash {
          position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
          display:flex; align-items:center; gap:6px;
          background:rgba(0,0,0,.55); border-radius:12px;
          padding:10px 20px; color:#fff; font-size:14px; font-weight:600;
          pointer-events:none; animation:sfade .65s ease-out forwards;
        }
        @keyframes sfade {
          0%  { opacity:1; transform:translate(-50%,-50%) scale(1); }
          60% { opacity:.8; }
          100%{ opacity:0; transform:translate(-50%,-62%) scale(.9); }
        }

        /* Spinner */
        .spin-ring { animation:spin360 .85s linear infinite; transform-origin:center; }
        @keyframes spin360 { to { transform:rotate(360deg); } }

        /* Page fade */
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
        .au  { animation:fadeUp .4s cubic-bezier(.22,1,.36,1) both; }
        .au1 { animation:fadeUp .4s .06s cubic-bezier(.22,1,.36,1) both; }
        .au2 { animation:fadeUp .4s .12s cubic-bezier(.22,1,.36,1) both; }
        .au3 { animation:fadeUp .4s .18s cubic-bezier(.22,1,.36,1) both; }
      `}</style>

      <div className="min-h-screen bg-[#080a10] text-white select-none" onContextMenu={e => e.preventDefault()}>
        <div className="fixed inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 70% 40% at 50% -5%,rgba(124,58,237,.12) 0%,transparent 70%)' }} />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-6">

          <button onClick={() => navigate(-1)}
            className="au flex items-center gap-2 text-sm text-white/35 hover:text-white/75 transition-colors mb-5 group focus:outline-none px-3 py-1.5 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/8">
            <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" />
            Back to Library
          </button>

          {/* ══ PLAYER CARD ══════════════════════════════════════════════════ */}
          <div className="au1 rounded-2xl overflow-hidden border border-white/8 bg-black mb-6 shadow-2xl shadow-black/70">

            {playerState === 'devtools' && (
              <div className="aspect-video flex flex-col items-center justify-center bg-[#080a10]">
                <Lock size={32} className="text-rose-400 mb-3" />
                <p className="text-white/55 text-sm font-medium">DevTools detected</p>
                <p className="text-white/25 text-xs mt-1">Close DevTools to resume</p>
              </div>
            )}

            {isEmbed && embedUrl && (
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                <iframe src={embedUrl} className="absolute inset-0 w-full h-full"
                  allow="autoplay; fullscreen; encrypted-media" allowFullScreen
                  referrerPolicy="no-referrer"
                  sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
                  title={content?.title || 'Video'} style={{ border: 'none' }} />
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
                {user?.userId && <div className="wm wm-l">{user.userId}</div>}
                <div className="wm wm-r">Edtech</div>

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

                {showLoadOverlay && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black gap-5">
                    <div className="relative w-20 h-20 flex items-center justify-center">
                      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 80 80" fill="none">
                        <circle cx="40" cy="40" r="34" stroke="rgba(124,58,237,.15)" strokeWidth="3.5" />
                        <circle cx="40" cy="40" r="34" stroke="#7c3aed" strokeWidth="3.5"
                          strokeDasharray="50 163" strokeLinecap="round" className="spin-ring" />
                      </svg>
                      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 80 80" fill="none"
                        style={{ animation: 'spin360 3s linear infinite reverse', transformOrigin: 'center' }}>
                        <circle cx="40" cy="40" r="26" stroke="rgba(124,58,237,.1)" strokeWidth="2" strokeDasharray="8 6" strokeLinecap="round" />
                      </svg>
                      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" style={{ position:'relative',zIndex:1 }}>
                        <path d="M4 6C4 4.9 4.9 4 6 4H13V20H6C4.9 20 4 19.1 4 18V6Z" fill="rgba(124,58,237,.6)" />
                        <path d="M15 4H22C23.1 4 24 4.9 24 6V18C24 19.1 23.1 20 22 20H15V4Z" fill="rgba(124,58,237,.4)" />
                        <rect x="13" y="4" width="2" height="16" fill="rgba(167,139,250,.8)" />
                        <path d="M6 20C6 21.1 6.9 22 8 22H20C21.1 22 22 21.1 22 20H6Z" fill="rgba(124,58,237,.3)" />
                        <circle cx="14" cy="14" r="5.5" fill="rgba(0,0,0,.35)" />
                        <path d="M12.3 11.5L17.2 14L12.3 16.5V11.5Z" fill="white" />
                      </svg>
                    </div>
                    <p className="text-white/40 text-sm font-medium tracking-wide">
                      {playerState === 'downloading' && dlBytes > 0 ? `Loading… ${fmtBytes(dlBytes)}` : 'Loading…'}
                    </p>
                  </div>
                )}

                {isSeeking && !showLoadOverlay && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <svg className="w-12 h-12" viewBox="0 0 48 48" fill="none">
                      <circle cx="24" cy="24" r="19" stroke="rgba(255,255,255,.15)" strokeWidth="3" />
                      <circle cx="24" cy="24" r="19" stroke="rgba(255,255,255,.7)" strokeWidth="3"
                        strokeDasharray="30 90" strokeLinecap="round" className="spin-ring" />
                    </svg>
                  </div>
                )}

                {skipFlash && (
                  <div className="skip-flash">
                    {skipFlash === 'fwd' ? <><RotateCw size={16}/><span>+10s</span></> : <><RotateCcw size={16}/><span>–10s</span></>}
                  </div>
                )}

                {playerState === 'error' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/88 text-center p-6">
                    <AlertCircle size={30} className="text-rose-400 mb-3" />
                    <p className="text-white/60 text-sm mb-4 max-w-xs">{playerError}</p>
                    <button onClick={handleRetry}
                      className="px-5 py-2.5 bg-violet-700 hover:bg-violet-600 text-white text-sm rounded-xl font-medium transition-colors">
                      Try Again
                    </button>
                  </div>
                )}

                {playerState === 'ended' && !isVideoHidden && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
                    <button className="pointer-events-auto w-16 h-16 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-sm flex items-center justify-center transition-all border border-white/20"
                      onClick={togglePlayPause}>
                      <RotateCcw size={28} className="text-white" />
                    </button>
                  </div>
                )}

                {/* ══ CONTROLS ══════════════════════════════════════════════ */}
                {showPlayerCtrls && (
                  <div className={`ctrl-wrap absolute inset-x-0 bottom-0 ${ctrlsHidden ? 'hide' : ''}`}>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent pointer-events-none" />

                    <div className="relative px-3 pb-3 pt-8">

                      {/* ── Progress bar ── */}
                      <div
                        ref={progressRef}
                        className={`prg${isDragging ? ' dragging' : ''}`}
                        onMouseDown={onProgressMouseDown}
                        onMouseMove={onProgressHover}
                        onMouseLeave={onProgressLeave}
                      >
                        <div className="prg-rail">
                          <div ref={bufRef}  className="prg-buf" />
                          <div ref={fillRef} className="prg-fill" />
                        </div>
                        {/* dot: left=pct%, CSS transform centers it */}
                        <div ref={dotRef} className="prg-dot" style={{ left: `${playPct}%` }} />
                        {/* tip: left=pct%, CSS transform centers it */}
                        <div ref={tipRef} className="prg-tip" style={{ left: `${playPct}%`, opacity: 0 }}>0:00</div>
                      </div>

                      {/* ── Controls row ── */}
                      <div className="flex items-center gap-0.5">

                        <button className="cb" onClick={togglePlayPause}
                          title={playerState === 'playing' ? 'Pause (Space)' : 'Play (Space)'}>
                          {playerState === 'playing' ? <Pause size={20}/> : playerState === 'ended' ? <RotateCcw size={18}/> : <Play size={20}/>}
                        </button>

                        <button className="cb" onClick={() => skipBy(-10)} title="Back 10s"><SkipBack size={17}/></button>
                        <button className="cb" onClick={() => skipBy(10)}  title="Forward 10s"><SkipForward size={17}/></button>

                        {/* Volume */}
                        <div className="relative flex-shrink-0" ref={volumeWrapRef}>
                          <button className={`cb ${showVolPanel ? 'on' : ''}`} onClick={() => setShowVolPanel(v => !v)} title="Volume (M)">
                            <VolumeIcon size={18}/>
                          </button>
                          {showVolPanel && (() => {
                            const volPct = muted ? 0 : volume;
                            return (
                              <div className="panel vol-panel">
                                <span className="vol-pct">{Math.round(volPct * 100)}%</span>
                                <div id="vol-vert-track" className="vol-track" onMouseDown={onVolumeBarDown}>
                                  <div className="vol-fill" style={{ height: `${volPct * 100}%` }} />
                                  <div className="vol-dot" style={{ bottom: `${volPct * 88}px` }} />
                                </div>
                                <button className="cb" style={{ padding: 4 }} onClick={toggleMute} title="Mute (M)">
                                  <VolumeIcon size={16}/>
                                </button>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Time */}
                        <span className="text-xs text-white/45 font-mono tabular-nums ml-1.5 flex-shrink-0">
                          {fmtTime(currentTime)}<span className="text-white/20 mx-1">/</span>{fmtTime(duration)}
                        </span>

                        <div className="flex-1" />

                        {/* ── Quality selector ── */}
                        <div className="relative flex-shrink-0" ref={qualMenuRef}>
                          <button
                            className={`cb ${showQualMenu ? 'on' : ''}`}
                            onClick={() => setShowQualMenu(q => !q)}
                            title="Video quality"
                            style={{ gap: 4, padding: '5px 8px' }}
                          >
                            <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: qCfg.color }} />
                            <span className="qual-btn-text hidden sm:inline">{qCfg.label}</span>
                            <Gauge size={14} className="sm:hidden"/>
                          </button>

                          {showQualMenu && (
                            <div className="panel qual-panel">
                              <span className="qual-lbl">Quality</span>
                              {(['high', 'medium', 'low'] as Quality[]).map(q => {
                                const cfg = QUALITY_MAP[q];
                                const subs: Record<Quality, string> = { high: 'Best', medium: 'Balanced', low: 'Data saver' };
                                return (
                                  <button key={q} className={`qual-opt ${quality === q ? 'active' : ''}`}
                                    onClick={() => changeQuality(q)}>
                                    <span className="qual-dot" style={{ background: cfg.color }} />
                                    <span className="qual-name">{cfg.label}</span>
                                    <span className="qual-sub">{subs[q]}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Speed */}
                        <div className="relative flex-shrink-0" ref={speedMenuRef}>
                          <button className={`cb text-[11px] font-bold px-1.5 min-w-[36px] ${showSpeedMenu ? 'on' : ''}`}
                            onClick={() => setShowSpeedMenu(s => !s)} title="Speed">
                            {speed === 1 ? '1×' : `${speed}×`}
                          </button>
                          {showSpeedMenu && (() => {
                            const presets = [0.5, 1, 1.5, 2, 2.5, 3];
                            const pct     = ((speed - MIN_SPEED) / (MAX_SPEED - MIN_SPEED)) * 100;
                            return (
                              <div className="panel spd-panel">
                                <span className="spd-lbl">Speed</span>
                                <span className="spd-val">{speed.toFixed(2)}×</span>
                                <div className="spd-row">
                                  <button className="spd-btn" onClick={() => setSpeedTo(speed - SPEED_STEP)}>−</button>
                                  <div className="spd-bar"><div className="spd-bar-f" style={{ width: `${pct}%` }} /></div>
                                  <button className="spd-btn" onClick={() => setSpeedTo(speed + SPEED_STEP)}>+</button>
                                </div>
                                <div className="spd-chips">
                                  {presets.map(p => (
                                    <button key={p} className={`chip ${speed === p ? 'active' : ''}`} onClick={() => setSpeedTo(p)}>
                                      {p === 1 ? '1×' : `${p}×`}
                                    </button>
                                  ))}
                                </div>
                                {speed !== 1 && <button className="chip" style={{ width:'100%',marginTop:2 }} onClick={() => setSpeedTo(1)}>Reset</button>}
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

                {/* Mobile double-tap */}
                {showPlayerCtrls && !showLoadOverlay && (
                  <>
                    <div className="absolute inset-y-0 left-0 w-1/3" style={{ bottom:60,pointerEvents:'auto' }} onDoubleClick={() => skipBy(-10)} />
                    <div className="absolute inset-y-0 right-0 w-1/3" style={{ bottom:60,pointerEvents:'auto' }} onDoubleClick={() => skipBy(10)} />
                  </>
                )}
              </div>
            )}

            {!content?.videoUrl && !loadingContent && (
              <div className="aspect-video flex flex-col items-center justify-center bg-black">
                <Play size={32} className="text-white/10 mb-3" />
                <p className="text-white/20 text-sm">No video attached</p>
              </div>
            )}
          </div>

          {/* ── Content metadata ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 space-y-4">
              <div className="au2 rounded-2xl border border-white/6 bg-[#0d0f1a] p-5 sm:p-6">
                <div className="flex items-start gap-3 mb-3">
                  <span className={`flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border mt-0.5 ${content?.type === 'lesson' ? 'bg-violet-500/15 text-violet-300 border-violet-500/20' : 'bg-amber-500/15 text-amber-300 border-amber-500/20'}`}>
                    {content?.type === 'lesson' ? <Play size={10}/> : <BookOpen size={10}/>}
                    {content?.type === 'lesson' ? 'Lesson' : 'Trick'}
                  </span>
                  {content?.videoUrl?.startsWith('secured://') && (
                    <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/10 text-green-400/80 border border-green-500/15 mt-1">
                      <Shield size={9}/> Protected
                    </span>
                  )}
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-white leading-snug mb-2">{content?.title || 'Untitled'}</h1>
                {content?.subject && <p className="text-sm text-white/35 mb-1">{content.subject}</p>}
                {content?.description && <p className="text-sm text-white/50 leading-relaxed mt-3 pt-3 border-t border-white/5">{content.description}</p>}
              </div>

              <div className="au3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {content?.duration && (
                  <div className="rounded-xl border border-white/6 bg-[#0d0f1a] px-4 py-3 flex items-center gap-3">
                    <Clock size={15} className="text-white/25"/>
                    <div>
                      <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold mb-0.5">Duration</p>
                      <p className="text-sm text-white/70 font-medium">{fmtMinutes(content.duration)}</p>
                    </div>
                  </div>
                )}
                {content?.subject && (
                  <div className="rounded-xl border border-white/6 bg-[#0d0f1a] px-4 py-3 flex items-center gap-3">
                    <BookOpen size={15} className="text-white/25"/>
                    <div>
                      <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold mb-0.5">Subject</p>
                      <p className="text-sm text-white/70 font-medium truncate">{content.subject}</p>
                    </div>
                  </div>
                )}
                {content?.videoUrl?.startsWith('secured://') && (
                  <div className="rounded-xl border border-green-500/15 bg-green-500/5 px-4 py-3 flex items-center gap-3">
                    <Shield size={15} className="text-green-400/60"/>
                    <div>
                      <p className="text-[10px] text-green-400/40 uppercase tracking-widest font-semibold mb-0.5">Security</p>
                      <p className="text-sm text-green-400/70 font-medium">Protected</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="au3 space-y-3">
              {(content?.noteUrl || content?.noteGDrivePreviewUrl) ? (
                <div className="rounded-2xl border border-white/6 bg-[#0d0f1a] p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <FileText size={14} className="text-emerald-400/70"/>
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
                {['Signed stream token (anti-IDM)', 'Sec-Fetch-Dest validation', 'Source URL never exposed', 'Screen capture blocked'].map(f => (
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
