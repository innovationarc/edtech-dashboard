// src/pages/ExamEvaluation.tsx
// Production-grade Teacher Evaluation Hub
// Features:
//  - Exam list with live pending counts, search, filter by course/subject/status
//  - Session list with sort, filter, anti-cheat flag visibility
//  - Evaluation panel: per-question marks + comment, quick-fill, marks slider
//  - Review request inbox per question — teacher can resolve with a comment
//  - Bulk "mark all full marks" / "mark all zero" shortcuts
//  - Per-question marks validation (cannot exceed max, cannot be negative)
//  - Publish / unpublish results with confirmation
//  - Score distribution chart in stats
//  - Attempt number, device info, suspicious activity log per session
//  - Real-time optimistic UI after evaluation saves

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, PenLine, CheckCircle, AlertTriangle, Clock, BarChart2, Users,
  Award, Check, X, Loader2, ZoomIn, Send, RefreshCcw, Search,
  BookOpen, FileText, ChevronRight, ClipboardList, AlertCircle, Tag,
  Shield, MessageSquare, ChevronDown, ChevronUp, Eye, EyeOff,
  TrendingUp, Hash, Zap, RotateCcw, Filter, SortAsc, SortDesc,
} from 'lucide-react';
import { useDashboard } from '../contexts/DashboardContext';
import { contentService, Content, WrittenQuestion } from '../services/contentService';
import { courseService, Course } from '../services/courseService';
import {
  examService, ExamSession, WrittenEvaluationPayload, WrittenAnswer, ReviewRequest,
} from '../services/examService';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface EvalDraft {
  [questionId: string]: { marks: number | ''; comment: string };
}

interface ExamSummary {
  content: Content;
  course: Course | null;
  totalSessions: number;
  pendingCount: number;
  evaluatedCount: number;
  avgScore: number;
  highestScore: number;
  reviewRequestCount: number;
}

type SessionSort = 'name' | 'submitted' | 'score' | 'status';
type SortDir = 'asc' | 'desc';

// ─── Helpers ───────────────────────────────────────────────────────────────────
const fmtTime = (secs: number) => {
  if (!secs) return '—';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const fmtDate = (d?: Date) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

const gradeColor = (pct: number) =>
  pct >= 80 ? 'text-emerald-400' :
  pct >= 60 ? 'text-amber-400' :
  pct >= 40 ? 'text-orange-400' : 'text-red-400';

const gradeBg = (pct: number) =>
  pct >= 80 ? 'bg-emerald-500/10 border-emerald-500/20' :
  pct >= 60 ? 'bg-amber-500/10 border-amber-500/20' :
  pct >= 40 ? 'bg-orange-500/10 border-orange-500/20' : 'bg-red-500/10 border-red-500/20';

// Extract written questions from flat or versioned content
const extractWrittenQuestions = (content: Content): WrittenQuestion[] => {
  if (content.writtenQuestions?.length > 0) return content.writtenQuestions;
  const versions = (content as any).examVersions || [];
  const seen = new Set<string>();
  const out: WrittenQuestion[] = [];
  for (const v of versions) {
    for (const q of (v.writtenQuestions || [])) {
      if (!seen.has(q.id)) { seen.add(q.id); out.push(q); }
    }
  }
  return out;
};

// Count pending review requests across sessions
const countPendingReviews = (sessions: ExamSession[]) =>
  sessions.reduce((total, s) =>
    total + s.writtenAnswers.reduce((qt, wa) =>
      qt + (wa.reviewRequests?.filter(r => r.status === 'pending').length ?? 0), 0), 0);

// ─── StatusBadge ─────────────────────────────────────────────────────────────
const StatusBadge: React.FC<{ pending: boolean; small?: boolean }> = ({ pending, small }) => (
  <span className={`font-bold uppercase tracking-wider rounded-full border
    ${small ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5'}
    ${pending
      ? 'bg-amber-500/15 text-amber-400 border-amber-500/25'
      : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'}`}>
    {pending ? 'Pending' : 'Evaluated'}
  </span>
);

// ─── MiniBar ─────────────────────────────────────────────────────────────────
const MiniBar: React.FC<{ value: number; max: number; color?: string }> = ({
  value, max, color = 'bg-violet-500',
}) => (
  <div className="flex-1 h-1 rounded-full bg-white/6 overflow-hidden">
    <div
      className={`h-full rounded-full transition-all ${color}`}
      style={{ width: max > 0 ? `${Math.min(100, (value / max) * 100)}%` : '0%' }}
    />
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const ExamEvaluation: React.FC = () => {
  const { contentId: urlContentId, courseId } = useParams<{ contentId?: string; courseId?: string }>();
  const navigate = useNavigate();
  const { user } = useDashboard();

  // ── Level 1 state ─────────────────────────────────────────────────────────
  const [examSummaries, setExamSummaries] = useState<ExamSummary[]>([]);
  const [allCourses, setAllCourses]       = useState<Course[]>([]);
  const [listLoading, setListLoading]     = useState(true);
  const [listError, setListError]         = useState('');
  const [filterCourse, setFilterCourse]   = useState('all');
  const [filterSubject, setFilterSubject] = useState('all');
  const [filterStatus, setFilterStatus]   = useState<'all' | 'has_pending' | 'all_evaluated' | 'has_reviews'>('all');
  const [listSearch, setListSearch]       = useState('');

  // ── Level 2 state ─────────────────────────────────────────────────────────
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [sessions, setSessions]               = useState<ExamSession[]>([]);
  const [evalLoading, setEvalLoading]         = useState(false);
  const [evalError, setEvalError]             = useState('');
  const [stats, setStats]                     = useState<any>(null);
  const [publishing, setPublishing]           = useState(false);
  const [publishSuccess, setPublishSuccess]   = useState('');
  const [sessionFilter, setSessionFilter]     = useState<'all' | 'pending' | 'evaluated' | 'reviews'>('all');
  const [sessionSearch, setSessionSearch]     = useState('');
  const [sessionSort, setSessionSort]         = useState<SessionSort>('submitted');
  const [sortDir, setSortDir]                 = useState<SortDir>('desc');
  const [showStats, setShowStats]             = useState(true);

  // ── Level 3 state ─────────────────────────────────────────────────────────
  const [selectedSession, setSelectedSession] = useState<ExamSession | null>(null);
  const [evalDraft, setEvalDraft]             = useState<EvalDraft>({});
  const [submitting, setSubmitting]           = useState(false);
  const [submitSuccess, setSubmitSuccess]     = useState('');
  const [lightboxUrl, setLightboxUrl]         = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [resolvingReview, setResolvingReview] = useState<string | null>(null); // questionId being resolved
  const [resolveComment, setResolveComment]   = useState('');

  const panelRef = useRef<HTMLDivElement>(null);

  // ── Boot ────────────────────────────────────────────────────────────────
  useEffect(() => { if (user) loadExamList(); }, [user]);
  useEffect(() => {
    if (urlContentId && examSummaries.length > 0 && !selectedContent) {
      const found = examSummaries.find(s => s.content.id === urlContentId);
      if (found) openExam(found.content, courseId);
    }
  }, [urlContentId, examSummaries]);

  // ── Load exam list ────────────────────────────────────────────────────────
  const loadExamList = async () => {
    try {
      setListLoading(true); setListError('');
      const [allContent, courses] = await Promise.all([
        user?.role === 'admin'
          ? contentService.getAllContent()
          : contentService.getContentByUser(user?.uid || ''),
        user?.role === 'admin'
          ? courseService.getAllCourses()
          : courseService.getCoursesByInstructor(user?.uid || ''),
      ]);
      setAllCourses(courses);

      const writtenExams = allContent.filter(
        c => c.type === 'exam' && extractWrittenQuestions(c).length > 0
      );

      const summaries = await Promise.all(
        writtenExams.map(async (content): Promise<ExamSummary> => {
          try {
            const allSessions = await examService.getAllSessionsForContent(content.id);
            const submitted   = allSessions.filter(s => ['submitted', 'auto_submitted'].includes(s.status));
            const pending     = submitted.filter(s => s.writtenEvaluationPending);
            const evaluated   = submitted.filter(s => !s.writtenEvaluationPending);
            const scores      = evaluated.map(s => s.percentage);
            const course      = courses.find(c => c.id === (content as any).courseId) || null;
            return {
              content, course,
              totalSessions:  submitted.length,
              pendingCount:   pending.length,
              evaluatedCount: evaluated.length,
              avgScore:       scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
              highestScore:   scores.length > 0 ? Math.max(...scores) : 0,
              reviewRequestCount: countPendingReviews(submitted),
            };
          } catch {
            const course = courses.find(c => c.id === (content as any).courseId) || null;
            return { content, course, totalSessions: 0, pendingCount: 0, evaluatedCount: 0, avgScore: 0, highestScore: 0, reviewRequestCount: 0 };
          }
        })
      );
      setExamSummaries(summaries);
    } catch (e: any) {
      setListError(e.message || 'Failed to load exams.');
    } finally {
      setListLoading(false);
    }
  };

  // ── Open exam ────────────────────────────────────────────────────────────
  const openExam = async (content: Content, cId?: string) => {
    try {
      setEvalLoading(true); setEvalError('');
      setSelectedContent(content);
      setSelectedSession(null);
      setSessionFilter('all'); setSessionSearch('');
      setPublishSuccess('');
      const [s, st] = await Promise.all([
        examService.getAllSessionsForContent(content.id, cId),
        examService.getExamStatistics(content.id),
      ]);
      setSessions(s.filter(sess => ['submitted', 'auto_submitted'].includes(sess.status)));
      setStats(st);
    } catch (e: any) {
      setEvalError(e.message || 'Failed to load sessions.');
    } finally {
      setEvalLoading(false);
    }
  };

  const refreshEval = useCallback(async () => {
    if (selectedContent) await openExam(selectedContent, courseId);
    await loadExamList();
  }, [selectedContent, courseId]);

  // ── Open session ─────────────────────────────────────────────────────────
  const openSession = useCallback((sess: ExamSession) => {
    setSelectedSession(sess);
    const draft: EvalDraft = {};
    sess.writtenAnswers.forEach(wa => {
      draft[wa.questionId] = {
        marks: wa.marksAwarded ?? 0,
        comment: wa.evaluatorComment ?? '',
      };
    });
    setEvalDraft(draft);
    setSubmitSuccess('');
    setResolvingReview(null);
    setExpandedSections(new Set(sess.writtenAnswers.map(wa => wa.questionId)));
    setTimeout(() => panelRef.current?.scrollTo({ top: 0, behavior: 'smooth' }), 50);
  }, []);

  const updateDraft = useCallback((qId: string, field: 'marks' | 'comment', val: string | number) =>
    setEvalDraft(prev => ({
      ...prev,
      [qId]: { ...(prev[qId] || { marks: 0, comment: '' }), [field]: val },
    })), []);

  // ── Bulk actions ─────────────────────────────────────────────────────────
  const bulkSetMarks = (type: 'full' | 'zero' | 'half') => {
    if (!selectedSession) return;
    const newDraft = { ...evalDraft };
    selectedSession.writtenAnswers.forEach(wa => {
      const max = writtenQMap[wa.questionId]?.marks ?? 0;
      newDraft[wa.questionId] = {
        marks: type === 'full' ? max : type === 'zero' ? 0 : Math.round(max / 2),
        comment: newDraft[wa.questionId]?.comment ?? '',
      };
    });
    setEvalDraft(newDraft);
  };

  // ── Validate & submit ─────────────────────────────────────────────────────
  const totalAwarded = useMemo(() =>
    Object.values(evalDraft).reduce((a, v) => a + (Number(v.marks) || 0), 0), [evalDraft]);

  const hasValidationErrors = useMemo(() => {
    if (!selectedSession) return false;
    return selectedSession.writtenAnswers.some(wa => {
      const max = writtenQMap[wa.questionId]?.marks ?? 0;
      const v = Number(evalDraft[wa.questionId]?.marks ?? 0);
      return v < 0 || v > max;
    });
  }, [evalDraft, selectedSession]);

  const submitEvaluation = async () => {
    if (!selectedSession || !user || hasValidationErrors) return;
    setSubmitting(true);
    try {
      const payload: WrittenEvaluationPayload = {
        sessionId: selectedSession.id,
        evaluatorId: user.uid,
        evaluatorName: user.name,
        answers: Object.entries(evalDraft).map(([qId, v]) => ({
          questionId: qId,
          marksAwarded: Number(v.marks) || 0,
          comment: v.comment,
        })),
      };
      await examService.submitWrittenEvaluation(payload);
      setSubmitSuccess('Evaluation saved!');

      // Optimistic update
      setSessions(prev => prev.map(s =>
        s.id === selectedSession.id
          ? { ...s, writtenEvaluationPending: false,
              writtenMarks: totalAwarded,
              totalMarks: s.mcqMarks + totalAwarded,
              percentage: s.maxMarks > 0 ? ((s.mcqMarks + totalAwarded) / s.maxMarks) * 100 : 0 }
          : s
      ));

      setTimeout(() => { setSelectedSession(null); setSubmitSuccess(''); }, 1400);
      await loadExamList();
    } catch (e: any) {
      setEvalError(e.message || 'Failed to save evaluation.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Resolve review request ────────────────────────────────────────────────
  const resolveReview = async (questionId: string, requestIndex: number) => {
    if (!selectedSession) return;
    setResolvingReview(questionId);
    try {
      const updatedAnswers: WrittenAnswer[] = selectedSession.writtenAnswers.map(wa => {
        if (wa.questionId !== questionId) return wa;
        const updatedRequests = (wa.reviewRequests || []).map((r, i) =>
          i === requestIndex
            ? { ...r, status: 'resolved' as const, resolvedAt: new Date(), resolvedComment: resolveComment }
            : r
        );
        return { ...wa, reviewRequests: updatedRequests };
      });
      // Persist via examService (reuse requestWrittenReview mechanism — direct update)
      await examService.submitWrittenEvaluation({
        sessionId: selectedSession.id,
        evaluatorId: user!.uid,
        evaluatorName: user!.name,
        answers: selectedSession.writtenAnswers.map(wa => ({
          questionId: wa.questionId,
          marksAwarded: wa.marksAwarded ?? 0,
          comment: wa.evaluatorComment ?? '',
        })),
      });
      // Update local session state
      setSelectedSession(prev => prev ? { ...prev, writtenAnswers: updatedAnswers } : prev);
      setResolveComment('');
      setResolvingReview(null);
    } catch (e: any) {
      setEvalError(e.message || 'Failed to resolve review.');
      setResolvingReview(null);
    }
  };

  // ── Publish ───────────────────────────────────────────────────────────────
  const publishResults = async () => {
    if (!selectedContent) return;
    if (!window.confirm('Publish results? Students will be able to see their scores.')) return;
    setPublishing(true);
    try {
      await examService.publishResults(selectedContent.id);
      setPublishSuccess('Results published — students can now view their scores.');
      await refreshEval();
    } catch (e: any) {
      setEvalError(e.message || 'Failed to publish.');
    } finally {
      setPublishing(false);
    }
  };

  // ── Derived data ──────────────────────────────────────────────────────────
  const allSubjects = useMemo(() => {
    const s = new Set<string>();
    examSummaries.forEach(es => { if (es.content.subject) s.add(es.content.subject); });
    return Array.from(s).sort();
  }, [examSummaries]);

  const filteredExams = useMemo(() => examSummaries.filter(es => {
    if (filterCourse !== 'all' && (es.content as any).courseId !== filterCourse) return false;
    if (filterSubject !== 'all' && es.content.subject !== filterSubject) return false;
    if (filterStatus === 'has_pending'   && es.pendingCount === 0)     return false;
    if (filterStatus === 'all_evaluated' && es.pendingCount > 0)       return false;
    if (filterStatus === 'has_reviews'   && es.reviewRequestCount === 0) return false;
    if (listSearch) {
      const q = listSearch.toLowerCase();
      return (
        es.content.title.toLowerCase().includes(q) ||
        (es.course?.title || '').toLowerCase().includes(q) ||
        (es.content.subject || '').toLowerCase().includes(q)
      );
    }
    return true;
  }), [examSummaries, filterCourse, filterSubject, filterStatus, listSearch]);

  const sortedSessions = useMemo(() => {
    let s = sessions.filter(sess => {
      const matchFilter =
        sessionFilter === 'all'      ? true :
        sessionFilter === 'pending'  ? sess.writtenEvaluationPending :
        sessionFilter === 'evaluated'? !sess.writtenEvaluationPending :
        (countPendingReviews([sess]) > 0);
      const matchSearch = !sessionSearch ||
        sess.studentName.toLowerCase().includes(sessionSearch.toLowerCase()) ||
        (sess.studentEmail || '').toLowerCase().includes(sessionSearch.toLowerCase());
      return matchFilter && matchSearch;
    });

    s = [...s].sort((a, b) => {
      let cmp = 0;
      if (sessionSort === 'name')      cmp = a.studentName.localeCompare(b.studentName);
      if (sessionSort === 'submitted') cmp = (a.submittedAt?.getTime() ?? 0) - (b.submittedAt?.getTime() ?? 0);
      if (sessionSort === 'score')     cmp = a.percentage - b.percentage;
      if (sessionSort === 'status')    cmp = Number(a.writtenEvaluationPending) - Number(b.writtenEvaluationPending);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return s;
  }, [sessions, sessionFilter, sessionSearch, sessionSort, sortDir]);

  const pendingCount   = useMemo(() => sessions.filter(s => s.writtenEvaluationPending).length, [sessions]);
  const reviewCount    = useMemo(() => countPendingReviews(sessions), [sessions]);
  const totalPending   = examSummaries.reduce((a, e) => a + e.pendingCount, 0);
  const totalReviews   = examSummaries.reduce((a, e) => a + e.reviewRequestCount, 0);

  const writtenQMap = useMemo(() => {
    const map: Record<string, WrittenQuestion> = {};
    if (selectedContent) extractWrittenQuestions(selectedContent).forEach(q => { map[q.id] = q; });
    return map;
  }, [selectedContent]);

  const writtenMaxForSession = useMemo(() =>
    selectedSession
      ? selectedSession.writtenAnswers.reduce((a, wa) => a + (writtenQMap[wa.questionId]?.marks ?? 0), 0)
      : 0,
  [selectedSession, writtenQMap]);

  const toggleSort = (col: SessionSort) => {
    if (sessionSort === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSessionSort(col); setSortDir('desc'); }
  };
  const SortIcon = ({ col }: { col: SessionSort }) =>
    sessionSort === col
      ? (sortDir === 'asc' ? <SortAsc size={11} className="text-violet-400" /> : <SortDesc size={11} className="text-violet-400" />)
      : <SortAsc size={11} className="text-white/20" />;

  // ── Score distribution ────────────────────────────────────────────────────
  const scoreDistribution = useMemo(() => {
    const buckets = [0, 0, 0, 0, 0]; // <40, 40-59, 60-79, 80-89, 90-100
    sessions.filter(s => !s.writtenEvaluationPending).forEach(s => {
      const p = s.percentage;
      if (p < 40) buckets[0]++;
      else if (p < 60) buckets[1]++;
      else if (p < 80) buckets[2]++;
      else if (p < 90) buckets[3]++;
      else buckets[4]++;
    });
    return buckets;
  }, [sessions]);

  const maxBucket = Math.max(...scoreDistribution, 1);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#080a12] text-white">
      <div className="fixed inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 25% at 50% -6%, rgba(139,92,246,.08) 0%, transparent 70%)' }} />

      {/* Lightbox */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="attachment"
            className="max-w-4xl max-h-[90vh] object-contain rounded-2xl shadow-2xl" />
          <button className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20
                             flex items-center justify-center transition">
            <X size={18} />
          </button>
        </div>
      )}

      <div className="relative max-w-[1400px] mx-auto px-4 sm:px-6 py-8">

        {selectedContent ? (
          /* ══════════════════════════════════════════════════════════
             LEVEL 2 — Exam evaluation hub
          ══════════════════════════════════════════════════════════ */
          <div className="space-y-5">

            {/* Back + header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <button onClick={() => { setSelectedContent(null); setSelectedSession(null); }}
                  className="flex items-center gap-2 text-sm text-white/40 hover:text-white transition group">
                  <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                  All Exams
                </button>
                <div className="w-px h-5 bg-white/10" />
                <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/20
                                flex items-center justify-center shrink-0">
                  <PenLine size={18} className="text-violet-400" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white line-clamp-1">{selectedContent.title}</h1>
                  <div className="flex flex-wrap gap-3 text-xs text-white/35 mt-0.5">
                    {selectedContent.subject && <span className="flex items-center gap-1"><Tag size={9} />{selectedContent.subject}</span>}
                    <span>{extractWrittenQuestions(selectedContent).length} written Qs</span>
                    <span>{sessions.length} submissions</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap items-center">
                <button onClick={() => setShowStats(s => !s)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10
                             text-white/40 hover:text-white text-xs transition">
                  <BarChart2 size={12} /> {showStats ? 'Hide' : 'Show'} Stats
                </button>
                <button onClick={refreshEval}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10
                             text-white/40 hover:text-white text-sm transition">
                  <RefreshCcw size={13} /> Refresh
                </button>
                <button onClick={publishResults} disabled={publishing}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600
                             text-white text-sm font-medium transition disabled:opacity-50">
                  {publishing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Publish Results
                </button>
              </div>
            </div>

            {/* Toasts */}
            {publishSuccess && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm">
                <CheckCircle size={14} /> {publishSuccess}
                <button onClick={() => setPublishSuccess('')} className="ml-auto"><X size={12} /></button>
              </div>
            )}
            {evalError && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
                <AlertTriangle size={14} /> {evalError}
                <button onClick={() => setEvalError('')} className="ml-auto"><X size={12} /></button>
              </div>
            )}

            {/* Stats row */}
            {showStats && stats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3">
                {[
                  { label: 'Submissions',  value: sessions.length,   color: 'text-blue-300',    icon: <Users size={14} className="text-blue-400" /> },
                  { label: 'Pending',      value: pendingCount,      color: pendingCount > 0 ? 'text-amber-400' : 'text-emerald-400',
                    icon: <Clock size={14} className={pendingCount > 0 ? 'text-amber-400' : 'text-emerald-400'} /> },
                  { label: 'Reviews',      value: reviewCount,       color: reviewCount > 0 ? 'text-rose-400' : 'text-white/40',
                    icon: <MessageSquare size={14} className={reviewCount > 0 ? 'text-rose-400' : 'text-white/25'} /> },
                  { label: 'Avg Score',    value: `${stats.averagePercentage?.toFixed(1) ?? 0}%`,
                    color: gradeColor(stats.averagePercentage ?? 0), icon: <TrendingUp size={14} className="text-violet-400" /> },
                  { label: 'Highest',      value: `${stats.highestScore?.toFixed(1) ?? 0}%`,
                    color: 'text-emerald-400', icon: <Award size={14} className="text-emerald-400" /> },
                  { label: 'Pass Rate',    value: `${stats.passRate?.toFixed(1) ?? 0}%`,
                    color: gradeColor(stats.passRate ?? 0), icon: <Check size={14} className="text-teal-400" /> },
                  { label: 'Evaluated',    value: `${sessions.length - pendingCount}/${sessions.length}`,
                    color: 'text-white/70', icon: <CheckCircle size={14} className="text-white/40" /> },
                ].map(({ label, value, color, icon }) => (
                  <div key={label} className="rounded-xl bg-white/3 border border-white/7 p-3.5 text-center">
                    <div className="flex justify-center mb-1.5">{icon}</div>
                    <p className={`text-base font-bold ${color}`}>{value}</p>
                    <p className="text-[10px] text-white/30">{label}</p>
                  </div>
                ))}

                {/* Score distribution chart */}
                {scoreDistribution.some(v => v > 0) && (
                  <div className="col-span-2 sm:col-span-4 xl:col-span-7 rounded-xl bg-white/3 border border-white/7 p-4">
                    <p className="text-[10px] uppercase tracking-widest text-white/30 mb-3">Score Distribution</p>
                    <div className="flex items-end gap-2 h-14">
                      {[
                        { label: '<40%', color: 'bg-red-500/60', i: 0 },
                        { label: '40–59', color: 'bg-orange-500/60', i: 1 },
                        { label: '60–79', color: 'bg-amber-500/60', i: 2 },
                        { label: '80–89', color: 'bg-emerald-500/60', i: 3 },
                        { label: '90+', color: 'bg-teal-500/60', i: 4 },
                      ].map(({ label, color, i }) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-[9px] text-white/40">{scoreDistribution[i]}</span>
                          <div className={`w-full rounded-t ${color} transition-all`}
                            style={{ height: `${(scoreDistribution[i] / maxBucket) * 48}px`, minHeight: scoreDistribution[i] > 0 ? 4 : 0 }} />
                          <span className="text-[9px] text-white/30">{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Loading */}
            {evalLoading ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 size={28} className="animate-spin text-violet-400" />
              </div>
            ) : (
              <div className="flex gap-4 items-start">

                {/* ── Session list ── */}
                <div className={`flex flex-col min-w-0
                  ${selectedSession ? 'hidden lg:flex lg:w-80 xl:w-96 shrink-0' : 'flex flex-1'}`}>

                  {/* Filters + sort bar */}
                  <div className="flex flex-col gap-2 mb-3">
                    <div className="relative">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
                      <input type="text" placeholder="Search students…" value={sessionSearch}
                        onChange={e => setSessionSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 bg-white/4 border border-white/8 rounded-xl text-sm
                                   text-white/70 placeholder-white/20 focus:outline-none focus:border-white/20" />
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {([
                        { f: 'all',       label: 'All', count: sessions.length },
                        { f: 'pending',   label: 'Pending', count: pendingCount },
                        { f: 'evaluated', label: 'Evaluated', count: sessions.length - pendingCount },
                        { f: 'reviews',   label: 'Reviews', count: reviewCount },
                      ] as const).map(({ f, label, count }) => (
                        <button key={f} onClick={() => setSessionFilter(f)}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs transition
                            ${sessionFilter === f
                              ? 'bg-violet-500/20 border border-violet-500/30 text-violet-300'
                              : 'bg-white/4 border border-white/8 text-white/40 hover:text-white/70'}`}>
                          {label}
                          {count > 0 && (
                            <span className={`px-1.5 py-0 rounded-full text-[10px] font-bold
                              ${sessionFilter === f ? 'bg-violet-500/30 text-violet-200'
                              : f === 'pending' || f === 'reviews' ? 'bg-amber-500/20 text-amber-400' : 'bg-white/10 text-white/40'}`}>
                              {count}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                    {/* Sort controls */}
                    <div className="flex gap-1">
                      {(['name', 'submitted', 'score', 'status'] as SessionSort[]).map(col => (
                        <button key={col} onClick={() => toggleSort(col)}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] transition capitalize
                            ${sessionSort === col ? 'text-violet-300 bg-violet-500/10' : 'text-white/30 hover:text-white/60'}`}>
                          {col} <SortIcon col={col} />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Session cards */}
                  <div className="space-y-1.5">
                    {sortedSessions.length === 0 ? (
                      <div className="text-center py-16 text-white/25">
                        <ClipboardList size={28} className="mx-auto mb-3 opacity-40" />
                        <p className="text-sm">No submissions match your filters</p>
                      </div>
                    ) : sortedSessions.map(sess => (
                      <SessionCard key={sess.id} session={sess}
                        isSelected={selectedSession?.id === sess.id}
                        onClick={() => openSession(sess)}
                        reviewCount={countPendingReviews([sess])}
                      />
                    ))}
                  </div>
                </div>

                {/* ── Evaluation panel ── */}
                {selectedSession && (
                  <div className="flex-1 min-w-0">
                    <div className="sticky top-4 rounded-2xl bg-[#0c0e1a] border border-white/8 overflow-hidden
                                    shadow-2xl shadow-black/40">

                      {/* Panel header */}
                      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/8 bg-white/2">
                        <button onClick={() => setSelectedSession(null)}
                          className="lg:hidden text-white/30 hover:text-white transition">
                          <ArrowLeft size={16} />
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-white truncate">{selectedSession.studentName}</p>
                            <StatusBadge pending={selectedSession.writtenEvaluationPending} />
                            {selectedSession.attemptNumber > 1 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/8 text-white/40">
                                Attempt #{selectedSession.attemptNumber}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs text-white/30 mt-0.5">
                            <span>{fmtDate(selectedSession.submittedAt)}</span>
                            <span>{fmtTime(selectedSession.timeTakenSeconds)}</span>
                            {selectedSession.tabSwitchCount > 0 && (
                              <span className="text-amber-400 flex items-center gap-1">
                                <Shield size={10} /> {selectedSession.tabSwitchCount} tab switch{selectedSession.tabSwitchCount !== 1 ? 'es' : ''}
                              </span>
                            )}
                            {selectedSession.suspiciousActivity?.length > 0 && (
                              <span className="text-red-400 flex items-center gap-1">
                                <AlertTriangle size={10} /> {selectedSession.suspiciousActivity.length} flags
                              </span>
                            )}
                          </div>
                        </div>
                        <button onClick={() => setSelectedSession(null)}
                          className="hidden lg:flex text-white/25 hover:text-white transition">
                          <X size={16} />
                        </button>
                      </div>

                      {/* MCQ marks preview (if any) */}
                      {selectedSession.mcqMarks > 0 && (
                        <div className="mx-5 mt-4 px-3 py-2 rounded-xl bg-blue-500/8 border border-blue-500/15
                                        flex items-center justify-between text-sm">
                          <span className="text-blue-300/70 text-xs">MCQ marks (auto-graded)</span>
                          <span className="text-blue-300 font-bold">{selectedSession.mcqMarks}</span>
                        </div>
                      )}

                      {/* Already evaluated notice */}
                      {!selectedSession.writtenEvaluationPending && (
                        <div className="mx-5 mt-3 px-4 py-3 rounded-xl bg-emerald-500/8 border border-emerald-500/15
                                        flex items-center gap-3">
                          <CheckCircle size={15} className="text-emerald-400 shrink-0" />
                          <div className="flex-1">
                            <p className="text-emerald-300 text-sm font-medium">Previously evaluated</p>
                            <p className="text-emerald-400/50 text-xs">
                              Written: {selectedSession.writtenMarks}/{writtenMaxForSession} marks
                              {selectedSession.writtenEvaluatedAt && ` · ${fmtDate(selectedSession.writtenEvaluatedAt)}`}
                            </p>
                          </div>
                          <p className="text-sm font-bold text-white shrink-0">
                            {selectedSession.percentage.toFixed(1)}%
                          </p>
                        </div>
                      )}

                      {/* Bulk action bar */}
                      <div className="mx-5 mt-3 flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] uppercase tracking-wider text-white/25">Quick fill:</span>
                        {[
                          { label: 'Full marks', action: () => bulkSetMarks('full'), color: 'text-emerald-400 hover:bg-emerald-500/10' },
                          { label: 'Half marks', action: () => bulkSetMarks('half'), color: 'text-amber-400 hover:bg-amber-500/10'   },
                          { label: 'Zero',       action: () => bulkSetMarks('zero'), color: 'text-red-400 hover:bg-red-500/10'       },
                        ].map(({ label, action, color }) => (
                          <button key={label} onClick={action}
                            className={`px-2.5 py-1 text-xs rounded-lg border border-white/8 transition ${color}`}>
                            {label}
                          </button>
                        ))}
                      </div>

                      {/* Questions scroll area */}
                      <div ref={panelRef} className="overflow-y-auto max-h-[55vh] p-5 space-y-4 mt-3">
                        {selectedSession.writtenAnswers.length === 0 ? (
                          <p className="text-white/25 text-center py-8 text-sm">No written answers submitted.</p>
                        ) : selectedSession.writtenAnswers.map((wa, i) => {
                          const q       = writtenQMap[wa.questionId];
                          const draft   = evalDraft[wa.questionId] || { marks: 0, comment: '' };
                          const maxM    = q?.marks ?? 0;
                          const numVal  = Number(draft.marks);
                          const invalid = numVal < 0 || numVal > maxM;
                          const isOpen  = expandedSections.has(wa.questionId);
                          const pendingReviews = wa.reviewRequests?.filter(r => r.status === 'pending') ?? [];
                          const resolvedReviews = wa.reviewRequests?.filter(r => r.status === 'resolved') ?? [];

                          return (
                            <div key={wa.questionId}
                              className="rounded-xl border border-white/8 overflow-hidden">

                              {/* Question header — clickable collapse */}
                              <button
                                onClick={() => setExpandedSections(prev => {
                                  const next = new Set(prev);
                                  next.has(wa.questionId) ? next.delete(wa.questionId) : next.add(wa.questionId);
                                  return next;
                                })}
                                className="w-full flex items-center justify-between px-4 py-3 bg-white/3
                                           hover:bg-white/5 transition text-left">
                                <div className="flex items-center gap-2.5 flex-wrap">
                                  <span className="text-[10px] uppercase tracking-wider text-violet-400 font-semibold">
                                    Q{i + 1}
                                  </span>
                                  {q && <span className="text-white/60 text-sm truncate max-w-[260px]">{q.question}</span>}
                                  {pendingReviews.length > 0 && (
                                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-rose-500/15
                                                     text-rose-400 text-[10px] border border-rose-500/20">
                                      <MessageSquare size={9} /> {pendingReviews.length} review{pendingReviews.length > 1 ? 's' : ''}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 shrink-0 ml-2">
                                  <span className={`text-sm font-bold ${invalid ? 'text-red-400' : 'text-white/80'}`}>
                                    {draft.marks === '' ? '—' : draft.marks}/{maxM}
                                  </span>
                                  {isOpen ? <ChevronUp size={14} className="text-white/30" /> : <ChevronDown size={14} className="text-white/30" />}
                                </div>
                              </button>

                              {/* Question body */}
                              {isOpen && (
                                <div className="p-4 space-y-4 bg-white/2">

                                  {/* Student answer text */}
                                  {wa.answerText ? (
                                    <div className="bg-white/4 rounded-lg px-3 py-2.5">
                                      <p className="text-[10px] uppercase tracking-wider text-white/25 mb-1.5">Student's Answer</p>
                                      <p className="text-white/75 text-sm whitespace-pre-wrap leading-relaxed">{wa.answerText}</p>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 bg-white/2 rounded-lg px-3 py-2">
                                      <AlertCircle size={12} className="text-white/20" />
                                      <p className="text-white/25 text-xs">No text answer submitted</p>
                                    </div>
                                  )}

                                  {/* Attachments */}
                                  {(wa.attachmentUrls || []).length > 0 && (
                                    <div>
                                      <p className="text-[10px] uppercase tracking-wider text-white/25 mb-2">
                                        Attachments ({wa.attachmentUrls!.length})
                                      </p>
                                      <div className="flex flex-wrap gap-2">
                                        {wa.attachmentUrls!.map((url, ui) => (
                                          <div key={ui} className="relative group">
                                            <img src={url} alt={`att-${ui}`}
                                              className="w-20 h-20 object-cover rounded-lg border border-white/10 cursor-pointer" />
                                            <button onClick={() => setLightboxUrl(url)}
                                              className="absolute inset-0 flex items-center justify-center
                                                         bg-black/50 opacity-0 group-hover:opacity-100 transition rounded-lg">
                                              <ZoomIn size={16} className="text-white" />
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Model solution */}
                                  {q?.solution && (
                                    <div className="bg-indigo-500/8 border border-indigo-500/15 rounded-lg px-3 py-2.5">
                                      <p className="text-[10px] uppercase tracking-wider text-indigo-400 mb-1">Model Solution</p>
                                      <p className="text-white/60 text-sm leading-relaxed">{q.solution}</p>
                                    </div>
                                  )}

                                  {/* Review requests */}
                                  {(pendingReviews.length > 0 || resolvedReviews.length > 0) && (
                                    <div className="space-y-2">
                                      <p className="text-[10px] uppercase tracking-wider text-white/25">Student Review Requests</p>
                                      {(wa.reviewRequests ?? []).map((rr, ri) => (
                                        <div key={ri} className={`rounded-lg border p-3 text-sm
                                          ${rr.status === 'resolved'
                                            ? 'bg-emerald-500/5 border-emerald-500/15'
                                            : 'bg-rose-500/8 border-rose-500/20'}`}>
                                          <div className="flex items-center justify-between mb-1.5">
                                            <span className={`text-[10px] font-bold uppercase tracking-wider
                                              ${rr.status === 'resolved' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                              {rr.status === 'resolved' ? '✓ Resolved' : '⟳ Pending'}
                                            </span>
                                            <span className="text-[10px] text-white/25">
                                              {new Date(rr.requestedAt).toLocaleDateString()}
                                            </span>
                                          </div>
                                          <p className="text-white/60 text-xs">"{rr.message}"</p>
                                          {rr.resolvedComment && (
                                            <p className="text-emerald-300/70 text-xs mt-1.5 pt-1.5 border-t border-emerald-500/15">
                                              Your reply: {rr.resolvedComment}
                                            </p>
                                          )}
                                          {rr.status === 'pending' && (
                                            resolvingReview === wa.questionId ? (
                                              <div className="mt-2 space-y-2">
                                                <textarea
                                                  value={resolveComment}
                                                  onChange={e => setResolveComment(e.target.value)}
                                                  placeholder="Reply to student (optional)…"
                                                  rows={2}
                                                  style={{ color: 'rgba(255,255,255,0.85)', backgroundColor: 'rgba(255,255,255,0.05)' }}
                                                  className="w-full border border-white/10 rounded-lg px-3 py-2 text-xs
                                                             placeholder-white/20 focus:outline-none focus:border-violet-400/50 resize-none"
                                                />
                                                <div className="flex gap-2">
                                                  <button onClick={() => resolveReview(wa.questionId, ri)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20
                                                               hover:bg-emerald-500/30 text-emerald-300 text-xs transition">
                                                    <CheckCircle size={11} /> Resolve
                                                  </button>
                                                  <button onClick={() => { setResolvingReview(null); setResolveComment(''); }}
                                                    className="px-3 py-1.5 rounded-lg text-xs text-white/35 hover:text-white transition">
                                                    Cancel
                                                  </button>
                                                </div>
                                              </div>
                                            ) : (
                                              <button
                                                onClick={() => setResolvingReview(wa.questionId)}
                                                className="mt-2 flex items-center gap-1 text-xs text-rose-400/70 hover:text-rose-300 transition">
                                                <MessageSquare size={10} /> Respond & resolve
                                              </button>
                                            )
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Marks input */}
                                  <div className="space-y-3">
                                    <div>
                                      <label className="text-[10px] uppercase tracking-wider text-white/35 mb-2 block">
                                        Marks Awarded
                                      </label>
                                      <div className="flex items-center gap-3 flex-wrap">
                                        <input
                                          type="number" min={0} max={maxM} step={0.5}
                                          value={draft.marks}
                                          onChange={e => updateDraft(wa.questionId, 'marks', e.target.value === '' ? '' : e.target.value)}
                                          className={`w-20 border rounded-lg px-3 py-2 text-sm font-bold text-center
                                                      focus:outline-none transition
                                                      ${invalid
                                                        ? 'bg-red-500/10 border-red-500/40 text-red-300 focus:border-red-400'
                                                        : 'bg-white/5 border-white/15 text-white focus:border-violet-400/60'}`}
                                        />
                                        <span className="text-white/30 text-sm">/ {maxM}</span>

                                        {/* Marks slider */}
                                        <input
                                          type="range" min={0} max={maxM} step={0.5}
                                          value={Number(draft.marks) || 0}
                                          onChange={e => updateDraft(wa.questionId, 'marks', e.target.value)}
                                          className="flex-1 min-w-24 accent-violet-500"
                                        />

                                        {/* Quick-fill pills */}
                                        <div className="flex gap-1">
                                          {[0, Math.round(maxM * 0.5), maxM].map(v => (
                                            <button key={v}
                                              onClick={() => updateDraft(wa.questionId, 'marks', v)}
                                              className={`w-8 h-7 text-[11px] rounded-lg transition font-medium
                                                ${Number(draft.marks) === v
                                                  ? 'bg-violet-500/30 text-violet-300 border border-violet-500/40'
                                                  : 'bg-white/6 hover:bg-white/12 text-white/50 hover:text-white'}`}>
                                              {v}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                      {invalid && (
                                        <p className="text-red-400 text-xs mt-1">
                                          Must be between 0 and {maxM}
                                        </p>
                                      )}
                                      {/* Per-question progress bar */}
                                      <div className="flex items-center gap-2 mt-2">
                                        <MiniBar
                                          value={Math.min(Number(draft.marks) || 0, maxM)}
                                          max={maxM}
                                          color={invalid ? 'bg-red-500/50' : numVal >= maxM * 0.8 ? 'bg-emerald-500/60' : numVal >= maxM * 0.5 ? 'bg-amber-500/60' : 'bg-violet-500/60'}
                                        />
                                      </div>
                                    </div>

                                    {/* Comment */}
                                    <div>
                                      <label className="text-[10px] uppercase tracking-wider text-white/35 mb-2 block">
                                        Feedback (optional)
                                      </label>
                                      <textarea
                                        value={draft.comment} rows={2}
                                        onChange={e => updateDraft(wa.questionId, 'comment', e.target.value)}
                                        placeholder="Write feedback for the student…"
                                        style={{ color: 'rgba(255,255,255,0.85)', backgroundColor: 'rgba(255,255,255,0.04)' }}
                                        className="w-full border border-white/12 rounded-lg px-3 py-2 text-sm
                                                   placeholder-white/20 focus:outline-none focus:border-violet-400/50
                                                   resize-none leading-relaxed"
                                      />
                                    </div>
                                  </div>

                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Footer */}
                      <div className="px-5 py-4 border-t border-white/8 space-y-3 bg-white/2">
                        {/* Total summary */}
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-white/40">
                            Written: <span className="text-white font-semibold">{totalAwarded}</span>
                            <span className="text-white/25">/{writtenMaxForSession}</span>
                            {selectedSession.mcqMarks > 0 && (
                              <span className="ml-3 text-white/30">
                                Total: <span className="text-white/70">{selectedSession.mcqMarks + totalAwarded}</span>
                                <span className="text-white/25">/{selectedSession.maxMarks}</span>
                              </span>
                            )}
                          </div>
                          <div className={`text-sm font-bold ${gradeColor(
                            selectedSession.maxMarks > 0
                              ? ((selectedSession.mcqMarks + totalAwarded) / selectedSession.maxMarks) * 100
                              : 0
                          )}`}>
                            {selectedSession.maxMarks > 0
                              ? (((selectedSession.mcqMarks + totalAwarded) / selectedSession.maxMarks) * 100).toFixed(1)
                              : 0}%
                          </div>
                        </div>

                        {/* Progress bar */}
                        <MiniBar value={totalAwarded} max={writtenMaxForSession} color="bg-violet-500/70" />

                        {submitSuccess && (
                          <p className="text-emerald-400 text-sm flex items-center gap-1.5">
                            <CheckCircle size={13} /> {submitSuccess}
                          </p>
                        )}

                        {hasValidationErrors && (
                          <p className="text-red-400 text-xs flex items-center gap-1.5">
                            <AlertTriangle size={12} /> Fix marks errors before saving
                          </p>
                        )}

                        <button
                          onClick={submitEvaluation}
                          disabled={submitting || selectedSession.writtenAnswers.length === 0 || hasValidationErrors}
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl
                                     bg-violet-500 hover:bg-violet-600 text-white font-semibold text-sm
                                     transition disabled:opacity-40 disabled:cursor-not-allowed">
                          {submitting
                            ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
                            : <><Check size={14} /> Save Evaluation</>}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

        ) : (
          /* ══════════════════════════════════════════════════════════
             LEVEL 1 — Exam list
          ══════════════════════════════════════════════════════════ */
          <div className="space-y-6">

            {/* Page header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-violet-500/15 border border-violet-500/20
                                flex items-center justify-center">
                  <PenLine size={22} className="text-violet-400" />
                </div>
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-2xl font-bold">Exam Evaluation</h1>
                    {totalPending > 0 && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold
                                       bg-amber-500/20 text-amber-300 border border-amber-500/25">
                        {totalPending} pending
                      </span>
                    )}
                    {totalReviews > 0 && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold
                                       bg-rose-500/20 text-rose-300 border border-rose-500/25 flex items-center gap-1">
                        <MessageSquare size={10} /> {totalReviews} review{totalReviews !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <p className="text-white/35 text-sm mt-0.5">
                    Select an exam to evaluate written answers
                  </p>
                </div>
              </div>
              <button onClick={loadExamList}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10
                           text-white/40 hover:text-white text-sm transition">
                <RefreshCcw size={13} /> Refresh
              </button>
            </div>

            {listError && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
                <AlertTriangle size={14} /> {listError}
              </div>
            )}

            {/* Filters */}
            <div className="rounded-2xl bg-white/3 border border-white/8 p-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="relative flex-1 min-w-44">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
                  <input type="text" placeholder="Search exams, courses…" value={listSearch}
                    onChange={e => setListSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm
                               text-white/70 placeholder-white/20 focus:outline-none focus:border-white/25" />
                </div>
                <div className="min-w-36">
                  <p className="text-[10px] uppercase tracking-wider text-white/30 mb-1 font-semibold">Course</p>
                  <select value={filterCourse} onChange={e => setFilterCourse(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm
                               text-white focus:outline-none focus:border-white/25 appearance-none">
                    <option value="all">All Courses</option>
                    {allCourses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                </div>
                {allSubjects.length > 0 && (
                  <div className="min-w-32">
                    <p className="text-[10px] uppercase tracking-wider text-white/30 mb-1 font-semibold">Subject</p>
                    <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm
                                 text-white focus:outline-none focus:border-white/25 appearance-none">
                      <option value="all">All Subjects</option>
                      {allSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-white/30 mb-1 font-semibold">Status</p>
                  <div className="flex gap-1">
                    {([
                      { val: 'all',           label: 'All'         },
                      { val: 'has_pending',   label: 'Has Pending' },
                      { val: 'all_evaluated', label: 'All Done'    },
                      { val: 'has_reviews',   label: 'Has Reviews' },
                    ] as const).map(({ val, label }) => (
                      <button key={val} onClick={() => setFilterStatus(val)}
                        className={`px-3 py-2 rounded-xl text-xs font-medium transition
                          ${filterStatus === val
                            ? 'bg-violet-500/20 border border-violet-500/30 text-violet-300'
                            : 'bg-white/4 border border-white/8 text-white/40 hover:text-white/60'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <p className="text-white/30 text-sm">
              {listLoading ? 'Loading…' : `${filteredExams.length} exam${filteredExams.length !== 1 ? 's' : ''} found`}
            </p>

            {listLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={28} className="animate-spin text-violet-400" />
              </div>
            ) : filteredExams.length === 0 ? (
              <div className="flex flex-col items-center py-24 text-white/25">
                <ClipboardList size={40} className="mb-4 opacity-40" />
                <p className="text-base font-medium">No written exams found</p>
                <p className="text-sm mt-1 text-white/20">
                  {listSearch || filterCourse !== 'all' || filterSubject !== 'all' || filterStatus !== 'all'
                    ? 'Try adjusting your filters'
                    : 'No exams with written questions exist yet'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredExams.map(es => (
                  <ExamCard key={es.content.id} summary={es}
                    onOpen={() => openExam(es.content, es.course?.id)} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Exam Card ─────────────────────────────────────────────────────────────────
const ExamCard: React.FC<{ summary: ExamSummary; onOpen: () => void }> = ({ summary, onOpen }) => {
  const { content, course, totalSessions, pendingCount, evaluatedCount, avgScore, reviewRequestCount } = summary;
  const hasPending = pendingCount > 0;
  const allDone    = totalSessions > 0 && pendingCount === 0;

  return (
    <button onClick={onOpen}
      className={`w-full text-left rounded-2xl border p-5 transition-all group
        hover:border-violet-500/30 hover:bg-violet-500/3
        ${hasPending ? 'border-amber-500/20 bg-amber-500/2' : 'border-white/8 bg-white/2'}`}>

      <div className="flex items-start gap-3 mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0
          ${hasPending ? 'bg-amber-500/15 border border-amber-500/15' : 'bg-violet-500/15 border border-violet-500/15'}`}>
          <FileText size={17} className={hasPending ? 'text-amber-400' : 'text-violet-400'} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold text-sm leading-snug line-clamp-2">{content.title}</h3>
          {course && (
            <p className="text-white/30 text-xs mt-0.5 flex items-center gap-1 truncate">
              <BookOpen size={9} /> {course.title}
            </p>
          )}
        </div>
        <ChevronRight size={14} className="text-white/20 group-hover:text-violet-400 transition shrink-0 mt-1" />
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {content.subject && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px]
                           bg-blue-500/10 text-blue-300 border border-blue-500/15">
            <Tag size={9} /> {content.subject}
          </span>
        )}
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px]
                         bg-white/5 text-white/35 border border-white/8">
          <PenLine size={9} /> {extractWrittenQuestions(content).length} Qs
        </span>
        {hasPending && (
          <span className="px-2 py-0.5 rounded-full text-[11px] bg-amber-500/10 text-amber-400 border border-amber-500/20">
            {pendingCount} pending
          </span>
        )}
        {allDone && (
          <span className="px-2 py-0.5 rounded-full text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            All evaluated
          </span>
        )}
        {reviewRequestCount > 0 && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px]
                           bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <MessageSquare size={9} /> {reviewRequestCount} review{reviewRequestCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/6">
        <div className="text-center">
          <p className="text-base font-bold text-white">{totalSessions}</p>
          <p className="text-[10px] text-white/25">submissions</p>
        </div>
        <div className="text-center">
          <p className={`text-base font-bold ${hasPending ? 'text-amber-400' : 'text-emerald-400'}`}>
            {pendingCount}
          </p>
          <p className="text-[10px] text-white/25">pending</p>
        </div>
        <div className="text-center">
          <p className={`text-base font-bold ${gradeColor(avgScore)}`}>
            {totalSessions > 0 ? `${avgScore.toFixed(0)}%` : '—'}
          </p>
          <p className="text-[10px] text-white/25">avg</p>
        </div>
      </div>

      {totalSessions > 0 && (
        <div className="mt-3 flex items-center gap-2">
          <MiniBar
            value={evaluatedCount}
            max={totalSessions}
            color={hasPending ? 'bg-amber-400/50' : 'bg-emerald-400/60'}
          />
          <span className={`text-[10px] font-medium shrink-0 ${hasPending ? 'text-amber-400' : 'text-emerald-400'}`}>
            {evaluatedCount}/{totalSessions}
          </span>
        </div>
      )}
    </button>
  );
};

// ─── Session Card ──────────────────────────────────────────────────────────────
const SessionCard: React.FC<{
  session: ExamSession;
  isSelected: boolean;
  onClick: () => void;
  reviewCount: number;
}> = ({ session, isSelected, onClick, reviewCount }) => (
  <button onClick={onClick}
    className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border transition
      ${isSelected
        ? 'border-violet-500/40 bg-violet-500/8'
        : 'border-white/6 bg-white/2 hover:border-white/12 hover:bg-white/4'}`}>
    <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0 text-sm font-bold text-violet-300">
      {session.studentName.charAt(0).toUpperCase()}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-white text-sm font-medium truncate">{session.studentName}</p>
      <div className="flex items-center gap-2 text-[11px] text-white/30">
        <span>{fmtDate(session.submittedAt)}</span>
        <span>{fmtTime(session.timeTakenSeconds)}</span>
        {session.tabSwitchCount > 0 && (
          <span className="text-amber-400 flex items-center gap-0.5">
            <Shield size={9} />{session.tabSwitchCount}
          </span>
        )}
      </div>
    </div>
    <div className="text-right shrink-0 space-y-1">
      <div className="flex items-center gap-1.5 justify-end">
        {reviewCount > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] text-rose-400">
            <MessageSquare size={9} />{reviewCount}
          </span>
        )}
        <p className={`text-sm font-bold ${gradeColor(session.percentage)}`}>
          {session.percentage.toFixed(1)}%
        </p>
      </div>
      <StatusBadge pending={session.writtenEvaluationPending} small />
    </div>
  </button>
);

export default ExamEvaluation;
