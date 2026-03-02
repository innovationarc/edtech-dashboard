// src/pages/ExamViewer.tsx
// 100% Production-Ready Exam Viewer — Complete Rewrite
// Fixes: version fetching, blank questions, marking rules, attempt tracking,
//        result publish timing, timer bugs, anti-cheat, session resume

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Clock, AlertTriangle, CheckCircle, XCircle,
  Shield, Eye, EyeOff, Upload, X, FileText, ChevronLeft,
  ChevronRight, BarChart2, Award, Target, Loader2,
  ClipboardList, PenLine, BookOpen, Check, AlertCircle,
  Paperclip, Trash2, ZoomIn, Lock, RefreshCw, Info,
  ListChecks, Layers,
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

// ─── Types ─────────────────────────────────────────────────────────────────────
type Phase =
  | 'loading'
  | 'version_select'   // student picks which version to attempt
  | 'directions'
  | 'mcq'
  | 'written'
  | 'submitted'
  | 'results'
  | 'blocked'          // submitted, result not published yet
  | 'scheduled_locked'
  | 'absent'
  | 'attempt_limit';

// ExamVersion from contentService (mirrors what's in Firestore)
interface ExamVersion {
  id: string;
  versionName: string;
  mcqQuestions: MCQQuestion[];
  writtenQuestions: WrittenQuestion[];
  mcqDuration?: number;        // in minutes (decimal)
  writtenDuration?: number;    // in minutes (decimal)
  mcqQuestionsToShow?: number;
  writtenQuestionsToShow?: number;
  mcqDirection?: string;
  writtenDirection?: string;
}

// ─── Formatting helpers ────────────────────────────────────────────────────────
const fmt = (secs: number) => {
  if (secs < 0) secs = 0;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const fmtMin = (minutes: number) => {
  if (!minutes || minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
};

// ─── Shuffle & lock helpers ────────────────────────────────────────────────────
const shuffleArray = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/**
 * Apply lock positions + randomize.
 * questionsToShow includes locked ones.
 * unlocked slots = questionsToShow - lockedCount
 */
const buildQuestionSet = <T extends { isLocked?: boolean; lockedPosition?: 'first' | 'last' | null }>(
  allQuestions: T[],
  questionsToShow: number
): T[] => {
  const totalToShow = questionsToShow || allQuestions.length;

  const lockedFirst = allQuestions.filter(q => q.isLocked && q.lockedPosition === 'first');
  const lockedLast  = allQuestions.filter(q => q.isLocked && q.lockedPosition === 'last');
  const unlocked    = allQuestions.filter(q => !q.isLocked || !q.lockedPosition);

  // How many unlocked slots remain
  const lockedCount   = lockedFirst.length + lockedLast.length;
  const unlockedSlots = Math.max(0, totalToShow - lockedCount);

  const selectedUnlocked = shuffleArray(unlocked).slice(0, unlockedSlots);

  return [...lockedFirst, ...selectedUnlocked, ...lockedLast];
};

// ─── Exam open window check ────────────────────────────────────────────────────
const isExamOpen = (content: Content): boolean => {
  if (content.examTimelineType === 'scheduled') {
    const now   = Date.now();
    const start = content.examStartDateTime ? new Date(content.examStartDateTime).getTime() : 0;
    const end   = content.examEndDateTime   ? new Date(content.examEndDateTime).getTime()   : Infinity;
    return now >= start && now <= end;
  }
  return true;
};

const isExamOver = (content: Content): boolean => {
  if (content.examTimelineType === 'scheduled' && content.examEndDateTime) {
    return Date.now() > new Date(content.examEndDateTime).getTime();
  }
  return false;
};

// ─── Result visibility check ───────────────────────────────────────────────────
const checkResultVisible = (content: Content, session?: ExamSession | null): boolean => {
  if (!session) return false;
  if (session.resultVisibility === 'visible') return true;
  if (content.resultPublishType === 'immediate') return true;
  if (content.resultPublishType === 'scheduled' && content.resultPublishDateTime) {
    return Date.now() >= new Date(content.resultPublishDateTime).getTime();
  }
  return false;
};

// ─── MCQ marks calculation ─────────────────────────────────────────────────────
/**
 * Rules:
 * - No answer selected  → skipMarks (usually 0)
 * - All correct options selected exactly → +correctMarks
 * - Otherwise (wrong or partial) → -wrongMarks
 */
const calcMcqMarks = (q: MCQQuestion, selectedOptions: number[]): { isCorrect: boolean; marksAwarded: number } => {
  if (selectedOptions.length === 0) {
    return { isCorrect: false, marksAwarded: q.skipMarks ?? 0 };
  }
  const allCorrectSelected = q.correctOptions.every(o => selectedOptions.includes(o));
  const noWrongSelected    = selectedOptions.every(o => q.correctOptions.includes(o));
  const isCorrect = allCorrectSelected && noWrongSelected && q.correctOptions.length > 0;
  if (isCorrect) {
    return { isCorrect: true, marksAwarded: q.correctMarks };
  }
  return { isCorrect: false, marksAwarded: -(q.wrongMarks ?? 0) };
};

// ─── Anti-cheat hook ───────────────────────────────────────────────────────────
function useAntiCheat(
  active: boolean,
  sessionId: string | null,
  onViolation: (type: string) => void
) {
  const onViolationRef = useRef(onViolation);
  useEffect(() => { onViolationRef.current = onViolation; }, [onViolation]);

  useEffect(() => {
    if (!active || !sessionId) return;

    const onContextMenu = (e: Event) => { e.preventDefault(); onViolationRef.current('right_click'); };
    const onCopy        = (e: Event) => { e.preventDefault(); onViolationRef.current('copy_attempt'); };
    const onVisChange   = () => { if (document.hidden) onViolationRef.current('tab_switch'); };
    const onBlur        = () => onViolationRef.current('focus_lost');
    const onKeyDown     = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key)) ||
        (e.ctrlKey && ['u', 'U', 'p', 'P', 's', 'S'].includes(e.key))
      ) {
        e.preventDefault();
        onViolationRef.current('devtools_attempt');
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
  }, [active, sessionId]);
}

// ─── Timer hook ────────────────────────────────────────────────────────────────
function useCountdownTimer(
  durationSeconds: number,
  active: boolean,
  onExpire: () => void
): number {
  const [remaining, setRemaining] = useState(durationSeconds);
  const expiredRef    = useRef(false);
  const onExpireRef   = useRef(onExpire);
  const activeRef     = useRef(active);

  useEffect(() => { onExpireRef.current = onExpire; }, [onExpire]);
  useEffect(() => { activeRef.current = active; }, [active]);

  // Reset when duration changes (new exam started)
  useEffect(() => {
    setRemaining(durationSeconds);
    expiredRef.current = false;
  }, [durationSeconds]);

  useEffect(() => {
    if (!active || durationSeconds <= 0) return;

    const tick = () => {
      setRemaining(prev => {
        const next = prev - 1;
        if (next <= 0 && !expiredRef.current) {
          expiredRef.current = true;
          // Call expire after state settles
          setTimeout(() => onExpireRef.current(), 0);
          return 0;
        }
        return Math.max(0, next);
      });
    };

    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [active, durationSeconds]);

  return remaining;
}

// ─── Attachment upload helper ──────────────────────────────────────────────────
async function uploadAttachment(file: File): Promise<string> {
  const result = await uploadService.uploadToSupabase(file, 'exam-answers');
  return result.url;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const ExamViewer: React.FC = () => {
  const { courseId, contentId } = useParams<{ courseId: string; contentId: string }>();
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user }  = useDashboard();

  // ── Core state ─────────────────────────────────────────────────────────────
  const [phase, setPhase]         = useState<Phase>('loading');
  const [content, setContent]     = useState<Content | null>(null);
  const [examStatus, setExamStatus] = useState<StudentExamStatus | null>(null);
  const [session, setSession]     = useState<ExamSession | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError]         = useState('');

  // ── Version state ──────────────────────────────────────────────────────────
  const [examVersions, setExamVersions]           = useState<ExamVersion[]>([]);
  const [selectedVersion, setSelectedVersion]     = useState<ExamVersion | null>(null);

  // ── Computed exam config (from selected version) ───────────────────────────
  const [mcqDurationSecs, setMcqDurationSecs]         = useState(0);
  const [writtenDurationSecs, setWrittenDurationSecs] = useState(0);

  // ── Questions ──────────────────────────────────────────────────────────────
  const [mcqQuestions, setMcqQuestions]         = useState<MCQQuestion[]>([]);
  const [writtenQuestions, setWrittenQuestions] = useState<WrittenQuestion[]>([]);

  // ── Exam UI ────────────────────────────────────────────────────────────────
  const [activePart, setActivePart]               = useState<'mcq' | 'written'>('mcq');
  const [mcqIndex, setMcqIndex]                   = useState(0);
  const [writtenIndex, setWrittenIndex]           = useState(0);
  const [mcqAnswers, setMcqAnswers]               = useState<MCQAnswer[]>([]);
  const [writtenAnswers, setWrittenAnswers]       = useState<WrittenAnswer[]>([]);
  const [mcqTimerActive, setMcqTimerActive]       = useState(false);
  const [writtenTimerActive, setWrittenTimerActive] = useState(false);
  const [startTime, setStartTime]                 = useState<number>(Date.now());
  const [submitting, setSubmitting]               = useState(false);

  // ── Attachments & lightbox ─────────────────────────────────────────────────
  const [uploadingFor, setUploadingFor]   = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl]     = useState<string | null>(null);
  const fileInputRef                       = useRef<HTMLInputElement>(null);

  // ── Anti-cheat violation toast ─────────────────────────────────────────────
  const [violationMsg, setViolationMsg]   = useState('');
  const violationTimerRef                  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Result publish polling ─────────────────────────────────────────────────
  const publishPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Auto-save interval ─────────────────────────────────────────────────────
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Refs for submit (avoid stale closures) ─────────────────────────────────
  const mcqAnswersRef     = useRef<MCQAnswer[]>([]);
  const writtenAnswersRef = useRef<WrittenAnswer[]>([]);
  const startTimeRef      = useRef<number>(Date.now());
  const submittingRef     = useRef(false);
  const sessionIdRef      = useRef<string | null>(null);
  const contentRef        = useRef<Content | null>(null);

  useEffect(() => { mcqAnswersRef.current = mcqAnswers; }, [mcqAnswers]);
  useEffect(() => { writtenAnswersRef.current = writtenAnswers; }, [writtenAnswers]);
  useEffect(() => { startTimeRef.current = startTime; }, [startTime]);
  useEffect(() => { submittingRef.current = submitting; }, [submitting]);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
  useEffect(() => { contentRef.current = content; }, [content]);

  // ─── Anti-cheat ─────────────────────────────────────────────────────────────
  const examActive = phase === 'mcq' || phase === 'written';

  const handleViolation = useCallback((type: string) => {
    const sid = sessionIdRef.current;
    if (!sid) return;
    examService.logAntiCheatEvent(sid, type);
    const msg =
      type === 'tab_switch'      ? '⚠️ Tab switch detected!' :
      type === 'focus_lost'      ? '⚠️ Window focus lost!' :
      type === 'right_click'     ? '⚠️ Right-click disabled.' :
      type === 'copy_attempt'    ? '⚠️ Copy/paste disabled.' :
      type === 'devtools_attempt'? '⚠️ DevTools blocked.' :
                                   '⚠️ Suspicious activity!';
    setViolationMsg(msg);
    if (violationTimerRef.current) clearTimeout(violationTimerRef.current);
    violationTimerRef.current = setTimeout(() => setViolationMsg(''), 3000);
  }, []);

  useAntiCheat(examActive, sessionId, handleViolation);

  // ─── Timers ──────────────────────────────────────────────────────────────────
  const handleMcqExpire = useCallback(() => {
    const c = contentRef.current;
    if (!c) return;
    // Detect exam type from selected version
    const hasMcq     = mcqQuestions.length > 0;
    const hasWritten = writtenQuestions.length > 0;
    if (hasMcq && hasWritten) {
      // Mixed: MCQ time up → move to written
      setMcqTimerActive(false);
      setActivePart('written');
      setWrittenTimerActive(true);
      setPhase('written');
    } else {
      // MCQ only
      submitExamInternal(true);
    }
  }, [mcqQuestions.length, writtenQuestions.length]);

  const handleWrittenExpire = useCallback(() => {
    submitExamInternal(true);
  }, []);

  const mcqRemaining     = useCountdownTimer(mcqDurationSecs, mcqTimerActive, handleMcqExpire);
  const writtenRemaining = useCountdownTimer(writtenDurationSecs, writtenTimerActive, handleWrittenExpire);
  const activeRemaining  = activePart === 'mcq' ? mcqRemaining : writtenRemaining;
  const timerWarning     = activeRemaining > 0 && activeRemaining < 120;
  const timerActive      = activePart === 'mcq' ? (mcqDurationSecs > 0) : (writtenDurationSecs > 0);

  // ─── Auto-save ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!examActive || !sessionId) return;
    autoSaveRef.current = setInterval(() => {
      const sid = sessionIdRef.current;
      if (!sid) return;
      const answers  = mcqAnswersRef.current;
      const wAnswers = writtenAnswersRef.current;
      const marks    = answers.reduce((s, a) => s + (a.marksAwarded ?? 0), 0);
      examService.saveMCQAnswers(sid, answers, marks).catch(() => {});
      if (wAnswers.length > 0) {
        examService.saveWrittenAnswers(sid, wAnswers).catch(() => {});
      }
    }, 30_000); // every 30s

    return () => { if (autoSaveRef.current) clearInterval(autoSaveRef.current); };
  }, [examActive, sessionId]);

  // ─── Cleanup on unmount ───────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (autoSaveRef.current)   clearInterval(autoSaveRef.current);
      if (publishPollRef.current) clearInterval(publishPollRef.current);
      if (violationTimerRef.current) clearTimeout(violationTimerRef.current);
    };
  }, []);

  // ─── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!contentId || !user) return;
    loadExam();
  }, [contentId, user]);

  const loadExam = async () => {
    try {
      setPhase('loading');
      setError('');

      // Always fetch fresh from DB — never trust location.state for exam data
      const c = await contentService.getContentById(contentId!);
      if (!c) { setError('Exam not found.'); return; }
      setContent(c);

      // Extract versions — THIS is the fix for blank questions
      const versions: ExamVersion[] = c.examVersions || [];
      setExamVersions(versions);

      const status = await examService.getStudentExamStatus(contentId!, user!.uid, courseId);
      setExamStatus(status);

      await determinePhase(c, status, versions);
    } catch (e: any) {
      setError(e.message || 'Failed to load exam.');
    }
  };

  const determinePhase = async (
    c: Content,
    status: StudentExamStatus | null,
    versions: ExamVersion[]
  ) => {
    // 1. Scheduled exam window check
    if (c.examTimelineType === 'scheduled') {
      const now   = Date.now();
      const start = c.examStartDateTime ? new Date(c.examStartDateTime).getTime() : 0;
      const end   = c.examEndDateTime   ? new Date(c.examEndDateTime).getTime()   : Infinity;

      if (now < start) {
        setPhase('scheduled_locked');
        return;
      }
      if (now > end) {
        if (!status || status.status === 'not_started') {
          await examService.markAbsent(c.id, user!.uid, courseId);
          setPhase('absent');
          return;
        }
      }
    }

    // 2. Hard blocks
    if (status?.status === 'absent') { setPhase('absent'); return; }
    if (status?.status === 'attempt_limit_reached') { setPhase('attempt_limit'); return; }

    // 3. Numeric attempt limit check
    if (c.maxAttempts && c.maxAttempts !== 'unlimited') {
      const used = status?.attemptCount ?? 0;
      if (used >= Number(c.maxAttempts)) {
        await examService.markAttemptLimitReached(c.id, user!.uid, courseId);
        setPhase('attempt_limit');
        return;
      }
    }

    // 4. Resume in-progress session
    if (status?.lastAttemptId && status.status === 'in_progress') {
      const sess = await examService.getExamSession(status.lastAttemptId);
      if (sess && sess.status === 'in_progress') {
        setSession(sess);
        setSessionId(sess.id);
        await restoreSession(c, sess, versions);
        return;
      }
    }

    // 5. Already completed → result visibility check
    if (status?.status === 'completed') {
      const lastSess = status.lastAttemptId
        ? await examService.getExamSession(status.lastAttemptId)
        : null;
      setSession(lastSess);

      if (checkResultVisible(c, lastSess)) {
        // Restore which questions were shown for results review
        if (lastSess) restoreQuestionsForResults(c, lastSess, versions);
        setPhase('results');
      } else {
        startResultPublishPolling(c, lastSess);
        setPhase('blocked');
      }
      return;
    }

    // 6. If only one version, skip the version picker
    if (versions.length <= 1) {
      setSelectedVersion(versions[0] || null);
      setPhase('directions');
    } else {
      setPhase('version_select');
    }
  };

  // Restore which questions were assigned in a previous session (for results display)
  const restoreQuestionsForResults = (c: Content, sess: ExamSession, versions: ExamVersion[]) => {
    // Find matching version or fall back to flat content questions
    const allMcq: MCQQuestion[]     = getAllMcqQuestions(c, versions);
    const allWritten: WrittenQuestion[] = getAllWrittenQuestions(c, versions);

    const mcq     = allMcq.filter(q => sess.mcqQuestionIds.includes(q.id));
    const written = allWritten.filter(q => sess.writtenQuestionIds.includes(q.id));
    setMcqQuestions(mcq.length > 0 ? mcq : allMcq);
    setWrittenQuestions(written.length > 0 ? written : allWritten);
  };

  // Flatten all MCQ questions across versions (or use legacy flat array)
  const getAllMcqQuestions = (c: Content, versions: ExamVersion[]): MCQQuestion[] => {
    if (versions.length > 0) {
      const all: MCQQuestion[] = [];
      versions.forEach(v => all.push(...(v.mcqQuestions || [])));
      return all;
    }
    return c.mcqQuestions || [];
  };

  const getAllWrittenQuestions = (c: Content, versions: ExamVersion[]): WrittenQuestion[] => {
    if (versions.length > 0) {
      const all: WrittenQuestion[] = [];
      versions.forEach(v => all.push(...(v.writtenQuestions || [])));
      return all;
    }
    return c.writtenQuestions || [];
  };

  // ─── Restore session (browser reload mid-exam) ──────────────────────────────
  const restoreSession = async (c: Content, sess: ExamSession, versions: ExamVersion[]) => {
    const allMcq     = getAllMcqQuestions(c, versions);
    const allWritten = getAllWrittenQuestions(c, versions);

    const mcq     = allMcq.filter(q => sess.mcqQuestionIds.includes(q.id));
    const written = allWritten.filter(q => sess.writtenQuestionIds.includes(q.id));

    setMcqQuestions(mcq);
    setWrittenQuestions(written);
    setMcqAnswers(sess.mcqAnswers.length > 0 ? sess.mcqAnswers : mcq.map(q => ({
      questionId: q.id, selectedOptions: [], isCorrect: false, marksAwarded: 0,
    })));
    setWrittenAnswers(sess.writtenAnswers.length > 0 ? sess.writtenAnswers : written.map(q => ({
      questionId: q.id, answerText: '', attachmentUrls: [],
    })));
    setStartTime(sess.startedAt.getTime());

    // Determine durations from version or content
    const ver = versions.find(v =>
      v.mcqQuestions.some(q => sess.mcqQuestionIds.includes(q.id)) ||
      v.writtenQuestions.some(q => sess.writtenQuestionIds.includes(q.id))
    ) || versions[0];

    const mcqDurMin     = ver?.mcqDuration     ?? c.mcqDuration     ?? 0;
    const writtenDurMin = ver?.writtenDuration  ?? c.writtenDuration ?? 0;

    // Calculate elapsed time
    const elapsedSecs = Math.floor((Date.now() - sess.startedAt.getTime()) / 1000);
    const mcqDurSecs     = Math.round(mcqDurMin * 60);
    const writtenDurSecs = Math.round(writtenDurMin * 60);

    const mcqRemainSecs     = Math.max(0, mcqDurSecs - elapsedSecs);
    const writtenRemainSecs = Math.max(0, writtenDurSecs - elapsedSecs);

    setMcqDurationSecs(mcqRemainSecs > 0 ? mcqRemainSecs : mcqDurSecs);
    setWrittenDurationSecs(writtenRemainSecs > 0 ? writtenRemainSecs : writtenDurSecs);

    const hasMcq     = mcq.length > 0;
    const hasWritten = written.length > 0;

    if (!hasMcq && hasWritten) {
      setActivePart('written');
      setWrittenTimerActive(writtenDurSecs > 0);
      setPhase('written');
    } else {
      setActivePart('mcq');
      setMcqTimerActive(mcqDurSecs > 0);
      setPhase('mcq');
    }
  };

  // ─── Result publish polling (blocked phase) ──────────────────────────────────
  const startResultPublishPolling = (c: Content, sess: ExamSession | null) => {
    if (c.resultPublishType === 'scheduled' && c.resultPublishDateTime) {
      const publishAt = new Date(c.resultPublishDateTime).getTime();
      publishPollRef.current = setInterval(async () => {
        if (Date.now() >= publishAt) {
          if (publishPollRef.current) clearInterval(publishPollRef.current);
          // Re-fetch session to get updated resultVisibility (teacher may have published manually)
          if (sess?.id) {
            const updated = await examService.getExamSession(sess.id);
            setSession(updated);
            if (checkResultVisible(c, updated)) {
              restoreQuestionsForResults(c, updated!, examVersions);
              setPhase('results');
            }
          }
        }
      }, 30_000); // check every 30s
    }
  };

  // ─── Version selection ───────────────────────────────────────────────────────
  const handleVersionSelect = (version: ExamVersion) => {
    setSelectedVersion(version);
    setPhase('directions');
  };

  // ─── Start exam ──────────────────────────────────────────────────────────────
  const startExam = async () => {
    if (!content || !user) return;
    const version = selectedVersion;

    try {
      setSubmitting(true);

      // Get question bank from version (if versions exist) or from content directly
      const rawMcq: MCQQuestion[] = version
        ? (version.mcqQuestions || [])
        : (content.mcqQuestions || []);
      const rawWritten: WrittenQuestion[] = version
        ? (version.writtenQuestions || [])
        : (content.writtenQuestions || []);

      // questionsToShow from version or content
      const mcqToShow     = version?.mcqQuestionsToShow     ?? content.mcqQuestionsToShow     ?? rawMcq.length;
      const writtenToShow = version?.writtenQuestionsToShow ?? content.writtenQuestionsToShow ?? rawWritten.length;

      // Build question sets (apply lock + shuffle)
      const mcqSet     = rawMcq.length > 0     ? buildQuestionSet(rawMcq, mcqToShow)         : [];
      const writtenSet = rawWritten.length > 0  ? buildQuestionSet(rawWritten, writtenToShow) : [];

      // Durations in seconds
      const mcqDurMin     = version?.mcqDuration     ?? content.mcqDuration     ?? 0;
      const writtenDurMin = version?.writtenDuration  ?? content.writtenDuration ?? 0;
      const mcqDurSecs    = Math.round(mcqDurMin * 60);
      const writtenDurSecs = Math.round(writtenDurMin * 60);

      // maxMarks = marks of questions actually shown
      const mcqMax     = mcqSet.reduce((s, q) => s + (q.correctMarks ?? 0), 0);
      const writtenMax = writtenSet.reduce((s, q) => s + (q.marks ?? 0), 0);
      const maxMarks   = mcqMax + writtenMax;

      const resultVisibility: 'visible' | 'hidden' =
        content.resultPublishType === 'immediate' ? 'visible' : 'hidden';

      const sid = await examService.startExamSession({
        contentId: content.id,
        courseId,
        studentId: user.uid,
        studentName: user.name || user.displayName || 'Student',
        studentEmail: user.email,
        mcqQuestionIds: mcqSet.map(q => q.id),
        writtenQuestionIds: writtenSet.map(q => q.id),
        maxMarks,
        resultVisibility,
      });

      setSessionId(sid);
      setMcqQuestions(mcqSet);
      setWrittenQuestions(writtenSet);
      setMcqAnswers(mcqSet.map(q => ({
        questionId: q.id, selectedOptions: [], isCorrect: false, marksAwarded: q.skipMarks ?? 0,
      })));
      setWrittenAnswers(writtenSet.map(q => ({
        questionId: q.id, answerText: '', attachmentUrls: [],
      })));
      setMcqDurationSecs(mcqDurSecs);
      setWrittenDurationSecs(writtenDurSecs);
      setStartTime(Date.now());
      setMcqIndex(0);
      setWrittenIndex(0);

      // Determine starting phase
      if (mcqSet.length > 0) {
        setActivePart('mcq');
        setMcqTimerActive(mcqDurSecs > 0);
        setPhase('mcq');
      } else {
        setActivePart('written');
        setWrittenTimerActive(writtenDurSecs > 0);
        setPhase('written');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to start exam.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── MCQ option selection ─────────────────────────────────────────────────────
  const selectOption = (qIndex: number, optionIndex: number) => {
    const q = mcqQuestions[qIndex];
    if (!q) return;

    const current = mcqAnswers[qIndex] || {
      questionId: q.id, selectedOptions: [], isCorrect: false, marksAwarded: 0,
    };

    // Single-select if only 1 correct answer, multi-select if multiple
    const isSingle = q.correctOptions.length <= 1;
    let newSelected: number[];

    if (isSingle) {
      newSelected = current.selectedOptions[0] === optionIndex ? [] : [optionIndex];
    } else {
      newSelected = current.selectedOptions.includes(optionIndex)
        ? current.selectedOptions.filter(o => o !== optionIndex)
        : [...current.selectedOptions, optionIndex];
    }

    const { isCorrect, marksAwarded } = calcMcqMarks(q, newSelected);
    const updated = [...mcqAnswers];
    updated[qIndex] = { questionId: q.id, selectedOptions: newSelected, isCorrect, marksAwarded };
    setMcqAnswers(updated);
  };

  // ─── Written answer change ────────────────────────────────────────────────────
  const changeWrittenAnswer = (qIndex: number, text: string) => {
    const updated = [...writtenAnswers];
    updated[qIndex] = { ...updated[qIndex], answerText: text };
    setWrittenAnswers(updated);
  };

  // ─── Attachment upload ────────────────────────────────────────────────────────
  const handleAttachmentUpload = async (qIndex: number, file: File) => {
    if (!sessionId) return;
    const qId = writtenQuestions[qIndex]?.id;
    if (!qId) return;
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
    const qId = writtenQuestions[qIndex]?.id;
    if (!qId) return;
    await examService.removeWrittenAttachment(sessionId, qId, url);
    const updated = [...writtenAnswers];
    updated[qIndex] = {
      ...updated[qIndex],
      attachmentUrls: (updated[qIndex].attachmentUrls || []).filter(u => u !== url),
    };
    setWrittenAnswers(updated);
  };

  // ─── Switch MCQ → Written ─────────────────────────────────────────────────────
  const switchToWritten = () => {
    setMcqTimerActive(false);
    // Save MCQ answers
    const sid = sessionIdRef.current;
    if (sid) {
      const answers = mcqAnswersRef.current;
      const marks   = answers.reduce((s, a) => s + (a.marksAwarded ?? 0), 0);
      examService.saveMCQAnswers(sid, answers, marks).catch(() => {});
    }
    setActivePart('written');
    setWrittenTimerActive(writtenDurationSecs > 0);
    setPhase('written');
  };

  // ─── Internal submit (used by timer expiry + manual submit) ──────────────────
  const submitExamInternal = useCallback(async (auto = false) => {
    if (submittingRef.current) return;
    const sid     = sessionIdRef.current;
    const c       = contentRef.current;
    if (!sid || !c || !user) return;

    submittingRef.current = true;
    setSubmitting(true);
    setMcqTimerActive(false);
    setWrittenTimerActive(false);
    if (autoSaveRef.current) clearInterval(autoSaveRef.current);

    try {
      const answers  = mcqAnswersRef.current;
      const wAnswers = writtenAnswersRef.current;
      const mcqMarks = answers.reduce((s, a) => s + (a.marksAwarded ?? 0), 0);
      const timeTaken = Math.floor((Date.now() - startTimeRef.current) / 1000);

      // Save written answers first
      if (wAnswers.length > 0) {
        await examService.saveWrittenAnswers(sid, wAnswers);
      }

      await examService.submitExamSession(sid, answers, wAnswers, mcqMarks, timeTaken, auto);

      const updatedSession = await examService.getExamSession(sid);
      setSession(updatedSession);

      const newStatus = await examService.getStudentExamStatus(contentId!, user.uid, courseId);
      setExamStatus(newStatus);

      if (checkResultVisible(c, updatedSession)) {
        restoreQuestionsForResults(c, updatedSession!, examVersions);
        setPhase('results');
      } else {
        startResultPublishPolling(c, updatedSession);
        setPhase('blocked');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to submit. Please try again.');
      setSubmitting(false);
      submittingRef.current = false;
    }
  }, [user, contentId, courseId, examVersions]);

  // Manual submit with confirmation
  const handleManualSubmit = () => {
    if (submitting) return;
    if (!window.confirm('Are you sure you want to submit? You cannot change answers after submission.')) return;
    submitExamInternal(false);
  };

  // ─── Question status helpers ──────────────────────────────────────────────────
  const mcqStatus = (i: number): 'answered' | 'skipped' | 'not_visited' => {
    const a = mcqAnswers[i];
    if (!a || a.selectedOptions === undefined) return 'not_visited';
    if (a.selectedOptions.length > 0) return 'answered';
    return 'skipped';
  };

  const writtenStatus = (i: number): 'answered' | 'not_visited' => {
    const a = writtenAnswers[i];
    if (!a) return 'not_visited';
    return (a.answerText?.trim() || (a.attachmentUrls?.length ?? 0) > 0) ? 'answered' : 'not_visited';
  };

  const mcqAnsweredCount     = mcqAnswers.filter(a => a.selectedOptions?.length > 0).length;
  const writtenAnsweredCount = writtenAnswers.filter(a =>
    (a.answerText?.trim()) || (a.attachmentUrls?.length ?? 0) > 0
  ).length;

  // ─── Derived exam type from loaded questions ──────────────────────────────────
  const hasMcqSection     = mcqQuestions.length > 0;
  const hasWrittenSection = writtenQuestions.length > 0;

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── RENDER PHASES ────────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Shell wrapper ────────────────────────────────────────────────────────────
  const Shell: React.FC<{ children: React.ReactNode; noPad?: boolean }> = ({ children, noPad }) => (
    <div className="min-h-screen bg-[#080a12] text-white select-none">
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 70% 35% at 50% -10%, rgba(244,63,94,0.08) 0%,transparent 65%)' }}
      />
      {noPad ? children : (
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-8">{children}</div>
      )}
    </div>
  );

  const BackBtn: React.FC = () => (
    <button
      onClick={() => navigate(-1)}
      className="flex items-center gap-2 text-sm text-white/40 hover:text-white mb-8 transition group"
    >
      <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
      Back
    </button>
  );

  // ── Loading ────────────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <Shell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          {error ? (
            <>
              <AlertCircle size={32} className="text-rose-400" />
              <p className="text-rose-300 text-center">{error}</p>
              <button
                onClick={loadExam}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/8 hover:bg-white/12 text-sm transition"
              >
                <RefreshCw size={14} /> Retry
              </button>
              <button onClick={() => navigate(-1)} className="text-sm text-white/30 hover:text-white">
                ← Go back
              </button>
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
  }

  // ── Scheduled Locked ──────────────────────────────────────────────────────────
  if (phase === 'scheduled_locked') {
    const start = content?.examStartDateTime ? new Date(content.examStartDateTime) : null;
    return (
      <Shell>
        <BackBtn />
        <div className="max-w-md mx-auto mt-12 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-8 text-center">
          <Lock size={40} className="text-amber-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Exam Not Started Yet</h2>
          <p className="text-white/50 text-sm">
            {start ? `Opens on ${start.toLocaleString()}` : 'Check back later.'}
          </p>
        </div>
      </Shell>
    );
  }

  // ── Absent ─────────────────────────────────────────────────────────────────────
  if (phase === 'absent') {
    return (
      <Shell>
        <BackBtn />
        <div className="max-w-md mx-auto mt-12 rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center">
          <XCircle size={40} className="text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Marked Absent</h2>
          <p className="text-white/50 text-sm">
            The exam window closed and you didn't attempt it. You've been marked absent.
          </p>
        </div>
      </Shell>
    );
  }

  // ── Attempt Limit ─────────────────────────────────────────────────────────────
  if (phase === 'attempt_limit') {
    return (
      <Shell>
        <BackBtn />
        <div className="max-w-md mx-auto mt-12 rounded-2xl border border-orange-500/20 bg-orange-500/5 p-8 text-center">
          <AlertCircle size={40} className="text-orange-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Attempt Limit Reached</h2>
          <p className="text-white/50 text-sm">
            You've used all {content?.maxAttempts} allowed attempt(s) for this exam.
          </p>
          {examStatus?.bestPercentage !== undefined && (
            <p className="text-white/40 text-sm mt-2">
              Best score: {examStatus.bestPercentage.toFixed(1)}%
            </p>
          )}
        </div>
      </Shell>
    );
  }

  // ── Blocked ────────────────────────────────────────────────────────────────────
  if (phase === 'blocked') {
    const publishAt = content?.resultPublishDateTime
      ? new Date(content.resultPublishDateTime).toLocaleString()
      : null;
    return (
      <Shell>
        <BackBtn />
        <div className="max-w-md mx-auto mt-12 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-8 text-center">
          <EyeOff size={40} className="text-indigo-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Exam Submitted!</h2>
          <p className="text-white/50 text-sm mb-4">
            {publishAt
              ? `Results will be published on ${publishAt}.`
              : 'Results will be published when the teacher releases them.'}
          </p>
          <span className="inline-block px-3 py-1 rounded-full bg-white/8 text-white/40 text-xs font-semibold uppercase tracking-widest">
            SUBMITTED
          </span>
          <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-white/25">
            <RefreshCw size={11} className="animate-spin" />
            Checking for results…
          </div>
        </div>
      </Shell>
    );
  }

  // ── Version Select ─────────────────────────────────────────────────────────────
  if (phase === 'version_select') {
    return (
      <Shell>
        <BackBtn />
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center">
              <Layers size={26} className="text-violet-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{content?.title}</h1>
              <p className="text-white/40 text-sm">Select your exam version</p>
            </div>
          </div>

          <div className="grid gap-3">
            {examVersions.map(version => {
              const mcqCount     = version.mcqQuestions?.length || 0;
              const writtenCount = version.writtenQuestions?.length || 0;
              const mcqShow      = version.mcqQuestionsToShow || mcqCount;
              const writtenShow  = version.writtenQuestionsToShow || writtenCount;
              const totalMarks   = version.mcqQuestions.reduce((s, q) => s + (q.correctMarks || 0), 0)
                                 + version.writtenQuestions.reduce((s, q) => s + (q.marks || 0), 0);
              return (
                <button
                  key={version.id}
                  onClick={() => handleVersionSelect(version)}
                  className="w-full text-left p-5 rounded-2xl border border-white/8 bg-white/3
                             hover:border-violet-500/40 hover:bg-violet-500/5 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-white group-hover:text-violet-300 transition">
                      {version.versionName}
                    </h3>
                    <ChevronRight size={16} className="text-white/30 group-hover:text-violet-400 transition" />
                  </div>
                  <div className="flex gap-4 mt-2 text-xs text-white/40">
                    {mcqCount > 0 && <span>MCQ: {mcqShow}/{mcqCount} shown</span>}
                    {writtenCount > 0 && <span>Written: {writtenShow}/{writtenCount} shown</span>}
                    {version.mcqDuration ? <span>MCQ: {fmtMin(version.mcqDuration)}</span> : null}
                    {version.writtenDuration ? <span>Written: {fmtMin(version.writtenDuration)}</span> : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </Shell>
    );
  }

  // ── Directions ─────────────────────────────────────────────────────────────────
  if (phase === 'directions') {
    const version = selectedVersion;
    const mcqDurMin     = version?.mcqDuration     ?? content?.mcqDuration     ?? 0;
    const writtenDurMin = version?.writtenDuration  ?? content?.writtenDuration ?? 0;
    const mcqDir        = version?.mcqDirection     ?? content?.mcqDirection    ?? '';
    const writtenDir    = version?.writtenDirection ?? content?.writtenDirection ?? '';
    const mcqShow       = version?.mcqQuestionsToShow   ?? content?.mcqQuestionsToShow   ?? 0;
    const writtenShow   = version?.writtenQuestionsToShow ?? content?.writtenQuestionsToShow ?? 0;
    const mcqTotal      = version?.mcqQuestions.length  ?? content?.mcqQuestions?.length  ?? 0;
    const writtenTotal  = version?.writtenQuestions.length ?? content?.writtenQuestions?.length ?? 0;

    const totalQShow    = (mcqShow || mcqTotal) + (writtenShow || writtenTotal);
    const attemptCount  = examStatus?.attemptCount ?? 0;
    const maxAtt        = content?.maxAttempts;
    const attemptsLeft  = maxAtt === 'unlimited' ? null : Math.max(0, Number(maxAtt || 1) - attemptCount);

    return (
      <div className="min-h-screen bg-[#080a12] text-white">
        <div
          className="fixed inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 70% 35% at 50% -10%, rgba(244,63,94,0.08) 0%,transparent 65%)' }}
        />
        <div className="relative max-w-3xl mx-auto px-4 py-8">
          {/* Back */}
          <button
            onClick={() => examVersions.length > 1 ? setPhase('version_select') : navigate(-1)}
            className="flex items-center gap-2 text-sm text-white/40 hover:text-white mb-8 transition group"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
            {examVersions.length > 1 ? 'Change Version' : 'Back'}
          </button>

          {/* Header */}
          <div className="flex items-start gap-4 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/20 flex items-center justify-center shrink-0">
              <ClipboardList size={26} className="text-rose-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{content?.title}</h1>
              <p className="text-white/40 text-sm mt-0.5">{content?.subject}</p>
              {version && (
                <span className="inline-block mt-1.5 px-2.5 py-0.5 rounded-full bg-violet-500/15 text-violet-300 text-xs font-medium">
                  {version.versionName}
                </span>
              )}
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {[
              { label: 'Total Marks', value: content?.totalMarks ?? '—' },
              { label: 'Questions', value: totalQShow || '—' },
              { label: 'Type', value: content?.examType?.toUpperCase() ?? '—' },
              { label: 'Attempts Left', value: attemptsLeft === null ? '∞' : String(attemptsLeft) },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-2xl bg-white/4 border border-white/8 p-4 text-center">
                <p className="text-lg font-bold text-white">{value}</p>
                <p className="text-[11px] text-white/35 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Timers */}
          <div className="flex flex-wrap gap-3 mb-8">
            {mcqDurMin > 0 && (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <Clock size={14} className="text-rose-400" />
                <span className="text-sm text-rose-300">MCQ: {fmtMin(mcqDurMin)}</span>
              </div>
            )}
            {writtenDurMin > 0 && (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20">
                <Clock size={14} className="text-violet-400" />
                <span className="text-sm text-violet-300">Written: {fmtMin(writtenDurMin)}</span>
              </div>
            )}
            {content?.examTimelineType === 'scheduled' && content.examEndDateTime && (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle size={14} className="text-amber-400" />
                <span className="text-sm text-amber-300">
                  Closes: {new Date(content.examEndDateTime).toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* Section instructions */}
          {(mcqDir || writtenDir) && (
            <div className="space-y-4 mb-8">
              {mcqDir && (
                <div className="rounded-2xl bg-white/3 border border-white/8 p-5">
                  <p className="text-[11px] uppercase tracking-widest text-rose-400 font-semibold mb-3">
                    MCQ Instructions
                  </p>
                  <p className="text-white/70 text-sm leading-relaxed whitespace-pre-wrap">{mcqDir}</p>
                </div>
              )}
              {writtenDir && (
                <div className="rounded-2xl bg-white/3 border border-white/8 p-5">
                  <p className="text-[11px] uppercase tracking-widest text-violet-400 font-semibold mb-3">
                    Written Instructions
                  </p>
                  <p className="text-white/70 text-sm leading-relaxed whitespace-pre-wrap">{writtenDir}</p>
                </div>
              )}
            </div>
          )}

          {/* Marking scheme */}
          {(mcqTotal > 0) && (
            <div className="rounded-2xl bg-white/3 border border-white/8 p-5 mb-8">
              <p className="text-[11px] uppercase tracking-widest text-white/40 font-semibold mb-3">
                MCQ Marking Scheme
              </p>
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="text-emerald-400">✓ Correct: +marks per question</span>
                <span className="text-red-400">✗ Wrong: -marks (negative marking)</span>
                <span className="text-white/40">— Skip: 0 marks</span>
              </div>
            </div>
          )}

          {/* Anti-cheat notice */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/8 border border-amber-500/15 mb-8">
            <Shield size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <p className="text-amber-200/80 text-sm leading-relaxed">
              This exam is monitored. Tab switching, right-clicking, copy/paste, and DevTools are logged.
              {mcqDurMin > 0 || writtenDurMin > 0
                ? ' Auto-submission occurs when the timer runs out.'
                : ''}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Start */}
          <button
            onClick={startExam}
            disabled={submitting}
            className="flex items-center gap-3 px-8 py-3.5 rounded-2xl bg-rose-500 hover:bg-rose-600
                       text-white font-bold text-base transition disabled:opacity-50 shadow-lg
                       shadow-rose-500/20"
          >
            {submitting
              ? <><Loader2 size={18} className="animate-spin" /> Starting…</>
              : <><ClipboardList size={18} /> Start Exam</>
            }
          </button>
        </div>
      </div>
    );
  }

  // ── MCQ Exam Phase ────────────────────────────────────────────────────────────
  if (phase === 'mcq') {
    const q = mcqQuestions[mcqIndex];

    return (
      <Shell noPad>
        {/* Violation toast */}
        {violationMsg && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2
                          px-4 py-2.5 bg-red-500/95 backdrop-blur rounded-xl text-white text-sm
                          font-medium shadow-xl animate-bounce">
            <Shield size={14} /> {violationMsg}
          </div>
        )}

        {/* Top bar */}
        <div className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3
                        bg-[#080a12]/95 backdrop-blur border-b border-white/6">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white/40 truncate">{content?.title}</p>
            <p className="text-sm font-semibold text-white">
              MCQ — Q {mcqIndex + 1} / {mcqQuestions.length}
              <span className="text-white/30 ml-2 text-xs font-normal">
                ({mcqAnsweredCount} answered)
              </span>
            </p>
          </div>

          {/* Timer */}
          {mcqDurationSecs > 0 && (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-mono font-bold
                             ${timerWarning && activePart === 'mcq'
                               ? 'bg-red-500/20 text-red-300 animate-pulse'
                               : 'bg-white/6 text-white'}`}>
              <Clock size={13} />
              {fmt(mcqRemaining)}
            </div>
          )}

          {/* Switch to written */}
          {hasWrittenSection && (
            <button
              onClick={switchToWritten}
              className="text-xs px-3 py-1.5 rounded-lg bg-violet-500/15 border border-violet-500/20
                         text-violet-300 hover:bg-violet-500/25 transition whitespace-nowrap"
            >
              Written →
            </button>
          )}

          <button
            onClick={handleManualSubmit}
            disabled={submitting}
            className="px-4 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-sm
                       font-medium transition disabled:opacity-50 whitespace-nowrap"
          >
            {submitting ? <Loader2 size={14} className="animate-spin inline" /> : 'Submit'}
          </button>
        </div>

        <div className="flex h-[calc(100vh-57px)]">
          {/* Question navigator */}
          <div className="hidden lg:flex flex-col w-52 border-r border-white/6 bg-[#0a0c14] p-3 gap-2 overflow-y-auto shrink-0">
            <p className="text-[10px] uppercase tracking-widest text-white/25 px-1 mb-1">Navigator</p>
            <div className="grid grid-cols-5 gap-1">
              {mcqQuestions.map((_, i) => {
                const st = mcqStatus(i);
                return (
                  <button
                    key={i}
                    onClick={() => setMcqIndex(i)}
                    className={`w-8 h-8 rounded text-[11px] font-medium transition
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
            <div className="mt-auto space-y-1.5 pt-4 text-xs border-t border-white/6">
              <div className="flex items-center gap-2 text-white/40">
                <span className="w-3 h-3 rounded-sm bg-emerald-500/30 shrink-0" />
                Answered ({mcqAnsweredCount})
              </div>
              <div className="flex items-center gap-2 text-white/40">
                <span className="w-3 h-3 rounded-sm bg-amber-500/20 shrink-0" />
                Visited ({mcqAnswers.filter(a => a.selectedOptions?.length === 0).length})
              </div>
              <div className="flex items-center gap-2 text-white/40">
                <span className="w-3 h-3 rounded-sm bg-white/6 shrink-0" />
                Not visited ({mcqQuestions.length - mcqAnswers.filter(a => a !== undefined).length})
              </div>
            </div>
          </div>

          {/* Question content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-8">
            {q ? (
              <div className="max-w-2xl mx-auto">
                {/* Question header */}
                <div className="mb-6">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="text-[11px] uppercase tracking-wider text-rose-400 font-semibold">
                      Question {mcqIndex + 1}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-white/6 text-white/40">
                      +{q.correctMarks} / -{q.wrongMarks ?? 0} marks
                    </span>
                    {q.correctOptions.length > 1 && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-violet-500/15 text-violet-300">
                        Multiple correct answers
                      </span>
                    )}
                    {q.isLocked && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400">
                        <Lock size={9} className="inline mr-1" />Fixed
                      </span>
                    )}
                  </div>
                  <p className="text-white text-[15px] leading-relaxed">{q.question}</p>
                  {q.questionImage && (
                    <img
                      src={q.questionImage}
                      alt="question"
                      className="mt-3 max-h-60 rounded-xl object-contain cursor-pointer"
                      onClick={() => setLightboxUrl(q.questionImage!)}
                    />
                  )}
                </div>

                {/* Options */}
                <div className="space-y-2.5 mb-8">
                  {q.options.map((opt, oIdx) => {
                    const selected = mcqAnswers[mcqIndex]?.selectedOptions?.includes(oIdx) ?? false;
                    const isMulti  = q.correctOptions.length > 1;
                    return (
                      <button
                        key={oIdx}
                        onClick={() => selectOption(mcqIndex, oIdx)}
                        className={`w-full text-left flex items-start gap-3 px-4 py-3.5 rounded-2xl border
                                    transition-all duration-150 text-sm
                                    ${selected
                                      ? 'border-rose-400/60 bg-rose-500/12 text-white'
                                      : 'border-white/8 bg-white/3 text-white/70 hover:border-white/18 hover:bg-white/6'}`}
                      >
                        {/* Radio or Checkbox indicator */}
                        <span className={`flex-shrink-0 w-5 h-5 ${isMulti ? 'rounded' : 'rounded-full'}
                                          border-2 flex items-center justify-center mt-0.5 transition
                                          ${selected ? 'border-rose-400 bg-rose-400' : 'border-white/25'}`}>
                          {selected && <Check size={10} className="text-white" strokeWidth={3} />}
                        </span>
                        <span className="flex-1 leading-relaxed">{opt}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Live marks indicator */}
                {mcqAnswers[mcqIndex] && (
                  <div className={`text-xs mb-6 px-3 py-1.5 rounded-lg inline-block
                    ${(mcqAnswers[mcqIndex].marksAwarded ?? 0) > 0
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : (mcqAnswers[mcqIndex].marksAwarded ?? 0) < 0
                      ? 'bg-red-500/10 text-red-400'
                      : 'bg-white/5 text-white/30'}`}>
                    This question: {(mcqAnswers[mcqIndex].marksAwarded ?? 0) >= 0 ? '+' : ''}
                    {mcqAnswers[mcqIndex].marksAwarded ?? 0} marks
                  </div>
                )}

                {/* Navigation */}
                <div className="flex items-center justify-between pt-2 border-t border-white/6">
                  <button
                    onClick={() => setMcqIndex(p => Math.max(0, p - 1))}
                    disabled={mcqIndex === 0}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10
                               disabled:opacity-30 text-sm transition"
                  >
                    <ChevronLeft size={15} /> Prev
                  </button>

                  <span className="text-xs text-white/25">
                    {mcqIndex + 1} / {mcqQuestions.length}
                  </span>

                  {mcqIndex < mcqQuestions.length - 1 ? (
                    <button
                      onClick={() => setMcqIndex(p => p + 1)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-500/20
                                 hover:bg-rose-500/30 text-rose-300 text-sm transition"
                    >
                      Next <ChevronRight size={15} />
                    </button>
                  ) : hasWrittenSection ? (
                    <button
                      onClick={switchToWritten}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-500/20
                                 hover:bg-violet-500/30 text-violet-300 text-sm transition"
                    >
                      Written <ChevronRight size={15} />
                    </button>
                  ) : (
                    <button
                      onClick={handleManualSubmit}
                      className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm transition"
                    >
                      Submit
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-white/30">
                No questions available.
              </div>
            )}
          </div>
        </div>

        {/* Lightbox */}
        {lightboxUrl && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur"
            onClick={() => setLightboxUrl(null)}
          >
            <img src={lightboxUrl} alt="enlarged" className="max-w-4xl max-h-[90vh] object-contain rounded-2xl" />
            <button className="absolute top-4 right-4 text-white/60 hover:text-white">
              <X size={24} />
            </button>
          </div>
        )}
      </Shell>
    );
  }

  // ── Written Exam Phase ────────────────────────────────────────────────────────
  if (phase === 'written') {
    const wq = writtenQuestions[writtenIndex];
    const wa = writtenAnswers[writtenIndex] || { questionId: wq?.id, answerText: '', attachmentUrls: [] };

    return (
      <Shell noPad>
        {violationMsg && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2
                          px-4 py-2.5 bg-red-500/95 backdrop-blur rounded-xl text-white text-sm
                          font-medium shadow-xl">
            <Shield size={14} /> {violationMsg}
          </div>
        )}

        {/* Lightbox */}
        {lightboxUrl && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur"
            onClick={() => setLightboxUrl(null)}
          >
            <img src={lightboxUrl} alt="enlarged" className="max-w-4xl max-h-[90vh] object-contain rounded-2xl" />
          </div>
        )}

        {/* Hidden file input */}
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

        {/* Header */}
        <div className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3
                        bg-[#080a12]/95 backdrop-blur border-b border-white/6">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white/40 truncate">{content?.title}</p>
            <p className="text-sm font-semibold text-white">
              Written — Q {writtenIndex + 1} / {writtenQuestions.length}
              <span className="text-white/30 ml-2 text-xs font-normal">
                ({writtenAnsweredCount} answered)
              </span>
            </p>
          </div>

          {writtenDurationSecs > 0 && (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-mono font-bold
                             ${timerWarning && activePart === 'written'
                               ? 'bg-red-500/20 text-red-300 animate-pulse'
                               : 'bg-white/6 text-white'}`}>
              <Clock size={13} />
              {fmt(writtenRemaining)}
            </div>
          )}

          <button
            onClick={handleManualSubmit}
            disabled={submitting}
            className="px-4 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-sm
                       font-medium transition disabled:opacity-50"
          >
            {submitting ? <Loader2 size={14} className="animate-spin inline" /> : 'Submit'}
          </button>
        </div>

        <div className="flex h-[calc(100vh-57px)]">
          {/* Sidebar navigator */}
          <div className="hidden lg:flex flex-col w-52 border-r border-white/6 bg-[#0a0c14] p-3 gap-2 overflow-y-auto shrink-0">
            <p className="text-[10px] uppercase tracking-widest text-white/25 px-1 mb-1">Navigator</p>
            <div className="grid grid-cols-5 gap-1">
              {writtenQuestions.map((_, i) => {
                const st = writtenStatus(i);
                return (
                  <button
                    key={i}
                    onClick={() => setWrittenIndex(i)}
                    className={`w-8 h-8 rounded text-[11px] font-medium transition
                      ${writtenIndex === i ? 'ring-2 ring-violet-400' : ''}
                      ${st === 'answered' ? 'bg-emerald-500/30 text-emerald-300' : 'bg-white/6 text-white/40'}`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
            <div className="mt-auto pt-4 text-xs text-white/40 border-t border-white/6">
              {writtenAnsweredCount}/{writtenQuestions.length} answered
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-8">
            {wq ? (
              <div className="max-w-2xl mx-auto space-y-5">
                {/* Question */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[11px] uppercase tracking-wider text-violet-400 font-semibold">
                      Question {writtenIndex + 1}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-violet-500/10 text-violet-400">
                      {wq.marks} marks
                    </span>
                  </div>
                  <p className="text-white text-[15px] leading-relaxed">{wq.question}</p>
                  {wq.questionImage && (
                    <img
                      src={wq.questionImage}
                      alt="question"
                      className="mt-3 max-h-60 rounded-xl object-contain cursor-pointer"
                      onClick={() => setLightboxUrl(wq.questionImage!)}
                    />
                  )}
                </div>

                {/* Text answer */}
                <div>
                  <p className="text-[11px] text-white/40 mb-2 uppercase tracking-wider">Your answer</p>
                  <textarea
                    value={wa.answerText || ''}
                    onChange={e => changeWrittenAnswer(writtenIndex, e.target.value)}
                    placeholder="Type your answer here…"
                    rows={7}
                    className="w-full bg-white/4 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm
                               placeholder-white/20 focus:outline-none focus:border-violet-400/50 resize-none
                               leading-relaxed transition select-text"
                    style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
                    onCopy={e => e.stopPropagation()}
                    onCut={e => e.stopPropagation()}
                    onContextMenu={e => e.stopPropagation()}
                  />
                </div>

                {/* Attachments */}
                <div>
                  <p className="text-[11px] text-white/40 mb-2 uppercase tracking-wider">
                    Attach photos (optional)
                  </p>
                  {(wa.attachmentUrls || []).length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {(wa.attachmentUrls || []).map((url, ui) => (
                        <div key={ui} className="relative group">
                          <img
                            src={url}
                            alt={`attachment ${ui + 1}`}
                            className="w-24 h-24 object-cover rounded-xl border border-white/10 cursor-pointer"
                            onClick={() => setLightboxUrl(url)}
                          />
                          <button
                            onClick={() => removeAttachment(writtenIndex, url)}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500
                                       flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                          >
                            <X size={10} className="text-white" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFor === wq.id}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-white/15
                               hover:border-violet-400/40 hover:bg-violet-500/5 text-white/40 hover:text-white/60
                               text-sm transition disabled:opacity-50"
                  >
                    {uploadingFor === wq.id
                      ? <><Loader2 size={14} className="animate-spin" /> Uploading…</>
                      : <><Paperclip size={14} /> Attach photo</>
                    }
                  </button>
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-between pt-2 border-t border-white/6">
                  <button
                    onClick={() => setWrittenIndex(p => Math.max(0, p - 1))}
                    disabled={writtenIndex === 0}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10
                               disabled:opacity-30 text-sm transition"
                  >
                    <ChevronLeft size={15} /> Prev
                  </button>

                  <span className="text-xs text-white/25">{writtenIndex + 1} / {writtenQuestions.length}</span>

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
                      onClick={handleManualSubmit}
                      className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm transition"
                    >
                      Submit Exam
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-white/30">
                No written questions available.
              </div>
            )}
          </div>
        </div>
      </Shell>
    );
  }

  // ── Results Phase ──────────────────────────────────────────────────────────────
  if (phase === 'results' && session) {
    return (
      <ResultsPage
        content={content!}
        session={session}
        mcqQuestions={mcqQuestions}
        writtenQuestions={writtenQuestions}
        onBack={() => navigate(-1)}
      />
    );
  }

  // Fallback
  return (
    <Shell>
      <BackBtn />
      <div className="text-center py-20 text-white/30">Something went wrong. Please go back.</div>
    </Shell>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// RESULTS PAGE
// ═══════════════════════════════════════════════════════════════════════════════
const ResultsPage: React.FC<{
  content: Content;
  session: ExamSession;
  mcqQuestions: MCQQuestion[];
  writtenQuestions: WrittenQuestion[];
  onBack: () => void;
}> = ({ content, session, mcqQuestions, writtenQuestions, onBack }) => {
  const [tab, setTab] = useState<'overview' | 'mcq' | 'written'>('overview');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const fmt = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  const percentage = session.maxMarks > 0
    ? ((session.totalMarks / session.maxMarks) * 100).toFixed(1)
    : '0';

  const gradeColor =
    Number(percentage) >= 80 ? 'text-emerald-400' :
    Number(percentage) >= 60 ? 'text-amber-400' :
    Number(percentage) >= 40 ? 'text-orange-400' : 'text-red-400';

  const mcqMaxMarks     = mcqQuestions.reduce((s, q) => s + (q.correctMarks || 0), 0);
  const writtenMaxMarks = writtenQuestions.reduce((s, q) => s + (q.marks || 0), 0);

  const tabs = [
    { key: 'overview', label: 'Overview' },
    ...(mcqQuestions.length > 0 ? [{ key: 'mcq', label: 'MCQ Review' }] : []),
    ...(writtenQuestions.length > 0 ? [{ key: 'written', label: 'Written Review' }] : []),
  ] as { key: typeof tab; label: string }[];

  return (
    <div className="min-h-screen bg-[#080a12] text-white">
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 70% 35% at 50% -10%, rgba(16,185,129,0.07) 0%,transparent 65%)' }}
      />

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur"
          onClick={() => setLightboxUrl(null)}
        >
          <img src={lightboxUrl} alt="enlarged" className="max-w-4xl max-h-[90vh] object-contain rounded-2xl" />
        </div>
      )}

      <div className="relative max-w-4xl mx-auto px-4 py-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-white/40 hover:text-white mb-8 transition group"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
          Back to Library
        </button>

        {/* Score hero */}
        <div className="rounded-3xl bg-white/3 border border-white/8 p-8 mb-6 text-center">
          <p className="text-white/40 text-sm mb-1">{content.title}</p>
          <div className={`text-7xl font-black mb-2 ${gradeColor}`}>{percentage}%</div>
          <p className="text-white/40">
            {session.totalMarks} / {session.maxMarks} marks
          </p>
          {session.status === 'auto_submitted' && (
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full
                            bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
              <Clock size={11} /> Auto-submitted when time ran out
            </div>
          )}
          {session.writtenEvaluationPending && (
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full
                            bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
              <AlertTriangle size={11} /> Written evaluation pending — score may increase
            </div>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'MCQ Marks',    value: `${session.mcqMarks} / ${mcqMaxMarks}`,     color: 'text-rose-400',   icon: <ListChecks size={14} /> },
            { label: 'Written Marks',value: session.writtenEvaluationPending ? 'Pending' : `${session.writtenMarks} / ${writtenMaxMarks}`, color: 'text-violet-400', icon: <PenLine size={14} /> },
            { label: 'Time Taken',   value: fmt(session.timeTakenSeconds),               color: 'text-blue-400',   icon: <Clock size={14} /> },
            { label: 'Tab Switches', value: String(session.tabSwitchCount),              color: 'text-amber-400',  icon: <AlertTriangle size={14} /> },
          ].map(({ label, value, color, icon }) => (
            <div key={label} className="rounded-2xl bg-white/4 border border-white/8 p-4 text-center">
              <div className={`flex justify-center mb-1 ${color}`}>{icon}</div>
              <p className="text-base font-bold text-white">{value}</p>
              <p className="text-[11px] text-white/35">{label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-white/4 rounded-2xl border border-white/8 mb-6">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition
                          ${tab === t.key ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Overview tab */}
        {tab === 'overview' && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white/3 border border-white/8 p-6">
              <h3 className="font-semibold text-white mb-5">Performance Breakdown</h3>

              {mcqQuestions.length > 0 && (
                <div className="mb-5">
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-white/50">MCQ Score</span>
                    <span className="text-white font-medium">{session.mcqMarks} / {mcqMaxMarks}</span>
                  </div>
                  <div className="h-2.5 bg-white/8 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-rose-500 rounded-full transition-all duration-1000"
                      style={{ width: `${mcqMaxMarks > 0 ? Math.max(0, (session.mcqMarks / mcqMaxMarks) * 100) : 0}%` }}
                    />
                  </div>
                  {/* MCQ quick stats */}
                  <div className="flex gap-4 mt-2 text-xs text-white/35">
                    <span className="text-emerald-400">
                      ✓ {session.mcqAnswers.filter(a => a.isCorrect).length} correct
                    </span>
                    <span className="text-red-400">
                      ✗ {session.mcqAnswers.filter(a => !a.isCorrect && a.selectedOptions?.length > 0).length} wrong
                    </span>
                    <span>
                      — {session.mcqAnswers.filter(a => a.selectedOptions?.length === 0).length} skipped
                    </span>
                  </div>
                </div>
              )}

              {writtenQuestions.length > 0 && (
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-white/50">Written Score</span>
                    <span className="text-white font-medium">
                      {session.writtenEvaluationPending ? 'Pending evaluation' : `${session.writtenMarks} / ${writtenMaxMarks}`}
                    </span>
                  </div>
                  {!session.writtenEvaluationPending && (
                    <div className="h-2.5 bg-white/8 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-violet-500 rounded-full transition-all duration-1000"
                        style={{ width: `${writtenMaxMarks > 0 ? (session.writtenMarks / writtenMaxMarks) * 100 : 0}%` }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Suspicious activity log */}
            {session.suspiciousActivity?.length > 0 && (
              <div className="rounded-2xl bg-amber-500/6 border border-amber-500/15 p-5">
                <p className="text-amber-300 text-sm font-semibold mb-3 flex items-center gap-2">
                  <Shield size={14} /> Flagged Activity ({session.suspiciousActivity.length} events)
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

        {/* MCQ Review tab */}
        {tab === 'mcq' && (
          <div className="space-y-3">
            {session.mcqAnswers.length === 0 ? (
              <p className="text-white/30 text-center py-16">No MCQ answers recorded.</p>
            ) : (
              session.mcqAnswers.map((ans, i) => {
                const q = mcqQuestions.find(q => q.id === ans.questionId);
                if (!q) return null;
                return (
                  <div
                    key={i}
                    className={`rounded-2xl border p-5
                      ${ans.isCorrect
                        ? 'bg-emerald-500/5 border-emerald-500/15'
                        : ans.selectedOptions?.length === 0
                        ? 'bg-white/3 border-white/8'
                        : 'bg-red-500/5 border-red-500/15'}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 shrink-0">
                        {ans.isCorrect
                          ? <CheckCircle size={16} className="text-emerald-400" />
                          : ans.selectedOptions?.length === 0
                          ? <span className="w-4 h-4 rounded-full border-2 border-white/20 inline-block" />
                          : <XCircle size={16} className="text-red-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium mb-3 leading-relaxed">{q.question}</p>
                        {q.questionImage && (
                          <img
                            src={q.questionImage}
                            alt="question"
                            className="mb-3 max-h-32 rounded-lg object-contain cursor-pointer"
                            onClick={() => setLightboxUrl(q.questionImage!)}
                          />
                        )}
                        {/* Options */}
                        <div className="space-y-1 mb-3">
                          {q.options.map((opt, oi) => {
                            const userPicked  = ans.selectedOptions?.includes(oi);
                            const isCorrectOpt = q.correctOptions.includes(oi);
                            return (
                              <div
                                key={oi}
                                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm
                                            ${isCorrectOpt
                                              ? 'bg-emerald-500/15 text-emerald-300'
                                              : userPicked
                                              ? 'bg-red-500/15 text-red-300'
                                              : 'text-white/30'}`}
                              >
                                <span className="shrink-0 w-4">
                                  {isCorrectOpt ? <Check size={12} /> : userPicked ? <X size={12} /> : null}
                                </span>
                                {opt}
                              </div>
                            );
                          })}
                        </div>
                        {/* Solution */}
                        {q.solution && (
                          <div className="mt-3 pt-3 border-t border-white/8">
                            <p className="text-[10px] text-white/25 uppercase tracking-wider mb-1">Solution</p>
                            <p className="text-white/60 text-sm leading-relaxed">{q.solution}</p>
                            {q.solutionImage && (
                              <img
                                src={q.solutionImage}
                                alt="solution"
                                className="mt-2 max-h-32 rounded-lg object-contain cursor-pointer"
                                onClick={() => setLightboxUrl(q.solutionImage!)}
                              />
                            )}
                          </div>
                        )}
                        <div className="mt-2 text-right text-[11px] text-white/25">
                          {(ans.marksAwarded ?? 0) >= 0 ? '+' : ''}{ans.marksAwarded ?? 0} marks
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Written Review tab */}
        {tab === 'written' && (
          <div className="space-y-4">
            {session.writtenEvaluationPending && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/8 border border-amber-500/15">
                <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                <p className="text-amber-200/80 text-sm">
                  Written answers are pending teacher evaluation. Marks will appear once evaluated.
                </p>
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
                      <span className="text-sm font-bold text-emerald-400">
                        +{wa.marksAwarded} awarded
                      </span>
                    )}
                  </div>
                  <p className="text-white text-sm mb-4 leading-relaxed">{q.question}</p>
                  {q.questionImage && (
                    <img
                      src={q.questionImage}
                      alt="question"
                      className="mb-4 max-h-40 rounded-xl object-contain cursor-pointer"
                      onClick={() => setLightboxUrl(q.questionImage!)}
                    />
                  )}
                  {wa.answerText && (
                    <div className="bg-white/4 rounded-xl px-4 py-3 mb-3">
                      <p className="text-[10px] uppercase tracking-wider text-white/25 mb-1">Your answer</p>
                      <p className="text-white/70 text-sm whitespace-pre-wrap leading-relaxed">{wa.answerText}</p>
                    </div>
                  )}
                  {(wa.attachmentUrls || []).length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {wa.attachmentUrls!.map((url, ui) => (
                        <img
                          key={ui}
                          src={url}
                          alt={`attachment ${ui + 1}`}
                          className="h-28 object-cover rounded-xl border border-white/10 cursor-pointer"
                          onClick={() => setLightboxUrl(url)}
                        />
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
                      {q.solutionImage && (
                        <img
                          src={q.solutionImage}
                          alt="solution"
                          className="mt-2 max-h-40 rounded-xl object-contain cursor-pointer"
                          onClick={() => setLightboxUrl(q.solutionImage!)}
                        />
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
