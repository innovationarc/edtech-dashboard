/**
 * NotificationsPage.tsx
 * iOS-style notification system:
 *   – Swipe left to reveal Delete / Mark Read actions
 *   – Tap card body to expand long messages
 *   – "Mark all read" + "Clear all" global actions
 *   – Fully responsive (mobile-first, works on every screen size)
 *   – Real-time Firestore subscription
 *   – Filter tabs: All · Unread · Announcements · Assignments · Reminders · Urgent · Grades · System
 */

import React, {
  useState, useEffect, useCallback, useRef, useMemo,
} from 'react';
import {
  Bell, BellOff, Megaphone, BookOpen, Clock, AlertTriangle,
  Star, Cpu, Check, CheckCheck, Trash2, RefreshCw, Inbox, ChevronDown,
} from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import {
  notificationService,
  AppNotification,
  NotificationType,
} from '../../services/notificationService';
import { getUserNotificationSettings } from '../../services/settingsService';

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

const hexRgb = (hex: string) => {
  if (!hex || hex.length < 7) return '99,102,241';
  return `${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)}`;
};

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ─────────────────────────────────────────
// Type config
// ─────────────────────────────────────────

interface TypeConfig {
  Icon: React.ElementType;
  color: string;
  bg: string;
  label: string;
}

const TYPE_CONFIG: Record<NotificationType, TypeConfig> = {
  announcement: { Icon: Megaphone,     color: '#6366f1', bg: 'rgba(99,102,241,0.15)',  label: 'Announcement' },
  assignment:   { Icon: BookOpen,      color: '#10b981', bg: 'rgba(16,185,129,0.15)',  label: 'Assignment'   },
  reminder:     { Icon: Clock,         color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  label: 'Reminder'     },
  urgent:       { Icon: AlertTriangle, color: '#ef4444', bg: 'rgba(239,68,68,0.15)',   label: 'Urgent'       },
  grade:        { Icon: Star,          color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)',  label: 'Grade'        },
  system:       { Icon: Cpu,           color: '#64748b', bg: 'rgba(100,116,139,0.15)', label: 'System'       },
};

// ─────────────────────────────────────────
// Filter tabs
// ─────────────────────────────────────────

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

// ─────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────

const SkeletonCard: React.FC<{ darkMode: boolean }> = ({ darkMode }) => (
  <div style={{
    padding: '16px',
    borderRadius: 16,
    background: darkMode ? 'rgba(255,255,255,0.03)' : '#ffffff',
    border: darkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.07)',
    display: 'flex', gap: 12, alignItems: 'flex-start',
    animation: 'npulse 1.6s ease-in-out infinite',
  }}>
    <div style={{ width: 44, height: 44, borderRadius: 14, flexShrink: 0,
      background: darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' }} />
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 2 }}>
      <div style={{ height: 13, borderRadius: 6, width: '55%',
        background: darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' }} />
      <div style={{ height: 11, borderRadius: 6, width: '80%',
        background: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }} />
      <div style={{ height: 11, borderRadius: 6, width: '45%',
        background: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }} />
    </div>
  </div>
);

// ─────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────

const EmptyState: React.FC<{ darkMode: boolean; pRgb: string; filter: FilterTab }> = ({ darkMode, pRgb, filter }) => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: 16, padding: '60px 24px',
    textAlign: 'center',
  }}>
    <div style={{
      width: 80, height: 80, borderRadius: 24,
      background: darkMode ? `rgba(${pRgb},0.10)` : `rgba(${pRgb},0.08)`,
      border: `1.5px solid rgba(${pRgb},0.2)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {filter === 'unread'
        ? <BellOff size={32} color={`rgba(${pRgb},0.55)`} strokeWidth={1.5} />
        : <Inbox   size={32} color={`rgba(${pRgb},0.55)`} strokeWidth={1.5} />
      }
    </div>
    <div>
      <p style={{ fontSize: 16, fontWeight: 700, color: darkMode ? '#e2e8f0' : '#111827', margin: 0 }}>
        {filter === 'unread' ? "You're all caught up!" : 'No notifications yet'}
      </p>
      <p style={{ fontSize: 13, color: '#64748b', margin: '8px 0 0', lineHeight: 1.6, maxWidth: 240 }}>
        {filter === 'unread'
          ? 'All your notifications have been read.'
          : 'Notifications from your courses and teachers will show up here.'}
      </p>
    </div>
  </div>
);

// ─────────────────────────────────────────
// iOS-style swipeable notification card
// ─────────────────────────────────────────

interface NotifCardProps {
  notif: AppNotification;
  darkMode: boolean;
  pRgb: string;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
  index: number;
}

const SWIPE_THRESHOLD   = 55;
const SWIPE_FULL_DELETE = 250;
const ACTION_WIDTH_BOTH = 140;
const ACTION_WIDTH_ONE  = 80;
const COLLAPSE_THRESHOLD = 120;

const NotifCard: React.FC<NotifCardProps> = ({ notif, darkMode, pRgb, onRead, onDelete, index }) => {
  const [expanded,  setExpanded]  = useState(false);
  const [swipeX,    setSwipeX]    = useState(0);
  const [releasing, setReleasing] = useState(false);
  const [exiting,   setExiting]   = useState(false);
  const [hovered,   setHovered]   = useState(false);

  const touchRef = useRef<{ startX: number; startY: number; moved: boolean; lockDir: 'h'|'v'|null }>({
    startX: 0, startY: 0, moved: false, lockDir: null,
  });

  const cfg    = TYPE_CONFIG[notif.type] ?? TYPE_CONFIG.system;
  const isLong = (notif.message ?? '').length > COLLAPSE_THRESHOLD;
  const actionW = notif.isRead ? ACTION_WIDTH_ONE : ACTION_WIDTH_BOTH;

  // ── Touch handlers ──
  const onTouchStart = (e: React.TouchEvent) => {
    touchRef.current = {
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      moved: false,
      lockDir: null,
    };
    setReleasing(false);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - touchRef.current.startX;
    const dy = e.touches[0].clientY - touchRef.current.startY;

    if (!touchRef.current.lockDir) {
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
        touchRef.current.lockDir = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v';
      }
    }

    if (touchRef.current.lockDir !== 'h') return;

    // Prevent page scroll while swiping horizontally
    e.preventDefault();

    touchRef.current.moved = true;
    const clamped = Math.min(0, Math.max(-SWIPE_FULL_DELETE, dx));
    setSwipeX(clamped);
  };

  const onTouchEnd = () => {
    if (!touchRef.current.moved) return;
    setReleasing(true);

    if (swipeX < -(SWIPE_FULL_DELETE - 30)) {
      triggerDelete();
    } else if (swipeX < -SWIPE_THRESHOLD) {
      setSwipeX(-actionW);
    } else {
      setSwipeX(0);
    }
  };

  const closeSwipe = () => { setReleasing(true); setSwipeX(0); };

  const triggerDelete = () => {
    setReleasing(true);
    setSwipeX(-window.innerWidth);
    setTimeout(() => {
      setExiting(true);
      setTimeout(() => onDelete(notif.id), 230);
    }, 200);
  };

  const handleCardPress = () => {
    if (swipeX !== 0) { closeSwipe(); return; }
    if (isLong) setExpanded(v => !v);
  };

  const snapOpen = swipeX <= -SWIPE_THRESHOLD;

  return (
    <div style={{
      position: 'relative',
      borderRadius: 16,
      overflow: 'hidden',
      maxHeight: exiting ? 0 : 600,
      opacity: exiting ? 0 : 1,
      transform: exiting ? 'scaleY(0.85)' : 'scaleY(1)',
      transformOrigin: 'top',
      transition: exiting
        ? 'all 0.23s cubic-bezier(0.4,0,0.2,1)'
        : `opacity 0.3s ease ${index * 28}ms`,
      animation: !exiting ? `nslide 0.3s cubic-bezier(0.34,1.25,0.64,1) ${index * 28}ms both` : 'none',
    }}>

      {/* ── Background actions (revealed on swipe) ── */}
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0,
        display: 'flex', borderRadius: '0 16px 16px 0', overflow: 'hidden', zIndex: 0,
      }}>
        {!notif.isRead && (
          <button
            onClick={e => { e.stopPropagation(); onRead(notif.id); closeSwipe(); }}
            style={{
              width: ACTION_WIDTH_ONE, background: `rgb(${pRgb})`,
              border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 5,
              color: '#fff', fontFamily: "'Outfit',sans-serif",
              transition: 'width 0.1s',
            }}
          >
            <Check size={22} strokeWidth={2.5} />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.2 }}>Read</span>
          </button>
        )}
        <button
          onClick={e => { e.stopPropagation(); triggerDelete(); }}
          style={{
            width: ACTION_WIDTH_ONE, background: '#ef4444',
            border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 5,
            color: '#fff', fontFamily: "'Outfit',sans-serif",
          }}
        >
          <Trash2 size={22} strokeWidth={2} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.2 }}>Delete</span>
        </button>
      </div>

      {/* ── Foreground card ── */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={handleCardPress}
        style={{
          position: 'relative', zIndex: 1,
          borderRadius: 16,
          background: darkMode
            ? (notif.isRead ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)')
            : (notif.isRead ? '#ffffff' : '#fafbff'),
          border: `1px solid ${
            !notif.isRead
              ? darkMode ? `rgba(${pRgb},0.22)` : `rgba(${pRgb},0.16)`
              : darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'
          }`,
          boxShadow: !notif.isRead && !darkMode ? `0 2px 14px rgba(${pRgb},0.07)` : 'none',
          transform: `translateX(${swipeX}px)`,
          transition: releasing ? 'transform 0.33s cubic-bezier(0.34,1.2,0.64,1)' : 'none',
          cursor: isLong ? 'pointer' : 'default',
          touchAction: 'pan-y',
          userSelect: 'none',
          overflow: 'hidden',
          willChange: 'transform',
        }}
      >
        {/* Unread accent bar */}
        {!notif.isRead && (
          <span style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: 3, background: cfg.color,
            boxShadow: `0 0 10px ${cfg.color}44`,
          }} />
        )}

        {/* Content */}
        <div style={{
          display: 'flex', gap: 12, alignItems: 'flex-start',
          padding: '14px 14px 12px 16px',
        }}>
          {/* Icon */}
          <div style={{
            width: 42, height: 42, borderRadius: 13, flexShrink: 0,
            background: cfg.bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `1.5px solid ${cfg.color}28`, marginTop: 1,
          }}>
            <cfg.Icon size={19} color={cfg.color} strokeWidth={2} />
          </div>

          {/* Text */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
              <p style={{
                fontSize: 13.5, fontWeight: notif.isRead ? 500 : 700,
                margin: 0, lineHeight: 1.45,
                color: darkMode
                  ? (notif.isRead ? '#94a3b8' : '#f1f5f9')
                  : (notif.isRead ? '#6b7280' : '#111827'),
                flex: 1, minWidth: 0,
                wordBreak: 'break-word', overflowWrap: 'anywhere',
              }}>
                {notif.title}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, marginTop: 2 }}>
                <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  {relativeTime(notif.createdAt)}
                </span>
                {isLong && (
                  <ChevronDown size={13} color="#94a3b8" style={{
                    transition: 'transform 0.22s ease',
                    transform: expanded ? 'rotate(180deg)' : 'none',
                    flexShrink: 0,
                  }} />
                )}
              </div>
            </div>

            {notif.message && (
              <p style={{
                fontSize: 13, color: darkMode ? '#64748b' : '#6b7280',
                margin: '5px 0 0', lineHeight: 1.65,
                wordBreak: 'break-word', overflowWrap: 'anywhere',
                ...(isLong && !expanded ? {
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical' as any,
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
              }}>
                {cfg.label}
              </span>
              {notif.metadata?.teacherName && (
                <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  {notif.metadata.teacherName as string}
                </span>
              )}
              {notif.metadata?.courseName && (
                <span style={{
                  fontSize: 11, color: '#94a3b8', fontWeight: 500,
                  maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  · {notif.metadata.courseName as string}
                </span>
              )}
              {notif.priority === 'high' && (
                <span style={{
                  fontSize: 11, fontWeight: 700, color: '#ef4444',
                  background: 'rgba(239,68,68,0.1)', padding: '3px 9px', borderRadius: 99,
                  border: '1px solid rgba(239,68,68,0.2)', whiteSpace: 'nowrap',
                }}>
                  High priority
                </span>
              )}
            </div>
          </div>

          {/* Desktop hover actions — hidden on touch devices via CSS */}
          <div
            className="notif-desktop-actions"
            style={{
              display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0,
              opacity: hovered ? 1 : 0,
              transition: 'opacity 0.15s ease',
              pointerEvents: hovered ? 'auto' : 'none',
            }}
          >
            {!notif.isRead && (
              <button
                onClick={e => { e.stopPropagation(); onRead(notif.id); }}
                title="Mark as read"
                style={{
                  width: 32, height: 32, borderRadius: 10,
                  background: darkMode ? `rgba(${pRgb},0.12)` : `rgba(${pRgb},0.08)`,
                  border: `1px solid rgba(${pRgb},0.2)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}
              >
                <Check size={14} color={`rgb(${pRgb})`} />
              </button>
            )}
            <button
              onClick={e => { e.stopPropagation(); triggerDelete(); }}
              title="Delete"
              style={{
                width: 32, height: 32, borderRadius: 10,
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}
            >
              <Trash2 size={14} color="#ef4444" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────
// Confirm dialog — iOS bottom sheet
// ─────────────────────────────────────────

const ConfirmDialog: React.FC<{
  darkMode: boolean;
  title: string; message: string;
  confirmLabel: string; confirmColor: string;
  onConfirm: () => void; onCancel: () => void;
}> = ({ darkMode, title, message, confirmLabel, confirmColor, onConfirm, onCancel }) => (
  <div
    onClick={onCancel}
    style={{
      position: 'fixed', inset: 0, zIndex: 400,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)',
    }}
  >
    <div onClick={e => e.stopPropagation()} style={{
      background: darkMode ? '#13161f' : '#ffffff',
      border: `1px solid ${darkMode ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.08)'}`,
      borderRadius: '24px 24px 0 0',
      padding: '20px 24px 44px',
      width: '100%', maxWidth: 520,
      boxShadow: '0 -16px 48px rgba(0,0,0,0.25)',
      animation: 'nsheet 0.28s cubic-bezier(0.34,1.15,0.64,1)',
      boxSizing: 'border-box' as any,
    }}>
      <div style={{
        width: 36, height: 4, borderRadius: 2,
        background: darkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
        margin: '0 auto 20px',
      }} />
      <div style={{
        width: 52, height: 52, borderRadius: 16,
        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
      }}>
        <Trash2 size={24} color="#ef4444" />
      </div>
      <p style={{ fontSize: 17, fontWeight: 700, color: darkMode ? '#f1f5f9' : '#111827', margin: '0 0 8px' }}>
        {title}
      </p>
      <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 24px', lineHeight: 1.6 }}>
        {message}
      </p>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onCancel} style={{
          flex: 1, height: 50, borderRadius: 14, cursor: 'pointer',
          background: darkMode ? 'rgba(255,255,255,0.07)' : '#f1f5f9',
          border: darkMode ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(0,0,0,0.09)',
          color: darkMode ? '#94a3b8' : '#6b7280',
          fontSize: 15, fontWeight: 600, fontFamily: "'Outfit',sans-serif",
        }}>Cancel</button>
        <button onClick={onConfirm} style={{
          flex: 1, height: 50, borderRadius: 14, cursor: 'pointer',
          background: confirmColor, border: 'none', color: '#fff',
          fontSize: 15, fontWeight: 700, fontFamily: "'Outfit',sans-serif",
          boxShadow: `0 4px 16px ${confirmColor}55`,
        }}>{confirmLabel}</button>
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────

const NotificationsPage: React.FC = () => {
  const { user, isAuthenticated, theme, primaryColor, accentColor } = useDashboard();

  const darkMode = theme !== 'light';
  const pRgb     = hexRgb(primaryColor);
  const gradient = `linear-gradient(135deg, ${primaryColor} 0%, ${accentColor ?? primaryColor} 100%)`;

  const [notifications, setNotifications]       = useState<AppNotification[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [syncing, setSyncing]                   = useState(false);
  const [activeTab, setActiveTab]               = useState<FilterTab>('all');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showHint, setShowHint]                 = useState(false);
  const [isMobile, setIsMobile]                 = useState(window.innerWidth < 768);
  const [notifPrefs, setNotifPrefs]             = useState<Record<string, boolean>>({});
  const hintShownRef = useRef(false);

  // ── Filter tab swipe ──
  const tabsRef    = useRef<HTMLDivElement>(null);
  const tabDragRef = useRef<{ startX: number; scrollLeft: number; active: boolean }>({
    startX: 0, scrollLeft: 0, active: false,
  });

  const onTabTouchStart = (e: React.TouchEvent) => {
    const el = tabsRef.current;
    if (!el) return;
    tabDragRef.current = { startX: e.touches[0].pageX, scrollLeft: el.scrollLeft, active: true };
  };
  const onTabTouchMove = (e: React.TouchEvent) => {
    if (!tabDragRef.current.active || !tabsRef.current) return;
    tabsRef.current.scrollLeft = tabDragRef.current.scrollLeft + (tabDragRef.current.startX - e.touches[0].pageX);
  };
  const onTabTouchEnd = () => { tabDragRef.current.active = false; };

  useEffect(() => {
    const container = tabsRef.current;
    if (!container) return;
    const btn = container.querySelector('[data-active="true"]') as HTMLElement | null;
    btn?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeTab]);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  // Show swipe hint once
  useEffect(() => {
    if (isMobile && !loading && !hintShownRef.current && notifications.length > 0) {
      hintShownRef.current = true;
      setShowHint(true);
      const t = setTimeout(() => setShowHint(false), 4500);
      return () => clearTimeout(t);
    }
  }, [isMobile, loading, notifications.length]);

  useEffect(() => {
    if (!isAuthenticated || !user?.uid) return;
    setLoading(true);
    const timeout = setTimeout(() => setLoading(false), 3000);
    const unsub = notificationService.subscribeToNotifications(
      user.uid,
      notifs => { clearTimeout(timeout); setNotifications(notifs); setLoading(false); },
      ()      => { clearTimeout(timeout); setLoading(false); }
    );
    return () => { clearTimeout(timeout); unsub(); };
  }, [isAuthenticated, user?.uid]);

  useEffect(() => {
    if (!isAuthenticated || !user?.uid) return;
    const sync = async () => {
      setSyncing(true);
      await notificationService.syncAnnouncementsAsNotifications(
        user.uid, user.role ?? 'student', (user as any).enrolledCourseIds ?? []
      );
      notificationService.purgeTransient(user.uid);
      setSyncing(false);
    };
    sync();
    getUserNotificationSettings(user.uid).then(prefs => {
      if (prefs) setNotifPrefs(prefs as unknown as Record<string, boolean>);
    }).catch(() => {});
  }, [isAuthenticated, user?.uid]);

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, []);

  const handleMarkRead    = useCallback(async (id: string) => { await notificationService.markAsRead(id); }, []);
  const handleMarkAllRead = useCallback(async () => { if (user?.uid) await notificationService.markAllAsRead(user.uid); }, [user?.uid]);
  const handleDelete      = useCallback(async (id: string) => { await notificationService.deleteNotification(id); }, []);
  const handleClearAll    = useCallback(async () => {
    if (!user?.uid) return;
    setShowClearConfirm(false);
    await notificationService.clearAllNotifications(user.uid);
  }, [user?.uid]);

  const isMutedByPrefs = useCallback((n: AppNotification): boolean => {
    const rt = (n.metadata?.relatedType as string) ?? n.relatedType ?? '';
    if (rt === 'announcement'     && notifPrefs.notifyAnnouncements        === false) return true;
    if (rt === 'courseEnrollment' && notifPrefs.notifyCourseEnrollment     === false) return true;
    if (rt === 'qa'               && notifPrefs.notifyQaAnswers            === false) return true;
    if (rt === 'taskGroup'        && notifPrefs.notifyTaskAssigned         === false) return true;
    if (rt === 'task'             && notifPrefs.notifyTaskEvaluation       === false) return true;
    if (rt === 'exam'             && notifPrefs.notifyExamResults          === false) return true;
    if (['studyGoal','studySchedule','streakFreeze'].includes(rt) && notifPrefs.notifyStudyPlan === false) return true;
    if (['earlyAccess','featureRequest'].includes(rt) && notifPrefs.notifyEarlyAccess === false) return true;
    if (rt === 'comingSoon' && notifPrefs.notifyNewComingSoonFeatures === false) return true;
    return false;
  }, [notifPrefs]);

  const filtered = useMemo(() => notifications.filter(n => {
    if (isMutedByPrefs(n)) return false;
    if (activeTab === 'all')    return true;
    if (activeTab === 'unread') return !n.isRead;
    return n.type === activeTab;
  }), [notifications, activeTab, isMutedByPrefs]);

  const unreadCount = useMemo(() => notifications.filter(n => !n.isRead).length, [notifications]);

  return (
    <div style={{
      fontFamily: "'Outfit', sans-serif",
      padding: isMobile ? '0 0 100px' : '0 0 40px',
      display: 'flex', flexDirection: 'column', gap: 12,
      width: '100%', boxSizing: 'border-box' as any,
      overflowX: 'hidden',
    }}>

      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 8, flexWrap: 'wrap',
        padding: isMobile ? '0 14px' : '0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
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
              fontSize: isMobile ? 18 : 21, fontWeight: 800,
              color: darkMode ? '#f1f5f9' : '#111827',
              margin: 0, lineHeight: 1.2,
            }}>Notifications</h1>
            <p style={{ color: '#64748b', margin: 0, fontSize: 11.5,
              display: 'flex', alignItems: 'center', gap: 4 }}>
              {syncing
                ? <><RefreshCw size={10} style={{ animation: 'nspin 1.2s linear infinite' }} /> Syncing…</>
                : unreadCount > 0 ? `${unreadCount} unread` : 'All caught up ✓'}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {unreadCount > 0 && (
            <button onClick={handleMarkAllRead} style={{
              height: 36, padding: '0 10px', borderRadius: 10,
              background: darkMode ? `rgba(${pRgb},0.14)` : `rgba(${pRgb},0.09)`,
              border: `1px solid rgba(${pRgb},0.25)`,
              display: 'flex', alignItems: 'center', gap: 5,
              cursor: 'pointer', color: `rgb(${pRgb})`,
              fontSize: 12, fontWeight: 700,
              fontFamily: "'Outfit',sans-serif", whiteSpace: 'nowrap' as any,
            }}>
              <CheckCheck size={13} />
              {isMobile ? 'Read all' : 'Mark all read'}
            </button>
          )}
          {notifications.length > 0 && (
            <button onClick={() => setShowClearConfirm(true)} style={{
              height: 36, padding: '0 10px', borderRadius: 10,
              background: 'rgba(239,68,68,0.09)', border: '1px solid rgba(239,68,68,0.22)',
              display: 'flex', alignItems: 'center', gap: 5,
              cursor: 'pointer', color: '#ef4444',
              fontSize: 12, fontWeight: 700,
              fontFamily: "'Outfit',sans-serif", whiteSpace: 'nowrap' as any,
            }}>
              <Trash2 size={13} />
              {isMobile ? 'Clear' : 'Clear all'}
            </button>
          )}
        </div>
      </div>

      {/* ── Filter tabs ── */}
      <div style={{
        borderRadius: isMobile ? 0 : 14,
        background: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
        border: `1px solid ${darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`,
        padding: '7px 10px',
      }}>
        <div
          ref={tabsRef}
          className="np-scrollable"
          onTouchStart={onTabTouchStart}
          onTouchMove={onTabTouchMove}
          onTouchEnd={onTabTouchEnd}
          style={{
            display: 'flex', gap: 5,
            overflowX: 'auto', WebkitOverflowScrolling: 'touch',
            scrollBehavior: 'smooth', userSelect: 'none' as any,
          }}
        >
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            const count =
              tab.id === 'unread' ? unreadCount
              : tab.id === 'all'  ? notifications.filter(n => !isMutedByPrefs(n)).length
              : notifications.filter(n => !isMutedByPrefs(n) && n.type === tab.id).length;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                data-active={isActive ? 'true' : 'false'}
                style={{
                  height: 32, padding: '0 11px',
                  borderRadius: 99, flexShrink: 0,
                  background: isActive
                    ? darkMode ? `rgba(${pRgb},0.22)` : `rgba(${pRgb},0.12)`
                    : 'transparent',
                  border: isActive
                    ? `1px solid rgba(${pRgb},0.35)` : '1px solid transparent',
                  color: isActive ? `rgb(${pRgb})` : darkMode ? '#64748b' : '#6b7280',
                  fontSize: 12, fontWeight: isActive ? 700 : 500,
                  fontFamily: "'Outfit',sans-serif",
                  cursor: 'pointer', transition: 'all 0.18s ease',
                  display: 'flex', alignItems: 'center', gap: 5,
                  whiteSpace: 'nowrap' as any,
                }}
              >
                {tab.label}
                {count > 0 && (
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    background: isActive ? `rgb(${pRgb})` : darkMode ? 'rgba(255,255,255,0.13)' : 'rgba(0,0,0,0.1)',
                    color: isActive ? '#fff' : darkMode ? '#94a3b8' : '#6b7280',
                    padding: '1px 6px', borderRadius: 99, lineHeight: '16px',
                  }}>
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Swipe hint (mobile, shows once) ── */}
      {showHint && (
        <div
          onClick={() => setShowHint(false)}
          style={{
            margin: isMobile ? '0 14px' : '0',
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', borderRadius: 12,
            background: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
            border: darkMode ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.07)',
            cursor: 'pointer', animation: 'nslide 0.3s ease both',
          }}
        >
          <span style={{ fontSize: 18 }}>👈</span>
          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500, flex: 1 }}>
            Swipe left to mark read or delete
          </span>
          <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Got it</span>
        </div>
      )}

      {/* ── Notification list ── */}
      <div style={{ padding: isMobile ? '0 10px' : '0' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} darkMode={darkMode} />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState darkMode={darkMode} pRgb={pRgb} filter={activeTab} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map((notif, i) => (
              <NotifCard
                key={notif.id}
                notif={notif}
                darkMode={darkMode}
                pRgb={pRgb}
                onRead={handleMarkRead}
                onDelete={handleDelete}
                index={i}
              />
            ))}
            {filtered.length >= 10 && (
              <p style={{
                textAlign: 'center', padding: '12px 0 4px',
                fontSize: 12, color: '#64748b', fontWeight: 500,
              }}>
                — {filtered.length} notifications —
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Clear confirm sheet ── */}
      {showClearConfirm && (
        <ConfirmDialog
          darkMode={darkMode}
          title="Clear all notifications?"
          message="This will permanently delete all your notifications. This action cannot be undone."
          confirmLabel="Clear all"
          confirmColor="#ef4444"
          onConfirm={handleClearAll}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}

      <style>{`
        @keyframes nslide {
          from { opacity: 0; transform: translateY(10px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        @keyframes npulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
        @keyframes nspin {
          from { transform: rotate(0deg);   }
          to   { transform: rotate(360deg); }
        }
        @keyframes nsheet {
          from { transform: translateY(100%); }
          to   { transform: translateY(0);    }
        }
        .np-scrollable::-webkit-scrollbar { display: none; }
        .np-scrollable { -ms-overflow-style: none; scrollbar-width: none; -webkit-overflow-scrolling: touch; }

        /* Hide desktop hover actions on touch-only devices */
        @media (hover: none) and (pointer: coarse) {
          .notif-desktop-actions { display: none !important; }
        }
      `}</style>
    </div>
  );
};

export default NotificationsPage;
