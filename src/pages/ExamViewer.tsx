// src/pages/ExamViewer.tsx
// Production-grade Exam Viewer — handles MCQ + Written + Mixed exams
// Features: Directions page, Timed exam, Anti-cheat, Auto-submit, 
//           Scheduled/Practice logic, Result publishing, Written file upload,
//           Question navigator, Statistics, Solution review.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Clock, AlertTriangle, CheckCircle, XCircle,
  Shield, Eye, EyeOff, Upload, X, FileText, ChevronLeft,
  ChevronRight, BarChart2, Award, Target, Loader2,
  ClipboardList, PenLine, BookOpen, Check, AlertCircle,
  Paperclip, Trash2, ZoomIn, Lock,
} from 'lucide-react';
import { useDashboard } from '../contexts/DashboardContext';
import { contentService, Content, MCQQuestion, WrittenQuestion } from '../services/contentService';
import {
  examService,
  ExamSession,
  MCQAnswer,
  WrittenAnswer,
  StudentExamStatus,
} from '../services/examService';
import { uploadService } from '../services/uploadService';

// ─── Types ────────────────────────────────────────────────────────────────────
type Phase =
  | 'loading'
  | 'directions'
  | 'mcq'
  | 'written'
  | 'submitted'
  | 'results'
  | 'blocked'       // submitted, result not yet published
  | 'scheduled_locked'
  | 'absent'
  | 'attempt_limit';

type ExamPart = 'mcq' | 'written';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (secs: number) => {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const shuffleArray = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const applyLockedPositions = <T extends { isLocked?: boolean; lockedPosition?: 'first' | 'last' | null }>(
  questions: T[]
): T[] => {
  const first = questions.filter(q => q.isLocked && q.lockedPosition === 'first');
  const last  = questions.filter(q => q.isLocked && q.lockedPosition === 'last');
  const free  = questions.filter(q => !q.isLocked || !q.lockedPosition);
  return [...first, ...shuffleArray(free), ...last];
};

const isExamOpen = (content: Content): boolean => {
  if (content.examTimelineType === 'scheduled') {
    const now = Date.now();
    const start = content.examStartDateTime ? new Date(content.examStartDateTime).getTime() : 0;
    const end   = content.examEndDateTime   ? new Date(content.examEndDateTime).getTime()   : Infinity;
    return now >= start && now <= end;
  }
  return true; // practice
};

const isResultVisible = (content: Content, session?: ExamSession | null): boolean => {
  if (!session) return false;
  if (session.resultVisibility === 'visible') return true;
  if (content.resultPublishType === 'immediate') return true;
  if (content.resultPublishType === 'scheduled' && content.resultPublishDateTime) {
    return Date.now() >= new Date(content.resultPublishDateTime).getTime();
  }
  return false;
};

// ─── Anti-cheat hook ──────────────────────────────────────────────────────────
function useAntiCheat(
  active: boolean,
  sessionId: string | null,
  onViolation: (type: string) => void
) {
  useEffect(() => {
    if (!active || !sessionId) return;

    const onContextMenu = (e: Event) => { e.preventDefault(); onViolation('right_click'); };
    const onCopy = (e: Event) => { e.preventDefault(); onViolation('copy_attempt'); };
    const onVisChange = () => {
      if (document.hidden) onViolation('tab_switch');
    };
    const onBlur = () => onViolation('focus_lost');
    const onKeyDown = (e: KeyboardEvent) => {
      // Disable F12, Ctrl+Shift+I, Ctrl+U
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && e.key === 'I') ||
        (e.ctrlKey && e.key === 'u') ||
        (e.ctrlKey && e.key === 'p')
      ) {
        e.preventDefault();
        onViolation('devtools_attempt');
      }
    };
    const onSelect = (e: Event) => { e.preventDefault(); };

    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCopy);
    document.addEventListener('visibilitychange', onVisChange);
    window.addEventListener('blur', onBlur);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('selectstart', onSelect);

    return () => {
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCopy);
      document.removeEventListener('visibilitychange', onVisChange);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('selectstart', onSelect);
    };
  }, [active, sessionId, onViolation]);
}

// ─── Timer hook ───────────────────────────────────────────────────────────────
function useTimer(initialSeconds: number, active: boolean, onExpire: () => void) {
  const [remaining, setRemaining] = useState(initialSeconds);
  const expiredRef = useRef(false);

  useEffect(() => {
    setRemaining(initialSeconds);
    expiredRef.current = false;
  }, [initialSeconds]);

  useEffect(() => {
    if (!active) return;
    if (remaining <= 0) {
      if (!expiredRef.current) {
        expiredRef.current = true;
        onExpire();
      }
      return;
    }
    const id = setInterval(() => setRemaining(p => {
      if (p <= 1) {
        clearInterval(id);
        if (!expiredRef.current) { expiredRef.current = true; onExpire(); }
        return 0;
      }
      return p - 1;
    }), 1000);
    return () => clearInterval(id);
  }, [active, remaining <= 0]);

  return remaining;
}

// ─── Upload helper ────────────────────────────────────────────────────────────
async function uploadAttachment(file: File): Promise<string> {
  const result = await uploadService.uploadToSupabase(file, 'exam-answers');
  return result.url;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main ExamViewer Component
// ═══════════════════════════════════════════════════════════════════════════════
const ExamViewer: React.FC = () => {
  const { courseId, contentId } = useParams<{ courseId: string; contentId: string }>();
  const navigate   = useNavigate();
  const location   = useLocation();
  const { user }   = useDashboard();

  // ── Core state ───────────────────────────────────────────────────────────────
  const [phase, setPhase]       = useState<Phase>('loading');
  const [content, setContent]   = useState<Content | null>(null);
  const [examStatus, setExamStatus] = useState<StudentExamStatus | null>(null);
  const [session, setSession]   = useState<ExamSession | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError]       = useState('');

  // ── Questions ─────────────────────────────────────────────────────────────────
  const [mcqQuestions, setMcqQuestions]         = useState<MCQQuestion[]>([]);
  const [writtenQuestions, setWrittenQuestions] = useState<WrittenQuestion[]>([]);

  // ── Exam UI state ─────────────────────────────────────────────────────────────
  const [activePart, setActivePart]   = useState<ExamPart>('mcq');
  const [mcqIndex, setMcqIndex]       = useState(0);
  const [writtenIndex, setWrittenIndex] = useState(0);
  const [mcqAnswers, setMcqAnswers]   = useState<MCQAnswer[]>([]);
  const [writtenAnswers, setWrittenAnswers] = useState<WrittenAnswer[]>([]);
  const [mcqTimerActive, setMcqTimerActive]       = useState(false);
  const [writtenTimerActive, setWrittenTimerActive] = useState(false);
  const [startTime, setStartTime]     = useState<number>(Date.now());
  const [submitting, setSubmitting]   = useState(false);
  const [startingPart, setStartingPart] = useState<ExamPart | null>(null);

  // ── Written attachments upload state ─────────────────────────────────────────
  const [uploadingFor, setUploadingFor] = useState<string | null>(null); // questionId
  const [lightboxUrl, setLightboxUrl]   = useState<string | null>(null);

  // ── Violation warnings ────────────────────────────────────────────────────────
  const [violationWarning, setViolationWarning] = useState('');
  const violationTimer = useRef<any>(null);

  // ─── Anti-cheat ──────────────────────────────────────────────────────────────
  const examActive = phase === 'mcq' || phase === 'written';

  const handleViolation = useCallback((type: string) => {
    if (!sessionId) return;
    examService.logAntiCheatEvent(sessionId, type);
    setViolationWarning(
      type === 'tab_switch' ? '⚠️ Tab switch detected! This is monitored.' :
      type === 'focus_lost' ? '⚠️ Window focus lost! Stay on the exam.' :
      type === 'right_click' ? '⚠️ Right-click is disabled during exam.' :
      type === 'copy_attempt' ? '⚠️ Copy/paste is disabled during exam.' :
      '⚠️ Suspicious activity detected!'
    );
    clearTimeout(violationTimer.current);
    violationTimer.current = setTimeout(() => setViolationWarning(''), 3000);
  }, [sessionId]);

  useAntiCheat(examActive, sessionId, handleViolation);

  // ─── Timer: MCQ ───────────────────────────────────────────────────────────────
  const mcqDuration = (content?.mcqDuration ?? 0) * 60;
  const mcqRemaining = useTimer(mcqDuration, mcqTimerActive && activePart === 'mcq', () => {
    if (content?.examType === 'mcq') {
      autoSubmit();
    } else if (content?.examType === 'mixed') {
      // MCQ time up → move to written
      setMcqTimerActive(false);
      setActivePart('written');
      setWrittenTimerActive(true);
    }
  });

  // ─── Timer: Written ────────────────────────────────────────────────────────────
  const writtenDuration = (content?.writtenDuration ?? 0) * 60;
  const writtenRemaining = useTimer(writtenDuration, writtenTimerActive && activePart === 'written', () => {
    autoSubmit();
  });

  const timerRemaining = activePart === 'mcq' ? mcqRemaining : writtenRemaining;
  const timerIsWarning = timerRemaining < 120;

  // ─── Load content & status ────────────────────────────────────────────────────
  useEffect(() => {
    if (!contentId || !user) return;
    loadExam();
  }, [contentId, user]);

  const loadExam = async () => {
    try {
      setPhase('loading');
      setError('');

      const c = location.state?.contentData || await contentService.getContentById(contentId!);
      if (!c) { setError('Exam not found.'); setPhase('loading'); return; }
      // Full exam data needed
      const fullContent = await contentService.getContentById(contentId!);
      if (!fullContent) { setError('Exam not found.'); return; }
      setContent(fullContent);

      const status = await examService.getStudentExamStatus(contentId!, user!.uid, courseId);
      setExamStatus(status);

      // Determine what to show
      await determinePhase(fullContent, status);
    } catch (e: any) {
      setError(e.message || 'Failed to load exam.');
      setPhase('loading');
    }
  };

  const determinePhase = async (c: Content, status: StudentExamStatus | null) => {
    // 1. Scheduled exam not open yet?
    if (c.examTimelineType === 'scheduled') {
      const now  = Date.now();
      const start = c.examStartDateTime ? new Date(c.examStartDateTime).getTime() : 0;
      const end   = c.examEndDateTime   ? new Date(c.examEndDateTime).getTime()   : Infinity;

      if (now < start) {
        setPhase('scheduled_locked'); return;
      }
      if (now > end) {
        // Exam window closed. If student never attempted → mark absent
        if (!status || status.status === 'not_started') {
          await examService.markAbsent(c.id, user!.uid, courseId);
          setPhase('absent'); return;
        }
      }
    }

    // 2. Attempt limit
    if (status?.status === 'attempt_limit_reached') {
      setPhase('attempt_limit'); return;
    }
    if (status?.status === 'absent') {
      setPhase('absent'); return;
    }

    // 3. Attempt limit check (numeric)
    if (c.maxAttempts && c.maxAttempts !== 'unlimited') {
      const count = status?.attemptCount ?? 0;
      if (count >= Number(c.maxAttempts)) {
        setPhase('attempt_limit'); return;
      }
    }

    // 4. In progress session? (browser closed mid-exam)
    if (status?.lastAttemptId && status.status === 'in_progress') {
      const sess = await examService.getExamSession(status.lastAttemptId);
      if (sess && sess.status === 'in_progress') {
        // Resume
        setSession(sess);
        setSessionId(sess.id);
        restoreSession(c, sess);
        return;
      }
    }

    // 5. Already submitted → check result visibility
    if (status?.status === 'completed') {
      const lastSess = status.lastAttemptId
        ? await examService.getExamSession(status.lastAttemptId)
        : null;
      setSession(lastSess);

      if (isResultVisible(c, lastSess)) {
        setPhase('results');
      } else {
        setPhase('blocked');
      }
      return;
    }

    // 6. Show directions
    setPhase('directions');
  };

  const restoreSession = (c: Content, sess: ExamSession) => {
    const mcq     = (c.mcqQuestions || []).filter(q => sess.mcqQuestionIds.includes(q.id));
    const written = (c.writtenQuestions || []).filter(q => sess.writtenQuestionIds.includes(q.id));
    setMcqQuestions(mcq);
    setWrittenQuestions(written);
    setMcqAnswers(sess.mcqAnswers);
    setWrittenAnswers(sess.writtenAnswers);
    setStartTime(sess.startedAt.getTime());

    const now = Date.now();
    const elapsed = Math.floor((now - sess.startedAt.getTime()) / 1000);

    if (c.examType === 'written') {
      setActivePart('written');
      setWrittenTimerActive(true);
      setPhase('written');
    } else {
      setActivePart('mcq');
      setMcqTimerActive(true);
      setPhase('mcq');
    }
  };

  // ─── Start Exam ───────────────────────────────────────────────────────────────
  const startExam = async (part: ExamPart) => {
    if (!content || !user) return;
    try {
      setSubmitting(true);
      setStartingPart(part);

      // Prepare MCQ questions
      let mcq: MCQQuestion[] = [];
      if (content.examType !== 'written') {
        const allMcq = content.mcqQuestions || [];
        const pool   = applyLockedPositions(allMcq);
        const showCount = content.mcqQuestionsToShow || allMcq.length;
        mcq = pool.slice(0, showCount);
      }

      // Prepare Written questions
      let written: WrittenQuestion[] = [];
      if (content.examType !== 'mcq') {
        const allW = content.writtenQuestions || [];
        const pool = applyLockedPositions(allW);
        const showCount = content.writtenQuestionsToShow || allW.length;
        written = pool.slice(0, showCount);
      }

      // Calculate maxMarks
      const mcqMax     = mcq.reduce((s, q) => s + q.correctMarks, 0);
      const writtenMax = written.reduce((s, q) => s + q.marks, 0);
      const maxMarks   = mcqMax + writtenMax;

      // Result visibility
      const resultVisibility =
        content.resultPublishType === 'immediate' ? 'visible' : 'hidden';

      const sid = await examService.startExamSession({
        contentId: content.id,
        courseId,
        studentId: user.uid,
        studentName: user.name,
        studentEmail: user.email,
        mcqQuestionIds: mcq.map(q => q.id),
        writtenQuestionIds: written.map(q => q.id),
        maxMarks,
        resultVisibility,
      });

      setSessionId(sid);
      setMcqQuestions(mcq);
      setWrittenQuestions(written);
      setMcqAnswers(mcq.map(q => ({
        questionId: q.id,
        selectedOptions: [],
        isCorrect: false,
        marksAwarded: 0,
      })));
      setWrittenAnswers(written.map(q => ({
        questionId: q.id,
        answerText: '',
        attachmentUrls: [],
      })));
      setStartTime(Date.now());
      setMcqIndex(0);
      setWrittenIndex(0);

      if (part === 'mcq' || content.examType === 'mcq' || content.examType === 'mixed') {
        setActivePart('mcq');
        setMcqTimerActive(true);
        setPhase('mcq');
      } else {
        setActivePart('written');
        setWrittenTimerActive(true);
        setPhase('written');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to start exam.');
    } finally {
      setSubmitting(false);
      setStartingPart(null);
    }
  };

  // ─── MCQ answer selection ─────────────────────────────────────────────────────
  const selectMcqOption = (qIndex: number, optionIndex: number) => {
    const q = mcqQuestions[qIndex];
    const current = mcqAnswers[qIndex] || {
      questionId: q.id,
      selectedOptions: [],
      isCorrect: false,
      marksAwarded: 0,
    };

    // Single correct → radio; multiple correct → checkbox
    const isSingleCorrect = q.correctOptions.length === 1;
    let newSelected: number[];

    if (isSingleCorrect) {
      newSelected = current.selectedOptions[0] === optionIndex ? [] : [optionIndex];
    } else {
      newSelected = current.selectedOptions.includes(optionIndex)
        ? current.selectedOptions.filter(o => o !== optionIndex)
        : [...current.selectedOptions, optionIndex];
    }

    // Evaluate
    const isCorrect = newSelected.length > 0 &&
      newSelected.every(o => q.correctOptions.includes(o)) &&
      q.correctOptions.every(o => newSelected.includes(o));

    let marksAwarded = 0;
    if (newSelected.length === 0) {
      marksAwarded = q.skipMarks ?? 0;
    } else if (isCorrect) {
      marksAwarded = q.correctMarks;
    } else {
      marksAwarded = -(q.wrongMarks ?? 0);
    }

    const updated = [...mcqAnswers];
    updated[qIndex] = { questionId: q.id, selectedOptions: newSelected, isCorrect, marksAwarded };
    setMcqAnswers(updated);

    // Autosave every 5 questions
    if (qIndex % 5 === 4 && sessionId) {
      const mcqMarks = updated.reduce((s, a) => s + a.marksAwarded, 0);
      examService.saveMCQAnswers(sessionId, updated, mcqMarks);
    }
  };

  // ─── Written answer change ────────────────────────────────────────────────────
  const changeWrittenAnswer = (qIndex: number, text: string) => {
    const updated = [...writtenAnswers];
    updated[qIndex] = { ...updated[qIndex], answerText: text };
    setWrittenAnswers(updated);
  };

  // ─── Written attachment upload ────────────────────────────────────────────────
  const handleAttachmentUpload = async (qIndex: number, file: File) => {
    if (!sessionId) return;
    const qId = writtenQuestions[qIndex].id;
    setUploadingFor(qId);
    try {
      const url = await uploadAttachment(file);
      await examService.addWrittenAttachment(sessionId, qId, url);
      const updated = [...writtenAnswers];
      updated[qIndex] = {
        ...updated[qIndex],
        attachmentUrls: [...(updated[qIndex].attachmentUrls || []), url],
      };
      setWrittenAnswers(updated);
    } catch (e: any) {
      setError('Upload failed: ' + e.message);
    } finally {
      setUploadingFor(null);
    }
  };

  const removeAttachment = async (qIndex: number, url: string) => {
    if (!sessionId) return;
    const qId = writtenQuestions[qIndex].id;
    await examService.removeWrittenAttachment(sessionId, qId, url);
    const updated = [...writtenAnswers];
    updated[qIndex] = {
      ...updated[qIndex],
      attachmentUrls: (updated[qIndex].attachmentUrls || []).filter(u => u !== url),
    };
    setWrittenAnswers(updated);
  };

  // ─── Auto-submit ──────────────────────────────────────────────────────────────
  const autoSubmit = useCallback(() => {
    submitExam(true);
  }, [sessionId, mcqAnswers, writtenAnswers]);

  // ─── Submit ───────────────────────────────────────────────────────────────────
  const submitExam = async (auto = false) => {
    if (!sessionId || !content || submitting) return;
    setSubmitting(true);
    setMcqTimerActive(false);
    setWrittenTimerActive(false);

    try {
      // Save written answers first
      if (sessionId) await examService.saveWrittenAnswers(sessionId, writtenAnswers);

      const mcqMarks = mcqAnswers.reduce((s, a) => s + a.marksAwarded, 0);
      const timeTaken = Math.floor((Date.now() - startTime) / 1000);

      await examService.submitExamSession(
        sessionId,
        mcqAnswers,
        writtenAnswers,
        mcqMarks,
        timeTaken,
        auto
      );

      // Reload session to get full data
      const updatedSession = await examService.getExamSession(sessionId);
      setSession(updatedSession);

      // Reload status
      const newStatus = await examService.getStudentExamStatus(contentId!, user!.uid, courseId);
      setExamStatus(newStatus);

      if (isResultVisible(content, updatedSession)) {
        setPhase('results');
      } else {
        setPhase('blocked');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to submit exam.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Switch MCQ → Written ─────────────────────────────────────────────────────
  const switchToWritten = () => {
    setMcqTimerActive(false);
    setActivePart('written');
    setWrittenTimerActive(true);
    setPhase('written');
    if (sessionId) {
      const mcqMarks = mcqAnswers.reduce((s, a) => s + a.marksAwarded, 0);
      examService.saveMCQAnswers(sessionId, mcqAnswers, mcqMarks);
    }
  };

  // ─── Question status for navigator ───────────────────────────────────────────
  const mcqStatus = (i: number): 'answered' | 'skipped' | 'not_visited' => {
    const a = mcqAnswers[i];
    if (!a) return 'not_visited';
    return a.selectedOptions.length > 0 ? 'answered' : 'skipped';
  };

  const writtenStatus = (i: number): 'answered' | 'not_visited' => {
    const a = writtenAnswers[i];
    if (!a) return 'not_visited';
    return (a.answerText && a.answerText.trim()) || (a.attachmentUrls?.length ?? 0) > 0
      ? 'answered'
      : 'not_visited';
  };

  // ─── MCQ answered count ───────────────────────────────────────────────────────
  const mcqAnsweredCount   = mcqAnswers.filter(a => a.selectedOptions.length > 0).length;
  const writtenAnsweredCount = writtenAnswers.filter(a =>
    (a.answerText?.trim()) || (a.attachmentUrls?.length ?? 0) > 0
  ).length;

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER PHASES
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── Shell ──────────────────────────────────────────────────────────────────────
  const Shell: React.FC<{ children: React.ReactNode; noPad?: boolean }> = ({ children, noPad }) => (
    <div className="min-h-screen bg-[#0a0c14] text-white select-none">
      <div className="fixed inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 30% at 50% -5%, rgba(244,63,94,0.07) 0%,transparent 65%)' }} />
      {!noPad ? (
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-8">{children}</div>
      ) : children}
    </div>
  );

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <Shell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <Loader2 size={32} className="animate-spin text-rose-400" />
          {error ? (
            <div className="text-center">
              <p className="text-rose-400 mb-3">{error}</p>
              <button onClick={() => navigate(-1)} className="text-sm text-white/40 hover:text-white">
                ← Go back
              </button>
            </div>
          ) : (
            <p className="text-white/40 text-sm">Loading exam…</p>
          )}
        </div>
      </Shell>
    );
  }

  // ── Scheduled locked ──────────────────────────────────────────────────────────
  if (phase === 'scheduled_locked') {
    const start = content?.examStartDateTime ? new Date(content.examStartDateTime) : null;
    return (
      <Shell>
        <BackBtn />
        <StatusCard
          icon={<Lock size={36} className="text-amber-400" />}
          color="amber"
          title="Exam Not Started Yet"
          message={start ? `This exam opens on ${start.toLocaleString()}` : 'Check back later.'}
        />
      </Shell>
    );
  }

  // ── Absent ────────────────────────────────────────────────────────────────────
  if (phase === 'absent') {
    return (
      <Shell>
        <BackBtn />
        <StatusCard
          icon={<XCircle size={36} className="text-red-400" />}
          color="red"
          title="Marked Absent"
          message="The exam window has closed and you didn't attempt this exam. You've been marked absent."
          badge="ABSENT"
        />
      </Shell>
    );
  }

  // ── Attempt limit ─────────────────────────────────────────────────────────────
  if (phase === 'attempt_limit') {
    return (
      <Shell>
        <BackBtn />
        <StatusCard
          icon={<AlertCircle size={36} className="text-orange-400" />}
          color="orange"
          title="Attempt Limit Reached"
          message={`You've used all allowed attempts for this exam.`}
          badge="LIMIT REACHED"
        />
      </Shell>
    );
  }

  // ── Directions ────────────────────────────────────────────────────────────────
  if (phase === 'directions') {
    return <DirectionsPage content={content!} examStatus={examStatus} onStart={startExam} startingPart={startingPart} />;
  }

  // ── Blocked (submitted, result not published yet) ─────────────────────────────
  if (phase === 'blocked') {
    const publishAt = content?.resultPublishDateTime
      ? new Date(content.resultPublishDateTime).toLocaleString()
      : null;
    return (
      <Shell>
        <BackBtn />
        <StatusCard
          icon={<EyeOff size={36} className="text-indigo-400" />}
          color="indigo"
          title="Exam Submitted"
          message={
            publishAt
              ? `Results will be published on ${publishAt}. Come back then!`
              : 'Your exam has been submitted. Results will be published when the teacher releases them.'
          }
          badge="SUBMITTED"
        />
      </Shell>
    );
  }

  // ── Results ───────────────────────────────────────────────────────────────────
  if (phase === 'results') {
    return (
      <ResultsPage
        content={content!}
        session={session!}
        mcqQuestions={mcqQuestions.length ? mcqQuestions : (content?.mcqQuestions || [])}
        writtenQuestions={writtenQuestions.length ? writtenQuestions : (content?.writtenQuestions || [])}
        onBack={() => navigate(-1)}
      />
    );
  }

  // ── MCQ Exam ──────────────────────────────────────────────────────────────────
  if (phase === 'mcq' || (phase === 'written' && content?.examType === 'mcq')) {
    const q = mcqQuestions[mcqIndex];
    return (
      <Shell noPad>
        {/* Violation warning toast */}
        {violationWarning && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5
                          bg-red-500/90 backdrop-blur rounded-xl text-white text-sm font-medium shadow-xl">
            <Shield size={14} /> {violationWarning}
          </div>
        )}

        {/* Header bar */}
        <div className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3
                        bg-[#0a0c14]/95 backdrop-blur border-b border-white/6">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white/40 truncate">{content?.title}</p>
            <p className="text-sm font-semibold text-white">
              MCQ — Q {mcqIndex + 1} / {mcqQuestions.length}
            </p>
          </div>

          {/* Timer */}
          {content?.mcqDuration ? (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-mono font-bold
                             ${timerIsWarning ? 'bg-red-500/20 text-red-300 animate-pulse' : 'bg-white/6 text-white'}`}>
              <Clock size={13} /> {fmt(mcqRemaining)}
            </div>
          ) : null}

          {/* Switch to written */}
          {content?.examType === 'mixed' && (
            <button
              onClick={switchToWritten}
              className="text-xs px-3 py-1.5 rounded-lg bg-violet-500/15 border border-violet-500/20
                         text-violet-300 hover:bg-violet-500/25 transition"
            >
              Written →
            </button>
          )}

          <button
            onClick={() => { if (confirm('Submit exam now?')) submitExam(); }}
            disabled={submitting}
            className="px-4 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-sm font-medium
                       transition disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        </div>

        <div className="flex h-[calc(100vh-57px)]">
          {/* Question navigator sidebar */}
          <div className="hidden lg:flex flex-col w-48 border-r border-white/6 bg-[#0d0f1a] p-3 gap-2 overflow-y-auto shrink-0">
            <p className="text-[10px] uppercase tracking-widest text-white/25 px-1 mb-1">Questions</p>
            <div className="grid grid-cols-5 gap-1">
              {mcqQuestions.map((_, i) => {
                const st = mcqStatus(i);
                return (
                  <button key={i} onClick={() => setMcqIndex(i)}
                    className={`w-7 h-7 rounded text-[11px] font-medium transition
                      ${mcqIndex === i ? 'ring-2 ring-rose-400' : ''}
                      ${st === 'answered' ? 'bg-emerald-500/30 text-emerald-300' :
                        st === 'skipped'  ? 'bg-amber-500/20 text-amber-300' :
                                            'bg-white/6 text-white/40'}`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
            <div className="mt-auto space-y-1.5 pt-4 text-xs">
              <div className="flex items-center gap-2 text-white/40">
                <span className="w-3 h-3 rounded-sm bg-emerald-500/30" /> Answered ({mcqAnsweredCount})
              </div>
              <div className="flex items-center gap-2 text-white/40">
                <span className="w-3 h-3 rounded-sm bg-white/6" /> Not visited
              </div>
            </div>
          </div>

          {/* Question area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-8">
            {q && (
              <div className="max-w-2xl mx-auto">
                {/* Question */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[11px] uppercase tracking-wider text-rose-400 font-semibold">
                      Question {mcqIndex + 1}
                    </span>
                    <span className="text-[10px] text-white/25">
                      {q.correctMarks > 0 && `+${q.correctMarks}`}
                      {q.wrongMarks > 0 && ` / -${q.wrongMarks}`}
                      {' marks'}
                    </span>
                    {q.correctOptions.length > 1 && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-violet-500/15 text-violet-300">
                        Multiple correct
                      </span>
                    )}
                  </div>
                  <p className="text-white text-[15px] leading-relaxed">{q.question}</p>
                  {q.questionImage && (
                    <img src={q.questionImage} alt="question" className="mt-3 max-h-48 rounded-xl object-contain" />
                  )}
                </div>

                {/* Options */}
                <div className="space-y-2.5 mb-8">
                  {q.options.map((opt, oIdx) => {
                    const selected = mcqAnswers[mcqIndex]?.selectedOptions.includes(oIdx) ?? false;
                    return (
                      <button key={oIdx} onClick={() => selectMcqOption(mcqIndex, oIdx)}
                        className={`w-full text-left flex items-start gap-3 px-4 py-3.5 rounded-xl border
                                    transition-all duration-150 text-sm
                                    ${selected
                                      ? 'border-rose-400/60 bg-rose-500/10 text-white'
                                      : 'border-white/8 bg-white/3 text-white/70 hover:border-white/20 hover:bg-white/6'}`}
                      >
                        <span className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center
                                          mt-0.5 transition
                                          ${selected ? 'border-rose-400 bg-rose-400' : 'border-white/25'}`}>
                          {selected && <Check size={10} className="text-white" strokeWidth={3} />}
                        </span>
                        <span>{opt}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Nav */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setMcqIndex(p => Math.max(0, p - 1))}
                    disabled={mcqIndex === 0}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10
                               disabled:opacity-30 text-sm transition"
                  >
                    <ChevronLeft size={15} /> Prev
                  </button>

                  {mcqIndex < mcqQuestions.length - 1 ? (
                    <button
                      onClick={() => setMcqIndex(p => p + 1)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-500/20
                                 hover:bg-rose-500/30 text-rose-300 text-sm transition"
                    >
                      Next <ChevronRight size={15} />
                    </button>
                  ) : content?.examType === 'mixed' ? (
                    <button
                      onClick={switchToWritten}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-500/20
                                 hover:bg-violet-500/30 text-violet-300 text-sm transition"
                    >
                      Go to Written <ChevronRight size={15} />
                    </button>
                  ) : (
                    <button
                      onClick={() => { if (confirm('Submit exam?')) submitExam(); }}
                      className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm transition"
                    >
                      Submit Exam
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </Shell>
    );
  }

  // ── Written Exam ──────────────────────────────────────────────────────────────
  if (phase === 'written') {
    const wq = writtenQuestions[writtenIndex];
    const wa = writtenAnswers[writtenIndex] || { questionId: wq?.id, answerText: '', attachmentUrls: [] };
    const fileInputRef = React.createRef<HTMLInputElement>();

    return (
      <Shell noPad>
        {violationWarning && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5
                          bg-red-500/90 backdrop-blur rounded-xl text-white text-sm font-medium shadow-xl">
            <Shield size={14} /> {violationWarning}
          </div>
        )}

        {/* Lightbox */}
        {lightboxUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur"
               onClick={() => setLightboxUrl(null)}>
            <img src={lightboxUrl} alt="attachment" className="max-w-4xl max-h-[90vh] object-contain rounded-xl" />
            <button className="absolute top-4 right-4 text-white/60 hover:text-white">
              <X size={24} />
            </button>
          </div>
        )}

        {/* Header */}
        <div className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3
                        bg-[#0a0c14]/95 backdrop-blur border-b border-white/6">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white/40 truncate">{content?.title}</p>
            <p className="text-sm font-semibold text-white">
              Written — Q {writtenIndex + 1} / {writtenQuestions.length}
            </p>
          </div>

          {content?.writtenDuration ? (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-mono font-bold
                             ${timerIsWarning ? 'bg-red-500/20 text-red-300 animate-pulse' : 'bg-white/6 text-white'}`}>
              <Clock size={13} /> {fmt(writtenRemaining)}
            </div>
          ) : null}

          <button
            onClick={() => { if (confirm('Submit exam now?')) submitExam(); }}
            disabled={submitting}
            className="px-4 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-sm font-medium
                       transition disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        </div>

        <div className="flex h-[calc(100vh-57px)]">
          {/* Sidebar */}
          <div className="hidden lg:flex flex-col w-48 border-r border-white/6 bg-[#0d0f1a] p-3 gap-2 overflow-y-auto shrink-0">
            <p className="text-[10px] uppercase tracking-widest text-white/25 px-1 mb-1">Questions</p>
            <div className="grid grid-cols-5 gap-1">
              {writtenQuestions.map((_, i) => {
                const st = writtenStatus(i);
                return (
                  <button key={i} onClick={() => setWrittenIndex(i)}
                    className={`w-7 h-7 rounded text-[11px] font-medium transition
                      ${writtenIndex === i ? 'ring-2 ring-violet-400' : ''}
                      ${st === 'answered' ? 'bg-emerald-500/30 text-emerald-300' : 'bg-white/6 text-white/40'}`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
            <div className="mt-auto pt-4 text-xs text-white/40">
              {writtenAnsweredCount}/{writtenQuestions.length} answered
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-8">
            {wq && (
              <div className="max-w-2xl mx-auto space-y-5">
                {/* Question */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[11px] uppercase tracking-wider text-violet-400 font-semibold">
                      Question {writtenIndex + 1}
                    </span>
                    <span className="text-[10px] text-white/25">{wq.marks} marks</span>
                  </div>
                  <p className="text-white text-[15px] leading-relaxed">{wq.question}</p>
                  {wq.questionImage && (
                    <img src={wq.questionImage} alt="question" className="mt-3 max-h-48 rounded-xl object-contain" />
                  )}
                </div>

                {/* Text answer */}
                <div>
                  <p className="text-[11px] text-white/40 mb-2 uppercase tracking-wider">Your answer (optional)</p>
                  <textarea
                    value={wa.answerText || ''}
                    onChange={e => changeWrittenAnswer(writtenIndex, e.target.value)}
                    placeholder="Type your answer here…"
                    rows={6}
                    className="w-full bg-white/4 border border-white/10 rounded-xl px-4 py-3 text-white text-sm
                               placeholder-white/20 focus:outline-none focus:border-violet-400/50 resize-none
                               leading-relaxed"
                  />
                </div>

                {/* File attachment */}
                <div>
                  <p className="text-[11px] text-white/40 mb-2 uppercase tracking-wider">
                    Attach photos of your written answer
                  </p>

                  {/* Existing attachments */}
                  {(wa.attachmentUrls || []).length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {(wa.attachmentUrls || []).map((url, ui) => (
                        <div key={ui} className="relative group">
                          <img src={url} alt={`attachment ${ui + 1}`}
                               className="w-20 h-20 object-cover rounded-lg border border-white/10 cursor-pointer"
                               onClick={() => setLightboxUrl(url)} />
                          <button
                            onClick={() => removeAttachment(writtenIndex, url)}
                            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 flex items-center
                                       justify-center opacity-0 group-hover:opacity-100 transition"
                          >
                            <X size={10} className="text-white" />
                          </button>
                          <button
                            onClick={() => setLightboxUrl(url)}
                            className="absolute bottom-1 right-1 w-5 h-5 rounded bg-black/50 flex items-center
                                       justify-center opacity-0 group-hover:opacity-100 transition"
                          >
                            <ZoomIn size={9} className="text-white" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleAttachmentUpload(writtenIndex, file);
                      e.target.value = '';
                    }}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFor === wq.id}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-white/15
                               hover:border-violet-400/40 hover:bg-violet-500/5 text-white/40 hover:text-white/60
                               text-sm transition disabled:opacity-50"
                  >
                    {uploadingFor === wq.id ? (
                      <><Loader2 size={14} className="animate-spin" /> Uploading…</>
                    ) : (
                      <><Paperclip size={14} /> Attach photo</>
                    )}
                  </button>
                </div>

                {/* Nav */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => setWrittenIndex(p => Math.max(0, p - 1))}
                    disabled={writtenIndex === 0}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10
                               disabled:opacity-30 text-sm transition"
                  >
                    <ChevronLeft size={15} /> Prev
                  </button>
                  {writtenIndex < writtenQuestions.length - 1 ? (
                    <button
                      onClick={() => setWrittenIndex(p => p + 1)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-500/20
                                 hover:bg-violet-500/30 text-violet-300 text-sm transition"
                    >
                      Next <ChevronRight size={15} />
                    </button>
                  ) : (
                    <button
                      onClick={() => { if (confirm('Submit exam?')) submitExam(); }}
                      className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm transition"
                    >
                      Submit Exam
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </Shell>
    );
  }

  // Fallback
  return (
    <Shell>
      <BackBtn />
      <p className="text-white/40 text-center mt-20">Unknown state. Please go back.</p>
    </Shell>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════════════

const BackBtn: React.FC = () => {
  const navigate = useNavigate();
  return (
    <button onClick={() => navigate(-1)}
      className="flex items-center gap-2 text-sm text-white/40 hover:text-white mb-8 transition group">
      <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
      Back to Library
    </button>
  );
};

const StatusCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  message: string;
  color: 'amber' | 'red' | 'orange' | 'indigo' | 'rose';
  badge?: string;
}> = ({ icon, title, message, color, badge }) => {
  const colors = {
    amber: 'border-amber-500/20 bg-amber-500/5',
    red: 'border-red-500/20 bg-red-500/5',
    orange: 'border-orange-500/20 bg-orange-500/5',
    indigo: 'border-indigo-500/20 bg-indigo-500/5',
    rose: 'border-rose-500/20 bg-rose-500/5',
  };
  return (
    <div className={`max-w-md mx-auto mt-16 rounded-2xl border p-8 text-center ${colors[color]}`}>
      <div className="flex justify-center mb-4">{icon}</div>
      <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
      <p className="text-white/50 text-sm mb-4 leading-relaxed">{message}</p>
      {badge && (
        <span className="inline-block px-3 py-1 rounded-full bg-white/8 text-white/50 text-xs font-semibold uppercase tracking-widest">
          {badge}
        </span>
      )}
    </div>
  );
};

// ─── Directions Page ──────────────────────────────────────────────────────────
const DirectionsPage: React.FC<{
  content: Content;
  examStatus: StudentExamStatus | null;
  onStart: (part: ExamPart) => void;
  startingPart: ExamPart | null;
}> = ({ content, examStatus, onStart, startingPart }) => {
  const navigate = useNavigate();
  const hasMCQ     = content.examType !== 'written';
  const hasWritten = content.examType !== 'mcq';
  const attemptCount = examStatus?.attemptCount ?? 0;
  const maxAttempts  = content.maxAttempts === 'unlimited' ? '∞' : content.maxAttempts;
  const attemptsLeft = content.maxAttempts === 'unlimited'
    ? null
    : Number(content.maxAttempts) - attemptCount;

  return (
    <div className="min-h-screen bg-[#0a0c14] text-white">
      <div className="fixed inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 30% at 50% -5%, rgba(244,63,94,0.07) 0%,transparent 65%)' }} />
      <div className="relative max-w-3xl mx-auto px-4 py-8">
        <button onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-white/40 hover:text-white mb-8 transition group">
          <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" /> Back to Library
        </button>

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/20 flex items-center justify-center">
            <ClipboardList size={26} className="text-rose-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{content.title}</h1>
            <p className="text-white/40 text-sm">{content.subject}</p>
          </div>
        </div>

        {/* Exam info grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'Total Marks', value: content.totalMarks ?? '—' },
            { label: 'Questions', value: content.questionsToShow ?? content.totalQuestions ?? '—' },
            { label: 'Type', value: content.examType?.toUpperCase() ?? '—' },
            { label: 'Attempts Left', value: attemptsLeft === null ? '∞' : String(attemptsLeft) },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl bg-white/4 border border-white/8 p-4 text-center">
              <p className="text-lg font-bold text-white">{value}</p>
              <p className="text-[11px] text-white/35 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Timers */}
        <div className="flex gap-3 mb-8 flex-wrap">
          {hasMCQ && content.mcqDuration && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
              <Clock size={14} className="text-rose-400" />
              <span className="text-sm text-rose-300">MCQ: {content.mcqDuration} min</span>
            </div>
          )}
          {hasWritten && content.writtenDuration && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500/10 border border-violet-500/20">
              <Clock size={14} className="text-violet-400" />
              <span className="text-sm text-violet-300">Written: {content.writtenDuration} min</span>
            </div>
          )}
          {content.examTimelineType === 'scheduled' && content.examEndDateTime && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle size={14} className="text-amber-400" />
              <span className="text-sm text-amber-300">
                Closes: {new Date(content.examEndDateTime).toLocaleString()}
              </span>
            </div>
          )}
        </div>

        {/* Directions */}
        {(content.mcqDirection || content.writtenDirection) && (
          <div className="mb-8 space-y-4">
            {hasMCQ && content.mcqDirection && (
              <div className="rounded-2xl bg-white/3 border border-white/8 p-5">
                <p className="text-[11px] uppercase tracking-widest text-rose-400 font-semibold mb-3">MCQ Instructions</p>
                <p className="text-white/70 text-sm leading-relaxed whitespace-pre-wrap">{content.mcqDirection}</p>
              </div>
            )}
            {hasWritten && content.writtenDirection && (
              <div className="rounded-2xl bg-white/3 border border-white/8 p-5">
                <p className="text-[11px] uppercase tracking-widest text-violet-400 font-semibold mb-3">Written Instructions</p>
                <p className="text-white/70 text-sm leading-relaxed whitespace-pre-wrap">{content.writtenDirection}</p>
              </div>
            )}
          </div>
        )}

        {/* Anti-cheat notice */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/8 border border-amber-500/15 mb-8">
          <Shield size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <p className="text-amber-200/80 text-sm leading-relaxed">
            This exam is monitored. Tab switching, right-clicking, copying, and DevTools access are logged.
            Auto-submission occurs when time runs out.
          </p>
        </div>

        {/* Start buttons */}
        <div className="flex gap-3 flex-wrap">
          {content.examType === 'mixed' ? (
            <>
              <button
                onClick={() => onStart('mcq')}
                disabled={startingPart !== null}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-rose-500 hover:bg-rose-600
                           text-white font-semibold transition disabled:opacity-50"
              >
                {startingPart === 'mcq' ? <Loader2 size={16} className="animate-spin" /> : <ClipboardList size={16} />}
                Start MCQ Exam
              </button>
              <button
                onClick={() => onStart('written')}
                disabled={startingPart !== null}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-500 hover:bg-violet-600
                           text-white font-semibold transition disabled:opacity-50"
              >
                {startingPart === 'written' ? <Loader2 size={16} className="animate-spin" /> : <PenLine size={16} />}
                Start Written Exam
              </button>
            </>
          ) : content.examType === 'written' ? (
            <button
              onClick={() => onStart('written')}
              disabled={startingPart !== null}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-500 hover:bg-violet-600
                         text-white font-semibold transition disabled:opacity-50"
            >
              {startingPart === 'written' ? <Loader2 size={16} className="animate-spin" /> : <PenLine size={16} />}
              Start Written Exam
            </button>
          ) : (
            <button
              onClick={() => onStart('mcq')}
              disabled={startingPart !== null}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-rose-500 hover:bg-rose-600
                         text-white font-semibold transition disabled:opacity-50"
            >
              {startingPart === 'mcq' ? <Loader2 size={16} className="animate-spin" /> : <ClipboardList size={16} />}
              Start MCQ Exam
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Results Page ─────────────────────────────────────────────────────────────
const ResultsPage: React.FC<{
  content: Content;
  session: ExamSession;
  mcqQuestions: MCQQuestion[];
  writtenQuestions: WrittenQuestion[];
  onBack: () => void;
}> = ({ content, session, mcqQuestions, writtenQuestions, onBack }) => {
  const [tab, setTab] = useState<'overview' | 'mcq' | 'written'>('overview');

  const percentage = session.maxMarks > 0
    ? ((session.totalMarks / session.maxMarks) * 100).toFixed(1)
    : '0';

  const gradeColor =
    Number(percentage) >= 80 ? 'text-emerald-400' :
    Number(percentage) >= 60 ? 'text-amber-400' :
    Number(percentage) >= 40 ? 'text-orange-400' : 'text-red-400';

  return (
    <div className="min-h-screen bg-[#0a0c14] text-white">
      <div className="fixed inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 30% at 50% -5%, rgba(16,185,129,0.06) 0%,transparent 65%)' }} />
      <div className="relative max-w-4xl mx-auto px-4 py-8">
        <button onClick={onBack}
          className="flex items-center gap-2 text-sm text-white/40 hover:text-white mb-8 transition group">
          <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" /> Back to Library
        </button>

        {/* Score hero */}
        <div className="rounded-2xl bg-white/3 border border-white/8 p-8 mb-6 text-center">
          <p className="text-white/50 text-sm mb-2">{content.title}</p>
          <div className={`text-6xl font-black mb-1 ${gradeColor}`}>{percentage}%</div>
          <p className="text-white/40 text-sm">
            {session.totalMarks} / {session.maxMarks} marks
          </p>
          {session.writtenEvaluationPending && (
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full
                            bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm">
              <AlertTriangle size={14} />
              Written evaluation pending — score may increase
            </div>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'MCQ Marks', value: session.mcqMarks, icon: <ClipboardList size={16} className="text-rose-400" /> },
            { label: 'Written Marks', value: session.writtenMarks, icon: <PenLine size={16} className="text-violet-400" /> },
            { label: 'Time Taken', value: fmt(session.timeTakenSeconds), icon: <Clock size={16} className="text-blue-400" /> },
            { label: 'Tab Switches', value: session.tabSwitchCount, icon: <AlertTriangle size={16} className="text-amber-400" /> },
          ].map(({ label, value, icon }) => (
            <div key={label} className="rounded-xl bg-white/4 border border-white/8 p-4 text-center">
              <div className="flex justify-center mb-1">{icon}</div>
              <p className="text-lg font-bold text-white">{value}</p>
              <p className="text-[11px] text-white/35">{label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-white/4 rounded-xl border border-white/8 mb-6">
          {(['overview', 'mcq', 'written'] as const)
            .filter(t => t === 'overview' || (t === 'mcq' && mcqQuestions.length > 0) || (t === 'written' && writtenQuestions.length > 0))
            .map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition capitalize
                            ${tab === t ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'}`}>
                {t === 'overview' ? 'Overview' : t === 'mcq' ? 'MCQ Review' : 'Written Review'}
              </button>
            ))}
        </div>

        {/* Tab: Overview */}
        {tab === 'overview' && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white/3 border border-white/8 p-6">
              <h3 className="font-semibold text-white mb-4">Performance Summary</h3>
              {mcqQuestions.length > 0 && (
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-white/50">MCQ Score</span>
                    <span className="text-white font-medium">{session.mcqMarks} / {mcqQuestions.reduce((s, q) => s + q.correctMarks, 0)}</span>
                  </div>
                  <div className="h-2 bg-white/8 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-rose-500 rounded-full transition-all"
                      style={{ width: `${mcqQuestions.reduce((s, q) => s + q.correctMarks, 0) > 0 ? (session.mcqMarks / mcqQuestions.reduce((s, q) => s + q.correctMarks, 0)) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              )}
              {writtenQuestions.length > 0 && (
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-white/50">Written Score</span>
                    <span className="text-white font-medium">
                      {session.writtenEvaluationPending ? 'Pending' : `${session.writtenMarks} / ${writtenQuestions.reduce((s, q) => s + q.marks, 0)}`}
                    </span>
                  </div>
                  {!session.writtenEvaluationPending && (
                    <div className="h-2 bg-white/8 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-violet-500 rounded-full transition-all"
                        style={{ width: `${writtenQuestions.reduce((s, q) => s + q.marks, 0) > 0 ? (session.writtenMarks / writtenQuestions.reduce((s, q) => s + q.marks, 0)) * 100 : 0}%` }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Suspicious activity */}
            {session.suspiciousActivity.length > 0 && (
              <div className="rounded-2xl bg-amber-500/8 border border-amber-500/15 p-5">
                <p className="text-amber-300 text-sm font-semibold mb-2">Flagged Activity</p>
                <ul className="space-y-1">
                  {session.suspiciousActivity.map((a, i) => (
                    <li key={i} className="text-amber-200/60 text-xs font-mono">{a}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Tab: MCQ Review */}
        {tab === 'mcq' && (
          <div className="space-y-4">
            {session.mcqAnswers.length === 0 ? (
              <p className="text-white/30 text-center py-12">No MCQ answers recorded.</p>
            ) : (
              session.mcqAnswers.map((ans, i) => {
                const q = mcqQuestions.find(q => q.id === ans.questionId);
                if (!q) return null;
                return (
                  <div key={i} className={`rounded-2xl border p-5 ${ans.isCorrect ? 'bg-emerald-500/5 border-emerald-500/15' : 'bg-red-500/5 border-red-500/15'}`}>
                    <div className="flex items-start gap-3">
                      {ans.isCorrect
                        ? <CheckCircle size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                        : <XCircle size={18} className="text-red-400 shrink-0 mt-0.5" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium mb-3">{q.question}</p>
                        {q.options.map((opt, oi) => {
                          const userSelected = ans.selectedOptions.includes(oi);
                          const isCorrectOpt = q.correctOptions.includes(oi);
                          return (
                            <div key={oi}
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-1 text-sm
                                          ${isCorrectOpt ? 'bg-emerald-500/15 text-emerald-300' :
                                            userSelected ? 'bg-red-500/15 text-red-300' : 'text-white/30'}`}>
                              <span className="w-4 h-4 flex-shrink-0">
                                {isCorrectOpt ? <Check size={14} /> : userSelected ? <X size={14} /> : null}
                              </span>
                              {opt}
                            </div>
                          );
                        })}
                        {q.solution && (
                          <div className="mt-3 pt-3 border-t border-white/8">
                            <p className="text-[11px] text-white/30 uppercase tracking-wider mb-1">Solution</p>
                            <p className="text-white/60 text-sm">{q.solution}</p>
                          </div>
                        )}
                        <div className="mt-2 text-right text-[11px] text-white/25">
                          Marks: {ans.marksAwarded >= 0 ? '+' : ''}{ans.marksAwarded}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Tab: Written Review */}
        {tab === 'written' && (
          <div className="space-y-4">
            {session.writtenEvaluationPending && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/8 border border-amber-500/15">
                <AlertTriangle size={15} className="text-amber-400" />
                <p className="text-amber-200/80 text-sm">Written answers are pending teacher evaluation. Marks will update once evaluated.</p>
              </div>
            )}
            {session.writtenAnswers.map((wa, i) => {
              const q = writtenQuestions.find(q => q.id === wa.questionId);
              if (!q) return null;
              return (
                <div key={i} className="rounded-2xl bg-white/3 border border-white/8 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] uppercase tracking-wider text-violet-400 font-semibold">
                      Question {i + 1} — {q.marks} marks
                    </span>
                    {wa.marksAwarded !== undefined && (
                      <span className="text-sm font-bold text-emerald-400">
                        +{wa.marksAwarded} awarded
                      </span>
                    )}
                  </div>
                  <p className="text-white text-sm mb-4">{q.question}</p>

                  {wa.answerText && (
                    <div className="bg-white/4 rounded-xl px-4 py-3 mb-3">
                      <p className="text-[10px] uppercase tracking-wider text-white/30 mb-1">Your answer</p>
                      <p className="text-white/70 text-sm whitespace-pre-wrap leading-relaxed">{wa.answerText}</p>
                    </div>
                  )}

                  {(wa.attachmentUrls || []).length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {wa.attachmentUrls!.map((url, ui) => (
                        <img key={ui} src={url} alt={`attachment ${ui + 1}`}
                             className="h-24 object-cover rounded-lg border border-white/10 cursor-pointer"
                             onClick={() => window.open(url, '_blank')} />
                      ))}
                    </div>
                  )}

                  {wa.evaluatorComment && (
                    <div className="bg-emerald-500/8 border border-emerald-500/15 rounded-xl px-4 py-3 mb-3">
                      <p className="text-[10px] uppercase tracking-wider text-emerald-400 mb-1">Evaluator comment</p>
                      <p className="text-white/70 text-sm">{wa.evaluatorComment}</p>
                    </div>
                  )}

                  {q.solution && (
                    <div className="bg-indigo-500/8 border border-indigo-500/15 rounded-xl px-4 py-3">
                      <p className="text-[10px] uppercase tracking-wider text-indigo-400 mb-1">Model Solution</p>
                      <p className="text-white/70 text-sm leading-relaxed">{q.solution}</p>
                      {q.solutionImage && (
                        <img src={q.solutionImage} alt="solution" className="mt-2 max-h-40 rounded-lg object-contain" />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExamViewer;
