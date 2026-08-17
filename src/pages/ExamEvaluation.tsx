// src/pages/ExamEvaluation.tsx
// Production-grade Teacher Evaluation Hub
//
// Features:
//  • 3-level drill-down: Exam list → Session list → Evaluation panel
//  • Exam list: search, filter by course / subject / status / review requests
//  • Session list: sort by name / submitted / score / status, filter, search
//  • Evaluation panel:
//    – Per-question collapsible cards with student answer + attachments + model solution
//    – Marks input (number + slider + quick-fill 0/½/full) with live validation
//    – Feedback textarea per question
//    – Bulk fill: all full / half / zero in one click
//    – MCQ marks preview (auto-graded, read-only)
//    – Running total with live percentage
//    – Optimistic UI update after save
//  • Review requests inbox: teacher can respond & resolve per-question
//  • Publish results
//  • Score distribution bar chart
//  • Anti-cheat flags shown per session

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, PenLine, CheckCircle, AlertTriangle, Clock, BarChart2, Users,
  Award, Check, X, Loader2, ZoomIn, Send, RefreshCcw, Search,
  BookOpen, FileText, ChevronRight, ClipboardList, AlertCircle, Tag,
  Shield, MessageSquare, ChevronDown, ChevronUp, TrendingUp,
  SortAsc, SortDesc, Eye, EyeOff,
} from 'lucide-react';
import { useDashboard } from '../contexts/DashboardContext';
import { contentService, Content, WrittenQuestion } from '../services/contentService';
import { courseService, Course } from '../services/courseService';
import {
  examService,
  ExamSession,
  WrittenEvaluationPayload,
  WrittenAnswer,
  ReviewRequest,
} from '../services/examService';
import { courseAssignmentService, CourseAssignment } from '../services/courseAssignmentService';
import { notificationService } from '../services/notificationService';

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
  pendingReviewCount: number;
}

type SessionSort = 'name' | 'submitted' | 'score' | 'status';
type SortDir     = 'asc' | 'desc';
type ListFilter  = 'all' | 'has_pending' | 'all_evaluated' | 'has_reviews';
type SessFilter  = 'all' | 'pending' | 'evaluated' | 'reviews';

// ─── Helpers ───────────────────────────────────────────────────────────────────
const fmtTime = (secs: number): string => {
  if (!secs) return '—';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const fmtDate = (d?: Date | any): string => {
  if (!d) return '—';
  // Handle Firestore Timestamps that may slip through without conversion
  const date = d?.toDate ? d.toDate() : (d instanceof Date ? d : new Date(d));
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

const fmtShortDate = (d?: Date | any): string => {
  if (!d) return '—';
  const date = d?.toDate ? d.toDate() : (d instanceof Date ? d : new Date(d));
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const gradeColor = (pct: number) =>
  pct >= 80 ? 'text-emerald-400' :
  pct >= 60 ? 'text-amber-400'   :
  pct >= 40 ? 'text-orange-400'  : 'text-red-400';

const extractWrittenQs = (content: Content): WrittenQuestion[] => {
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

const pendingReviewsInSession = (s: ExamSession): number =>
  s.writtenAnswers.reduce(
    (t, wa) => t + (wa.reviewRequests?.filter(r => r.status === 'pending').length ?? 0), 0
  );

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ pending: boolean; tiny?: boolean }> = ({ pending, tiny }) => (
  <span className={`font-bold uppercase tracking-wider rounded-full border whitespace-nowrap
    ${tiny ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5'}
    ${pending
      ? 'bg-amber-500/15 text-amber-400 border-amber-500/25'
      : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'}`}>
    {pending ? 'Pending' : 'Evaluated'}
  </span>
);

const ProgressBar: React.FC<{ value: number; max: number; colorClass?: string }> = ({
  value, max, colorClass = 'bg-violet-500/60',
}) => (
  <div className="flex-1 h-1 rounded-full bg-white/6 overflow-hidden">
    <div
      className={`h-full rounded-full transition-all duration-300 ${colorClass}`}
      style={{ width: max > 0 ? `${Math.min(100, (value / max) * 100).toFixed(1)}%` : '0%' }}
    />
  </div>
);

const StatCard: React.FC<{
  label: string; value: string | number; icon: React.ReactNode; valueClass?: string;
}> = ({ label, value, icon, valueClass = 'text-white' }) => (
  <div className="rounded-xl bg-white/3 border border-white/7 px-3 py-3 text-center min-w-[80px] shrink-0 sm:min-w-0 sm:shrink sm:p-3.5">
    <div className="flex justify-center mb-1 text-white/40">{icon}</div>
    <p className={`text-base sm:text-lg font-bold leading-tight ${valueClass}`}>{value}</p>
    <p className="text-[9px] sm:text-[10px] text-white/30 mt-0.5">{label}</p>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// EXAM CARD
// ═══════════════════════════════════════════════════════════════════════════════
const ExamCard: React.FC<{ summary: ExamSummary; onOpen: () => void }> = ({ summary, onOpen }) => {
  const { content, course, totalSessions, pendingCount, evaluatedCount, avgScore, pendingReviewCount } = summary;
  const hasPending = pendingCount > 0;

  return (
    <button onClick={onOpen}
      className={`w-full text-left rounded-2xl border p-5 transition-all group
        hover:border-violet-500/25 hover:bg-violet-500/3
        ${hasPending ? 'border-amber-500/20 bg-amber-500/[0.02]' : 'border-white/8 bg-white/[0.015]'}`}>

      <div className="flex items-start gap-3 mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border
          ${hasPending ? 'bg-amber-500/15 border-amber-500/20' : 'bg-violet-500/15 border-violet-500/15'}`}>
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
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-blue-500/10 text-blue-300 border border-blue-500/15">
            <Tag size={9} /> {content.subject}
          </span>
        )}
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-white/5 text-white/35 border border-white/8">
          <PenLine size={9} /> {extractWrittenQs(content).length} written Qs
        </span>
        {hasPending ? (
          <span className="px-2 py-0.5 rounded-full text-[11px] bg-amber-500/10 text-amber-400 border border-amber-500/20">
            {pendingCount} pending
          </span>
        ) : totalSessions > 0 ? (
          <span className="px-2 py-0.5 rounded-full text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            All evaluated
          </span>
        ) : null}
        {pendingReviewCount > 0 && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <MessageSquare size={9} /> {pendingReviewCount} review{pendingReviewCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/6 mb-3">
        <div className="text-center">
          <p className="text-base font-bold text-white">{totalSessions}</p>
          <p className="text-[10px] text-white/25">submissions</p>
        </div>
        <div className="text-center">
          <p className={`text-base font-bold ${hasPending ? 'text-amber-400' : 'text-emerald-400'}`}>{pendingCount}</p>
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
        <div className="flex items-center gap-2">
          <ProgressBar value={evaluatedCount} max={totalSessions}
            colorClass={hasPending ? 'bg-amber-400/50' : 'bg-emerald-400/60'} />
          <span className={`text-[10px] font-medium shrink-0 ${hasPending ? 'text-amber-400' : 'text-emerald-400'}`}>
            {evaluatedCount}/{totalSessions}
          </span>
        </div>
      )}
    </button>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SESSION CARD
// ═══════════════════════════════════════════════════════════════════════════════
const SessionCard: React.FC<{
  session: ExamSession;
  isSelected: boolean;
  pendingReviews: number;
  onClick: () => void;
}> = ({ session, isSelected, pendingReviews, onClick }) => (
  <button onClick={onClick}
    className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border transition-all
      ${isSelected
        ? 'border-violet-500/40 bg-violet-500/8'
        : 'border-white/6 bg-white/[0.015] hover:border-white/12 hover:bg-white/4'}`}>
    <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0 text-sm font-bold text-violet-300">
      {session.studentName.charAt(0).toUpperCase()}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-white text-sm font-medium truncate">{session.studentName}</p>
      <div className="flex items-center gap-2 text-[11px] text-white/30 mt-0.5">
        <span>{fmtDate(session.submittedAt)}</span>
        <span>· {fmtTime(session.timeTakenSeconds)}</span>
        {session.tabSwitchCount > 0 && (
          <span className="flex items-center gap-0.5 text-amber-400/70">
            <Shield size={9} /> {session.tabSwitchCount}
          </span>
        )}
      </div>
    </div>
    <div className="text-right shrink-0 space-y-1">
      <div className="flex items-center gap-1.5 justify-end">
        {pendingReviews > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] text-rose-400">
            <MessageSquare size={9} /> {pendingReviews}
          </span>
        )}
        <span className={`text-sm font-bold ${gradeColor(session.percentage)}`}>
          {session.percentage.toFixed(1)}%
        </span>
      </div>
      <StatusBadge pending={session.writtenEvaluationPending} tiny />
    </div>
  </button>
);

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const ExamEvaluation: React.FC = () => {
  const { contentId: urlContentId, courseId } = useParams<{ contentId?: string; courseId?: string }>();
  const navigate = useNavigate();
  const { user } = useDashboard();

  // Level 1
  const [examSummaries, setExamSummaries] = useState<ExamSummary[]>([]);
  const [allCourses, setAllCourses]       = useState<Course[]>([]);
  const [listLoading, setListLoading]     = useState(true);
  const [listError, setListError]         = useState('');
  const [listSearch, setListSearch]       = useState('');
  const [filterCourse, setFilterCourse]   = useState('all');
  const [filterSubject, setFilterSubject] = useState('all');
  const [filterStatus, setFilterStatus]   = useState<ListFilter>('all');

  // Teacher assignment permissions for exam evaluation access
  // Each entry: { courseId, allowedSubjects (empty = all subjects for that course) }
  const [teacherExamAssignments, setTeacherExamAssignments] = useState<
    Array<{ courseId: string; allowedSubjects: string[] }>
  >([]);

  // Level 2
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [sessions, setSessions]               = useState<ExamSession[]>([]);
  const [evalLoading, setEvalLoading]         = useState(false);
  const [evalError, setEvalError]             = useState('');
  const [successMsg, setSuccessMsg]           = useState('');
  const [stats, setStats]                     = useState<any>(null);
  const [publishing, setPublishing]           = useState(false);
  const [showStats, setShowStats]             = useState(true);
  const [sessFilter, setSessFilter]           = useState<SessFilter>('all');
  const [sessSearch, setSessSearch]           = useState('');
  const [sessSort, setSessSort]               = useState<SessionSort>('submitted');
  const [sortDir, setSortDir]                 = useState<SortDir>('desc');

  // Level 3
  const [selectedSession, setSelectedSession] = useState<ExamSession | null>(null);
  const [evalDraft, setEvalDraft]             = useState<EvalDraft>({});
  const [submitting, setSubmitting]           = useState(false);
  const [submitSuccess, setSubmitSuccess]     = useState('');
  const [lightboxUrl, setLightboxUrl]         = useState<string | null>(null);
  const [collapsedQs, setCollapsedQs]         = useState<Set<string>>(new Set());
  const [resolvingQId, setResolvingQId]       = useState<string | null>(null);
  const [resolveIdx, setResolveIdx]           = useState(-1);
  const [resolveText, setResolveText]         = useState('');
  const [resolving, setResolving]             = useState(false);

  const panelScrollRef = useRef<HTMLDivElement>(null);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);

  // Boot
  useEffect(() => {
    if (user) {
      if (user.role === 'teacher') {
        // Load teacher's exam assignments first, then use them to filter the exam list
        courseAssignmentService.getTeacherAssignments(user.uid).then(allAssignments => {
          const examPerms = allAssignments
            .filter(a => a.isActive && a.permissions.includes('exams'))
            .map(a => ({ courseId: a.courseId, allowedSubjects: a.allowedSubjects || [] }));
          setTeacherExamAssignments(examPerms);
          loadExamList(examPerms);
        }).catch(() => loadExamList([]));
      } else {
        loadExamList();
      }
    }
  }, [user]);
  useEffect(() => {
    if (urlContentId && examSummaries.length > 0 && !selectedContent) {
      const found = examSummaries.find(s => s.content.id === urlContentId);
      if (found) openExam(found.content, courseId);
    }
  }, [urlContentId, examSummaries]);

  // ── Load list ─────────────────────────────────────────────────────────────
  const loadExamList = async (
    examPerms?: Array<{ courseId: string; allowedSubjects: string[] }>
  ) => {
    try {
      setListLoading(true); setListError('');

      const isTeacher  = user?.role === 'teacher';
      const isAdminMgr = user?.role === 'admin' || user?.role === 'manager';
      // Use passed-in perms (on boot) or stored state (on manual refresh)
      const activePerms = examPerms ?? teacherExamAssignments;

      // Teachers with no exam permissions → empty list
      if (isTeacher && activePerms.length === 0) {
        setExamSummaries([]);
        setAllCourses([]);
        setListLoading(false);
        return;
      }

      const [allContent, courses] = await Promise.all([
        isAdminMgr
          ? contentService.getAllContent()
          : isTeacher
            // Teachers aren't content creators — fetch all, filter by assigned courses below
            ? contentService.getAllContent()
            : contentService.getContentByUser(user?.uid || ''),
        isAdminMgr
          ? courseService.getAllCourses()
          : isTeacher
            // Teachers are assigned to courses, not instructors of them.
            // Fetch all courses then filter to only the ones in their assignments.
            ? courseService.getAllCourses().then(all =>
                all.filter(c => activePerms.some(p => p.courseId === c.id))
              )
            : courseService.getCoursesByInstructor(user?.uid || ''),
      ]);
      setAllCourses(courses);

      // ── Build reverse map: contentId → courseId ──────────────────────────
      // Content documents do NOT store a courseId field. The relationship is
      // one-way: Course.contentStructure[].contentId → Content.
      // We walk all loaded courses' contentStructure to invert the mapping.
      const contentToCourseId = new Map<string, string>();
      const walkNodes = (nodes: any[], courseId: string) => {
        for (const node of nodes || []) {
          if (node.contentId) contentToCourseId.set(node.contentId, courseId);
          if (node.children?.length) walkNodes(node.children, courseId);
        }
      };
      courses.forEach(c => walkNodes(c.contentStructure || [], c.id));

      // Build the set of allowed courseId → Set<subject> for teachers
      // Empty subject set means all subjects for that course are allowed
      const permMap = new Map<string, Set<string>>();
      if (isTeacher) {
        activePerms.forEach(({ courseId, allowedSubjects }) => {
          permMap.set(courseId, new Set(allowedSubjects));
        });
      }

      const writtenExams = allContent.filter(c => {
        if (c.type !== 'exam' || extractWrittenQs(c).length === 0) return false;
        if (!isTeacher) return true; // admin/manager see all

        const contentCourseId = contentToCourseId.get(c.id);
        if (!contentCourseId || !permMap.has(contentCourseId)) return false;

        const allowedSubjects = permMap.get(contentCourseId)!;
        // Empty set = all subjects allowed for this course
        if (allowedSubjects.size === 0) return true;
        // Otherwise check if this content's subject is in the allowed list
        return allowedSubjects.has(c.subject || '');
      });

      const summaries = await Promise.all(
        writtenExams.map(async (content): Promise<ExamSummary> => {
          try {
            const allSess   = await examService.getAllSessionsForContent(content.id);
            const submitted = allSess.filter(s => ['submitted', 'auto_submitted'].includes(s.status));
            const pending   = submitted.filter(s => s.writtenEvaluationPending);
            const evaluated = submitted.filter(s => !s.writtenEvaluationPending);
            const scores    = evaluated.map(s => s.percentage);
            const resolvedCourseId = contentToCourseId.get(content.id);
            const course    = courses.find(c => c.id === resolvedCourseId) ?? null;
            return {
              content, course,
              totalSessions:     submitted.length,
              pendingCount:      pending.length,
              evaluatedCount:    evaluated.length,
              avgScore:          scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
              highestScore:      scores.length > 0 ? Math.max(...scores) : 0,
              pendingReviewCount: submitted.reduce((t, s) => t + pendingReviewsInSession(s), 0),
            };
          } catch {
            const resolvedCourseId = contentToCourseId.get(content.id);
            const course = courses.find(c => c.id === resolvedCourseId) ?? null;
            return { content, course, totalSessions: 0, pendingCount: 0, evaluatedCount: 0, avgScore: 0, highestScore: 0, pendingReviewCount: 0 };
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

  // ── Open exam ─────────────────────────────────────────────────────────────
  const openExam = async (content: Content, cId?: string) => {
    setEvalLoading(true); setEvalError('');
    setSelectedContent(content);
    setSelectedSession(null);
    setSessFilter('all'); setSessSearch('');
    try {
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

  // refreshSessions: reload session data without resetting successMsg or selectedSession
  const refreshSessions = useCallback(async () => {
    if (!selectedContent) return;
    try {
      const [s, st] = await Promise.all([
        examService.getAllSessionsForContent(selectedContent.id, courseId),
        examService.getExamStatistics(selectedContent.id),
      ]);
      setSessions(s.filter(sess => ['submitted', 'auto_submitted'].includes(sess.status)));
      setStats(st);
    } catch (e: any) {
      setEvalError(e.message || 'Failed to refresh.');
    }
  }, [selectedContent, courseId]);

  const refreshEval = useCallback(async () => {
    await refreshSessions();
    await loadExamList();
  }, [refreshSessions]);

  // ── Open session ──────────────────────────────────────────────────────────
  const openSession = useCallback((sess: ExamSession) => {
    setSelectedSession(sess);
    const draft: EvalDraft = {};
    sess.writtenAnswers.forEach(wa => {
      draft[wa.questionId] = { marks: wa.marksAwarded ?? 0, comment: wa.evaluatorComment ?? '' };
    });
    setEvalDraft(draft);
    setSubmitSuccess('');
    setResolvingQId(null);
    setCollapsedQs(new Set());
    setTimeout(() => panelScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }), 50);
  }, []);

  const updateDraft = useCallback((qId: string, field: 'marks' | 'comment', val: string | number) =>
    setEvalDraft(prev => ({
      ...prev,
      [qId]: { ...(prev[qId] || { marks: 0, comment: '' }), [field]: val },
    })), []);

  const bulkFill = (type: 'full' | 'half' | 'zero') => {
    if (!selectedSession) return;
    setEvalDraft(prev => {
      const next = { ...prev };
      selectedSession.writtenAnswers.forEach(wa => {
        const max = writtenQMap[wa.questionId]?.marks ?? 0;
        next[wa.questionId] = {
          marks: type === 'full' ? max : type === 'zero' ? 0 : Math.round(max / 2),
          comment: prev[wa.questionId]?.comment ?? '',
        };
      });
      return next;
    });
  };

  // ── Derived data ──────────────────────────────────────────────────────────
  const writtenQMap = useMemo(() => {
    const map: Record<string, WrittenQuestion> = {};
    if (selectedContent) extractWrittenQs(selectedContent).forEach(q => { map[q.id] = q; });
    return map;
  }, [selectedContent]);

  const writtenMaxForSession = useMemo(() =>
    selectedSession
      ? selectedSession.writtenAnswers.reduce((a, wa) => a + (writtenQMap[wa.questionId]?.marks ?? 0), 0)
      : 0,
  [selectedSession, writtenQMap]);

  const totalAwarded = useMemo(() =>
    Object.values(evalDraft).reduce((s, v) => s + (Number(v.marks) || 0), 0),
  [evalDraft]);

  const validationErrors = useMemo((): Record<string, string> => {
    if (!selectedSession) return {};
    const errs: Record<string, string> = {};
    selectedSession.writtenAnswers.forEach(wa => {
      const max = writtenQMap[wa.questionId]?.marks ?? 0;
      const v   = evalDraft[wa.questionId]?.marks;
      if (v === '' || v === undefined) { errs[wa.questionId] = 'Required'; return; }
      const n = Number(v);
      if (isNaN(n))     errs[wa.questionId] = 'Must be a number';
      else if (n < 0)   errs[wa.questionId] = 'Cannot be negative';
      else if (n > max) errs[wa.questionId] = `Max is ${max}`;
    });
    return errs;
  }, [evalDraft, selectedSession, writtenQMap]);

  const hasErrors = Object.keys(validationErrors).length > 0;

  const livePercent = useMemo(() => {
    if (!selectedSession || selectedSession.maxMarks === 0) return 0;
    return ((selectedSession.mcqMarks + totalAwarded) / selectedSession.maxMarks) * 100;
  }, [selectedSession, totalAwarded]);

  const pendingCount = useMemo(() => sessions.filter(s => s.writtenEvaluationPending).length, [sessions]);
  const reviewCount  = useMemo(() => sessions.reduce((t, s) => t + pendingReviewsInSession(s), 0), [sessions]);
  const totalPending = examSummaries.reduce((a, e) => a + e.pendingCount, 0);
  const totalReviews = examSummaries.reduce((a, e) => a + e.pendingReviewCount, 0);

  const allSubjects = useMemo(() => {
    const s = new Set<string>();
    examSummaries.forEach(es => { if (es.content.subject) s.add(es.content.subject); });
    return Array.from(s).sort();
  }, [examSummaries]);

  // Derive course list from exam summaries — uses es.course resolved via contentToCourseId map.
  // Content documents have no courseId field; the mapping is built from course.contentStructure.
  const coursesInExams = useMemo(() => {
    const seen = new Map<string, string>();
    examSummaries.forEach(es => {
      const cId = es.course?.id;
      if (cId && !seen.has(cId)) seen.set(cId, es.course!.title);
    });
    return Array.from(seen.entries()).map(([id, title]) => ({ id, title })).sort((a, b) => a.title.localeCompare(b.title));
  }, [examSummaries]);

  const filteredExams = useMemo(() => examSummaries.filter(es => {
    if (filterCourse  !== 'all' && es.course?.id !== filterCourse)         return false;
    if (filterSubject !== 'all' && es.content.subject !== filterSubject)   return false;
    if (filterStatus  === 'has_pending'   && es.pendingCount === 0)               return false;
    if (filterStatus  === 'all_evaluated' && es.pendingCount > 0)                 return false;
    if (filterStatus  === 'has_reviews'   && es.pendingReviewCount === 0)         return false;
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
    const filtered = sessions.filter(s => {
      const fOk =
        sessFilter === 'all'       ? true :
        sessFilter === 'pending'   ? s.writtenEvaluationPending :
        sessFilter === 'evaluated' ? !s.writtenEvaluationPending :
        pendingReviewsInSession(s) > 0;
      const sOk = !sessSearch ||
        s.studentName.toLowerCase().includes(sessSearch.toLowerCase()) ||
        (s.studentEmail || '').toLowerCase().includes(sessSearch.toLowerCase());
      return fOk && sOk;
    });
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sessSort === 'name')      cmp = a.studentName.localeCompare(b.studentName);
      if (sessSort === 'submitted') cmp = (a.submittedAt?.getTime() ?? 0) - (b.submittedAt?.getTime() ?? 0);
      if (sessSort === 'score')     cmp = a.percentage - b.percentage;
      if (sessSort === 'status')    cmp = Number(a.writtenEvaluationPending) - Number(b.writtenEvaluationPending);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [sessions, sessFilter, sessSearch, sessSort, sortDir]);

  const toggleSort = (col: SessionSort) => {
    if (sessSort === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSessSort(col); setSortDir('desc'); }
  };

  const scoreDist = useMemo(() => {
    const b = [0, 0, 0, 0, 0];
    sessions.filter(s => !s.writtenEvaluationPending).forEach(s => {
      const p = s.percentage;
      if (p < 40) b[0]++; else if (p < 60) b[1]++; else if (p < 80) b[2]++; else if (p < 90) b[3]++; else b[4]++;
    });
    return b;
  }, [sessions]);
  const maxBucket = Math.max(...scoreDist, 1);

  // ── Submit evaluation ─────────────────────────────────────────────────────
  const submitEvaluation = async () => {
    if (!selectedSession || !user || hasErrors) return;
    setSubmitting(true);
    try {
      const payload: WrittenEvaluationPayload = {
        sessionId:     selectedSession.id,
        evaluatorId:   user.uid,
        evaluatorName: user.name,
        answers: Object.entries(evalDraft).map(([qId, v]) => ({
          questionId:   qId,
          marksAwarded: Number(v.marks) || 0,
          comment:      v.comment,
        })),
      };
      await examService.submitWrittenEvaluation(payload);
      const newWritten = totalAwarded;
      const newTotal   = selectedSession.mcqMarks + newWritten;
      const newPct     = selectedSession.maxMarks > 0 ? (newTotal / selectedSession.maxMarks) * 100 : 0;
      // Optimistic update — flip pending flag, scores, and auto-resolve all pending reviews
      // (evaluation supersedes review requests — they're implicitly resolved by re-evaluation)
      setSessions(prev => prev.map(s => {
        if (s.id !== selectedSession.id) return s;
        return {
          ...s,
          writtenEvaluationPending: false,
          writtenMarks: newWritten,
          totalMarks: newTotal,
          percentage: newPct,
          writtenEvaluatedBy: user!.uid,
          writtenEvaluatedName: user!.name,
          writtenEvaluatedAt: new Date(),
          writtenAnswers: s.writtenAnswers.map(wa => ({
            ...wa,
            reviewRequests: (wa.reviewRequests || []).map(r =>
              r.status === 'pending'
                ? { ...r, status: 'resolved' as const, resolvedAt: new Date(), resolvedComment: 'Resolved by re-evaluation.' }
                : r
            ),
          })),
        };
      }));
      // Show success toast at the exam level (persists after panel closes)
      setSuccessMsg('✓ Evaluation saved successfully!');
      // Close panel, then refresh data in background
      setSelectedSession(null);
      setSubmitSuccess('');
      await loadExamList();
      // Auto-dismiss toast after 4s
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e: any) {
      setEvalError(e.message || 'Failed to save evaluation.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Resolve review ────────────────────────────────────────────────────────
  const resolveReview = async () => {
    if (!selectedSession || !resolvingQId || resolveIdx < 0) return;
    setResolving(true);
    try {
      await examService.resolveReviewRequest(selectedSession.id, resolvingQId, resolveIdx, resolveText);
      const patchAnswers = (answers: typeof selectedSession.writtenAnswers) =>
        answers.map(wa => {
          if (wa.questionId !== resolvingQId) return wa;
          return {
            ...wa,
            reviewRequests: (wa.reviewRequests || []).map((r, i) =>
              i === resolveIdx
                ? { ...r, status: 'resolved' as const, resolvedAt: new Date(), resolvedComment: resolveText }
                : r
            ),
          };
        });

      // Update selectedSession (panel display)
      setSelectedSession(prev => prev ? { ...prev, writtenAnswers: patchAnswers(prev.writtenAnswers) } : prev);

      // Also update sessions list so the review badge clears immediately
      setSessions(prev => prev.map(s =>
        s.id === selectedSession!.id
          ? { ...s, writtenAnswers: patchAnswers(s.writtenAnswers) }
          : s
      ));

      setResolvingQId(null); setResolveIdx(-1); setResolveText('');
      setSuccessMsg('✓ Review request resolved.');
      setTimeout(() => setSuccessMsg(prev => prev === '✓ Review request resolved.' ? '' : prev), 3000);
    } catch (e: any) {
      setEvalError(e.message || 'Failed to resolve review.');
    } finally {
      setResolving(false);
    }
  };

  // ── Publish results ───────────────────────────────────────────────────────
  const publishResults = async () => {
    if (!selectedContent) return;
    setShowPublishConfirm(true);
  };

  const confirmPublish = async () => {
    setShowPublishConfirm(false);
    setPublishing(true);
    try {
      await examService.publishResults(selectedContent.id);
      // Notify every student whose session was evaluated
      sessions.forEach(sess => {
        notificationService.createNotification({
          userId: sess.studentId,
          title: 'Exam Results Published',
          message: selectedContent.title,
          type: 'grade',
          priority: 'high',
          isPermanent: true,
          relatedId: selectedContent.id,
          relatedType: 'exam',
          metadata: { examTitle: selectedContent.title, score: sess.totalMarks, maxMarks: sess.maxMarks, percentage: sess.percentage },
        });
      });
      setSuccessMsg('✓ Results published — students can now view their scores.');
      await refreshEval();
      setTimeout(() => setSuccessMsg(prev => prev.startsWith('✓ Results') ? '' : prev), 5000);
    } catch (e: any) {
      setEvalError(e.message || 'Failed to publish results.');
    } finally {
      setPublishing(false);
    }
  };

  // ═════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#080a12] text-white">
      <div className="fixed inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 26% at 50% -6%,rgba(139,92,246,.08) 0%,transparent 70%)' }} />

      {/* Publish confirm modal */}
      {showPublishConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
          onClick={() => setShowPublishConfirm(false)}>
          <div className="bg-[#0e1020] border border-white/12 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center mb-4">
              <Send size={20} className="text-emerald-400" />
            </div>
            <h3 className="text-white font-bold text-lg mb-1">Publish Results?</h3>
            <p className="text-white/45 text-sm mb-6 leading-relaxed">
              All students will immediately be able to see their scores and written feedback.
              This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowPublishConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/50 hover:text-white text-sm transition">
                Cancel
              </button>
              <button onClick={confirmPublish}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition">
                Publish
              </button>
            </div>
          </div>
        </div>
      )}

      {lightboxUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="attachment" className="max-w-4xl max-h-[90vh] object-contain rounded-2xl" />
          <button className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
            onClick={() => setLightboxUrl(null)}>
            <X size={18} />
          </button>
        </div>
      )}

      <div className="relative max-w-[1440px] mx-auto px-4 sm:px-6 py-8">

        {selectedContent ? (
          /* ══════════════════════════════════════════════════
             LEVEL 2 — Exam evaluation hub
          ══════════════════════════════════════════════════ */
          <div className="space-y-5">

            {/* Header */}
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <button onClick={() => { setSelectedContent(null); setSelectedSession(null); }}
                  className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition group shrink-0">
                  <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                  All Exams
                </button>
                <div className="w-px h-5 bg-white/10 shrink-0" />
                <div className="w-9 h-9 rounded-xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center shrink-0">
                  <PenLine size={16} className="text-violet-400" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg font-bold leading-tight line-clamp-1">{selectedContent.title}</h1>
                  <div className="flex flex-wrap gap-3 text-xs text-white/35 mt-0.5">
                    {selectedContent.subject && <span className="flex items-center gap-1"><Tag size={9}/>{selectedContent.subject}</span>}
                    <span>{extractWrittenQs(selectedContent).length} written Qs · {sessions.length} submissions</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 items-center shrink-0">
                <button onClick={() => setShowStats(v => !v)}
                  className="flex items-center gap-1 px-2.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white text-xs transition">
                  {showStats ? <EyeOff size={12}/> : <Eye size={12}/>}
                  <span className="hidden sm:inline ml-1">{showStats ? 'Hide' : 'Show'} Stats</span>
                </button>
                <button onClick={refreshEval}
                  className="flex items-center gap-1 px-2.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white text-sm transition">
                  <RefreshCcw size={13}/>
                  <span className="hidden sm:inline ml-1">Refresh</span>
                </button>
                <button onClick={publishResults} disabled={publishing}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition disabled:opacity-50 whitespace-nowrap">
                  {publishing ? <Loader2 size={14} className="animate-spin"/> : <Send size={14}/>}
                  <span>Publish</span>
                </button>
              </div>
            </div>

            {/* Toasts */}
            {successMsg && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm">
                <CheckCircle size={14}/> {successMsg}
                <button onClick={() => setSuccessMsg('')} className="ml-auto text-emerald-400/60 hover:text-emerald-300"><X size={12}/></button>
              </div>
            )}
            {evalError && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
                <AlertTriangle size={14}/> {evalError}
                <button onClick={() => setEvalError('')} className="ml-auto text-red-400/60 hover:text-red-300"><X size={12}/></button>
              </div>
            )}

            {/* Stats */}
            {showStats && stats && (
              <div className="space-y-3">
                <div className="flex overflow-x-auto gap-3 pb-1 sm:grid sm:grid-cols-4 xl:grid-cols-7 sm:overflow-visible scrollbar-none">
                  <StatCard label="Submissions" value={sessions.length} icon={<Users size={15}/>} />
                  <StatCard label="Pending" value={pendingCount} icon={<Clock size={15}/>}
                    valueClass={pendingCount > 0 ? 'text-amber-400' : 'text-emerald-400'} />
                  <StatCard label="Reviews" value={reviewCount} icon={<MessageSquare size={15}/>}
                    valueClass={reviewCount > 0 ? 'text-rose-400' : 'text-white/30'} />
                  <StatCard label="Avg Score" value={`${(stats.averagePercentage ?? 0).toFixed(1)}%`}
                    icon={<TrendingUp size={15}/>} valueClass={gradeColor(stats.averagePercentage ?? 0)} />
                  <StatCard label="Highest" value={`${(stats.highestScore ?? 0).toFixed(1)}%`}
                    icon={<Award size={15}/>} valueClass="text-emerald-400" />
                  <StatCard label="Pass Rate" value={`${(stats.passRate ?? 0).toFixed(1)}%`}
                    icon={<Check size={15}/>} valueClass={gradeColor(stats.passRate ?? 0)} />
                  <StatCard label="Evaluated" value={`${sessions.length - pendingCount}/${sessions.length}`}
                    icon={<CheckCircle size={15}/>} />
                </div>
                {scoreDist.some(v => v > 0) && (
                  <div className="rounded-xl bg-white/3 border border-white/7 p-4">
                    <p className="text-[10px] uppercase tracking-widest text-white/25 mb-3">Score Distribution</p>
                    <div className="flex items-end gap-3 h-16">
                      {[
                        { label: '<40%',  color: 'bg-red-500/60',     i: 0 },
                        { label: '40–59', color: 'bg-orange-500/60',  i: 1 },
                        { label: '60–79', color: 'bg-amber-500/60',   i: 2 },
                        { label: '80–89', color: 'bg-emerald-500/60', i: 3 },
                        { label: '90+',   color: 'bg-teal-500/60',    i: 4 },
                      ].map(({ label, color, i }) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-[9px] text-white/40">{scoreDist[i] || ''}</span>
                          <div className={`w-full rounded-t transition-all ${color}`}
                            style={{ height: `${(scoreDist[i] / maxBucket) * 52}px`, minHeight: scoreDist[i] > 0 ? 3 : 0 }} />
                          <span className="text-[9px] text-white/30">{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {evalLoading ? (
              <div className="flex items-center justify-center py-24"><Loader2 size={28} className="animate-spin text-violet-400"/></div>
            ) : (
              <div className="flex gap-4 items-start">

                {/* Session list */}
                <div className={`flex flex-col min-w-0 transition-all ${selectedSession ? 'hidden lg:flex lg:w-72 xl:w-80 shrink-0' : 'flex w-full'}`}>
                  <div className="space-y-2 mb-3">
                    <div className="relative">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25"/>
                      <input type="text" placeholder="Search students…" value={sessSearch}
                        onChange={e => setSessSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 bg-white/4 border border-white/8 rounded-xl text-sm text-white/70 placeholder-white/20 focus:outline-none focus:border-white/20"/>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {([
                        { f: 'all' as const,       label: 'All',       cnt: sessions.length },
                        { f: 'pending' as const,   label: 'Pending',   cnt: pendingCount },
                        { f: 'evaluated' as const, label: 'Evaluated', cnt: sessions.length - pendingCount },
                        { f: 'reviews' as const,   label: 'Reviews',   cnt: reviewCount },
                      ]).map(({ f, label, cnt }) => (
                        <button key={f} onClick={() => setSessFilter(f)}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs transition
                            ${sessFilter === f ? 'bg-violet-500/20 border border-violet-500/30 text-violet-300' : 'bg-white/4 border border-white/8 text-white/40 hover:text-white/70'}`}>
                          {label}
                          {cnt > 0 && <span className={`px-1.5 rounded-full text-[10px] font-bold
                            ${sessFilter === f ? 'bg-violet-500/30 text-violet-200' : (f === 'pending' || f === 'reviews') ? 'bg-amber-500/15 text-amber-400' : 'bg-white/8 text-white/35'}`}>
                            {cnt}
                          </span>}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-1">
                      {(['name', 'submitted', 'score', 'status'] as SessionSort[]).map(col => {
                        const active = sessSort === col;
                        return (
                          <button key={col} onClick={() => toggleSort(col)}
                            className={`flex items-center gap-0.5 px-2 py-1 rounded-lg text-[11px] capitalize transition
                              ${active ? 'text-violet-300 bg-violet-500/10' : 'text-white/25 hover:text-white/50'}`}>
                            {col}
                            {active ? (sortDir === 'asc' ? <SortAsc size={10}/> : <SortDesc size={10}/>) : <SortAsc size={10} className="opacity-30"/>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {sortedSessions.length === 0 ? (
                      <div className="text-center py-14 text-white/25">
                        <ClipboardList size={28} className="mx-auto mb-3 opacity-40"/>
                        <p className="text-sm">No submissions match filters</p>
                      </div>
                    ) : sortedSessions.map(sess => (
                      <SessionCard key={sess.id} session={sess}
                        isSelected={selectedSession?.id === sess.id}
                        pendingReviews={pendingReviewsInSession(sess)}
                        onClick={() => openSession(sess)}/>
                    ))}
                  </div>
                </div>

                {/* Evaluation panel */}
                {selectedSession && (
                  <div className="w-full lg:flex-1 lg:min-w-0">
                    <div className="lg:sticky lg:top-4 rounded-2xl bg-[#0c0e1a] border border-white/8 overflow-hidden shadow-2xl shadow-black/40">

                      {/* Panel header */}
                      <div className="px-5 py-4 border-b border-white/8 bg-white/[0.015]">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                            <button onClick={() => setSelectedSession(null)} className="lg:hidden text-white/30 hover:text-white transition">
                              <ArrowLeft size={16}/>
                            </button>
                            <p className="font-semibold text-white">{selectedSession.studentName}</p>
                            <StatusBadge pending={selectedSession.writtenEvaluationPending}/>
                            {selectedSession.attemptNumber > 1 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/8 text-white/40 border border-white/8">
                                Attempt #{selectedSession.attemptNumber}
                              </span>
                            )}
                          </div>
                          <button onClick={() => setSelectedSession(null)} className="hidden lg:flex text-white/25 hover:text-white transition shrink-0">
                            <X size={16}/>
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-white/30 mt-1.5">
                          <span>{fmtDate(selectedSession.submittedAt)}</span>
                          <span>· {fmtTime(selectedSession.timeTakenSeconds)}</span>
                          {selectedSession.tabSwitchCount > 0 && (
                            <span className="flex items-center gap-1 text-amber-400/80">
                              <Shield size={10}/> {selectedSession.tabSwitchCount} tab switch{selectedSession.tabSwitchCount !== 1 ? 'es' : ''}
                            </span>
                          )}
                          {(selectedSession.suspiciousActivity?.length ?? 0) > 0 && (
                            <span className="flex items-center gap-1 text-red-400/70">
                              <AlertTriangle size={10}/> {selectedSession.suspiciousActivity.length} flags
                            </span>
                          )}
                        </div>
                      </div>

                      {/* MCQ preview */}
                      {selectedSession.mcqMarks > 0 && (
                        <div className="mx-4 mt-3 px-3 py-2 rounded-xl bg-blue-500/8 border border-blue-500/15 flex items-center justify-between">
                          <span className="text-blue-300/60 text-xs">MCQ (auto-graded)</span>
                          <span className="text-blue-300 font-bold text-sm">{selectedSession.mcqMarks} marks</span>
                        </div>
                      )}

                      {/* Previously evaluated banner */}
                      {!selectedSession.writtenEvaluationPending && (
                        <div className="mx-4 mt-3 px-4 py-3 rounded-xl bg-emerald-500/8 border border-emerald-500/15 flex items-center gap-3">
                          <CheckCircle size={15} className="text-emerald-400 shrink-0"/>
                          <div className="flex-1 min-w-0">
                            <p className="text-emerald-300 text-sm font-medium">Previously evaluated</p>
                            <p className="text-emerald-400/50 text-xs">
                              Written: {selectedSession.writtenMarks}/{writtenMaxForSession} marks
                              {selectedSession.writtenEvaluatedAt && ` · ${fmtDate(selectedSession.writtenEvaluatedAt)}`}
                            </p>
                            {(selectedSession.writtenEvaluatedName || selectedSession.writtenEvaluatedBy) && (
                              <p className="text-emerald-400/40 text-xs mt-0.5 flex items-center gap-1">
                                <PenLine size={9}/>
                                Evaluated by{' '}
                                <span className="text-emerald-300/60 font-medium">
                                  {selectedSession.writtenEvaluatedName || selectedSession.writtenEvaluatedBy}
                                </span>
                                {(user as any)?.surname && selectedSession.writtenEvaluatedBy === user?.uid && (
                                  <span className="text-emerald-400/30">· {(user as any).surname}</span>
                                )}
                                {(user as any)?.userId && selectedSession.writtenEvaluatedBy === user?.uid && (
                                  <span className="text-emerald-400/30 font-mono text-[10px]">#{(user as any).userId}</span>
                                )}
                              </p>
                            )}
                          </div>
                          <span className={`text-sm font-bold shrink-0 ${gradeColor(selectedSession.percentage)}`}>
                            {selectedSession.percentage.toFixed(1)}%
                          </span>
                        </div>
                      )}

                      {/* Bulk fill */}
                      <div className="mx-4 mt-3 flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] text-white/25 uppercase tracking-wider">Bulk fill:</span>
                        {[
                          { label: 'Full', t: 'full'  as const, cls: 'text-emerald-400 hover:bg-emerald-500/10 border-emerald-500/20' },
                          { label: '½',   t: 'half'  as const, cls: 'text-amber-400 hover:bg-amber-500/10 border-amber-500/20' },
                          { label: 'Zero', t: 'zero'  as const, cls: 'text-red-400 hover:bg-red-500/10 border-red-500/20' },
                        ].map(({ label, t, cls }) => (
                          <button key={t} onClick={() => bulkFill(t)}
                            className={`px-2.5 py-1 text-xs rounded-lg border transition ${cls}`}>
                            {label}
                          </button>
                        ))}
                      </div>

                      {/* Answer cards */}
                      <div ref={panelScrollRef} className="overflow-y-auto max-h-[50vh] lg:max-h-[58vh] p-4 mt-3 space-y-3">
                        {selectedSession.writtenAnswers.length === 0 ? (
                          <p className="text-white/25 text-center py-8 text-sm">No written answers submitted.</p>
                        ) : selectedSession.writtenAnswers.map((wa, i) => {
                          const q          = writtenQMap[wa.questionId];
                          const draft      = evalDraft[wa.questionId] || { marks: 0, comment: '' };
                          const maxM       = q?.marks ?? 0;
                          const numV       = Number(draft.marks);
                          const errMsg     = validationErrors[wa.questionId];
                          const isCollapsed = collapsedQs.has(wa.questionId);
                          const allRevs    = wa.reviewRequests || [];
                          const pendRevs   = allRevs.filter(r => r.status === 'pending');

                          return (
                            <div key={wa.questionId} className="rounded-xl border border-white/8 overflow-hidden">

                              {/* Collapsible header */}
                              <button
                                onClick={() => setCollapsedQs(prev => {
                                  const n = new Set(prev);
                                  n.has(wa.questionId) ? n.delete(wa.questionId) : n.add(wa.questionId);
                                  return n;
                                })}
                                className="w-full flex items-center justify-between px-4 py-3 bg-white/3 hover:bg-white/5 transition text-left gap-3">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <span className="text-[10px] uppercase tracking-wider text-violet-400 font-semibold shrink-0">Q{i+1}</span>
                                  {q && <span className="text-white/55 text-sm truncate">{q.question}</span>}
                                  {pendRevs.length > 0 && (
                                    <span className="shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-rose-500/15 text-rose-400 text-[10px] border border-rose-500/20">
                                      <MessageSquare size={9}/> {pendRevs.length}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className={`text-sm font-bold ${errMsg ? 'text-red-400' : 'text-white/70'}`}>
                                    {draft.marks === '' ? '—' : draft.marks}/{maxM}
                                  </span>
                                  {isCollapsed ? <ChevronDown size={14} className="text-white/30"/> : <ChevronUp size={14} className="text-white/30"/>}
                                </div>
                              </button>

                              {!isCollapsed && (
                                <div className="p-4 space-y-4 bg-white/[0.015]">

                                  {/* Student answer */}
                                  {wa.answerText ? (
                                    <div className="bg-white/4 rounded-lg px-3 py-3">
                                      <p className="text-[10px] uppercase tracking-wider text-white/25 mb-2">Student's Answer</p>
                                      <p className="text-white/75 text-sm whitespace-pre-wrap leading-relaxed">{wa.answerText}</p>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 bg-white/2 rounded-lg px-3 py-2.5">
                                      <AlertCircle size={12} className="text-white/20"/>
                                      <p className="text-white/25 text-xs">No text answer submitted</p>
                                    </div>
                                  )}

                                  {/* Attachments */}
                                  {(wa.attachmentUrls || []).length > 0 && (
                                    <div>
                                      <p className="text-[10px] uppercase tracking-wider text-white/25 mb-2">Attachments ({wa.attachmentUrls!.length})</p>
                                      <div className="flex flex-wrap gap-2">
                                        {wa.attachmentUrls!.map((url, ui) => (
                                          <div key={ui} className="relative group">
                                            <img src={url} alt={`att-${ui}`} className="w-20 h-20 object-cover rounded-lg border border-white/10 cursor-pointer"/>
                                            <button onClick={() => setLightboxUrl(url)}
                                              className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition rounded-lg">
                                              <ZoomIn size={16} className="text-white"/>
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Model solution */}
                                  {q?.solution && (
                                    <div className="bg-indigo-500/8 border border-indigo-500/15 rounded-lg px-3 py-2.5">
                                      <p className="text-[10px] uppercase tracking-wider text-indigo-400 mb-1.5">Model Solution</p>
                                      <p className="text-white/60 text-sm leading-relaxed">{q.solution}</p>
                                    </div>
                                  )}

                                  {/* Review requests */}
                                  {allRevs.length > 0 && (
                                    <div className="space-y-2">
                                      <p className="text-[10px] uppercase tracking-wider text-white/25">Review Requests ({allRevs.length})</p>
                                      {allRevs.map((rr, ri) => (
                                        <div key={ri} className={`rounded-lg border p-3
                                          ${rr.status === 'resolved' ? 'bg-emerald-500/5 border-emerald-500/15' : 'bg-rose-500/8 border-rose-500/20'}`}>
                                          <div className="flex items-center justify-between mb-1.5 gap-2">
                                            <span className={`text-[10px] font-bold uppercase tracking-wider ${rr.status === 'resolved' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                              {rr.status === 'resolved' ? '✓ Resolved' : '⟳ Pending'}
                                            </span>
                                            <span className="text-[10px] text-white/25 shrink-0">
                                              {fmtShortDate(rr.requestedAt)}
                                            </span>
                                          </div>
                                          <p className="text-white/55 text-xs italic">"{rr.message}"</p>
                                          {rr.resolvedComment && (
                                            <p className="text-emerald-300/70 text-xs mt-1.5 pt-1.5 border-t border-emerald-500/15">
                                              Your reply: {rr.resolvedComment}
                                            </p>
                                          )}
                                          {rr.status === 'pending' && (
                                            resolvingQId === wa.questionId && resolveIdx === ri ? (
                                              <div className="mt-2.5 space-y-2">
                                                <textarea value={resolveText} onChange={e => setResolveText(e.target.value)}
                                                  placeholder="Reply to student (optional)…" rows={2}
                                                  style={{ color: 'rgba(255,255,255,0.85)', backgroundColor: 'rgba(255,255,255,0.05)', caretColor: 'white' }}
                                                  className="w-full border border-white/12 rounded-lg px-3 py-2 text-xs placeholder-white/20 focus:outline-none focus:border-violet-400/50 resize-none"/>
                                                <div className="flex gap-2">
                                                  <button onClick={resolveReview} disabled={resolving}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs transition disabled:opacity-50">
                                                    {resolving ? <Loader2 size={11} className="animate-spin"/> : <CheckCircle size={11}/>} Resolve
                                                  </button>
                                                  <button onClick={() => { setResolvingQId(null); setResolveIdx(-1); setResolveText(''); }}
                                                    className="px-3 py-1.5 rounded-lg text-xs text-white/30 hover:text-white transition">
                                                    Cancel
                                                  </button>
                                                </div>
                                              </div>
                                            ) : (
                                              <button onClick={() => { setResolvingQId(wa.questionId); setResolveIdx(ri); setResolveText(''); }}
                                                className="mt-2 flex items-center gap-1 text-xs text-rose-400/60 hover:text-rose-300 transition">
                                                <MessageSquare size={10}/> Respond &amp; resolve
                                              </button>
                                            )
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Marks input */}
                                  <div className="space-y-3 pt-1">
                                    <div>
                                      <label className="text-[10px] uppercase tracking-wider text-white/35 mb-2 block">Marks Awarded</label>
                                      <div className="flex items-center gap-3 flex-wrap">
                                        <input type="number" min={0} max={maxM} step={0.5}
                                          value={draft.marks}
                                          onChange={e => updateDraft(wa.questionId, 'marks', e.target.value === '' ? '' : e.target.value)}
                                          className={`w-20 border rounded-lg px-3 py-2 text-sm font-bold text-center focus:outline-none transition
                                            ${errMsg ? 'bg-red-500/10 border-red-500/40 text-red-300 focus:border-red-400' : 'bg-white/5 border-white/15 text-white focus:border-violet-400/60'}`}
                                        />
                                        <span className="text-white/30 text-sm">/ {maxM}</span>
                                        <input type="range" min={0} max={maxM} step={0.5}
                                          value={Number(draft.marks) || 0}
                                          onChange={e => updateDraft(wa.questionId, 'marks', e.target.value)}
                                          className="flex-1 min-w-20 accent-violet-500"/>
                                        <div className="flex gap-1">
                                          {Array.from(new Set([0, maxM > 1 ? Math.round(maxM * 0.5) : null, maxM].filter(v => v !== null) as number[])).map(v => (
                                            <button key={v} onClick={() => updateDraft(wa.questionId, 'marks', v)}
                                              className={`px-2.5 h-7 text-[11px] rounded-lg transition font-medium min-w-[28px]
                                                ${numV === v ? 'bg-violet-500/30 text-violet-300 border border-violet-500/40' : 'bg-white/6 hover:bg-white/12 text-white/45 hover:text-white'}`}>
                                              {v}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 mt-2">
                                        <ProgressBar value={Math.min(numV || 0, maxM)} max={maxM}
                                          colorClass={errMsg ? 'bg-red-500/50' : numV >= maxM ? 'bg-emerald-500/60' : numV >= maxM * 0.5 ? 'bg-amber-500/60' : 'bg-violet-500/60'}/>
                                      </div>
                                      {errMsg && <p className="text-red-400 text-xs mt-1">{errMsg}</p>}
                                    </div>

                                    <div>
                                      <label className="text-[10px] uppercase tracking-wider text-white/35 mb-2 block">Feedback (optional)</label>
                                      <textarea value={draft.comment} rows={2}
                                        onChange={e => updateDraft(wa.questionId, 'comment', e.target.value)}
                                        placeholder="Write feedback for the student…"
                                        style={{ color: 'rgba(255,255,255,0.85)', backgroundColor: 'rgba(255,255,255,0.04)', caretColor: 'white' }}
                                        className="w-full border border-white/12 rounded-lg px-3 py-2 text-sm placeholder-white/20 focus:outline-none focus:border-violet-400/50 resize-none leading-relaxed"/>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Footer */}
                      <div className="px-5 py-4 border-t border-white/8 space-y-3 bg-white/[0.015]">
                        <div className="flex items-center justify-between text-sm">
                          <div className="text-white/40">
                            Written: <span className="text-white font-semibold">{totalAwarded}</span>
                            <span className="text-white/25">/{writtenMaxForSession}</span>
                            {selectedSession.mcqMarks > 0 && (
                              <span className="ml-3 text-white/30">
                                Total: <span className="text-white/70 font-medium">{selectedSession.mcqMarks + totalAwarded}</span>
                                <span className="text-white/25">/{selectedSession.maxMarks}</span>
                              </span>
                            )}
                          </div>
                          <span className={`font-bold ${gradeColor(livePercent)}`}>{livePercent.toFixed(1)}%</span>
                        </div>
                        <ProgressBar value={totalAwarded} max={writtenMaxForSession} colorClass="bg-violet-500/60"/>

                        {hasErrors && (
                          <p className="text-red-400 text-xs flex items-center gap-1.5"><AlertTriangle size={12}/> Fix errors above before saving</p>
                        )}
                        <button onClick={submitEvaluation}
                          disabled={submitting || selectedSession.writtenAnswers.length === 0 || hasErrors}
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm
                                     bg-violet-500 hover:bg-violet-600 text-white transition disabled:opacity-40 disabled:cursor-not-allowed">
                          {submitting ? <><Loader2 size={14} className="animate-spin"/> Saving…</> : <><Check size={14}/> Save Evaluation</>}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

        ) : (
          /* ══════════════════════════════════════════════════
             LEVEL 1 — Exam list
          ══════════════════════════════════════════════════ */
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center">
                  <PenLine size={22} className="text-violet-400"/>
                </div>
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-2xl font-bold">Exam Evaluation</h1>
                    {totalPending > 0 && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/25">
                        {totalPending} pending
                      </span>
                    )}
                    {totalReviews > 0 && (
                      <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/25">
                        <MessageSquare size={10}/> {totalReviews} review{totalReviews !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <p className="text-white/45 text-sm mt-0.5">Select an exam to evaluate written answers</p>
                </div>
              </div>
              <button onClick={loadExamList}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-sm transition">
                <RefreshCcw size={13}/> Refresh
              </button>
            </div>

            {listError && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
                <AlertTriangle size={14}/> {listError}
              </div>
            )}

            <div className="rounded-2xl bg-white/3 border border-white/8 p-4 space-y-3">
              {/* Search — always full width, own row */}
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"/>
                <input type="text" placeholder="Search exams, courses…" value={listSearch}
                  onChange={e => setListSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white/70 placeholder-white/25 focus:outline-none focus:border-white/25"/>
              </div>

              {/* Course / Subject — 2-col grid on mobile, inline on larger screens */}
              <div className={`grid gap-3 ${allSubjects.length > 0 ? 'grid-cols-2' : 'grid-cols-1'} sm:flex sm:flex-wrap sm:items-end`}>
                <div className="sm:min-w-36">
                  <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1 font-semibold">Course</p>
                  <select value={filterCourse} onChange={e => setFilterCourse(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none appearance-none">
                    <option value="all">All Courses</option>
                    {coursesInExams.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                </div>
                {allSubjects.length > 0 && (
                  <div className="sm:min-w-32">
                    <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1 font-semibold">Subject</p>
                    <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none appearance-none">
                      <option value="all">All Subjects</option>
                      {allSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {/* Status — horizontally scrollable chip row on mobile, wraps freely on larger screens */}
              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1 font-semibold">Status</p>
                <div className="flex gap-1.5 overflow-x-auto sm:flex-wrap pb-1 sm:pb-0 -mx-1 px-1 scrollbar-none">
                  {([
                    { val: 'all'           as const, label: 'All'         },
                    { val: 'has_pending'   as const, label: 'Has Pending' },
                    { val: 'all_evaluated' as const, label: 'All Done'    },
                    { val: 'has_reviews'   as const, label: 'Has Reviews' },
                  ]).map(({ val, label }) => (
                    <button key={val} onClick={() => setFilterStatus(val)}
                      className={`shrink-0 px-3.5 py-2.5 rounded-xl text-xs font-medium transition
                        ${filterStatus === val ? 'bg-violet-500/20 border border-violet-500/30 text-violet-300' : 'bg-white/4 border border-white/8 text-white/50 hover:text-white/70'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <p className="text-white/40 text-sm">
              {listLoading ? 'Loading…' : `${filteredExams.length} exam${filteredExams.length !== 1 ? 's' : ''} found`}
            </p>

            {listLoading ? (
              <div className="flex items-center justify-center py-20"><Loader2 size={28} className="animate-spin text-violet-400"/></div>
            ) : filteredExams.length === 0 ? (
              <div className="flex flex-col items-center py-24 text-white/40">
                <ClipboardList size={40} className="mb-4 opacity-50"/>
                <p className="text-base font-medium text-white/70">No written exams found</p>
                <p className="text-sm mt-1 text-white/40">
                  {listSearch || filterCourse !== 'all' || filterSubject !== 'all' || filterStatus !== 'all'
                    ? 'Try adjusting your filters' : 'No exams with written questions exist yet'}
                </p>
                {!(listSearch || filterCourse !== 'all' || filterSubject !== 'all' || filterStatus !== 'all') && (
                  <button onClick={() => navigate('/content')}
                    className="mt-4 flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-violet-500/15 border border-violet-500/25 text-violet-300 hover:bg-violet-500/20 text-sm font-medium transition">
                    <FileText size={14}/> Add written questions to a course
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredExams.map(es => (
                  <ExamCard key={es.content.id} summary={es} onOpen={() => openExam(es.content, es.course?.id)}/>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExamEvaluation;
