/**
 * NotificationsPage.tsx
 *
 * Style-consistent with ComingSoon.tsx / ModalShell:
 *   • Page background = app/DashboardLayout background (no hardcoded bg)
 *   • Each notification wrapped in <Card> component (same as ComingSoon feature cards)
 *   • Same sbBorder / sbShadow card surfaces via SurfaceVars
 *   • Same noise texture overlay
 *   • Same pRgb primary-color system throughout
 *   • Zero hardcoded background colours on page wrapper
 *
 * Layout:
 *   Mobile  → position:fixed portal (escapes DashboardLayout constraints)
 *   Desktop → normal in-flow rendering
 *
 * Features (all preserved):
 *   • Swipe left  → reveal Read + Delete action buttons
 *   • Full swipe  → instant delete with collapse animation
 *   • Tap card    → expand / collapse long messages
 *   • Mark all read  /  Clear all
 *   • Filter dropdown with per-type counts
 *   • Active filter badge
 *   • One-time swipe hint on mobile
 *   • Real-time Firestore subscription
 *   • Notification-pref muting
 *   • Announcement sync + transient purge
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import {
  Bell, BellOff, Megaphone, BookOpen, Clock, AlertTriangle,
  Star, Cpu, Check, CheckCheck, Trash2, RefreshCw, Inbox, ChevronDown,
  SlidersHorizontal, X as XIcon,
} from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import {
  notificationService,
  AppNotification,
  NotificationType,
} from '../../services/notificationService';
import { getUserNotificationSettings } from '../../services/settingsService';
import Card from '../ui/Card';

/* ─── helpers ─────────────────────────────────────────────────────────────── */

const hexRgb = (hex: string) => {
  if (!hex || hex.length < 7) return '99,102,241';
  return `${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)}`;
};

const THEME_BG: Record<string, string> = {
  dark: '#0d1117', light: '#ebe8e1', slate: '#0f172a',
  ocean: '#0c1a2e', forest: '#0a1f14', purple: '#1e1b4b',
  pink: '#831843', sunset: '#1c0a00',
};

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `${d}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/* ─── shared theme-surface builder (mirrors ModalShell in ComingSoon.tsx) ── */

interface SurfaceVars {
  baseBg: string;
  sbSparkle: string;
  sbBgSize: string;
  sbBorder: string;
  sbShadow: string;
  cardBg: string;
  cardBorder: string;
  divider: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
}

function buildSurface(
  theme: string,
  primaryColor: string,
  glitterTheme: string,
): SurfaceVars {
  const darkMode = theme !== 'light';
  const isLight  = theme === 'light';
  const pRgb     = hexRgb(primaryColor);
  const baseBg   = THEME_BG[theme] ?? '#0d1117';

  /* ── glitter patterns — exact copy from ComingSoon ModalShell ── */
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
  const sbBgSize =
    glitterTheme === 'silver'
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

  const sbBorder = darkMode
    ? `1px solid rgba(${pRgb},0.22)`
    : `1px solid rgba(255,255,255,0.95)`;

  const sbShadow = darkMode
    ? `0 8px 40px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(${pRgb},0.12), 0 0 60px rgba(${pRgb},0.06)`
    : `0 8px 32px rgba(0,0,0,0.10), inset 0 0 0 1px rgba(255,255,255,0.8), 0 0 40px rgba(${pRgb},0.07)`;

  /* card surfaces (same as MyRequestsModal inner cards) */
  const cardBg     = darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
  const cardBorder = darkMode ? `rgba(${pRgb},0.15)`     : 'rgba(0,0,0,0.07)';
  const divider    = darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';

  const textPrimary   = darkMode ? '#f1f5f9' : '#111827';
  const textSecondary = darkMode ? '#94a3b8' : '#6b7280';
  const textMuted     = darkMode ? '#475569' : '#9ca3af';

  return {
    baseBg, sbSparkle, sbBgSize, sbBorder, sbShadow,
    cardBg, cardBorder, divider,
    textPrimary, textSecondary, textMuted,
  };
}

/* ─── type config ─────────────────────────────────────────────────────────── */

interface TypeConfig { Icon: React.ElementType; color: string; bg: string; label: string }

const TYPE_CFG: Record<NotificationType, TypeConfig> = {
  announcement: { Icon: Megaphone,     color: '#6366f1', bg: 'rgba(99,102,241,0.15)',  label: 'Announcement' },
  assignment:   { Icon: BookOpen,      color: '#10b981', bg: 'rgba(16,185,129,0.15)',  label: 'Assignment'   },
  reminder:     { Icon: Clock,         color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  label: 'Reminder'     },
  urgent:       { Icon: AlertTriangle, color: '#ef4444', bg: 'rgba(239,68,68,0.15)',   label: 'Urgent'       },
  grade:        { Icon: Star,          color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)',  label: 'Grade'        },
  system:       { Icon: Cpu,           color: '#64748b', bg: 'rgba(100,116,139,0.15)', label: 'System'       },
};

/* ─── tabs ────────────────────────────────────────────────────────────────── */

type FilterTab = 'all' | 'unread' | NotificationType;

const TABS: { id: FilterTab; label: string }[] = [
  { id: 'all',          label: 'All'           },
  { id: 'unread',       label: 'Unread'        },
  { id: 'announcement', label: 'Announcements' },
  { id: 'assignment',   label: 'Assignments'   },
  { id: 'reminder',     label: 'Reminders'     },
  { id: 'urgent',       label: 'Urgent'        },
  { id: 'grade',        label: 'Grades'        },
  { id: 'system',       label: 'System'        },
];

/* ─── noise overlay (same as ModalShell) ─────────────────────────────────── */

const NoiseOverlay: React.FC<{ dark: boolean }> = ({ dark }) => (
  <div style={{
    position: 'absolute', inset: 0, borderRadius: 'inherit',
    pointerEvents: 'none', zIndex: 0,
    background: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
    opacity: dark ? 0.04 : 0.025,
    mixBlendMode: 'overlay',
  }} />
);

/* ─── skeleton ────────────────────────────────────────────────────────────── */

const Skeleton: React.FC<{ sv: SurfaceVars }> = ({ sv }) => (
  /* Skeleton uses Card component — same surface as every other card on the page */
  <Card style={{
    padding: 16, borderRadius: 16, position: 'relative', overflow: 'hidden',
    display: 'flex', gap: 12, alignItems: 'flex-start',
    animation: 'npulse 1.6s ease-in-out infinite',
    isolation: 'isolate',
  }}>
    <NoiseOverlay dark={sv.textPrimary === '#f1f5f9'} />
    <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 12, alignItems: 'flex-start', width: '100%' }}>
      <div style={{
        width: 44, height: 44, borderRadius: 14, flexShrink: 0,
        background: sv.cardBg,
      }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 2 }}>
        {[55, 80, 45].map((w, i) => (
          <div key={i} style={{
            height: i === 0 ? 13 : 11, borderRadius: 6, width: `${w}%`,
            background: sv.cardBg,
          }} />
        ))}
      </div>
    </div>
  </Card>
);

/* ─── empty state ─────────────────────────────────────────────────────────── */

const Empty: React.FC<{ sv: SurfaceVars; pRgb: string; filter: FilterTab }> = ({ sv, pRgb, filter }) => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: 16, padding: '60px 24px', textAlign: 'center',
  }}>
    <div style={{
      width: 80, height: 80, borderRadius: 24,
      background: `rgba(${pRgb},0.10)`,
      border: `1.5px solid rgba(${pRgb},0.2)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {filter === 'unread'
        ? <BellOff size={32} color={`rgba(${pRgb},0.55)`} strokeWidth={1.5} />
        : <Inbox   size={32} color={`rgba(${pRgb},0.55)`} strokeWidth={1.5} />}
    </div>
    <div>
      <p style={{ fontSize: 16, fontWeight: 700, color: sv.textPrimary, margin: 0 }}>
        {filter === 'unread' ? "You're all caught up!" : 'No notifications yet'}
      </p>
      <p style={{ fontSize: 13, color: sv.textSecondary, margin: '8px 0 0', lineHeight: 1.6, maxWidth: 240 }}>
        {filter === 'unread'
          ? 'All your notifications have been read.'
          : 'Notifications from your courses and teachers will show up here.'}
      </p>
    </div>
  </div>
);

/* ─── swipeable notification card ─────────────────────────────────────────── */

interface CardProps {
  notif:    AppNotification;
  sv:       SurfaceVars;
  pRgb:     string;
  gradient: string;
  onRead:   (id: string) => void;
  onDelete: (id: string) => void;
  idx:      number;
}

/*
 * Swipe constants — action zone is 2 floating pill buttons with a 6px gap.
 * Total revealed width = BTN_W*2 + GAP + EDGE_PAD*2
 * SNAP_BOTH = both buttons (unread card)  | SNAP_ONE = delete only (read card)
 */
const BTN_W      = 62;   // each pill button width
const BTN_GAP    = 6;    // gap between pills
const EDGE_PAD   = 10;   // right padding from card edge
const SNAP_BOTH  = BTN_W * 2 + BTN_GAP + EDGE_PAD + 4;  // ≈ 144
const SNAP_ONE   = BTN_W + EDGE_PAD + 4;                 // ≈ 76
const THRESH     = 36;
const FULL_DEL   = 260;
const MSG_LIMIT  = 120;

const NotifCard: React.FC<CardProps> = ({ notif, sv, pRgb, onRead, onDelete, idx }) => {
  const [expanded, setExpanded] = useState(false);
  const [tx,       setTx]       = useState(0);
  const [anim,     setAnim]     = useState(false);
  const [gone,     setGone]     = useState(false);
  const [hovered,  setHovered]  = useState(false);

  const touch = useRef({ x0: 0, y0: 0, dir: null as 'h' | 'v' | null, active: false });
  const cfg    = TYPE_CFG[notif.type] ?? TYPE_CFG.system;
  const isLong = (notif.message ?? '').length > MSG_LIMIT;
  const snapTo = notif.isRead ? SNAP_ONE : SNAP_BOTH;
  const dark   = sv.textPrimary === '#f1f5f9';

  /* How much to reveal: 0 → hidden, 1 → fully snapped */
  const revealRatio = Math.min(1, Math.abs(tx) / snapTo);

  const onTS = (e: React.TouchEvent) => {
    touch.current = { x0: e.touches[0].clientX, y0: e.touches[0].clientY, dir: null, active: true };
    setAnim(false);
  };
  const onTM = (e: React.TouchEvent) => {
    if (!touch.current.active) return;
    const dx = e.touches[0].clientX - touch.current.x0;
    const dy = e.touches[0].clientY - touch.current.y0;
    if (!touch.current.dir) {
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5)
        touch.current.dir = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v';
    }
    if (touch.current.dir !== 'h') return;
    e.preventDefault();
    setTx(Math.min(0, Math.max(-FULL_DEL, dx)));
  };
  const onTE = () => {
    if (!touch.current.active) return;
    touch.current.active = false;
    setAnim(true);
    if (tx < -(FULL_DEL - 20)) { doDelete(); return; }
    setTx(tx < -THRESH ? -snapTo : 0);
  };

  const doDelete = () => {
    setAnim(true);
    setTx(-window.innerWidth);
    setTimeout(() => { setGone(true); setTimeout(() => onDelete(notif.id), 260); }, 180);
  };

  const handleTap = () => {
    if (tx !== 0) { setAnim(true); setTx(0); return; }
    if (isLong) setExpanded(v => !v);
  };

  return (
    /*
     * Height-collapse shell — overflow:hidden here only for the collapse
     * animation. The swipe layer below does NOT have overflow:hidden so
     * action pills sit cleanly outside the card boundary.
     */
    <div style={{
      maxHeight: gone ? 0 : 600,
      opacity:   gone ? 0 : 1,
      transition: gone
        ? 'max-height 0.30s cubic-bezier(0.4,0,0.2,1), opacity 0.22s ease'
        : `opacity 0.28s ease ${idx * 28}ms`,
      animation: !gone
        ? `npslide 0.28s cubic-bezier(0.34,1.25,0.64,1) ${idx * 28}ms both`
        : 'none',
      overflow: 'hidden',
    }}>

      {/*
       * Swipe layer — NO overflow:hidden so the card can slide freely
       * and reveal the floating action pills sitting in the right margin.
       * position:relative lets pills anchor to this layer.
       */}
      <div style={{ position: 'relative', touchAction: 'pan-y' }}>

        {/*
         * ── Floating action pills ─────────────────────────────────────────
         * Absolutely positioned, vertically centred, right-aligned with gap.
         * They scale + fade in as the card slides, never clipped by card border.
         */}
        <div style={{
          position: 'absolute', right: EDGE_PAD, top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex', alignItems: 'center', gap: BTN_GAP,
          zIndex: 0,
          opacity: revealRatio,
          /* subtle scale-in from right as card moves */
          transition: anim ? 'opacity 0.22s ease' : 'none',
          pointerEvents: tx !== 0 ? 'auto' : 'none',
        }}>
          {/* Mark read pill — only for unread */}
          {!notif.isRead && (
            <button
              onClick={e => { e.stopPropagation(); onRead(notif.id); setAnim(true); setTx(0); }}
              style={{
                width: BTN_W, height: 48, borderRadius: 14, border: 'none',
                cursor: 'pointer', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 3,
                background: `rgb(${pRgb})`,
                boxShadow: `0 4px 16px rgba(${pRgb},0.40)`,
                color: '#fff', fontFamily: "'Outfit',sans-serif",
                transform: `scale(${0.82 + revealRatio * 0.18})`,
                transition: anim ? 'transform 0.22s ease' : 'none',
              }}>
              <Check size={16} strokeWidth={2.5} />
              <span style={{ fontSize: 10, fontWeight: 700, lineHeight: 1 }}>Read</span>
            </button>
          )}

          {/* Delete pill */}
          <button
            onClick={e => { e.stopPropagation(); doDelete(); }}
            style={{
              width: BTN_W, height: 48, borderRadius: 14, border: 'none',
              cursor: 'pointer', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 3,
              background: '#ef4444',
              boxShadow: '0 4px 16px rgba(239,68,68,0.40)',
              color: '#fff', fontFamily: "'Outfit',sans-serif",
              transform: `scale(${0.82 + revealRatio * 0.18})`,
              transition: anim ? 'transform 0.22s ease' : 'none',
            }}>
            <Trash2 size={16} strokeWidth={2} />
            <span style={{ fontSize: 10, fontWeight: 700, lineHeight: 1 }}>Delete</span>
          </button>
        </div>

        {/*
         * ── Foreground Card — slides over the pills ───────────────────────
         * Card component = same surface as ComingSoon feature cards.
         * Touch handlers on this wrapper; Card itself stays props-clean.
         */}
        <div
          onTouchStart={onTS}
          onTouchMove={onTM}
          onTouchEnd={onTE}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onClick={handleTap}
          style={{
            position: 'relative', zIndex: 1,
            transform: `translateX(${tx}px)`,
            transition: anim ? 'transform 0.32s cubic-bezier(0.34,1.2,0.64,1)' : 'none',
            willChange: 'transform',
            cursor: isLong ? 'pointer' : 'default',
            userSelect: 'none',
          }}
        >
          <Card style={{
            position: 'relative',
            isolation: 'isolate',
            overflow: 'hidden',
            borderRadius: 16,
            ...((!notif.isRead) ? {
              border: `1px solid rgba(${pRgb},0.30)`,
              boxShadow: `0 8px 40px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(${pRgb},0.12), 0 0 60px rgba(${pRgb},0.06)`,
            } : {}),
          }}>
            <NoiseOverlay dark={dark} />

            {/* primary colour accent glow — same as ModalShell */}
            {!notif.isRead && (
              <div style={{
                position: 'absolute', top: -20, left: '50%', transform: 'translateX(-50%)',
                width: 80, height: 80, borderRadius: '50%',
                background: `radial-gradient(circle, rgba(${pRgb},${dark ? 0.15 : 0.08}) 0%, transparent 70%)`,
                pointerEvents: 'none', zIndex: 0, filter: 'blur(16px)',
              }} />
            )}

            {/* unread accent bar */}
            {!notif.isRead && (
              <span style={{
                position: 'absolute', left: 0, top: 0, bottom: 0,
                width: 3, zIndex: 2,
                background: cfg.color,
                boxShadow: `0 0 10px ${cfg.color}44`,
              }} />
            )}

            {/* content row */}
            <div style={{
              position: 'relative', zIndex: 1,
              display: 'flex', gap: 12, alignItems: 'flex-start',
              padding: '14px 14px 12px 16px',
            }}>

              {/* icon */}
              <div style={{
                width: 42, height: 42, borderRadius: 13, flexShrink: 0,
                background: cfg.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `1.5px solid ${cfg.color}28`, marginTop: 1,
              }}>
                <cfg.Icon size={19} color={cfg.color} strokeWidth={2} />
              </div>

              {/* text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <p style={{
                    fontSize: 13.5, fontWeight: notif.isRead ? 500 : 700,
                    margin: 0, lineHeight: 1.45, flex: 1, minWidth: 0,
                    color: notif.isRead ? sv.textSecondary : sv.textPrimary,
                    wordBreak: 'break-word', overflowWrap: 'anywhere',
                  }}>
                    {notif.title}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0, marginTop: 2 }}>
                    <span style={{ fontSize: 11, color: sv.textMuted, fontWeight: 500, whiteSpace: 'nowrap' }}>
                      {relativeTime(notif.createdAt)}
                    </span>
                    {isLong && (
                      <ChevronDown size={12} color={sv.textMuted} style={{
                        transition: 'transform 0.2s',
                        transform: expanded ? 'rotate(180deg)' : 'none',
                        flexShrink: 0,
                      }} />
                    )}
                  </div>
                </div>

                {notif.message && (
                  <p style={{
                    fontSize: 13, color: sv.textSecondary,
                    margin: '5px 0 0', lineHeight: 1.65,
                    wordBreak: 'break-word', overflowWrap: 'anywhere',
                    ...(isLong && !expanded ? {
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical' as const,
                      overflow: 'hidden',
                    } : {}),
                  }}>
                    {notif.message}
                  </p>
                )}

                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: cfg.color,
                    background: cfg.bg, padding: '3px 9px', borderRadius: 99,
                    border: `1px solid ${cfg.color}28`, whiteSpace: 'nowrap',
                  }}>{cfg.label}</span>
                  {notif.metadata?.teacherName && (
                    <span style={{ fontSize: 11, color: sv.textMuted, fontWeight: 500, whiteSpace: 'nowrap' }}>
                      {notif.metadata.teacherName as string}
                    </span>
                  )}
                  {notif.metadata?.courseName && (
                    <span style={{
                      fontSize: 11, color: sv.textMuted, fontWeight: 500,
                      maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>· {notif.metadata.courseName as string}</span>
                  )}
                  {notif.priority === 'high' && (
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: '#ef4444',
                      background: 'rgba(239,68,68,0.1)', padding: '3px 9px', borderRadius: 99,
                      border: '1px solid rgba(239,68,68,0.2)', whiteSpace: 'nowrap',
                    }}>High priority</span>
                  )}
                </div>
              </div>

              {/* desktop hover actions (hidden on touch via CSS) */}
              <div className="np-dsk-actions" style={{
                display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0,
                opacity: hovered ? 1 : 0, transition: 'opacity 0.15s',
                pointerEvents: hovered ? 'auto' : 'none',
              }}>
                {!notif.isRead && (
                  <button onClick={e => { e.stopPropagation(); onRead(notif.id); }}
                    style={{
                      width: 32, height: 32, borderRadius: 10, cursor: 'pointer',
                      background: `rgba(${pRgb},0.12)`,
                      border: `1px solid rgba(${pRgb},0.20)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                    <Check size={14} color={`rgb(${pRgb})`} />
                  </button>
                )}
                <button onClick={e => { e.stopPropagation(); doDelete(); }}
                  style={{
                    width: 32, height: 32, borderRadius: 10, cursor: 'pointer',
                    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                  <Trash2 size={14} color="#ef4444" />
                </button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

/* ─── confirm bottom-sheet ────────────────────────────────────────────────── */

const ConfirmSheet: React.FC<{
  sv: SurfaceVars;
  title: string; body: string;
  confirmLabel: string; confirmColor: string;
  onOk: () => void; onCancel: () => void;
}> = ({ sv, title, body, confirmLabel, confirmColor, onOk, onCancel }) => (
  <div onClick={onCancel} style={{
    position: 'fixed', inset: 0, zIndex: 9999,
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)',
  }}>
    <div onClick={e => e.stopPropagation()} style={{
      position: 'relative', isolation: 'isolate',
      backgroundColor: sv.baseBg,
      backgroundImage: sv.sbSparkle,
      backgroundSize: sv.sbBgSize,
      backdropFilter: 'blur(32px) saturate(200%)',
      WebkitBackdropFilter: 'blur(32px) saturate(200%)',
      border: sv.sbBorder,
      borderRadius: '24px 24px 0 0',
      padding: '20px 24px 44px',
      width: '100%', maxWidth: 520,
      boxShadow: `${sv.sbShadow}, 0 -16px 48px rgba(0,0,0,0.25)`,
      animation: 'npsheet 0.28s cubic-bezier(0.34,1.15,0.64,1)',
      boxSizing: 'border-box' as any,
    }}>
      <NoiseOverlay dark={sv.textPrimary === '#f1f5f9'} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: sv.divider,
          margin: '0 auto 20px',
        }} />
        <div style={{
          width: 52, height: 52, borderRadius: 16,
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
        }}>
          <Trash2 size={24} color="#ef4444" />
        </div>
        <p style={{ fontSize: 17, fontWeight: 700, color: sv.textPrimary, margin: '0 0 8px' }}>{title}</p>
        <p style={{ fontSize: 14, color: sv.textSecondary, margin: '0 0 24px', lineHeight: 1.6 }}>{body}</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{
            flex: 1, height: 50, borderRadius: 14, cursor: 'pointer', fontSize: 15, fontWeight: 600,
            fontFamily: "'Outfit',sans-serif",
            background: sv.cardBg,
            border: sv.sbBorder,
            color: sv.textSecondary,
          }}>Cancel</button>
          <button onClick={onOk} style={{
            flex: 1, height: 50, borderRadius: 14, cursor: 'pointer', fontSize: 15, fontWeight: 700,
            fontFamily: "'Outfit',sans-serif", border: 'none',
            background: confirmColor, color: '#fff',
            boxShadow: `0 4px 16px ${confirmColor}55`,
          }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  </div>
);

/* ─── main page ───────────────────────────────────────────────────────────── */

const NotificationsPage: React.FC = () => {
  const { user, isAuthenticated, theme, primaryColor, accentColor, glitterTheme } = useDashboard();

  const dark     = theme !== 'light';
  const pRgb     = hexRgb(primaryColor);
  const gradient = `linear-gradient(135deg,${primaryColor} 0%,${accentColor ?? primaryColor} 100%)`;

  /* build surface vars once per theme/color change */
  const sv = useMemo(
    () => buildSurface(theme, primaryColor, glitterTheme ?? ''),
    [theme, primaryColor, glitterTheme],
  );

  const [notifs,    setNotifs]    = useState<AppNotification[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [syncing,   setSyncing]   = useState(false);
  const [tab,       setTab]       = useState<FilterTab>('all');
  const [clearDlg,  setClearDlg]  = useState(false);
  const [hint,      setHint]      = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [prefs,     setPrefs]     = useState<Record<string, boolean>>({});
  const [isMobile,  setIsMobile]  = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  );
  const hintDone = useRef(false);

  /* tab scrolling */
  const tabsRef = useRef<HTMLDivElement>(null);
  const tabDrag = useRef({ x0: 0, sl: 0, on: false });
  const onTabTS = (e: React.TouchEvent) => {
    const el = tabsRef.current; if (!el) return;
    tabDrag.current = { x0: e.touches[0].pageX, sl: el.scrollLeft, on: true };
  };
  const onTabTM = (e: React.TouchEvent) => {
    if (!tabDrag.current.on || !tabsRef.current) return;
    tabsRef.current.scrollLeft = tabDrag.current.sl + (tabDrag.current.x0 - e.touches[0].pageX);
  };
  const onTabTE = () => { tabDrag.current.on = false; };

  useEffect(() => {
    const el = tabsRef.current; if (!el) return;
    const btn = el.querySelector('[data-active="true"]') as HTMLElement | null;
    btn?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [tab]);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  /* swipe hint: show once */
  useEffect(() => {
    if (isMobile && !loading && !hintDone.current && notifs.length > 0) {
      hintDone.current = true; setHint(true);
      const t = setTimeout(() => setHint(false), 5000);
      return () => clearTimeout(t);
    }
  }, [isMobile, loading, notifs.length]);

  /* firestore subscription */
  useEffect(() => {
    if (!isAuthenticated || !user?.uid) return;
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 3000);
    const unsub = notificationService.subscribeToNotifications(
      user.uid,
      ns => { clearTimeout(t); setNotifs(ns); setLoading(false); },
      ()  => { clearTimeout(t); setLoading(false); },
    );
    return () => { clearTimeout(t); unsub(); };
  }, [isAuthenticated, user?.uid]);

  /* sync + prefs */
  useEffect(() => {
    if (!isAuthenticated || !user?.uid) return;
    (async () => {
      setSyncing(true);
      await notificationService.syncAnnouncementsAsNotifications(
        user.uid, user.role ?? 'student', (user as any).enrolledCourseIds ?? [],
      );
      notificationService.purgeTransient(user.uid);
      setSyncing(false);
    })();
    getUserNotificationSettings(user.uid)
      .then(p => { if (p) setPrefs(p as any); })
      .catch(() => {});
  }, [isAuthenticated, user?.uid]);

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, []);

  const doRead    = useCallback(async (id: string) => { await notificationService.markAsRead(id); }, []);
  const doReadAll = useCallback(async () => {
    if (user?.uid) await notificationService.markAllAsRead(user.uid);
  }, [user?.uid]);
  const doDelete  = useCallback(async (id: string) => { await notificationService.deleteNotification(id); }, []);
  const doClear   = useCallback(async () => {
    if (!user?.uid) return;
    setClearDlg(false);
    await notificationService.clearAllNotifications(user.uid);
  }, [user?.uid]);

  const muted = useCallback((n: AppNotification) => {
    const rt = (n.metadata?.relatedType as string) ?? n.relatedType ?? '';
    if (rt === 'announcement'     && prefs.notifyAnnouncements         === false) return true;
    if (rt === 'courseEnrollment' && prefs.notifyCourseEnrollment      === false) return true;
    if (rt === 'qa'               && prefs.notifyQaAnswers             === false) return true;
    if (rt === 'taskGroup'        && prefs.notifyTaskAssigned          === false) return true;
    if (rt === 'task'             && prefs.notifyTaskEvaluation        === false) return true;
    if (rt === 'exam'             && prefs.notifyExamResults           === false) return true;
    if (['studyGoal', 'studySchedule', 'streakFreeze'].includes(rt)
        && prefs.notifyStudyPlan === false) return true;
    if (['earlyAccess', 'featureRequest'].includes(rt)
        && prefs.notifyEarlyAccess === false) return true;
    if (rt === 'comingSoon' && prefs.notifyNewComingSoonFeatures === false) return true;
    return false;
  }, [prefs]);

  const filtered = useMemo(() => notifs.filter(n => {
    if (muted(n))      return false;
    if (tab === 'all')    return true;
    if (tab === 'unread') return !n.isRead;
    return n.type === tab;
  }), [notifs, tab, muted]);

  const unread = useMemo(() => notifs.filter(n => !n.isRead).length, [notifs]);

  const TOP_NAV    = isMobile ? 60 : 64;
  const BOTTOM_NAV = isMobile ? 64 : 0;

  /* ── content ──────────────────────────────────────────────────────────────── */
  const content = (
    /*
     * PAGE WRAPPER
     * ─────────────────────────────────────────────────────────────────────────
     * Mobile: position:fixed portal — NO background set here.
     *   The portal escapes DashboardLayout so the app's root background
     *   (set on <body> or the layout shell) shows through naturally.
     *   This is identical to how ComingSoon renders — it never sets its own
     *   page background; it only styles the Card surfaces inside.
     *
     * Desktop: plain in-flow div, inherits the page background from
     *   DashboardLayout exactly as ComingSoon does.
     */
    <div style={{
      fontFamily: "'Outfit',sans-serif",
      display: 'flex', flexDirection: 'column', gap: 12,
      ...(isMobile ? {
        position: 'fixed' as const,
        top: TOP_NAV, left: 0, right: 0, bottom: BOTTOM_NAV,
        zIndex: 200,
        overflowY: 'auto' as const,
        overflowX: 'hidden' as const,
        WebkitOverflowScrolling: 'touch',
        padding: '16px 0 24px',
        /* ✅ No hardcoded background — inherits app bg */
      } : {
        paddingBottom: 40,
        width: '100%',
        /* ✅ No hardcoded background — inherits DashboardLayout */
      }),
    }}>

      {/* ── header ──────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 8,
        padding: isMobile ? '0 16px' : '0',
      }}>
        {/* Left: icon + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
          <div style={{
            width: isMobile ? 36 : 40, height: isMobile ? 36 : 40,
            borderRadius: 12, background: gradient, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 4px 14px rgba(${pRgb},0.35)`,
          }}>
            <Bell size={isMobile ? 16 : 18} color="#fff" strokeWidth={2.5} />
          </div>
          <div style={{ minWidth: 0 }}>
            <h1 style={{
              fontSize: isMobile ? 17 : 21, fontWeight: 800,
              color: sv.textPrimary,
              margin: 0, lineHeight: 1.2,
            }}>Notifications</h1>
            <p style={{ color: sv.textSecondary, margin: 0, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
              {syncing
                ? <><RefreshCw size={10} style={{ animation: 'npspin 1.2s linear infinite' }} /> Syncing…</>
                : unread > 0 ? `${unread} unread` : 'All caught up ✓'}
            </p>
          </div>
        </div>

        {/* Right: action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          {/* Close / back */}
          <button
            onClick={() => window.history.back()}
            title="Close"
            className="np-close-btn"
            style={{
              width: 32, height: 32, borderRadius: 9, cursor: 'pointer',
              background: sv.cardBg,
              border: sv.sbBorder,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: sv.textSecondary,
              transition: 'all .18s', fontFamily: "'Outfit',sans-serif",
            }}>
            <XIcon size={14} strokeWidth={2.5} />
          </button>

          {/* Filter dropdown trigger */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setFilterOpen(v => !v)}
              title="Filter"
              style={{
                width: 32, height: 32, borderRadius: 9, cursor: 'pointer',
                background: filterOpen ? `rgba(${pRgb},0.18)` : sv.cardBg,
                border: filterOpen ? `1px solid rgba(${pRgb},0.35)` : sv.sbBorder,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative', transition: 'all .18s',
              }}>
              <SlidersHorizontal size={13} color={filterOpen ? `rgb(${pRgb})` : sv.textSecondary} />
              {tab !== 'all' && (
                <span style={{
                  position: 'absolute', top: 5, right: 5,
                  width: 6, height: 6, borderRadius: '50%',
                  background: `rgb(${pRgb})`,
                }} />
              )}
            </button>

            {/* Filter dropdown panel — uses ModalShell surface */}
            {filterOpen && (
              <>
                <div
                  onClick={() => setFilterOpen(false)}
                  style={{ position: 'fixed', inset: 0, zIndex: 299 }}
                />
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  zIndex: 300,
                  width: 220,
                  borderRadius: 16,
                  isolation: 'isolate',
                  backgroundColor: sv.baseBg,
                  backgroundImage: sv.sbSparkle,
                  backgroundSize: sv.sbBgSize,
                  border: sv.sbBorder,
                  boxShadow: `${sv.sbShadow}, 0 16px 48px rgba(0,0,0,0.4)`,
                  backdropFilter: 'blur(32px) saturate(200%)',
                  WebkitBackdropFilter: 'blur(32px) saturate(200%)',
                  padding: '8px',
                  animation: 'npslide 0.18s cubic-bezier(0.34,1.25,0.64,1)',
                  overflow: 'hidden',
                }}>
                  <NoiseOverlay dark={dark} />
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <p style={{
                      fontSize: 10, fontWeight: 700, color: sv.textSecondary,
                      margin: '0 0 6px', padding: '0 8px',
                      textTransform: 'uppercase', letterSpacing: '0.08em',
                    }}>Filter by</p>
                    {TABS.map(t => {
                      const active = tab === t.id;
                      const count =
                        t.id === 'unread' ? unread
                        : t.id === 'all'  ? notifs.filter(n => !muted(n)).length
                        : notifs.filter(n => !muted(n) && n.type === t.id).length;
                      const cfg2 = t.id !== 'all' && t.id !== 'unread'
                        ? TYPE_CFG[t.id as NotificationType] : null;
                      return (
                        <button key={t.id}
                          onClick={() => { setTab(t.id); setFilterOpen(false); }}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center',
                            gap: 10, padding: '9px 10px', borderRadius: 10,
                            border: 'none', cursor: 'pointer', textAlign: 'left' as any,
                            background: active
                              ? `rgba(${pRgb},0.18)`
                              : 'transparent',
                            transition: 'background 0.15s',
                            fontFamily: "'Outfit',sans-serif",
                          }}>
                          <span style={{
                            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                            background: cfg2 ? cfg2.color : active ? `rgb(${pRgb})` : sv.textMuted,
                          }} />
                          <span style={{
                            flex: 1, fontSize: 13, fontWeight: active ? 700 : 400,
                            color: active ? `rgb(${pRgb})` : sv.textPrimary,
                          }}>{t.label}</span>
                          {count > 0 && (
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: '1px 7px',
                              borderRadius: 99, lineHeight: '17px',
                              background: active ? `rgb(${pRgb})` : sv.cardBg,
                              color: active ? '#fff' : sv.textSecondary,
                              border: `1px solid ${active ? 'transparent' : sv.cardBorder}`,
                            }}>{count > 99 ? '99+' : count}</span>
                          )}
                          {active && (
                            <Check size={13} color={`rgb(${pRgb})`} strokeWidth={2.5} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Mark all read */}
          {unread > 0 && (
            <button onClick={doReadAll} title="Mark all read" style={{
              height: 32,
              padding: isMobile ? '0' : '0 10px',
              width: isMobile ? 32 : 'auto',
              borderRadius: 9, cursor: 'pointer',
              background: `rgba(${pRgb},0.12)`,
              border: `1px solid rgba(${pRgb},0.22)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              color: `rgb(${pRgb})`, fontSize: 12, fontWeight: 700,
              fontFamily: "'Outfit',sans-serif", whiteSpace: 'nowrap' as any,
              transition: 'all .18s',
            }}>
              <CheckCheck size={13} />
              {!isMobile && 'Mark all read'}
            </button>
          )}

          {/* Clear all */}
          {notifs.length > 0 && (
            <button onClick={() => setClearDlg(true)} title="Clear all" style={{
              height: 32,
              padding: isMobile ? '0' : '0 10px',
              width: isMobile ? 32 : 'auto',
              borderRadius: 9, cursor: 'pointer',
              background: 'rgba(239,68,68,0.09)', border: '1px solid rgba(239,68,68,0.20)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              color: '#ef4444', fontSize: 12, fontWeight: 700,
              fontFamily: "'Outfit',sans-serif", whiteSpace: 'nowrap' as any,
              transition: 'all .18s',
            }}>
              <Trash2 size={13} />
              {!isMobile && 'Clear all'}
            </button>
          )}
        </div>
      </div>

      {/* ── active filter badge ──────────────────────────────────────────────── */}
      {tab !== 'all' && (
        <div style={{
          padding: isMobile ? '0 16px' : '0',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 10px 5px 8px', borderRadius: 99,
            background: `rgba(${pRgb},0.15)`,
            border: `1px solid rgba(${pRgb},0.28)`,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
              background: `rgb(${pRgb})`,
            }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: `rgb(${pRgb})` }}>
              {TABS.find(t => t.id === tab)?.label}
            </span>
            <button
              onClick={() => setTab('all')}
              style={{
                width: 16, height: 16, borderRadius: '50%', border: 'none', cursor: 'pointer',
                background: `rgba(${pRgb},0.2)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 0, marginLeft: 2,
              }}>
              <XIcon size={9} color={`rgb(${pRgb})`} strokeWidth={2.5} />
            </button>
          </div>
          <span style={{ fontSize: 12, color: sv.textSecondary }}>
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* ── swipe hint — wrapped in Card ─────────────────────────────────────── */}
      {hint && (
        <div style={{ padding: isMobile ? '0 16px' : '0' }}>
          <Card
            onClick={() => setHint(false)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px', borderRadius: 12, cursor: 'pointer',
              isolation: 'isolate', position: 'relative', overflow: 'hidden',
              animation: 'npslide 0.3s ease both',
            }}
          >
            <NoiseOverlay dark={dark} />
            <span style={{ position: 'relative', zIndex: 1, fontSize: 18 }}>👈</span>
            <span style={{ position: 'relative', zIndex: 1, fontSize: 12, color: sv.textSecondary, fontWeight: 500, flex: 1 }}>
              Swipe left to mark read or delete
            </span>
            <span style={{ position: 'relative', zIndex: 1, fontSize: 11, color: sv.textMuted, fontWeight: 600 }}>Got it</span>
          </Card>
        </div>
      )}

      {/* ── notification list ────────────────────────────────────────────────── */}
      <div style={{ padding: isMobile ? '0 12px' : '0' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[0, 1, 2, 3].map(i => <Skeleton key={i} sv={sv} />)}
          </div>
        ) : filtered.length === 0 ? (
          <Empty sv={sv} pRgb={pRgb} filter={tab} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map((n, i) => (
              <NotifCard
                key={n.id} notif={n} sv={sv} pRgb={pRgb} gradient={gradient}
                onRead={doRead} onDelete={doDelete} idx={i}
              />
            ))}
            {filtered.length >= 10 && (
              <p style={{
                textAlign: 'center', padding: '12px 0 4px',
                fontSize: 12, color: sv.textSecondary, fontWeight: 500,
              }}>
                — {filtered.length} notifications —
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── confirm sheet ────────────────────────────────────────────────────── */}
      {clearDlg && (
        <ConfirmSheet
          sv={sv}
          title="Clear all notifications?"
          body="This will permanently delete all your notifications. This cannot be undone."
          confirmLabel="Clear all" confirmColor="#ef4444"
          onOk={doClear} onCancel={() => setClearDlg(false)}
        />
      )}

      <style>{`
        @keyframes npslide {
          from { opacity:0; transform:translateY(10px) scale(0.97); }
          to   { opacity:1; transform:translateY(0)    scale(1);    }
        }
        @keyframes nppulse {
          0%,100% { opacity:1; }
          50%     { opacity:0.4; }
        }
        @keyframes npspin  { to { transform:rotate(360deg); } }
        @keyframes npsheet {
          from { transform:translateY(100%); }
          to   { transform:translateY(0); }
        }
        @keyframes npulse {
          0%,100% { opacity:1; }
          50%     { opacity:0.45; }
        }
        .np-tabs::-webkit-scrollbar { display:none; }
        .np-tabs { -ms-overflow-style:none; scrollbar-width:none; }
        @media (hover:none) and (pointer:coarse) {
          .np-dsk-actions { display:none !important; }
        }
        .np-close-btn:hover {
          background: rgba(255,255,255,0.10) !important;
          border-color: rgba(255,255,255,0.18) !important;
        }
        .np-markread-btn:hover {
          opacity: 0.85;
          transform: scale(1.04);
        }
        .np-clearall-btn:hover {
          background: rgba(239,68,68,0.16) !important;
        }
      `}</style>
    </div>
  );

  if (isMobile) {
    return ReactDOM.createPortal(content, document.body);
  }
  return content;
};

export default NotificationsPage;
