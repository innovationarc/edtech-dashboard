// src/pages/LiveExam.tsx
// Production-grade Live Exam Management Page
// Roles: admin/manager/teacher → create & manage | student → view & attempt

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Clock, Users, BookOpen, Calendar, ChevronRight,
  MoreVertical, Play, Pause, Trash2, Edit3, Eye, X, Check,
  AlertCircle, Loader2, Radio, GraduationCap, RefreshCw,
  BarChart2, Filter, ArrowLeft, CheckCircle2, XCircle,
  Zap, Target, TrendingUp, ChevronDown, Globe, BookMarked,
} from 'lucide-react';
import { useDashboard } from '../contexts/DashboardContext';
import { contentService, Content } from '../services/contentService';
import { liveExamService, LiveExam, LiveExamAttemptRecord } from '../services/liveExamService';
import courseEnrollmentService from '../services/courseEnrollmentService';


// ─── Theme tokens (mirrors Progress.tsx / app pattern) ────────────────────────
const useT = () => {
  const { theme, primaryColor } = useDashboard();
  const isLight = theme === 'light';
  return {
    isLight,
    primary:  primaryColor,
    text:     isLight ? '#111827'                : 'var(--color-text, rgba(255,255,255,0.88))',
    text2:    isLight ? '#6b7280'                : 'var(--color-text2, rgba(255,255,255,0.45))',
    text3:    isLight ? '#9ca3af'                : 'rgba(255,255,255,0.28)',
    border:   isLight ? 'rgba(0,0,0,0.08)'      : 'var(--color-border, rgba(255,255,255,0.07))',
    surface:  isLight ? 'rgba(0,0,0,0.04)'      : 'var(--color-surface, rgba(255,255,255,0.04))',
    cardBg:   isLight ? 'rgba(255,255,255,0.9)'  : 'var(--color-card, rgba(255,255,255,0.04))',
    inputBg:  isLight ? 'rgba(0,0,0,0.04)'      : 'rgba(255,255,255,0.06)',
    danger:   '#ef4444',
    green:    '#10b981',
    gold:     '#f59e0b',
    purple:   '#8b5cf6',
  };
};
// ─── Helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (iso?: string) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const fmtRelative = (d: Date) => {
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const isLive = (exam: LiveExam): boolean => {
  if (exam.status !== 'active') return false;
  if (exam.liveWindowType === 'anytime') return true;
  const now = new Date();
  const start = exam.liveWindowStart ? new Date(exam.liveWindowStart) : null;
  const end = exam.liveWindowEnd ? new Date(exam.liveWindowEnd) : null;
  if (start && now < start) return false;
  if (end && now > end) return false;
  return true;
};

// Returns true if the exam is currently live OR starts within the next 48 hours
const isWithin48Hours = (exam: LiveExam): boolean => {
  if (exam.status !== 'active') return false;
  if (exam.liveWindowType === 'anytime') return true;
  const now = new Date();
  const cutoff = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const start = exam.liveWindowStart ? new Date(exam.liveWindowStart) : null;
  const end = exam.liveWindowEnd ? new Date(exam.liveWindowEnd) : null;
  if (end && now > end) return false;
  if (start && start > cutoff) return false;
  return true;
};

// Format seconds into countdown string
const fmtCountdown = (totalSeconds: number): string => {
  if (totalSeconds <= 0) return 'Starting now';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

// Shows the live window label (not the content's exam timeline)
const getTimelineLabel = (exam: LiveExam): string => {
  if (exam.liveWindowType === 'anytime') return 'Always visible';
  const start = fmtDate(exam.liveWindowStart);
  const end = fmtDate(exam.liveWindowEnd);
  return `${start} → ${end}`;
};

const examTypeBadge: Record<string, { label: string; cls: string }> = {
  mcq: { label: 'MCQ', cls: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  written: { label: 'Written', cls: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  mixed: { label: 'Mixed', cls: 'bg-teal-500/20 text-teal-300 border-teal-500/30' },
};

// ─── Types ─────────────────────────────────────────────────────────────────────

interface FormState {
  name: string;
  contentId: string;
  audience: 'all' | 'course_based';
  selectedCourseIds: string[];
  liveWindowType: 'anytime' | 'scheduled';
  liveWindowStart: string;
  liveWindowEnd: string;
}

const DEFAULT_FORM: FormState = {
  name: '',
  contentId: '',
  audience: 'all',
  selectedCourseIds: [],
  liveWindowType: 'anytime',
  liveWindowStart: '',
  liveWindowEnd: '',
};

// ─── Status Badge ───────────────────────────────────────────────────────────────

const StatusBadge = ({ exam }: { exam: LiveExam }) => {
  if (exam.status === 'ended') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: 'rgba(107,114,128,0.2)', color: '#9ca3af', border: '1px solid rgba(107,114,128,0.3)' }}>
        <XCircle size={10} /> Ended
      </span>
    );
  }
  if (!isLive(exam)) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.25)' }}>
        <Clock size={10} /> Scheduled
      </span>
    );
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.25)', animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' }}>
      <Radio size={10} /> Live
    </span>
  );
};

// ─── Exam Card (Admin/Teacher) ──────────────────────────────────────────────────

const ExamCard = ({
  exam,
  onEdit,
  onDelete,
  onToggleStatus,
  onViewStats,
}: {
  exam: LiveExam;
  onEdit: (e: LiveExam) => void;
  onDelete: (e: LiveExam) => void;
  onToggleStatus: (e: LiveExam) => void;
  onViewStats: (e: LiveExam) => void;
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const T = useT();
  const badge = exam.contentExamType ? examTypeBadge[exam.contentExamType] : null;

  return (
    <div style={{ position: 'relative', background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, fontFamily: "'DM Sans','Outfit',sans-serif" }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const, marginBottom: 4 }}>
            <StatusBadge exam={exam} />
            {badge && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${badge.cls}`}>
                {badge.label}
              </span>
            )}
            {exam.audience === 'all' ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: `${T.primary}18`, color: T.primary, border: `1px solid ${T.primary}30` }}>
                <Globe size={10} /> All Students
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: 'rgba(249,115,22,0.15)', color: '#fb923c', border: '1px solid rgba(249,115,22,0.25)' }}>
                <BookMarked size={10} /> {exam.courseTargets.length} Course{exam.courseTargets.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <h3 style={{ color: T.text, fontWeight: 600, fontSize: 14, lineHeight: 1.35, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exam.name}</h3>
          <p style={{ color: T.text2, fontSize: 12, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
            <BookOpen size={12} style={{ opacity: 0.7, flexShrink: 0 }} />
            {exam.contentTitle}
            {exam.contentSubject && <span style={{ color: T.text3 }}> · {exam.contentSubject}</span>}
          </p>
        </div>

        {/* Context menu */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setMenuOpen((v) => !v)} style={{ padding: 6, color: T.text2, background: 'none', border: 'none', cursor: 'pointer', borderRadius: 8, display: 'flex' }}>
            <MoreVertical size={16} />
          </button>
          {menuOpen && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setMenuOpen(false)} />
              <div style={{ position: 'absolute', right: 0, top: 32, zIndex: 20, width: 176, background: T.isLight ? '#fff' : '#1e1e2e', border: `1px solid ${T.border}`, borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
                {[
                  { icon: <BarChart2 size={14} />, label: 'View Stats', action: () => { setMenuOpen(false); onViewStats(exam); } },
                  { icon: <Edit3 size={14} />, label: 'Edit', action: () => { setMenuOpen(false); onEdit(exam); } },
                  { icon: exam.status === 'active' ? <Pause size={14} /> : <Play size={14} />, label: exam.status === 'active' ? 'End Exam' : 'Reactivate', action: () => { setMenuOpen(false); onToggleStatus(exam); } },
                ].map(({ icon, label, action }) => (
                  <button key={label} onClick={action} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 12px', fontSize: 13, color: T.text2, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' as const }}>
                    {icon} {label}
                  </button>
                ))}
                <div style={{ borderTop: `1px solid ${T.border}` }} />
                <button onClick={() => { setMenuOpen(false); onDelete(exam); }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 12px', fontSize: 13, color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' as const }}>
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
        {[
          { label: 'Participants', value: exam.totalParticipants },
          { label: 'Attempts', value: exam.totalAttempts },
          { label: 'Max Attempts', value: exam.maxAttempts === 'unlimited' ? '∞' : exam.maxAttempts },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: T.surface, borderRadius: 8, padding: '8px 10px', textAlign: 'center' as const }}>
            <p style={{ fontSize: 16, fontWeight: 800, color: T.text, margin: 0, lineHeight: 1 }}>{value}</p>
            <p style={{ fontSize: 10, color: T.text3, margin: '3px 0 0' }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Timeline */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: T.text3 }}>
        <Clock size={11} />
        <span>{getTimelineLabel(exam)}</span>
        <span style={{ marginLeft: 'auto' }}>{fmtRelative(exam.createdAt)}</span>
      </div>
    </div>
  );
};

// ─── Student Exam Card ──────────────────────────────────────────────────────────

const StudentExamCard = ({
  exam,
  attemptRecord,
  onAttempt,
}: {
  exam: LiveExam;
  attemptRecord?: LiveExamAttemptRecord | null;
  onAttempt: (e: LiveExam) => void;
}) => {
  const live = isLive(exam);
  const attemptCount = attemptRecord?.attemptCount ?? 0;
  const remaining = exam.maxAttempts === 'unlimited'
    ? '∞'
    : Math.max(0, (exam.maxAttempts as number) - attemptCount);
  const canAttempt = live && (exam.maxAttempts === 'unlimited' || (exam.maxAttempts as number) > attemptCount);
  const badge = exam.contentExamType ? examTypeBadge[exam.contentExamType] : null;

  // Countdown to start (only for upcoming scheduled exams)
  const isUpcoming = !live && exam.status === 'active' && exam.liveWindowType === 'scheduled' && exam.liveWindowStart;
  const [countdown, setCountdown] = useState<number>(
    isUpcoming ? Math.max(0, Math.floor((new Date(exam.liveWindowStart!).getTime() - Date.now()) / 1000)) : 0
  );

  useEffect(() => {
    if (!isUpcoming) return;
    const tick = () => {
      const secs = Math.max(0, Math.floor((new Date(exam.liveWindowStart!).getTime() - Date.now()) / 1000));
      setCountdown(secs);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isUpcoming, exam.liveWindowStart]);

  const T = useT();
  const borderColor = live ? 'rgba(16,185,129,0.3)' : isUpcoming ? 'rgba(245,158,11,0.3)' : T.border;

  return (
    <div style={{ background: T.cardBg, border: `1px solid ${borderColor}`, borderRadius: 12, padding: 20, fontFamily: "'DM Sans','Outfit',sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const, marginBottom: 6 }}>
            <StatusBadge exam={exam} />
            {badge && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${badge.cls}`}>
                {badge.label}
              </span>
            )}
          </div>
          <h3 style={{ color: T.text, fontWeight: 600, fontSize: 14, lineHeight: 1.35, margin: 0 }}>{exam.name}</h3>
          <p style={{ color: T.text2, fontSize: 12, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
            <BookOpen size={12} style={{ opacity: 0.7, flexShrink: 0 }} />
            {exam.contentTitle}
          </p>
        </div>
        {attemptRecord?.bestPercentage !== undefined && (
          <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
            <p style={{ fontSize: 16, fontWeight: 800, color: T.green, margin: 0, lineHeight: 1 }}>{Math.round(attemptRecord.bestPercentage)}%</p>
            <p style={{ fontSize: 10, color: T.text3, margin: '3px 0 0' }}>Best Score</p>
          </div>
        )}
      </div>

      {/* Countdown banner */}
      {isUpcoming && countdown > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, marginBottom: 12 }}>
          <Clock size={13} style={{ color: '#fbbf24', flexShrink: 0 }} />
          <span style={{ color: '#fcd34d', fontSize: 11, fontWeight: 600 }}>Starts in</span>
          <span style={{ color: '#fef3c7', fontSize: 11, fontWeight: 700, marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{fmtCountdown(countdown)}</span>
        </div>
      )}

      {/* Live window */}
      {exam.liveWindowType === 'scheduled' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: T.text3, marginBottom: 12 }}>
          <Calendar size={11} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getTimelineLabel(exam)}</span>
        </div>
      )}

      {/* Progress bar */}
      {exam.maxAttempts !== 'unlimited' && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.text3, marginBottom: 4 }}>
            <span>{attemptCount} attempt{attemptCount !== 1 ? 's' : ''} used</span>
            <span>{remaining} remaining</span>
          </div>
          <div style={{ height: 6, background: T.surface, borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: `linear-gradient(90deg, ${T.primary}, ${T.purple})`, borderRadius: 99, width: `${Math.min(100, (attemptCount / (exam.maxAttempts as number)) * 100)}%`, transition: 'width 0.6s ease' }} />
          </div>
        </div>
      )}

      <button
        onClick={() => onAttempt(exam)}
        disabled={!canAttempt}
        style={{
          width: '100%', padding: '10px 0', borderRadius: 8, fontSize: 13, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          border: canAttempt ? 'none' : isUpcoming ? '1px solid rgba(245,158,11,0.2)' : `1px solid ${T.border}`,
          background: canAttempt ? T.primary : isUpcoming ? 'rgba(245,158,11,0.1)' : T.surface,
          color: canAttempt ? '#fff' : isUpcoming ? '#fbbf24' : T.text3,
          cursor: canAttempt ? 'pointer' : 'not-allowed',
          fontFamily: "'DM Sans','Outfit',sans-serif",
        }}
      >
        {canAttempt ? (
          <><Zap size={14} /> {attemptCount === 0 ? 'Start Exam' : 'Attempt Again'}</>
        ) : isUpcoming ? (
          <><Clock size={14} /> Opens in {fmtCountdown(countdown)}</>
        ) : (
          exam.status === 'ended' ? <><XCircle size={14} /> Exam Ended</>
          : !live ? <><Clock size={14} /> Not Started Yet</>
          : <><Target size={14} /> Limit Reached</>
        )}
      </button>
    </div>
  );
};

// ─── Stats Modal ────────────────────────────────────────────────────────────────

const StatsModal = ({
  exam,
  onClose,
}: {
  exam: LiveExam;
  onClose: () => void;
}) => {
  const [records, setRecords] = useState<LiveExamAttemptRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    liveExamService.getAttemptRecords(exam.id).then((r) => {
      setRecords(r);
      setLoading(false);
    });
  }, [exam.id]);

  const filtered = records.filter((r) =>
    r.studentName.toLowerCase().includes(search.toLowerCase()) ||
    (r.studentEmail ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const avgBest = records.length
    ? Math.round(records.reduce((s, r) => s + (r.bestPercentage ?? 0), 0) / records.length)
    : 0;
  const T = useT();

  const modalBg = T.isLight ? '#fff' : '#13131f';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
      <div style={{ width: '100%', maxWidth: 640, background: modalBg, border: `1px solid ${T.border}`, borderRadius: 20, boxShadow: '0 24px 64px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', maxHeight: '90vh', fontFamily: "'DM Sans','Outfit',sans-serif" }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          <div>
            <h2 style={{ color: T.text, fontWeight: 700, fontSize: 16, margin: 0 }}>{exam.name}</h2>
            <p style={{ color: T.text2, fontSize: 12, margin: '2px 0 0' }}>Participant Statistics</p>
          </div>
          <button onClick={onClose} style={{ padding: 6, color: T.text2, background: 'none', border: 'none', cursor: 'pointer', borderRadius: 8, display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, padding: '16px 20px', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          {[
            { label: 'Participants', value: exam.totalParticipants, color: T.primary },
            { label: 'Total Attempts', value: exam.totalAttempts, color: T.purple },
            { label: 'Avg Best Score', value: `${avgBest}%`, color: T.green },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: T.surface, borderRadius: 10, padding: '10px 12px', textAlign: 'center' as const }}>
              <p style={{ fontSize: 22, fontWeight: 800, color, margin: 0, lineHeight: 1 }}>{value}</p>
              <p style={{ fontSize: 10, color: T.text3, margin: '4px 0 0' }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div style={{ padding: '12px 20px', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: T.text3, pointerEvents: 'none' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              style={{ width: '100%', paddingLeft: 36, paddingRight: 16, paddingTop: 8, paddingBottom: 8, background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }}
            />
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 0' }}>
              <Loader2 size={24} className="animate-spin" style={{ color: T.primary }} />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px 0', color: T.text3 }}>
              <Users size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
              <p style={{ margin: 0 }}>{records.length === 0 ? 'No participants yet' : 'No results for this search'}</p>
            </div>
          ) : (
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead style={{ background: T.surface, position: 'sticky', top: 0, zIndex: 10 }}>
                <tr>
                  <th style={{ textAlign: 'left', padding: '10px 20px', fontSize: 11, color: T.text2, fontWeight: 600 }}>Student</th>
                  <th style={{ textAlign: 'center', padding: '10px 12px', fontSize: 11, color: T.text2, fontWeight: 600 }}>Attempts</th>
                  <th style={{ textAlign: 'center', padding: '10px 12px', fontSize: 11, color: T.text2, fontWeight: 600 }}>Best Score</th>
                  <th style={{ textAlign: 'right', padding: '10px 20px', fontSize: 11, color: T.text2, fontWeight: 600 }}>Last Attempt</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} style={{ borderTop: `1px solid ${T.border}` }}>
                    <td style={{ padding: '12px 20px' }}>
                      <p style={{ color: T.text, fontWeight: 600, margin: 0 }}>{r.studentName}</p>
                      {r.studentEmail && <p style={{ color: T.text3, fontSize: 11, margin: '2px 0 0' }}>{r.studentEmail}</p>}
                    </td>
                    <td style={{ textAlign: 'center', padding: '12px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '50%', background: `${T.primary}20`, color: T.primary, fontWeight: 700, fontSize: 12 }}>
                        {r.attemptCount}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', padding: '12px' }}>
                      {r.bestPercentage !== undefined ? (
                        <span style={{ fontWeight: 600, color: r.bestPercentage >= 40 ? T.green : T.danger }}>{Math.round(r.bestPercentage)}%</span>
                      ) : <span style={{ color: T.text3 }}>—</span>}
                    </td>
                    <td style={{ textAlign: 'right', padding: '12px 20px', color: T.text3, fontSize: 11 }}>
                      {r.lastAttemptAt ? fmtRelative(r.lastAttemptAt) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Create / Edit Form Modal ───────────────────────────────────────────────────

const ExamFormModal = ({
  editing,
  onClose,
  onSave,
  currentUserId,
  currentUserName,
}: {
  editing?: LiveExam | null;
  onClose: () => void;
  onSave: () => void;
  currentUserId: string;
  currentUserName: string;
}) => {
  const [form, setForm] = useState<FormState>(
    editing
      ? {
          name: editing.name,
          contentId: editing.contentId,
          audience: editing.audience,
          selectedCourseIds: editing.courseTargets.map((c) => c.courseId),
          liveWindowType: editing.liveWindowType ?? 'anytime',
          liveWindowStart: editing.liveWindowStart ? editing.liveWindowStart.slice(0, 16) : '',
          liveWindowEnd: editing.liveWindowEnd ? editing.liveWindowEnd.slice(0, 16) : '',
        }
      : { ...DEFAULT_FORM }
  );

  const [examContents, setExamContents] = useState<Content[]>([]);
  const [courses, setCourses] = useState<Array<{ id: string; title: string }>>([]);
  const [loadingContents, setLoadingContents] = useState(true);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [contentSearch, setContentSearch] = useState('');
  const [showContentDropdown, setShowContentDropdown] = useState(false);

  // Fetch exam-type contents
  useEffect(() => {
    contentService.getContentByType('exam').then((all) => {
      setExamContents(all);
      setLoadingContents(false);
    });
  }, []);

  // Fetch courses when audience = course_based
  useEffect(() => {
    if (form.audience !== 'course_based') return;
    setLoadingCourses(true);
    courseEnrollmentService.getPublishedCourses?.().then((c: any[]) => {
      setCourses(c.map((x) => ({ id: x.id, title: x.title })));
      setLoadingCourses(false);
    }).catch(() => setLoadingCourses(false));
  }, [form.audience]);

  // When content is selected → store contentId; timeline & attempts come from content at save time
  const handleContentSelect = (content: Content) => {
    setForm((prev) => ({ ...prev, contentId: content.id }));
    setShowContentDropdown(false);
    setContentSearch('');
  };

  const selectedContent = examContents.find((c) => c.id === form.contentId);
  const filteredContents = examContents.filter((c) =>
    c.title.toLowerCase().includes(contentSearch.toLowerCase()) ||
    c.subject?.toLowerCase().includes(contentSearch.toLowerCase())
  );

  const toggleCourse = (id: string) => {
    setForm((prev) => ({
      ...prev,
      selectedCourseIds: prev.selectedCourseIds.includes(id)
        ? prev.selectedCourseIds.filter((x) => x !== id)
        : [...prev.selectedCourseIds, id],
    }));
  };

  const validate = (): string => {
    if (!form.name.trim()) return 'Exam name is required.';
    if (!form.contentId) return 'Please select an exam content.';
    if (form.audience === 'course_based' && form.selectedCourseIds.length === 0)
      return 'Select at least one course for course-based audience.';
    if (form.liveWindowType === 'scheduled') {
      if (!form.liveWindowStart) return 'Live window start date & time is required.';
      if (!form.liveWindowEnd) return 'Live window end date & time is required.';
      if (new Date(form.liveWindowStart) >= new Date(form.liveWindowEnd))
        return 'Live window end must be after start.';
    }
    return '';
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true);
    setError('');
    try {
      const courseTargets = form.audience === 'course_based'
        ? form.selectedCourseIds.map((id) => ({
            courseId: id,
            courseName: courses.find((c) => c.id === id)?.title ?? id,
          }))
        : [];

      const payload = {
        name: form.name.trim(),
        contentId: form.contentId,
        contentTitle: selectedContent?.title ?? '',
        contentSubject: selectedContent?.subject,
        contentExamType: selectedContent?.examType,
        audience: form.audience,
        courseTargets,
        // Content's own timeline — read-only, passed through unchanged
        examTimelineType: selectedContent?.examTimelineType ?? 'anytime',
        examStartDateTime: selectedContent?.examStartDateTime,
        examEndDateTime: selectedContent?.examEndDateTime,
        // Live window — controls when this exam is visible on the student live exam page
        liveWindowType: form.liveWindowType,
        liveWindowStart: form.liveWindowType === 'scheduled' && form.liveWindowStart
          ? new Date(form.liveWindowStart).toISOString()
          : undefined,
        liveWindowEnd: form.liveWindowType === 'scheduled' && form.liveWindowEnd
          ? new Date(form.liveWindowEnd).toISOString()
          : undefined,
        // Attempt limit still comes from the content
        maxAttempts: selectedContent?.maxAttempts === 'unlimited'
          ? 'unlimited' as const
          : Number(selectedContent?.maxAttempts ?? 1),
      };

      if (editing) {
        await liveExamService.updateLiveExam(editing.id, payload);
      } else {
        await liveExamService.createLiveExam({
          ...payload,
          createdBy: currentUserId,
          createdByName: currentUserName,
        });
      }
      onSave();
    } catch (e: any) {
      setError(e.message ?? 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const T = useT();
  const modalBg = T.isLight ? '#fff' : '#13131f';
  const inp: React.CSSProperties = { width: '100%', padding: '10px 14px', background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: 10, color: T.text, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: "'DM Sans','Outfit',sans-serif" };
  const lbl: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: T.text2, marginBottom: 6 };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
      <div style={{ width: '100%', maxWidth: 560, background: modalBg, border: `1px solid ${T.border}`, borderRadius: 20, boxShadow: '0 24px 64px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', maxHeight: '95vh', fontFamily: "'DM Sans','Outfit',sans-serif" }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${T.primary}18`, border: `1px solid ${T.primary}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Radio size={16} style={{ color: T.primary }} />
            </div>
            <div>
              <h2 style={{ color: T.text, fontWeight: 700, fontSize: 15, margin: 0 }}>{editing ? 'Edit Live Exam' : 'Create Live Exam'}</h2>
              <p style={{ color: T.text3, fontSize: 11, margin: '2px 0 0' }}>Configure and launch your exam</p>
            </div>
          </div>
          <button onClick={onClose} style={{ padding: 6, color: T.text2, background: 'none', border: 'none', cursor: 'pointer', borderRadius: 8, display: 'flex' }}><X size={18} /></button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Exam Name */}
          <div>
            <label style={lbl}>Exam Name <span style={{ color: T.danger }}>*</span></label>
            <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Mid-term Physics Live Exam" style={inp} />
          </div>

          {/* Content Selector */}
          <div>
            <label style={lbl}>
              Exam Content <span style={{ color: T.danger }}>*</span>
              <span style={{ color: T.text3, fontWeight: 400, marginLeft: 6, fontSize: 11 }}>(only exam-type contents shown)</span>
            </label>
            <div style={{ position: 'relative' }}>
              <button type="button" onClick={() => setShowContentDropdown((v) => !v)}
                style={{ ...inp, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, cursor: 'pointer', textAlign: 'left' as const }}>
                {selectedContent ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <BookOpen size={14} style={{ color: T.primary, flexShrink: 0 }} />
                    <span style={{ color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedContent.title}</span>
                    {selectedContent.subject && <span style={{ color: T.text3, fontSize: 11, flexShrink: 0 }}>· {selectedContent.subject}</span>}
                  </span>
                ) : <span style={{ color: T.text3 }}>Select exam content…</span>}
                <ChevronDown size={14} style={{ color: T.text3, flexShrink: 0, transform: showContentDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>

              {showContentDropdown && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setShowContentDropdown(false)} />
                  <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 20, background: T.isLight ? '#fff' : '#1a1a2e', border: `1px solid ${T.border}`, borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
                    <div style={{ padding: 8, borderBottom: `1px solid ${T.border}` }}>
                      <div style={{ position: 'relative' }}>
                        <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.text3, pointerEvents: 'none' }} />
                        <input autoFocus value={contentSearch} onChange={(e) => setContentSearch(e.target.value)} placeholder="Search content…"
                          style={{ ...inp, paddingLeft: 30, padding: '7px 10px 7px 30px' }} />
                      </div>
                    </div>
                    <div style={{ maxHeight: 208, overflowY: 'auto' }}>
                      {loadingContents ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 0' }}>
                          <Loader2 size={18} className="animate-spin" style={{ color: T.primary }} />
                        </div>
                      ) : filteredContents.length === 0 ? (
                        <div style={{ padding: '32px 0', textAlign: 'center', color: T.text3, fontSize: 13 }}>No exam contents found</div>
                      ) : filteredContents.map((c) => (
                        <button key={c.id} type="button" onClick={() => handleContentSelect(c)}
                          style={{ width: '100%', textAlign: 'left' as const, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 10, background: form.contentId === c.id ? `${T.primary}12` : 'none', border: 'none', cursor: 'pointer' }}>
                          <BookOpen size={14} style={{ color: form.contentId === c.id ? T.primary : T.text3, marginTop: 2, flexShrink: 0 }} />
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 500, color: form.contentId === c.id ? T.primary : T.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                              {c.subject && <span style={{ fontSize: 11, color: T.text3 }}>{c.subject}</span>}
                              {c.examType && <span className={`text-xs px-1.5 py-0.5 rounded-full border ${examTypeBadge[c.examType]?.cls ?? ''}`}>{examTypeBadge[c.examType]?.label}</span>}
                            </div>
                          </div>
                          {form.contentId === c.id && <CheckCircle2 size={14} style={{ color: T.primary, marginLeft: 'auto', flexShrink: 0 }} />}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Read-only content info */}
            {selectedContent && (
              <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  {
                    title: 'Exam Timeline',
                    content: selectedContent.examTimelineType === 'anytime'
                      ? <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: T.green }}><Zap size={13} /> Anytime</span>
                      : <div>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: T.gold }}><Calendar size={12} /> Scheduled</span>
                          {selectedContent.examStartDateTime && <p style={{ fontSize: 11, color: T.text2, margin: '2px 0 0' }}>{fmtDate(selectedContent.examStartDateTime)}</p>}
                          {selectedContent.examEndDateTime && <p style={{ fontSize: 11, color: T.text3, margin: 0 }}>→ {fmtDate(selectedContent.examEndDateTime)}</p>}
                        </div>
                  },
                  {
                    title: 'Attempt Limit',
                    content: <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: T.primary }}><Target size={13} />{selectedContent.maxAttempts === 'unlimited' ? '∞ Unlimited' : `${selectedContent.maxAttempts ?? 1}×`}</span>
                  },
                ].map(({ title, content }) => (
                  <div key={title} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 12px' }}>
                    <span style={{ fontSize: 10, color: T.text3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</span>
                    <div style={{ marginTop: 6 }}>{content}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Live Window */}
          <div>
            <label style={lbl}>Live Window</label>
            <p style={{ fontSize: 11, color: T.text3, margin: '0 0 10px' }}>Controls when this exam appears on the student's live exam page.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              {(['anytime', 'scheduled'] as const).map((opt) => (
                <button key={opt} type="button" onClick={() => setForm((p) => ({ ...p, liveWindowType: opt }))}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, border: `1px solid ${form.liveWindowType === opt ? T.primary : T.border}`, background: form.liveWindowType === opt ? `${T.primary}15` : T.surface, color: form.liveWindowType === opt ? T.primary : T.text2, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans','Outfit',sans-serif" }}>
                  {opt === 'anytime' ? <Zap size={14} /> : <Calendar size={14} />}
                  {opt === 'anytime' ? 'Always visible' : 'Scheduled window'}
                </button>
              ))}
            </div>
            {form.liveWindowType === 'scheduled' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Show from', key: 'liveWindowStart' as const },
                  { label: 'Hide after', key: 'liveWindowEnd' as const },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <label style={{ ...lbl, marginBottom: 4 }}>{label}</label>
                    <input type="datetime-local" value={form[key]} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))} style={inp} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Audience */}
          <div>
            <label style={lbl}>Exam Audience <span style={{ color: T.danger }}>*</span></label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {(['all', 'course_based'] as const).map((opt) => (
                <button key={opt} type="button" onClick={() => setForm((p) => ({ ...p, audience: opt, selectedCourseIds: [] }))}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, border: `1px solid ${form.audience === opt ? T.primary : T.border}`, background: form.audience === opt ? `${T.primary}15` : T.surface, color: form.audience === opt ? T.primary : T.text2, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans','Outfit',sans-serif" }}>
                  {opt === 'all' ? <Globe size={14} /> : <BookMarked size={14} />}
                  {opt === 'all' ? 'All Students' : 'Course-Based'}
                </button>
              ))}
            </div>
            {form.audience === 'course_based' && (
              <div style={{ marginTop: 10 }}>
                <p style={{ fontSize: 11, color: T.text3, margin: '0 0 8px' }}>Select courses to include:</p>
                {loadingCourses ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.text3, fontSize: 13 }}>
                    <Loader2 size={14} className="animate-spin" /> Loading courses…
                  </div>
                ) : courses.length === 0 ? (
                  <p style={{ fontSize: 12, color: T.text3, margin: 0 }}>No published courses found.</p>
                ) : (
                  <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {courses.map((c) => (
                      <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${form.selectedCourseIds.includes(c.id) ? T.primary + '40' : 'transparent'}`, background: form.selectedCourseIds.includes(c.id) ? `${T.primary}10` : 'transparent' }}>
                        <input type="checkbox" checked={form.selectedCourseIds.includes(c.id)} onChange={() => toggleCourse(c.id)} style={{ width: 14, height: 14, accentColor: T.primary }} />
                        <span style={{ fontSize: 13, color: T.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10 }}>
              <AlertCircle size={14} style={{ color: T.danger, flexShrink: 0, marginTop: 2 }} />
              <p style={{ color: '#fca5a5', fontSize: 13, margin: 0 }}>{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, padding: '14px 20px', borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '9px 20px', fontSize: 13, color: T.text2, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, cursor: 'pointer', fontFamily: "'DM Sans','Outfit',sans-serif" }}>Cancel</button>
          <button onClick={handleSave} disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 24px', fontSize: 13, fontWeight: 600, background: T.primary, color: '#fff', border: 'none', borderRadius: 10, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, fontFamily: "'DM Sans','Outfit',sans-serif" }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {editing ? 'Save Changes' : 'Create Live Exam'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ──────────────────────────────────────────────────────────────────

const LiveExamPage = () => {
  const { user } = useDashboard();
  const navigate = useNavigate();
  const isStaff = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'teacher';

  // ?highlight=<examId> — set by StudentDashboard when student taps a live exam
  const highlightId = new URLSearchParams(window.location.search).get('highlight') ?? '';
  const highlightRef = useRef<HTMLDivElement | null>(null);

  const [exams, setExams] = useState<LiveExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'ended'>('all');

  // Modal state
  const [showForm, setShowForm] = useState(false);
  const [editingExam, setEditingExam] = useState<LiveExam | null>(null);
  const [statsExam, setStatsExam] = useState<LiveExam | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<LiveExam | null>(null);

  // Student attempt records
  const [attemptMap, setAttemptMap] = useState<Record<string, LiveExamAttemptRecord | null>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (isStaff) {
        const all = await liveExamService.getAllLiveExams();
        setExams(all);
      } else if (user?.uid) {
        // For students — get enrolled course ids first
        let enrolledCourseIds: string[] = [];
        try {
          const { courseService } = await import('../services/courseService');
          enrolledCourseIds = (await courseService.getStudentEnrollments(user.uid)).map((e: any) => e.courseId);
        } catch {}
        const visible = await liveExamService.getLiveExamsForStudent(user.uid, enrolledCourseIds);

        // Students only see exams that are currently live OR start within 48 hours
        const within48h = visible.filter(isWithin48Hours);
        setExams(within48h);

        // Load attempt records for each
        const map: Record<string, LiveExamAttemptRecord | null> = {};
        await Promise.all(
          within48h.map(async (e) => {
            map[e.id] = await liveExamService.getStudentAttemptRecord(e.id, user.uid!);
          })
        );
        setAttemptMap(map);
      }
    } finally {
      setLoading(false);
    }
  }, [isStaff, user?.uid]);

  useEffect(() => { load(); }, [load]);

  // Scroll highlighted exam into view once loading completes
  useEffect(() => {
    if (!highlightId || loading) return;
    highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightId, loading]);

  const handleToggleStatus = async (exam: LiveExam) => {
    await liveExamService.setStatus(exam.id, exam.status === 'active' ? 'ended' : 'active');
    load();
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    await liveExamService.deleteLiveExam(deleteConfirm.id);
    setDeleteConfirm(null);
    load();
  };

  const handleAttempt = (exam: LiveExam) => {
    navigate(`/exam/${exam.contentId}?liveExamId=${exam.id}`);
  };

  // Filter
  const filtered = exams.filter((e) => {
    const matchSearch =
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.contentTitle.toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active' && e.status === 'active') ||
      (filterStatus === 'ended' && e.status === 'ended');
    return matchSearch && matchStatus;
  });

  // Summary stats (staff)
  const activeCount = exams.filter((e) => e.status === 'active').length;
  const totalParticipants = exams.reduce((s, e) => s + e.totalParticipants, 0);
  const totalAttempts = exams.reduce((s, e) => s + e.totalAttempts, 0);

  const T = useT();

  return (
    <div style={{ minHeight: '100vh', color: T.text, fontFamily: "'DM Sans','Outfit',sans-serif" }}>
      <div style={{ maxWidth: 1152, margin: '0 auto', padding: '0 0 40px' }}>

        {/* Page Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: `${T.primary}18`, border: `1px solid ${T.primary}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Radio size={15} style={{ color: T.primary }} />
              </div>
              <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: T.text }}>Live Exams</h1>
            </div>
            <p style={{ color: T.text2, fontSize: 13, margin: 0 }}>
              {isStaff ? 'Create and manage live exams for your students' : 'Live and upcoming exams in the next 48 hours'}
            </p>
          </div>
          {isStaff && (
            <button onClick={() => { setEditingExam(null); setShowForm(true); }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: T.primary, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0, fontFamily: "'DM Sans','Outfit',sans-serif" }}>
              <Plus size={15} /> Create Live Exam
            </button>
          )}
        </div>

        {/* Staff summary cards */}
        {isStaff && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Total Exams',       value: exams.length,       icon: BookOpen,   color: T.primary },
              { label: 'Currently Active',  value: activeCount,        icon: Radio,      color: T.green },
              { label: 'Total Participants',value: totalParticipants,  icon: Users,      color: T.purple },
              { label: 'Total Attempts',    value: totalAttempts,      icon: TrendingUp, color: T.gold },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} style={{ background: T.cardBg, border: `1px solid ${T.border}`, borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                  <Icon size={14} style={{ color }} />
                </div>
                <p style={{ fontSize: 22, fontWeight: 800, color: T.text, margin: 0, lineHeight: 1 }}>{value}</p>
                <p style={{ fontSize: 11, color: T.text3, margin: '3px 0 0' }}>{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Search & Filter */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' as const }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.text3, pointerEvents: 'none' }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search exams…"
              style={{ width: '100%', paddingLeft: 32, paddingRight: 14, paddingTop: 9, paddingBottom: 9, background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: 10, color: T.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }} />
          </div>
          {isStaff && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: 4 }}>
              {(['all', 'active', 'ended'] as const).map((s) => (
                <button key={s} onClick={() => setFilterStatus(s)}
                  style={{ padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer', background: filterStatus === s ? T.cardBg : 'none', color: filterStatus === s ? T.text : T.text2, textTransform: 'capitalize' as const, fontFamily: "'DM Sans','Outfit',sans-serif" }}>
                  {s}
                </button>
              ))}
            </div>
          )}
          <button onClick={load} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, color: T.text2, cursor: 'pointer' }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '96px 0', gap: 12 }}>
            <Loader2 size={28} className="animate-spin" style={{ color: T.primary }} />
            <p style={{ color: T.text3, fontSize: 13, margin: 0 }}>Loading exams…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '96px 0', gap: 16 }}>
            <div style={{ width: 64, height: 64, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Radio size={24} style={{ color: T.text3 }} />
            </div>
            <div style={{ textAlign: 'center' as const }}>
              <p style={{ color: T.text, fontWeight: 600, fontSize: 16, margin: 0 }}>
                {search || filterStatus !== 'all' ? 'No results found' : isStaff ? 'No live exams yet' : 'No exams in the next 48 hours'}
              </p>
              <p style={{ color: T.text3, fontSize: 13, margin: '6px 0 0' }}>
                {isStaff && !search && filterStatus === 'all' ? 'Create your first live exam to get started.'
                  : !isStaff && !search ? 'Check back soon — exams scheduled within 48 hours will appear here.'
                  : 'Try adjusting your search or filters.'}
              </p>
            </div>
            {isStaff && !search && filterStatus === 'all' && (
              <button onClick={() => { setEditingExam(null); setShowForm(true); }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: T.primary, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans','Outfit',sans-serif" }}>
                <Plus size={14} /> Create Live Exam
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: 12 }}>
            {filtered.map((exam) =>
              isStaff ? (
                <ExamCard key={exam.id} exam={exam}
                  onEdit={(e) => { setEditingExam(e); setShowForm(true); }}
                  onDelete={(e) => setDeleteConfirm(e)}
                  onToggleStatus={handleToggleStatus}
                  onViewStats={(e) => setStatsExam(e)}
                />
              ) : (
                <div key={exam.id} ref={exam.id === highlightId ? highlightRef : undefined}
                  style={exam.id === highlightId ? { borderRadius: 12, outline: '2px solid rgba(251,191,36,0.7)', outlineOffset: 2 } : {}}>
                  <StudentExamCard exam={exam} attemptRecord={attemptMap[exam.id]} onAttempt={handleAttempt} />
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {showForm && (
        <ExamFormModal editing={editingExam}
          onClose={() => { setShowForm(false); setEditingExam(null); }}
          onSave={() => { setShowForm(false); setEditingExam(null); load(); }}
          currentUserId={user?.uid ?? ''} currentUserName={user?.name ?? ''} />
      )}

      {statsExam && <StatsModal exam={statsExam} onClose={() => setStatsExam(null)} />}

      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
          <div style={{ width: '100%', maxWidth: 360, background: T.isLight ? '#fff' : '#13131f', border: `1px solid ${T.border}`, borderRadius: 20, boxShadow: '0 24px 64px rgba(0,0,0,0.4)', padding: 24, fontFamily: "'DM Sans','Outfit',sans-serif" }}>
            <div style={{ width: 48, height: 48, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Trash2 size={20} style={{ color: T.danger }} />
            </div>
            <h3 style={{ color: T.text, fontWeight: 700, textAlign: 'center', fontSize: 16, margin: '0 0 6px' }}>Delete Live Exam?</h3>
            <p style={{ color: T.text2, fontSize: 13, textAlign: 'center', margin: '0 0 4px' }}>
              <span style={{ color: T.text, fontWeight: 600 }}>"{deleteConfirm.name}"</span>
            </p>
            <p style={{ color: T.text3, fontSize: 12, textAlign: 'center', margin: '0 0 20px' }}>
              This action cannot be undone. Attempt records will remain in the database.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteConfirm(null)}
                style={{ flex: 1, padding: '10px 0', fontSize: 13, color: T.text2, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, cursor: 'pointer', fontFamily: "'DM Sans','Outfit',sans-serif" }}>
                Cancel
              </button>
              <button onClick={handleDelete}
                style={{ flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 600, color: '#fff', background: T.danger, border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: "'DM Sans','Outfit',sans-serif" }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveExamPage;
