// src/pages/ExamViewer.tsx
// Production-grade Exam Viewer — Complete rewrite
// Fixes: version questions blank bug, duration object vs decimal, stale closure on startExam,
//        marking rules, timer, result publish polling, attempt tracking, session resume
// BUG FIXES THIS VERSION:
//   Bug 1: Result publishing — completed check now runs BEFORE attempt-limit check
//   Bug 2: Separate "Start MCQ" / "Start Written" buttons; 10-min lock after MCQ submission
//   Bug 4: Re-attempt — "Try Again" button shown when attemptCount < maxAttempts
// NEW UPDATES:
//   Update 1: 10-min written start window persisted in Firestore — survives browser close
//   Update 2: Results page shows ALL past attempts + analytics/progress tab

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Clock, AlertTriangle, CheckCircle, XCircle,
  Shield, EyeOff, X, ChevronLeft, ChevronRight,
  ClipboardList, PenLine, Check, AlertCircle,
  Paperclip, ZoomIn, Lock, Loader2, RefreshCw, Layers,
  RotateCcw, TrendingUp, BarChart2, History,
} from 'lucide-react';
import { useDashboard } from '../contexts/DashboardContext';
import { contentService, Content, MCQQuestion, WrittenQuestion } from '../services/contentService';
import { examService, ExamSession, MCQAnswer, WrittenAnswer, StudentExamStatus } from '../services/examService';
import { uploadService } from '../services/uploadService';

// ─── Types ─────────────────────────────────────────────────────────────────────
type Phase =
  | 'loading'
  | 'version_select'
  | 'directions'
  | 'mcq'
  | 'mcq_submitted'   // MCQ done, waiting to start written
  | 'written'
  | 'results'
  | 'blocked'
  | 'scheduled_locked'
  | 'absent'
  | 'attempt_limit';

// Matches exactly what ContentUpload.tsx saves to Firestore:
// mcqDuration / writtenDuration = decimal minutes (number)
// mcqQuestionsToShow / writtenQuestionsToShow = number (already defaulted to total count)
interface ExamVersion {
  id: string;
  versionName: string;
  mcqQuestions: MCQQuestion[];
  writtenQuestions: WrittenQuestion[];
  mcqDuration: number;        // decimal minutes stored in Firestore
  writtenDuration: number;    // decimal minutes stored in Firestore
  mcqQuestionsToShow: number;
  writtenQuestionsToShow: number;
  mcqDirection?: string;
  writtenDirection?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
const fmtTime = (secs: number) => {
  if (secs <= 0) return '00:00';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const fmtDuration = (decimalMinutes: number) => {
  if (!decimalMinutes || decimalMinutes <= 0) return null;
  const totalSeconds = Math.round(decimalMinutes * 60);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
};

// decimal minutes → seconds
const durToSecs = (decimalMinutes: number): number =>
  Math.round((decimalMinutes || 0) * 60);

// ─── buildQuestionSet ──────────────────────────────────────────────────────────
const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const buildQuestionSet = <T extends { isLocked?: boolean; lockedPosition?: 'first' | 'last' | null }>(
  all: T[],
  questionsToShow: number
): T[] => {
  if (!all || all.length === 0) return [];
  const total = questionsToShow > 0 ? questionsToShow : all.length;

  const first    = all.filter(q => q.isLocked && q.lockedPosition === 'first');
  const last     = all.filter(q => q.isLocked && q.lockedPosition === 'last');
  const unlocked = all.filter(q => !q.isLocked || !q.lockedPosition);

  const lockedCount   = first.length + last.length;
  const unlockedSlots = Math.max(0, total - lockedCount);
  const picked        = shuffle(unlocked).slice(0, unlockedSlots);

  return [...first, ...picked, ...last];
};

// ─── Marks calculation ─────────────────────────────────────────────────────────
const calcMcqMarks = (
  q: MCQQuestion,
  selectedOptions: number[]
): { isCorrect: boolean; marksAwarded: number } => {
  if (!selectedOptions || selectedOptions.length === 0) {
    return { isCorrect: false, marksAwarded: q.skipMarks ?? 0 };
  }
  const allCorrect  = q.correctOptions.every(o => selectedOptions.includes(o));
  const noneWrong   = selectedOptions.every(o => q.correctOptions.includes(o));
  const isCorrect   = allCorrect && noneWrong && q.correctOptions.length > 0;
  return isCorrect
    ? { isCorrect: true,  marksAwarded: q.correctMarks }
    : { isCorrect: false, marksAwarded: -(q.wrongMarks ?? 0) };
};

// ─── Exam window helpers ───────────────────────────────────────────────────────
const checkResultVisible = (content: Content, session?: ExamSession | null): boolean => {
  if (!session) return false;
  if (session.resultVisibility === 'visible') return true;
  if (content.resultPublishType === 'immediate') return true;
  if (content.resultPublishType === 'scheduled' && content.resultPublishDateTime) {
    return Date.now() >= new Date(content.resultPublishDateTime).getTime();
  }
  return false;
};

// ─── Anti-cheat hook ───────────────────────────────────────────────────────────
function useAntiCheat(active: boolean, sessionId: string | null, onViolation: (t: string) => void) {
  const cbRef = useRef(onViolation);
  useEffect(() => { cbRef.current = onViolation; });

  useEffect(() => {
    if (!active || !sessionId) return;
    const noCtx   = (e: Event) => { e.preventDefault(); cbRef.current('right_click'); };
    const noCopy  = (e: Event) => { e.preventDefault(); cbRef.current('copy_attempt'); };
    const onVis   = () => { if (document.hidden) cbRef.current('tab_switch'); };
    const onBlur  = () => cbRef.current('focus_lost');
    const onKey   = (e: KeyboardEvent) => {
      if (e.key === 'F12' ||
          (e.ctrlKey && e.shiftKey && ['I','J','C'].includes(e.key)) ||
          (e.ctrlKey && ['u','U','p','P','s','S'].includes(e.key))) {
        e.preventDefault(); cbRef.current('devtools_attempt');
      }
    };
    const noSel = (e: Event) => e.preventDefault();

    document.addEventListener('contextmenu', noCtx);
    document.addEventListener('copy', noCopy);
    document.addEventListener('cut', noCopy);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onBlur);
    document.addEventListener('keydown', onKey);
    document.addEventListener('selectstart', noSel);
    return () => {
      document.removeEventListener('contextmenu', noCtx);
      document.removeEventListener('copy', noCopy);
      document.removeEventListener('cut', noCopy);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('selectstart', noSel);
    };
  }, [active, sessionId]);
}

// ─── Countdown timer hook ──────────────────────────────────────────────────────
function useCountdown(durationSecs: number, active: boolean, onExpire: () => void): number {
  const [remaining, setRemaining] = useState(durationSecs);
  const expiredRef  = useRef(false);
  const onExpireRef = useRef(onExpire);
  useEffect(() => { onExpireRef.current = onExpire; });

  useEffect(() => {
    setRemaining(durationSecs);
    expiredRef.current = false;
  }, [durationSecs]);

  useEffect(() => {
    if (!active || durationSecs <= 0) return;
    const id = setInterval(() => {
      setRemaining(prev => {
        const next = prev - 1;
        if (next <= 0 && !expiredRef.current) {
          expiredRef.current = true;
          clearInterval(id);
          setTimeout(() => onExpireRef.current(), 0);
          return 0;
        }
        return Math.max(0, next);
      });
    }, 1000);
    return () => clearInterval(id);
  }, [active, durationSecs]);

  return remaining;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const ExamViewer: React.FC = () => {
  const { courseId, contentId } = useParams<{ courseId?: string; contentId: string }>();
  const navigate = useNavigate();
  const { user }  = useDashboard();

  // ── Core ────────────────────────────────────────────────────────────────────
  const [phase, setPhase]             = useState<Phase>('loading');
  const [content, setContent]         = useState<Content | null>(null);
  const [examStatus, setExamStatus]   = useState<StudentExamStatus | null>(null);
  const [session, setSession]         = useState<ExamSession | null>(null);
  const [sessionId, setSessionId]     = useState<string | null>(null);
  const [error, setError]             = useState('');

  // ── Versions ────────────────────────────────────────────────────────────────
  const [versions, setVersions]               = useState<ExamVersion[]>([]);
  const activeVersionRef                       = useRef<ExamVersion | null>(null);
  const [activeVersionForUI, setActiveVersionForUI] = useState<ExamVersion | null>(null);

  // ── Questions & answers ─────────────────────────────────────────────────────
  const [mcqQuestions, setMcqQuestions]         = useState<MCQQuestion[]>([]);
  const [writtenQuestions, setWrittenQuestions] = useState<WrittenQuestion[]>([]);
  const [mcqAnswers, setMcqAnswers]             = useState<MCQAnswer[]>([]);
  const [writtenAnswers, setWrittenAnswers]     = useState<WrittenAnswer[]>([]);

  // ── Navigation ──────────────────────────────────────────────────────────────
  const [mcqIndex, setMcqIndex]           = useState(0);
  const [writtenIndex, setWrittenIndex]   = useState(0);
  const [activePart, setActivePart]       = useState<'mcq' | 'written'>('mcq');

  // ── Timer state ─────────────────────────────────────────────────────────────
  const [mcqDurSecs, setMcqDurSecs]           = useState(0);
  const [writtenDurSecs, setWrittenDurSecs]   = useState(0);
  const [mcqTimerOn, setMcqTimerOn]           = useState(false);
  const [writtenTimerOn, setWrittenTimerOn]   = useState(false);

  // UPDATE 1: mcqSubmittedAt is now restored from Firestore (via examStatus.pendingMcqSubmittedAt)
  // This ensures the 10-min window persists even if browser was closed.
  const [mcqSubmittedAt, setMcqSubmittedAt] = useState<Date | null>(null);
  const [writtenLocked, setWrittenLocked]   = useState(false);
  // Local countdown display for the mcq_submitted screen (re-computed every second)
  const [writtenWindowSecs, setWrittenWindowSecs] = useState(600);
  const writtenLockCheckRef = useRef<ReturnType<typeof setInterval>>();
  const writtenWindowTickRef = useRef<ReturnType<typeof setInterval>>();

  // ── Misc ────────────────────────────────────────────────────────────────────
  const [startTime, setStartTime]       = useState(Date.now());
  const [submitting, setSubmitting]     = useState(false);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl]   = useState<string | null>(null);
  const [violationMsg, setViolationMsg] = useState('');
  const fileInputRef                     = useRef<HTMLInputElement>(null);
  const violationTimerRef                = useRef<ReturnType<typeof setTimeout>>();
  const publishPollRef                   = useRef<ReturnType<typeof setInterval>>();
  const autoSaveRef                      = useRef<ReturnType<typeof setInterval>>();

  // Refs for submit callback (avoid stale closures)
  const mcqAnswersRef     = useRef<MCQAnswer[]>([]);
  const writtenAnswersRef = useRef<WrittenAnswer[]>([]);
  const startTimeRef      = useRef(Date.now());
  const submittingRef     = useRef(false);
  const sessionIdRef      = useRef<string | null>(null);
  const contentRef        = useRef<Content | null>(null);
  const versionsRef       = useRef<ExamVersion[]>([]);

  useEffect(() => { mcqAnswersRef.current     = mcqAnswers; },     [mcqAnswers]);
  useEffect(() => { writtenAnswersRef.current  = writtenAnswers; }, [writtenAnswers]);
  useEffect(() => { startTimeRef.current       = startTime; },     [startTime]);
  useEffect(() => { submittingRef.current      = submitting; },     [submitting]);
  useEffect(() => { sessionIdRef.current       = sessionId; },     [sessionId]);
  useEffect(() => { contentRef.current         = content; },       [content]);
  useEffect(() => { versionsRef.current        = versions; },      [versions]);

  // ── Anti-cheat ───────────────────────────────────────────────────────────────
  const examActive = phase === 'mcq' || phase === 'written';
  const handleViolation = useCallback((type: string) => {
    const sid = sessionIdRef.current;
    if (sid) examService.logAntiCheatEvent(sid, type).catch(() => {});
    const msg = type === 'tab_switch'      ? '⚠️ Tab switch detected!' :
                type === 'focus_lost'      ? '⚠️ Window focus lost!' :
                type === 'right_click'     ? '⚠️ Right-click disabled.' :
                type === 'copy_attempt'    ? '⚠️ Copy/paste disabled.' :
                                             '⚠️ Suspicious activity!';
    setViolationMsg(msg);
    clearTimeout(violationTimerRef.current);
    violationTimerRef.current = setTimeout(() => setViolationMsg(''), 3000);
  }, []);
  useAntiCheat(examActive, sessionId, handleViolation);

  // ── Timers ───────────────────────────────────────────────────────────────────
  const mcqExpired = useCallback(() => {
    if (writtenQuestions.length > 0) {
      setMcqTimerOn(false);
      const sid = sessionIdRef.current;
      if (sid) {
        const a = mcqAnswersRef.current;
        const marks = a.reduce((s, x) => s + (x.marksAwarded ?? 0), 0);
        examService.saveMCQAnswers(sid, a, marks).catch(() => {});
        examService.submitMCQPart(sid).catch(() => {});
      }
      const now = new Date();
      setMcqSubmittedAt(now);
      setPhase('mcq_submitted');
    } else {
      doSubmit(true);
    }
  }, [writtenQuestions.length]);

  const writtenExpired = useCallback(() => doSubmit(true), []);

  const mcqRemaining     = useCountdown(mcqDurSecs, mcqTimerOn, mcqExpired);
  const writtenRemaining = useCountdown(writtenDurSecs, writtenTimerOn, writtenExpired);
  const activeRemaining  = activePart === 'mcq' ? mcqRemaining : writtenRemaining;
  const timerWarning     = activeRemaining > 0 && activeRemaining < 120;

  // UPDATE 1: 10-min window — runs every second on mcq_submitted phase
  // Also locks when window expires.
  useEffect(() => {
    if (phase !== 'mcq_submitted' || !mcqSubmittedAt) return;

    const MCQ_WRITTEN_WINDOW_MS = 10 * 60 * 1000;

    const updateCountdown = () => {
      const elapsed = Date.now() - mcqSubmittedAt.getTime();
      const remaining = Math.max(0, Math.ceil((MCQ_WRITTEN_WINDOW_MS - elapsed) / 1000));
      setWrittenWindowSecs(remaining);
      if (remaining <= 0) {
        setWrittenLocked(true);
        clearInterval(writtenLockCheckRef.current);
        clearInterval(writtenWindowTickRef.current);
      }
    };

    updateCountdown();
    writtenLockCheckRef.current = setInterval(updateCountdown, 1000);
    writtenWindowTickRef.current = writtenLockCheckRef.current;

    return () => {
      clearInterval(writtenLockCheckRef.current);
    };
  }, [phase, mcqSubmittedAt]);

  // ── Auto-save ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!examActive || !sessionId) return;
    autoSaveRef.current = setInterval(() => {
      const sid = sessionIdRef.current;
      if (!sid) return;
      const a  = mcqAnswersRef.current;
      const wa = writtenAnswersRef.current;
      const marks = a.reduce((s, x) => s + (x.marksAwarded ?? 0), 0);
      examService.saveMCQAnswers(sid, a, marks).catch(() => {});
      if (wa.length > 0) examService.saveWrittenAnswers(sid, wa).catch(() => {});
    }, 30_000);
    return () => clearInterval(autoSaveRef.current);
  }, [examActive, sessionId]);

  // ── Cleanup ──────────────────────────────────────────────────────────────────
  useEffect(() => () => {
    clearInterval(autoSaveRef.current);
    clearInterval(publishPollRef.current);
    clearInterval(writtenLockCheckRef.current);
    clearTimeout(violationTimerRef.current);
  }, []);

  // ── Load exam ────────────────────────────────────────────────────────────────
  const loadExam = useCallback(async () => {
    if (!contentId || !user) return;
    setPhase('loading');
    setError('');
    try {
      const [c, status] = await Promise.all([
        contentService.getContent(contentId),
        examService.getStudentExamStatus(contentId, user.uid, courseId),
      ]);

      if (!c) { setError('Exam not found.'); return; }
      setContent(c);
      contentRef.current = c;
      setExamStatus(status);

      // Load versions
      const versionDocs = await contentService.getExamVersions(contentId);
      const vs: ExamVersion[] = versionDocs.map((v: any) => ({
        id: v.id,
        versionName: v.versionName || 'Version 1',
        mcqQuestions: v.mcqQuestions || [],
        writtenQuestions: v.writtenQuestions || [],
        mcqDuration: v.mcqDuration || 0,
        writtenDuration: v.writtenDuration || 0,
        mcqQuestionsToShow: v.mcqQuestionsToShow || (v.mcqQuestions || []).length,
        writtenQuestionsToShow: v.writtenQuestionsToShow || (v.writtenQuestions || []).length,
        mcqDirection: v.mcqDirection,
        writtenDirection: v.writtenDirection,
      }));
      setVersions(vs);
      versionsRef.current = vs;

      // ── Scheduling check ────────────────────────────────────────────────────
      if (c.examStartDateTime && Date.now() < new Date(c.examStartDateTime).getTime()) {
        setPhase('scheduled_locked');
        return;
      }
      if (c.examEndDateTime && Date.now() > new Date(c.examEndDateTime).getTime()) {
        if (!status || status.status === 'not_started') {
          setPhase('absent');
          return;
        }
      }

      // ── Resume check: incomplete session ────────────────────────────────────
      if (status?.lastAttemptId) {
        const existingSession = await examService.getExamSession(status.lastAttemptId);
        if (existingSession) {
          // Resume mcq_submitted phase — restore timer from Firestore
          if (existingSession.status === 'mcq_submitted' && existingSession.mcqSubmittedAt) {
            const submittedAt = existingSession.mcqSubmittedAt;
            const elapsed = Date.now() - submittedAt.getTime();
            const MCQ_WINDOW_MS = 10 * 60 * 1000;

            if (elapsed < MCQ_WINDOW_MS) {
              // Window still open — restore state and go to mcq_submitted
              setSessionId(existingSession.id);
              sessionIdRef.current = existingSession.id;
              setMcqSubmittedAt(submittedAt);
              setWrittenLocked(false);

              if (vs.length > 0) {
                const ver = vs[0];
                setActiveVersion(ver);
                const mcqSet = restoreMcqQuestions(existingSession, ver);
                const writtenSet = restoreWrittenQuestions(existingSession, ver);
                setMcqQuestions(mcqSet);
                setWrittenQuestions(writtenSet);
                setMcqAnswers(existingSession.mcqAnswers);
                setWrittenAnswers(writtenSet.map(q => ({
                  questionId: q.id, answerText: '', attachmentUrls: [],
                })));
              }
              setPhase('mcq_submitted');
              return;
            } else {
              // Window expired while browser was closed — lock written
              setSessionId(existingSession.id);
              sessionIdRef.current = existingSession.id;
              setMcqSubmittedAt(submittedAt);
              setWrittenLocked(true);

              if (vs.length > 0) {
                const ver = vs[0];
                setActiveVersion(ver);
                const mcqSet = restoreMcqQuestions(existingSession, ver);
                const writtenSet = restoreWrittenQuestions(existingSession, ver);
                setMcqQuestions(mcqSet);
                setWrittenQuestions(writtenSet);
                setMcqAnswers(existingSession.mcqAnswers);
                setWrittenAnswers(writtenSet.map(q => ({
                  questionId: q.id, answerText: '', attachmentUrls: [],
                })));
              }
              setPhase('mcq_submitted');
              return;
            }
          }

          // Resume in-progress session
          if (existingSession.status === 'in_progress') {
            setSessionId(existingSession.id);
            sessionIdRef.current = existingSession.id;

            if (vs.length > 0) {
              const ver = vs[0];
              setActiveVersion(ver);
              const mcqSet = restoreMcqQuestions(existingSession, ver);
              const writtenSet = restoreWrittenQuestions(existingSession, ver);
              const mcqSecs = durToSecs(ver.mcqDuration);
              const writtenSecs = durToSecs(ver.writtenDuration);

              setMcqQuestions(mcqSet);
              setWrittenQuestions(writtenSet);
              setMcqAnswers(existingSession.mcqAnswers.length > 0
                ? existingSession.mcqAnswers
                : mcqSet.map(q => ({ questionId: q.id, selectedOptions: [], isCorrect: false, marksAwarded: q.skipMarks ?? 0 })));
              setWrittenAnswers(existingSession.writtenAnswers.length > 0
                ? existingSession.writtenAnswers
                : writtenSet.map(q => ({ questionId: q.id, answerText: '', attachmentUrls: [] })));

              if (existingSession.writtenStartedAt) {
                setActivePart('written');
                setWrittenDurSecs(writtenSecs);
                setWrittenTimerOn(writtenSecs > 0);
                setPhase('written');
              } else {
                setActivePart('mcq');
                setMcqDurSecs(mcqSecs);
                setMcqTimerOn(mcqSecs > 0);
                setPhase('mcq');
              }
              return;
            }
          }

          // Completed — check result visibility
          if (['submitted', 'auto_submitted', 'timed_out'].includes(existingSession.status)) {
            const maxAtt      = c.maxAttempts;
            const attemptCount = status?.attemptCount ?? 0;
            const canReattempt = maxAtt === 'unlimited' || (maxAtt && attemptCount < Number(maxAtt));

            if (vs.length > 0) {
              const ver = vs[0];
              setActiveVersion(ver);
              restoreQuestionsFromSession(existingSession, vs);
            }
            setSession(existingSession);

            if (checkResultVisible(c, existingSession)) {
              setPhase('results');
            } else {
              startPublishPoll(c, existingSession);
              setPhase('blocked');
            }
            return;
          }
        }
      }

      // ── Attempt limit check ──────────────────────────────────────────────────
      if (status) {
        const maxAtt = c.maxAttempts;
        const attemptCount = status.attemptCount ?? 0;
        if (maxAtt !== 'unlimited' && maxAtt && attemptCount >= Number(maxAtt)) {
          setPhase('attempt_limit');
          return;
        }
      }

      // ── Absent check ────────────────────────────────────────────────────────
      if (status?.status === 'absent') {
        setPhase('absent');
        return;
      }

      // ── Go to version select or directions ───────────────────────────────────
      if (vs.length > 1) {
        setPhase('version_select');
      } else if (vs.length === 1) {
        setActiveVersion(vs[0]);
        setPhase('directions');
      } else {
        setError('No exam versions found. Please contact your teacher.');
      }
    } catch (e: any) {
      console.error('loadExam error:', e);
      setError(e.message || 'Failed to load exam.');
    }
  }, [contentId, user, courseId]);

  useEffect(() => { loadExam(); }, [loadExam]);

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const setActiveVersion = (ver: ExamVersion) => {
    activeVersionRef.current = ver;
    setActiveVersionForUI(ver);
  };

  const restoreMcqQuestions = (s: ExamSession, ver: ExamVersion): MCQQuestion[] => {
    if (!s.mcqQuestionIds?.length) return buildQuestionSet(ver.mcqQuestions, ver.mcqQuestionsToShow);
    return s.mcqQuestionIds.map(id => ver.mcqQuestions.find(q => q.id === id)!).filter(Boolean);
  };

  const restoreWrittenQuestions = (s: ExamSession, ver: ExamVersion): WrittenQuestion[] => {
    if (!s.writtenQuestionIds?.length) return buildQuestionSet(ver.writtenQuestions, ver.writtenQuestionsToShow);
    return s.writtenQuestionIds.map(id => ver.writtenQuestions.find(q => q.id === id)!).filter(Boolean);
  };

  const restoreQuestionsFromSession = (s: ExamSession, vs: ExamVersion[]) => {
    const ver = vs.find(v => v.mcqQuestions.some(q => s.mcqQuestionIds?.includes(q.id))
      || v.writtenQuestions.some(q => s.writtenQuestionIds?.includes(q.id))) || vs[0];
    if (!ver) return;
    setMcqQuestions(restoreMcqQuestions(s, ver));
    setWrittenQuestions(restoreWrittenQuestions(s, ver));
  };

  // ── Publish poll ──────────────────────────────────────────────────────────────
  const startPublishPoll = (c: Content, s: ExamSession | null) => {
    clearInterval(publishPollRef.current);
    publishPollRef.current = setInterval(async () => {
      const updated = await examService.getExamSession(s?.id || '');
      if (updated && checkResultVisible(c, updated)) {
        clearInterval(publishPollRef.current);
        setSession(updated);
        restoreQuestionsFromSession(updated, versionsRef.current);
        setPhase('results');
      }
    }, 15_000);
  };

  // ── Start exam ────────────────────────────────────────────────────────────────
  const startExam = async () => {
    if (submitting) return;
    if (!user || !content || !contentId) return;

    const ver = activeVersionRef.current || versionsRef.current[0];
    if (!ver) { setError('No exam version selected.'); return; }

    setSubmitting(true);
    setError('');

    try {
      const mcqSet     = buildQuestionSet(ver.mcqQuestions,     ver.mcqQuestionsToShow);
      const writtenSet = buildQuestionSet(ver.writtenQuestions, ver.writtenQuestionsToShow);
      const mcqMax     = mcqSet.reduce((s, q) => s + (q.correctMarks || 0), 0);
      const writtenMax = writtenSet.reduce((s, q) => s + (q.marks || 0), 0);
      const mcqSecs    = durToSecs(ver.mcqDuration);
      const writtenSecs = durToSecs(ver.writtenDuration);

      const sid = await examService.startExamSession({
        contentId,
        courseId,
        studentId: user.uid,
        studentName: user.displayName || user.email || 'Student',
        studentEmail: user.email || undefined,
        mcqQuestionIds: mcqSet.map(q => q.id),
        writtenQuestionIds: writtenSet.map(q => q.id),
        maxMarks: mcqMax + writtenMax,
        resultVisibility: 'hidden',
      });

      setSessionId(sid);
      sessionIdRef.current = sid;
      setMcqQuestions(mcqSet);
      setWrittenQuestions(writtenSet);
      setMcqAnswers(mcqSet.map(q => ({
        questionId: q.id, selectedOptions: [], isCorrect: false, marksAwarded: q.skipMarks ?? 0,
      })));
      setWrittenAnswers(writtenSet.map(q => ({
        questionId: q.id, answerText: '', attachmentUrls: [],
      })));
      setMcqDurSecs(mcqSecs);
      setWrittenDurSecs(writtenSecs);
      const now = Date.now();
      setStartTime(now);
      startTimeRef.current = now;
      setMcqIndex(0);
      setWrittenIndex(0);
      setMcqSubmittedAt(null);
      setWrittenLocked(false);

      if (mcqSet.length > 0) {
        setActivePart('mcq');
        setMcqTimerOn(mcqSecs > 0);
        setPhase('mcq');
      } else if (writtenSet.length > 0) {
        setActivePart('written');
        setWrittenTimerOn(writtenSecs > 0);
        setPhase('written');
      } else {
        setError('No questions found in this version. Please contact your teacher.');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to start exam. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── SELECT OPTION ────────────────────────────────────────────────────────────
  const selectOption = (qi: number, oi: number) => {
    const q = mcqQuestions[qi];
    if (!q) return;
    const cur = mcqAnswers[qi] || { questionId: q.id, selectedOptions: [], isCorrect: false, marksAwarded: 0 };
    const isSingle  = q.correctOptions.length <= 1;
    const newSel    = isSingle
      ? (cur.selectedOptions[0] === oi ? [] : [oi])
      : cur.selectedOptions.includes(oi)
        ? cur.selectedOptions.filter(o => o !== oi)
        : [...cur.selectedOptions, oi];
    const { isCorrect, marksAwarded } = calcMcqMarks(q, newSel);
    const updated = [...mcqAnswers];
    updated[qi] = { questionId: q.id, selectedOptions: newSel, isCorrect, marksAwarded };
    setMcqAnswers(updated);
    mcqAnswersRef.current = updated;
  };

  // ─── WRITTEN ANSWER ───────────────────────────────────────────────────────────
  const changeWritten = (qi: number, text: string) => {
    const updated = [...writtenAnswers];
    updated[qi] = { ...updated[qi], answerText: text };
    setWrittenAnswers(updated);
    writtenAnswersRef.current = updated;
  };

  // ─── ATTACHMENT ───────────────────────────────────────────────────────────────
  const uploadAttachment = async (qi: number, file: File) => {
    const qId = writtenQuestions[qi]?.id;
    if (!qId || !sessionId) return;
    setUploadingFor(qId);
    try {
      const result = await uploadService.uploadToSupabase(file, 'exam-answers');
      await examService.addWrittenAttachment(sessionId, qId, result.url);
      const updated = [...writtenAnswers];
      updated[qi] = { ...updated[qi], attachmentUrls: [...(updated[qi].attachmentUrls || []), result.url] };
      setWrittenAnswers(updated);
      writtenAnswersRef.current = updated;
    } catch (e: any) {
      setError('Upload failed: ' + e.message);
    } finally {
      setUploadingFor(null);
    }
  };

  const removeAttachment = async (qi: number, url: string) => {
    const qId = writtenQuestions[qi]?.id;
    if (!qId || !sessionId) return;
    await examService.removeWrittenAttachment(sessionId, qId, url);
    const updated = [...writtenAnswers];
    updated[qi] = { ...updated[qi], attachmentUrls: (updated[qi].attachmentUrls || []).filter(u => u !== url) };
    setWrittenAnswers(updated);
    writtenAnswersRef.current = updated;
  };

  // ─── SUBMIT MCQ PART ─────────────────────────────────────────────────────────
  const submitMCQPart = async () => {
    if (submitting) return;
    if (!confirm('Submit MCQ section? You cannot change MCQ answers after this.')) return;

    const sid = sessionIdRef.current;
    if (!sid) return;

    setSubmitting(true);
    setMcqTimerOn(false);
    try {
      const a = mcqAnswersRef.current;
      const marks = a.reduce((s, x) => s + (x.marksAwarded ?? 0), 0);
      await examService.saveMCQAnswers(sid, a, marks);
      // UPDATE 1: submitMCQPart now persists mcqSubmittedAt to Firestore
      await examService.submitMCQPart(sid);

      const now = new Date();
      setMcqSubmittedAt(now);
      setWrittenLocked(false);
      setPhase('mcq_submitted');
    } catch (e: any) {
      setError(e.message || 'Failed to submit MCQ. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── START WRITTEN PART ───────────────────────────────────────────────────────
  const startWrittenPart = async () => {
    const sid = sessionIdRef.current;
    const ver = activeVersionRef.current || versionsRef.current[0];
    if (!sid || !ver) return;

    setSubmitting(true);
    try {
      // UPDATE 1: startWrittenPart clears pendingMcqSubmittedAt in Firestore
      await examService.startWrittenPart(sid);
      const writtenSecs = durToSecs(ver.writtenDuration);
      setWrittenDurSecs(writtenSecs);
      setActivePart('written');
      setWrittenTimerOn(writtenSecs > 0);
      setWrittenIndex(0);
      setPhase('written');
    } catch (e: any) {
      setError(e.message || 'Failed to start written section.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── SUBMIT FULL EXAM ────────────────────────────────────────────────────────
  const doSubmit = async (auto = false) => {
    if (submittingRef.current) return;
    const sid = sessionIdRef.current;
    const c   = contentRef.current;
    if (!sid || !c || !user) return;
    submittingRef.current = true;
    setSubmitting(true);
    setMcqTimerOn(false);
    setWrittenTimerOn(false);
    clearInterval(autoSaveRef.current);

    try {
      const a       = mcqAnswersRef.current;
      const wa      = writtenAnswersRef.current;
      const marks   = a.reduce((s, x) => s + (x.marksAwarded ?? 0), 0);
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);

      if (wa.length > 0) await examService.saveWrittenAnswers(sid, wa);
      await examService.submitExamSession(sid, a, wa, marks, elapsed, auto);

      const updated = await examService.getExamSession(sid);
      setSession(updated);
      if (updated) restoreQuestionsFromSession(updated, versionsRef.current);

      const newStatus = await examService.getStudentExamStatus(contentId!, user.uid, courseId);
      setExamStatus(newStatus);

      if (checkResultVisible(c, updated)) { setPhase('results'); }
      else { startPublishPoll(c, updated); setPhase('blocked'); }
    } catch (e: any) {
      setError(e.message || 'Submit failed. Please try again.');
      setSubmitting(false);
      submittingRef.current = false;
    }
  };

  const handleSubmit = () => {
    if (submitting) return;
    if (!confirm('Submit your exam now? You cannot change answers after submission.')) return;
    doSubmit(false);
  };

  // ─── RE-ATTEMPT ───────────────────────────────────────────────────────────────
  const handleReattempt = async () => {
    if (!content || !user) return;
    setError('');
    setSession(null);
    setSessionId(null);
    sessionIdRef.current = null;
    setMcqQuestions([]);
    setWrittenQuestions([]);
    setMcqAnswers([]);
    setWrittenAnswers([]);
    setMcqSubmittedAt(null);
    setWrittenLocked(false);
    submittingRef.current = false;

    const status = await examService.getStudentExamStatus(contentId!, user.uid, courseId);
    setExamStatus(status);

    if (versions.length > 1) {
      setPhase('version_select');
    } else {
      setActiveVersion(versions[0]);
      setPhase('directions');
    }
  };

  // ── Status helpers ────────────────────────────────────────────────────────────
  const mcqStatus = (i: number) => {
    const a = mcqAnswers[i];
    if (!a || !a.selectedOptions) return 'not_visited';
    return a.selectedOptions.length > 0 ? 'answered' : 'skipped';
  };
  const writtenStatus = (i: number) => {
    const a = writtenAnswers[i];
    if (!a) return 'not_visited';
    return (a.answerText?.trim() || (a.attachmentUrls?.length ?? 0) > 0) ? 'answered' : 'not_visited';
  };
  const mcqAnsweredCount     = mcqAnswers.filter(a => a.selectedOptions?.length > 0).length;
  const writtenAnsweredCount = writtenAnswers.filter(a =>
    a.answerText?.trim() || (a.attachmentUrls?.length ?? 0) > 0).length;

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════════

  const Shell: React.FC<{ children: React.ReactNode; noPad?: boolean }> = ({ children, noPad }) => (
    <div className="min-h-screen bg-[#080a12] text-white select-none">
      <div className="fixed inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 70% 35% at 50% -10%,rgba(244,63,94,.08) 0%,transparent 65%)' }} />
      {noPad ? children : <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-8">{children}</div>}
    </div>
  );

  const BackBtn: React.FC<{ onClick?: () => void }> = ({ onClick }) => (
    <button onClick={onClick || (() => navigate(-1))}
      className="flex items-center gap-2 text-sm text-white/40 hover:text-white mb-8 transition group">
      <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" /> Back
    </button>
  );

  const ViolationToast = () => violationMsg ? (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2
                    px-4 py-2.5 bg-red-500/95 backdrop-blur rounded-xl text-white text-sm
                    font-medium shadow-xl pointer-events-none">
      <Shield size={14} /> {violationMsg}
    </div>
  ) : null;

  const Lightbox = () => lightboxUrl ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur"
      onClick={() => setLightboxUrl(null)}>
      <img src={lightboxUrl} alt="enlarged"
        className="max-w-4xl max-h-[90vh] object-contain rounded-2xl" />
      <button className="absolute top-4 right-4 text-white/60 hover:text-white"><X size={24} /></button>
    </div>
  ) : null;

  // ── Loading ────────────────────────────────────────────────────────────────────
  if (phase === 'loading') return (
    <Shell>
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        {error ? (
          <>
            <AlertCircle size={32} className="text-rose-400" />
            <p className="text-rose-300 text-center max-w-sm">{error}</p>
            <button onClick={loadExam}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/8 hover:bg-white/12 text-sm transition">
              <RefreshCw size={14} /> Retry
            </button>
            <button onClick={() => navigate(-1)} className="text-sm text-white/30 hover:text-white">← Go back</button>
          </>
        ) : (
          <>
            <Loader2 size={32} className="animate-spin text-rose-400" />
            <p className="text-white/40 text-sm">Loading exam…</p>
          </>
        )}
      </div>
    </Shell>
  );

  // ── Scheduled Locked ───────────────────────────────────────────────────────────
  if (phase === 'scheduled_locked') {
    const start = content?.examStartDateTime ? new Date(content.examStartDateTime) : null;
    return (
      <Shell><BackBtn />
        <div className="max-w-md mx-auto mt-12 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-8 text-center">
          <Lock size={40} className="text-amber-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Exam Not Started Yet</h2>
          <p className="text-white/50 text-sm">{start ? `Opens on ${start.toLocaleString()}` : 'Check back later.'}</p>
        </div>
      </Shell>
    );
  }

  // ── Absent ─────────────────────────────────────────────────────────────────────
  if (phase === 'absent') return (
    <Shell><BackBtn />
      <div className="max-w-md mx-auto mt-12 rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center">
        <XCircle size={40} className="text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">Marked Absent</h2>
        <p className="text-white/50 text-sm">The exam window closed before you attempted it.</p>
      </div>
    </Shell>
  );

  // ── Attempt Limit ──────────────────────────────────────────────────────────────
  if (phase === 'attempt_limit') return (
    <Shell><BackBtn />
      <div className="max-w-md mx-auto mt-12 rounded-2xl border border-orange-500/20 bg-orange-500/5 p-8 text-center">
        <AlertCircle size={40} className="text-orange-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">Attempt Limit Reached</h2>
        <p className="text-white/50 text-sm">You've used all allowed attempts for this exam.</p>
        {examStatus?.bestPercentage !== undefined && (
          <p className="text-white/35 text-sm mt-2">Best score: {examStatus.bestPercentage.toFixed(1)}%</p>
        )}
      </div>
    </Shell>
  );

  // ── Blocked ─────────────────────────────────────────────────────────────────────
  if (phase === 'blocked') {
    const publishAt = content?.resultPublishDateTime
      ? new Date(content.resultPublishDateTime).toLocaleString() : null;
    return (
      <Shell><BackBtn />
        <div className="max-w-md mx-auto mt-12 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-8 text-center">
          <EyeOff size={40} className="text-indigo-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Exam Submitted!</h2>
          <p className="text-white/50 text-sm mb-4">
            {publishAt ? `Results will be published on ${publishAt}.`
              : 'Results will be published when your teacher releases them.'}
          </p>
          <div className="flex items-center justify-center gap-1.5 text-xs text-white/25 mt-2">
            <RefreshCw size={11} className="animate-spin" /> Checking automatically…
          </div>
        </div>
      </Shell>
    );
  }

  // ── Version Select ─────────────────────────────────────────────────────────────
  if (phase === 'version_select') return (
    <Shell>
      <BackBtn />
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center shrink-0">
            <Layers size={26} className="text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{content?.title}</h1>
            <p className="text-white/40 text-sm mt-0.5">Select your exam version</p>
          </div>
        </div>
        <div className="grid gap-3">
          {versions.map(v => (
            <button key={v.id} onClick={() => { setActiveVersion(v); setPhase('directions'); }}
              className="w-full text-left p-5 rounded-2xl border border-white/8 bg-white/3
                         hover:border-violet-500/40 hover:bg-violet-500/5 transition-all group">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white group-hover:text-violet-300 transition">{v.versionName}</h3>
                <ChevronRight size={16} className="text-white/30 group-hover:text-violet-400 transition" />
              </div>
              <div className="flex flex-wrap gap-4 mt-1.5 text-xs text-white/40">
                {v.mcqQuestions.length > 0 && <span>MCQ: {v.mcqQuestionsToShow} questions</span>}
                {v.writtenQuestions.length > 0 && <span>Written: {v.writtenQuestionsToShow} questions</span>}
                {v.mcqDuration > 0 && <span>MCQ timer: {fmtDuration(v.mcqDuration)}</span>}
                {v.writtenDuration > 0 && <span>Written timer: {fmtDuration(v.writtenDuration)}</span>}
              </div>
            </button>
          ))}
        </div>
      </div>
    </Shell>
  );

  // ── Directions ─────────────────────────────────────────────────────────────────
  if (phase === 'directions') {
    const ver = activeVersionForUI || versions[0];
    if (!ver) return <Shell><p className="text-white/40 text-center mt-20">Loading version…</p></Shell>;

    const mcqDurFmt     = fmtDuration(ver.mcqDuration);
    const writtenDurFmt = fmtDuration(ver.writtenDuration);
    const attemptCount  = examStatus?.attemptCount ?? 0;
    const maxAtt        = content?.maxAttempts;
    const attemptsLeft  = maxAtt === 'unlimited' ? null : Math.max(0, Number(maxAtt || 1) - attemptCount);
    const hasMcq        = ver.mcqQuestions.length > 0;
    const hasWritten    = ver.writtenQuestions.length > 0;
    const totalToShow   = ver.mcqQuestionsToShow + ver.writtenQuestionsToShow;
    const isMixed       = hasMcq && hasWritten;

    return (
      <div className="min-h-screen bg-[#080a12] text-white">
        <div className="fixed inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 70% 35% at 50% -10%,rgba(244,63,94,.08) 0%,transparent 65%)' }} />
        <div className="relative max-w-2xl mx-auto px-4 sm:px-6 py-8">
          <BackBtn />

          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/20 flex items-center justify-center shrink-0">
              <ClipboardList size={26} className="text-rose-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{content?.title}</h1>
              {ver.versionName && versions.length > 1 && (
                <p className="text-white/40 text-sm mt-0.5">{ver.versionName}</p>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {[
              { label: 'Questions',     value: String(totalToShow) },
              { label: 'MCQ Time',      value: mcqDurFmt || '—' },
              { label: 'Written Time',  value: writtenDurFmt || '—' },
              { label: 'Attempts Left', value: attemptsLeft === null ? '∞' : String(attemptsLeft) },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-2xl bg-white/4 border border-white/8 p-4 text-center">
                <p className="text-base font-bold">{value}</p>
                <p className="text-[11px] text-white/35">{label}</p>
              </div>
            ))}
          </div>

          {/* Mixed exam notice */}
          {isMixed && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-violet-500/8 border border-violet-500/15 mb-6">
              <AlertCircle size={16} className="text-violet-400 shrink-0 mt-0.5" />
              <p className="text-violet-200/80 text-sm leading-relaxed">
                This exam has two parts: <strong>MCQ</strong> and <strong>Written</strong>.
                After submitting MCQ, you will have <strong>10 minutes</strong> to start the Written section.
                This window persists even if you close the browser.
              </p>
            </div>
          )}

          {/* Directions */}
          {(ver.mcqDirection || ver.writtenDirection) && (
            <div className="mb-8 space-y-4">
              {ver.mcqDirection && (
                <div className="rounded-2xl bg-white/3 border border-white/8 p-5">
                  <p className="text-[11px] uppercase tracking-wider text-rose-400 font-semibold mb-2">MCQ Instructions</p>
                  <p className="text-white/70 text-sm leading-relaxed whitespace-pre-wrap">{ver.mcqDirection}</p>
                </div>
              )}
              {ver.writtenDirection && (
                <div className="rounded-2xl bg-white/3 border border-white/8 p-5">
                  <p className="text-[11px] uppercase tracking-wider text-violet-400 font-semibold mb-2">Written Instructions</p>
                  <p className="text-white/70 text-sm leading-relaxed whitespace-pre-wrap">{ver.writtenDirection}</p>
                </div>
              )}
            </div>
          )}

          {/* Anti-cheat notice */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/8 border border-amber-500/15 mb-8">
            <Shield size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <p className="text-amber-200/80 text-sm leading-relaxed">
              This exam is monitored. Tab switches, right-clicking, copy/paste, and DevTools are logged.
              {(mcqDurFmt || writtenDurFmt) ? ' Auto-submission occurs when the timer expires.' : ''}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
              {error}
            </div>
          )}

          {isMixed ? (
            <div className="flex flex-wrap gap-3">
              <button onClick={startExam} disabled={submitting}
                className="flex items-center gap-3 px-8 py-3.5 rounded-2xl bg-rose-500 hover:bg-rose-600
                           text-white font-bold text-base transition disabled:opacity-50 shadow-lg shadow-rose-500/20">
                {submitting
                  ? <><Loader2 size={18} className="animate-spin" /> Starting…</>
                  : <><ClipboardList size={18} /> Start MCQ</>}
              </button>
            </div>
          ) : (
            <button onClick={startExam} disabled={submitting}
              className="flex items-center gap-3 px-8 py-3.5 rounded-2xl bg-rose-500 hover:bg-rose-600
                         text-white font-bold text-base transition disabled:opacity-50 shadow-lg shadow-rose-500/20">
              {submitting
                ? <><Loader2 size={18} className="animate-spin" /> Starting…</>
                : <><ClipboardList size={18} /> Start Exam</>}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── MCQ Phase ─────────────────────────────────────────────────────────────────
  if (phase === 'mcq') {
    const q = mcqQuestions[mcqIndex];
    const hasBothParts = writtenQuestions.length > 0;
    return (
      <Shell noPad>
        <ViolationToast />
        <Lightbox />
        {/* Header */}
        <div className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-[#080a12]/95 backdrop-blur border-b border-white/6">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white/40 truncate">{content?.title}</p>
            <p className="text-sm font-semibold">
              MCQ — Q {mcqIndex + 1}/{mcqQuestions.length}
              <span className="text-white/30 ml-1.5 text-xs font-normal">({mcqAnsweredCount} answered)</span>
            </p>
          </div>
          {mcqDurSecs > 0 && (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-mono font-bold
              ${timerWarning && activePart === 'mcq' ? 'bg-red-500/20 text-red-300 animate-pulse' : 'bg-white/6 text-white'}`}>
              <Clock size={13} /> {fmtTime(mcqRemaining)}
            </div>
          )}
          {hasBothParts ? (
            <button onClick={submitMCQPart} disabled={submitting}
              className="px-4 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-sm font-medium transition disabled:opacity-50 whitespace-nowrap">
              {submitting ? <Loader2 size={14} className="animate-spin inline" /> : 'Submit MCQ'}
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={submitting}
              className="px-4 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-sm font-medium transition disabled:opacity-50 whitespace-nowrap">
              {submitting ? <Loader2 size={14} className="animate-spin inline" /> : 'Submit'}
            </button>
          )}
        </div>

        <div className="flex h-[calc(100vh-57px)]">
          {/* Navigator */}
          <div className="hidden lg:flex flex-col w-52 border-r border-white/6 bg-[#0a0c14] p-3 gap-2 overflow-y-auto shrink-0">
            <p className="text-[10px] uppercase tracking-widest text-white/25 px-1 mb-1">Questions</p>
            <div className="grid grid-cols-5 gap-1">
              {mcqQuestions.map((_, i) => {
                const st = mcqStatus(i);
                return (
                  <button key={i} onClick={() => setMcqIndex(i)}
                    className={`w-8 h-8 rounded text-[11px] font-medium transition
                      ${mcqIndex === i ? 'ring-2 ring-rose-400' : ''}
                      ${st === 'answered' ? 'bg-emerald-500/30 text-emerald-300' :
                        st === 'skipped'  ? 'bg-amber-500/20 text-amber-300' : 'bg-white/6 text-white/40'}`}>
                    {i + 1}
                  </button>
                );
              })}
            </div>
            <div className="mt-auto space-y-1.5 pt-4 text-xs border-t border-white/6">
              <div className="flex items-center gap-2 text-white/40"><span className="w-3 h-3 rounded-sm bg-emerald-500/30" /> Answered ({mcqAnsweredCount})</div>
              <div className="flex items-center gap-2 text-white/40"><span className="w-3 h-3 rounded-sm bg-amber-500/20" /> Visited</div>
              <div className="flex items-center gap-2 text-white/40"><span className="w-3 h-3 rounded-sm bg-white/6" /> Not visited</div>
            </div>
          </div>

          {/* Question */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-8">
            {q ? (
              <div className="max-w-2xl mx-auto">
                <div className="mb-6">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="text-[11px] uppercase tracking-wider text-rose-400 font-semibold">Question {mcqIndex + 1}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-white/6 text-white/40">
                      +{q.correctMarks} / -{q.wrongMarks ?? 0} marks
                    </span>
                    {q.correctOptions.length > 1 && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-violet-500/15 text-violet-300">Multiple correct</span>
                    )}
                  </div>
                  <p className="text-white text-[15px] leading-relaxed">{q.question}</p>
                  {q.questionImage && (
                    <img src={q.questionImage} alt="q" onClick={() => setLightboxUrl(q.questionImage!)}
                      className="mt-3 max-h-56 rounded-xl object-contain cursor-pointer" />
                  )}
                </div>

                <div className="space-y-2.5 mb-6">
                  {q.options.map((opt, oi) => {
                    const sel   = mcqAnswers[mcqIndex]?.selectedOptions?.includes(oi) ?? false;
                    const multi = q.correctOptions.length > 1;
                    return (
                      <button key={oi} onClick={() => selectOption(mcqIndex, oi)}
                        className={`w-full text-left flex items-start gap-3 px-4 py-3.5 rounded-2xl border transition-all text-sm
                          ${sel ? 'border-rose-400/60 bg-rose-500/12 text-white' : 'border-white/8 bg-white/3 text-white/70 hover:border-white/18 hover:bg-white/6'}`}>
                        <span className={`flex-shrink-0 w-5 h-5 ${multi ? 'rounded' : 'rounded-full'} border-2 flex items-center justify-center mt-0.5
                          ${sel ? 'border-rose-400 bg-rose-400' : 'border-white/25'}`}>
                          {sel && <Check size={10} className="text-white" strokeWidth={3} />}
                        </span>
                        <span className="flex-1 leading-relaxed">{opt}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Live marks */}
                {mcqAnswers[mcqIndex] && (
                  <div className={`text-xs mb-5 px-3 py-1.5 rounded-lg inline-block
                    ${(mcqAnswers[mcqIndex].marksAwarded ?? 0) > 0 ? 'bg-emerald-500/10 text-emerald-400' :
                      (mcqAnswers[mcqIndex].marksAwarded ?? 0) < 0 ? 'bg-red-500/10 text-red-400' : 'bg-white/5 text-white/30'}`}>
                    This question: {(mcqAnswers[mcqIndex].marksAwarded ?? 0) >= 0 ? '+' : ''}{mcqAnswers[mcqIndex].marksAwarded ?? 0} marks
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-white/6">
                  <button onClick={() => setMcqIndex(p => Math.max(0, p - 1))} disabled={mcqIndex === 0}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 text-sm transition">
                    <ChevronLeft size={15} /> Prev
                  </button>
                  <span className="text-xs text-white/25">{mcqIndex + 1}/{mcqQuestions.length}</span>
                  {mcqIndex < mcqQuestions.length - 1 ? (
                    <button onClick={() => setMcqIndex(p => p + 1)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-sm transition">
                      Next <ChevronRight size={15} />
                    </button>
                  ) : hasBothParts ? (
                    <button onClick={submitMCQPart} disabled={submitting}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm transition">
                      Submit MCQ <ChevronRight size={15} />
                    </button>
                  ) : (
                    <button onClick={handleSubmit}
                      className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm transition">
                      Submit
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-white/30">
                <AlertCircle size={24} />
                <p>No questions found in this version.</p>
                <p className="text-xs">Debug: {mcqQuestions.length} MCQ, {writtenQuestions.length} Written loaded</p>
              </div>
            )}
          </div>
        </div>
      </Shell>
    );
  }

  // ── MCQ Submitted Phase ───────────────────────────────────────────────────────
  if (phase === 'mcq_submitted') {
    const minsLeft = Math.floor(writtenWindowSecs / 60);
    const secsLeft = writtenWindowSecs % 60;
    const pctLeft  = (writtenWindowSecs / 600) * 100;

    return (
      <Shell>
        <div className="max-w-md mx-auto mt-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={32} className="text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold mb-2">MCQ Submitted!</h2>
          <p className="text-white/50 text-sm mb-8">
            Your MCQ answers have been saved. Now start the Written section.
          </p>

          {writtenLocked ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 mb-6">
              <Lock size={24} className="text-red-400 mx-auto mb-3" />
              <p className="text-red-300 font-semibold mb-1">Written Section Locked</p>
              <p className="text-white/40 text-sm">
                The 10-minute window to start the written section has passed.
              </p>
            </div>
          ) : (
            <>
              {/* Countdown ring + timer */}
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6 mb-6">
                <div className="relative w-24 h-24 mx-auto mb-3">
                  <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
                    <circle cx="48" cy="48" r="42" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                    <circle cx="48" cy="48" r="42" fill="none"
                      stroke={writtenWindowSecs < 60 ? '#ef4444' : writtenWindowSecs < 180 ? '#f59e0b' : '#10b981'}
                      strokeWidth="8"
                      strokeDasharray={`${2 * Math.PI * 42}`}
                      strokeDashoffset={`${2 * Math.PI * 42 * (1 - pctLeft / 100)}`}
                      strokeLinecap="round"
                      style={{ transition: 'stroke-dashoffset 1s linear, stroke 1s' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`font-mono font-bold text-xl leading-none
                      ${writtenWindowSecs < 60 ? 'text-red-400' : writtenWindowSecs < 180 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {String(minsLeft).padStart(2,'0')}:{String(secsLeft).padStart(2,'0')}
                    </span>
                  </div>
                </div>
                <p className="text-amber-200/60 text-xs">Time remaining to start Written section</p>
                <p className="text-white/30 text-[10px] mt-1">This timer runs even if you close the browser</p>
              </div>
              <button onClick={startWrittenPart} disabled={submitting}
                className="flex items-center gap-3 px-8 py-3.5 rounded-2xl bg-violet-500 hover:bg-violet-600
                           text-white font-bold text-base transition disabled:opacity-50 shadow-lg shadow-violet-500/20 mx-auto">
                {submitting
                  ? <><Loader2 size={18} className="animate-spin" /> Starting…</>
                  : <><PenLine size={18} /> Start Written Exam</>}
              </button>
            </>
          )}

          {error && (
            <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
              {error}
            </div>
          )}
        </div>
      </Shell>
    );
  }

  // ── Written Phase ─────────────────────────────────────────────────────────────
  if (phase === 'written') {
    const wq = writtenQuestions[writtenIndex];
    const wa = writtenAnswers[writtenIndex] || { questionId: wq?.id, answerText: '', attachmentUrls: [] };
    return (
      <Shell noPad>
        <ViolationToast />
        <Lightbox />
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) uploadAttachment(writtenIndex, f);
            e.target.value = '';
          }} />

        {/* Header */}
        <div className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-[#080a12]/95 backdrop-blur border-b border-white/6">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white/40 truncate">{content?.title}</p>
            <p className="text-sm font-semibold">
              Written — Q {writtenIndex + 1}/{writtenQuestions.length}
              <span className="text-white/30 ml-1.5 text-xs font-normal">({writtenAnsweredCount} answered)</span>
            </p>
          </div>
          {writtenDurSecs > 0 && (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-mono font-bold
              ${timerWarning && activePart === 'written' ? 'bg-red-500/20 text-red-300 animate-pulse' : 'bg-white/6 text-white'}`}>
              <Clock size={13} /> {fmtTime(writtenRemaining)}
            </div>
          )}
          <button onClick={handleSubmit} disabled={submitting}
            className="px-4 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-sm font-medium transition disabled:opacity-50">
            {submitting ? <Loader2 size={14} className="animate-spin inline" /> : 'Submit'}
          </button>
        </div>

        <div className="flex h-[calc(100vh-57px)]">
          <div className="hidden lg:flex flex-col w-52 border-r border-white/6 bg-[#0a0c14] p-3 gap-2 overflow-y-auto shrink-0">
            <p className="text-[10px] uppercase tracking-widest text-white/25 px-1 mb-1">Questions</p>
            <div className="grid grid-cols-5 gap-1">
              {writtenQuestions.map((_, i) => {
                const st = writtenStatus(i);
                return (
                  <button key={i} onClick={() => setWrittenIndex(i)}
                    className={`w-8 h-8 rounded text-[11px] font-medium transition
                      ${writtenIndex === i ? 'ring-2 ring-violet-400' : ''}
                      ${st === 'answered' ? 'bg-emerald-500/30 text-emerald-300' : 'bg-white/6 text-white/40'}`}>
                    {i + 1}
                  </button>
                );
              })}
            </div>
            <div className="mt-auto pt-4 text-xs text-white/40 border-t border-white/6">
              {writtenAnsweredCount}/{writtenQuestions.length} answered
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-8">
            {wq ? (
              <div className="max-w-2xl mx-auto space-y-5">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[11px] uppercase tracking-wider text-violet-400 font-semibold">Question {writtenIndex + 1}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-violet-500/10 text-violet-400">{wq.marks} marks</span>
                  </div>
                  <p className="text-white text-[15px] leading-relaxed">{wq.question}</p>
                  {wq.questionImage && (
                    <img src={wq.questionImage} alt="q" onClick={() => setLightboxUrl(wq.questionImage!)}
                      className="mt-3 max-h-56 rounded-xl object-contain cursor-pointer" />
                  )}
                </div>

                <div>
                  <p className="text-[11px] text-white/40 mb-2 uppercase tracking-wider">Your Answer</p>
                  <textarea
                    value={wa.answerText || ''} rows={7}
                    onChange={e => changeWritten(writtenIndex, e.target.value)}
                    placeholder="Type your answer here…"
                    style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
                    onCopy={e => e.stopPropagation()} onCut={e => e.stopPropagation()}
                    onContextMenu={e => e.stopPropagation()}
                    className="w-full bg-white/4 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm
                               placeholder-white/20 focus:outline-none focus:border-violet-400/50 resize-none leading-relaxed" />
                </div>

                <div>
                  <p className="text-[11px] text-white/40 mb-2 uppercase tracking-wider">Attach Photos (optional)</p>
                  {(wa.attachmentUrls || []).length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {(wa.attachmentUrls || []).map((url, ui) => (
                        <div key={ui} className="relative group">
                          <img src={url} alt={`att-${ui}`} onClick={() => setLightboxUrl(url)}
                            className="w-24 h-24 object-cover rounded-xl border border-white/10 cursor-pointer" />
                          <button onClick={() => removeAttachment(writtenIndex, url)}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                            <X size={10} className="text-white" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={() => fileInputRef.current?.click()} disabled={uploadingFor === wq.id}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-white/15
                               hover:border-violet-400/40 hover:bg-violet-500/5 text-white/40 hover:text-white/60 text-sm transition disabled:opacity-50">
                    {uploadingFor === wq.id
                      ? <><Loader2 size={14} className="animate-spin" /> Uploading…</>
                      : <><Paperclip size={14} /> Attach photo</>}
                  </button>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/6">
                  <button onClick={() => setWrittenIndex(p => Math.max(0, p - 1))} disabled={writtenIndex === 0}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 text-sm transition">
                    <ChevronLeft size={15} /> Prev
                  </button>
                  <span className="text-xs text-white/25">{writtenIndex + 1}/{writtenQuestions.length}</span>
                  {writtenIndex < writtenQuestions.length - 1 ? (
                    <button onClick={() => setWrittenIndex(p => p + 1)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 text-sm transition">
                      Next <ChevronRight size={15} />
                    </button>
                  ) : (
                    <button onClick={handleSubmit}
                      className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm transition">
                      Submit Exam
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-white/30">No written questions.</div>
            )}
          </div>
        </div>
      </Shell>
    );
  }

  // ── Results ─────────────────────────────────────────────────────────────────────
  if (phase === 'results' && session) {
    const maxAtt      = content?.maxAttempts;
    const attemptCount = examStatus?.attemptCount ?? 0;
    const canReattempt = maxAtt === 'unlimited' || (maxAtt && attemptCount < Number(maxAtt));

    return (
      <ResultsPage
        content={content!} session={session}
        mcqQuestions={mcqQuestions} writtenQuestions={writtenQuestions}
        canReattempt={!!canReattempt}
        onReattempt={handleReattempt}
        onBack={() => navigate(-1)}
      />
    );
  }

  return (
    <Shell>
      <BackBtn />
      <p className="text-center text-white/30 mt-20">Something went wrong. Please go back.</p>
    </Shell>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// RESULTS PAGE — UPDATE 2: All attempts + analytics
// ═══════════════════════════════════════════════════════════════════════════════
const ResultsPage: React.FC<{
  content: Content; session: ExamSession;
  mcqQuestions: MCQQuestion[]; writtenQuestions: WrittenQuestion[];
  canReattempt: boolean;
  onReattempt: () => void;
  onBack: () => void;
}> = ({ content, session, mcqQuestions, writtenQuestions, canReattempt, onReattempt, onBack }) => {
  type MainTab = 'overview' | 'mcq' | 'written' | 'attempts';
  const [tab, setTab] = useState<MainTab>('overview');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // UPDATE 2: All attempts state
  const [allAttempts, setAllAttempts] = useState<ExamSession[]>([]);
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  const [selectedAttempt, setSelectedAttempt] = useState<ExamSession | null>(null);

  // Load all attempts when tab is first opened
  useEffect(() => {
    if (tab !== 'attempts' || allAttempts.length > 0) return;
    setAttemptsLoading(true);
    examService.getAllAttemptSessions(session.contentId, session.studentId)
      .then(attempts => {
        setAllAttempts(attempts);
      })
      .finally(() => setAttemptsLoading(false));
  }, [tab]);

  const fmtSecs = (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m ${ss}s`;
  };

  const fmtDate = (d?: Date) => d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  // Current session stats
  const pct         = session.maxMarks > 0 ? (session.totalMarks / session.maxMarks) * 100 : 0;
  const pctStr      = pct.toFixed(1);
  const gradeColor  = pct >= 80 ? 'text-emerald-400' : pct >= 60 ? 'text-amber-400' : pct >= 40 ? 'text-orange-400' : 'text-red-400';
  const mcqMax      = mcqQuestions.reduce((s, q) => s + (q.correctMarks || 0), 0);
  const writtenMax  = writtenQuestions.reduce((s, q) => s + (q.marks || 0), 0);

  const tabs = [
    { key: 'overview' as MainTab, label: 'Overview' },
    ...(mcqQuestions.length > 0      ? [{ key: 'mcq' as MainTab,     label: 'MCQ Review'     }] : []),
    ...(writtenQuestions.length > 0  ? [{ key: 'written' as MainTab, label: 'Written Review' }] : []),
    { key: 'attempts' as MainTab, label: 'All Attempts' },
  ];

  // For selected attempt detail view
  const viewingAttempt = selectedAttempt || session;

  return (
    <div className="min-h-screen bg-[#080a12] text-white">
      <div className="fixed inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 70% 35% at 50% -10%,rgba(16,185,129,.07) 0%,transparent 65%)' }} />
      {lightboxUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur" onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="enlarged" className="max-w-4xl max-h-[90vh] object-contain rounded-2xl" />
        </div>
      )}
      <div className="relative max-w-4xl mx-auto px-4 py-8">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-white/40 hover:text-white mb-8 transition group">
          <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" /> Back to Library
        </button>

        {/* Score hero */}
        <div className="rounded-3xl bg-white/3 border border-white/8 p-8 mb-6 text-center">
          <p className="text-white/40 text-sm mb-1">{content.title}</p>
          <div className={`text-7xl font-black mb-2 ${gradeColor}`}>{pctStr}%</div>
          <p className="text-white/40">{session.totalMarks} / {session.maxMarks} marks</p>
          {session.status === 'auto_submitted' && (
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
              <Clock size={11} /> Auto-submitted (time expired)
            </div>
          )}
          {session.writtenEvaluationPending && (
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
              <AlertTriangle size={11} /> Written evaluation pending — score may increase
            </div>
          )}
          {canReattempt && (
            <div className="mt-6">
              <button onClick={onReattempt}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-white/8 hover:bg-white/14
                           border border-white/10 text-white/70 hover:text-white text-sm font-medium transition">
                <RotateCcw size={14} /> Try Again
              </button>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'MCQ Marks',    value: `${session.mcqMarks}/${mcqMax}` },
            { label: 'Written Marks',value: session.writtenEvaluationPending ? 'Pending' : `${session.writtenMarks}/${writtenMax}` },
            { label: 'Time Taken',   value: fmtSecs(session.timeTakenSeconds) },
            { label: 'Tab Switches', value: String(session.tabSwitchCount) },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-2xl bg-white/4 border border-white/8 p-4 text-center">
              <p className="text-base font-bold">{value}</p>
              <p className="text-[11px] text-white/35">{label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-white/4 rounded-2xl border border-white/8 mb-6 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition whitespace-nowrap px-3
                ${tab === t.key ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'}`}>
              {t.key === 'attempts' ? (
                <span className="flex items-center justify-center gap-1.5"><History size={13} />{t.label}</span>
              ) : t.label}
            </button>
          ))}
        </div>

        {/* Overview */}
        {tab === 'overview' && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white/3 border border-white/8 p-6">
              <h3 className="font-semibold mb-5">Performance Breakdown</h3>
              {mcqQuestions.length > 0 && (
                <div className="mb-5">
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-white/50">MCQ Score</span>
                    <span className="font-medium">{session.mcqMarks} / {mcqMax}</span>
                  </div>
                  <div className="h-2.5 bg-white/8 rounded-full overflow-hidden">
                    <div className="h-full bg-rose-500 rounded-full transition-all duration-1000"
                      style={{ width: `${mcqMax > 0 ? Math.max(0, (session.mcqMarks / mcqMax) * 100) : 0}%` }} />
                  </div>
                  <div className="flex gap-4 mt-1.5 text-xs text-white/30">
                    <span className="text-emerald-400">✓ {session.mcqAnswers.filter(a => a.isCorrect).length} correct</span>
                    <span className="text-red-400">✗ {session.mcqAnswers.filter(a => !a.isCorrect && a.selectedOptions?.length > 0).length} wrong</span>
                    <span>— {session.mcqAnswers.filter(a => !a.selectedOptions?.length).length} skipped</span>
                  </div>
                </div>
              )}
              {writtenQuestions.length > 0 && (
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-white/50">Written Score</span>
                    <span className="font-medium">{session.writtenEvaluationPending ? 'Pending' : `${session.writtenMarks} / ${writtenMax}`}</span>
                  </div>
                  {!session.writtenEvaluationPending && (
                    <div className="h-2.5 bg-white/8 rounded-full overflow-hidden">
                      <div className="h-full bg-violet-500 rounded-full transition-all duration-1000"
                        style={{ width: `${writtenMax > 0 ? (session.writtenMarks / writtenMax) * 100 : 0}%` }} />
                    </div>
                  )}
                </div>
              )}
            </div>
            {session.suspiciousActivity?.length > 0 && (
              <div className="rounded-2xl bg-amber-500/6 border border-amber-500/15 p-5">
                <p className="text-amber-300 text-sm font-semibold mb-3 flex items-center gap-2">
                  <Shield size={14} /> Flagged Activity ({session.suspiciousActivity.length})
                </p>
                <ul className="space-y-1 max-h-40 overflow-y-auto">
                  {session.suspiciousActivity.map((a, i) => (
                    <li key={i} className="text-amber-200/50 text-xs font-mono">{a}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* MCQ Review */}
        {tab === 'mcq' && (
          <div className="space-y-3">
            {session.mcqAnswers.length === 0
              ? <p className="text-white/30 text-center py-16">No MCQ answers recorded.</p>
              : session.mcqAnswers.map((ans, i) => {
                  const q = mcqQuestions.find(q => q.id === ans.questionId);
                  if (!q) return null;
                  return (
                    <div key={i} className={`rounded-2xl border p-5
                      ${ans.isCorrect ? 'bg-emerald-500/5 border-emerald-500/15' :
                        !ans.selectedOptions?.length ? 'bg-white/3 border-white/8' : 'bg-red-500/5 border-red-500/15'}`}>
                      <div className="flex items-start gap-3">
                        <div className="shrink-0 mt-0.5">
                          {ans.isCorrect ? <CheckCircle size={16} className="text-emerald-400" /> :
                           !ans.selectedOptions?.length ? <span className="w-4 h-4 rounded-full border-2 border-white/20 inline-block" /> :
                           <XCircle size={16} className="text-red-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium mb-3 leading-relaxed">{q.question}</p>
                          {q.questionImage && <img src={q.questionImage} alt="q" onClick={() => setLightboxUrl(q.questionImage!)}
                            className="mb-3 max-h-32 rounded-lg object-contain cursor-pointer" />}
                          <div className="space-y-1 mb-3">
                            {q.options.map((opt, oi) => {
                              const userPicked    = ans.selectedOptions?.includes(oi);
                              const correctOption = q.correctOptions.includes(oi);
                              return (
                                <div key={oi} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm
                                  ${correctOption ? 'bg-emerald-500/15 text-emerald-300' :
                                    userPicked ? 'bg-red-500/15 text-red-300' : 'text-white/30'}`}>
                                  <span className="shrink-0 w-4">
                                    {correctOption ? <Check size={12} /> : userPicked ? <X size={12} /> : null}
                                  </span>
                                  {opt}
                                </div>
                              );
                            })}
                          </div>
                          {q.solution && (
                            <div className="mt-3 pt-3 border-t border-white/8">
                              <p className="text-[10px] text-white/25 uppercase tracking-wider mb-1">Solution</p>
                              <p className="text-white/60 text-sm leading-relaxed">{q.solution}</p>
                            </div>
                          )}
                          <div className="mt-2 text-right text-[11px] text-white/25">
                            {(ans.marksAwarded ?? 0) >= 0 ? '+' : ''}{ans.marksAwarded ?? 0} marks
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
          </div>
        )}

        {/* Written Review */}
        {tab === 'written' && (
          <div className="space-y-4">
            {session.writtenEvaluationPending && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/8 border border-amber-500/15">
                <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                <p className="text-amber-200/80 text-sm">Pending teacher evaluation. Marks will appear once evaluated.</p>
              </div>
            )}
            {session.writtenAnswers.map((wa, i) => {
              const q = writtenQuestions.find(q => q.id === wa.questionId);
              if (!q) return null;
              return (
                <div key={i} className="rounded-2xl bg-white/3 border border-white/8 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] uppercase tracking-wider text-violet-400 font-semibold">
                      Q{i + 1} — {q.marks} marks
                    </span>
                    {wa.marksAwarded !== undefined && !session.writtenEvaluationPending && (
                      <span className="text-sm font-bold text-emerald-400">+{wa.marksAwarded} awarded</span>
                    )}
                  </div>
                  <p className="text-white text-sm mb-4 leading-relaxed">{q.question}</p>
                  {q.questionImage && <img src={q.questionImage} alt="q" onClick={() => setLightboxUrl(q.questionImage!)}
                    className="mb-4 max-h-40 rounded-xl object-contain cursor-pointer" />}
                  {wa.answerText && (
                    <div className="bg-white/4 rounded-xl px-4 py-3 mb-3">
                      <p className="text-[10px] uppercase tracking-wider text-white/25 mb-1">Your answer</p>
                      <p className="text-white/70 text-sm whitespace-pre-wrap leading-relaxed">{wa.answerText}</p>
                    </div>
                  )}
                  {(wa.attachmentUrls || []).length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {wa.attachmentUrls!.map((url, ui) => (
                        <img key={ui} src={url} alt={`att-${ui}`} onClick={() => setLightboxUrl(url)}
                          className="h-28 object-cover rounded-xl border border-white/10 cursor-pointer" />
                      ))}
                    </div>
                  )}
                  {wa.evaluatorComment && (
                    <div className="bg-emerald-500/8 border border-emerald-500/15 rounded-xl px-4 py-3 mb-3">
                      <p className="text-[10px] uppercase tracking-wider text-emerald-400 mb-1">Evaluator feedback</p>
                      <p className="text-white/70 text-sm">{wa.evaluatorComment}</p>
                    </div>
                  )}
                  {q.solution && (
                    <div className="bg-indigo-500/8 border border-indigo-500/15 rounded-xl px-4 py-3">
                      <p className="text-[10px] uppercase tracking-wider text-indigo-400 mb-1">Model Solution</p>
                      <p className="text-white/70 text-sm leading-relaxed">{q.solution}</p>
                      {q.solutionImage && <img src={q.solutionImage} alt="sol" onClick={() => setLightboxUrl(q.solutionImage!)}
                        className="mt-2 max-h-40 rounded-xl object-contain cursor-pointer" />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* UPDATE 2: All Attempts Tab */}
        {tab === 'attempts' && (
          <div className="space-y-6">
            {attemptsLoading ? (
              <div className="flex items-center justify-center py-16 gap-3 text-white/40">
                <Loader2 size={20} className="animate-spin" />
                <span className="text-sm">Loading attempts…</span>
              </div>
            ) : allAttempts.length === 0 ? (
              <p className="text-white/30 text-center py-16">No completed attempts found.</p>
            ) : (
              <>
                {/* Progress chart — score over attempts */}
                <div className="rounded-2xl bg-white/3 border border-white/8 p-6">
                  <h3 className="font-semibold mb-1 flex items-center gap-2">
                    <TrendingUp size={16} className="text-emerald-400" /> Score Progression
                  </h3>
                  <p className="text-white/35 text-xs mb-5">Your score across all attempts</p>
                  <div className="flex items-end gap-2 h-32">
                    {allAttempts.map((att, idx) => {
                      const attPct = att.maxMarks > 0 ? (att.totalMarks / att.maxMarks) * 100 : 0;
                      const barH   = Math.max(4, (attPct / 100) * 100);
                      const isLast = idx === allAttempts.length - 1;
                      const color  = attPct >= 80 ? 'bg-emerald-500' : attPct >= 60 ? 'bg-amber-500' : attPct >= 40 ? 'bg-orange-500' : 'bg-red-500';
                      return (
                        <button key={att.id}
                          onClick={() => setSelectedAttempt(selectedAttempt?.id === att.id ? null : att)}
                          className={`flex-1 flex flex-col items-center gap-1 group transition`}>
                          <span className={`text-[10px] font-bold transition
                            ${selectedAttempt?.id === att.id ? 'text-white' : 'text-white/40 group-hover:text-white/70'}`}>
                            {attPct.toFixed(0)}%
                          </span>
                          <div className={`w-full rounded-t-lg transition-all ${color}
                            ${selectedAttempt?.id === att.id ? 'opacity-100 ring-2 ring-white/40' : 'opacity-60 group-hover:opacity-90'}`}
                            style={{ height: `${barH}%` }} />
                          <span className={`text-[9px] transition
                            ${isLast ? 'text-rose-400 font-bold' : selectedAttempt?.id === att.id ? 'text-white' : 'text-white/30'}`}>
                            #{att.attemptNumber}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-4 mt-4 text-[10px] text-white/30">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> ≥80%</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> 60–79%</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500 inline-block" /> 40–59%</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> &lt;40%</span>
                    <span className="ml-auto italic">Click a bar to see details</span>
                  </div>
                </div>

                {/* Analytics summary */}
                {allAttempts.length >= 2 && (() => {
                  const scores    = allAttempts.map(a => a.maxMarks > 0 ? (a.totalMarks / a.maxMarks) * 100 : 0);
                  const best      = Math.max(...scores);
                  const latest    = scores[scores.length - 1];
                  const prev      = scores[scores.length - 2];
                  const trend     = latest - prev;
                  const avg       = scores.reduce((s, v) => s + v, 0) / scores.length;
                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: 'Best Score',    value: `${best.toFixed(1)}%`,  color: 'text-emerald-400' },
                        { label: 'Latest Score',  value: `${latest.toFixed(1)}%`, color: latest >= 80 ? 'text-emerald-400' : latest >= 60 ? 'text-amber-400' : 'text-red-400' },
                        { label: 'Average',       value: `${avg.toFixed(1)}%`,   color: 'text-violet-400' },
                        { label: 'vs Last Attempt', value: `${trend >= 0 ? '+' : ''}${trend.toFixed(1)}%`, color: trend >= 0 ? 'text-emerald-400' : 'text-red-400' },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="rounded-2xl bg-white/4 border border-white/8 p-4 text-center">
                          <p className={`text-lg font-bold ${color}`}>{value}</p>
                          <p className="text-[11px] text-white/35">{label}</p>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* MCQ accuracy trend (if available) */}
                {allAttempts.some(a => a.mcqAnswers?.length > 0) && (
                  <div className="rounded-2xl bg-white/3 border border-white/8 p-6">
                    <h3 className="font-semibold mb-1 flex items-center gap-2">
                      <BarChart2 size={16} className="text-rose-400" /> MCQ Accuracy Trend
                    </h3>
                    <p className="text-white/35 text-xs mb-5">Correct / Wrong / Skipped per attempt</p>
                    <div className="space-y-2">
                      {allAttempts.map((att, idx) => {
                        if (!att.mcqAnswers?.length) return null;
                        const total   = att.mcqAnswers.length;
                        const correct = att.mcqAnswers.filter(a => a.isCorrect).length;
                        const wrong   = att.mcqAnswers.filter(a => !a.isCorrect && a.selectedOptions?.length > 0).length;
                        const skipped = att.mcqAnswers.filter(a => !a.selectedOptions?.length).length;
                        return (
                          <div key={att.id} className="flex items-center gap-3">
                            <span className="text-[10px] text-white/30 w-8 shrink-0">#{att.attemptNumber}</span>
                            <div className="flex-1 h-4 bg-white/5 rounded-full overflow-hidden flex">
                              <div className="bg-emerald-500/70 h-full transition-all"
                                style={{ width: `${(correct / total) * 100}%` }} />
                              <div className="bg-red-500/70 h-full transition-all"
                                style={{ width: `${(wrong / total) * 100}%` }} />
                              <div className="bg-white/10 h-full transition-all"
                                style={{ width: `${(skipped / total) * 100}%` }} />
                            </div>
                            <span className="text-[10px] text-white/30 shrink-0 w-24 text-right">
                              {correct}✓ {wrong}✗ {skipped}—
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Attempt list */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-white/50">Attempt Details</h3>
                  {allAttempts.map((att, idx) => {
                    const attPct   = att.maxMarks > 0 ? (att.totalMarks / att.maxMarks) * 100 : 0;
                    const attColor = attPct >= 80 ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5'
                                   : attPct >= 60 ? 'text-amber-400 border-amber-500/20 bg-amber-500/5'
                                   : attPct >= 40 ? 'text-orange-400 border-orange-500/20 bg-orange-500/5'
                                   : 'text-red-400 border-red-500/20 bg-red-500/5';
                    const isSelected = selectedAttempt?.id === att.id;
                    const isLatest   = idx === allAttempts.length - 1;
                    return (
                      <div key={att.id}
                        className={`rounded-2xl border p-5 transition cursor-pointer
                          ${isSelected ? 'border-white/20 bg-white/6' : 'border-white/8 bg-white/3 hover:border-white/15'}`}
                        onClick={() => setSelectedAttempt(isSelected ? null : att)}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className={`text-2xl font-black ${attColor.split(' ')[0]}`}>
                              {attPct.toFixed(0)}%
                            </span>
                            <div>
                              <p className="text-sm font-medium text-white">
                                Attempt #{att.attemptNumber}
                                {isLatest && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400">Latest</span>}
                              </p>
                              <p className="text-xs text-white/35">{fmtDate(att.submittedAt || att.startedAt)}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold">{att.totalMarks}/{att.maxMarks} marks</p>
                            <p className="text-[11px] text-white/35">{fmtSecs(att.timeTakenSeconds)}</p>
                          </div>
                        </div>

                        {/* Expanded detail */}
                        {isSelected && (
                          <div className="mt-4 pt-4 border-t border-white/8 grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {att.mcqAnswers?.length > 0 && (
                              <div className="rounded-xl bg-white/4 p-3">
                                <p className="text-[10px] text-white/35 uppercase tracking-wider mb-1">MCQ</p>
                                <p className="font-bold">{att.mcqMarks} marks</p>
                                <p className="text-xs text-white/40">
                                  {att.mcqAnswers.filter(a => a.isCorrect).length} correct,{' '}
                                  {att.mcqAnswers.filter(a => !a.isCorrect && a.selectedOptions?.length > 0).length} wrong
                                </p>
                              </div>
                            )}
                            {att.writtenAnswers?.length > 0 && (
                              <div className="rounded-xl bg-white/4 p-3">
                                <p className="text-[10px] text-white/35 uppercase tracking-wider mb-1">Written</p>
                                <p className="font-bold">{att.writtenEvaluationPending ? 'Pending' : `${att.writtenMarks} marks`}</p>
                              </div>
                            )}
                            <div className="rounded-xl bg-white/4 p-3">
                              <p className="text-[10px] text-white/35 uppercase tracking-wider mb-1">Anti-cheat</p>
                              <p className="font-bold">{att.tabSwitchCount} tab switches</p>
                              <p className="text-xs text-white/40">{att.focusLostCount} focus lost</p>
                            </div>
                            {att.status === 'auto_submitted' && (
                              <div className="col-span-full">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                                  <Clock size={10} /> Auto-submitted (time expired)
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExamViewer;
