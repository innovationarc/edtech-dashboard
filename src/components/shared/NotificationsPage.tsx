/**
 * NotificationsPage.tsx
 * – Real-time Firestore subscription
 * – Announcement sync on mount
 * – Filter tabs: All · Unread · Announcements · Assignments · Reminders · Urgent · Grades
 * – Mark all read, clear all (with confirmation)
 * – Per-notification read toggle + delete (always visible on mobile, hover on desktop)
 * – Fully responsive, dark-mode aware, matches Navigation.tsx design system
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Bell, BellOff, Megaphone, BookOpen, Clock, AlertTriangle,
  Star, Cpu, Check, CheckCheck, Trash2, RefreshCw, Inbox,
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
  return `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`;
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
    justifyContent: 'center', gap: 16, padding: '72px 32px',
    textAlign: 'center',
  }}>
    <div style={{
      width: 88, height: 88, borderRadius: 28,
      background: darkMode ? `rgba(${pRgb},0.10)` : `rgba(${pRgb},0.08)`,
      border: `1.5px solid rgba(${pRgb},0.2)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      marginBottom: 4,
    }}>
      {filter === 'unread'
        ? <BellOff size={36} color={`rgba(${pRgb},0.55)`} strokeWidth={1.5} />
        : <Inbox   size={36} color={`rgba(${pRgb},0.55)`} strokeWidth={1.5} />
      }
    </div>
    <div>
      <p style={{ fontSize: 17, fontWeight: 700, color: darkMode ? '#e2e8f0' : '#111827', margin: 0 }}>
        {filter === 'unread' ? "You're all caught up!" : 'No notifications yet'}
      </p>
      <p style={{ fontSize: 14, color: '#64748b', margin: '8px 0 0', lineHeight: 1.6, maxWidth: 260 }}>
        {filter === 'unread'
          ? 'All your notifications have been read.'
          : 'Notifications from your courses and teachers will show up here.'}
      </p>
    </div>
  </div>
);

// ─────────────────────────────────────────
// Notification card
// ─────────────────────────────────────────

interface NotifCardProps {
  notif: AppNotification;
  darkMode: boolean;
  pRgb: string;
  isMobile: boolean;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
  index: number;
}

const NotifCard: React.FC<NotifCardProps> = ({ notif, darkMode, pRgb, isMobile, onRead, onDelete, index }) => {
  const [hovered, setHovered] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const cfg = TYPE_CONFIG[notif.type] ?? TYPE_CONFIG.system;
  const { Icon } = cfg;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleting(true);
    setTimeout(() => onDelete(notif.id), 280);
  };

  const showActions = isMobile || hovered;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => { if (!notif.isRead) onRead(notif.id); }}
      style={{
        display: 'flex', gap: 12, alignItems: 'flex-start',
        padding: isMobile ? '14px 14px' : '14px 16px',
        borderRadius: 16,
        cursor: notif.isRead ? 'default' : 'pointer',
        background: darkMode
          ? (notif.isRead ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)')
          : (notif.isRead ? '#ffffff' : '#fafbff'),
        border: `1px solid ${
          !notif.isRead
            ? darkMode ? `rgba(${pRgb},0.18)` : `rgba(${pRgb},0.14)`
            : darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'
        }`,
        boxShadow: !notif.isRead && !darkMode ? `0 2px 12px rgba(${pRgb},0.06)` : 'none',
        transition: 'all 0.2s ease',
        transform: deleting ? 'translateX(48px)' : 'none',
        opacity: deleting ? 0 : 1,
        animation: `nslide 0.3s cubic-bezier(0.34,1.25,0.64,1) ${index * 35}ms both`,
        position: 'relative',
      }}
    >
      {/* Unread left bar */}
      {!notif.isRead && (
        <span style={{
          position: 'absolute', left: 0, top: 14, bottom: 14,
          width: 3, borderRadius: '0 3px 3px 0',
          background: cfg.color,
          boxShadow: `0 0 8px ${cfg.color}55`,
        }} />
      )}

      {/* Icon */}
      <div style={{
        width: 44, height: 44, borderRadius: 14, flexShrink: 0,
        background: cfg.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: `1.5px solid ${cfg.color}28`,
        marginLeft: !notif.isRead ? 4 : 0,
        transition: 'margin 0.2s ease',
      }}>
        <Icon size={20} color={cfg.color} strokeWidth={2} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>

        {/* Title + time */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
          <p style={{
            fontSize: 13, fontWeight: notif.isRead ? 500 : 700, margin: 0,
            color: darkMode ? (notif.isRead ? '#94a3b8' : '#f1f5f9') : (notif.isRead ? '#6b7280' : '#111827'),
            lineHeight: 1.3,
            overflow: 'hidden', textOverflow: 'ellipsis',
            display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical',
          }}>
            {notif.title}
          </p>
          <span style={{
            fontSize: 11, color: '#94a3b8', flexShrink: 0,
            marginTop: 1, fontWeight: 500, letterSpacing: '-0.01em',
          }}>
            {relativeTime(notif.createdAt)}
          </span>
        </div>

        {/* Message */}
        <p style={{
          fontSize: 13, color: darkMode ? '#64748b' : '#6b7280',
          margin: '5px 0 0', lineHeight: 1.55,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {notif.message}
        </p>

        {/* Chips row */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          <span style={{
            fontSize: 11, fontWeight: 600, color: cfg.color,
            background: cfg.bg, padding: '3px 9px', borderRadius: 99,
            border: `1px solid ${cfg.color}28`,
          }}>
            {cfg.label}
          </span>
          {notif.metadata?.teacherName && (
            <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>
              {notif.metadata.teacherName as string}
            </span>
          )}
          {notif.metadata?.courseName && (
            <span style={{
              fontSize: 11, color: '#94a3b8', fontWeight: 500,
              overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140, whiteSpace: 'nowrap',
            }}>
              · {notif.metadata.courseName as string}
            </span>
          )}
          {notif.priority === 'high' && (
            <span style={{
              fontSize: 11, fontWeight: 700, color: '#ef4444',
              background: 'rgba(239,68,68,0.1)', padding: '3px 9px', borderRadius: 99,
              border: '1px solid rgba(239,68,68,0.2)',
            }}>
              High priority
            </span>
          )}
        </div>

        {/* Mobile action row — always visible */}
        {isMobile && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            {!notif.isRead && (
              <button
                onClick={e => { e.stopPropagation(); onRead(notif.id); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  height: 32, padding: '0 12px', borderRadius: 99,
                  background: darkMode ? `rgba(${pRgb},0.12)` : `rgba(${pRgb},0.08)`,
                  border: `1px solid rgba(${pRgb},0.2)`,
                  color: `rgb(${pRgb})`,
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  fontFamily: "'Outfit',sans-serif",
                }}
              >
                <Check size={13} /> Mark read
              </button>
            )}
            <button
              onClick={handleDelete}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                height: 32, padding: '0 12px', borderRadius: 99,
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.18)',
                color: '#ef4444',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                fontFamily: "'Outfit',sans-serif",
              }}
            >
              <Trash2 size={13} /> Delete
            </button>
          </div>
        )}
      </div>

      {/* Desktop hover actions */}
      {!isMobile && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0,
          opacity: showActions ? 1 : 0,
          transition: 'opacity 0.15s ease',
        }}>
          {!notif.isRead && (
            <button
              onClick={e => { e.stopPropagation(); onRead(notif.id); }}
              title="Mark as read"
              style={{
                width: 32, height: 32, borderRadius: 10,
                background: darkMode ? `rgba(${pRgb},0.12)` : `rgba(${pRgb},0.08)`,
                border: `1px solid rgba(${pRgb},0.2)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <Check size={14} color={`rgb(${pRgb})`} />
            </button>
          )}
          <button
            onClick={handleDelete}
            title="Delete"
            style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <Trash2 size={14} color="#ef4444" />
          </button>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────
// Confirm dialog — bottom sheet on all sizes
// ─────────────────────────────────────────

const ConfirmDialog: React.FC<{
  darkMode: boolean; pRgb: string;
  onConfirm: () => void; onCancel: () => void;
}> = ({ darkMode, pRgb, onConfirm, onCancel }) => (
  <div
    onClick={onCancel}
    style={{
      position: 'fixed', inset: 0, zIndex: 400,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)',
    }}
  >
    <div
      onClick={e => e.stopPropagation()}
      style={{
        background: darkMode ? '#13161f' : '#ffffff',
        border: `1px solid ${darkMode ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.08)'}`,
        borderRadius: '24px 24px 0 0',
        padding: '24px 24px 40px',
        width: '100%', maxWidth: 480,
        boxShadow: '0 -16px 48px rgba(0,0,0,0.25)',
        animation: 'nsheet 0.28s cubic-bezier(0.34,1.15,0.64,1)',
      }}
    >
      <div style={{ width: 36, height: 4, borderRadius: 2,
        background: darkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
        margin: '-8px auto 20px' }} />
      <div style={{
        width: 52, height: 52, borderRadius: 16,
        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
      }}>
        <Trash2 size={24} color="#ef4444" />
      </div>
      <p style={{ fontSize: 17, fontWeight: 700, color: darkMode ? '#f1f5f9' : '#111827', margin: '0 0 8px' }}>
        Clear all notifications?
      </p>
      <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 24px', lineHeight: 1.6 }}>
        This will permanently delete all your notifications and cannot be undone.
      </p>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onCancel} style={{
          flex: 1, height: 48, borderRadius: 14, cursor: 'pointer',
          background: darkMode ? 'rgba(255,255,255,0.07)' : '#f1f5f9',
          border: darkMode ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(0,0,0,0.09)',
          color: darkMode ? '#94a3b8' : '#6b7280',
          fontSize: 14, fontWeight: 600, fontFamily: "'Outfit',sans-serif",
        }}>
          Cancel
        </button>
        <button onClick={onConfirm} style={{
          flex: 1, height: 48, borderRadius: 14, cursor: 'pointer',
          background: '#ef4444', border: 'none', color: '#fff',
          fontSize: 14, fontWeight: 700, fontFamily: "'Outfit',sans-serif",
          boxShadow: '0 4px 16px rgba(239,68,68,0.35)',
        }}>
          Clear all
        </button>
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
  const pRgb = hexRgb(primaryColor);
  const gradient = `linear-gradient(135deg, ${primaryColor} 0%, ${accentColor ?? primaryColor} 100%)`;

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // Real-time subscription — with 3s timeout so loading never hangs forever
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

  // Sync announcements on mount + purge transient notifications older than 24h
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
    // Load notification preferences
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

  // Map relatedType → notifPrefs key
  const isMutedByPrefs = (n: AppNotification): boolean => {
    const rt = n.metadata?.relatedType as string ?? n.relatedType ?? '';
    if (rt === 'announcement'  && notifPrefs.notifyAnnouncements    === false) return true;
    if (rt === 'courseEnrollment' && notifPrefs.notifyCourseEnrollment === false) return true;
    if (rt === 'qa'            && notifPrefs.notifyQaAnswers         === false) return true;
    if (rt === 'taskGroup'     && notifPrefs.notifyTaskAssigned      === false) return true;
    if (rt === 'task'          && notifPrefs.notifyTaskEvaluation    === false) return true;
    if (rt === 'exam'          && notifPrefs.notifyExamResults       === false) return true;
    if ((rt === 'studyGoal' || rt === 'studySchedule' || rt === 'streakFreeze') && notifPrefs.notifyStudyPlan === false) return true;
    if ((rt === 'earlyAccess' || rt === 'featureRequest') && notifPrefs.notifyEarlyAccess === false) return true;
    if (rt === 'comingSoon' && notifPrefs.notifyNewComingSoonFeatures === false) return true;
    return false;
  };

  const filtered = notifications.filter(n => {
    if (isMutedByPrefs(n)) return false;
    if (activeTab === 'all')    return true;
    if (activeTab === 'unread') return !n.isRead;
    return n.type === activeTab;
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="space-y-4 pb-6" style={{ fontFamily: "'Outfit', sans-serif" }}>

      {/* ── Header row ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div style={{
            width: 36, height: 36, borderRadius: 11, background: gradient, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 4px 12px rgba(${pRgb},0.35)`,
          }}>
            <Bell size={17} color="#fff" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: darkMode ? '#f1f5f9' : '#111827', margin: 0 }}>
              Notifications
            </h1>
            <p className="text-xs" style={{ color: '#64748b', margin: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
              {syncing
                ? <><RefreshCw size={11} style={{ animation: 'nspin 1.2s linear infinite' }} /> Syncing…</>
                : unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button onClick={handleMarkAllRead} style={{
              height: 34, padding: '0 12px', borderRadius: 10,
              background: darkMode ? `rgba(${pRgb},0.13)` : `rgba(${pRgb},0.08)`,
              border: `1px solid rgba(${pRgb},0.22)`,
              display: 'flex', alignItems: 'center', gap: 6,
              cursor: 'pointer', color: `rgb(${pRgb})`,
              fontSize: 12, fontWeight: 700, fontFamily: "'Outfit',sans-serif", whiteSpace: 'nowrap',
            }}>
              <CheckCheck size={14} />
              <span className="hidden sm:inline">Mark all read</span>
            </button>
          )}
          {notifications.length > 0 && (
            <button onClick={() => setShowClearConfirm(true)} title="Clear all" style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}>
              <Trash2 size={14} color="#ef4444" />
            </button>
          )}
        </div>
      </div>

      {/* ── Filter tabs ── */}
      <div className="np-hide-scrollbar" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          const count =
            tab.id === 'unread' ? unreadCount
            : tab.id === 'all'  ? notifications.filter(n => !isMutedByPrefs(n)).length
            : notifications.filter(n => !isMutedByPrefs(n) && n.type === tab.id).length;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              height: 32, padding: '0 12px', borderRadius: 99, flexShrink: 0,
              background: isActive
                ? darkMode ? `rgba(${pRgb},0.18)` : `rgba(${pRgb},0.1)`
                : darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
              border: isActive
                ? `1px solid rgba(${pRgb},0.3)`
                : darkMode ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.08)',
              color: isActive ? `rgb(${pRgb})` : darkMode ? '#64748b' : '#6b7280',
              fontSize: 12, fontWeight: isActive ? 700 : 500,
              fontFamily: "'Outfit',sans-serif",
              cursor: 'pointer', transition: 'all 0.18s ease',
              display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
            }}>
              {tab.label}
              {count > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  background: isActive ? `rgb(${pRgb})` : darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
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

      {/* ── Content ── */}
      <div>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} darkMode={darkMode} />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState darkMode={darkMode} pRgb={pRgb} filter={activeTab} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 8 : 6 }}>
            {filtered.map((notif, i) => (
              <NotifCard
                key={notif.id}
                notif={notif}
                darkMode={darkMode}
                pRgb={pRgb}
                isMobile={isMobile}
                onRead={handleMarkRead}
                onDelete={handleDelete}
                index={i}
              />
            ))}
            {filtered.length >= 10 && (
              <p style={{ textAlign: 'center', padding: '16px 0 0', fontSize: 12, color: '#64748b', fontWeight: 500 }}>
                — {filtered.length} notifications —
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Confirm Dialog ── */}
      {showClearConfirm && (
        <ConfirmDialog
          darkMode={darkMode} pRgb={pRgb}
          onConfirm={handleClearAll}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}

      <style>{`
        @keyframes nslide {
          from { opacity: 0; transform: translateY(10px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes npulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.45; }
        }
        @keyframes nspin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes nsheet {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        .np-hide-scrollbar::-webkit-scrollbar { display: none; }
        .np-hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default NotificationsPage;
