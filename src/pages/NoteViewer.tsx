// src/pages/NoteViewer.tsx
// Production-grade Note Viewer — styles aligned with ComingSoon.tsx
// Handles content type: 'note' (local PDF via Supabase + Google Drive)
// Route: /content-library/note/:courseId/:contentId

import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, FileText, Download, Eye, ZoomIn, ZoomOut,
  Loader2, AlertCircle, BookOpen, Clock, Tag, Globe,
  Shield, X,
} from 'lucide-react';
import { useDashboard } from '../contexts/DashboardContext';
import Card from '../components/ui/Card';
import { contentLibraryService, LibraryContent } from '../services/contentLibraryService';

// ─── Theme helpers (mirrors ComingSoon.tsx / Navigation.tsx exactly) ──────────

const hexRgb = (hex: string) => {
  if (!hex || hex.length < 7) return '99,102,241';
  return `${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)}`;
};

const THEME_BG: Record<string, string> = {
  dark:   '#0d1117', light: '#ebe8e1', slate:  '#0f172a',
  ocean:  '#0c1a2e', forest:'#0a1f14', purple:'#1e1b4b',
  pink:   '#831843', sunset:'#1c0a00',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(minutes?: number): string {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getDifficultyMeta(d?: string) {
  switch (d) {
    case 'easy':      return { label: 'Easy',      colorClass: 'text-green-400'        };
    case 'medium':    return { label: 'Medium',    colorClass: 'text-warning-DEFAULT'  };
    case 'hard':      return { label: 'Hard',      colorClass: 'text-error-DEFAULT'    };
    case 'very_hard': return { label: 'Very Hard', colorClass: 'text-error-DEFAULT'    };
    default:          return { label: 'Standard',  colorClass: 'text-gray-400'         };
  }
}

// ─── Viewer Loading Screen ────────────────────────────────────────────────────

const ViewerLoadingScreen: React.FC<{ title: string; isGDrive?: boolean }> = ({ title, isGDrive }) => {
  const { primaryColor, theme } = useDashboard();
  const pRgb = hexRgb(primaryColor);
  const baseBg = THEME_BG[theme] ?? '#0d1117';

  return (
    <div
      className="absolute inset-0 z-40 flex flex-col items-center justify-center"
      style={{ background: baseBg }}
      aria-label="Loading document…"
    >
      <div className="relative mb-7">
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center"
          style={{
            background: `rgba(${pRgb},0.10)`,
            border: `1px solid rgba(${pRgb},0.20)`,
          }}
        >
          <FileText size={36} style={{ color: `rgb(${pRgb})` }} strokeWidth={1.6} />
        </div>
        <div
          className="absolute inset-0 rounded-2xl border-2 animate-ping"
          style={{ borderColor: `rgba(${pRgb},0.30)`, animationDuration: '1.8s' }}
        />
      </div>

      <div className="flex items-center gap-3 mb-3">
        <Loader2 size={18} style={{ color: `rgb(${pRgb})` }} className="animate-spin flex-shrink-0" />
        <p className="text-white/80 text-sm font-medium">Loading document…</p>
      </div>

      <p className="text-gray-400 text-xs max-w-xs text-center truncate px-4">{title}</p>

      <div
        className="mt-5 flex items-center gap-1.5 px-3 py-1.5 rounded-full"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        {isGDrive ? (
          <>
            <Globe size={11} className="text-blue-400" />
            <span className="text-[11px] text-gray-400">Via Google Drive</span>
          </>
        ) : (
          <>
            <Shield size={11} style={{ color: `rgb(${pRgb})` }} />
            <span className="text-[11px] text-gray-400">Secure PDF Viewer</span>
          </>
        )}
      </div>

      <div
        className="mt-6 w-48 h-0.5 rounded-full overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.06)' }}
      >
        <div
          className="h-full rounded-full"
          style={{
            background: `rgba(${pRgb},0.60)`,
            animation: 'nv-indeterminate 1.6s ease-in-out infinite',
          }}
        />
      </div>

      <style>{`
        @keyframes nv-indeterminate {
          0%   { transform: translateX(-100%) scaleX(0.4); }
          50%  { transform: translateX(50%)   scaleX(0.6); }
          100% { transform: translateX(300%)  scaleX(0.4); }
        }
      `}</style>
    </div>
  );
};

// ─── Watermark Overlay ────────────────────────────────────────────────────────

const WatermarkOverlay: React.FC<{ userId: string }> = ({ userId }) => (
  <>
    <div className="absolute top-3 left-3 z-20 pointer-events-none select-none" aria-hidden="true">
      <span style={{
        fontSize: '10px', fontFamily: 'monospace',
        color: 'rgba(255,255,255,0.18)', letterSpacing: '0.05em',
        textShadow: '0 1px 2px rgba(0,0,0,0.5)', userSelect: 'none',
      }}>
        {userId}
      </span>
    </div>
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

interface ViewerShellProps {
  title: string;
  isGDrive?: boolean;
  userId: string;
  onClose: () => void;
  toolbarExtra?: React.ReactNode;
  children: React.ReactNode;
  loaded: boolean;
}

const ViewerShell: React.FC<ViewerShellProps> = ({
  title, isGDrive, userId, onClose, toolbarExtra, children, loaded,
}) => {
  const { primaryColor, theme } = useDashboard();
  const pRgb = hexRgb(primaryColor);
  const baseBg = THEME_BG[theme] ?? '#0d1117';

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const portal = (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        display: 'flex', flexDirection: 'column',
        background: baseBg,
      }}
    >
      {/* Top toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: 'max(10px, env(safe-area-inset-top)) 14px 10px',
        flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: baseBg,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}>
        {/* Close */}
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

        {/* Icon + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
          {isGDrive ? (
            <svg viewBox="0 0 24 24" style={{ width: '15px', height: '15px', flexShrink: 0 }} aria-hidden="true">
              <path fill="#4285F4" d="M6 2L2 8l4 7h8l4-7-4-6z" />
              <path fill="#0F9D58" d="M2 8l4 7 4-7z" />
              <path fill="#F4B400" d="M14 15l4-7-4-6z" />
              <path fill="#EA4335" d="M6 9l8 6-4-7z" />
            </svg>
          ) : (
            <FileText size={14} style={{ color: `rgb(${pRgb})`, flexShrink: 0 }} strokeWidth={2} />
          )}
          <p style={{
            fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.72)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {title}
          </p>
        </div>

        {toolbarExtra}
      </div>

      {/* Content area */}
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        {!loaded && <ViewerLoadingScreen title={title} isGDrive={isGDrive} />}
        {loaded && <WatermarkOverlay userId={userId} />}
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
  const [zoom, setZoom] = useState(100);
  const [loaded, setLoaded] = useState(false);
  const { theme } = useDashboard();
  const darkMode = theme !== 'light';
  const baseBg = THEME_BG[theme] ?? '#0d1117';

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
      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)',
      borderRadius: '8px', padding: '3px', flexShrink: 0,
    }}>
      <button
        onClick={() => setZoom(z => Math.max(z - 20, 40))}
        title="Zoom out"
        style={{
          padding: '5px 7px', borderRadius: '5px', border: 'none',
          background: 'transparent', color: '#94a3b8', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <ZoomOut size={14} />
      </button>
      <button
        onClick={() => setZoom(100)}
        title="Reset zoom"
        style={{
          padding: '4px 6px', borderRadius: '5px', border: 'none',
          background: 'transparent', color: '#cbd5e1', cursor: 'pointer',
          fontSize: '11px', fontFamily: 'monospace', minWidth: '44px', textAlign: 'center',
        }}
      >
        {zoom}%
      </button>
      <button
        onClick={() => setZoom(z => Math.min(z + 20, 200))}
        title="Zoom in"
        style={{
          padding: '5px 7px', borderRadius: '5px', border: 'none',
          background: 'transparent', color: '#94a3b8', cursor: 'pointer',
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
        background: baseBg,
        opacity: loaded ? 1 : 0,
        transition: 'opacity 0.3s ease',
      }}>
        <div style={{
          width: `${zoom}%`,
          minWidth: zoom < 100 ? '100%' : undefined,
          transition: 'width 0.2s ease',
        }}>
          <iframe
            src={`${url}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
            style={{
              width: '100%', height: '82vh',
              border: 'none', background: 'transparent',
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
    <ViewerShell title={title} isGDrive userId={userId} onClose={onClose} loaded={loaded}>
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

// ─── Info Pill — theme-aware, no hardcoded bg colors ─────────────────────────

interface InfoPillProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
}

const InfoPill: React.FC<InfoPillProps> = ({ icon, label, value, valueClassName = '' }) => {
  const { theme, primaryColor } = useDashboard();
  const darkMode = theme !== 'light';
  const pRgb = hexRgb(primaryColor);
  const textPrimary = darkMode ? '#f1f5f9' : '#111827';
  const textMuted   = darkMode ? '#475569' : '#9ca3af';

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl"
      style={{
        background: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
        border: `1px solid ${darkMode ? `rgba(${pRgb},0.12)` : 'rgba(0,0,0,0.07)'}`,
      }}
    >
      <div style={{ color: darkMode ? '#475569' : '#9ca3af', flexShrink: 0 }}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-widest font-semibold mb-0.5" style={{ color: textMuted }}>
          {label}
        </p>
        <p
          className={`text-sm font-medium truncate ${valueClassName}`}
          style={!valueClassName ? { color: textPrimary } : undefined}
        >
          {value}
        </p>
      </div>
    </div>
  );
};

// ─── Source Badge ─────────────────────────────────────────────────────────────

const SourceBadge: React.FC<{ isGDrive: boolean; hasFile: boolean }> = ({ isGDrive, hasFile }) => {
  const { primaryColor } = useDashboard();
  const pRgb = hexRgb(primaryColor);

  if (!hasFile) return null;

  if (isGDrive) {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-blue-300 text-xs font-medium"
        style={{ background: 'rgba(59,130,246,0.10)', border: '1px solid rgba(59,130,246,0.20)' }}
      >
        <Globe size={10} /> Google Drive
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
      style={{
        background: `rgba(${pRgb},0.10)`,
        border: `1px solid rgba(${pRgb},0.20)`,
        color: `rgb(${pRgb})`,
      }}
    >
      <Shield size={10} /> Secure PDF
    </span>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const NoteViewer: React.FC = () => {
  const { courseId, contentId } = useParams<{ courseId: string; contentId: string }>();
  const navigate = useNavigate();
  const { user, theme, primaryColor, accentColor } = useDashboard();

  const [content, setContent] = useState<LibraryContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewerOpen, setViewerOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // ── Derived theme tokens — exact same pattern as ComingSoon.tsx ──
  const darkMode     = theme !== 'light';
  const pRgb         = hexRgb(primaryColor);
  const baseBg       = THEME_BG[theme] ?? '#0d1117';
  const textPrimary  = darkMode ? '#f1f5f9' : '#111827';
  const textSecondary= darkMode ? '#94a3b8' : '#6b7280';
  const dividerColor = darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const gradient     = `linear-gradient(135deg,${primaryColor} 0%,${accentColor} 100%)`;
  const btnSecBg     = darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
  const btnSecBorder = darkMode ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.09)';

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
        if (!found)                { setError('Note content not found.');     return; }
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

  // ── Loading state ──
  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: baseBg, fontFamily: "'Outfit', sans-serif" }}
      >
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{
              background: `rgba(${pRgb},0.10)`,
              border: `1px solid rgba(${pRgb},0.20)`,
            }}
          >
            <Loader2 size={24} style={{ color: `rgb(${pRgb})` }} className="animate-spin" />
          </div>
          <p style={{ color: textSecondary }} className="text-sm">Loading note…</p>
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (error || !content) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: baseBg, fontFamily: "'Outfit', sans-serif" }}
      >
        <div className="flex flex-col items-center gap-5 text-center max-w-sm w-full">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{
              background: 'rgba(239,68,68,0.10)',
              border: '1px solid rgba(239,68,68,0.20)',
            }}
          >
            <AlertCircle size={28} className="text-red-400" />
          </div>
          <div>
            <p style={{ color: textPrimary }} className="font-semibold text-lg mb-1">
              Unable to load note
            </p>
            <p style={{ color: textSecondary }} className="text-sm">
              {error || 'Note not found.'}
            </p>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{
              background: btnSecBg,
              border: `1px solid ${btnSecBorder}`,
              color: textSecondary,
              fontFamily: "'Outfit', sans-serif",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.color = textPrimary;
              (e.currentTarget as HTMLButtonElement).style.background =
                darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.color = textSecondary;
              (e.currentTarget as HTMLButtonElement).style.background = btnSecBg;
            }}
          >
            <ArrowLeft size={14} />
            Go back
          </button>
        </div>
      </div>
    );
  }

  // ── Main render ──
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

      <div
        className="min-h-screen"
        style={{ background: baseBg, fontFamily: "'Outfit', sans-serif" }}
      >
        {/* Ambient radial glow — mirrors ComingSoon banner approach */}
        <div
          className="fixed inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            background: `radial-gradient(ellipse 65% 35% at 50% -4%, rgba(${pRgb},0.08) 0%, transparent 65%)`,
          }}
        />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5 sm:space-y-6">

          {/* Back nav */}
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-xl transition-all focus:outline-none"
            style={{
              color: textSecondary,
              background: 'transparent',
              border: '1px solid transparent',
              fontFamily: "'Outfit', sans-serif",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.color = textPrimary;
              (e.currentTarget as HTMLButtonElement).style.background =
                darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
              (e.currentTarget as HTMLButtonElement).style.borderColor =
                darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.color = textSecondary;
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent';
            }}
          >
            <ArrowLeft size={15} />
            Back to Library
          </button>

          {/* ── Hero Card ── uses Card component exactly like FeatureCard in ComingSoon ── */}
          <Card className="p-0 overflow-hidden">

            {/* Card Header */}
            <div
              className="relative px-5 sm:px-7 py-6 sm:py-8"
              style={{
                borderBottom: `1px solid ${dividerColor}`,
                background: `linear-gradient(135deg, rgba(${pRgb},0.08) 0%, rgba(${pRgb},0.02) 50%, transparent 100%)`,
              }}
            >
              {/* Badge row */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide"
                  style={{
                    background: `rgba(${pRgb},0.12)`,
                    border: `1px solid rgba(${pRgb},0.25)`,
                    color: `rgb(${pRgb})`,
                  }}
                >
                  <FileText size={11} strokeWidth={2.5} />
                  Note
                </span>
                <SourceBadge isGDrive={isGDrive} hasFile={hasFile} />
              </div>

              {/* Title */}
              <h1
                className="text-xl sm:text-2xl lg:text-3xl font-bold leading-tight mb-2 tracking-tight"
                style={{ color: textPrimary }}
              >
                {content.title}
              </h1>

              {content.subject && (
                <p className="text-sm font-medium" style={{ color: textSecondary }}>
                  {content.subject}
                </p>
              )}

              {/* Ghost icon — decorative */}
              <div
                className="absolute right-5 sm:right-7 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
                style={{ opacity: 0.05, color: textPrimary }}
              >
                <FileText size={88} strokeWidth={1} />
              </div>
            </div>

            {/* ── Action Buttons ── */}
            {hasFile ? (
              <div className="px-5 sm:px-7 py-5 sm:py-6" style={{ borderBottom: `1px solid ${dividerColor}` }}>
                <div className="flex flex-col sm:flex-row gap-3">

                  {/* View Note — primary gradient (mirrors ComingSoon submit/try button) */}
                  <button
                    onClick={() => setViewerOpen(true)}
                    className="flex-1 flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 hover:-translate-y-0.5 focus:outline-none"
                    style={{
                      background: gradient,
                      border: 'none',
                      color: '#fff',
                      boxShadow: `0 4px 20px rgba(${pRgb},0.25)`,
                      fontFamily: "'Outfit', sans-serif",
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLButtonElement).style.boxShadow =
                        `0 8px 28px rgba(${pRgb},0.40)`;
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLButtonElement).style.boxShadow =
                        `0 4px 20px rgba(${pRgb},0.25)`;
                    }}
                  >
                    <Eye size={17} />
                    View Note
                  </button>

                  {/* Download — secondary ghost (mirrors ComingSoon cancel button) */}
                  <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className="flex-1 flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 hover:-translate-y-0.5 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
                    style={{
                      background: btnSecBg,
                      border: `1px solid ${btnSecBorder}`,
                      color: textSecondary,
                      fontFamily: "'Outfit', sans-serif",
                    }}
                    onMouseEnter={e => {
                      if (!downloading) {
                        (e.currentTarget as HTMLButtonElement).style.color = textPrimary;
                        (e.currentTarget as HTMLButtonElement).style.background =
                          darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)';
                      }
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLButtonElement).style.color = textSecondary;
                      (e.currentTarget as HTMLButtonElement).style.background = btnSecBg;
                    }}
                  >
                    {downloading ? <Loader2 size={17} className="animate-spin" /> : <Download size={17} />}
                    {downloading ? 'Downloading…' : 'Download'}
                  </button>
                </div>

                {/* Security note */}
                <p
                  className="text-center text-[11px] mt-3 flex items-center justify-center gap-1.5"
                  style={{ color: darkMode ? '#475569' : '#9ca3af' }}
                >
                  <Shield size={10} style={{ color: `rgba(${pRgb},0.5)` }} />
                  {isGDrive
                    ? 'Previewed securely via Google Drive • Watermarked for copyright protection'
                    : 'Viewed in a protected environment • Watermarked for copyright protection'}
                </p>
              </div>
            ) : (
              <div className="px-5 sm:px-7 py-5 sm:py-6" style={{ borderBottom: `1px solid ${dividerColor}` }}>
                <div
                  className="flex items-center gap-3 px-4 py-3.5 rounded-xl"
                  style={{
                    background: 'rgba(245,158,11,0.08)',
                    border: '1px solid rgba(245,158,11,0.15)',
                  }}
                >
                  <AlertCircle size={16} className="text-yellow-400 flex-shrink-0" />
                  <p className="text-yellow-300 text-sm">No file attached to this note yet.</p>
                </div>
              </div>
            )}

            {/* ── Info Grid ── */}
            <div className="px-5 sm:px-7 py-5 sm:py-6 space-y-5">

              {/* Description */}
              {content.description && (
                <div className="space-y-1.5">
                  <p
                    className="text-[10px] uppercase tracking-widest font-semibold"
                    style={{ color: darkMode ? '#475569' : '#9ca3af' }}
                  >
                    Description
                  </p>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: darkMode ? '#cbd5e1' : '#374151' }}
                  >
                    {content.description}
                  </p>
                </div>
              )}

              {/* Metadata pills grid — same as ComingSoon feature card layout */}
              {(content.subject || (content.duration && content.duration > 0) || (content as any).difficulty || (content as any).language) && (
                <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
                  {content.subject && (
                    <InfoPill
                      icon={<BookOpen size={15} />}
                      label="Subject"
                      value={content.subject}
                    />
                  )}
                  {content.duration && content.duration > 0 && (
                    <InfoPill
                      icon={<Clock size={15} />}
                      label="Est. Read Time"
                      value={formatDuration(content.duration)}
                      valueClassName="text-green-400"
                    />
                  )}
                  {(content as any).difficulty && (
                    <InfoPill
                      icon={<Tag size={15} />}
                      label="Difficulty"
                      value={diffMeta.label}
                      valueClassName={diffMeta.colorClass}
                    />
                  )}
                  {(content as any).language && (
                    <InfoPill
                      icon={<Globe size={15} />}
                      label="Language"
                      value={(content as any).language}
                    />
                  )}
                </div>
              )}

              {/* Tags */}
              {(content as any).tags && (content as any).tags.length > 0 && (
                <div className="space-y-2">
                  <p
                    className="text-[10px] uppercase tracking-widest font-semibold"
                    style={{ color: darkMode ? '#475569' : '#9ca3af' }}
                  >
                    Tags
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(content as any).tags.map((tag: string) => (
                      <span
                        key={tag}
                        className="px-2.5 py-1 rounded-full text-xs"
                        style={{
                          background: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                          border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                          color: textSecondary,
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer security line */}
              <div
                className="pt-3"
                style={{ borderTop: `1px solid ${dividerColor}` }}
              >
                <div
                  className="flex items-center gap-2 text-xs"
                  style={{ color: darkMode ? '#374151' : '#9ca3af' }}
                >
                  <Shield size={11} />
                  <span>
                    {isGDrive
                      ? 'Hosted on Google Drive — previewed via secure embed'
                      : 'PDF stored securely — rendered in protected viewer'}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* Bottom breathing room for mobile nav bars */}
          <div className="h-6 sm:h-2" aria-hidden="true" />
        </div>
      </div>
    </>
  );
};

export default NoteViewer;
