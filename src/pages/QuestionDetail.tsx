// src/pages/QuestionDetail.tsx — Fully restyled to match StudentQA exactly
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, BookOpen, User, Loader, AlertCircle, FileText,
  Volume2, Brain, MessageSquare, ThumbsUp, HelpCircle, Trash2,
  X, Filter, XCircle, Star, Edit2, Bookmark, Download, Eye,
  Mic, Pause, Play,
} from 'lucide-react';
import Card from '../components/ui/Card';
import { qaService, Question, Answer } from '../services/qaService';
import { courseService, Course } from '../services/courseService';
import { useDashboard, DashboardContext } from '../contexts/DashboardContext';
import { notificationService } from '../services/notificationService';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

// ─── NoAnimCard — identical to StudentQA ─────────────────────────────────────
const NoAnimCard = ({ children, className, style, onClick }: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties; onClick?: () => void;
}) => {
  const ctx = useDashboard();
  return (
    <div data-no-anim onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      <style>{`
        [data-no-anim] * { animation-duration: 0.001ms !important; animation-delay: 0s !important; animation-fill-mode: none !important; }
        [data-no-anim] .cm-tilt,[data-no-anim] .cm-lift,[data-no-anim] .cm-spring,
        [data-no-anim] .cm-glow,[data-no-anim] .cm-magnetic,[data-no-anim] .cm-reset {
          transform: none !important; box-shadow: inherit !important; transition: none !important;
        }
      `}</style>
      <DashboardContext.Provider value={{ ...ctx, cardAnimation: 'none' }}>
        <Card className={className} style={style} tilt={false}>{children}</Card>
      </DashboardContext.Provider>
    </div>
  );
};

// ─── Theme helpers — identical to StudentQA ───────────────────────────────────
const hexRgb = (hex: string) => {
  if (!hex || hex.length < 7) return '99,102,241';
  return `${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)}`;
};

const THEME_BG: Record<string, string> = {
  dark: '#0d1117', light: '#ebe8e1', slate: '#0f172a',
  ocean: '#0c1a2e', forest: '#0a1f14', purple: '#1e1b4b',
  pink: '#831843', sunset: '#1c0a00',
};

const useT = () => {
  const { theme, primaryColor, accentColor } = useDashboard();
  const isLight = theme === 'light';
  const pRgb = hexRgb(primaryColor);
  return {
    isLight, darkMode: !isLight, theme, primaryColor, accentColor, pRgb,
    baseBg: THEME_BG[theme] ?? '#0d1117',
    text: isLight ? '#111827' : '#f1f5f9',
    text2: isLight ? '#6b7280' : '#94a3b8',
    text3: isLight ? '#9ca3af' : '#475569',
    border: isLight ? 'rgba(0,0,0,0.08)' : `rgba(${hexRgb(primaryColor)},0.15)`,
    surface: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)',
    cardBg: isLight ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.04)',
    inputBg: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.16)',
    inputBorder: isLight ? 'rgba(0,0,0,0.10)' : `rgba(${hexRgb(primaryColor)},0.22)`,
    divider: isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.06)',
    btnSecBg: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.07)',
    btnSecBorder: isLight ? 'rgba(0,0,0,0.09)' : 'rgba(255,255,255,0.09)',
    danger: '#ef4444',
    green: '#22c55e',
    gold: '#f59e0b',
    purple2: '#8b5cf6',
    gradient: `linear-gradient(135deg,${primaryColor} 0%,${accentColor} 100%)`,
  };
};

// ─── ModalShell — identical to StudentQA ─────────────────────────────────────
const ModalShell = ({ children, onClose, wide }: {
  children: React.ReactNode; onClose: () => void; wide?: boolean;
}) => {
  const { theme, primaryColor, accentColor, glitterTheme } = useDashboard();
  const darkMode = theme !== 'light';
  const isLight = theme === 'light';
  const pRgb = hexRgb(primaryColor);
  const baseBg = THEME_BG[theme] ?? '#0d1117';

  const glitterImageMap: Record<string, string> = {
    silver: isLight ? `
      radial-gradient(ellipse at 20% 20%, rgba(0,0,0,0.04) 0%, transparent 50%),
      radial-gradient(ellipse at 80% 80%, rgba(0,0,0,0.03) 0%, transparent 50%),
      radial-gradient(circle at 30% 40%, rgba(80,80,100,0.60) 1px, transparent 1px),
      radial-gradient(circle at 70% 20%, rgba(80,80,100,0.52) 1px, transparent 1px),
      radial-gradient(circle at 50% 70%, rgba(80,80,100,0.56) 1px, transparent 1px),
      radial-gradient(circle at 15% 80%, rgba(80,80,100,0.48) 1px, transparent 1px),
      radial-gradient(circle at 85% 60%, rgba(80,80,100,0.60) 1px, transparent 1px),
      radial-gradient(circle at 60% 45%, rgba(80,80,100,0.52) 1px, transparent 1px),
      radial-gradient(circle at 40% 15%, rgba(80,80,100,0.55) 1px, transparent 1px),
      radial-gradient(circle at 90% 35%, rgba(80,80,100,0.48) 1px, transparent 1px)
    ` : `
      radial-gradient(ellipse at 20% 20%, rgba(255,255,255,0.05) 0%, transparent 50%),
      radial-gradient(ellipse at 80% 80%, rgba(255,255,255,0.03) 0%, transparent 50%),
      radial-gradient(circle at 30% 40%, rgba(220,220,240,0.55) 0.5px, transparent 0.5px),
      radial-gradient(circle at 70% 20%, rgba(200,200,220,0.45) 0.5px, transparent 0.5px),
      radial-gradient(circle at 50% 70%, rgba(220,220,240,0.50) 0.5px, transparent 0.5px),
      radial-gradient(circle at 15% 80%, rgba(200,200,220,0.40) 0.5px, transparent 0.5px),
      radial-gradient(circle at 85% 60%, rgba(220,220,240,0.55) 0.5px, transparent 0.5px),
      radial-gradient(circle at 60% 45%, rgba(200,200,220,0.45) 0.5px, transparent 0.5px),
      radial-gradient(circle at 40% 15%, rgba(220,220,240,0.50) 0.5px, transparent 0.5px),
      radial-gradient(circle at 90% 35%, rgba(200,200,220,0.40) 0.5px, transparent 0.5px)
    `,
    gold: isLight ? `
      radial-gradient(ellipse at 15% 15%, rgba(180,130,0,0.09) 0%, transparent 45%),
      radial-gradient(ellipse at 85% 85%, rgba(150,110,0,0.07) 0%, transparent 45%),
      radial-gradient(circle at 25% 35%, rgba(160,120,0,0.72) 1px, transparent 1px),
      radial-gradient(circle at 75% 25%, rgba(180,140,0,0.68) 1px, transparent 1px),
      radial-gradient(circle at 45% 65%, rgba(160,120,0,0.70) 1px, transparent 1px),
      radial-gradient(circle at 80% 70%, rgba(180,140,0,0.62) 1px, transparent 1px),
      radial-gradient(circle at 10% 55%, rgba(160,120,0,0.65) 1px, transparent 1px),
      radial-gradient(circle at 60% 15%, rgba(180,140,0,0.72) 1px, transparent 1px),
      radial-gradient(circle at 35% 85%, rgba(160,120,0,0.58) 1px, transparent 1px)
    ` : `
      radial-gradient(ellipse at 15% 15%, rgba(212,175,55,0.12) 0%, transparent 45%),
      radial-gradient(ellipse at 85% 85%, rgba(180,140,30,0.08) 0%, transparent 45%),
      radial-gradient(circle at 25% 35%, rgba(212,175,55,0.60) 0.5px, transparent 0.5px),
      radial-gradient(circle at 75% 25%, rgba(255,215,0,0.55) 0.5px, transparent 0.5px),
      radial-gradient(circle at 45% 65%, rgba(212,175,55,0.58) 0.5px, transparent 0.5px),
      radial-gradient(circle at 80% 70%, rgba(255,215,0,0.48) 0.5px, transparent 0.5px),
      radial-gradient(circle at 10% 55%, rgba(212,175,55,0.52) 0.5px, transparent 0.5px),
      radial-gradient(circle at 60% 15%, rgba(255,215,0,0.62) 0.5px, transparent 0.5px),
      radial-gradient(circle at 35% 85%, rgba(212,175,55,0.42) 0.5px, transparent 0.5px)
    `,
    purple: isLight ? `
      radial-gradient(ellipse at 20% 30%, rgba(99,102,241,0.10) 0%, transparent 45%),
      radial-gradient(ellipse at 80% 70%, rgba(79,70,229,0.08) 0%, transparent 45%),
      radial-gradient(circle at 30% 40%, rgba(99,102,241,0.65) 1px, transparent 1px),
      radial-gradient(circle at 70% 20%, rgba(79,70,229,0.60) 1px, transparent 1px),
      radial-gradient(circle at 55% 70%, rgba(99,102,241,0.62) 1px, transparent 1px),
      radial-gradient(circle at 15% 60%, rgba(79,70,229,0.55) 1px, transparent 1px),
      radial-gradient(circle at 88% 50%, rgba(99,102,241,0.60) 1px, transparent 1px),
      radial-gradient(circle at 45% 15%, rgba(79,70,229,0.65) 1px, transparent 1px),
      radial-gradient(circle at 75% 85%, rgba(99,102,241,0.50) 1px, transparent 1px)
    ` : `
      radial-gradient(ellipse at 20% 30%, rgba(139,92,246,0.12) 0%, transparent 45%),
      radial-gradient(ellipse at 80% 70%, rgba(99,102,241,0.10) 0%, transparent 45%),
      radial-gradient(circle at 30% 40%, rgba(200,180,255,0.70) 0.5px, transparent 0.5px),
      radial-gradient(circle at 70% 20%, rgba(180,160,240,0.62) 0.5px, transparent 0.5px),
      radial-gradient(circle at 55% 70%, rgba(220,200,255,0.68) 0.5px, transparent 0.5px),
      radial-gradient(circle at 15% 60%, rgba(200,180,255,0.58) 0.5px, transparent 0.5px),
      radial-gradient(circle at 88% 50%, rgba(180,160,240,0.64) 0.5px, transparent 0.5px),
      radial-gradient(circle at 45% 15%, rgba(220,200,255,0.72) 0.5px, transparent 0.5px),
      radial-gradient(circle at 75% 85%, rgba(200,180,255,0.50) 0.5px, transparent 0.5px)
    `,
  };

  const glitterBgImage = glitterImageMap[glitterTheme] ?? '';
  const glitterBgSize = glitterTheme === 'silver'
    ? 'auto, auto, 80px 80px, 120px 120px, 90px 90px, 110px 110px, 70px 70px, 100px 100px, 85px 85px, 95px 95px'
    : glitterTheme === 'gold'
    ? 'auto, auto, 60px 60px, 90px 90px, 75px 75px, 110px 110px, 50px 50px, 80px 80px, 95px 95px'
    : glitterTheme === 'purple'
    ? 'auto, auto, 55px 55px, 85px 85px, 70px 70px, 100px 100px, 65px 65px, 90px 90px, 78px 78px'
    : 'auto';

  const sbSparkle = glitterBgImage
    ? glitterBgImage
    : `radial-gradient(ellipse at 20% 20%, rgba(${pRgb},0.18) 0%, transparent 60%),
       radial-gradient(ellipse at 80% 80%, rgba(${pRgb},0.12) 0%, transparent 50%),
       radial-gradient(ellipse at 50% 50%, ${darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.55)'} 0%, transparent 70%)`;

  const sbBorder = darkMode ? `1px solid rgba(${pRgb},0.22)` : `1px solid rgba(255,255,255,0.95)`;
  const sbShadow = darkMode
    ? `0 8px 40px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(${pRgb},0.12), 0 0 60px rgba(${pRgb},0.06)`
    : `0 8px 32px rgba(0,0,0,0.10), inset 0 0 0 1px rgba(255,255,255,0.8), 0 0 40px rgba(${pRgb},0.07)`;

  return createPortal(
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={`w-full ${wide ? 'max-w-3xl' : 'max-w-md'}`}
        style={{
          backgroundColor: baseBg, backgroundImage: sbSparkle, backgroundSize: glitterBgSize,
          backdropFilter: 'blur(32px) saturate(200%)', WebkitBackdropFilter: 'blur(32px) saturate(200%)',
          border: sbBorder, borderRadius: 24, boxShadow: sbShadow,
          fontFamily: "'Outfit', sans-serif", position: 'relative', isolation: 'isolate',
          maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none', zIndex: 0,
          background: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
          opacity: darkMode ? 0.04 : 0.025, mixBlendMode: 'overlay',
        }} />
        <div style={{ position: 'absolute', top: -30, left: '50%', transform: 'translateX(-50%)',
          width: 120, height: 120, borderRadius: '50%',
          background: `radial-gradient(circle, rgba(${pRgb},${darkMode ? 0.20 : 0.12}) 0%, transparent 70%)`,
          pointerEvents: 'none', zIndex: 0, filter: 'blur(20px)',
        }} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

// ─── renderFormattedText ──────────────────────────────────────────────────────
const renderFormattedText = (text: string) => {
  if (!text) return null;
  const blockMathRegex = /\$\$([\s\S]*?)\$\$/g;
  const parts = text.split(blockMathRegex);
  return parts.map((part, index) => {
    if (index % 2 === 1) {
      try { return <BlockMath key={index} math={part} />; }
      catch (e) { return <span key={index} className="text-error-light">{part}</span>; }
    } else {
      const inlineMathRegex = /\$([^\$]+)\$/g;
      const inlineParts = part.split(inlineMathRegex);
      return inlineParts.map((inlinePart, inlineIndex) => {
        if (inlineIndex % 2 === 1) {
          try { return <InlineMath key={`${index}-${inlineIndex}`} math={inlinePart} />; }
          catch (e) { return <span key={`${index}-${inlineIndex}`} className="text-error-light">{inlinePart}</span>; }
        } else {
          return inlinePart.split('\n').map((line, lineIndex) => (
            <span key={`${index}-${inlineIndex}-${lineIndex}`}>
              {line}
              {lineIndex < inlinePart.split('\n').length - 1 && <br />}
            </span>
          ));
        }
      });
    }
  });
};

// ─── AudioPlayer ──────────────────────────────────────────────────────────────
interface AudioPlayerProps { audioUrl: string; label: string; }

const AudioPlayer = ({ audioUrl, label }: AudioPlayerProps) => {
  const T = useT();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioElement] = useState(new Audio(audioUrl));

  useEffect(() => {
    const audio = audioElement;
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
    };
  }, [audioElement]);

  const togglePlayPause = () => {
    if (isPlaying) { audioElement.pause(); } else { audioElement.play(); }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    audioElement.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{
      background: `linear-gradient(135deg, rgba(${T.pRgb},0.12) 0%, rgba(139,92,246,0.08) 100%)`,
      border: `1px solid rgba(${T.pRgb},0.22)`, borderRadius: 12, padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Volume2 size={16} style={{ color: T.primaryColor }} />
        <span style={{ color: T.text, fontWeight: 600, fontSize: 13 }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={togglePlayPause}
          style={{
            flexShrink: 0, width: 36, height: 36, borderRadius: '50%',
            background: T.gradient, border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {isPlaying ? <Pause size={15} style={{ color: '#fff' }} /> : <Play size={15} style={{ color: '#fff', marginLeft: 1 }} />}
        </button>
        <div style={{ flex: 1 }}>
          <input
            type="range" min="0" max={duration || 0} value={currentTime}
            onChange={handleSeek}
            style={{
              width: '100%', height: 4, appearance: 'none', borderRadius: 2, cursor: 'pointer',
              background: `linear-gradient(to right, ${T.primaryColor} 0%, ${T.primaryColor} ${duration ? (currentTime / duration) * 100 : 0}%, ${T.divider} ${duration ? (currentTime / duration) * 100 : 0}%, ${T.divider} 100%)`,
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ fontSize: 11, color: T.text3 }}>{formatTime(currentTime)}</span>
            <span style={{ fontSize: 11, color: T.text3 }}>{formatTime(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Shared inline-badge helpers ─────────────────────────────────────────────
const StatusBadge = ({ status }: { status: string }) => {
  const bg = status === 'pending' ? 'rgba(245,158,11,0.15)' : status === 'closed' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)';
  const color = status === 'pending' ? '#f59e0b' : status === 'closed' ? '#ef4444' : '#22c55e';
  const label = status === 'pending' ? 'Pending' : status === 'closed' ? 'Closed' : 'Answered';
  return (
    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: bg, color, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
};

const AnswerTypeBadge = ({ type }: { type: 'ai' | 'teacher' }) => (
  <span style={{
    padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
    background: type === 'ai' ? 'rgba(139,92,246,0.15)' : 'rgba(59,130,246,0.15)',
    color: type === 'ai' ? '#a78bfa' : '#60a5fa',
  }}>
    {type === 'ai' ? '🤖 AI' : '👨‍🏫 Teacher'}
  </span>
);

// ─── File attachment row ──────────────────────────────────────────────────────
const FileRow = ({ fileName, fileUrl, onViewDocument, T }: {
  fileName: string; fileUrl: string;
  onViewDocument: (url: string, name: string, type: 'pdf' | 'other') => void;
  T: ReturnType<typeof useT>;
}) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
    background: T.surface, borderRadius: 10, border: `1px solid ${T.border}`,
    flexWrap: 'wrap',
  }}>
    <FileText size={18} style={{ color: T.primaryColor, flexShrink: 0 }} />
    <span style={{ flex: 1, color: T.text, fontSize: 13, fontWeight: 500, wordBreak: 'break-all', minWidth: 0 }}>{fileName}</span>
    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
      {fileName.toLowerCase().endsWith('.pdf') && (
        <button
          onClick={() => onViewDocument(fileUrl, fileName, 'pdf')}
          style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, border: 'none',
            background: T.gradient, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            fontFamily: "'Outfit',sans-serif",
          }}
        >
          <Eye size={13} /> View
        </button>
      )}
      <button
        onClick={() => {
          fetch(fileUrl).then(r => r.blob()).then(blob => {
            const u = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = u; a.download = fileName; a.click();
            window.URL.revokeObjectURL(u);
          });
        }}
        style={{
          display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8,
          border: `1px solid ${T.btnSecBorder}`, background: T.btnSecBg, color: T.text2,
          fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit',sans-serif",
        }}
      >
        <Download size={13} /> Download
      </button>
    </div>
  </div>
);

// ─── Star Rating ──────────────────────────────────────────────────────────────
const StarRating = ({ questionId, answerId, answerType, isOwn, T }: {
  questionId: string; answerId: string; answerType: string; isOwn: boolean; T: ReturnType<typeof useT>;
}) => {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    qaService.getRating(questionId, answerId).then(r => { if (r) setRating(r); }).catch(() => {});
  }, [answerId]);

  const handleRate = async (stars: number) => {
    if (!isOwn) return;
    try {
      await qaService.rateAnswer(questionId, answerId, answerType, stars);
      setRating(stars); setEditing(false);
      if ((window as any).addNotification) (window as any).addNotification('Rating submitted!', 'success');
    } catch { if ((window as any).addNotification) (window as any).addNotification('Failed to submit rating', 'error'); }
  };

  if (!isOwn) return null;

  return (
    <div style={{ paddingTop: 14, borderTop: `1px solid ${T.divider}`, marginTop: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: T.text3 }}>Rate this answer:</span>
        {rating > 0 && !editing && (
          <button onClick={() => setEditing(true)} style={{ fontSize: 11, color: T.primaryColor, background: 'none', border: 'none', cursor: 'pointer' }}>
            Edit Rating
          </button>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            onClick={() => handleRate(star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            disabled={rating > 0 && !editing}
            style={{ background: 'none', border: 'none', padding: 0, cursor: rating > 0 && !editing ? 'not-allowed' : 'pointer', transition: 'transform 0.1s', transform: hovered === star ? 'scale(1.15)' : 'scale(1)' }}
          >
            <Star size={22} style={{ color: star <= (hovered || rating) ? '#f59e0b' : T.text3, fill: star <= (hovered || rating) ? '#f59e0b' : 'none', transition: 'color 0.1s' }} />
          </button>
        ))}
        {rating > 0 && <span style={{ marginLeft: 8, fontSize: 12, color: T.green }}>Rated {rating}/5</span>}
      </div>
      {editing && (
        <button onClick={() => setEditing(false)} style={{ marginTop: 6, fontSize: 11, color: T.text3, background: 'none', border: 'none', cursor: 'pointer' }}>
          Cancel Edit
        </button>
      )}
    </div>
  );
};

// ─── AnswerCard ───────────────────────────────────────────────────────────────
interface AnswerCardProps {
  answer: Answer; questionId: string; isStudentQuestion: boolean; courseId?: string;
  onViewDocument: (url: string, name: string, type: 'pdf' | 'other') => void;
  onViewImage: (url: string) => void;
}

const AnswerCard = ({ answer, questionId, isStudentQuestion, courseId, onViewDocument, onViewImage }: AnswerCardProps) => {
  const T = useT();
  const answerSource = answer.type === 'ai' ? 'AI' : (courseId === 'help-support' ? 'Admin' : 'Teacher');

  return (
    <NoAnimCard>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {answer.type === 'ai'
              ? <Brain size={18} style={{ color: '#a78bfa' }} />
              : <User size={18} style={{ color: T.primaryColor }} />}
            <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>
              {answer.type === 'ai' ? 'AI Solution' : answerSource}
            </span>
          </div>
          <span style={{
            padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
            background: answer.type === 'ai' ? 'rgba(139,92,246,0.15)' : 'rgba(59,130,246,0.15)',
            color: answer.type === 'ai' ? '#a78bfa' : '#60a5fa',
          }}>
            {answer.type === 'ai' ? 'AI Response' : `${answerSource} Response`}
          </span>
        </div>

        {/* Answer text */}
        {answer.answerText && (
          <div style={{ paddingTop: 10, borderTop: `1px solid ${T.divider}`, color: T.text2, lineHeight: 1.7, fontSize: 14 }}>
            {renderFormattedText(answer.answerText)}
          </div>
        )}

        {/* Image */}
        {answer.imageUrl && (
          <img
            src={answer.imageUrl} alt="Answer attachment"
            onClick={() => onViewImage(answer.imageUrl!)}
            style={{ maxHeight: 320, objectFit: 'contain', borderRadius: 10, border: `1px solid ${T.border}`, cursor: 'pointer', transition: 'opacity 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          />
        )}

        {/* Audio */}
        {answer.audioUrl && <AudioPlayer audioUrl={answer.audioUrl} label="Voice Answer" />}

        {/* File */}
        {answer.fileName && answer.fileUrl && (
          <FileRow fileName={answer.fileName} fileUrl={answer.fileUrl} onViewDocument={onViewDocument} T={T} />
        )}

        {answer.type === 'ai' && (
          <div style={{ fontSize: 12, color: T.danger, background: 'rgba(239,68,68,0.08)', borderRadius: 8, padding: '6px 10px', border: '1px solid rgba(239,68,68,0.18)' }}>
            N.B.: AI Solve-mate answers may be inaccurate. Please use the Human Teacher option if you notice a flawed answer.
          </div>
        )}

        <div style={{ fontSize: 12, color: T.text3, paddingTop: 10, borderTop: `1px solid ${T.divider}` }}>
          Answered on {answer.createdAt.toLocaleDateString()} at {answer.createdAt.toLocaleTimeString()}
        </div>

        <StarRating questionId={questionId} answerId={answer.id} answerType={answer.type} isOwn={isStudentQuestion} T={T} />
      </div>
    </NoAnimCard>
  );
};

// ─── FollowUpAnswerCard ───────────────────────────────────────────────────────
const FollowUpAnswerCard = ({ answer, questionId, isOwnQuestion, courseId, onViewDocument, onViewImage }: {
  answer: Answer; questionId: string; isOwnQuestion: boolean; courseId?: string;
  onViewDocument: (url: string, name: string, type: 'pdf' | 'other') => void;
  onViewImage: (url: string) => void;
}) => {
  const T = useT();
  const answerSource = answer.type === 'ai' ? 'AI' : (courseId === 'help-support' ? 'Admin' : 'Teacher');

  return (
    <div style={{
      background: T.surface, borderRadius: 10, padding: '12px 14px',
      border: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {answer.type === 'ai'
          ? <Brain size={15} style={{ color: '#a78bfa' }} />
          : <User size={15} style={{ color: T.primaryColor }} />}
        <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
          {answer.type === 'ai' ? 'AI Solution' : answerSource}
        </span>
      </div>
      <div style={{ color: T.text2, fontSize: 13, lineHeight: 1.65 }}>{renderFormattedText(answer.answerText)}</div>

      {answer.imageUrl && (
        <img src={answer.imageUrl} alt="Answer" onClick={() => onViewImage(answer.imageUrl!)}
          style={{ maxHeight: 220, objectFit: 'contain', borderRadius: 8, cursor: 'pointer', transition: 'opacity 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        />
      )}
      {answer.audioUrl && <AudioPlayer audioUrl={answer.audioUrl} label="Voice Answer" />}
      {answer.fileName && answer.fileUrl && (
        <FileRow fileName={answer.fileName} fileUrl={answer.fileUrl} onViewDocument={onViewDocument} T={T} />
      )}
      {answer.type === 'ai' && (
        <div style={{ fontSize: 11, color: T.danger }}>N.B.: AI answers may be inaccurate.</div>
      )}
      <StarRating questionId={questionId} answerId={answer.id} answerType={answer.type} isOwn={isOwnQuestion} T={T} />
    </div>
  );
};

// ─── FollowUpQuestionCard ─────────────────────────────────────────────────────
const FollowUpQuestionCard = ({ question, courseId, onViewDocument, onViewImage }: {
  question: Question; courseId?: string;
  onViewDocument: (url: string, name: string, type: 'pdf' | 'other') => void;
  onViewImage: (url: string) => void;
}) => {
  const T = useT();
  const { user } = useDashboard();
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    qaService.getAnswersForQuestion(question.id)
      .then(setAnswers).catch(console.error).finally(() => setLoading(false));
  }, [question.id]);

  return (
    <NoAnimCard>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MessageSquare size={16} style={{ color: '#fb923c' }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Follow-up Question</span>
            <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: 'rgba(251,146,60,0.15)', color: '#fb923c' }}>Follow-up</span>
          </div>
          <StatusBadge status={question.status} />
        </div>

        <div style={{ paddingTop: 10, borderTop: `1px solid ${T.divider}`, color: T.text2, fontSize: 14, lineHeight: 1.65 }}>
          {renderFormattedText(question.questionText)}
        </div>

        {question.imageUrl && (
          <img src={question.imageUrl} alt="Follow-up attachment" onClick={() => onViewImage(question.imageUrl!)}
            style={{ maxHeight: 280, objectFit: 'contain', borderRadius: 10, border: `1px solid ${T.border}`, cursor: 'pointer' }}
          />
        )}
        {question.audioUrl && <AudioPlayer audioUrl={question.audioUrl} label="Voice Question" />}
        {question.fileName && question.fileUrl && (
          <FileRow fileName={question.fileName} fileUrl={question.fileUrl} onViewDocument={onViewDocument} T={T} />
        )}

        <div style={{ fontSize: 12, color: T.text3 }}>
          Asked on {question.createdAt.toLocaleDateString()} at {question.createdAt.toLocaleTimeString()}
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
            <Loader size={20} className="animate-spin" style={{ color: T.primaryColor }} />
          </div>
        ) : answers.length > 0 ? (
          <div style={{ paddingTop: 12, borderTop: `1px solid ${T.divider}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: T.text3 }}>Answer:</span>
            {answers.map(answer => (
              <FollowUpAnswerCard
                key={answer.id} answer={answer} questionId={question.id}
                isOwnQuestion={question.studentId === user?.uid} courseId={courseId}
                onViewDocument={onViewDocument} onViewImage={onViewImage}
              />
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '14px 0', fontSize: 13, color: T.text3 }}>No answer yet...</div>
        )}
      </div>
    </NoAnimCard>
  );
};

// ─── EditQuestionModal ────────────────────────────────────────────────────────
interface EditQuestionModalProps {
  question: Question; onClose: () => void; onSuccess: () => void;
}

const EditQuestionModal = ({ question, onClose, onSuccess }: EditQuestionModalProps) => {
  const T = useT();
  const [questionText, setQuestionText] = useState(question.questionText);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [existingImageUrl, setExistingImageUrl] = useState(question.imageUrl);
  const [existingAudioUrl, setExistingAudioUrl] = useState(question.audioUrl);
  const [existingFileUrl, setExistingFileUrl] = useState(question.fileUrl);
  const [existingFileName, setExistingFileName] = useState(question.fileName);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      const allowed = ['image/jpeg','image/jpg','image/png','image/heic','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/msword'];
      if (!allowed.includes(file.type)) { setError('Please select a valid file (JPG, JPEG, PNG, HEIC, PDF, or DOCX)'); return; }
      if (file.size > 10 * 1024 * 1024) { setError('File size must be less than 10MB'); return; }
      setAttachedFile(file); setError('');
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioFile(new File([blob], `audio_${Date.now()}.webm`, { type: 'audio/webm' }));
        stream.getTracks().forEach(t => t.stop());
      };
      setMediaRecorder(recorder); recorder.start(); setIsRecording(true);
    } catch { setError('Failed to start recording. Please check microphone permissions.'); }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) { mediaRecorder.stop(); setIsRecording(false); }
  };

  const getFileType = (file: File) => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('audio/')) return 'audio';
    return 'document';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (!questionText.trim()) { setError('Please enter your question.'); return; }
    setLoading(true);
    try {
      const updates: any = { questionText: questionText.trim() };
      if (attachedFile) {
        const fileType = getFileType(attachedFile);
        const result = await qaService.uploadToSupabase(attachedFile, fileType === 'image' ? 'question_images' : 'question_documents');
        if (fileType === 'image') {
          updates.imageUrl = result.url;
          const extracted = await qaService.extractTextFromImage(result.url);
          updates.extractedText = extracted || undefined;
        } else { updates.fileUrl = result.url; updates.fileName = attachedFile.name; }
      } else { updates.imageUrl = existingImageUrl; updates.fileUrl = existingFileUrl; updates.fileName = existingFileName; }
      if (audioFile) {
        const result = await qaService.uploadToSupabase(audioFile, 'question_audio');
        updates.audioUrl = result.url;
      } else { updates.audioUrl = existingAudioUrl; }
      await qaService.updateQuestion(question.id, updates);
      onSuccess();
    } catch (err: any) { setError('Failed to update question: ' + err.message); }
    finally { setLoading(false); }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 14, color: T.text,
    background: T.inputBg, border: `1px solid ${T.inputBorder}`, outline: 'none',
    fontFamily: "'Outfit',sans-serif", resize: 'vertical', boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: T.text2, marginBottom: 6 };

  return (
    <ModalShell onClose={onClose} wide>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${T.divider}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: T.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Edit2 size={16} style={{ color: '#fff' }} />
          </div>
          <span style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Edit Question</span>
        </div>
        <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, background: T.btnSecBg, border: `1px solid ${T.btnSecBorder}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <X size={15} style={{ color: T.text2 }} />
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', fontSize: 13 }}>
            <AlertCircle size={15} /> {error}
          </div>
        )}

        <div>
          <label style={labelStyle}>Question Text</label>
          <textarea
            value={questionText}
            onChange={e => setQuestionText(e.target.value)}
            rows={5} disabled={loading} required
            placeholder="Edit your question... (Supports LaTeX: $x^2$ for inline, $$E=mc^2$$ for display)"
            style={{ ...inputStyle, minHeight: 110 }}
          />
          {questionText && (
            <div style={{ marginTop: 8, padding: '10px 12px', background: T.surface, borderRadius: 8, border: `1px solid ${T.border}` }}>
              <p style={{ fontSize: 11, color: T.text3, marginBottom: 6 }}>Preview:</p>
              <div style={{ color: T.text, fontSize: 13 }}>{renderFormattedText(questionText)}</div>
            </div>
          )}
        </div>

        {existingImageUrl && !attachedFile ? (
          <div style={{ padding: '12px 14px', background: T.surface, borderRadius: 10, border: `1px solid ${T.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ ...labelStyle, marginBottom: 0 }}>Current Image</span>
              <button onClick={() => setExistingImageUrl(undefined)} style={{ fontSize: 12, color: T.danger, background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
            </div>
            <img src={existingImageUrl} alt="Current" style={{ maxHeight: 140, objectFit: 'contain', borderRadius: 8 }} />
          </div>
        ) : existingFileUrl && existingFileName && !attachedFile ? (
          <div style={{ padding: '12px 14px', background: T.surface, borderRadius: 10, border: `1px solid ${T.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={15} style={{ color: T.primaryColor }} />
                <span style={{ color: T.text, fontSize: 13 }}>{existingFileName}</span>
              </div>
              <button onClick={() => { setExistingFileUrl(undefined); setExistingFileName(undefined); }} style={{ fontSize: 12, color: T.danger, background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
            </div>
          </div>
        ) : null}

        {!existingImageUrl && !existingFileUrl && (
          <div>
            <label style={labelStyle}>Attach New File (Optional)</label>
            <input
              type="file" accept="image/jpeg,image/jpg,image/png,image/heic,.pdf,.doc,.docx"
              onChange={handleFileChange} disabled={loading}
              style={{ ...inputStyle, padding: '8px 12px', cursor: 'pointer' }}
            />
            {attachedFile && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 12, color: T.text3 }}>
                <FileText size={13} /> {attachedFile.name} ({(attachedFile.size / 1024).toFixed(2)} KB)
              </div>
            )}
          </div>
        )}

        {existingAudioUrl && !audioFile ? (
          <div style={{ padding: '12px 14px', background: T.surface, borderRadius: 10, border: `1px solid ${T.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ ...labelStyle, marginBottom: 0 }}>Current Voice Message</span>
              <button onClick={() => setExistingAudioUrl(undefined)} style={{ fontSize: 12, color: T.danger, background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
            </div>
            <AudioPlayer audioUrl={existingAudioUrl} label="Current Voice" />
          </div>
        ) : (
          <div>
            <label style={labelStyle}>Voice Message (Optional — {existingAudioUrl ? 'Replace' : 'Add'})</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={loading}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10,
                  background: isRecording ? 'rgba(239,68,68,0.15)' : T.btnSecBg,
                  border: `1px solid ${isRecording ? 'rgba(239,68,68,0.3)' : T.btnSecBorder}`,
                  color: isRecording ? '#ef4444' : T.text2, fontSize: 13, fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer', fontFamily: "'Outfit',sans-serif",
                }}
              >
                {isRecording ? <Volume2 size={14} className="animate-pulse" /> : <Mic size={14} />}
                {isRecording ? 'Stop Recording' : 'Record Voice'}
              </button>
              {audioFile && <span style={{ fontSize: 12, color: T.text3 }}>Audio recorded ({(audioFile.size / 1024).toFixed(2)} KB)</span>}
            </div>
          </div>
        )}

        <div style={{ padding: '10px 14px', background: T.surface, borderRadius: 10, border: `1px solid ${T.border}`, fontSize: 12, color: T.text3, lineHeight: 1.6 }}>
          <strong style={{ color: T.text2 }}>Course:</strong> {question.courseId === 'help-support' ? 'Help & Support' : 'Course-related'} &nbsp;|&nbsp;
          <strong style={{ color: T.text2 }}>Subject:</strong> {question.subject}
          <br />Subject and Course cannot be changed. Only question text, attachments, and voice are editable.
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 20px', borderTop: `1px solid ${T.divider}`, flexShrink: 0 }}>
        <button
          type="button" onClick={onClose} disabled={loading}
          style={{
            flex: 1, padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
            background: T.btnSecBg, border: `1px solid ${T.btnSecBorder}`, color: T.text2,
            cursor: loading ? 'not-allowed' : 'pointer', fontFamily: "'Outfit',sans-serif",
          }}
        >Cancel</button>
        <button
          onClick={handleSubmit as any} disabled={loading}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
            background: T.gradient, border: 'none', color: '#fff',
            cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
            fontFamily: "'Outfit',sans-serif",
          }}
        >
          {loading && <Loader size={13} className="animate-spin" />}
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </ModalShell>
  );
};

// ─── FollowUpQuestionModal ────────────────────────────────────────────────────
interface FollowUpQuestionModalProps {
  parentQuestion: Question; parentAnswers: Answer[];
  onClose: () => void; onSuccess: () => void;
}

const FollowUpQuestionModal = ({ parentQuestion, parentAnswers, onClose, onSuccess }: FollowUpQuestionModalProps) => {
  const T = useT();
  const [questionText, setQuestionText] = useState('');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
  const MODEL = 'gemini-2.5-flash';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      const allowed = ['image/jpeg','image/jpg','image/png','image/heic','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/msword'];
      if (!allowed.includes(file.type)) { setError('Please select a valid file (JPG, JPEG, PNG, HEIC, PDF, or DOCX)'); return; }
      if (file.size > 10 * 1024 * 1024) { setError('File size must be less than 10MB'); return; }
      setAttachedFile(file); setError('');
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioFile(new File([blob], `audio_${Date.now()}.webm`, { type: 'audio/webm' }));
        stream.getTracks().forEach(t => t.stop());
      };
      setMediaRecorder(recorder); recorder.start(); setIsRecording(true);
    } catch { setError('Failed to start recording. Please check microphone permissions.'); }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) { mediaRecorder.stop(); setIsRecording(false); }
  };

  const getFileType = (file: File) => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('audio/')) return 'audio';
    return 'document';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (!questionText.trim()) { setError('Please enter your follow-up question.'); return; }
    setLoading(true);
    try {
      let imageUrl: string | undefined, fileUrl: string | undefined, fileName: string | undefined, audioUrl: string | undefined;
      if (attachedFile) {
        const ft = getFileType(attachedFile);
        const res = await qaService.uploadToSupabase(attachedFile, ft === 'image' ? 'question_images' : 'question_documents');
        if (ft === 'image') imageUrl = res.url; else { fileUrl = res.url; fileName = attachedFile.name; }
      }
      if (audioFile) {
        const res = await qaService.uploadToSupabase(audioFile, 'question_audio');
        audioUrl = res.url;
      }

      if (parentQuestion.answeredBy === 'ai') {
        const knowledgeList = await qaService.getKnowledgeBySubject(parentQuestion.subject);
        const knowledgeContext = knowledgeList.length > 0
          ? `\n\nTeacher's Knowledge Base:\n${knowledgeList.map(k => `${k.title}: ${k.content}`).join('\n')}` : '';
        const aiAnswers = parentAnswers.filter(a => a.type === 'ai');
        const conversationHistory = aiAnswers.length > 0
          ? `\n\nPrevious Conversation:\nStudent's Original Question: "${parentQuestion.questionText}"\n\nYour Previous Answer: "${aiAnswers[aiAnswers.length - 1].answerText}"`
          : `\n\nOriginal Question: "${parentQuestion.questionText}"`;

        const aiPrompt = `You are an AI tutor helping a student with a follow-up question.\n\n${conversationHistory}\n\nNow the student asks a follow-up question: "${questionText.trim()}"\n\nSubject: ${parentQuestion.subject}${knowledgeContext}\n\nImportant Instructions:\n1. Reference your previous answer when relevant\n2. Build upon what was already explained\n3. Address the specific confusion or additional question\n4. Provide a clear, step-by-step explanation\n5. If they're asking for clarification, explain that specific part in more detail\n\nProvide a comprehensive answer to their follow-up question:`;

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: aiPrompt }] }] }) }
        );
        if (!response.ok) throw new Error('AI request failed');
        const data = await response.json();
        const solution = data.candidates[0].content.parts[0].text;

        const followUpId = await qaService.askQuestion({
          studentId: parentQuestion.studentId, studentName: parentQuestion.studentName,
          subject: parentQuestion.subject, questionText: questionText.trim(),
          parentQuestionId: parentQuestion.id, isFollowUp: true, courseId: parentQuestion.courseId,
          imageUrl, audioUrl, fileUrl, fileName,
        });
        await qaService.answerQuestion({ questionId: followUpId, answerText: solution, type: 'ai' });
        notificationService.createNotification({
          userId: parentQuestion.studentId, title: 'Follow-up Answered', message: questionText.trim(),
          type: 'announcement', priority: 'high', isPermanent: true, relatedId: followUpId, relatedType: 'qa',
          metadata: { subject: parentQuestion.subject, courseId: parentQuestion.courseId, isFollowUp: true },
        });
      } else {
        await qaService.askQuestion({
          studentId: parentQuestion.studentId, studentName: parentQuestion.studentName,
          subject: parentQuestion.subject, questionText: questionText.trim(),
          parentQuestionId: parentQuestion.id, isFollowUp: true, courseId: parentQuestion.courseId,
          imageUrl, audioUrl, fileUrl, fileName,
        });
      }

      notificationService.createNotification({
        userId: parentQuestion.studentId, title: 'Follow-up Question Submitted', message: questionText.trim(),
        type: 'reminder', priority: 'low', isPermanent: false, relatedId: parentQuestion.id, relatedType: 'qa',
        metadata: { subject: parentQuestion.subject, courseId: parentQuestion.courseId, isFollowUp: true },
      });
      onSuccess();
    } catch (err: any) { setError('Failed to submit follow-up question: ' + err.message); }
    finally { setLoading(false); }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 14, color: T.text,
    background: T.inputBg, border: `1px solid ${T.inputBorder}`, outline: 'none',
    fontFamily: "'Outfit',sans-serif", resize: 'vertical', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: T.text2, marginBottom: 6 };

  return (
    <ModalShell onClose={onClose} wide>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${T.divider}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#f59e0b 0%,#ef4444 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <HelpCircle size={16} style={{ color: '#fff' }} />
          </div>
          <span style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Ask Follow-up Question</span>
        </div>
        <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, background: T.btnSecBg, border: `1px solid ${T.btnSecBorder}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <X size={15} style={{ color: T.text2 }} />
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', fontSize: 13 }}>
            <AlertCircle size={15} /> {error}
          </div>
        )}

        {/* Original Q */}
        <div style={{ padding: '10px 14px', background: T.surface, borderRadius: 10, border: `1px solid ${T.border}` }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: T.text3, marginBottom: 6 }}>Original Question:</p>
          <div style={{ color: T.text, fontSize: 13 }}>{renderFormattedText(parentQuestion.questionText)}</div>
        </div>

        {/* Previous Answer */}
        {parentAnswers.length > 0 && (
          <div style={{ padding: '10px 14px', background: T.surface, borderRadius: 10, border: `1px solid ${T.border}` }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: T.text3, marginBottom: 6 }}>Previous Answer:</p>
            <div style={{ color: T.text2, fontSize: 13, maxHeight: 120, overflowY: 'auto' }}>
              {renderFormattedText(parentAnswers[parentAnswers.length - 1].answerText)}
            </div>
          </div>
        )}

        <div>
          <label style={labelStyle}>Your Follow-up Question</label>
          <textarea
            value={questionText} onChange={e => setQuestionText(e.target.value)}
            rows={5} disabled={loading} required
            placeholder="What part are you still confused about? (Supports LaTeX: $x^2$ for inline, $$E=mc^2$$ for display)"
            style={{ ...inputStyle, minHeight: 110 }}
          />
          {questionText && (
            <div style={{ marginTop: 8, padding: '10px 12px', background: T.surface, borderRadius: 8, border: `1px solid ${T.border}` }}>
              <p style={{ fontSize: 11, color: T.text3, marginBottom: 6 }}>Preview:</p>
              <div style={{ color: T.text, fontSize: 13 }}>{renderFormattedText(questionText)}</div>
            </div>
          )}
        </div>

        <div>
          <label style={labelStyle}>Attach File (Optional)</label>
          <input type="file" accept="image/jpeg,image/jpg,image/png,image/heic,.pdf,.doc,.docx"
            onChange={handleFileChange} disabled={loading}
            style={{ ...inputStyle, padding: '8px 12px', cursor: 'pointer' }}
          />
          {attachedFile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 12, color: T.text3 }}>
              <FileText size={13} /> {attachedFile.name} ({(attachedFile.size / 1024).toFixed(2)} KB)
            </div>
          )}
        </div>

        <div>
          <label style={labelStyle}>Voice Message (Optional)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button" onClick={isRecording ? stopRecording : startRecording} disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10,
                background: isRecording ? 'rgba(239,68,68,0.15)' : T.btnSecBg,
                border: `1px solid ${isRecording ? 'rgba(239,68,68,0.3)' : T.btnSecBorder}`,
                color: isRecording ? '#ef4444' : T.text2, fontSize: 13, fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer', fontFamily: "'Outfit',sans-serif",
              }}
            >
              {isRecording ? <Volume2 size={14} className="animate-pulse" /> : <Mic size={14} />}
              {isRecording ? 'Stop Recording' : 'Record Voice'}
            </button>
            {audioFile && <span style={{ fontSize: 12, color: T.text3 }}>Audio recorded ({(audioFile.size / 1024).toFixed(2)} KB)</span>}
          </div>
        </div>

        {parentQuestion.answeredBy === 'ai' && (
          <div style={{ padding: '10px 14px', background: 'rgba(139,92,246,0.10)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 10, fontSize: 13, color: '#c4b5fd' }}>
            <p style={{ fontWeight: 700, marginBottom: 4 }}>🤖 AI Follow-up</p>
            <p style={{ margin: 0 }}>Since this was answered by AI, your follow-up will also be answered by AI with full context of the previous conversation.</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 20px', borderTop: `1px solid ${T.divider}`, flexShrink: 0 }}>
        <button
          type="button" onClick={onClose} disabled={loading}
          style={{ flex: 1, padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: T.btnSecBg, border: `1px solid ${T.btnSecBorder}`, color: T.text2, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: "'Outfit',sans-serif" }}
        >Cancel</button>
        <button
          onClick={handleSubmit as any} disabled={loading}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: T.gradient, border: 'none', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, fontFamily: "'Outfit',sans-serif" }}
        >
          {loading && <Loader size={13} className="animate-spin" />}
          {loading ? 'Submitting...' : 'Submit Follow-up'}
        </button>
      </div>
    </ModalShell>
  );
};

// ─── DocumentViewer ───────────────────────────────────────────────────────────
const DocumentViewer = ({ url, fileName, type, onClose }: {
  url: string; fileName: string; type: 'pdf' | 'other'; onClose: () => void;
}) => {
  const T = useT();
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
      <div style={{ background: T.baseBg, borderRadius: 16, width: '100%', maxWidth: 960, height: '90vh', display: 'flex', flexDirection: 'column', border: `1px solid ${T.border}`, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: `1px solid ${T.divider}`, background: T.surface, flexShrink: 0 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: T.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 12 }}>{fileName}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => { fetch(url).then(r => r.blob()).then(b => { const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = fileName; a.click(); URL.revokeObjectURL(u); }); }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: T.gradient, border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}
            >
              <Download size={14} /> Download
            </button>
            <button onClick={onClose} style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: T.btnSecBg, border: `1px solid ${T.btnSecBorder}`, cursor: 'pointer' }}>
              <X size={17} style={{ color: T.text2 }} />
            </button>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'hidden', background: '#f3f4f6' }}>
          {type === 'pdf' ? (
            <iframe src={url} style={{ width: '100%', height: '100%', border: 'none' }} title={fileName} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: T.baseBg }}>
              <div style={{ textAlign: 'center' }}>
                <FileText size={56} style={{ color: T.text3, marginBottom: 14 }} />
                <p style={{ color: T.text, fontSize: 16, marginBottom: 6 }}>Preview not available</p>
                <p style={{ color: T.text3, fontSize: 13, marginBottom: 16 }}>Please download the file to view it</p>
                <button
                  onClick={() => { fetch(url).then(r => r.blob()).then(b => { const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = fileName; a.click(); URL.revokeObjectURL(u); }); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 10, background: T.gradient, border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit',sans-serif", margin: '0 auto' }}
                >
                  <Download size={16} /> Download File
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── ImageViewer ──────────────────────────────────────────────────────────────
const ImageViewer = ({ url, onClose }: { url: string; onClose: () => void; }) => {
  const T = useT();
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }} onClick={onClose}>
      <div style={{ position: 'relative', maxWidth: '100%', maxHeight: '90vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: -40, right: 0, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: T.btnSecBg, border: `1px solid ${T.btnSecBorder}`, cursor: 'pointer', zIndex: 1 }}
        >
          <X size={18} style={{ color: T.text2 }} />
        </button>
        <img src={url} alt="Full size" onClick={e => e.stopPropagation()}
          style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: 12 }} />
      </div>
    </div>
  );
};

// ─── DeleteConfirmModal ───────────────────────────────────────────────────────
const DeleteConfirmModal = ({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void; }) => {
  const T = useT();
  return (
    <ModalShell onClose={onCancel}>
      <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Trash2 size={18} style={{ color: '#ef4444' }} />
          </div>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: T.text, margin: 0 }}>Delete Question?</h2>
        </div>
        <p style={{ fontSize: 14, color: T.text2, lineHeight: 1.6, margin: 0 }}>
          Are you sure you want to delete this question? This will also delete all answers and follow-up questions. This action cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onCancel}
            style={{ flex: 1, padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: T.btnSecBg, border: `1px solid ${T.btnSecBorder}`, color: T.text2, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}
          >Cancel</button>
          <button
            onClick={onConfirm}
            style={{ flex: 1, padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)', color: '#ef4444', cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}
          >Delete</button>
        </div>
      </div>
    </ModalShell>
  );
};

// ─── QuestionDetail (main) ────────────────────────────────────────────────────
const QuestionDetail = () => {
  const { questionId } = useParams<{ questionId: string }>();
  const navigate = useNavigate();
  const { user } = useDashboard();
  const T = useT();

  const [question, setQuestion] = useState<Question | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [followUpQuestions, setFollowUpQuestions] = useState<Question[]>([]);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [enrolledCoursesWithQnA, setEnrolledCoursesWithQnA] = useState<Course[]>([]);
  const [selectedCourseFilter, setSelectedCourseFilter] = useState('all');
  const [savedFilter, setSavedFilter] = useState<'all' | 'saved'>('all');
  const [savedQuestions, setSavedQuestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showQuestionMenu, setShowQuestionMenu] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDocViewer, setShowDocViewer] = useState(false);
  const [currentDocUrl, setCurrentDocUrl] = useState('');
  const [currentDocName, setCurrentDocName] = useState('');
  const [currentDocType, setCurrentDocType] = useState<'pdf' | 'other'>('other');
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState('');

  useEffect(() => {
    loadEnrolledCoursesWithQnA();
    loadSavedQuestions();
    loadAllQuestions();
  }, []);

  useEffect(() => {
    if (questionId) loadQuestionAndAnswers();
  }, [questionId]);

  const loadEnrolledCoursesWithQnA = async () => {
    try {
      const enrollments = await courseService.getStudentEnrollments(user?.uid || '');
      const courses = await Promise.all(enrollments.map(e => courseService.getCourseById(e.courseId)));
      setEnrolledCoursesWithQnA(courses.filter((c): c is Course => c !== null && c.hasQnA === true));
    } catch (err) { console.error('Failed to load enrolled courses:', err); }
  };

  const loadSavedQuestions = async () => {
    try { setSavedQuestions(await qaService.getSavedQuestions(user?.uid || '')); }
    catch (err) { console.error('Failed to load saved questions:', err); }
  };

  const loadAllQuestions = async () => {
    try {
      const allQs = await qaService.getQuestions('all', 'all');
      const enrolledCourseIds = enrolledCoursesWithQnA.map(c => c.id);
      const filtered = allQs.filter(q => {
        if (q.isFollowUp) return false;
        if (q.studentId === user?.uid) return true;
        const enrolled = q.courseId === 'help-support' || enrolledCourseIds.includes(q.courseId || '');
        return q.status === 'answered' && q.status !== 'closed' && enrolled;
      });
      setAllQuestions(filtered.filter(q => !q.parentQuestionId));
    } catch (err) { console.error('Failed to load all questions:', err); }
  };

  const loadQuestionAndAnswers = async () => {
    setLoading(true); setError('');
    try {
      const [questionData, answersData] = await Promise.all([
        qaService.getQuestionById(questionId!),
        qaService.getAnswersForQuestion(questionId!),
      ]);
      if (!questionData) { setError('Question not found'); return; }
      if (questionData.status === 'closed' && questionData.studentId !== user?.uid) {
        setError('This question has been closed and is not accessible'); return;
      }
      setQuestion(questionData); setAnswers(answersData);

      const allQs = await qaService.getQuestions('all', 'all');
      setFollowUpQuestions(allQs.filter(q => q.parentQuestionId === questionId));

      if (questionData.studentId === user?.uid && questionData.status === 'answered' && !questionData.viewedByStudent) {
        await qaService.markQuestionAsViewed(questionData.id);
        const notifications = await qaService.getNotifications(user?.uid || '');
        const relatedNotif = notifications.find(n => n.questionId === questionData.id && !n.read);
        if (relatedNotif) await qaService.markNotificationAsRead(relatedNotif.id);
        loadAllQuestions();
      }

      for (const followUp of allQs.filter(q => q.parentQuestionId === questionId)) {
        if (followUp.studentId === user?.uid && followUp.status === 'answered' && !followUp.viewedByStudent) {
          await qaService.markQuestionAsViewed(followUp.id);
          const notifications = await qaService.getNotifications(user?.uid || '');
          const relatedNotif = notifications.find(n => n.questionId === followUp.id && !n.read);
          if (relatedNotif) await qaService.markNotificationAsRead(relatedNotif.id);
        }
      }
      loadAllQuestions();
    } catch (err: any) { setError('Failed to load question: ' + err.message); }
    finally { setLoading(false); }
  };

  const handleSatisfactionChange = async (status: 'satisfied' | 'confused') => {
    if (!question || question.studentId !== user?.uid || question.status === 'closed') return;
    try {
      await qaService.updateSatisfactionStatus(question.id, status);
      setQuestion({ ...question, satisfactionStatus: status });
      if (status === 'confused') setShowFollowUpModal(true);
      if ((window as any).addNotification)
        (window as any).addNotification(status === 'satisfied' ? 'Marked as satisfied!' : 'You can now ask a follow-up question', 'success');
    } catch (err: any) { setError('Failed to update status: ' + err.message); }
  };

  const handleDeleteQuestion = async () => {
    if (!question || question.studentId !== user?.uid) return;
    try {
      await qaService.deleteQuestionWithRelatedData(question.id);
      if ((window as any).addNotification) (window as any).addNotification('Question deleted successfully', 'success');
      navigate('/student-qa');
    } catch (err: any) {
      setError('Failed to delete question: ' + err.message);
      if ((window as any).addNotification) (window as any).addNotification('Failed to delete question', 'error');
    }
  };

  const handleSaveQuestion = async (qId: string) => {
    try {
      if (savedQuestions.includes(qId)) {
        await qaService.unsaveQuestion(user?.uid || '', qId);
        setSavedQuestions(prev => prev.filter(id => id !== qId));
        if ((window as any).addNotification) (window as any).addNotification('Question removed from saved', 'info');
      } else {
        await qaService.saveQuestion(user?.uid || '', qId);
        setSavedQuestions(prev => [...prev, qId]);
        if ((window as any).addNotification) (window as any).addNotification('Question saved!', 'success');
      }
    } catch (err: any) { setError('Failed to save question: ' + err.message); }
  };

  const handleViewDocument = (url: string, name: string, type: 'pdf' | 'other') => {
    setCurrentDocUrl(url); setCurrentDocName(name); setCurrentDocType(type); setShowDocViewer(true);
  };
  const handleViewImage = (url: string) => { setCurrentImageUrl(url); setShowImageViewer(true); };
  const handleBackToQuestions = () => navigate('/student-qa');

  const hasUnreadAnswer = (q: Question) => {
    if (q.studentId !== user?.uid) return false;
    if (q.status === 'answered' && !q.viewedByStudent) return true;
    return allQuestions.some(aq => aq.parentQuestionId === q.id && aq.studentId === user?.uid && aq.status === 'answered' && !aq.viewedByStudent);
  };

  const filteredQuestionMenu = allQuestions.filter(q => {
    const courseMatch = selectedCourseFilter === 'all' ? true : selectedCourseFilter === 'help-support' ? q.courseId === 'help-support' : q.courseId === selectedCourseFilter;
    const savedMatch = savedFilter === 'all' ? true : savedQuestions.includes(q.id);
    return courseMatch && savedMatch;
  });

  const isStudentQuestion = question?.studentId === user?.uid;
  const isAnswered = question?.status === 'answered' && answers.length > 0;
  const isClosed = question?.status === 'closed';
  const isPending = question?.status === 'pending';

  // ── Shared inline style helpers ──
  const selectStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: 10, fontSize: 13, color: T.text,
    background: T.inputBg, border: `1px solid ${T.inputBorder}`, outline: 'none',
    fontFamily: "'Outfit',sans-serif", cursor: 'pointer',
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240 }}>
        <Loader size={30} className="animate-spin" style={{ color: T.primaryColor }} />
      </div>
    );
  }

  if (error || !question) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <button onClick={handleBackToQuestions}
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', color: T.text2, fontSize: 14, fontWeight: 600, fontFamily: "'Outfit',sans-serif", padding: 0 }}
        >
          <ArrowLeft size={18} /> Back to Questions
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', fontSize: 14 }}>
          <AlertCircle size={16} /> {error || 'Question not found'}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ── Responsive layout wrapper ── */}
      <style>{`
        .qd-layout { display: flex; gap: 20px; align-items: flex-start; }
        .qd-sidebar { flex-shrink: 0; width: 288px; }
        .qd-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 16px; }
        .qd-sidebar-toggle { display: none; }
        @media (max-width: 900px) {
          .qd-layout { flex-direction: column; gap: 12px; }
          .qd-sidebar { width: 100%; }
          .qd-sidebar-sticky { position: static !important; }
          .qd-sidebar-toggle { display: flex !important; }
        }
        @media (max-width: 480px) {
          .qd-layout { gap: 10px; }
        }
      `}</style>

      <div className="qd-layout">
        {/* ── Sidebar ── */}
        <div className="qd-sidebar">
          <div className="qd-sidebar-sticky" style={{ position: 'sticky', top: 24 }}>
            {/* Mobile: sidebar toggle button */}
            <button
              className="qd-sidebar-toggle"
              onClick={() => setShowQuestionMenu(v => !v)}
              style={{
                marginBottom: 8, padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                background: T.btnSecBg, border: `1px solid ${T.btnSecBorder}`, color: T.text2,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                width: '100%', fontFamily: "'Outfit',sans-serif",
              }}
            >
              {showQuestionMenu ? <X size={15} /> : <Filter size={15} />}
              {showQuestionMenu ? 'Hide Question List' : 'Show Question List'}
            </button>

            {/* Desktop: always show collapse button */}
            <div style={{ display: 'none' }} className="qd-desk-toggle">
              <button
                onClick={() => setShowQuestionMenu(v => !v)}
                style={{
                  marginBottom: 8, padding: '8px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                  background: T.btnSecBg, border: `1px solid ${T.btnSecBorder}`, color: T.text2,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '100%', fontFamily: "'Outfit',sans-serif",
                }}
              >
                {showQuestionMenu ? <X size={16} /> : <Filter size={16} />}
              </button>
            </div>

            {/* Collapse button for desktop only */}
            <button
              onClick={() => setShowQuestionMenu(v => !v)}
              className="qd-sidebar-toggle"
              style={{ display: 'none' }}
            />

            {showQuestionMenu && (
              <NoAnimCard>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: T.text, margin: 0 }}>Questions</h3>
                    <button
                      onClick={handleBackToQuestions}
                      style={{ fontSize: 12, fontWeight: 600, color: T.primaryColor, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}
                    >View All</button>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: T.text3, marginBottom: 5 }}>Filter by Course</label>
                    <select value={selectedCourseFilter} onChange={e => setSelectedCourseFilter(e.target.value)} style={selectStyle}>
                      <option value="all">All Courses</option>
                      <option value="help-support">Help &amp; Support</option>
                      {enrolledCoursesWithQnA.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: T.text3, marginBottom: 5 }}>Filter by Saved</label>
                    <select value={savedFilter} onChange={e => setSavedFilter(e.target.value as 'all' | 'saved')} style={selectStyle}>
                      <option value="all">All Questions</option>
                      <option value="saved">Saved Only</option>
                    </select>
                  </div>

                  <div style={{ maxHeight: 440, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {filteredQuestionMenu.length === 0 ? (
                      <p style={{ fontSize: 13, color: T.text3, textAlign: 'center', padding: '16px 0' }}>No questions found</p>
                    ) : (
                      filteredQuestionMenu.map(q => (
                        <div
                          key={q.id}
                          style={{
                            position: 'relative', padding: '10px 12px', borderRadius: 10,
                            background: q.id === questionId ? `rgba(${T.pRgb},0.12)` : T.surface,
                            border: `1px solid ${q.id === questionId ? `rgba(${T.pRgb},0.35)` : T.border}`,
                            cursor: 'pointer', transition: 'border-color 0.15s',
                          }}
                        >
                          <div onClick={() => navigate(`/question/${q.id}`)} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                                <BookOpen size={12} style={{ color: T.primaryColor, flexShrink: 0 }} />
                                <span style={{ fontSize: 11, color: T.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.subject}</span>
                                {hasUnreadAnswer(q) && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />}
                              </div>
                              <StatusBadge status={q.status} />
                            </div>
                            <p style={{ fontSize: 12, color: T.text, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{q.questionText}</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: T.text3 }}>
                              <User size={11} />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.studentName}</span>
                              {q.studentId === user?.uid && <span style={{ color: T.primaryColor, flexShrink: 0 }}>(You)</span>}
                            </div>
                          </div>
                          <button
                            onClick={e => { e.stopPropagation(); handleSaveQuestion(q.id); }}
                            style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                          >
                            <Bookmark size={13} style={{ color: savedQuestions.includes(q.id) ? T.primaryColor : T.text3, fill: savedQuestions.includes(q.id) ? T.primaryColor : 'none' }} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </NoAnimCard>
            )}
          </div>
        </div>

        {/* ── Main Content ── */}
        <div className="qd-main">
          {/* Back button */}
          <button
            onClick={handleBackToQuestions}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', color: T.text2, fontSize: 14, fontWeight: 600, fontFamily: "'Outfit',sans-serif", padding: 0, alignSelf: 'flex-start' }}
          >
            <ArrowLeft size={18} /> Back to Questions
          </button>

          {/* Error */}
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', fontSize: 13 }}>
              <AlertCircle size={15} /> {error}
            </div>
          )}

          {/* ── Question Card ── */}
          <NoAnimCard>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BookOpen size={18} style={{ color: T.primaryColor }} />
                  <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{question.subject}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => handleSaveQuestion(question.id)}
                    title={savedQuestions.includes(question.id) ? 'Remove from saved' : 'Save question'}
                    style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: T.btnSecBg, border: `1px solid ${T.btnSecBorder}`, cursor: 'pointer' }}
                  >
                    <Bookmark size={16} style={{ color: savedQuestions.includes(question.id) ? T.primaryColor : T.text3, fill: savedQuestions.includes(question.id) ? T.primaryColor : 'none' }} />
                  </button>
                  {question.answeredBy && question.status !== 'closed' && (
                    <AnswerTypeBadge type={question.answeredBy as 'ai' | 'teacher'} />
                  )}
                  <StatusBadge status={question.status} />
                </div>
              </div>

              {/* Question text */}
              <div style={{ paddingTop: 12, borderTop: `1px solid ${T.divider}` }}>
                <h2 style={{ fontSize: 13, fontWeight: 600, color: T.text3, marginBottom: 8 }}>Question</h2>
                <div style={{ color: T.text2, fontSize: 15, lineHeight: 1.7 }}>{renderFormattedText(question.questionText)}</div>
              </div>

              {/* Image */}
              {question.imageUrl && (
                <img src={question.imageUrl} alt="Question attachment" onClick={() => handleViewImage(question.imageUrl!)}
                  style={{ maxHeight: 320, objectFit: 'contain', borderRadius: 10, border: `1px solid ${T.border}`, cursor: 'pointer', transition: 'opacity 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                />
              )}

              {/* Audio */}
              {question.audioUrl && <AudioPlayer audioUrl={question.audioUrl} label="Voice Question" />}

              {/* File */}
              {question.fileName && question.fileUrl && (
                <FileRow fileName={question.fileName} fileUrl={question.fileUrl} onViewDocument={handleViewDocument} T={T} />
              )}

              {/* Meta */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', paddingTop: 12, borderTop: `1px solid ${T.divider}`, fontSize: 12, color: T.text3 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <User size={13} />
                  <span>Asked by {question.studentName}</span>
                </div>
                <span>•</span>
                <span>{question.createdAt.toLocaleDateString()} at {question.createdAt.toLocaleTimeString()}</span>
              </div>

              {/* Actions for pending own question */}
              {isStudentQuestion && isPending && (
                <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: `1px solid ${T.divider}`, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setShowEditModal(true)}
                    style={{
                      flex: 1, minWidth: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '9px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                      background: T.gradient, border: 'none', color: '#fff', cursor: 'pointer',
                      fontFamily: "'Outfit',sans-serif",
                    }}
                  >
                    <Edit2 size={14} /> Edit Question
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    style={{
                      flex: 1, minWidth: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '9px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                      background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.28)', color: '#ef4444',
                      cursor: 'pointer', fontFamily: "'Outfit',sans-serif",
                    }}
                  >
                    <Trash2 size={14} /> Delete Question
                  </button>
                </div>
              )}
            </div>
          </NoAnimCard>

          {/* ── Closed state ── */}
          {isClosed ? (
            <NoAnimCard>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ef4444' }}>
                  <XCircle size={18} />
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Question Closed</h3>
                </div>
                {question.closedReason && (
                  <div style={{ padding: '12px 14px', background: T.surface, borderRadius: 10, border: `1px solid ${T.border}` }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: T.text3, marginBottom: 6 }}>Admin Comment:</p>
                    <p style={{ color: T.text, fontSize: 14, margin: 0, whiteSpace: 'pre-wrap' }}>{question.closedReason}</p>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.22)', color: '#ef4444', fontSize: 13 }}>
                  <AlertCircle size={14} /> This question has been closed by admin.
                </div>
              </div>
            </NoAnimCard>
          ) : (
            <>
              {/* ── Answers section ── */}
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: T.text, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <MessageSquare size={18} style={{ color: T.primaryColor }} />
                  Answers ({answers.length})
                </h2>
                {answers.length === 0 ? (
                  <NoAnimCard>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px', textAlign: 'center' }}>
                      <MessageSquare size={40} style={{ color: T.text3, opacity: 0.5, marginBottom: 12 }} />
                      <p style={{ fontSize: 14, color: T.text3, margin: 0 }}>No answers yet. Waiting for response...</p>
                    </div>
                  </NoAnimCard>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {answers.map(answer => (
                      <AnswerCard
                        key={answer.id} answer={answer} questionId={question.id}
                        isStudentQuestion={isStudentQuestion} courseId={question.courseId}
                        onViewDocument={handleViewDocument} onViewImage={handleViewImage}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* ── Follow-up questions section ── */}
              {followUpQuestions.length > 0 && (
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: T.text, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <MessageSquare size={18} style={{ color: '#fb923c' }} />
                    Follow-up Questions ({followUpQuestions.length})
                  </h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {followUpQuestions.map(followUpQ => (
                      <FollowUpQuestionCard
                        key={followUpQ.id} question={followUpQ} courseId={question.courseId}
                        onViewDocument={handleViewDocument} onViewImage={handleViewImage}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* ── Satisfaction / follow-up panel ── */}
              {isStudentQuestion && isAnswered && (
                <NoAnimCard>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ fontSize: 12, color: '#ef4444', padding: '6px 10px', background: 'rgba(239,68,68,0.08)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.18)' }}>
                      N.B.: If you're still confused about an answer, press the "Still Confused" button to ask your doubt.
                    </div>

                    {question.satisfactionStatus === 'none' && (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          onClick={() => handleSatisfactionChange('satisfied')}
                          style={{
                            flex: 1, minWidth: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                            background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e',
                            cursor: 'pointer', fontFamily: "'Outfit',sans-serif",
                          }}
                        >
                          <ThumbsUp size={15} /> Satisfied
                        </button>
                        <button
                          onClick={() => handleSatisfactionChange('confused')}
                          style={{
                            flex: 1, minWidth: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                            background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.3)', color: '#f97316',
                            cursor: 'pointer', fontFamily: "'Outfit',sans-serif",
                          }}
                        >
                          <HelpCircle size={15} /> Still Confused
                        </button>
                      </div>
                    )}

                    {question.satisfactionStatus === 'satisfied' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#22c55e', fontSize: 15, fontWeight: 600 }}>
                          <ThumbsUp size={18} /> Marked as Satisfied
                        </div>
                        <button
                          onClick={() => handleSatisfactionChange('confused')}
                          style={{ padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: T.btnSecBg, border: `1px solid ${T.btnSecBorder}`, color: T.text2, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}
                        >
                          Change to Still Confused
                        </button>
                      </div>
                    )}

                    {question.satisfactionStatus === 'confused' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f97316', fontSize: 15, fontWeight: 600 }}>
                          <HelpCircle size={18} /> Marked as Still Confused
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button
                            onClick={() => setShowFollowUpModal(true)}
                            style={{
                              flex: 1, minWidth: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                              padding: '9px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                              background: T.gradient, border: 'none', color: '#fff', cursor: 'pointer', fontFamily: "'Outfit',sans-serif",
                            }}
                          >
                            <MessageSquare size={14} /> Ask Follow-up
                          </button>
                          <button
                            onClick={() => handleSatisfactionChange('satisfied')}
                            style={{ flex: 1, minWidth: 120, padding: '9px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: T.btnSecBg, border: `1px solid ${T.btnSecBorder}`, color: T.text2, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}
                          >
                            Mark as Satisfied
                          </button>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        padding: '9px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                        background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.22)', color: '#ef4444',
                        cursor: 'pointer', fontFamily: "'Outfit',sans-serif",
                        marginTop: 4, borderTopStyle: 'solid',
                      }}
                    >
                      <Trash2 size={14} /> Delete Question
                    </button>
                  </div>
                </NoAnimCard>
              )}
            </>
          )}

          {/* Delete button for closed own question */}
          {isStudentQuestion && isClosed && (
            <NoAnimCard>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                  background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.28)', color: '#ef4444',
                  cursor: 'pointer', fontFamily: "'Outfit',sans-serif",
                }}
              >
                <Trash2 size={15} /> Delete Question
              </button>
            </NoAnimCard>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      {showEditModal && question && (
        <EditQuestionModal
          question={question}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false);
            loadQuestionAndAnswers();
            if ((window as any).addNotification) (window as any).addNotification('Question updated successfully', 'success');
          }}
        />
      )}

      {showFollowUpModal && question && (
        <FollowUpQuestionModal
          parentQuestion={question} parentAnswers={answers}
          onClose={() => setShowFollowUpModal(false)}
          onSuccess={() => {
            setShowFollowUpModal(false);
            if ((window as any).addNotification) (window as any).addNotification('Follow-up question submitted!', 'success');
            loadQuestionAndAnswers();
          }}
        />
      )}

      {showDeleteConfirm && (
        <DeleteConfirmModal
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={() => { setShowDeleteConfirm(false); handleDeleteQuestion(); }}
        />
      )}

      {showDocViewer && (
        <DocumentViewer url={currentDocUrl} fileName={currentDocName} type={currentDocType} onClose={() => setShowDocViewer(false)} />
      )}

      {showImageViewer && (
        <ImageViewer url={currentImageUrl} onClose={() => setShowImageViewer(false)} />
      )}
    </>
  );
};

export default QuestionDetail;
