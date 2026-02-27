// src/pages/NoteViewer.tsx
// Production-grade Note Viewer
// Handles content type: 'note' (local PDF via Supabase + Google Drive)
// Route: /content-library/note/:courseId/:contentId
// Features: View (custom modal with watermark) + Download

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, FileText, Download, Eye, X, ZoomIn, ZoomOut,
  RotateCw, Loader2, AlertCircle, ChevronLeft, ChevronRight,
  Maximize2, Minimize2, BookOpen, Clock, Tag, Globe, Shield,
} from 'lucide-react';
import { useDashboard } from '../contexts/DashboardContext';
import { contentLibraryService, LibraryContent } from '../services/contentLibraryService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(minutes?: number): string {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getDifficultyMeta(d?: string) {
  switch (d) {
    case 'easy':      return { label: 'Easy',      color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' };
    case 'medium':    return { label: 'Medium',    color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20' };
    case 'hard':      return { label: 'Hard',      color: 'text-rose-400',    bg: 'bg-rose-500/10 border-rose-500/20' };
    case 'very_hard': return { label: 'Very Hard', color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20' };
    default:          return { label: 'Standard',  color: 'text-slate-400',   bg: 'bg-slate-500/10 border-slate-500/20' };
  }
}

// ─── Watermark Overlay ────────────────────────────────────────────────────────

interface WatermarkOverlayProps {
  userId: string;
}

const WatermarkOverlay: React.FC<WatermarkOverlayProps> = ({ userId }) => (
  <>
    {/* Top-left: userId watermark */}
    <div
      className="absolute top-3 left-3 z-20 pointer-events-none select-none"
      aria-hidden="true"
    >
      <span
        style={{
          fontSize: '10px',
          fontFamily: 'monospace',
          color: 'rgba(255,255,255,0.18)',
          letterSpacing: '0.04em',
          textShadow: '0 1px 2px rgba(0,0,0,0.4)',
          userSelect: 'none',
        }}
      >
        {userId}
      </span>
    </div>

    {/* Top-right: Edtech watermark */}
    <div
      className="absolute top-3 right-3 z-20 pointer-events-none select-none"
      aria-hidden="true"
    >
      <span
        style={{
          fontSize: '10px',
          fontFamily: 'monospace',
          color: 'rgba(255,255,255,0.18)',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          textShadow: '0 1px 2px rgba(0,0,0,0.4)',
          userSelect: 'none',
        }}
      >
        Edtech
      </span>
    </div>

    {/* Diagonal tiled watermark in center (very subtle) */}
    <div
      className="absolute inset-0 z-10 pointer-events-none select-none overflow-hidden"
      aria-hidden="true"
      style={{
        background: 'repeating-linear-gradient(45deg, transparent, transparent 120px, rgba(255,255,255,0.012) 120px, rgba(255,255,255,0.012) 121px)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexWrap: 'wrap',
          alignContent: 'flex-start',
          gap: '80px',
          padding: '60px 40px',
          transform: 'rotate(-20deg) scale(1.4)',
          transformOrigin: 'center',
        }}
      >
        {Array.from({ length: 16 }).map((_, i) => (
          <span
            key={i}
            style={{
              fontSize: '11px',
              color: 'rgba(255,255,255,0.04)',
              fontFamily: 'monospace',
              letterSpacing: '0.1em',
              whiteSpace: 'nowrap',
              userSelect: 'none',
            }}
          >
            Edtech • {userId.slice(0, 8)}
          </span>
        ))}
      </div>
    </div>
  </>
);

// ─── PDF Viewer Modal (local Supabase PDF) ────────────────────────────────────

interface LocalPDFViewerProps {
  url: string;
  title: string;
  userId: string;
  onClose: () => void;
}

const LocalPDFViewer: React.FC<LocalPDFViewerProps> = ({ url, title, userId, onClose }) => {
  const [zoom, setZoom] = useState(100);
  const [fullscreen, setFullscreen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleZoomIn  = () => setZoom(z => Math.min(z + 20, 200));
  const handleZoomOut = () => setZoom(z => Math.max(z - 20, 40));
  const handleReset   = () => setZoom(100);

  // Prevent keyboard shortcut download (best effort in browser)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') e.preventDefault();
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col bg-[#080a12] ${fullscreen ? '' : ''}`}
      style={{ backdropFilter: 'blur(12px)' }}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8 bg-[#0c0e18]/95 backdrop-blur-xl flex-shrink-0">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 transition-all text-sm border border-transparent hover:border-white/10"
        >
          <X size={14} />
          Close
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white/80 truncate">{title}</p>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1 bg-white/5 border border-white/8 rounded-lg p-1">
          <button
            onClick={handleZoomOut}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-all"
            title="Zoom out"
          >
            <ZoomOut size={14} />
          </button>
          <button
            onClick={handleReset}
            className="px-2 py-1 text-xs text-slate-300 hover:text-white transition-colors min-w-[48px] text-center font-mono"
            title="Reset zoom"
          >
            {zoom}%
          </button>
          <button
            onClick={handleZoomIn}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-all"
            title="Zoom in"
          >
            <ZoomIn size={14} />
          </button>
        </div>

        <button
          onClick={() => setFullscreen(f => !f)}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 transition-all border border-transparent hover:border-white/10"
          title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>
      </div>

      {/* Viewer area with watermark */}
      <div className="relative flex-1 overflow-hidden">
        <WatermarkOverlay userId={userId} />

        <div
          className="w-full h-full overflow-auto flex items-start justify-center p-4"
          style={{ background: '#111318' }}
        >
          <div
            style={{
              width: `${zoom}%`,
              minWidth: zoom < 100 ? '100%' : undefined,
              transition: 'width 0.25s ease',
              position: 'relative',
            }}
          >
            <iframe
              ref={iframeRef}
              src={`${url}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
              className="w-full rounded-lg shadow-2xl"
              style={{
                height: '80vh',
                border: 'none',
                background: '#fff',
                display: 'block',
              }}
              title={title}
              sandbox="allow-same-origin allow-scripts"
            />
          </div>
        </div>
      </div>

      {/* Anti-inspect overlay (visually harmless, adds friction) */}
      <div
        className="absolute inset-0 pointer-events-none select-none z-30"
        onContextMenu={(e) => e.preventDefault()}
        style={{ userSelect: 'none' }}
        aria-hidden="true"
      />
    </div>
  );
};

// ─── GDrive Viewer Modal ──────────────────────────────────────────────────────

interface GDriveViewerProps {
  previewUrl: string;
  title: string;
  userId: string;
  onClose: () => void;
}

const GDriveViewer: React.FC<GDriveViewerProps> = ({ previewUrl, title, userId, onClose }) => {
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#080a12]">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8 bg-[#0c0e18]/95 backdrop-blur-xl flex-shrink-0">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 transition-all text-sm border border-transparent hover:border-white/10"
        >
          <X size={14} />
          Close
        </button>

        <div className="flex-1 min-w-0 flex items-center gap-2">
          <div className="w-4 h-4 flex-shrink-0">
            <svg viewBox="0 0 24 24" className="w-full h-full">
              <path fill="#4285F4" d="M6 2L2 8l4 7h8l4-7-4-6z" />
              <path fill="#0F9D58" d="M2 8l4 7 4-7z" />
              <path fill="#F4B400" d="M14 15l4-7-4-6z" />
              <path fill="#EA4335" d="M6 9l8 6-4-7z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-white/80 truncate">{title}</p>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/20 flex-shrink-0">
            Google Drive
          </span>
        </div>

        <button
          onClick={() => setFullscreen(f => !f)}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 transition-all border border-transparent hover:border-white/10"
          title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>
      </div>

      {/* Viewer area with watermark */}
      <div className="relative flex-1 overflow-hidden bg-[#111318]">
        <WatermarkOverlay userId={userId} />

        <iframe
          src={previewUrl}
          className="w-full h-full"
          style={{ border: 'none' }}
          title={title}
          allow="autoplay"
        />
      </div>
    </div>
  );
};

// ─── Info Row ─────────────────────────────────────────────────────────────────

const InfoPill: React.FC<{ icon: React.ReactNode; label: string; value: string; accent?: string }> = ({
  icon, label, value, accent = 'text-slate-300',
}) => (
  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/3 border border-white/6">
    <div className="text-slate-500 flex-shrink-0">{icon}</div>
    <div className="min-w-0 flex-1">
      <p className="text-[10px] uppercase tracking-widest text-slate-600 font-semibold mb-0.5">{label}</p>
      <p className={`text-sm font-medium ${accent} truncate`}>{value}</p>
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const NoteViewer: React.FC = () => {
  const { courseId, contentId } = useParams<{ courseId: string; contentId: string }>();
  const navigate = useNavigate();
  const { user } = useDashboard();

  const [content, setContent] = useState<LibraryContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const [viewerOpen, setViewerOpen]     = useState(false);
  const [downloading, setDownloading]   = useState(false);

  const userId = user?.uid || user?.id || 'anonymous';

  // ── Load content ──
  useEffect(() => {
    if (!courseId || !contentId || !user?.uid) return;

    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const library = await contentLibraryService.getStudentLibrary(user.uid);
        const course  = library.find(c => c.courseId === courseId);
        if (!course) { setError('Course not found or access denied.'); return; }

        const findContent = (nodes: any[]): LibraryContent | null => {
          for (const node of nodes) {
            if (node.type === 'content' && node.contentId === contentId && node.contentData) {
              return node.contentData;
            }
            if (node.children?.length) {
              const found = findContent(node.children);
              if (found) return found;
            }
          }
          return null;
        };

        const found = findContent(course.contentStructure);
        if (!found) { setError('Note content not found.'); return; }
        if (found.type !== 'note') { setError('This content is not a note.'); return; }

        setContent(found);
      } catch (e: any) {
        setError(e?.message || 'Failed to load note.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [courseId, contentId, user?.uid]);

  // ── Download ──
  const handleDownload = useCallback(async () => {
    if (!content) return;
    setDownloading(true);
    try {
      const downloadUrl = content.noteSource === 'gdrive'
        ? content.noteGDriveDownloadUrl
        : content.noteUrl;

      if (!downloadUrl) { alert('No downloadable file available.'); return; }

      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = content.noteFileName || content.title || 'note';
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      setTimeout(() => setDownloading(false), 1000);
    }
  }, [content]);

  const isGDrive    = content?.noteSource === 'gdrive';
  const hasFile     = !!(content?.noteUrl || content?.noteGDrivePreviewUrl);
  const diffMeta    = getDifficultyMeta((content as any)?.difficulty);

  // ── Render: Loading ──
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0c0e16] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Loader2 size={24} className="text-emerald-400 animate-spin" />
            </div>
          </div>
          <p className="text-slate-500 text-sm">Loading note…</p>
        </div>
      </div>
    );
  }

  // ── Render: Error ──
  if (error || !content) {
    return (
      <div className="min-h-screen bg-[#0c0e16] flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-5 text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
            <AlertCircle size={28} className="text-rose-400" />
          </div>
          <div>
            <p className="text-white font-semibold text-lg mb-1">Unable to load note</p>
            <p className="text-slate-500 text-sm">{error || 'Note not found.'}</p>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/6 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-all text-sm font-medium"
          >
            <ArrowLeft size={14} />
            Go back
          </button>
        </div>
      </div>
    );
  }

  // ── Render: Main ──
  return (
    <>
      {/* Viewer Modals */}
      {viewerOpen && hasFile && (
        isGDrive ? (
          <GDriveViewer
            previewUrl={content.noteGDrivePreviewUrl!}
            title={content.title}
            userId={userId}
            onClose={() => setViewerOpen(false)}
          />
        ) : (
          <LocalPDFViewer
            url={content.noteUrl!}
            title={content.title}
            userId={userId}
            onClose={() => setViewerOpen(false)}
          />
        )
      )}

      <div className="min-h-screen bg-[#0c0e16] text-white">
        {/* Ambient glow */}
        <div
          className="fixed inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            background:
              'radial-gradient(ellipse 65% 35% at 50% -4%, rgba(16,185,129,0.08) 0%, transparent 65%)',
          }}
        />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">

          {/* Back nav */}
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-all
                       px-3 py-1.5 rounded-xl hover:bg-white/6 border border-transparent hover:border-white/10
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <ArrowLeft size={15} />
            Back to Library
          </button>

          {/* ── Hero Card ── */}
          <div className="rounded-3xl border border-white/8 bg-[#131620] overflow-hidden shadow-2xl shadow-black/40">

            {/* Header banner */}
            <div
              className="relative px-7 py-8 border-b border-white/6"
              style={{
                background:
                  'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(16,185,129,0.02) 50%, transparent 100%)',
              }}
            >
              {/* Type pill */}
              <div className="flex items-center gap-3 mb-5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/12 border border-emerald-400/25 text-emerald-300 text-xs font-semibold tracking-wide">
                  <FileText size={11} strokeWidth={2.5} />
                  Note
                </span>
                {isGDrive && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-400/20 text-blue-300 text-xs font-medium">
                    <Globe size={10} />
                    Google Drive
                  </span>
                )}
                {!isGDrive && hasFile && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-500/10 border border-violet-400/20 text-violet-300 text-xs font-medium">
                    <Shield size={10} />
                    Secure PDF
                  </span>
                )}
              </div>

              {/* Title */}
              <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight mb-2 tracking-tight">
                {content.title}
              </h1>
              {content.subject && (
                <p className="text-slate-400 text-sm font-medium">{content.subject}</p>
              )}

              {/* Decorative icon */}
              <div
                className="absolute right-7 top-1/2 -translate-y-1/2 opacity-5 pointer-events-none"
                aria-hidden="true"
              >
                <FileText size={96} strokeWidth={1} />
              </div>
            </div>

            {/* ── Action Buttons ── */}
            {hasFile ? (
              <div className="px-7 py-6 border-b border-white/6">
                <div className="flex flex-col sm:flex-row gap-3">
                  {/* View */}
                  <button
                    onClick={() => setViewerOpen(true)}
                    className="flex-1 flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-2xl
                               bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600
                               text-white font-semibold text-sm shadow-lg shadow-emerald-500/25
                               transition-all duration-200 hover:shadow-emerald-500/40 hover:-translate-y-0.5
                               focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                  >
                    <Eye size={17} />
                    View Note
                  </button>

                  {/* Download */}
                  <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className="flex-1 flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-2xl
                               bg-white/6 hover:bg-white/10 active:bg-white/4
                               border border-white/10 hover:border-white/20
                               text-slate-200 hover:text-white font-semibold text-sm
                               transition-all duration-200 hover:-translate-y-0.5
                               focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20
                               disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
                  >
                    {downloading ? (
                      <Loader2 size={17} className="animate-spin" />
                    ) : (
                      <Download size={17} />
                    )}
                    {downloading ? 'Downloading…' : 'Download'}
                  </button>
                </div>

                {/* Security note */}
                <p className="text-center text-[11px] text-slate-600 mt-3 flex items-center justify-center gap-1.5">
                  <Shield size={10} className="text-emerald-500/50" />
                  {isGDrive
                    ? 'Previewed securely via Google Drive • Watermarked for copyright protection'
                    : 'Viewed in a protected environment • Watermarked for copyright protection'}
                </p>
              </div>
            ) : (
              <div className="px-7 py-6 border-b border-white/6">
                <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-amber-500/8 border border-amber-500/15">
                  <AlertCircle size={16} className="text-amber-400 flex-shrink-0" />
                  <p className="text-amber-300 text-sm">No file attached to this note yet.</p>
                </div>
              </div>
            )}

            {/* ── Info Grid ── */}
            <div className="px-7 py-6 space-y-4">
              {content.description && (
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-widest text-slate-600 font-semibold">Description</p>
                  <p className="text-slate-300 text-sm leading-relaxed">{content.description}</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {content.subject && (
                  <InfoPill
                    icon={<BookOpen size={15} />}
                    label="Subject"
                    value={content.subject}
                    accent="text-white"
                  />
                )}
                {content.duration && content.duration > 0 && (
                  <InfoPill
                    icon={<Clock size={15} />}
                    label="Est. Read Time"
                    value={formatDuration(content.duration)}
                    accent="text-emerald-300"
                  />
                )}
                {(content as any).difficulty && (
                  <InfoPill
                    icon={<Tag size={15} />}
                    label="Difficulty"
                    value={diffMeta.label}
                    accent={diffMeta.color}
                  />
                )}
                {(content as any).language && (
                  <InfoPill
                    icon={<Globe size={15} />}
                    label="Language"
                    value={(content as any).language}
                    accent="text-slate-300"
                  />
                )}
              </div>

              {/* Tags */}
              {(content as any).tags && (content as any).tags.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-widest text-slate-600 font-semibold">Tags</p>
                  <div className="flex flex-wrap gap-2">
                    {(content as any).tags.map((tag: string) => (
                      <span
                        key={tag}
                        className="px-2.5 py-1 rounded-full text-xs bg-white/4 border border-white/8 text-slate-400"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Source info */}
              <div className="pt-2 border-t border-white/5">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Shield size={11} />
                  <span>
                    {isGDrive
                      ? 'Hosted on Google Drive — previewed via secure embed'
                      : 'PDF stored securely — rendered in protected viewer'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default NoteViewer;
