// src/pages/NoteViewer.tsx
// Production-grade Note Viewer
// Handles content type: 'note' (local PDF via Supabase + Google Drive)
// Route: /content-library/note/:courseId/:contentId

import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, FileText, Download, Eye, ZoomIn, ZoomOut,
  Loader2, AlertCircle, Maximize2, Minimize2, BookOpen,
  Clock, Tag, Globe, Shield, X,
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
    case 'easy':      return { label: 'Easy',      color: 'text-emerald-400' };
    case 'medium':    return { label: 'Medium',    color: 'text-amber-400'   };
    case 'hard':      return { label: 'Hard',      color: 'text-rose-400'    };
    case 'very_hard': return { label: 'Very Hard', color: 'text-red-400'     };
    default:          return { label: 'Standard',  color: 'text-slate-400'   };
  }
}

// ─── Viewer Loading Screen ────────────────────────────────────────────────────

const ViewerLoadingScreen: React.FC<{ title: string; isGDrive?: boolean }> = ({ title, isGDrive }) => (
  <div
    className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#0d0f1a]"
    aria-label="Loading document…"
  >
    <div className="relative mb-7">
      <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
        <FileText size={36} className="text-emerald-400" strokeWidth={1.6} />
      </div>
      <div
        className="absolute inset-0 rounded-2xl border-2 border-emerald-500/30 animate-ping"
        style={{ animationDuration: '1.8s' }}
      />
    </div>

    <div className="flex items-center gap-3 mb-3">
      <Loader2 size={18} className="text-emerald-400 animate-spin flex-shrink-0" />
      <p className="text-white/80 text-sm font-medium">Loading document…</p>
    </div>

    <p className="text-slate-500 text-xs max-w-xs text-center truncate px-4">{title}</p>

    <div className="mt-5 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/4 border border-white/8">
      {isGDrive ? (
        <>
          <Globe size={11} className="text-blue-400" />
          <span className="text-[11px] text-slate-400">Via Google Drive</span>
        </>
      ) : (
        <>
          <Shield size={11} className="text-emerald-400" />
          <span className="text-[11px] text-slate-400">Secure PDF Viewer</span>
        </>
      )}
    </div>

    <div className="mt-6 w-48 h-0.5 rounded-full bg-white/6 overflow-hidden">
      <div
        className="h-full bg-emerald-500/60 rounded-full"
        style={{ animation: 'wm-indeterminate 1.6s ease-in-out infinite' }}
      />
    </div>

    <style>{`
      @keyframes wm-indeterminate {
        0%   { transform: translateX(-100%) scaleX(0.4); }
        50%  { transform: translateX(50%)   scaleX(0.6); }
        100% { transform: translateX(300%)  scaleX(0.4); }
      }
    `}</style>
  </div>
);

// ─── Watermark Overlay ────────────────────────────────────────────────────────

const WatermarkOverlay: React.FC<{ userId: string }> = ({ userId }) => (
  <>
    {/* Top-left: formatted student ID (e.g. ST-2601-00001) */}
    <div className="absolute top-3 left-3 z-20 pointer-events-none select-none" aria-hidden="true">
      <span style={{
        fontSize: '10px', fontFamily: 'monospace',
        color: 'rgba(255,255,255,0.18)', letterSpacing: '0.05em',
        textShadow: '0 1px 2px rgba(0,0,0,0.5)', userSelect: 'none',
      }}>
        {userId}
      </span>
    </div>

    {/* Top-right: Edtech brand */}
    <div className="absolute top-3 right-3 z-20 pointer-events-none select-none" aria-hidden="true">
      <span style={{
        fontSize: '10px', fontFamily: 'monospace',
        color: 'rgba(255,255,255,0.18)', letterSpacing: '0.14em',
        textTransform: 'uppercase', textShadow: '0 1px 2px rgba(0,0,0,0.5)',
        userSelect: 'none',
      }}>
        Edtech
      </span>
    </div>

    {/* Diagonal tiled watermark */}
    <div className="absolute inset-0 z-10 pointer-events-none select-none overflow-hidden" aria-hidden="true">
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexWrap: 'wrap',
        alignContent: 'flex-start', gap: '80px', padding: '60px 40px',
        transform: 'rotate(-20deg) scale(1.4)', transformOrigin: 'center',
      }}>
        {Array.from({ length: 16 }).map((_, i) => (
          <span key={i} style={{
            fontSize: '11px', color: 'rgba(255,255,255,0.035)',
            fontFamily: 'monospace', letterSpacing: '0.1em',
            whiteSpace: 'nowrap', userSelect: 'none',
          }}>
            Edtech • {userId}
          </span>
        ))}
      </div>
    </div>
  </>
);

// ─── Viewer Shell (Portal) ────────────────────────────────────────────────────
// Rendered via ReactDOM.createPortal into document.body so it truly sits
// above everything — the app layout, sidebar, any z-index stacking context.

interface ViewerShellProps {
  title: string;
  isGDrive?: boolean;
  userId: string;
  onClose: () => void;
  // Extra toolbar items (zoom for PDF, GDrive badge, etc.)
  toolbarExtra?: React.ReactNode;
  children: React.ReactNode;
  loaded: boolean;
}

const ViewerShell: React.FC<ViewerShellProps> = ({
  title, isGDrive, userId, onClose, toolbarExtra, children, loaded,
}) => {
  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Close on Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const portal = (
    // Using inline style for z-index to guarantee it beats any Tailwind stacking
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        display: 'flex', flexDirection: 'column',
        background: '#080a12',
      }}
    >
      {/* ── Top toolbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '10px 14px', flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(12,14,24,0.97)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        // Push below iOS safe-area / notch
        paddingTop: 'max(10px, env(safe-area-inset-top))',
      }}>

        {/* ✕ Close button — large, always visible, left-aligned */}
        <button
          onClick={onClose}
          aria-label="Close viewer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '38px', height: '38px', flexShrink: 0,
            borderRadius: '10px', border: '1.5px solid rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.06)', color: '#e2e8f0',
            cursor: 'pointer', transition: 'background 0.15s, border-color 0.15s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.12)';
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.28)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)';
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.15)';
          }}
        >
          <X size={18} strokeWidth={2.5} />
        </button>

        {/* Divider */}
        <div style={{ width: '1px', height: '22px', background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />

        {/* Source icon + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
          {isGDrive && (
            <svg viewBox="0 0 24 24" style={{ width: '15px', height: '15px', flexShrink: 0 }} aria-hidden="true">
              <path fill="#4285F4" d="M6 2L2 8l4 7h8l4-7-4-6z" />
              <path fill="#0F9D58" d="M2 8l4 7 4-7z" />
              <path fill="#F4B400" d="M14 15l4-7-4-6z" />
              <path fill="#EA4335" d="M6 9l8 6-4-7z" />
            </svg>
          )}
          {!isGDrive && (
            <FileText size={14} style={{ color: '#34d399', flexShrink: 0 }} strokeWidth={2} />
          )}
          <p style={{
            fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.72)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {title}
          </p>
        </div>

        {/* Extra toolbar items (zoom controls, fullscreen, etc.) */}
        {toolbarExtra}
      </div>

      {/* ── Content area ── */}
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        {/* Loading screen — shown until parent sets loaded=true */}
        {!loaded && <ViewerLoadingScreen title={title} isGDrive={isGDrive} />}

        {/* Watermark — shown only after loaded */}
        {loaded && <WatermarkOverlay userId={userId} />}

        {/* The actual iframe / content */}
        {children}
      </div>
    </div>
  );

  return ReactDOM.createPortal(portal, document.body);
};

// ─── Local PDF Viewer ─────────────────────────────────────────────────────────

interface LocalPDFViewerProps {
  url: string;
  title: string;
  userId: string;
  onClose: () => void;
}

const LocalPDFViewer: React.FC<LocalPDFViewerProps> = ({ url, title, userId, onClose }) => {
  const [zoom, setZoom]   = useState(100);
  const [loaded, setLoaded] = useState(false);
  const iframeRef         = useRef<HTMLIFrameElement>(null);

  // Keyboard shortcut prevention
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'p')) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const zoomControls = (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '2px',
      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '8px', padding: '3px', flexShrink: 0,
    }}>
      <button
        onClick={() => setZoom(z => Math.max(z - 20, 40))}
        title="Zoom out"
        style={{
          padding: '5px 7px', borderRadius: '5px', border: 'none', background: 'transparent',
          color: '#94a3b8', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <ZoomOut size={14} />
      </button>
      <button
        onClick={() => setZoom(100)}
        title="Reset zoom"
        style={{
          padding: '4px 6px', borderRadius: '5px', border: 'none', background: 'transparent',
          color: '#cbd5e1', cursor: 'pointer', fontSize: '11px',
          fontFamily: 'monospace', minWidth: '44px', textAlign: 'center',
        }}
      >
        {zoom}%
      </button>
      <button
        onClick={() => setZoom(z => Math.min(z + 20, 200))}
        title="Zoom in"
        style={{
          padding: '5px 7px', borderRadius: '5px', border: 'none', background: 'transparent',
          color: '#94a3b8', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <ZoomIn size={14} />
      </button>
    </div>
  );

  return (
    <ViewerShell
      title={title}
      isGDrive={false}
      userId={userId}
      onClose={onClose}
      toolbarExtra={zoomControls}
      loaded={loaded}
    >
      <div style={{
        width: '100%', height: '100%',
        overflowY: 'auto', overflowX: 'hidden',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '12px',
        background: '#111318',
        opacity: loaded ? 1 : 0,
        transition: 'opacity 0.3s ease',
      }}>
        <div style={{
          width: `${zoom}%`,
          minWidth: zoom < 100 ? '100%' : undefined,
          transition: 'width 0.2s ease',
        }}>
          <iframe
            ref={iframeRef}
            src={`${url}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
            style={{
              width: '100%', height: '82vh',
              border: 'none', background: '#fff',
              display: 'block', borderRadius: '8px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}
            title={title}
            sandbox="allow-same-origin allow-scripts"
            onLoad={() => setLoaded(true)}
          />
        </div>
      </div>
    </ViewerShell>
  );
};

// ─── GDrive Viewer ────────────────────────────────────────────────────────────

interface GDriveViewerProps {
  previewUrl: string;
  title: string;
  userId: string;
  onClose: () => void;
}

const GDriveViewer: React.FC<GDriveViewerProps> = ({ previewUrl, title, userId, onClose }) => {
  const [loaded, setLoaded] = useState(false);

  return (
    <ViewerShell
      title={title}
      isGDrive
      userId={userId}
      onClose={onClose}
      loaded={loaded}
    >
      <iframe
        src={previewUrl}
        style={{
          width: '100%', height: '100%', border: 'none',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.3s ease',
        }}
        title={title}
        allow="autoplay"
        onLoad={() => setLoaded(true)}
      />
    </ViewerShell>
  );
};

// ─── Info Pill ────────────────────────────────────────────────────────────────

const InfoPill: React.FC<{
  icon: React.ReactNode; label: string; value: string; accent?: string;
}> = ({ icon, label, value, accent = 'text-slate-300' }) => (
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
  const navigate                = useNavigate();
  const { user }                = useDashboard();

  const [content, setContent]         = useState<LibraryContent | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [viewerOpen, setViewerOpen]   = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Formatted student ID (e.g. ST-2601-00001), NOT the Firebase uid/doc ID
  const userId = user?.userId || user?.uid || 'anonymous';

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
            if (node.type === 'content' && node.contentId === contentId && node.contentData)
              return node.contentData;
            if (node.children?.length) {
              const found = findContent(node.children);
              if (found) return found;
            }
          }
          return null;
        };

        const found = findContent(course.contentStructure);
        if (!found)                { setError('Note content not found.');    return; }
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
      const url = content.noteSource === 'gdrive'
        ? content.noteGDriveDownloadUrl
        : content.noteUrl;
      if (!url) { alert('No downloadable file available.'); return; }
      const a = document.createElement('a');
      a.href = url;
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

  const isGDrive = content?.noteSource === 'gdrive';
  const hasFile  = !!(content?.noteUrl || content?.noteGDrivePreviewUrl);
  const diffMeta = getDifficultyMeta((content as any)?.difficulty);

  // ── Render: loading ──
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0c0e16] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Loader2 size={24} className="text-emerald-400 animate-spin" />
          </div>
          <p className="text-slate-500 text-sm">Loading note…</p>
        </div>
      </div>
    );
  }

  // ── Render: error ──
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
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/6 border border-white/10
                       text-slate-300 hover:text-white hover:bg-white/10 transition-all text-sm font-medium"
          >
            <ArrowLeft size={14} />
            Go back
          </button>
        </div>
      </div>
    );
  }

  // ── Render: main ──
  return (
    <>
      {/* Viewer portals — mount to document.body, above everything */}
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

            {/* Header */}
            <div
              className="relative px-7 py-8 border-b border-white/6"
              style={{
                background:
                  'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(16,185,129,0.02) 50%, transparent 100%)',
              }}
            >
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

              <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight mb-2 tracking-tight">
                {content.title}
              </h1>
              {content.subject && (
                <p className="text-slate-400 text-sm font-medium">{content.subject}</p>
              )}

              <div className="absolute right-7 top-1/2 -translate-y-1/2 opacity-5 pointer-events-none" aria-hidden="true">
                <FileText size={96} strokeWidth={1} />
              </div>
            </div>

            {/* ── Action Buttons ── */}
            {hasFile ? (
              <div className="px-7 py-6 border-b border-white/6">
                <div className="flex flex-col sm:flex-row gap-3">
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
                    {downloading ? <Loader2 size={17} className="animate-spin" /> : <Download size={17} />}
                    {downloading ? 'Downloading…' : 'Download'}
                  </button>
                </div>

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
                  <InfoPill icon={<BookOpen size={15} />} label="Subject" value={content.subject} accent="text-white" />
                )}
                {content.duration && content.duration > 0 && (
                  <InfoPill icon={<Clock size={15} />} label="Est. Read Time" value={formatDuration(content.duration)} accent="text-emerald-300" />
                )}
                {(content as any).difficulty && (
                  <InfoPill icon={<Tag size={15} />} label="Difficulty" value={diffMeta.label} accent={diffMeta.color} />
                )}
                {(content as any).language && (
                  <InfoPill icon={<Globe size={15} />} label="Language" value={(content as any).language} accent="text-slate-300" />
                )}
              </div>

              {(content as any).tags && (content as any).tags.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-widest text-slate-600 font-semibold">Tags</p>
                  <div className="flex flex-wrap gap-2">
                    {(content as any).tags.map((tag: string) => (
                      <span key={tag} className="px-2.5 py-1 rounded-full text-xs bg-white/4 border border-white/8 text-slate-400">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

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
