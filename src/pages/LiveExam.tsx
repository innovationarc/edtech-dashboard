// src/pages/LiveExam.tsx
// Production-grade Live Exam Management Page
// Roles: admin/manager/teacher → create & manage | student → view & attempt

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Search, Clock, Users, BookOpen, Calendar, ChevronRight,
  MoreVertical, Play, Pause, Trash2, Edit3, Eye, X, Check,
  AlertCircle, Loader2, Radio, GraduationCap, RefreshCw,
  BarChart2, Filter, ArrowLeft, CheckCircle2, XCircle,
  Zap, Target, TrendingUp, Info, ChevronDown, Globe, BookMarked,
} from 'lucide-react';
import { useDashboard } from '../contexts/DashboardContext';
import { contentService, Content } from '../services/contentService';
import { liveExamService, LiveExam, LiveExamAttemptRecord } from '../services/liveExamService';
import courseEnrollmentService from '../services/courseEnrollmentService';

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
  if (exam.examTimelineType === 'anytime') return true;
  const now = new Date();
  const start = exam.examStartDateTime ? new Date(exam.examStartDateTime) : null;
  const end = exam.examEndDateTime ? new Date(exam.examEndDateTime) : null;
  if (start && now < start) return false;
  if (end && now > end) return false;
  return true;
};

// Returns true if the exam is currently live OR starts within the next 48 hours
const isWithin48Hours = (exam: LiveExam): boolean => {
  if (exam.status !== 'active') return false;
  if (exam.examTimelineType === 'anytime') return true;
  const now = new Date();
  const cutoff = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const start = exam.examStartDateTime ? new Date(exam.examStartDateTime) : null;
  const end = exam.examEndDateTime ? new Date(exam.examEndDateTime) : null;
  // Already ended
  if (end && now > end) return false;
  // Starts more than 48h from now
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

const getTimelineLabel = (exam: LiveExam): string => {
  if (exam.examTimelineType === 'anytime') return 'Anytime';
  const start = fmtDate(exam.examStartDateTime);
  const end = fmtDate(exam.examEndDateTime);
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
  examTimelineType: 'anytime' | 'scheduled';
  examStartDateTime: string;
  examEndDateTime: string;
  maxAttempts: string; // '1'|'2'|...|'unlimited'
}

const DEFAULT_FORM: FormState = {
  name: '',
  contentId: '',
  audience: 'all',
  selectedCourseIds: [],
  examTimelineType: 'anytime',
  examStartDateTime: '',
  examEndDateTime: '',
  maxAttempts: '1',
};

// ─── Status Badge ───────────────────────────────────────────────────────────────

const StatusBadge = ({ exam }: { exam: LiveExam }) => {
  if (exam.status === 'ended') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 text-gray-400 border border-gray-500/30">
        <XCircle size={10} /> Ended
      </span>
    );
  }
  if (!isLive(exam)) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
        <Clock size={10} /> Scheduled
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30 animate-pulse">
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
  const badge = exam.contentExamType ? examTypeBadge[exam.contentExamType] : null;

  return (
    <div className="relative bg-gray-800/60 border border-gray-700/60 rounded-xl p-5 hover:border-gray-600 transition-all duration-200 group">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <StatusBadge exam={exam} />
            {badge && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${badge.cls}`}>
                {badge.label}
              </span>
            )}
            {exam.audience === 'all' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                <Globe size={10} /> All Students
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-500/20 text-orange-300 border border-orange-500/30">
                <BookMarked size={10} /> {exam.courseTargets.length} Course{exam.courseTargets.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <h3 className="text-white font-semibold text-base leading-tight truncate">{exam.name}</h3>
          <p className="text-gray-400 text-sm mt-0.5 truncate">
            <BookOpen size={12} className="inline mr-1 opacity-70" />
            {exam.contentTitle}
            {exam.contentSubject && <span className="text-gray-500"> · {exam.contentSubject}</span>}
          </p>
        </div>

        {/* Context menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            <MoreVertical size={16} />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-8 z-20 w-44 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
                <button
                  onClick={() => { setMenuOpen(false); onViewStats(exam); }}
                  className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                >
                  <BarChart2 size={14} /> View Stats
                </button>
                <button
                  onClick={() => { setMenuOpen(false); onEdit(exam); }}
                  className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                >
                  <Edit3 size={14} /> Edit
                </button>
                <button
                  onClick={() => { setMenuOpen(false); onToggleStatus(exam); }}
                  className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                >
                  {exam.status === 'active' ? <><Pause size={14} /> End Exam</> : <><Play size={14} /> Reactivate</>}
                </button>
                <div className="border-t border-gray-700" />
                <button
                  onClick={() => { setMenuOpen(false); onDelete(exam); }}
                  className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-gray-900/50 rounded-lg px-2.5 py-2 text-center">
          <p className="text-lg font-bold text-white">{exam.totalParticipants}</p>
          <p className="text-xs text-gray-500">Participants</p>
        </div>
        <div className="bg-gray-900/50 rounded-lg px-2.5 py-2 text-center">
          <p className="text-lg font-bold text-white">{exam.totalAttempts}</p>
          <p className="text-xs text-gray-500">Total Attempts</p>
        </div>
        <div className="bg-gray-900/50 rounded-lg px-2.5 py-2 text-center">
          <p className="text-lg font-bold text-white">
            {exam.maxAttempts === 'unlimited' ? '∞' : exam.maxAttempts}
          </p>
          <p className="text-xs text-gray-500">Max Attempts</p>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <Clock size={11} />
        <span>{getTimelineLabel(exam)}</span>
        <span className="ml-auto text-gray-600">{fmtRelative(exam.createdAt)}</span>
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
  const isUpcoming = !live && exam.status === 'active' && exam.examTimelineType === 'scheduled' && exam.examStartDateTime;
  const [countdown, setCountdown] = useState<number>(
    isUpcoming ? Math.max(0, Math.floor((new Date(exam.examStartDateTime!).getTime() - Date.now()) / 1000)) : 0
  );

  useEffect(() => {
    if (!isUpcoming) return;
    const tick = () => {
      const secs = Math.max(0, Math.floor((new Date(exam.examStartDateTime!).getTime() - Date.now()) / 1000));
      setCountdown(secs);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isUpcoming, exam.examStartDateTime]);

  return (
    <div className={`bg-gray-800/60 border rounded-xl p-5 hover:border-gray-600 transition-all duration-200 ${
      live ? 'border-green-500/30' : isUpcoming ? 'border-yellow-500/30' : 'border-gray-700/60'
    }`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <StatusBadge exam={exam} />
            {badge && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${badge.cls}`}>
                {badge.label}
              </span>
            )}
          </div>
          <h3 className="text-white font-semibold text-base leading-tight">{exam.name}</h3>
          <p className="text-gray-400 text-sm mt-0.5">
            <BookOpen size={12} className="inline mr-1 opacity-70" />
            {exam.contentTitle}
          </p>
        </div>
        {attemptRecord?.bestPercentage !== undefined && (
          <div className="text-right shrink-0">
            <p className="text-lg font-bold text-green-400">{Math.round(attemptRecord.bestPercentage)}%</p>
            <p className="text-xs text-gray-500">Best Score</p>
          </div>
        )}
      </div>

      {/* Countdown banner — only for upcoming exams */}
      {isUpcoming && countdown > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg mb-3">
          <Clock size={13} className="text-yellow-400 shrink-0" />
          <span className="text-yellow-300 text-xs font-medium">Starts in</span>
          <span className="text-yellow-200 text-xs font-bold ml-auto tabular-nums">{fmtCountdown(countdown)}</span>
        </div>
      )}

      {/* Timeline */}
      {exam.examTimelineType === 'scheduled' && (
        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
          <Calendar size={11} />
          <span className="truncate">{getTimelineLabel(exam)}</span>
        </div>
      )}

      {/* Progress bar */}
      {exam.maxAttempts !== 'unlimited' && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>{attemptCount} attempt{attemptCount !== 1 ? 's' : ''} used</span>
            <span>{remaining} remaining</span>
          </div>
          <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all"
              style={{ width: `${Math.min(100, (attemptCount / (exam.maxAttempts as number)) * 100)}%` }}
            />
          </div>
        </div>
      )}

      <button
        onClick={() => onAttempt(exam)}
        disabled={!canAttempt}
        className={`w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 ${
          canAttempt
            ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/30'
            : isUpcoming
              ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 cursor-not-allowed'
              : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
        }`}
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-800 shrink-0">
          <div>
            <h2 className="text-white font-bold text-lg">{exam.name}</h2>
            <p className="text-gray-400 text-sm">Participant Statistics</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3 p-5 border-b border-gray-800 shrink-0">
          <div className="bg-gray-800/60 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-indigo-400">{exam.totalParticipants}</p>
            <p className="text-xs text-gray-500 mt-0.5">Participants</p>
          </div>
          <div className="bg-gray-800/60 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-purple-400">{exam.totalAttempts}</p>
            <p className="text-xs text-gray-500 mt-0.5">Total Attempts</p>
          </div>
          <div className="bg-gray-800/60 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-teal-400">{avgBest}%</p>
            <p className="text-xs text-gray-500 mt-0.5">Avg Best Score</p>
          </div>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-gray-800 shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-indigo-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <Users size={32} className="mx-auto mb-3 opacity-40" />
              <p>{records.length === 0 ? 'No participants yet' : 'No results for this search'}</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-800/60 sticky top-0 z-10">
                <tr>
                  <th className="text-left px-5 py-2.5 text-xs text-gray-400 font-medium">Student</th>
                  <th className="text-center px-3 py-2.5 text-xs text-gray-400 font-medium">Attempts</th>
                  <th className="text-center px-3 py-2.5 text-xs text-gray-400 font-medium">Best Score</th>
                  <th className="text-right px-5 py-2.5 text-xs text-gray-400 font-medium">Last Attempt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-5 py-3">
                      <p className="text-white font-medium">{r.studentName}</p>
                      {r.studentEmail && <p className="text-gray-500 text-xs">{r.studentEmail}</p>}
                    </td>
                    <td className="text-center px-3 py-3">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-500/20 text-indigo-300 font-bold text-xs">
                        {r.attemptCount}
                      </span>
                    </td>
                    <td className="text-center px-3 py-3">
                      {r.bestPercentage !== undefined ? (
                        <span className={`font-semibold ${r.bestPercentage >= 40 ? 'text-green-400' : 'text-red-400'}`}>
                          {Math.round(r.bestPercentage)}%
                        </span>
                      ) : <span className="text-gray-600">—</span>}
                    </td>
                    <td className="text-right px-5 py-3 text-gray-500 text-xs">
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
          examTimelineType: editing.examTimelineType,
          examStartDateTime: editing.examStartDateTime
            ? editing.examStartDateTime.slice(0, 16)
            : '',
          examEndDateTime: editing.examEndDateTime
            ? editing.examEndDateTime.slice(0, 16)
            : '',
          maxAttempts:
            editing.maxAttempts === 'unlimited'
              ? 'unlimited'
              : String(editing.maxAttempts),
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

  // When content is selected → auto-fill timeline + maxAttempts
  const handleContentSelect = (content: Content) => {
    setForm((prev) => ({
      ...prev,
      contentId: content.id,
      examTimelineType: content.examTimelineType ?? 'anytime',
      examStartDateTime: content.examStartDateTime
        ? content.examStartDateTime.slice(0, 16)
        : '',
      examEndDateTime: content.examEndDateTime
        ? content.examEndDateTime.slice(0, 16)
        : '',
      maxAttempts:
        content.maxAttempts === 'unlimited'
          ? 'unlimited'
          : String(content.maxAttempts ?? 1),
    }));
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
    if (form.examTimelineType === 'scheduled') {
      if (!form.examStartDateTime) return 'Start date/time is required for scheduled exams.';
      if (!form.examEndDateTime) return 'End date/time is required for scheduled exams.';
      if (new Date(form.examStartDateTime) >= new Date(form.examEndDateTime))
        return 'End date must be after start date.';
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
        examTimelineType: form.examTimelineType,
        examStartDateTime: form.examTimelineType === 'scheduled' && form.examStartDateTime
          ? new Date(form.examStartDateTime).toISOString()
          : undefined,
        examEndDateTime: form.examTimelineType === 'scheduled' && form.examEndDateTime
          ? new Date(form.examEndDateTime).toISOString()
          : undefined,
        maxAttempts:
          form.maxAttempts === 'unlimited'
            ? 'unlimited' as const
            : parseInt(form.maxAttempts, 10),
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-xl bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600/20 border border-indigo-500/30 rounded-xl flex items-center justify-center">
              <Radio size={16} className="text-indigo-400" />
            </div>
            <div>
              <h2 className="text-white font-bold text-base">
                {editing ? 'Edit Live Exam' : 'Create Live Exam'}
              </h2>
              <p className="text-gray-500 text-xs">Configure and launch your exam</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">

          {/* Exam Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Exam Name <span className="text-red-400">*</span>
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Mid-term Physics Live Exam"
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Content Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Exam Content <span className="text-red-400">*</span>
              <span className="text-gray-500 font-normal ml-1 text-xs">(only exam-type contents shown)</span>
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowContentDropdown((v) => !v)}
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-sm text-left flex items-center justify-between gap-2 hover:border-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
              >
                {selectedContent ? (
                  <span className="flex items-center gap-2 min-w-0">
                    <BookOpen size={14} className="text-indigo-400 shrink-0" />
                    <span className="text-white truncate">{selectedContent.title}</span>
                    {selectedContent.subject && (
                      <span className="text-gray-500 text-xs shrink-0">· {selectedContent.subject}</span>
                    )}
                  </span>
                ) : (
                  <span className="text-gray-500">Select exam content…</span>
                )}
                <ChevronDown size={14} className={`text-gray-400 shrink-0 transition-transform ${showContentDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showContentDropdown && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowContentDropdown(false)} />
                  <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
                    <div className="p-2 border-b border-gray-700">
                      <div className="relative">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                          autoFocus
                          value={contentSearch}
                          onChange={(e) => setContentSearch(e.target.value)}
                          placeholder="Search content…"
                          className="w-full pl-8 pr-3 py-1.5 bg-gray-900 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="max-h-52 overflow-y-auto">
                      {loadingContents ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 size={18} className="animate-spin text-indigo-400" />
                        </div>
                      ) : filteredContents.length === 0 ? (
                        <div className="py-8 text-center text-gray-500 text-sm">No exam contents found</div>
                      ) : (
                        filteredContents.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => handleContentSelect(c)}
                            className={`w-full text-left px-4 py-3 hover:bg-gray-700 transition-colors flex items-start gap-3 ${
                              form.contentId === c.id ? 'bg-indigo-600/10' : ''
                            }`}
                          >
                            <div className="mt-0.5">
                              <BookOpen size={14} className={form.contentId === c.id ? 'text-indigo-400' : 'text-gray-500'} />
                            </div>
                            <div className="min-w-0">
                              <p className={`text-sm font-medium truncate ${form.contentId === c.id ? 'text-indigo-300' : 'text-white'}`}>
                                {c.title}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {c.subject && <span className="text-xs text-gray-500">{c.subject}</span>}
                                {c.examType && (
                                  <span className={`text-xs px-1.5 py-0.5 rounded-full border ${examTypeBadge[c.examType]?.cls ?? ''}`}>
                                    {examTypeBadge[c.examType]?.label}
                                  </span>
                                )}
                              </div>
                            </div>
                            {form.contentId === c.id && (
                              <CheckCircle2 size={14} className="text-indigo-400 ml-auto shrink-0 mt-0.5" />
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Auto-fill notice */}
            {selectedContent && (
              <div className="mt-2 flex items-start gap-2 p-2.5 bg-indigo-950/40 border border-indigo-500/20 rounded-lg">
                <Info size={13} className="text-indigo-400 shrink-0 mt-0.5" />
                <p className="text-xs text-indigo-300">
                  Timeline and attempt limit auto-filled from content. You can override them below.
                </p>
              </div>
            )}
          </div>

          {/* Audience */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Exam Audience <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['all', 'course_based'] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, audience: opt, selectedCourseIds: [] }))}
                  className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                    form.audience === opt
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {opt === 'all' ? <Globe size={15} /> : <BookMarked size={15} />}
                  {opt === 'all' ? 'All Students' : 'Course-Based'}
                </button>
              ))}
            </div>

            {/* Course multi-select */}
            {form.audience === 'course_based' && (
              <div className="mt-3">
                <p className="text-xs text-gray-500 mb-2">Select courses to include:</p>
                {loadingCourses ? (
                  <div className="flex items-center gap-2 text-gray-500 text-sm">
                    <Loader2 size={14} className="animate-spin" /> Loading courses…
                  </div>
                ) : courses.length === 0 ? (
                  <p className="text-xs text-gray-500">No published courses found.</p>
                ) : (
                  <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                    {courses.map((c) => (
                      <label
                        key={c.id}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                          form.selectedCourseIds.includes(c.id)
                            ? 'bg-indigo-600/10 border border-indigo-500/30'
                            : 'hover:bg-gray-800 border border-transparent'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={form.selectedCourseIds.includes(c.id)}
                          onChange={() => toggleCourse(c.id)}
                          className="w-3.5 h-3.5 rounded accent-indigo-500"
                        />
                        <span className="text-sm text-gray-300 truncate">{c.title}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Timeline */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Exam Timeline
            </label>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {(['anytime', 'scheduled'] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, examTimelineType: opt }))}
                  className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                    form.examTimelineType === opt
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {opt === 'anytime' ? <Zap size={15} /> : <Calendar size={15} />}
                  {opt === 'anytime' ? 'Anytime' : 'Scheduled'}
                </button>
              ))}
            </div>

            {form.examTimelineType === 'scheduled' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Start Date & Time</label>
                  <input
                    type="datetime-local"
                    value={form.examStartDateTime}
                    onChange={(e) => setForm((p) => ({ ...p, examStartDateTime: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">End Date & Time</label>
                  <input
                    type="datetime-local"
                    value={form.examEndDateTime}
                    onChange={(e) => setForm((p) => ({ ...p, examEndDateTime: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Max Attempts */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Attempt Limit
            </label>
            <div className="flex flex-wrap gap-2">
              {['1', '2', '3', '5', '10', 'unlimited'].map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, maxAttempts: opt }))}
                  className={`px-3.5 py-2 rounded-xl border text-sm font-medium transition-all ${
                    form.maxAttempts === opt
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {opt === 'unlimited' ? '∞ Unlimited' : `${opt}×`}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-950/40 border border-red-500/30 rounded-xl">
              <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-800 shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-xl transition-colors shadow-lg shadow-indigo-900/30"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
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
  const isStaff = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'teacher';

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
      } else if (user?.id) {
        // For students — get enrolled course ids first
        const enrolledCourseIds: string[] = []; // TODO: wire to actual enrollment service
        const visible = await liveExamService.getLiveExamsForStudent(user.id, enrolledCourseIds);

        // Students only see exams that are currently live OR start within 48 hours
        const within48h = visible.filter(isWithin48Hours);
        setExams(within48h);

        // Load attempt records for each
        const map: Record<string, LiveExamAttemptRecord | null> = {};
        await Promise.all(
          within48h.map(async (e) => {
            map[e.id] = await liveExamService.getStudentAttemptRecord(e.id, user.id!);
          })
        );
        setAttemptMap(map);
      }
    } finally {
      setLoading(false);
    }
  }, [isStaff, user?.id]);

  useEffect(() => { load(); }, [load]);

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
    // Navigate to exam viewer with liveExamId param
    // The ExamViewer will handle the actual exam session
    window.location.href = `/exam/${exam.contentId}?liveExamId=${exam.id}`;
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

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6 lg:px-8">

        {/* Page Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 bg-indigo-600/20 border border-indigo-500/30 rounded-xl flex items-center justify-center">
                <Radio size={15} className="text-indigo-400" />
              </div>
              <h1 className="text-2xl font-bold text-white">Live Exams</h1>
            </div>
            <p className="text-gray-400 text-sm">
              {isStaff
                ? 'Create and manage live exams for your students'
                : 'Live and upcoming exams in the next 48 hours'}
            </p>
          </div>
          {isStaff && (
            <button
              onClick={() => { setEditingExam(null); setShowForm(true); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-indigo-900/30 shrink-0"
            >
              <Plus size={16} /> Create Live Exam
            </button>
          )}
        </div>

        {/* Staff summary cards */}
        {isStaff && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total Exams', value: exams.length, icon: BookOpen, color: 'indigo' },
              { label: 'Currently Active', value: activeCount, icon: Radio, color: 'green' },
              { label: 'Total Participants', value: totalParticipants, icon: Users, color: 'purple' },
              { label: 'Total Attempts', value: totalAttempts, icon: TrendingUp, color: 'teal' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-gray-800/60 border border-gray-700/60 rounded-xl p-4">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 bg-${color}-500/20 border border-${color}-500/30`}>
                  <Icon size={15} className={`text-${color}-400`} />
                </div>
                <p className="text-2xl font-bold text-white">{value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Search & Filter bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search exams…"
              className="w-full pl-9 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          {isStaff && (
            <div className="flex items-center gap-1.5 bg-gray-800 border border-gray-700 rounded-xl p-1">
              {(['all', 'active', 'ended'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`px-3.5 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${
                    filterStatus === s
                      ? 'bg-gray-700 text-white'
                      : 'text-gray-400 hover:text-gray-300'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 size={28} className="animate-spin text-indigo-400" />
            <p className="text-gray-500 text-sm">Loading exams…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-16 h-16 bg-gray-800 border border-gray-700 rounded-2xl flex items-center justify-center">
              <Radio size={24} className="text-gray-600" />
            </div>
            <div className="text-center">
              <p className="text-white font-medium text-lg">
                {search || filterStatus !== 'all' ? 'No results found' : isStaff ? 'No live exams yet' : 'No exams in the next 48 hours'}
              </p>
              <p className="text-gray-500 text-sm mt-1">
                {isStaff && !search && filterStatus === 'all'
                  ? 'Create your first live exam to get started.'
                  : !isStaff && !search
                  ? 'Check back soon — exams scheduled within 48 hours will appear here.'
                  : 'Try adjusting your search or filters.'}
              </p>
            </div>
            {isStaff && !search && filterStatus === 'all' && (
              <button
                onClick={() => { setEditingExam(null); setShowForm(true); }}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                <Plus size={15} /> Create Live Exam
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((exam) =>
              isStaff ? (
                <ExamCard
                  key={exam.id}
                  exam={exam}
                  onEdit={(e) => { setEditingExam(e); setShowForm(true); }}
                  onDelete={(e) => setDeleteConfirm(e)}
                  onToggleStatus={handleToggleStatus}
                  onViewStats={(e) => setStatsExam(e)}
                />
              ) : (
                <StudentExamCard
                  key={exam.id}
                  exam={exam}
                  attemptRecord={attemptMap[exam.id]}
                  onAttempt={handleAttempt}
                />
              )
            )}
          </div>
        )}
      </div>

      {/* Modals */}

      {showForm && (
        <ExamFormModal
          editing={editingExam}
          onClose={() => { setShowForm(false); setEditingExam(null); }}
          onSave={() => { setShowForm(false); setEditingExam(null); load(); }}
          currentUserId={user?.id ?? ''}
          currentUserName={user?.name ?? ''}
        />
      )}

      {statsExam && (
        <StatsModal
          exam={statsExam}
          onClose={() => setStatsExam(null)}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-6">
            <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Trash2 size={20} className="text-red-400" />
            </div>
            <h3 className="text-white font-bold text-center text-lg mb-1">Delete Live Exam?</h3>
            <p className="text-gray-400 text-sm text-center mb-1">
              <span className="text-white font-medium">"{deleteConfirm.name}"</span>
            </p>
            <p className="text-gray-500 text-xs text-center mb-6">
              This action cannot be undone. Attempt records will remain in the database.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 text-sm text-gray-400 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-500 rounded-xl transition-colors"
              >
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
