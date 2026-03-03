// src/pages/ExamEvaluation.tsx
// Teacher Exam Evaluation Hub
// FIX BUG 3: Written exams from versioned content now correctly appear in the list.
//            writtenQMap is now built from examVersions when content.writtenQuestions is empty.

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, PenLine, CheckCircle, AlertTriangle, Clock, BarChart2, Users,
  Award, Check, X, Loader2, ZoomIn, Send, RefreshCcw, Search,
  BookOpen, FileText, ChevronRight, ClipboardList, AlertCircle, Tag,
} from 'lucide-react';
import { useDashboard } from '../contexts/DashboardContext';
import { contentService, Content, WrittenQuestion } from '../services/contentService';
import { courseService, Course } from '../services/courseService';
import { examService, ExamSession, WrittenEvaluationPayload } from '../services/examService';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface EvalDraft {
  [questionId: string]: { marks: number; comment: string };
}

interface ExamSummary {
  content: Content;
  course: Course | null;
  totalSessions: number;
  pendingCount: number;
  evaluatedCount: number;
  avgScore: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
const fmtTime = (secs: number) => {
  const m = Math.floor(secs / 60), s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const StatusBadge: React.FC<{ pending: boolean }> = ({ pending }) => (
  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full
    ${pending
      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
      : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'}`}>
    {pending ? 'Pending' : 'Evaluated'}
  </span>
);

// ─── FIX BUG 3: Helper to extract all written questions from any content ───────
// Works for both old flat structure (content.writtenQuestions) and
// new versioned structure (content.examVersions[].writtenQuestions)
const extractAllWrittenQuestions = (content: Content): WrittenQuestion[] => {
  // If content has top-level writtenQuestions (legacy / flat)
  if (content.writtenQuestions && content.writtenQuestions.length > 0) {
    return content.writtenQuestions;
  }
  // If content has versioned questions, collect from all versions
  if ((content as any).examVersions && (content as any).examVersions.length > 0) {
    const allWritten: WrittenQuestion[] = [];
    const seen = new Set<string>();
    for (const version of (content as any).examVersions) {
      for (const q of (version.writtenQuestions || [])) {
        if (!seen.has(q.id)) {
          seen.add(q.id);
          allWritten.push(q);
        }
      }
    }
    return allWritten;
  }
  return [];
};

// ─── FIX BUG 3: Check if content has any written questions ───────────────────
const contentHasWrittenQuestions = (content: Content): boolean => {
  return extractAllWrittenQuestions(content).length > 0;
};

// ═══════════════════════════════════════════════════════════════════════════════
// Root Component
// ═══════════════════════════════════════════════════════════════════════════════
const ExamEvaluation: React.FC = () => {
  const { contentId, courseId } = useParams<{ contentId?: string; courseId?: string }>();
  const navigate = useNavigate();
  const { user } = useDashboard();

  // ── Level 1: exam list state ───────────────────────────────────────────────
  const [examSummaries, setExamSummaries]   = useState<ExamSummary[]>([]);
  const [allCourses, setAllCourses]         = useState<Course[]>([]);
  const [listLoading, setListLoading]       = useState(true);
  const [listError, setListError]           = useState('');

  // List filters
  const [filterCourse, setFilterCourse]     = useState<string>('all');
  const [filterSubject, setFilterSubject]   = useState<string>('all');
  const [filterStatus, setFilterStatus]     = useState<'all' | 'has_pending' | 'all_evaluated'>('all');
  const [listSearch, setListSearch]         = useState('');

  // ── Level 2: selected exam evaluation state ────────────────────────────────
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [sessions, setSessions]               = useState<ExamSession[]>([]);
  const [evalLoading, setEvalLoading]         = useState(false);
  const [evalError, setEvalError]             = useState('');
  const [stats, setStats]                     = useState<any>(null);

  // Session-level state
  const [selectedSession, setSelectedSession] = useState<ExamSession | null>(null);
  const [evalDraft, setEvalDraft]             = useState<EvalDraft>({});
  const [submitting, setSubmitting]           = useState(false);
  const [submitSuccess, setSubmitSuccess]     = useState('');
  const [lightboxUrl, setLightboxUrl]         = useState<string | null>(null);
  const [publishing, setPublishing]           = useState(false);
  const [sessionFilter, setSessionFilter]     = useState<'all' | 'pending' | 'evaluated'>('all');
  const [sessionSearch, setSessionSearch]     = useState('');

  // ── Boot ──────────────────────────────────────────────────────────────────
  useEffect(() => { if (user) loadExamList(); }, [user]);

  // Auto-open if navigated directly with contentId
  useEffect(() => {
    if (contentId && examSummaries.length > 0 && !selectedContent) {
      const found = examSummaries.find(s => s.content.id === contentId);
      if (found) openExam(found.content, courseId);
    }
  }, [contentId, examSummaries]);

  // ── Load all written exams ──────────────────────────────────────────────────
  const loadExamList = async () => {
    try {
      setListLoading(true);
      setListError('');

      const [allContent, courses] = await Promise.all([
        user?.role === 'admin'
          ? contentService.getAllContent()
          : contentService.getContentByUser(user?.uid || ''),
        user?.role === 'admin'
          ? courseService.getAllCourses()
          : courseService.getCoursesByInstructor(user?.uid || ''),
      ]);

      setAllCourses(courses);

      // FIX BUG 3: Use helper to detect written questions including versioned exams
      const writtenExams = allContent.filter(
        c => c.type === 'exam' && contentHasWrittenQuestions(c)
      );

      // Build summaries
      const summaries = await Promise.all(
        writtenExams.map(async (content): Promise<ExamSummary> => {
          try {
            const [allSessions, examStats] = await Promise.all([
              examService.getAllSessionsForContent(content.id),
              examService.getExamStatistics(content.id),
            ]);
            const submitted   = allSessions.filter(s => ['submitted', 'auto_submitted'].includes(s.status));
            const pending     = submitted.filter(s => s.writtenEvaluationPending);
            const course      = courses.find(c => c.id === (content as any).courseId) || null;
            return {
              content, course,
              totalSessions:  submitted.length,
              pendingCount:   pending.length,
              evaluatedCount: submitted.length - pending.length,
              avgScore:       examStats?.averagePercentage ?? 0,
            };
          } catch {
            const course = courses.find(c => c.id === (content as any).courseId) || null;
            return { content, course, totalSessions: 0, pendingCount: 0, evaluatedCount: 0, avgScore: 0 };
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

  // ── Open an exam ────────────────────────────────────────────────────────────
  const openExam = async (content: Content, cId?: string) => {
    try {
      setEvalLoading(true);
      setEvalError('');
      setSelectedContent(content);
      setSelectedSession(null);
      setSessionFilter('all');
      setSessionSearch('');

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

  const refreshEval = async () => {
    if (selectedContent) await openExam(selectedContent, courseId);
    await loadExamList();
  };

  // ── Open a session ──────────────────────────────────────────────────────────
  const openSession = (sess: ExamSession) => {
    setSelectedSession(sess);
    const draft: EvalDraft = {};
    sess.writtenAnswers.forEach(wa => {
      draft[wa.questionId] = { marks: wa.marksAwarded ?? 0, comment: wa.evaluatorComment ?? '' };
    });
    setEvalDraft(draft);
    setSubmitSuccess('');
  };

  const updateDraft = (qId: string, field: 'marks' | 'comment', val: string | number) =>
    setEvalDraft(prev => ({ ...prev, [qId]: { ...(prev[qId] || { marks: 0, comment: '' }), [field]: val } }));

  // ── Submit evaluation ───────────────────────────────────────────────────────
  const submitEvaluation = async () => {
    if (!selectedSession || !user) return;
    setSubmitting(true);
    try {
      const payload: WrittenEvaluationPayload = {
        sessionId: selectedSession.id,
        evaluatorId: user.uid,
        evaluatorName: user.name,
        answers: Object.entries(evalDraft).map(([qId, v]) => ({
          questionId: qId,
          marksAwarded: Number(v.marks),
          comment: v.comment,
        })),
      };
      await examService.submitWrittenEvaluation(payload);
      setSubmitSuccess('Evaluation saved!');
      await refreshEval();
      setTimeout(() => { setSelectedSession(null); setSubmitSuccess(''); }, 1200);
    } catch (e: any) {
      setEvalError(e.message || 'Failed to save.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Publish results ─────────────────────────────────────────────────────────
  const publishResults = async () => {
    if (!selectedContent) return;
    if (!window.confirm('Publish results? Students will be able to see their scores.')) return;
    setPublishing(true);
    try {
      await examService.publishResults(selectedContent.id);
      setSubmitSuccess('Results published! Students can now view their scores.');
      await refreshEval();
    } catch (e: any) {
      setEvalError(e.message || 'Failed to publish.');
    } finally {
      setPublishing(false);
    }
  };

  // ── Derived data ────────────────────────────────────────────────────────────
  const allSubjects = useMemo(() => {
    const s = new Set<string>();
    examSummaries.forEach(es => { if (es.content.subject) s.add(es.content.subject); });
    return Array.from(s).sort();
  }, [examSummaries]);

  const filteredExams = useMemo(() => examSummaries.filter(es => {
    if (filterCourse  !== 'all' && (es.content as any).courseId !== filterCourse)  return false;
    if (filterSubject !== 'all' && es.content.subject   !== filterSubject) return false;
    if (filterStatus === 'has_pending'   && es.pendingCount === 0)         return false;
    if (filterStatus === 'all_evaluated' && es.pendingCount > 0)           return false;
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

  const filteredSessions = useMemo(() => sessions.filter(s => {
    const matchFilter =
      sessionFilter === 'all' ? true :
      sessionFilter === 'pending' ? s.writtenEvaluationPending :
      !s.writtenEvaluationPending;
    const matchSearch = !sessionSearch ||
      s.studentName.toLowerCase().includes(sessionSearch.toLowerCase());
    return matchFilter && matchSearch;
  }), [sessions, sessionFilter, sessionSearch]);

  const pendingCount = sessions.filter(s => s.writtenEvaluationPending).length;
  const totalPending = examSummaries.reduce((a, e) => a + e.pendingCount, 0);

  // FIX BUG 3: Build writtenQMap from all written questions (including versioned)
  const writtenQMap = useMemo(() => {
    const map: Record<string, WrittenQuestion> = {};
    if (selectedContent) {
      extractAllWrittenQuestions(selectedContent).forEach(q => { map[q.id] = q; });
    }
    return map;
  }, [selectedContent]);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#0a0c14] text-white">
      {/* ambient glow */}
      <div className="fixed inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 55% 22% at 50% -4%,rgba(139,92,246,.07) 0%,transparent 65%)' }} />

      {/* Lightbox */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur"
          onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="attachment"
            className="max-w-4xl max-h-[90vh] object-contain rounded-xl shadow-2xl" />
          <button className="absolute top-4 right-4 text-white/60 hover:text-white">
            <X size={24} />
          </button>
        </div>
      )}

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* ─── LEVEL 2: Evaluation interface ─── */}
        {selectedContent ? (
          <div className="space-y-6">
            {/* Back */}
            <button onClick={() => { setSelectedContent(null); setSelectedSession(null); }}
              className="flex items-center gap-2 text-sm text-white/40 hover:text-white transition group">
              <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
              All Exams
            </button>

            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center">
                  <PenLine size={22} className="text-violet-400" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white line-clamp-1">{selectedContent.title}</h1>
                  <div className="flex flex-wrap gap-3 mt-1 text-xs text-white/40">
                    {selectedContent.subject && (
                      <span className="flex items-center gap-1"><Tag size={10} /> {selectedContent.subject}</span>
                    )}
                    {(selectedContent as any).examType && (
                      <span className="capitalize">· {(selectedContent as any).examType}</span>
                    )}
                    <span>· {extractAllWrittenQuestions(selectedContent).length} written questions</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                <button onClick={refreshEval}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10
                             text-white/50 hover:text-white text-sm transition">
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
            {submitSuccess && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm">
                <CheckCircle size={14} /> {submitSuccess}
              </div>
            )}
            {evalError && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
                <AlertTriangle size={14} /> {evalError}
                <button onClick={() => setEvalError('')} className="ml-auto"><X size={13} /></button>
              </div>
            )}

            {/* Stats */}
            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Submissions',  value: sessions.length,                       icon: <Users size={15}    className="text-blue-400" />   },
                  { label: 'Pending',      value: pendingCount,                          icon: <Clock size={15}    className="text-amber-400" />   },
                  { label: 'Avg Score',    value: `${stats.averagePercentage?.toFixed(1) ?? 0}%`, icon: <BarChart2 size={15} className="text-violet-400" /> },
                  { label: 'Pass Rate',    value: `${stats.passRate?.toFixed(1) ?? 0}%`, icon: <Award size={15}    className="text-emerald-400" /> },
                ].map(({ label, value, icon }) => (
                  <div key={label} className="rounded-xl bg-white/4 border border-white/8 p-4 text-center">
                    <div className="flex justify-center mb-1">{icon}</div>
                    <p className="text-lg font-bold text-white">{value}</p>
                    <p className="text-[11px] text-white/35">{label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Loading */}
            {evalLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={28} className="animate-spin text-violet-400" />
              </div>
            ) : (
              <div className="flex gap-5">
                {/* Session list */}
                <div className={`${selectedSession ? 'hidden lg:flex' : 'flex'} flex-col flex-1 min-w-0`}>
                  {/* Session filters */}
                  <div className="flex gap-2 mb-4 flex-wrap">
                    <div className="relative flex-1 max-w-xs">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
                      <input type="text" placeholder="Search students…" value={sessionSearch}
                        onChange={e => setSessionSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 bg-white/4 border border-white/8 rounded-xl text-sm
                                   text-white/70 placeholder-white/20 focus:outline-none focus:border-white/20" />
                    </div>
                    {(['all', 'pending', 'evaluated'] as const).map(f => (
                      <button key={f} onClick={() => setSessionFilter(f)}
                        className={`px-3 py-2 rounded-xl text-sm transition capitalize
                          ${sessionFilter === f
                            ? 'bg-violet-500/20 border border-violet-500/30 text-violet-300'
                            : 'bg-white/4 border border-white/8 text-white/40 hover:text-white/60'}`}>
                        {f}
                        {f === 'pending' && pendingCount > 0 && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px]">
                            {pendingCount}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-2">
                    {filteredSessions.length === 0 ? (
                      <div className="text-center py-16 text-white/25">
                        <ClipboardList size={32} className="mx-auto mb-3 opacity-50" />
                        <p>No submissions match your filters</p>
                      </div>
                    ) : (
                      filteredSessions.map(sess => (
                        <SessionCard key={sess.id} session={sess}
                          isSelected={selectedSession?.id === sess.id}
                          onClick={() => openSession(sess)} />
                      ))
                    )}
                  </div>
                </div>

                {/* Evaluation Panel */}
                {selectedSession && (
                  <div className="flex-1 min-w-0 lg:max-w-xl">
                    <div className="sticky top-4 rounded-2xl bg-[#0d0f1a] border border-white/8 overflow-hidden">
                      {/* Panel header */}
                      <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
                        <div>
                          <p className="font-semibold text-white">{selectedSession.studentName}</p>
                          <p className="text-xs text-white/35">
                            Submitted {selectedSession.submittedAt?.toLocaleString()}
                            {' · '}{fmtTime(selectedSession.timeTakenSeconds)}
                            {selectedSession.tabSwitchCount > 0 && (
                              <span className="ml-2 text-amber-400">
                                ⚠ {selectedSession.tabSwitchCount} tab switch{selectedSession.tabSwitchCount !== 1 ? 'es' : ''}
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge pending={selectedSession.writtenEvaluationPending} />
                          <button onClick={() => setSelectedSession(null)} className="text-white/30 hover:text-white ml-1">
                            <X size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Already evaluated banner */}
                      {!selectedSession.writtenEvaluationPending && (
                        <div className="mx-5 mt-4 px-4 py-3 rounded-xl bg-emerald-500/8 border border-emerald-500/15 flex items-center gap-3">
                          <CheckCircle size={16} className="text-emerald-400 shrink-0" />
                          <div>
                            <p className="text-emerald-300 text-sm font-medium">Previously evaluated</p>
                            <p className="text-emerald-400/60 text-xs">
                              Written: {selectedSession.writtenMarks} /{' '}
                              {selectedSession.writtenAnswers.reduce(
                                (a, wa) => a + (writtenQMap[wa.questionId]?.marks ?? 0), 0
                              )} marks
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Answers */}
                      <div className="overflow-y-auto max-h-[62vh] p-5 space-y-5">
                        {selectedSession.writtenAnswers.length === 0 ? (
                          <p className="text-white/30 text-center py-8 text-sm">No written answers submitted.</p>
                        ) : (
                          selectedSession.writtenAnswers.map((wa, i) => {
                            const q     = writtenQMap[wa.questionId];
                            const draft = evalDraft[wa.questionId] || { marks: 0, comment: '' };
                            const maxM  = q?.marks ?? 0;

                            return (
                              <div key={wa.questionId}
                                className="rounded-xl bg-white/4 border border-white/8 p-4 space-y-4">
                                {/* Question */}
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1">
                                    <p className="text-[10px] uppercase tracking-wider text-violet-400 font-semibold mb-1">
                                      Question {i + 1}
                                    </p>
                                    <p className="text-white text-sm">{q?.question ?? wa.questionId}</p>
                                  </div>
                                  <span className="shrink-0 text-xs font-bold text-white/40 bg-white/6 px-2 py-1 rounded-lg">
                                    /{maxM} marks
                                  </span>
                                </div>

                                {/* Student answer */}
                                {wa.answerText ? (
                                  <div className="bg-white/3 rounded-lg px-3 py-2.5">
                                    <p className="text-[10px] uppercase tracking-wider text-white/25 mb-1">Student's answer</p>
                                    <p className="text-white/70 text-sm whitespace-pre-wrap leading-relaxed">{wa.answerText}</p>
                                  </div>
                                ) : (
                                  <div className="bg-white/2 rounded-lg px-3 py-2 flex items-center gap-2">
                                    <AlertCircle size={12} className="text-white/20" />
                                    <p className="text-white/25 text-xs">No text answer provided</p>
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
                                          <img src={url} alt={`attachment ${ui + 1}`}
                                            className="w-20 h-20 object-cover rounded-lg border border-white/10 cursor-pointer" />
                                          <button onClick={() => setLightboxUrl(url)}
                                            className="absolute inset-0 flex items-center justify-center
                                                       bg-black/40 opacity-0 group-hover:opacity-100 transition rounded-lg">
                                            <ZoomIn size={18} className="text-white" />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Model solution */}
                                {q?.solution && (
                                  <div className="bg-indigo-500/8 border border-indigo-500/15 rounded-lg px-3 py-2.5">
                                    <p className="text-[10px] uppercase tracking-wider text-indigo-400 mb-1">Model solution</p>
                                    <p className="text-white/60 text-sm leading-relaxed">{q.solution}</p>
                                  </div>
                                )}

                                {/* Evaluator inputs */}
                                <div className="space-y-3 pt-1">
                                  <div>
                                    <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5 block">
                                      Marks awarded
                                    </label>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <input type="number" min={0} max={maxM}
                                        value={draft.marks}
                                        onChange={e => updateDraft(wa.questionId, 'marks', e.target.value)}
                                        className="w-24 bg-white/5 border border-white/15 rounded-lg px-3 py-2
                                                   text-white text-sm focus:outline-none focus:border-violet-400/50" />
                                      <span className="text-white/30 text-sm">/ {maxM}</span>
                                      {/* Quick-fill buttons */}
                                      <div className="flex gap-1 ml-auto">
                                        {[0, Math.round(maxM / 2), maxM].map(v => (
                                          <button key={v}
                                            onClick={() => updateDraft(wa.questionId, 'marks', v)}
                                            className="px-2 py-1 text-[10px] rounded bg-white/6 hover:bg-white/12
                                                       text-white/50 hover:text-white transition">
                                            {v}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                  <div>
                                    <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5 block">
                                      Comment (optional)
                                    </label>
                                    <textarea value={draft.comment} rows={2}
                                      onChange={e => updateDraft(wa.questionId, 'comment', e.target.value)}
                                      placeholder="Feedback for student…"
                                      className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2
                                                 text-white text-sm focus:outline-none focus:border-violet-400/50
                                                 placeholder-white/20 resize-none" />
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Footer */}
                      <div className="px-5 py-4 border-t border-white/8 space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-white/40">Total awarded</span>
                          <span className="text-violet-300 font-bold">
                            {Object.values(evalDraft).reduce((a, v) => a + (Number(v.marks) || 0), 0)}
                            {' / '}
                            {selectedSession.writtenAnswers.reduce(
                              (a, wa) => a + (writtenQMap[wa.questionId]?.marks ?? 0), 0
                            )}
                          </span>
                        </div>
                        {submitSuccess && (
                          <p className="text-emerald-400 text-sm flex items-center gap-1.5">
                            <CheckCircle size={13} /> {submitSuccess}
                          </p>
                        )}
                        <button onClick={submitEvaluation}
                          disabled={submitting || selectedSession.writtenAnswers.length === 0}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                                     bg-violet-500 hover:bg-violet-600 text-white font-semibold text-sm
                                     transition disabled:opacity-50">
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
          /* ─── LEVEL 1: Exam list ─── */
          <div className="space-y-6">
            {/* Page header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center">
                  <PenLine size={22} className="text-violet-400" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-white">Exam Evaluation</h1>
                    {totalPending > 0 && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {totalPending} pending
                      </span>
                    )}
                  </div>
                  <p className="text-white/40 text-sm mt-0.5">
                    Select an exam below to evaluate written answers
                  </p>
                </div>
              </div>
              <button onClick={loadExamList}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10
                           text-white/50 hover:text-white text-sm transition">
                <RefreshCcw size={13} /> Refresh
              </button>
            </div>

            {/* Error */}
            {listError && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
                <AlertTriangle size={14} /> {listError}
              </div>
            )}

            {/* Filters */}
            <div className="rounded-2xl bg-white/3 border border-white/8 p-4">
              <div className="flex flex-wrap gap-3 items-end">
                {/* Search */}
                <div className="relative flex-1 min-w-44">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
                  <input type="text" placeholder="Search exams, courses…" value={listSearch}
                    onChange={e => setListSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm
                               text-white/70 placeholder-white/20 focus:outline-none focus:border-white/25" />
                </div>

                {/* Course filter */}
                <div className="min-w-40">
                  <p className="text-[10px] uppercase tracking-wider text-white/30 mb-1 font-semibold">Course</p>
                  <select value={filterCourse} onChange={e => setFilterCourse(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm
                               text-white focus:outline-none focus:border-white/25 appearance-none">
                    <option value="all">All Courses</option>
                    {allCourses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                </div>

                {/* Subject filter */}
                <div className="min-w-36">
                  <p className="text-[10px] uppercase tracking-wider text-white/30 mb-1 font-semibold">Subject</p>
                  <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm
                               text-white focus:outline-none focus:border-white/25 appearance-none">
                    <option value="all">All Subjects</option>
                    {allSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                {/* Status filter */}
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-white/30 mb-1 font-semibold">Evaluation Status</p>
                  <div className="flex gap-1">
                    {([
                      { val: 'all',           label: 'All' },
                      { val: 'has_pending',   label: 'Has Pending' },
                      { val: 'all_evaluated', label: 'All Done' },
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

            {/* Results count */}
            <p className="text-white/35 text-sm">
              {listLoading ? 'Loading…' : `${filteredExams.length} exam${filteredExams.length !== 1 ? 's' : ''} found`}
            </p>

            {/* Exam list */}
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
  const { content, course, totalSessions, pendingCount, evaluatedCount, avgScore } = summary;
  const hasPending = pendingCount > 0;

  return (
    <button onClick={onOpen}
      className={`w-full text-left rounded-2xl border p-5 transition-all group
        hover:border-violet-500/30 hover:bg-violet-500/4
        ${hasPending ? 'border-amber-500/20 bg-white/3' : 'border-white/8 bg-white/2'}`}>

      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/15 flex items-center justify-center shrink-0">
          <FileText size={18} className="text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold text-sm leading-snug line-clamp-2">
            {content.title}
          </h3>
          {course && (
            <p className="text-white/35 text-xs mt-0.5 truncate flex items-center gap-1">
              <BookOpen size={10} /> {course.title}
            </p>
          )}
        </div>
        <ChevronRight size={15} className="text-white/20 group-hover:text-violet-400 transition shrink-0 mt-1" />
      </div>

      {/* Meta tags */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {content.subject && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-blue-500/10 text-blue-300 border border-blue-500/15">
            <Tag size={9} /> {content.subject}
          </span>
        )}
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-white/5 text-white/40 border border-white/8">
          <PenLine size={9} /> {extractAllWrittenQuestions(content).length} written Qs
        </span>
        {(content as any).examType && (
          <span className="px-2 py-0.5 rounded-full text-[11px] bg-purple-500/10 text-purple-300 border border-purple-500/15 capitalize">
            {(content as any).examType}
          </span>
        )}
        {hasPending ? (
          <span className="px-2 py-0.5 rounded-full text-[11px] bg-amber-500/10 text-amber-300 border border-amber-500/15">
            {pendingCount} pending
          </span>
        ) : totalSessions > 0 ? (
          <span className="px-2 py-0.5 rounded-full text-[11px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/15">
            All evaluated
          </span>
        ) : null}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/6">
        <div className="text-center">
          <p className="text-base font-bold text-white">{totalSessions}</p>
          <p className="text-[10px] text-white/30">submissions</p>
        </div>
        <div className="text-center">
          <p className={`text-base font-bold ${hasPending ? 'text-amber-400' : 'text-emerald-400'}`}>
            {pendingCount}
          </p>
          <p className="text-[10px] text-white/30">pending</p>
        </div>
        <div className="text-center">
          <p className="text-base font-bold text-violet-300">
            {totalSessions > 0 ? `${avgScore.toFixed(0)}%` : '—'}
          </p>
          <p className="text-[10px] text-white/30">avg score</p>
        </div>
      </div>

      {/* Progress bar */}
      {totalSessions > 0 && (
        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 h-1 rounded-full bg-white/6 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${hasPending ? 'bg-amber-400/50' : 'bg-emerald-400/60'}`}
              style={{ width: `${((evaluatedCount / totalSessions) * 100).toFixed(0)}%` }}
            />
          </div>
          <span className={`text-[10px] font-medium ${hasPending ? 'text-amber-400' : 'text-emerald-400'}`}>
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
}> = ({ session, isSelected, onClick }) => (
  <button onClick={onClick}
    className={`w-full text-left flex items-center gap-4 px-4 py-3.5 rounded-xl border transition
      ${isSelected
        ? 'border-violet-500/40 bg-violet-500/8'
        : 'border-white/6 bg-white/2 hover:border-white/12 hover:bg-white/4'}`}>
    <div className="w-9 h-9 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
      <span className="text-sm font-bold text-violet-300">
        {session.studentName.charAt(0).toUpperCase()}
      </span>
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-white text-sm font-medium truncate">{session.studentName}</p>
      <p className="text-white/30 text-xs">
        {session.submittedAt?.toLocaleDateString()} · {fmtTime(session.timeTakenSeconds)}
        {session.tabSwitchCount > 0 && (
          <span className="ml-2 text-amber-400">
            ⚠ {session.tabSwitchCount} switch{session.tabSwitchCount !== 1 ? 'es' : ''}
          </span>
        )}
      </p>
    </div>
    <div className="text-right shrink-0 space-y-1">
      <p className="text-sm font-bold text-white">{session.percentage.toFixed(1)}%</p>
      <StatusBadge pending={session.writtenEvaluationPending} />
    </div>
  </button>
);

export default ExamEvaluation;
