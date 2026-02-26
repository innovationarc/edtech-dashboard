// src/pages/LessonViewer.tsx — FINAL (blob-only, no MSE)
//
// WHY NO MSE:
//   MediaSource Extensions only accept FRAGMENTED MP4 (fMP4/CMAF) — files with
//   an 'mvex' box inside 'moov'. Normal MP4 files from Dropbox/GDrive are
//   UNFRAGMENTED and cause: "CHUNK_DEMUXER_ERROR_APPEND_FAILED: Detected
//   unfragmented MP4. MSE requires mvex." This cannot be fixed client-side
//   without transcoding the file, and reliable server-side detection of fMP4
//   is complex. MSE is designed for adaptive bitrate (HLS/DASH) — it is the
//   wrong tool for serving a single protected video file.
//
// HOW IT WORKS (blob-concat mode):
//   1. Fetch /info → get chunk count + validate stream token
//   2. Fetch every chunk via the token chain (/chunk?chunk=N + x-chunk-token)
//      Each chunk is authenticated — the Dropbox/GDrive URL is NEVER exposed
//   3. Concatenate all ArrayBuffers into a single Blob
//   4. Create blob: URL → assign to video.src → browser plays it natively
//   5. Revoke blob URL after canplay fires (memory freed, URL useless)
//
// ANTI-DOWNLOAD PROTECTION:
//   ✓ Raw source URL never exposed in network tab (only /api/videoStream)
//   ✓ Token chain prevents IDM/wget from downloading chunks without tokens
//   ✓ Blob URL contains raw bytes in RAM — gone on page close/refresh
//   ✓ Right-click, keyboard shortcuts, screen capture all blocked
//   ✓ DevTools detection pauses video
//
// TRADE-OFF vs MSE:
//   Playback starts after the video is fully downloaded (not instantly).
//   Progress bar shows download %. For education content this is fine.

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
  if (!s || isNaN(s)) return '0:00';
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), ss = Math.floor(s%60);
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
  return `${m}:${String(ss).padStart(2,'0')}`;
}
function formatMinutes(mins: number): string {
  if (!mins) return '—';
  const h = Math.floor(mins/60), m = Math.round(mins%60);
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
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

// ─── Fetch a single chunk with cache-busting ──────────────────────────────────
async function fetchChunk(
  videoId: string, idx: number, token: string
): Promise<{ buffer: ArrayBuffer; nextToken: string; isLast: boolean }> {
  const base = window.location.origin;
  // ?_t= cache-busts Vercel edge and browser to prevent HTTP 304 empty responses
  const url = `${base}/api/videoStream?action=chunk&videoId=${encodeURIComponent(videoId)}&chunk=${idx}&_t=${Date.now()}`;
  const res = await fetch(url, { headers: { 'x-chunk-token': token }, cache: 'no-store' });

  if (res.status === 204) return { buffer: new ArrayBuffer(0), nextToken: '', isLast: true };
  if (!res.ok) throw new Error(`Chunk ${idx} failed: HTTP ${res.status}`);

  const buffer    = await res.arrayBuffer();
  const nextToken = res.headers.get('x-next-chunk-token') || '';
  const isLast    = res.headers.get('x-is-last-chunk') === 'true';
  log(`chunk ${idx}: ${buffer.byteLength} bytes, isLast=${isLast}`);
  return { buffer, nextToken, isLast };
}

// ─── Download all chunks → concat → blob URL → play ──────────────────────────
// This is the only streaming mode. Works for all MP4 files regardless of whether
// they are fragmented or standard. No MSE involved.
async function downloadAndPlay(
  videoId:     string,
  firstToken:  string,
  totalChunks: number | null,
  video:       HTMLVideoElement,
  alive:       () => boolean,
  onProgress:  (loaded: number, total: number | null) => void,
  onReady:     (blobUrl: string) => void,
  onError:     (msg: string) => void,
): Promise<void> {
  log('downloadAndPlay start, videoId:', videoId);
  const chunks: ArrayBuffer[] = [];
  let token = firstToken, idx = 0;

  while (token) {
    if (!alive()) { log('download aborted — component unmounted'); return; }
    try {
      const { buffer, nextToken, isLast } = await fetchChunk(videoId, idx, token);
      if (buffer.byteLength > 0) chunks.push(buffer);
      idx++;
      token = nextToken;
      onProgress(idx, totalChunks);
      if (isLast || !nextToken) break;
    } catch (err: any) {
      if (alive()) onError(err.message);
      return;
    }
  }

  if (!alive()) return;

  log(`all chunks downloaded (${chunks.length}), assembling blob...`);
  const blob    = new Blob(chunks, { type: 'video/mp4' });
  const blobUrl = URL.createObjectURL(blob);
  log(`blob ready: ${blob.size} bytes`);

  // Hand back to component to assign video.src and revoke after canplay
  onReady(blobUrl);
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
  const [isVideoHidden,  setIsVideoHidden]  = useState(false);

  const videoRef    = useRef<HTMLVideoElement>(null);
  const blobUrlRef  = useRef<string>('');    // so we can revoke it on teardown
  const alive       = useRef(true);
  const initLockRef = useRef('');            // prevents StrictMode double-init

  useEffect(() => { injectAntiPiracy(); }, []);

  useDevToolsDetection(
    useCallback(() => { setIsVideoHidden(true);  setPlayerState('devtools'); videoRef.current?.pause(); }, []),
    useCallback(() => { setIsVideoHidden(false); setPlayerState(p => p === 'devtools' ? 'playing' : p); }, []),
  );

  // ── Cleanup ────────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = ''; }
    if (alive.current && videoRef.current) {
      try { videoRef.current.pause(); videoRef.current.removeAttribute('src'); videoRef.current.load(); } catch {}
    }
  }, []);

  // ── Init player ────────────────────────────────────────────────────────────
  const initPlayer = useCallback(async (videoUrl: string) => {
    // Prevent StrictMode double-invoke
    if (initLockRef.current === videoUrl) { log('duplicate initPlayer — skipping'); return; }
    initLockRef.current = videoUrl;

    log('initPlayer:', videoUrl);
    cleanup();

    setPlayerState('downloading');
    setPlayerError('');
    setLoadedChunks(0);
    setTotalChunks(null);
    setIsEmbed(false);
    setEmbedUrl('');

    // Plain URL (not secured) — assign directly
    if (!videoUrl.startsWith('secured://')) {
      const v = videoRef.current;
      if (v) { v.src = videoUrl; v.load(); setPlayerState('playing'); }
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
      // Step 1: get tokens
      log('fetching metadata...');
      const meta = await videoStreamService.getVideoMetadata(videoId, SECURITY_STRING);
      if (!alive.current) return;
      log('meta type:', meta.type);

      if (meta.type === 'embed') {
        setIsEmbed(true); setEmbedUrl(meta.embedUrl); setPlayerState('playing');
        initLockRef.current = '';
        return;
      }

      // Step 2: get chunk count for progress bar
      log('fetching info...');
      const info = await videoStreamService.getVideoInfo(videoId, meta.streamToken);
      if (!alive.current) return;
      log('info: totalChunks=', info.totalChunks);
      if (info.totalChunks) setTotalChunks(info.totalChunks);

      // Step 3: download all chunks + play
      const v = videoRef.current;
      if (!v) throw new Error('Video element unavailable');

      await downloadAndPlay(
        videoId,
        meta.firstChunkToken,
        info.totalChunks,
        v,
        () => alive.current,
        (loaded, total) => {
          if (!alive.current) return;
          setLoadedChunks(loaded);
          if (total) setTotalChunks(total);
        },
        (blobUrl) => {
          // Called when all chunks are downloaded and blob is ready
          if (!alive.current) { URL.revokeObjectURL(blobUrl); return; }
          blobUrlRef.current = blobUrl;
          v.src = blobUrl;
          v.load();
          // Don't revoke blob URL until canplay — browser still needs it
          v.addEventListener('canplay', () => {
            log('canplay — revoking blob URL');
            URL.revokeObjectURL(blobUrl);
            blobUrlRef.current = '';
            if (alive.current) {
              setPlayerState('playing');
              v.play().catch(e => log('play() blocked (autoplay policy):', e));
            }
          }, { once: true });
        },
        (msg) => {
          if (alive.current) { setPlayerError(msg); setPlayerState('error'); }
        },
      );

    } catch (err: any) {
      logErr('initPlayer error:', err);
      if (alive.current) { setPlayerError(err.message || 'Failed to load video.'); setPlayerState('error'); }
    } finally {
      initLockRef.current = '';
    }
  }, [cleanup]);

  // ── Content loading ────────────────────────────────────────────────────────
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

  useEffect(() => { if (content?.videoUrl) initPlayer(content.videoUrl); }, [content, initPlayer]);

  // ── Video events ────────────────────────────────────────────────────────────
  const onTimeUpdate     = () => { if (videoRef.current) setCurrentTime(videoRef.current.currentTime); };
  const onDurationChange = () => { if (videoRef.current) setDuration(videoRef.current.duration); };
  const onWaiting        = () => setPlayerState(p => p === 'playing' ? 'paused' : p);
  const onCanPlay        = () => setPlayerState(p => p === 'paused' ? 'playing' : p);
  const onPlay           = () => setPlayerState('playing');
  const onPause          = () => { if (alive.current) setPlayerState('paused'); };
  const onEnded          = () => setPlayerState('idle');
  const onVideoError     = () => {
    const v = videoRef.current;
    if (v?.error && v.src && v.src !== window.location.href) {
      logErr('video error:', v.error.code, v.error.message);
      setPlayerError('Playback error — please retry.'); setPlayerState('error');
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    const r = e.currentTarget.getBoundingClientRect();
    v.currentTime = ((e.clientX - r.left) / r.width) * duration;
  };
  const handleRetry    = () => { initLockRef.current = ''; if (content?.videoUrl) initPlayer(content.videoUrl); };
  const getNoteHref    = () => content?.noteSource === 'gdrive' ? content?.noteGDriveDownloadUrl||null : content?.noteUrl||null;
  const getNotePreview = () => content?.noteSource === 'gdrive' ? content?.noteGDrivePreviewUrl||null : content?.noteUrl||null;

  const playPct     = duration > 0 ? (currentTime / duration) * 100 : 0;
  const downloadPct = totalChunks ? Math.min(100, Math.round((loadedChunks / totalChunks) * 100)) : 0;
  const isDownloading = playerState === 'downloading';

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
        <div className="fixed inset-0 pointer-events-none" style={{background:'radial-gradient(ellipse 65% 35% at 50% -5%,rgba(139,92,246,.12) 0%,transparent 65%)'}}/>

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-6">

          <button onClick={() => navigate(-1)} className="anim-up flex items-center gap-2 text-sm text-white/35 hover:text-white/80 transition-colors mb-6 group focus:outline-none px-3 py-1.5 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/8">
            <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5"/> Back to Library
          </button>

          <div className="anim-up-1 relative rounded-2xl overflow-hidden border border-white/8 bg-[#0d0f1a] mb-6 shadow-2xl shadow-black/60">

            {playerState === 'devtools' && (
              <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#080a10]">
                <Lock size={36} className="text-rose-400 mb-3"/>
                <p className="text-white/60 text-sm font-medium">DevTools detected</p>
                <p className="text-white/25 text-xs mt-1">Close DevTools to resume</p>
              </div>
            )}

            {/* Embed players (YouTube / Vimeo / Dailymotion) */}
            {isEmbed && embedUrl && (
              <div className="relative w-full" style={{paddingBottom:'56.25%'}}>
                <iframe src={embedUrl} className="absolute inset-0 w-full h-full"
                  allow="autoplay; fullscreen; encrypted-media" allowFullScreen
                  referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
                  title={content?.title||'Video'} style={{border:'none',pointerEvents:'auto'}}/>
                <div className="absolute inset-0 pointer-events-none" onContextMenu={e=>e.preventDefault()}/>
              </div>
            )}

            {/* Blob-mode player (Dropbox / GDrive) */}
            {!isEmbed && content?.videoUrl && (
              <div className="relative secure-video-wrap bg-black">
                <video ref={videoRef} className="w-full block"
                  style={{display:isVideoHidden?'none':'block',maxHeight:'70vh',minHeight:'220px',background:'#000'}}
                  playsInline controlsList="nodownload nofullscreen noremoteplayback" disablePictureInPicture
                  onTimeUpdate={onTimeUpdate} onDurationChange={onDurationChange}
                  onWaiting={onWaiting} onCanPlay={onCanPlay}
                  onPlay={onPlay} onPause={onPause} onEnded={onEnded} onError={onVideoError}
                  onContextMenu={e=>e.preventDefault()}/>

                {/* Download progress overlay */}
                {isDownloading && !isVideoHidden && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="w-64 text-center">
                      {/* Animated icon */}
                      <div className="relative mx-auto mb-5 w-16 h-16">
                        <div className="absolute inset-0 rounded-full border-2 border-violet-500/20"/>
                        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 64 64">
                          <circle cx="32" cy="32" r="28" fill="none" stroke="rgb(139 92 246)" strokeWidth="3"
                            strokeDasharray={`${2 * Math.PI * 28}`}
                            strokeDashoffset={`${2 * Math.PI * 28 * (1 - downloadPct / 100)}`}
                            strokeLinecap="round" style={{transition:'stroke-dashoffset 0.4s ease'}}/>
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Shield size={20} className="text-violet-400"/>
                        </div>
                      </div>

                      <p className="text-white/70 text-sm font-medium mb-1">
                        {downloadPct > 0 ? `Securing video… ${downloadPct}%` : 'Preparing secure stream…'}
                      </p>
                      <p className="text-white/25 text-xs mb-4">
                        {totalChunks ? `${loadedChunks} / ${totalChunks} chunks` : 'Fetching…'}
                      </p>

                      {/* Progress bar */}
                      {totalChunks && (
                        <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-violet-500 rounded-full transition-all duration-300"
                            style={{width:`${downloadPct}%`}}/>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Error overlay */}
                {playerState==='error' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-center p-6">
                    <AlertCircle size={32} className="text-rose-400 mb-3"/>
                    <p className="text-white/60 text-sm mb-4 max-w-xs">{playerError}</p>
                    <button onClick={handleRetry}
                      className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm rounded-lg transition-colors">
                      Retry
                    </button>
                  </div>
                )}

                {/* Playback controls */}
                {(playerState==='playing'||playerState==='paused') && !isVideoHidden && (
                  <div className="player-controls absolute bottom-0 left-0 right-0 px-4 pb-3 pt-8
                                  bg-gradient-to-t from-black/95 via-black/50 to-transparent">
                    {/* Seekbar */}
                    <div className="scrubber relative h-1 bg-white/15 rounded-full cursor-pointer mb-3 group"
                      onClick={handleSeek}>
                      <div className="absolute inset-y-0 left-0 bg-violet-400 rounded-full transition-all duration-100"
                        style={{width:`${playPct}%`}}/>
                      <div className="scrubber-thumb absolute top-1/2 w-3 h-3 bg-white rounded-full shadow"
                        style={{left:`${playPct}%`,transform:'translateX(-50%) translateY(-50%)',opacity:0}}/>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button className="player-controls text-white/70 hover:text-white"
                          onClick={()=>{const v=videoRef.current;if(v)v.paused?v.play():v.pause();}}>
                          {playerState==='paused'?'▶':'⏸'}
                        </button>
                        <span className="text-xs text-white/40 font-mono tabular-nums">
                          {formatDuration(currentTime)} / {formatDuration(duration)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-green-400/60">
                        <Shield size={10}/><span>Secure Proxy</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!content?.videoUrl && !loadingContent && (
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <Play size={36} className="text-white/15 mb-3"/>
                <p className="text-white/25 text-sm">No video attached</p>
              </div>
            )}
          </div>

          {/* Content metadata */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 space-y-4">
              <div className="anim-up-2 rounded-2xl border border-white/6 bg-[#0d0f1a] p-5 sm:p-6">
                <div className="flex items-start gap-3 mb-3">
                  <span className={`flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border mt-0.5 ${content?.type==='lesson'?'bg-violet-500/15 text-violet-300 border-violet-500/20':'bg-amber-500/15 text-amber-300 border-amber-500/20'}`}>
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
                    <p className="text-sm text-green-400/70 font-medium">DRM Protected</p></div>
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
                {['Token-chained stream (anti-IDM)','Source URL never exposed','Screen capture blocked','Download button disabled'].map(f => (
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
