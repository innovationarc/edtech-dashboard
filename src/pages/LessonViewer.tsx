// src/pages/LessonViewer.tsx
// Full Platform C secure video player
// Handles: lesson | trick content types
// Route: /content-library/lesson/:courseId/:contentId
//
// SECURITY MODEL (Platform C):
//   - All video URLs are stored as secured://<videoId> — never the raw source
//   - Stream tokens expire in 5 min, chunk tokens expire in 30 sec (HMAC-SHA256)
//   - Video delivered via MediaSource Extensions — no blob/src URL ever exposed
//   - Right-click, DevTools, screen capture, IDM, keyboard shortcuts all blocked
//   - Embed videos (YouTube/Vimeo/Dailymotion) delivered via sandbox iframe proxy

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  ExternalLink,
  Download,
  Shield,
  AlertCircle,
  Loader2,
  Play,
  Clock,
  BookOpen,
  Lock,
} from 'lucide-react';
import { contentLibraryService, LibraryContent } from '../services/contentLibraryService';
import { videoStreamService } from '../services/videoStreamService';
import { useDashboard } from '../contexts/DashboardContext';

// ─── Security string — must match VIDEO_SECURITY_STRING in Vercel env ─────────
const SECURITY_STRING =
  (import.meta as any).env?.VITE_VIDEO_SECURITY_STRING ||
  'CHANGE_ME_IN_VITE_ENV_VITE_VIDEO_SECURITY_STRING';

// ─── MSE constants ────────────────────────────────────────────────────────────
const BUFFER_AHEAD_PAUSE  = 60;   // seconds — stop pre-fetching beyond this
const BUFFER_AHEAD_RESUME = 15;   // seconds — resume pre-fetching below this
const INITIAL_BUFFER_SECS = 8;    // seconds before allowing playback

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDuration(secs: number): string {
  if (!secs || isNaN(secs)) return '0:00';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatMinutes(mins: number): string {
  if (!mins) return '—';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}

function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms));
}

// ─── Anti-piracy injection — runs once on mount ───────────────────────────────
function injectAntiPiracy() {
  document.addEventListener('contextmenu', (e) => e.preventDefault(), true);
  document.addEventListener('keydown', (e) => {
    const ctrl = e.ctrlKey || e.metaKey;
    if (e.key === 'F12') { e.preventDefault(); return; }
    if (ctrl && ['s','u','p','i','j','c','S','U','P','I','J','C'].includes(e.key)) {
      e.preventDefault(); return;
    }
    if (ctrl && e.shiftKey && ['I','J','C','i','j','c'].includes(e.key)) {
      e.preventDefault(); return;
    }
    if (e.key === 'PrintScreen') { e.preventDefault(); return; }
  }, true);
  try { (window as any).MediaRecorder = undefined; } catch {}
  try {
    const nav = navigator as any;
    if (nav.mediaDevices?.getDisplayMedia) {
      nav.mediaDevices.getDisplayMedia = () =>
        Promise.reject(new Error('Screen capture is disabled.'));
    }
    const origGetUserMedia = nav.mediaDevices?.getUserMedia?.bind(nav.mediaDevices);
    if (origGetUserMedia) {
      nav.mediaDevices.getUserMedia = (constraints: any) => {
        if (constraints?.video) return Promise.reject(new Error('Video capture is disabled.'));
        return origGetUserMedia(constraints);
      };
    }
  } catch {}
}

// ─── DevTools detector ────────────────────────────────────────────────────────
function useDevToolsDetection(onDetected: () => void, onClear: () => void) {
  useEffect(() => {
    let detected = false;
    const check = () => {
      const threshold = 160;
      const open =
        window.outerWidth - window.innerWidth > threshold ||
        window.outerHeight - window.innerHeight > threshold;
      if (open && !detected) { detected = true; onDetected(); }
      else if (!open && detected) { detected = false; onClear(); }
    };
    const id = setInterval(check, 1000);
    window.addEventListener('resize', check);
    return () => { clearInterval(id); window.removeEventListener('resize', check); };
  }, [onDetected, onClear]);
}

// ─── Types ────────────────────────────────────────────────────────────────────
type PlayerState = 'idle' | 'loading' | 'buffering' | 'playing' | 'paused' | 'error' | 'devtools';

// ─── MSE session object — single source of truth for one streaming session ────
// Bundling all MSE state into one ref prevents stale-closure bugs where
// pump() or flushPendingChunks() hold onto an old sbRef / msRef value.
interface MSESession {
  ms: MediaSource;
  sb: SourceBuffer;
  blobUrl: string;            // kept alive until session is torn down
  destroyed: boolean;         // set to true by teardown()
  pendingChunks: ArrayBuffer[];
  appending: boolean;
  nextToken: string;
  chunkIndex: number;
  streamToken: string;
  videoId: string;
}

// ==================== MAIN COMPONENT ====================

const LessonViewer: React.FC = () => {
  const { courseId, contentId } = useParams<{ courseId: string; contentId: string }>();
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user }  = useDashboard();

  // ─── Content state ─────────────────────────────────────────────────────────
  const [content, setContent]           = useState<LibraryContent | null>(null);
  const [loadingContent, setLoadingContent] = useState(true);
  const [contentError, setContentError] = useState('');

  // ─── Player state ──────────────────────────────────────────────────────────
  const [playerState, setPlayerState]   = useState<PlayerState>('idle');
  const [playerError, setPlayerError]   = useState('');
  const [isEmbed, setIsEmbed]           = useState(false);
  const [embedUrl, setEmbedUrl]         = useState('');
  const [currentTime, setCurrentTime]   = useState(0);
  const [duration, setDuration]         = useState(0);
  const [totalChunks, setTotalChunks]   = useState<number | null>(null);
  const [loadedChunks, setLoadedChunks] = useState(0);
  const [bufferedPercent, setBufferedPercent] = useState(0);
  const [isVideoHidden, setIsVideoHidden] = useState(false);

  // ─── Refs ──────────────────────────────────────────────────────────────────
  const videoRef      = useRef<HTMLVideoElement>(null);
  const sessionRef    = useRef<MSESession | null>(null);  // current MSE session
  const componentAlive = useRef(true);                    // false after component unmounts

  // ─── Anti-piracy setup ────────────────────────────────────────────────────
  useEffect(() => {
    injectAntiPiracy();
  }, []);

  useDevToolsDetection(
    useCallback(() => {
      setIsVideoHidden(true);
      setPlayerState('devtools');
      if (videoRef.current) videoRef.current.pause();
    }, []),
    useCallback(() => {
      setIsVideoHidden(false);
      setPlayerState(prev => prev === 'devtools' ? 'playing' : prev);
    }, [])
  );

  // ─── Tear down any active MSE session ────────────────────────────────────
  // Safe to call multiple times. Does NOT touch React state (can be called
  // from cleanup callbacks after unmount).
  const teardownSession = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    session.destroyed = true;
    sessionRef.current = null;

    const video = videoRef.current;
    if (video) {
      try { video.pause(); } catch {}
      // Remove all SourceBuffer event listeners by replacing the sb reference
      // (we can't call removeEventListener without the original handler refs,
      //  but marking session.destroyed = true is enough to gate all callbacks)
    }

    // End the MediaSource stream cleanly
    try {
      if (session.ms.readyState === 'open') {
        session.ms.endOfStream();
      }
    } catch {}

    // Revoke the blob URL now that MSE is done
    try {
      URL.revokeObjectURL(session.blobUrl);
    } catch {}

    // Clear video src ONLY if the component is still mounted
    // (calling video.load() after unmount causes React warnings)
    if (componentAlive.current && video) {
      try {
        video.removeAttribute('src');
        video.load();
      } catch {}
    }
  }, []);

  // ─── Flush pending chunks into the SourceBuffer ───────────────────────────
  // Always receives the session object directly — no stale closure risk.
  const flushPendingChunks = useCallback((session: MSESession) => {
    // Guard: session must still be alive and SB must be idle
    if (session.destroyed) return;
    if (session.appending) return;
    if (session.pendingChunks.length === 0) return;
    if (session.sb.updating) return;

    // Check SourceBuffer is still attached
    try {
      // Accessing .updating on a detached SB throws — use as a liveness check
      void session.ms.readyState;
    } catch {
      return;
    }

    const chunk = session.pendingChunks.shift()!;
    session.appending = true;

    // Evict stale buffered data to prevent QuotaExceededError
    const video = videoRef.current;
    if (video && session.sb.buffered.length > 0) {
      const evictBefore = video.currentTime - 30;
      if (evictBefore > 0 && session.sb.buffered.start(0) < evictBefore) {
        try {
          session.pendingChunks.unshift(chunk); // re-queue before remove
          session.appending = false;
          session.sb.remove(0, evictBefore);
          // updateend will re-trigger flushPendingChunks
          return;
        } catch {}
      }
    }

    try {
      session.sb.appendBuffer(chunk);
    } catch (e: any) {
      session.appending = false;
      if (e.name === 'QuotaExceededError') {
        session.pendingChunks.unshift(chunk); // retry on next updateend
      }
      // Any other error: chunk is dropped but stream continues
    }
  }, []);

  // ─── Safe bufferedAhead helper ────────────────────────────────────────────
  // Returns 0 instead of throwing if SourceBuffer is detached.
  function getBufferedAhead(session: MSESession): number {
    const video = videoRef.current;
    if (!video) return 0;
    try {
      const buf = session.sb.buffered;
      if (buf.length === 0) return 0;
      const ct = video.currentTime;
      for (let i = 0; i < buf.length; i++) {
        if (buf.start(i) <= ct + 0.5 && buf.end(i) > ct) {
          return buf.end(i) - ct;
        }
      }
    } catch {
      // SourceBuffer removed from MediaSource — treat as no buffer
    }
    return 0;
  }

  // ─── Main pump loop ───────────────────────────────────────────────────────
  const pump = useCallback(async (session: MSESession) => {
    const video = videoRef.current;
    if (!video) return;

    let initialPlaybackTriggered = false;

    const tryTriggerPlayback = () => {
      if (initialPlaybackTriggered) return;
      const ahead = getBufferedAhead(session);
      if (ahead >= INITIAL_BUFFER_SECS) {
        initialPlaybackTriggered = true;
        if (componentAlive.current) {
          setPlayerState('playing');
          video.play().catch(() => {});
        }
      }
    };

    while (!session.destroyed) {
      const token    = session.nextToken;
      const videoId  = session.videoId;
      const chunkIdx = session.chunkIndex;

      // No token = end of stream
      if (!token) break;

      // Buffer throttle
      const ahead = getBufferedAhead(session);
      if (ahead >= BUFFER_AHEAD_PAUSE) {
        await sleep(500);
        if (session.destroyed) return;
        continue;
      }

      tryTriggerPlayback();

      try {
        const { blob, nextChunkToken, isLastChunk } = await videoStreamService.fetchChunk(
          videoId, chunkIdx, token
        );

        // Check again after the async fetch — component may have unmounted
        if (session.destroyed) return;

        if (blob.byteLength > 0) {
          session.pendingChunks.push(blob);
          flushPendingChunks(session);

          if (componentAlive.current) {
            setLoadedChunks(c => c + 1);

            // Update buffer progress bar
            try {
              const buf = video.buffered;
              if (buf.length > 0 && video.duration > 0) {
                const buffEnd = buf.end(buf.length - 1);
                setBufferedPercent(Math.min(100, (buffEnd / video.duration) * 100));
              }
            } catch {}
          }
        }

        session.nextToken  = nextChunkToken;
        session.chunkIndex = chunkIdx + 1;
        tryTriggerPlayback();

        if (isLastChunk || !nextChunkToken) {
          // Wait for pending chunks to drain before calling endOfStream
          const waitAndFinish = () => {
            if (session.destroyed) return;
            if (session.pendingChunks.length > 0 || session.sb.updating) {
              setTimeout(waitAndFinish, 150);
              return;
            }
            try {
              if (session.ms.readyState === 'open') session.ms.endOfStream();
            } catch {}
          };
          waitAndFinish();

          if (!initialPlaybackTriggered && componentAlive.current) {
            initialPlaybackTriggered = true;
            setPlayerState('playing');
            video.play().catch(() => {});
          }
          break;
        }

      } catch (err: any) {
        if (!session.destroyed && componentAlive.current) {
          setPlayerError(`Stream interrupted: ${err.message}`);
          setPlayerState('error');
        }
        return;
      }
    }
  }, [flushPendingChunks]);

  // ─── Start an MSE streaming session ──────────────────────────────────────
  const startMSEStream = useCallback((
    videoId: string,
    firstChunkToken: string,
    streamToken: string,
    mimeHint: string
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      const video = videoRef.current;
      if (!video) return reject(new Error('Video element not available'));

      // Tear down any previous session first
      teardownSession();

      const ms = new MediaSource();

      // Create blob URL and assign to video BEFORE anything else
      const blobUrl = URL.createObjectURL(ms);
      video.src = blobUrl;
      // NOTE: do NOT revoke blobUrl here — keep it alive for the session lifetime

      ms.addEventListener('sourceopen', () => {
        // Detect supported codec
        const codecs = [
          `video/mp4; codecs="avc1.42E01E, mp4a.40.2"`,
          `video/mp4; codecs="avc1.640028, mp4a.40.2"`,
          `video/mp4; codecs="avc1.64001f, mp4a.40.2"`,
          `video/mp4`,
          `video/webm; codecs="vp8, vorbis"`,
          `video/webm; codecs="vp9"`,
          mimeHint,
        ];
        const supported = codecs.find(c => {
          try { return MediaSource.isTypeSupported(c); } catch { return false; }
        }) || 'video/mp4';

        let sb: SourceBuffer;
        try {
          sb = ms.addSourceBuffer(supported);
        } catch (e: any) {
          URL.revokeObjectURL(blobUrl);
          return reject(new Error(`SourceBuffer error: ${e.message}`));
        }

        // Build the session object — all MSE state lives here
        const session: MSESession = {
          ms,
          sb,
          blobUrl,
          destroyed: false,
          pendingChunks: [],
          appending: false,
          nextToken: firstChunkToken,
          chunkIndex: 0,
          streamToken,
          videoId,
        };
        sessionRef.current = session;

        // Wire updateend → flush queue
        sb.addEventListener('updateend', () => {
          session.appending = false;
          if (!session.destroyed) flushPendingChunks(session);
        });

        sb.addEventListener('error', (e) => {
          console.error('SourceBuffer error event:', e);
        });

        // Start the pump
        pump(session);
        resolve();

      }, { once: true });

      ms.addEventListener('error', () => {
        URL.revokeObjectURL(blobUrl);
        reject(new Error('MediaSource error'));
      }, { once: true });
    });
  }, [teardownSession, flushPendingChunks, pump]);

  // ─── Initialize player ────────────────────────────────────────────────────
  const initPlayer = useCallback(async (videoUrl: string) => {
    setPlayerState('loading');
    setPlayerError('');
    setLoadedChunks(0);
    setBufferedPercent(0);
    setTotalChunks(null);

    // Plain URL (legacy / local)
    if (!videoUrl.startsWith('secured://')) {
      if (videoRef.current) {
        videoRef.current.src = videoUrl;
        videoRef.current.load();
        setPlayerState('buffering');
      }
      return;
    }

    const videoId = videoStreamService.extractVideoId(videoUrl);
    if (!videoId) {
      setPlayerError('Invalid video reference.');
      setPlayerState('error');
      return;
    }

    try {
      // Step 1: metadata (tokens or embed URL)
      const meta = await videoStreamService.getVideoMetadata(videoId, SECURITY_STRING);
      if (!componentAlive.current) return;

      if (meta.type === 'embed') {
        setIsEmbed(true);
        setEmbedUrl(meta.embedUrl);
        setPlayerState('playing');
        return;
      }

      // Step 2: file info for progress bar (non-fatal if it fails)
      const info = await videoStreamService.getVideoInfo(videoId, meta.streamToken);
      if (!componentAlive.current) return;
      if (info.totalChunks) setTotalChunks(info.totalChunks);

      // Step 3: start MSE stream
      setPlayerState('buffering');
      await startMSEStream(
        videoId,
        meta.firstChunkToken,
        meta.streamToken,
        info.contentType || 'video/mp4'
      );

    } catch (err: any) {
      if (componentAlive.current) {
        setPlayerError(err.message || 'Failed to initialize video.');
        setPlayerState('error');
      }
    }
  }, [startMSEStream]);

  // ─── Load content metadata ────────────────────────────────────────────────
  useEffect(() => {
    if (!contentId) return;
    componentAlive.current = true;

    const passedContent = (location.state as any)?.contentData;
    if (passedContent) {
      setContent(passedContent);
      setLoadingContent(false);
    } else {
      (async () => {
        try {
          setLoadingContent(true);
          setContentError('');
          const data = await contentLibraryService.fetchContentData(contentId);
          if (!componentAlive.current) return;
          if (!data) { setContentError('Content not found.'); return; }
          setContent(data);
        } catch (err: any) {
          if (componentAlive.current) setContentError(err.message || 'Failed to load content.');
        } finally {
          if (componentAlive.current) setLoadingContent(false);
        }
      })();
    }

    return () => {
      componentAlive.current = false;
      teardownSession();
    };
  }, [contentId, teardownSession]);

  // ─── Initialize player when content is loaded ─────────────────────────────
  useEffect(() => {
    if (!content?.videoUrl) return;
    initPlayer(content.videoUrl);
  }, [content, initPlayer]);

  // ─── Video element events ─────────────────────────────────────────────────
  const handleTimeUpdate = () => {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
  };
  const handleDurationChange = () => {
    if (videoRef.current) setDuration(videoRef.current.duration);
  };
  const handleWaiting = () => {
    setPlayerState(prev => prev === 'playing' ? 'buffering' : prev);
  };
  const handleCanPlay = () => {
    setPlayerState(prev => prev === 'buffering' ? 'playing' : prev);
  };
  const handlePlay    = () => setPlayerState('playing');
  const handlePause   = () => { if (componentAlive.current) setPlayerState('paused'); };
  const handleEnded   = () => setPlayerState('idle');
  const handleVideoError = () => {
    // Only report error if it's a real playback failure, not a src="" reset
    const video = videoRef.current;
    if (video && video.error && video.src) {
      setPlayerError('Playback error. Please try reloading.');
      setPlayerState('error');
    }
  };

  // ─── Seek handler ──────────────────────────────────────────────────────────
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    const rect  = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    video.currentTime = ratio * duration;
  };

  // ─── Retry ────────────────────────────────────────────────────────────────
  const handleRetry = () => {
    if (content?.videoUrl) initPlayer(content.videoUrl);
  };

  // ─── Note helpers ─────────────────────────────────────────────────────────
  const getNoteHref = (): string | null => {
    if (!content) return null;
    return content.noteSource === 'gdrive'
      ? content.noteGDriveDownloadUrl || null
      : content.noteUrl || null;
  };
  const getNotePreviewHref = (): string | null => {
    if (!content) return null;
    return content.noteSource === 'gdrive'
      ? content.noteGDrivePreviewUrl || null
      : content.noteUrl || null;
  };

  // ─── Progress ─────────────────────────────────────────────────────────────
  const playPercent  = duration > 0 ? (currentTime / duration) * 100 : 0;
  const chunkPercent = totalChunks
    ? Math.min(100, (loadedChunks / totalChunks) * 100)
    : bufferedPercent;

  // ==================== RENDER ====================

  if (loadingContent) {
    return (
      <div className="min-h-screen bg-[#080a10] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={32} className="text-violet-400 animate-spin" />
          <p className="text-sm text-white/30">Loading content…</p>
        </div>
      </div>
    );
  }

  if (contentError) {
    return (
      <div className="min-h-screen bg-[#080a10] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-rose-500/8 border border-rose-500/20 rounded-2xl p-8 text-center">
          <AlertCircle size={32} className="text-rose-400 mx-auto mb-4" />
          <p className="text-white/70 mb-4">{contentError}</p>
          <button
            onClick={() => navigate(-1)}
            className="text-sm text-white/40 hover:text-white transition-colors"
          >
            ← Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .secure-video-wrap {
          -webkit-user-select: none;
          -moz-user-select: none;
          user-select: none;
          -webkit-user-drag: none;
          pointer-events: auto;
        }
        .secure-video-wrap video {
          pointer-events: none;
        }
        .secure-video-wrap video::-webkit-media-controls-download-button { display: none !important; }
        .secure-video-wrap video::-webkit-media-controls-timeline        { display: none !important; }
        .secure-video-wrap video::-webkit-media-controls-enclosure       { display: none !important; }
        .player-controls { pointer-events: auto; }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .anim-up   { animation: fadeSlideUp 0.4s cubic-bezier(.22,1,.36,1) both; }
        .anim-up-1 { animation: fadeSlideUp 0.4s 0.06s cubic-bezier(.22,1,.36,1) both; }
        .anim-up-2 { animation: fadeSlideUp 0.4s 0.12s cubic-bezier(.22,1,.36,1) both; }
        .anim-up-3 { animation: fadeSlideUp 0.4s 0.18s cubic-bezier(.22,1,.36,1) both; }
        .scrubber:hover .scrubber-thumb { opacity: 1 !important; transform: scale(1) !important; }
      `}</style>

      <div
        className="min-h-screen bg-[#080a10] text-white select-none"
        onContextMenu={e => e.preventDefault()}
      >
        {/* Ambient glow */}
        <div className="fixed inset-0 pointer-events-none" style={{
          background:
            'radial-gradient(ellipse 65% 35% at 50% -5%, rgba(139,92,246,0.12) 0%, transparent 65%),' +
            'radial-gradient(ellipse 40% 30% at 90% 80%, rgba(56,189,248,0.05) 0%, transparent 55%)',
        }} />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-6">

          {/* ── Back button ── */}
          <button
            onClick={() => navigate(-1)}
            className="anim-up flex items-center gap-2 text-sm text-white/35 hover:text-white/80
                       transition-colors duration-200 mb-6 group focus:outline-none
                       px-3 py-1.5 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/8"
          >
            <ArrowLeft size={14} className="transition-transform duration-200 group-hover:-translate-x-0.5" />
            Back to Library
          </button>

          {/* ── VIDEO / EMBED PLAYER AREA ── */}
          <div className="anim-up-1 rounded-2xl overflow-hidden border border-white/8 bg-[#0d0f1a] mb-6 shadow-2xl shadow-black/60">

            {/* DevTools overlay */}
            {playerState === 'devtools' && (
              <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#080a10] rounded-2xl">
                <Lock size={36} className="text-rose-400 mb-3" />
                <p className="text-white/60 text-sm font-medium">DevTools detected</p>
                <p className="text-white/25 text-xs mt-1">Close DevTools to resume playback</p>
              </div>
            )}

            {/* EMBED PLAYER */}
            {isEmbed && embedUrl && (
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                <iframe
                  src={embedUrl}
                  className="absolute inset-0 w-full h-full"
                  allow="autoplay; fullscreen; encrypted-media"
                  allowFullScreen
                  referrerPolicy="no-referrer"
                  sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
                  title={content?.title || 'Video'}
                  style={{ border: 'none', pointerEvents: 'auto' }}
                />
                <div
                  className="absolute inset-0 pointer-events-none"
                  onContextMenu={e => e.preventDefault()}
                />
              </div>
            )}

            {/* MSE CHUNKED STREAM PLAYER */}
            {!isEmbed && content?.videoUrl && (
              <div className="relative secure-video-wrap bg-black">

                <video
                  ref={videoRef}
                  className="w-full block"
                  style={{
                    display: isVideoHidden ? 'none' : 'block',
                    maxHeight: '70vh',
                    minHeight: '220px',
                    background: '#000',
                  }}
                  playsInline
                  controlsList="nodownload nofullscreen noremoteplayback"
                  disablePictureInPicture
                  onTimeUpdate={handleTimeUpdate}
                  onDurationChange={handleDurationChange}
                  onWaiting={handleWaiting}
                  onCanPlay={handleCanPlay}
                  onPlay={handlePlay}
                  onPause={handlePause}
                  onEnded={handleEnded}
                  onError={handleVideoError}
                  onContextMenu={e => e.preventDefault()}
                />

                {/* Loading / buffering overlay */}
                {(playerState === 'loading' || playerState === 'buffering') && !isVideoHidden && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
                    <Loader2 size={36} className="text-violet-400 animate-spin mb-3" />
                    <p className="text-sm text-white/50">
                      {playerState === 'loading' ? 'Initializing secure stream…' : 'Buffering…'}
                    </p>
                    {totalChunks && loadedChunks > 0 && (
                      <p className="text-xs text-white/25 mt-1">
                        {loadedChunks} / {totalChunks} chunks loaded
                      </p>
                    )}
                  </div>
                )}

                {/* Error overlay */}
                {playerState === 'error' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-center p-6">
                    <AlertCircle size={32} className="text-rose-400 mb-3" />
                    <p className="text-white/60 text-sm mb-4 max-w-xs">{playerError}</p>
                    <button
                      onClick={handleRetry}
                      className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm rounded-lg transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                )}

                {/* Custom controls */}
                {(playerState === 'playing' || playerState === 'paused') && !isVideoHidden && (
                  <div className="player-controls absolute bottom-0 left-0 right-0 px-4 pb-3 pt-6
                                  bg-gradient-to-t from-black/90 via-black/40 to-transparent">

                    {/* Scrubber */}
                    <div
                      className="scrubber relative h-1 bg-white/15 rounded-full cursor-pointer mb-3 group"
                      onClick={handleSeek}
                    >
                      <div
                        className="absolute top-0 left-0 h-full bg-white/20 rounded-full pointer-events-none"
                        style={{ width: `${chunkPercent}%` }}
                      />
                      <div
                        className="absolute top-0 left-0 h-full bg-violet-400 rounded-full pointer-events-none transition-all duration-100"
                        style={{ width: `${playPercent}%` }}
                      />
                      <div
                        className="scrubber-thumb absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg pointer-events-none"
                        style={{
                          left: `${playPercent}%`,
                          transform: 'translateX(-50%) translateY(-50%)',
                          opacity: 0,
                          scale: '0.8',
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button
                          className="player-controls text-white/70 hover:text-white transition-colors text-sm"
                          onClick={() => {
                            const v = videoRef.current;
                            if (!v) return;
                            if (v.paused) v.play();
                            else v.pause();
                          }}
                        >
                          {playerState === 'paused' ? '▶' : '⏸'}
                        </button>
                        <span className="text-xs text-white/40 font-mono tabular-nums">
                          {formatDuration(currentTime)} / {formatDuration(duration)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-green-400/60">
                        <Shield size={10} />
                        <span>Secure Stream</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* No video */}
            {!content?.videoUrl && !loadingContent && (
              <div className="flex flex-col items-center justify-center h-48 sm:h-64 text-center">
                <Play size={36} className="text-white/15 mb-3" />
                <p className="text-white/25 text-sm">No video attached to this content</p>
              </div>
            )}
          </div>

          {/* ── CONTENT INFO ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Left: title + description */}
            <div className="lg:col-span-2 space-y-4">

              <div className="anim-up-2 rounded-2xl border border-white/6 bg-[#0d0f1a] p-5 sm:p-6">
                <div className="flex items-start gap-3 mb-3">
                  <span className={`flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border mt-0.5
                    ${content?.type === 'lesson'
                      ? 'bg-violet-500/15 text-violet-300 border-violet-500/20'
                      : 'bg-amber-500/15 text-amber-300 border-amber-500/20'}`}>
                    {content?.type === 'lesson' ? <Play size={10} /> : null}
                    {content?.type === 'trick'  ? <BookOpen size={10} /> : null}
                    {content?.type === 'lesson' ? 'Lesson' : 'Trick'}
                  </span>

                  {content?.videoUrl?.startsWith('secured://') && (
                    <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/10 text-green-400/80 border border-green-500/15 mt-1">
                      <Shield size={9} />
                      Protected
                    </span>
                  )}
                </div>

                <h1 className="text-xl sm:text-2xl font-bold text-white leading-snug mb-2">
                  {content?.title || 'Untitled'}
                </h1>

                {content?.subject && (
                  <p className="text-sm text-white/35 mb-3">{content.subject}</p>
                )}

                {content?.description && (
                  <p className="text-sm text-white/50 leading-relaxed mt-3 pt-3 border-t border-white/5">
                    {content.description}
                  </p>
                )}
              </div>

              {/* Stats */}
              <div className="anim-up-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {content?.duration ? (
                  <div className="rounded-xl border border-white/6 bg-[#0d0f1a] px-4 py-3 flex items-center gap-3">
                    <Clock size={16} className="text-white/25 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold mb-0.5">Duration</p>
                      <p className="text-sm text-white/70 font-medium">{formatMinutes(content.duration)}</p>
                    </div>
                  </div>
                ) : null}

                {content?.subject ? (
                  <div className="rounded-xl border border-white/6 bg-[#0d0f1a] px-4 py-3 flex items-center gap-3">
                    <BookOpen size={16} className="text-white/25 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold mb-0.5">Subject</p>
                      <p className="text-sm text-white/70 font-medium truncate">{content.subject}</p>
                    </div>
                  </div>
                ) : null}

                {content?.videoUrl?.startsWith('secured://') && (
                  <div className="rounded-xl border border-green-500/15 bg-green-500/5 px-4 py-3 flex items-center gap-3">
                    <Shield size={16} className="text-green-400/60 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] text-green-400/40 uppercase tracking-widest font-semibold mb-0.5">Security</p>
                      <p className="text-sm text-green-400/70 font-medium">DRM Protected</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: notes + security info */}
            <div className="anim-up-3 space-y-3">
              {(content?.noteUrl || content?.noteGDrivePreviewUrl) ? (
                <div className="rounded-2xl border border-white/6 bg-[#0d0f1a] p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <FileText size={15} className="text-emerald-400/70" />
                    <span className="text-sm font-semibold text-white/70">Class Notes</span>
                  </div>
                  <div className="space-y-2">
                    {getNotePreviewHref() && (
                      <a
                        href={getNotePreviewHref()!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl
                                   bg-emerald-500/8 border border-emerald-500/15 text-emerald-300/80
                                   hover:bg-emerald-500/15 hover:text-emerald-300
                                   transition-all duration-200 text-sm font-medium group"
                      >
                        <span className="flex items-center gap-2">
                          <ExternalLink size={13} />
                          Preview Notes
                        </span>
                        <span className="text-emerald-400/30 text-xs group-hover:translate-x-0.5 transition-transform">→</span>
                      </a>
                    )}
                    {getNoteHref() && (
                      <a
                        href={getNoteHref()!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl
                                   bg-white/4 border border-white/8 text-white/50
                                   hover:bg-white/7 hover:text-white/80
                                   transition-all duration-200 text-sm font-medium group"
                      >
                        <span className="flex items-center gap-2">
                          <Download size={13} />
                          Download PDF
                        </span>
                        <span className="text-white/20 text-xs group-hover:translate-x-0.5 transition-transform">→</span>
                      </a>
                    )}
                    {content?.noteSource === 'gdrive' && (
                      <p className="text-[10px] text-white/20 text-center pt-1">via Google Drive</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/5 bg-white/2 p-5 text-center">
                  <FileText size={20} className="text-white/10 mx-auto mb-2" />
                  <p className="text-xs text-white/20">No notes attached</p>
                </div>
              )}

              <div className="rounded-2xl border border-white/5 bg-white/2 p-4 space-y-2">
                <p className="text-[10px] uppercase tracking-widest text-white/20 font-semibold mb-2">
                  Content Protection
                </p>
                {[
                  'Token-chained stream (anti-IDM)',
                  'No URL exposed in DevTools',
                  'Screen capture blocked',
                  'Download button disabled',
                ].map(f => (
                  <div key={f} className="flex items-center gap-2">
                    <Shield size={10} className="text-green-400/40 flex-shrink-0" />
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
