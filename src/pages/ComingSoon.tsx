// src/pages/ComingSoon.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock, Star, BookOpen, GitMerge, Zap, Upload, Smartphone, XCircle,
  BarChart2, Cpu, Users, Layers, CheckCircle, X, ExternalLink,
  AlertCircle, Send, Eye, Trash2,
  Wifi, Globe, Shield, Lock, Bell, Camera, Code, Database,
  Download, Filter, Flag, Gift, Hash, Heart, Home, Image,
  Mail, Map, MessageSquare, Monitor, Music, Package, Play,
  Search, Settings, Share2, Sliders, Tag, Target, Terminal,
  Truck, Video, Wrench, Aperture, Award,
} from 'lucide-react';
import Card from '../components/ui/Card';
import { comingSoonService, ComingSoonFeature, EarlyAccessRequest, FeatureRequest } from '../services/comingSoonService';
import { useDashboard } from '../contexts/DashboardContext';

// ─── Link helper ─────────────────────────────────────────────────────────────
const isInternalLink = (url?: string) => {
  if (!url) return false;
  return url.startsWith('/') || url.startsWith(window.location.origin);
};

// ─── Sidebar theme helpers (mirrors Navigation.tsx exactly) ──────────────────
const hexRgb = (hex: string) => {
  if (!hex || hex.length < 7) return '99,102,241';
  return `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`;
};

const THEME_BG: Record<string, string> = {
  dark:'#0d1117', light:'#ebe8e1', slate:'#0f172a',
  ocean:'#0c1a2e', forest:'#0a1f14', purple:'#1e1b4b',
  pink:'#831843', sunset:'#1c0a00',
};

// ─── Icon map ────────────────────────────────────────────────────────────────
const ICON_COLORS = [
  'text-primary-400', 'text-secondary-400', 'text-accent-400',
  'text-warning-DEFAULT', 'text-error-DEFAULT', 'text-green-400',
  'text-purple-400', 'text-pink-400', 'text-orange-400',
];
const iconColor = (name: string) => ICON_COLORS[name.charCodeAt(0) % ICON_COLORS.length];

const ICON_MAP: Record<string, (size?: number) => React.ReactNode> = {
  Zap:          (s = 24) => <Zap size={s} className={iconColor('Zap')} />,
  BookOpen:     (s = 24) => <BookOpen size={s} className={iconColor('BookOpen')} />,
  Star:         (s = 24) => <Star size={s} className={iconColor('Star')} />,
  Upload:       (s = 24) => <Upload size={s} className={iconColor('Upload')} />,
  GitMerge:     (s = 24) => <GitMerge size={s} className={iconColor('GitMerge')} />,
  BarChart2:    (s = 24) => <BarChart2 size={s} className={iconColor('BarChart2')} />,
  Cpu:          (s = 24) => <Cpu size={s} className={iconColor('Cpu')} />,
  Users:        (s = 24) => <Users size={s} className={iconColor('Users')} />,
  Layers:       (s = 24) => <Layers size={s} className={iconColor('Layers')} />,
  Smartphone:   (s = 24) => <Smartphone size={s} className={iconColor('Smartphone')} />,
  Wifi:         (s = 24) => <Wifi size={s} className={iconColor('Wifi')} />,
  Globe:        (s = 24) => <Globe size={s} className={iconColor('Globe')} />,
  Shield:       (s = 24) => <Shield size={s} className={iconColor('Shield')} />,
  Lock:         (s = 24) => <Lock size={s} className={iconColor('Lock')} />,
  Bell:         (s = 24) => <Bell size={s} className={iconColor('Bell')} />,
  Camera:       (s = 24) => <Camera size={s} className={iconColor('Camera')} />,
  Code:         (s = 24) => <Code size={s} className={iconColor('Code')} />,
  Database:     (s = 24) => <Database size={s} className={iconColor('Database')} />,
  Download:     (s = 24) => <Download size={s} className={iconColor('Download')} />,
  Filter:       (s = 24) => <Filter size={s} className={iconColor('Filter')} />,
  Flag:         (s = 24) => <Flag size={s} className={iconColor('Flag')} />,
  Gift:         (s = 24) => <Gift size={s} className={iconColor('Gift')} />,
  Hash:         (s = 24) => <Hash size={s} className={iconColor('Hash')} />,
  Heart:        (s = 24) => <Heart size={s} className={iconColor('Heart')} />,
  Home:         (s = 24) => <Home size={s} className={iconColor('Home')} />,
  Image:        (s = 24) => <Image size={s} className={iconColor('Image')} />,
  Mail:         (s = 24) => <Mail size={s} className={iconColor('Mail')} />,
  Map:          (s = 24) => <Map size={s} className={iconColor('Map')} />,
  MessageSquare:(s = 24) => <MessageSquare size={s} className={iconColor('MessageSquare')} />,
  Monitor:      (s = 24) => <Monitor size={s} className={iconColor('Monitor')} />,
  Music:        (s = 24) => <Music size={s} className={iconColor('Music')} />,
  Package:      (s = 24) => <Package size={s} className={iconColor('Package')} />,
  Play:         (s = 24) => <Play size={s} className={iconColor('Play')} />,
  Search:       (s = 24) => <Search size={s} className={iconColor('Search')} />,
  Settings:     (s = 24) => <Settings size={s} className={iconColor('Settings')} />,
  Share2:       (s = 24) => <Share2 size={s} className={iconColor('Share2')} />,
  Sliders:      (s = 24) => <Sliders size={s} className={iconColor('Sliders')} />,
  Tag:          (s = 24) => <Tag size={s} className={iconColor('Tag')} />,
  Target:       (s = 24) => <Target size={s} className={iconColor('Target')} />,
  Terminal:     (s = 24) => <Terminal size={s} className={iconColor('Terminal')} />,
  Truck:        (s = 24) => <Truck size={s} className={iconColor('Truck')} />,
  Video:        (s = 24) => <Video size={s} className={iconColor('Video')} />,
  Wrench:       (s = 24) => <Wrench size={s} className={iconColor('Wrench')} />,
  Aperture:     (s = 24) => <Aperture size={s} className={iconColor('Aperture')} />,
  Award:        (s = 24) => <Award size={s} className={iconColor('Award')} />,
};

const getIcon = (name: string) =>
  (ICON_MAP[name] ?? ICON_MAP['Zap'])(24);

// ─── Status badge colours ─────────────────────────────────────────────────────
const REQUEST_STATUS_STYLES: Record<string, string> = {
  pending:   'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  in_review: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  reviewed:  'bg-green-500/20 text-green-400 border border-green-500/30',
  planned:   'bg-purple-500/20 text-purple-400 border border-purple-500/30',
  declined:  'bg-red-500/20 text-red-400 border border-red-500/30',
};

const REQUEST_STATUS_LABELS: Record<string, string> = {
  pending:   'Pending',
  in_review: 'In Review',
  reviewed:  'Reviewed',
  planned:   'Planned',
  declined:  'Declined',
};

// ─── Shared modal wrapper — exact same background as sidebar ─────────────────
const ModalShell = ({ children, onClose, wide }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) => {
  const { theme, primaryColor, accentColor, glitterTheme } = useDashboard();
  const darkMode = theme !== 'light';
  const isLight = theme === 'light';
  const pRgb = hexRgb(primaryColor);
  const baseBg = THEME_BG[theme] ?? '#0d1117';

  // ── Exact copy of Navigation.tsx glitterImageMap ──
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

  // ── Exact copy of Navigation.tsx sidebar style vars ──
  const sbSparkle = glitterBgImage
    ? glitterBgImage
    : `radial-gradient(ellipse at 20% 20%, rgba(${pRgb},0.18) 0%, transparent 60%),
       radial-gradient(ellipse at 80% 80%, rgba(${pRgb},0.12) 0%, transparent 50%),
       radial-gradient(ellipse at 50% 50%, ${darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.55)'} 0%, transparent 70%)`;
  const sbBorder = darkMode
    ? `1px solid rgba(${pRgb},0.22)`
    : `1px solid rgba(255,255,255,0.95)`;
  const sbShadow = darkMode
    ? `0 8px 40px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(${pRgb},0.12), 0 0 60px rgba(${pRgb},0.06)`
    : `0 8px 32px rgba(0,0,0,0.10), inset 0 0 0 1px rgba(255,255,255,0.8), 0 0 40px rgba(${pRgb},0.07)`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={`w-full ${wide ? 'max-w-lg' : 'max-w-md'} overflow-hidden`}
        style={{
          backgroundColor: baseBg,
          backgroundImage: sbSparkle,
          backgroundSize: glitterBgSize,
          backdropFilter: 'blur(32px) saturate(200%)',
          WebkitBackdropFilter: 'blur(32px) saturate(200%)',
          border: sbBorder,
          borderRadius: 24,
          boxShadow: sbShadow,
          fontFamily: "'Outfit', sans-serif",
          position: 'relative',
          isolation: 'isolate',
        }}
      >
        {/* Noise sparkle overlay */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none', zIndex: 0,
          background: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
          opacity: darkMode ? 0.04 : 0.025,
          mixBlendMode: 'overlay',
        }} />
        {/* Color accent glow top */}
        <div style={{
          position: 'absolute', top: -30, left: '50%', transform: 'translateX(-50%)',
          width: 120, height: 120, borderRadius: '50%',
          background: `radial-gradient(circle, rgba(${pRgb},${darkMode ? 0.20 : 0.12}) 0%, transparent 70%)`,
          pointerEvents: 'none', zIndex: 0, filter: 'blur(20px)',
        }} />
        {/* Content */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  );
};

// ─── Early Access Modal ───────────────────────────────────────────────────────
interface EarlyAccessModalProps {
  request: EarlyAccessRequest;
  onClose: () => void;
  onNavigate: (url: string) => void;
}

const EarlyAccessModal = ({ request, onClose, onNavigate }: EarlyAccessModalProps) => {
  const { theme, primaryColor, accentColor } = useDashboard();
  const darkMode = theme !== 'light';
  const pRgb = hexRgb(primaryColor);
  const textPrimary = darkMode ? '#f1f5f9' : '#111827';
  const textSecondary = darkMode ? '#94a3b8' : '#6b7280';
  const insetBg = darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';
  const insetBorder = darkMode ? `rgba(${pRgb},0.18)` : 'rgba(0,0,0,0.08)';
  const gradient = `linear-gradient(135deg,${primaryColor} 0%,${accentColor} 100%)`;

  return (
    <ModalShell onClose={onClose}>
      <div style={{ padding: '20px 24px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: textPrimary, margin: 0 }}>Early Access Granted 🎉</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: textSecondary, display: 'flex', alignItems: 'center', padding: 4, borderRadius: 8 }}>
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: 13, color: textSecondary, marginBottom: 16, lineHeight: 1.6 }}>
          You've been approved for early access to <span style={{ color: textPrimary, fontWeight: 600 }}>{request.featureTitle}</span>.
        </p>

        {request.guidelines && (
          <div style={{ background: insetBg, border: `1px solid ${insetBorder}`, borderRadius: 12, padding: '12px 16px', marginBottom: 20 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: `rgb(${pRgb})`, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>Guidelines</p>
            <p style={{ fontSize: 13, color: darkMode ? '#cbd5e1' : '#374151', lineHeight: 1.6, whiteSpace: 'pre-line', margin: 0 }}>{request.guidelines}</p>
          </div>
        )}

        <button
          onClick={() => request.accessLink && onNavigate(request.accessLink)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', background: gradient, border: 'none', borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 600, padding: '11px 0', cursor: 'pointer', fontFamily: "'Outfit', sans-serif" }}
        >
          Try Early Access <ExternalLink size={15} />
        </button>
      </div>
    </ModalShell>
  );
};

// ─── Feature Request Form Modal ───────────────────────────────────────────────
interface FeatureRequestModalProps {
  studentId: string;
  studentName: string;
  studentUserId?: string;
  onClose: () => void;
}

const FeatureRequestModal = ({ studentId, studentName, studentUserId, onClose }: FeatureRequestModalProps) => {
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { theme, primaryColor, accentColor } = useDashboard();
  const darkMode = theme !== 'light';
  const pRgb = hexRgb(primaryColor);
  const textPrimary = darkMode ? '#f1f5f9' : '#111827';
  const textSecondary = darkMode ? '#94a3b8' : '#6b7280';
  const inputBg = darkMode ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.06)';
  const inputBorder = darkMode ? `rgba(${pRgb},0.22)` : 'rgba(0,0,0,0.10)';
  const btnSecBg = darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
  const btnSecBorder = darkMode ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.09)';
  const gradient = `linear-gradient(135deg,${primaryColor} 0%,${accentColor} 100%)`;

  const handleSubmit = async () => {
    if (!description.trim()) return;
    setLoading(true);
    try {
      await comingSoonService.submitFeatureRequest(description.trim(), studentId, studentName, studentUserId);
      setSubmitted(true);
    } catch {
      // handle error silently
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell onClose={onClose}>
      <div style={{ padding: '20px 24px 24px' }}>
        {submitted ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <CheckCircle size={28} color="#22c55e" />
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: textPrimary, margin: '0 0 8px' }}>Request Submitted!</h3>
            <p style={{ fontSize: 13, color: textSecondary, lineHeight: 1.6, marginBottom: 20 }}>
              Thank you! We've received your feature request and will review it shortly.
            </p>
            <button
              onClick={onClose}
              style={{ background: gradient, border: 'none', borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 600, padding: '10px 32px', cursor: 'pointer', fontFamily: "'Outfit', sans-serif" }}
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: textPrimary, margin: 0 }}>Submit Feature Request</h3>
              <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: textSecondary, display: 'flex', alignItems: 'center', padding: 4, borderRadius: 8 }}>
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: textSecondary, marginBottom: 14, lineHeight: 1.6 }}>
              Describe the feature you'd like to see. We review all requests carefully.
            </p>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="E.g. I'd love a dark mode for the mobile app..."
              rows={4}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: inputBg, border: `1px solid ${inputBorder}`,
                borderRadius: 12, padding: '12px 14px',
                color: textPrimary, fontSize: 13,
                fontFamily: "'Outfit', sans-serif",
                resize: 'none', outline: 'none',
                lineHeight: 1.6, transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = `rgba(${pRgb},0.5)`; e.currentTarget.style.boxShadow = `0 0 0 3px rgba(${pRgb},0.10)`; }}
              onBlur={e => { e.currentTarget.style.borderColor = inputBorder; e.currentTarget.style.boxShadow = 'none'; }}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button
                onClick={onClose}
                style={{ flex: 1, background: btnSecBg, border: `1px solid ${btnSecBorder}`, borderRadius: 12, color: textSecondary, fontSize: 13, fontWeight: 600, padding: '10px 0', cursor: 'pointer', fontFamily: "'Outfit', sans-serif" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!description.trim() || loading}
                style={{ flex: 1, background: gradient, border: 'none', borderRadius: 12, color: '#fff', fontSize: 13, fontWeight: 600, padding: '10px 0', cursor: !description.trim() || loading ? 'not-allowed' : 'pointer', opacity: !description.trim() || loading ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: "'Outfit', sans-serif" }}
              >
                {loading ? (
                  <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'cs-spin 0.7s linear infinite' }} />
                ) : (
                  <Send size={13} />
                )}
                Submit
              </button>
            </div>
          </>
        )}
      </div>
    </ModalShell>
  );
};

// ─── My Requests Modal ────────────────────────────────────────────────────────
interface MyRequestsModalProps {
  requests: FeatureRequest[];
  onDelete: (id: string) => void;
  onClose: () => void;
}

const MyRequestsModal = ({ requests, onDelete, onClose }: MyRequestsModalProps) => {
  const { theme, primaryColor } = useDashboard();
  const darkMode = theme !== 'light';
  const pRgb = hexRgb(primaryColor);
  const textPrimary = darkMode ? '#f1f5f9' : '#111827';
  const textSecondary = darkMode ? '#94a3b8' : '#6b7280';
  const divider = darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';
  const cardBg = darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
  const cardBorder = darkMode ? `rgba(${pRgb},0.15)` : 'rgba(0,0,0,0.07)';

  return (
    <ModalShell onClose={onClose} wide>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: `1px solid ${divider}` }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: textPrimary, margin: 0 }}>My Feature Requests</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: textSecondary, display: 'flex', alignItems: 'center', padding: 4, borderRadius: 8 }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: '16px 24px 24px', maxHeight: '55vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {requests.length === 0 ? (
            <p style={{ fontSize: 13, color: textSecondary, textAlign: 'center', padding: '32px 0', margin: 0 }}>You haven't submitted any feature requests yet.</p>
          ) : (
            requests.map(r => (
              <div key={r.id} style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                  <p style={{ fontSize: 13, color: textPrimary, lineHeight: 1.6, margin: 0 }}>{r.description}</p>
                  <span className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0 ${REQUEST_STATUS_STYLES[r.status]}`}>
                    {REQUEST_STATUS_LABELS[r.status]}
                  </span>
                </div>
                {r.adminNote && (
                  <p style={{ fontSize: 11, color: textSecondary, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${divider}`, margin: '8px 0 0' }}>
                    <span style={{ color: `rgb(${pRgb})` }}>Admin note: </span>{r.adminNote}
                  </p>
                )}
                <p style={{ fontSize: 11, color: darkMode ? '#475569' : '#9ca3af', marginTop: 6, marginBottom: 0 }}>
                  {new Date(r.requestedAt).toLocaleDateString()}
                </p>
                {r.status === 'pending' && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                    <button
                      onClick={() => onDelete(r.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', padding: '5px 10px', borderRadius: 8, cursor: 'pointer', fontFamily: "'Outfit', sans-serif" }}
                    >
                      <Trash2 size={11} /> Delete Request
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </ModalShell>
  );
};

// ─── Feature Card ─────────────────────────────────────────────────────────────
interface FeatureCardProps {
  feature: ComingSoonFeature;
  earlyAccess?: EarlyAccessRequest;
  onRequestAccess: (feature: ComingSoonFeature) => void;
  onTryAccess: (request: EarlyAccessRequest) => void;
  onCancelAccess: (featureId: string, requestId: string) => void;
  onReRequestAccess: (feature: ComingSoonFeature, oldRequestId: string) => void;
  requestingId: string | null;
  onNavigate: (url: string) => void;
}

const FeatureCard = ({ feature, earlyAccess, onRequestAccess, onTryAccess, onCancelAccess, onReRequestAccess, requestingId, onNavigate }: FeatureCardProps) => {
  const { theme } = useDashboard();
  const darkMode = theme !== 'light';
  const isRequested = !!earlyAccess && earlyAccess.status !== 'cancelled';
  const isApproved = earlyAccess?.status === 'approved';
  const isRejected = earlyAccess?.status === 'rejected';
  const isFinalRejection = isRejected && (earlyAccess?.rejectionCount ?? 0) >= 3;
  const isLoading = requestingId === feature.id;
  const dividerColor = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

  return (
    <Card className="p-0 transition-all duration-300 hover:shadow-card-hover flex flex-col">
      <div className="p-6 flex-1">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-full bg-background-800 flex items-center justify-center flex-shrink-0">
            {getIcon(feature.iconName)}
          </div>
          <div>
            <h3 className="text-white font-medium mb-1">{feature.title}</h3>
            <p className="text-gray-400 text-sm">{feature.description}</p>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-400">Development Progress</span>
            <div className="flex items-center gap-2">
              {feature.status === 'beta' && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">Beta</span>
              )}
              {feature.status === 'released' && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">Released</span>
              )}
              <span className="text-sm text-white">{feature.progress}%</span>
            </div>
          </div>
          <div className="w-full bg-background-800 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-700 ${feature.progress >= 100 ? 'bg-green-500' : 'bg-primary-500'}`}
              style={{ width: `${feature.progress}%` }}
            />
          </div>
        </div>

        {(feature.status !== 'released' && !(feature.status === 'beta' && feature.tryLink)) && (
          <div className="mt-4 flex items-center gap-2">
            <Clock size={16} className="text-primary-400" />
            <span className="text-sm text-primary-400">Expected: {feature.expectedDate}</span>
          </div>
        )}
      </div>

      <div className="p-4" style={{ borderTop: `1px solid ${dividerColor}` }}>
        {feature.tryLink ? (
          <button
            onClick={() => onNavigate(feature.tryLink!)}
            className="w-full bg-green-600 hover:bg-green-500 text-white py-2 rounded transition-colors flex items-center justify-center gap-2 text-sm font-medium"
          >
            <ExternalLink size={14} /> Try It
          </button>
        ) : feature.progress >= 100 ? (
          <div className="flex items-center justify-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 py-2 rounded text-sm">
            <CheckCircle size={14} /> Completed
          </div>
        ) : isApproved ? (
          <button
            onClick={() => earlyAccess?.accessLink
              ? onNavigate(earlyAccess.accessLink)
              : onTryAccess(earlyAccess!)}
            className="w-full bg-green-600 hover:bg-green-500 text-white py-2 rounded transition-colors flex items-center justify-center gap-2 text-sm font-medium"
          >
            <ExternalLink size={14} /> Try Early Access
          </button>
        ) : isRejected ? (
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 py-2 rounded text-sm">
              <XCircle size={14} />
              <span>Request Rejected</span>
              {(earlyAccess?.rejectionCount ?? 0) > 0 && (
                <span className="text-xs text-red-500 opacity-70">
                  ({earlyAccess!.rejectionCount}/3)
                </span>
              )}
            </div>
            {isFinalRejection ? (
              <p className="text-center text-gray-500 text-xs py-1">
                Final rejection — no further requests allowed
              </p>
            ) : (
              <button
                onClick={() => onReRequestAccess(feature, earlyAccess!.id)}
                disabled={isLoading}
                className="w-full bg-background-700 hover:bg-background-600 text-white py-2 rounded transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : null}
                Request Again
              </button>
            )}
          </div>
        ) : isRequested ? (
          <div className="flex gap-2">
            <button
              disabled
              className="flex-1 bg-background-700 text-gray-500 py-2 rounded cursor-not-allowed text-sm flex items-center justify-center gap-2"
            >
              <CheckCircle size={14} className="text-primary-400" />
              <span className="text-primary-400">Requested</span>
            </button>
            {earlyAccess?.status === 'pending' && (
              <button
                onClick={() => onCancelAccess(feature.id, earlyAccess.id)}
                className="bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 px-3 py-2 rounded text-xs transition-colors"
                title="Cancel request"
              >
                <X size={14} />
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={() => onRequestAccess(feature)}
            disabled={isLoading}
            className="w-full bg-background-700 hover:bg-background-600 text-white py-2 rounded transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50"
          >
            {isLoading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : null}
            Request Early Access
          </button>
        )}
      </div>
    </Card>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const ComingSoon = () => {
  const { user, primaryColor, accentColor } = useDashboard();
  const navigate = useNavigate();
  const handleLink = (url: string) => {
    if (isInternalLink(url)) {
      navigate(url.replace(window.location.origin, ''));
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const [features, setFeatures] = useState<ComingSoonFeature[]>([]);
  const [earlyAccessMap, setEarlyAccessMap] = useState<Record<string, EarlyAccessRequest>>({});
  const [myFeatureRequests, setMyFeatureRequests] = useState<FeatureRequest[]>([]);

  const [loadingFeatures, setLoadingFeatures] = useState(true);
  const [requestingId, setRequestingId] = useState<string | null>(null);

  const [showFeatureRequestModal, setShowFeatureRequestModal] = useState(false);
  const [showMyRequestsModal, setShowMyRequestsModal] = useState(false);
  const [activeEarlyAccess, setActiveEarlyAccess] = useState<EarlyAccessRequest | null>(null);

  useEffect(() => {
    comingSoonService.getFeatures()
      .then(setFeatures)
      .finally(() => setLoadingFeatures(false));
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = comingSoonService.subscribeEarlyAccessByStudent(user.uid, requests => {
      const map: Record<string, EarlyAccessRequest> = {};
      requests.forEach(r => { map[r.featureId] = r; });
      setEarlyAccessMap(map);
    });
    return () => unsub();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    comingSoonService.getFeatureRequestsByStudent(user.uid).then(setMyFeatureRequests);
  }, [user?.uid]);

  const refreshEarlyAccessMap = (_uid: string) => {
    // No-op — map is now kept live by the onSnapshot listener above
  };

  const handleRequestAccess = async (feature: ComingSoonFeature) => {
    if (!user) return;
    setRequestingId(feature.id);
    setEarlyAccessMap(prev => ({
      ...prev,
      [feature.id]: {
        id: 'temp',
        featureId: feature.id,
        featureTitle: feature.title,
        studentId: user.uid,
        studentName: user.name,
        status: 'pending',
        requestedAt: new Date(),
      },
    }));
    try {
      await comingSoonService.requestEarlyAccess(
        feature.id,
        feature.title,
        user.uid,
        user.name + (user.surname ? ' ' + user.surname : ''),
        user.userId,
        user.email,
      );
      refreshEarlyAccessMap(user.uid);
    } catch {
      setEarlyAccessMap(prev => {
        const next = { ...prev };
        delete next[feature.id];
        return next;
      });
    } finally {
      setRequestingId(null);
    }
  };

  const handleReRequestAccess = async (feature: ComingSoonFeature, oldRequestId: string) => {
    if (!user) return;
    if (requestingId === feature.id) return;
    setRequestingId(feature.id);
    const existing = earlyAccessMap[feature.id];
    const rejectionCount = existing?.rejectionCount ?? 0;
    setEarlyAccessMap(prev => {
      const next = { ...prev };
      delete next[feature.id];
      return next;
    });
    try {
      await comingSoonService.cancelEarlyAccess(oldRequestId);
      await comingSoonService.requestEarlyAccess(
        feature.id,
        feature.title,
        user.uid,
        user.name + (user.surname ? ' ' + user.surname : ''),
        user.userId,
        user.email,
        rejectionCount,
      );
    } catch {
      if (existing) {
        setEarlyAccessMap(prev => ({ ...prev, [feature.id]: existing }));
      }
    } finally {
      setRequestingId(null);
    }
  };

  const handleCancelEarlyAccess = async (featureId: string, requestId: string) => {
    setEarlyAccessMap(prev => {
      const next = { ...prev };
      delete next[featureId];
      return next;
    });
    try {
      await comingSoonService.cancelEarlyAccess(requestId);
    } catch {
      refreshEarlyAccessMap(user!.uid);
    }
  };

  const handleDeleteFeatureRequest = async (requestId: string) => {
    if (!confirm('Delete this request?')) return;
    try {
      await comingSoonService.deleteFeatureRequest(requestId);
      if (user?.uid) {
        comingSoonService.getFeatureRequestsByStudent(user.uid).then(setMyFeatureRequests);
      }
    } catch {
      // silent fail
    }
  };

  const handleFeatureRequestSubmitted = () => {
    setShowFeatureRequestModal(false);
    if (user?.uid) {
      comingSoonService.getFeatureRequestsByStudent(user.uid).then(setMyFeatureRequests);
    }
  };

  if (loadingFeatures) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Coming Soon</h1>
        <p className="text-gray-400 max-w-2xl mx-auto">
          We're constantly working to improve your experience. Check out these exciting features that are currently in development.
        </p>
      </div>

      {/* Feature Cards */}
      {features.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <AlertCircle size={40} className="mx-auto mb-3 opacity-40" />
          <p>No upcoming features at the moment. Check back soon!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map(feature => (
            <FeatureCard
              key={feature.id}
              feature={feature}
              earlyAccess={earlyAccessMap[feature.id]}
              onRequestAccess={handleRequestAccess}
              onTryAccess={req => setActiveEarlyAccess(req)}
              onNavigate={handleLink}
              onCancelAccess={handleCancelEarlyAccess}
              onReRequestAccess={handleReRequestAccess}
              requestingId={requestingId}
            />
          ))}
        </div>
      )}

      {/* Feature Request Banner */}
      <div
        className="mt-12 rounded-xl p-8 text-center"
        style={{ background: `linear-gradient(135deg, ${primaryColor}33 0%, ${accentColor}55 100%)`, border: `1px solid ${primaryColor}44` }}
      >
        <h2 className="text-2xl font-bold text-white mb-3">Have a Feature Request?</h2>
        <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
          We value your input! If you have ideas for features that would make your experience better, we'd love to hear them.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => setShowFeatureRequestModal(true)}
            style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${accentColor} 100%)`, border: 'none', fontFamily: "'Outfit',sans-serif" }}
            className="text-white font-medium py-2 px-6 rounded-lg transition-colors"
          >
            Submit Feature Request
          </button>
          {myFeatureRequests.length > 0 && (
            <button
              onClick={() => setShowMyRequestsModal(true)}
              style={{ border: `1px solid ${primaryColor}66`, fontFamily: "'Outfit',sans-serif" }}
              className="flex items-center gap-2 text-white hover:bg-white/10 font-medium py-2 px-6 rounded-lg transition-colors"
            >
              <Eye size={16} /> View My Requests ({myFeatureRequests.length})
            </button>
          )}
        </div>
      </div>

      <style>{`@keyframes cs-spin { to { transform: rotate(360deg); } }`}</style>
    </div>

    {/* Modals — outside page div so they don't add scroll height */}
    {showFeatureRequestModal && user && (
      <FeatureRequestModal
        studentId={user.uid}
        studentName={user.name + (user.surname ? ' ' + user.surname : '')}
        studentUserId={user.userId}
        onClose={handleFeatureRequestSubmitted}
      />
    )}
    {showMyRequestsModal && (
      <MyRequestsModal
        requests={myFeatureRequests}
        onDelete={handleDeleteFeatureRequest}
        onClose={() => setShowMyRequestsModal(false)}
      />
    )}
    {activeEarlyAccess && (
      <EarlyAccessModal
        request={activeEarlyAccess}
        onNavigate={handleLink}
        onClose={() => setActiveEarlyAccess(null)}
      />
    )}
    </>
  );
};

export default ComingSoon;
