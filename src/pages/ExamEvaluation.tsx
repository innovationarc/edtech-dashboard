// src/pages/ExamEvaluation.tsx
// Production-grade Written Exam Evaluation Page
// Route: /exam-evaluation/:contentId  (or /exam-evaluation/:contentId/:courseId)
// Access: teachers, admins, dedicated evaluators
// Features: Session list, written answer evaluation, marks entry, comments,
//           publish results, statistics, export.

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ClipboardList, PenLine, CheckCircle,
  AlertTriangle, Clock, BarChart2, Users, Award,
  ChevronDown, ChevronUp, Check, X, Loader2,
  Eye, EyeOff, Send, ZoomIn, Download, RefreshCcw,
  Filter, Search,
} from 'lucide-react';
import { useDashboard } from '../contexts/DashboardContext';
import { contentService, Content, WrittenQuestion } from '../services/contentService';
import {
  examService,
  ExamSession,
  WrittenEvaluationPayload,
} from '../services/examService';

// ─── Types ────────────────────────────────────────────────────────────────────
interface EvalDraft {
  [questionId: string]: { marks: number; comment: string };
}

const fmt = (secs: number) => {
  const m = Math.floor(secs / 60), s = secs % 60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
};

// ═══════════════════════════════════════════════════════════════════════════════
const ExamEvaluation: React.FC = () => {
  const { contentId, courseId } = useParams<{ contentId: string; courseId?: string }>();
  const navigate    = useNavigate();
  const { user }    = useDashboard();

  const [content, setContent]     = useState<Content | null>(null);
  const [sessions, setSessions]   = useState<ExamSession[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [stats, setStats]         = useState<any>(null);

  // Selected session for evaluation
  const [selectedSession, setSelectedSession] = useState<ExamSession | null>(null);
  const [evalDraft, setEvalDraft]   = useState<EvalDraft>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'evaluated'>('all');
  const [searchQuery, setSearchQuery]   = useState('');

  // Publishing results
  const [publishing, setPublishing] = useState(false);

  useEffect(() => { if (contentId && user) load(); }, [contentId, user]);

  const load = async () => {
    try {
      setLoading(true); setError('');
      const [c, s, st] = await Promise.all([
        contentService.getContentById(contentId!),
        examService.getAllSessionsForContent(contentId!, courseId),
        examService.getExamStatistics(contentId!),
      ]);
      if (!c) { setError('Content not found.'); return; }
      setContent(c);
      setSessions(s.filter(sess => ['submitted', 'auto_submitted'].includes(sess.status)));
      setStats(st);
    } catch (e: any) {
      setError(e.message || 'Failed to load.');
    } finally {
      setLoading(false);
    }
  };

  // ── Open session for evaluation ───────────────────────────────────────────────
  const openSession = (sess: ExamSession) => {
    setSelectedSession(sess);
    // Pre-fill draft with existing evaluation (if re-evaluating)
    const draft: EvalDraft = {};
    sess.writtenAnswers.forEach(wa => {
      draft[wa.questionId] = {
        marks: wa.marksAwarded ?? 0,
        comment: wa.evaluatorComment ?? '',
      };
    });
    setEvalDraft(draft);
    setSubmitSuccess('');
  };

  // ── Update draft ──────────────────────────────────────────────────────────────
  const updateDraft = (questionId: string, field: 'marks' | 'comment', value: string | number) => {
    setEvalDraft(prev => ({
      ...prev,
      [questionId]: { ...(prev[questionId] || { marks: 0, comment: '' }), [field]: value },
    }));
  };

  // ── Submit evaluation ─────────────────────────────────────────────────────────
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
      setSubmitSuccess('Evaluation saved successfully!');
      // Refresh sessions
      await load();
      // Close panel after a moment
      setTimeout(() => { setSelectedSession(null); setSubmitSuccess(''); }, 1500);
    } catch (e: any) {
      setError(e.message || 'Failed to submit evaluation.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Publish results ────────────────────────────────────────────────────────────
  const publishResults = async () => {
    if (!contentId || !confirm('Publish results now? Students will be able to see their scores.')) return;
    setPublishing(true);
    try {
      await examService.publishResults(contentId);
      setSubmitSuccess('Results published! Students can now view their scores.');
      await load();
    } catch (e: any) {
      setError(e.message || 'Failed to publish results.');
    } finally {
      setPublishing(false);
    }
  };

  // ── Filter sessions ───────────────────────────────────────────────────────────
  const filteredSessions = sessions.filter(s => {
    const matchesFilter =
      filterStatus === 'all' ? true :
      filterStatus === 'pending' ? s.writtenEvaluationPending :
      !s.writtenEvaluationPending;
    const matchesSearch = !searchQuery ||
      s.studentName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const pendingCount   = sessions.filter(s => s.writtenEvaluationPending).length;
  const evaluatedCount = sessions.filter(s => !s.writtenEvaluationPending).length;

  // ─── Written questions lookup ─────────────────────────────────────────────────
  const writtenQMap = React.useMemo(() => {
    const map: Record<string, WrittenQuestion> = {};
    (content?.writtenQuestions || []).forEach(q => { map[q.id] = q; });
    return map;
  }, [content]);

  // ─── Shell ────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0c14] flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-violet-400" />
      </div>
    );
  }

  if (error && !content) {
    return (
      <div className="min-h-screen bg-[#0a0c14] flex items-center justify-center">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0c14] text-white">
      <div className="fixed inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 25% at 50% -5%, rgba(139,92,246,0.07) 0%,transparent 65%)' }} />

      {/* Lightbox */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur"
             onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="attachment" className="max-w-4xl max-h-[90vh] object-contain rounded-xl shadow-2xl" />
          <button className="absolute top-4 right-4 text-white/60 hover:text-white">
            <X size={24} />
          </button>
        </div>
      )}

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <button onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-white/40 hover:text-white mb-6 transition group">
          <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" /> Back
        </button>

        <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center">
              <PenLine size={22} className="text-violet-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Exam Evaluation</h1>
              <p className="text-white/40 text-sm">{content?.title}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={load}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10
                         text-white/50 hover:text-white text-sm transition">
              <RefreshCcw size={13} /> Refresh
            </button>
            <button
              onClick={publishResults}
              disabled={publishing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600
                         text-white text-sm font-medium transition disabled:opacity-50"
            >
              {publishing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Publish Results
            </button>
          </div>
        </div>

        {/* Success toast */}
        {submitSuccess && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20
                          text-emerald-300 text-sm mb-6">
            <CheckCircle size={14} /> {submitSuccess}
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20
                          text-red-300 text-sm mb-6">
            <AlertTriangle size={14} /> {error}
            <button onClick={() => setError('')} className="ml-auto"><X size={13} /></button>
          </div>
        )}

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {[
              { label: 'Total Submissions', value: sessions.length, icon: <Users size={16} className="text-blue-400" /> },
              { label: 'Pending Evaluation', value: pendingCount, icon: <Clock size={16} className="text-amber-400" /> },
              { label: 'Avg Score', value: `${stats.averagePercentage.toFixed(1)}%`, icon: <BarChart2 size={16} className="text-violet-400" /> },
              { label: 'Pass Rate', value: `${stats.passRate.toFixed(1)}%`, icon: <Award size={16} className="text-emerald-400" /> },
            ].map(({ label, value, icon }) => (
              <div key={label} className="rounded-xl bg-white/4 border border-white/8 p-4 text-center">
                <div className="flex justify-center mb-1">{icon}</div>
                <p className="text-lg font-bold text-white">{value}</p>
                <p className="text-[11px] text-white/35">{label}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-6">
          {/* Session list */}
          <div className={`${selectedSession ? 'hidden lg:flex' : 'flex'} flex-col flex-1 min-w-0`}>
            {/* Filters */}
            <div className="flex gap-2 mb-4 flex-wrap">
              <div className="relative flex-1 max-w-xs">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
                <input
                  type="text"
                  placeholder="Search students…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-white/4 border border-white/8 rounded-xl text-sm
                             text-white/70 placeholder-white/20 focus:outline-none focus:border-white/20"
                />
              </div>
              {(['all', 'pending', 'evaluated'] as const).map(f => (
                <button key={f} onClick={() => setFilterStatus(f)}
                  className={`px-3 py-2 rounded-xl text-sm transition capitalize
                              ${filterStatus === f
                                ? 'bg-violet-500/20 border border-violet-500/30 text-violet-300'
                                : 'bg-white/4 border border-white/8 text-white/40 hover:text-white/60'}`}>
                  {f} {f === 'pending' && pendingCount > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px]">
                      {pendingCount}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Sessions */}
            <div className="space-y-2">
              {filteredSessions.length === 0 ? (
                <div className="text-center py-16 text-white/25">
                  <ClipboardList size={32} className="mx-auto mb-3 opacity-50" />
                  <p>No submissions found</p>
                </div>
              ) : (
                filteredSessions.map(sess => (
                  <SessionCard
                    key={sess.id}
                    session={sess}
                    isSelected={selectedSession?.id === sess.id}
                    onClick={() => openSession(sess)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Evaluation Panel */}
          {selectedSession && (
            <div className="flex-1 min-w-0 lg:max-w-xl">
              <div className="sticky top-4">
                <div className="rounded-2xl bg-[#0d0f1a] border border-white/8 overflow-hidden">
                  {/* Panel header */}
                  <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
                    <div>
                      <p className="font-semibold text-white">{selectedSession.studentName}</p>
                      <p className="text-xs text-white/35">
                        Submitted {selectedSession.submittedAt?.toLocaleString()}
                        {' · '}{fmt(selectedSession.timeTakenSeconds)}
                      </p>
                    </div>
                    <button onClick={() => setSelectedSession(null)} className="text-white/30 hover:text-white">
                      <X size={16} />
                    </button>
                  </div>

                  <div className="overflow-y-auto max-h-[70vh] p-5 space-y-6">
                    {selectedSession.writtenAnswers.length === 0 ? (
                      <p className="text-white/30 text-center py-8 text-sm">No written answers submitted.</p>
                    ) : (
                      selectedSession.writtenAnswers.map((wa, i) => {
                        const q = writtenQMap[wa.questionId];
                        const draft = evalDraft[wa.questionId] || { marks: 0, comment: '' };

                        return (
                          <div key={wa.questionId} className="rounded-xl bg-white/4 border border-white/8 p-4 space-y-4">
                            {/* Question */}
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-violet-400 font-semibold mb-1">
                                Question {i + 1} — {q?.marks ?? '?'} marks max
                              </p>
                              <p className="text-white text-sm">{q?.question ?? wa.questionId}</p>
                            </div>

                            {/* Student answer */}
                            {wa.answerText && (
                              <div className="bg-white/3 rounded-lg px-3 py-2.5">
                                <p className="text-[10px] uppercase tracking-wider text-white/25 mb-1">Student's answer</p>
                                <p className="text-white/70 text-sm whitespace-pre-wrap leading-relaxed">{wa.answerText}</p>
                              </div>
                            )}

                            {/* Attachments */}
                            {(wa.attachmentUrls || []).length > 0 && (
                              <div>
                                <p className="text-[10px] uppercase tracking-wider text-white/25 mb-2">Attachments</p>
                                <div className="flex flex-wrap gap-2">
                                  {wa.attachmentUrls!.map((url, ui) => (
                                    <div key={ui} className="relative group">
                                      <img src={url} alt={`attachment ${ui + 1}`}
                                           className="w-20 h-20 object-cover rounded-lg border border-white/10" />
                                      <button
                                        onClick={() => setLightboxUrl(url)}
                                        className="absolute inset-0 flex items-center justify-center bg-black/40
                                                   opacity-0 group-hover:opacity-100 transition rounded-lg">
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
                                  Marks awarded (max {q?.marks ?? '?'})
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  max={q?.marks ?? 999}
                                  value={draft.marks}
                                  onChange={e => updateDraft(wa.questionId, 'marks', e.target.value)}
                                  className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-white text-sm
                                             focus:outline-none focus:border-violet-400/50"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5 block">
                                  Comment (optional)
                                </label>
                                <textarea
                                  value={draft.comment}
                                  onChange={e => updateDraft(wa.questionId, 'comment', e.target.value)}
                                  placeholder="Feedback for student…"
                                  rows={2}
                                  className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-white text-sm
                                             focus:outline-none focus:border-violet-400/50 placeholder-white/20 resize-none"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Submit evaluation */}
                  <div className="px-5 py-4 border-t border-white/8">
                    {submitSuccess && (
                      <p className="text-emerald-400 text-sm mb-3 flex items-center gap-1.5">
                        <CheckCircle size={13} /> {submitSuccess}
                      </p>
                    )}
                    <button
                      onClick={submitEvaluation}
                      disabled={submitting || selectedSession.writtenAnswers.length === 0}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                                 bg-violet-500 hover:bg-violet-600 text-white font-semibold text-sm
                                 transition disabled:opacity-50"
                    >
                      {submitting
                        ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
                        : <><Check size={14} /> Save Evaluation</>}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Session Card ─────────────────────────────────────────────────────────────
const SessionCard: React.FC<{
  session: ExamSession;
  isSelected: boolean;
  onClick: () => void;
}> = ({ session, isSelected, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full text-left flex items-center gap-4 px-4 py-3.5 rounded-xl border transition
                ${isSelected
                  ? 'border-violet-500/40 bg-violet-500/8'
                  : 'border-white/6 bg-white/2 hover:border-white/12 hover:bg-white/4'}`}
  >
    {/* Avatar */}
    <div className="w-9 h-9 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
      <span className="text-sm font-bold text-violet-300">{session.studentName.charAt(0)}</span>
    </div>

    <div className="flex-1 min-w-0">
      <p className="text-white text-sm font-medium truncate">{session.studentName}</p>
      <p className="text-white/30 text-xs">
        {session.submittedAt?.toLocaleDateString()} · {fmt(session.timeTakenSeconds)}
        {session.tabSwitchCount > 0 && (
          <span className="ml-2 text-amber-400">⚠ {session.tabSwitchCount} tab switch</span>
        )}
      </p>
    </div>

    <div className="text-right shrink-0">
      <p className="text-sm font-bold text-white">{session.percentage.toFixed(1)}%</p>
      <span className={`text-[10px] font-semibold uppercase
                        ${session.writtenEvaluationPending ? 'text-amber-400' : 'text-emerald-400'}`}>
        {session.writtenEvaluationPending ? 'PENDING' : 'EVALUATED'}
      </span>
    </div>
  </button>
);

export default ExamEvaluation;
