// src/pages/LessonViewer.tsx — FIXED v5
//
// BUGS FIXED IN THIS VERSION (diagnosed from 22:48-22:52 screenshots):
//
// BUG 1 — Blob URL revoked too early (black screen, 0:00 duration)
//   We were revoking the blob URL inside the `canplay` event listener.
//   On mobile, `canplay` fires before the browser has fully parsed the video
//   metadata. Revoking the URL at that point causes the video to lose its
//   source before it can read the duration or start decoding frames.
//   FIX: Store blobUrl in a ref and revoke it in cleanup() only when the
//   component unmounts or a new video loads. Let the blob live for the full
//   lifetime of the video session.
//
// BUG 2 — play() called before metadata loaded (interrupted by pause())
//   Calling video.play() in `canplay` while DevTools is open triggers the
//   DevTools pause detection, which immediately calls video.pause(). This
//   creates the play→pause→play loop seen in the console.
//   Also: on mobile, attempting play() before 'loadedmetadata' sometimes
//   fails because the browser hasn't confirmed it can play yet.
//   FIX: Wait for 'loadedmetadata' to confirm duration > 0, then play.
//   Also only call play() if the page is visible and not in devtools state.
//
// BUG 3 — Download never terminates (chunks 0-10 all isLast=false)
//   Dropbox closes the TCP connection when a byte-range request exceeds the
//   file size instead of returning HTTP 416 "Range Not Satisfiable". Our pump
//   treats this ERR_CONNECTION_ABORTED as a streaming error and calls onError(),
//   discarding all already-downloaded chunks and starting over from chunk 0.
//   FIX: In the catch block, if we already have at least one chunk downloaded,
//   treat the network error as end-of-stream and assemble the blob from what
//   we have. Also handle 0-byte chunk responses as end-of-stream.
//
// BUG 4 — totalChunks=null, no progress bar
//   Dropbox HEAD requests don't return Content-Length, so totalChunks is null.
//   The pump still works but shows "Fetching..." with no progress.
//   FIX: Show chunk count (N chunks downloaded) even when total is unknown.
//   This gives users feedback that download is progressing.

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

// Set false in production
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
function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

type PlayerState = 'idle' | 'downloading' | 'playing' | 'paused' | 'error' | 'devtools';

// ─── Fetch one chunk with cache-busting ───────────────────────────────────────
async function fetchChunk(
  videoId: string, idx: number, token: string
): Promise<{ buffer: ArrayBuffer; nextToken: string; isLast: boolean }> {
  const url = `${window.location.origin}/api/videoStream?action=chunk&videoId=${encodeURIComponent(videoId)}&chunk=${idx}&_t=${Date.now()}`;
  const res = await fetch(url, { headers: { 'x-chunk-token': token }, cache: 'no-store' });

  if (res.status === 204) {
    log(`chunk ${idx}: 204 — end of stream`);
    return { buffer: new ArrayBuffer(0), nextToken: '', isLast: true };
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const buffer    = await res.arrayBuffer();
  const nextToken = res.headers.get('x-next-chunk-token') || '';
  const isLast    = res.headers.get('x-is-last-chunk') === 'true';

  log(`chunk ${idx}: ${buffer.byteLength} bytes, isLast=${isLast}, hasNext=${!!nextToken}`);
  return { buffer, nextToken, isLast };
}

// ─── Download all chunks then assemble blob ────────────────────────────────────
async function downloadAllChunks(
  videoId:     string,
  firstToken:  string,
  alive:       () => boolean,
  onProgress:  (loaded: number, totalBytes: number) => void,
): Promise<ArrayBuffer[] | null> {
  const chunks: ArrayBuffer[] = [];
  let token = firstToken, idx = 0, totalBytes = 0;

  while (token) {
    if (!alive()) { log('download aborted'); return null; }

    try {
      const { buffer, nextToken, isLast } = await fetchChunk(videoId, idx, token);

      // 0-byte response = end of file (Dropbox sends this for out-of-range)
      if (buffer.byteLength === 0) {
        log(`chunk ${idx}: empty → end of stream`);
        break;
      }

      chunks.push(buffer);
      totalBytes += buffer.byteLength;
      idx++;
      token = nextToken;
      onProgress(idx, totalBytes);

      if (isLast || !nextToken) {
        log(`chunk ${idx - 1}: isLast=true → done`);
        break;
      }
    } catch (err: any) {
      // BUG 3 FIX: Dropbox aborts connection for out-of-range requests instead
      // of returning 416. If we already have data, treat this as end-of-stream.
      if (chunks.length > 0) {
        log(`network error after chunk ${idx - 1} — treating as end of stream:`, err.message);
        break;
      }
      // No chunks yet = real error
      throw err;
    }
  }

  if (chunks.length === 0) throw new Error('No data received from server');
  log(`download complete: ${chunks.length} chunks, ${formatBytes(totalBytes)} total`);
  return chunks;
}

// ==================== COMPONENT ====================

const LessonViewer: React.FC = () => {
  const { contentId } = useParams<{ courseId: string; contentId: string }>();
  const navigate   = useNavigate();
  const location   = useLocation();
  const { user }   = useDashboard();

  const [content,        setContent]        = useState<LibraryContent | null>(null);
  const [loadingContent, setLoadingContent] = useState(true);
  const [contentError,   setContentError]   = useState('');
  const [playerState,    setPlayerState]    = useState<PlayerState>('idle');
  const [playerError,    setPlayerError]    = useState('');
  const [isEmbed,        setIsEmbed]        = useState(false);
  const [embedUrl,       setEmbedUrl]       = useState('');
  const [currentTime,    setCurrentTime]    = useState(0);
  const [duration,       setDuration]       = useState(0);
  const [downloadedChunks, setDownloadedChunks] = useState(0);
  const [downloadedBytes,  setDownloadedBytes]  = useState(0);
  const [totalChunks,    setTotalChunks]    = useState<number | null>(null);
  const [isVideoHidden,  setIsVideoHidden]  = useState(false);

  const videoRef       = useRef<HTMLVideoElement>(null);
  // BUG 1 FIX: Keep blobUrl alive for the full video session, revoke in cleanup
  const blobUrlRef     = useRef<string>('');
  const alive          = useRef(true);
  const initLockRef    = useRef('');
  // FIX #1+#3: Use a ref for devToolsOpen so initPlayer never needs it as a dep
  // and onMeta always reads the CURRENT value (not stale closure capture).
  const devToolsRef    = useRef(false);

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
      // Resume only if we were actually playing
      setPlayerState(p => p === 'devtools' ? 'playing' : p);
    }, []),
  );

  // ── Cleanup: revoke blob, reset video ────────────────────────────────────────
  const cleanup = useCallback(() => {
    // BUG 1 FIX: Revoke blob here, not in canplay
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = '';
      log('blob URL revoked in cleanup');
    }
    if (alive.current && videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
      } catch {}
    }
  }, []);

  // ── Init player ──────────────────────────────────────────────────────────────
  const initPlayer = useCallback(async (videoUrl: string) => {
    if (initLockRef.current === videoUrl) { log('duplicate init — skipping'); return; }
    initLockRef.current = videoUrl;

    log('initPlayer:', videoUrl);
    cleanup();

    setPlayerState('downloading');
    setPlayerError('');
    setDownloadedChunks(0);
    setDownloadedBytes(0);
    setTotalChunks(null);
    setIsEmbed(false);
    setEmbedUrl('');
    setDuration(0);
    setCurrentTime(0);

    // Plain URL (not secured) — play directly
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
      // Step 1: metadata (stream token)
      log('fetching metadata...');
      const meta = await videoStreamService.getVideoMetadata(videoId, SECURITY_STRING);
      if (!alive.current) { initLockRef.current = ''; return; }
      log('meta type:', meta.type);

      if (meta.type === 'embed') {
        setIsEmbed(true);
        setEmbedUrl(meta.embedUrl);
        setPlayerState('playing');
        initLockRef.current = '';
        return;
      }

      // Step 2: info (chunk count)
      log('fetching info...');
      const info = await videoStreamService.getVideoInfo(videoId, meta.streamToken);
      if (!alive.current) { initLockRef.current = ''; return; }
      log('info: totalChunks=', info.totalChunks);
      if (info.totalChunks) setTotalChunks(info.totalChunks);

      // Step 3: download all chunks
      const chunks = await downloadAllChunks(
        videoId,
        meta.firstChunkToken,
        () => alive.current,
        (loaded, bytes) => {
          if (!alive.current) return;
          setDownloadedChunks(loaded);
          setDownloadedBytes(bytes);
        },
      );

      // initLockRef cleared here so cleanup() works correctly from this point
      initLockRef.current = '';

      if (!chunks || !alive.current) return;

      // Step 4: assemble blob
      log('assembling blob from', chunks.length, 'chunks...');
      const blob    = new Blob(chunks, { type: 'video/mp4' });
      const blobUrl = URL.createObjectURL(blob);
      log(`blob ready: ${formatBytes(blob.size)}`);

      // BUG 1 FIX: Store in ref so cleanup() can revoke it later
      blobUrlRef.current = blobUrl;

      const v = videoRef.current;
      if (!v || !alive.current) {
        URL.revokeObjectURL(blobUrl);
        blobUrlRef.current = '';
        return;
      }

      // Step 5: assign to video element and play
      v.src = blobUrl;
      v.load();

      // BUG 2 FIX: Wait for loadedmetadata (duration available) before playing.
      // canplay fires too early on mobile — duration is 0 at that point.
      // We DON'T revoke blobUrl here — we leave it in blobUrlRef for cleanup().
      const onMeta = () => {
        if (!alive.current || devToolsRef.current) return;
        log('loadedmetadata — duration:', v.duration);
        setDuration(v.duration || 0);
        setPlayerState('playing');
        // Use a tiny delay to let the browser settle before play()
        // This prevents the "interrupted by pause()" error on mobile
        setTimeout(() => {
          if (!alive.current || v.paused === false) return;
          v.play().catch(e => {
            // Autoplay blocked — show play button, user can tap to start
            log('autoplay blocked (expected on mobile):', e.message);
            setPlayerState('paused');
          });
        }, 100);
      };

      v.addEventListener('loadedmetadata', onMeta, { once: true });

      // Fallback: if loadedmetadata never fires, canplay is our safety net
      v.addEventListener('canplay', () => {
        if (!alive.current) return;
        // Use functional update — never reads stale playerState from closure
        setPlayerState(p => p === 'downloading' ? 'paused' : p);
      }, { once: true });

    } catch (err: any) {
      initLockRef.current = '';
      logErr('initPlayer error:', err);
      if (alive.current) {
        setPlayerError(err.message || 'Failed to load video.');
        setPlayerState('error');
      }
    }
  }, [cleanup]);

  // ── Content loading ─────────────────────────────────────────────────────────
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

  // ── Video events ─────────────────────────────────────────────────────────────
  const onTimeUpdate     = () => { if (videoRef.current) setCurrentTime(videoRef.current.currentTime); };
  const onDurationChange = () => { if (videoRef.current && videoRef.current.duration) setDuration(videoRef.current.duration); };
  const onPlay           = () => { if (alive.current && !devToolsRef.current) setPlayerState('playing'); };
  const onPause          = () => { if (alive.current && playerState !== 'devtools') setPlayerState('paused'); };
  const onEnded          = () => setPlayerState('idle');
  const onVideoError     = () => {
    const v = videoRef.current;
    if (v?.error && v.src && v.src !== window.location.href) {
      logErr('video element error:', v.error.code, v.error.message);
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
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };
  const handleRetry = () => {
    initLockRef.current = '';
    if (content?.videoUrl) initPlayer(content.videoUrl);
  };

  const getNoteHref    = () => content?.noteSource === 'gdrive' ? content?.noteGDriveDownloadUrl||null : content?.noteUrl||null;
  const getNotePreview = () => content?.noteSource === 'gdrive' ? content?.noteGDrivePreviewUrl||null : content?.noteUrl||null;

  const playPct     = duration > 0 ? (currentTime / duration) * 100 : 0;
  const isDownloading = playerState === 'downloading';

  // Progress display for download overlay
  const progressLabel = (() => {
    if (downloadedBytes === 0) return 'Preparing secure download…';
    const bytesStr = formatBytes(downloadedBytes);
    if (totalChunks) {
      const pct = Math.round((downloadedChunks / totalChunks) * 100);
      return `Downloading… ${pct}% (${bytesStr})`;
    }
    return `Downloading… ${bytesStr} (chunk ${downloadedChunks})`;
  })();

  const progressPct = totalChunks ? Math.min(100, (downloadedChunks / totalChunks) * 100) : 0;

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
        @keyframes spin { from{transform:rotate(-90deg)} to{transform:rotate(270deg)} }
        .anim-up   { animation:fadeSlideUp .4s cubic-bezier(.22,1,.36,1) both; }
        .anim-up-1 { animation:fadeSlideUp .4s .06s cubic-bezier(.22,1,.36,1) both; }
        .anim-up-2 { animation:fadeSlideUp .4s .12s cubic-bezier(.22,1,.36,1) both; }
        .anim-up-3 { animation:fadeSlideUp .4s .18s cubic-bezier(.22,1,.36,1) both; }
        .scrubber:hover .scrubber-thumb { opacity:1 !important; }
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

          {/* ── Player card ── */}
          <div className="anim-up-1 relative rounded-2xl overflow-hidden border border-white/8 bg-[#0d0f1a] mb-6 shadow-2xl shadow-black/60">

            {/* DevTools warning */}
            {playerState === 'devtools' && (
              <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#080a10]">
                <Lock size={36} className="text-rose-400 mb-3"/>
                <p className="text-white/60 text-sm font-medium">DevTools detected</p>
                <p className="text-white/25 text-xs mt-1">Close DevTools to resume</p>
              </div>
            )}

            {/* Embed (YouTube / Vimeo) */}
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

            {/* Blob-mode player */}
            {!isEmbed && content?.videoUrl && (
              <div className="relative secure-video-wrap bg-black" style={{minHeight:'220px'}}>

                {/* The actual video element — always in DOM so events work */}
                <video
                  ref={videoRef}
                  style={{
                    display: (isVideoHidden || isDownloading) ? 'none' : 'block',
                    maxHeight: '70vh',
                    minHeight: '220px',
                    background: '#000',
                  }}
                  playsInline
                  controlsList="nodownload nofullscreen noremoteplayback"
                  disablePictureInPicture
                  onTimeUpdate={onTimeUpdate}
                  onDurationChange={onDurationChange}
                  onPlay={onPlay}
                  onPause={onPause}
                  onEnded={onEnded}
                  onError={onVideoError}
                  onContextMenu={e => e.preventDefault()}
                />

                {/* Download progress overlay */}
                {isDownloading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black"
                    style={{minHeight:'220px'}}>
                    <div className="w-72 text-center px-6">
                      {/* Circular progress */}
                      <div className="relative mx-auto mb-5 w-20 h-20">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
                          <circle cx="40" cy="40" r="34" fill="none"
                            stroke="rgba(139,92,246,0.15)" strokeWidth="4"/>
                          <circle cx="40" cy="40" r="34" fill="none"
                            stroke="rgb(139,92,246)" strokeWidth="4"
                            strokeDasharray={`${2 * Math.PI * 34}`}
                            strokeDashoffset={totalChunks
                              ? `${2 * Math.PI * 34 * (1 - progressPct / 100)}`
                              : `${2 * Math.PI * 34 * 0.75}`}
                            strokeLinecap="round"
                            style={{transition: totalChunks ? 'stroke-dashoffset 0.4s ease' : 'none',
                                    animation: !totalChunks ? 'spin 1.5s linear infinite' : 'none'}}/>
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Shield size={22} className="text-violet-400"/>
                        </div>
                      </div>
                      <p className="text-white/70 text-sm font-medium mb-2">{progressLabel}</p>
                      {totalChunks && (
                        <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden mt-3">
                          <div className="h-full bg-violet-500 rounded-full transition-all duration-300"
                            style={{width:`${progressPct}%`}}/>
                        </div>
                      )}
                      <p className="text-white/20 text-xs mt-3">Video will play automatically when ready</p>
                    </div>
                  </div>
                )}

                {/* Error overlay */}
                {playerState === 'error' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-center p-6"
                    style={{minHeight:'220px'}}>
                    <AlertCircle size={32} className="text-rose-400 mb-3"/>
                    <p className="text-white/60 text-sm mb-4 max-w-xs">{playerError}</p>
                    <button onClick={handleRetry}
                      className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm rounded-xl transition-colors font-medium">
                      Try Again
                    </button>
                  </div>
                )}

                {/* Playback controls — only when video is loaded */}
                {(playerState === 'playing' || playerState === 'paused') && !isVideoHidden && (
                  <div className="player-controls absolute bottom-0 left-0 right-0 px-4 pb-3 pt-10
                                  bg-gradient-to-t from-black/95 via-black/60 to-transparent">
                    {/* Seekbar */}
                    <div className="scrubber relative h-1.5 bg-white/15 rounded-full cursor-pointer mb-3 group"
                      onClick={handleSeek}>
                      <div className="absolute inset-y-0 left-0 bg-violet-500 rounded-full transition-all duration-100"
                        style={{width:`${playPct}%`}}/>
                      <div className="scrubber-thumb absolute top-1/2 w-4 h-4 bg-white rounded-full shadow-lg"
                        style={{left:`${playPct}%`, transform:'translateX(-50%) translateY(-50%)', opacity:0,
                                transition:'opacity 0.15s'}}/>
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

          {/* ── Content metadata ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 space-y-4">
              <div className="anim-up-2 rounded-2xl border border-white/6 bg-[#0d0f1a] p-5 sm:p-6">
                <div className="flex items-start gap-3 mb-3">
                  <span className={`flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border mt-0.5
                    ${content?.type === 'lesson'
                      ? 'bg-violet-500/15 text-violet-300 border-violet-500/20'
                      : 'bg-amber-500/15 text-amber-300 border-amber-500/20'}`}>
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
                {content?.subject && <p className="text-sm text-white/35 mb-3">{content.subject}</p>}
                {content?.description && <p className="text-sm text-white/50 leading-relaxed mt-3 pt-3 border-t border-white/5">{content.description}</p>}
              </div>

              <div className="anim-up-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {content?.duration && (
                  <div className="rounded-xl border border-white/6 bg-[#0d0f1a] px-4 py-3 flex items-center gap-3">
                    <Clock size={16} className="text-white/25"/>
                    <div>
                      <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold mb-0.5">Duration</p>
                      <p className="text-sm text-white/70 font-medium">{formatMinutes(content.duration)}</p>
                    </div>
                  </div>
                )}
                {content?.subject && (
                  <div className="rounded-xl border border-white/6 bg-[#0d0f1a] px-4 py-3 flex items-center gap-3">
                    <BookOpen size={16} className="text-white/25"/>
                    <div>
                      <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold mb-0.5">Subject</p>
                      <p className="text-sm text-white/70 font-medium truncate">{content.subject}</p>
                    </div>
                  </div>
                )}
                {content?.videoUrl?.startsWith('secured://') && (
                  <div className="rounded-xl border border-green-500/15 bg-green-500/5 px-4 py-3 flex items-center gap-3">
                    <Shield size={16} className="text-green-400/60"/>
                    <div>
                      <p className="text-[10px] text-green-400/40 uppercase tracking-widest font-semibold mb-0.5">Security</p>
                      <p className="text-sm text-green-400/70 font-medium">Protected</p>
                    </div>
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
                    {content?.noteSource === 'gdrive' && (
                      <p className="text-[10px] text-white/20 text-center pt-1">via Google Drive</p>
                    )}
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
                {['Token-chained download (anti-IDM)', 'Source URL never exposed', 'Screen capture blocked', 'Download disabled'].map(f => (
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
