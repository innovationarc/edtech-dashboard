// src/pages/ExamViewer.tsx
// Production-grade Exam Viewer — Complete rewrite
// Fixes: version questions blank bug, duration object vs decimal, stale closure on startExam,
//        marking rules, timer, result publish polling, attempt tracking, session resume

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Clock, AlertTriangle, CheckCircle, XCircle,
  Shield, EyeOff, X, ChevronLeft, ChevronRight,
  ClipboardList, PenLine, Check, AlertCircle,
  Paperclip, ZoomIn, Lock, Loader2, RefreshCw, Layers,
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
// questionsToShow INCLUDES locked ones.
// unlocked slots = questionsToShow - lockedCount
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
  // versions parsed from Firestore with decimal minute durations
  const [versions, setVersions]               = useState<ExamVersion[]>([]);
  // activeVersion holds the version the student selected/will use — stored in a ref
  // so startExam always sees the current value without stale closure issues
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
      setActivePart('written');
      setWrittenTimerOn(writtenDurSecs > 0);
      setPhase('written');
    } else {
      doSubmit(true);
    }
  }, [writtenQuestions.length, writtenDurSecs]);

  const writtenExpired = useCallback(() => doSubmit(true), []);

  const mcqRemaining     = useCountdown(mcqDurSecs, mcqTimerOn, mcqExpired);
  const writtenRemaining = useCountdown(writtenDurSecs, writtenTimerOn, writtenExpired);
  const activeRemaining  = activePart === 'mcq' ? mcqRemaining : writtenRemaining;
  const timerWarning     = activeRemaining > 0 && activeRemaining < 120;

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
    clearTimeout(violationTimerRef.current);
  }, []);

  // ─── Load ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (contentId && user) loadExam();
  }, [contentId, user]);

  const loadExam = async () => {
    try {
      setPhase('loading');
      setError('');

      const c = await contentService.getContentById(contentId!);
      if (!c) { setError('Exam not found.'); return; }
      setContent(c);
      contentRef.current = c;

      // Parse versions from Firestore — durations are already decimal minutes
      const rawVersions: ExamVersion[] = (c.examVersions || []).map((v: any) => ({
        id:                  v.id || '',
        versionName:         v.versionName || 'Version 1',
        mcqQuestions:        v.mcqQuestions || [],
        writtenQuestions:    v.writtenQuestions || [],
        mcqDuration:         typeof v.mcqDuration === 'number' ? v.mcqDuration : 0,
        writtenDuration:     typeof v.writtenDuration === 'number' ? v.writtenDuration : 0,
        mcqQuestionsToShow:  typeof v.mcqQuestionsToShow === 'number' ? v.mcqQuestionsToShow : (v.mcqQuestions?.length || 0),
        writtenQuestionsToShow: typeof v.writtenQuestionsToShow === 'number' ? v.writtenQuestionsToShow : (v.writtenQuestions?.length || 0),
        mcqDirection:        v.mcqDirection || '',
        writtenDirection:    v.writtenDirection || '',
      }));

      // Legacy fallback: no versions → build one from flat content fields
      if (rawVersions.length === 0) {
        rawVersions.push({
          id:                    'v1',
          versionName:           'Version 1',
          mcqQuestions:          c.mcqQuestions || [],
          writtenQuestions:      c.writtenQuestions || [],
          mcqDuration:           typeof c.mcqDuration === 'number' ? c.mcqDuration : 0,
          writtenDuration:       typeof c.writtenDuration === 'number' ? c.writtenDuration : 0,
          mcqQuestionsToShow:    c.mcqQuestionsToShow || (c.mcqQuestions?.length || 0),
          writtenQuestionsToShow:c.writtenQuestionsToShow || (c.writtenQuestions?.length || 0),
          mcqDirection:          c.mcqDirection || '',
          writtenDirection:      c.writtenDirection || '',
        });
      }

      setVersions(rawVersions);
      versionsRef.current = rawVersions;

      const status = await examService.getStudentExamStatus(contentId!, user!.uid, courseId);
      setExamStatus(status);

      await determinePhase(c, status, rawVersions);
    } catch (e: any) {
      setError(e.message || 'Failed to load exam.');
    }
  };

  const determinePhase = async (
    c: Content,
    status: StudentExamStatus | null,
    versionList: ExamVersion[]
  ) => {
    // 1. Scheduled window check
    if (c.examTimelineType === 'scheduled') {
      const now   = Date.now();
      const start = c.examStartDateTime ? new Date(c.examStartDateTime).getTime() : 0;
      const end   = c.examEndDateTime   ? new Date(c.examEndDateTime).getTime()   : Infinity;
      if (now < start) { setPhase('scheduled_locked'); return; }
      if (now > end && (!status || status.status === 'not_started')) {
        await examService.markAbsent(c.id, user!.uid, courseId);
        setPhase('absent'); return;
      }
    }

    if (status?.status === 'absent')              { setPhase('absent'); return; }
    if (status?.status === 'attempt_limit_reached') { setPhase('attempt_limit'); return; }

    // 2. Numeric attempt limit
    if (c.maxAttempts && c.maxAttempts !== 'unlimited') {
      if ((status?.attemptCount ?? 0) >= Number(c.maxAttempts)) {
        await examService.markAttemptLimitReached(c.id, user!.uid, courseId);
        setPhase('attempt_limit'); return;
      }
    }

    // 3. Resume in-progress session
    if (status?.lastAttemptId && status.status === 'in_progress') {
      const sess = await examService.getExamSession(status.lastAttemptId);
      if (sess?.status === 'in_progress') {
        setSession(sess);
        setSessionId(sess.id);
        sessionIdRef.current = sess.id;
        restoreSession(c, sess, versionList);
        return;
      }
    }

    // 4. Already completed
    if (status?.status === 'completed') {
      const lastSess = status.lastAttemptId
        ? await examService.getExamSession(status.lastAttemptId) : null;
      setSession(lastSess);
      if (lastSess) restoreQuestionsFromSession(lastSess, versionList);
      if (checkResultVisible(c, lastSess)) { setPhase('results'); }
      else { startPublishPoll(c, lastSess); setPhase('blocked'); }
      return;
    }

    // 5. Show version picker or directions
    if (versionList.length > 1) {
      setPhase('version_select');
    } else {
      setActiveVersion(versionList[0]);
      setPhase('directions');
    }
  };

  const setActiveVersion = (v: ExamVersion) => {
    activeVersionRef.current = v;
    setActiveVersionForUI(v);
  };

  // Restore questions from a previous session for results display
  const restoreQuestionsFromSession = (sess: ExamSession, versionList: ExamVersion[]) => {
    const allMcq: MCQQuestion[]         = versionList.flatMap(v => v.mcqQuestions);
    const allWritten: WrittenQuestion[] = versionList.flatMap(v => v.writtenQuestions);
    setMcqQuestions(allMcq.filter(q => sess.mcqQuestionIds.includes(q.id)));
    setWrittenQuestions(allWritten.filter(q => sess.writtenQuestionIds.includes(q.id)));
  };

  // Resume mid-exam session
  const restoreSession = (c: Content, sess: ExamSession, versionList: ExamVersion[]) => {
    const allMcq: MCQQuestion[]         = versionList.flatMap(v => v.mcqQuestions);
    const allWritten: WrittenQuestion[] = versionList.flatMap(v => v.writtenQuestions);

    const mcq     = allMcq.filter(q => sess.mcqQuestionIds.includes(q.id));
    const written = allWritten.filter(q => sess.writtenQuestionIds.includes(q.id));
    setMcqQuestions(mcq);
    setWrittenQuestions(written);
    setMcqAnswers(sess.mcqAnswers.length > 0 ? sess.mcqAnswers :
      mcq.map(q => ({ questionId: q.id, selectedOptions: [], isCorrect: false, marksAwarded: q.skipMarks ?? 0 })));
    setWrittenAnswers(sess.writtenAnswers.length > 0 ? sess.writtenAnswers :
      written.map(q => ({ questionId: q.id, answerText: '', attachmentUrls: [] })));
    setStartTime(sess.startedAt.getTime());
    startTimeRef.current = sess.startedAt.getTime();

    // Find which version these questions belong to
    const ver = versionList.find(v =>
      v.mcqQuestions.some(q => sess.mcqQuestionIds.includes(q.id)) ||
      v.writtenQuestions.some(q => sess.writtenQuestionIds.includes(q.id))
    ) || versionList[0];

    const elapsed    = Math.floor((Date.now() - sess.startedAt.getTime()) / 1000);
    const mcqTotal   = durToSecs(ver.mcqDuration);
    const wTotal     = durToSecs(ver.writtenDuration);
    const mcqLeft    = Math.max(0, mcqTotal - elapsed);
    const wLeft      = Math.max(0, wTotal - elapsed);

    setMcqDurSecs(mcqLeft > 0 ? mcqLeft : mcqTotal);
    setWrittenDurSecs(wLeft > 0 ? wLeft : wTotal);

    if (mcq.length > 0) {
      setActivePart('mcq');
      setMcqTimerOn(mcqTotal > 0);
      setPhase('mcq');
    } else {
      setActivePart('written');
      setWrittenTimerOn(wTotal > 0);
      setPhase('written');
    }
  };

  // ── Result publish polling ────────────────────────────────────────────────────
  const startPublishPoll = (c: Content, sess: ExamSession | null) => {
    if (c.resultPublishType !== 'scheduled' || !c.resultPublishDateTime) return;
    const publishAt = new Date(c.resultPublishDateTime).getTime();
    publishPollRef.current = setInterval(async () => {
      if (Date.now() < publishAt) return;
      clearInterval(publishPollRef.current);
      const updated = sess?.id ? await examService.getExamSession(sess.id) : null;
      setSession(updated);
      if (updated) restoreQuestionsFromSession(updated, versionsRef.current);
      setPhase(checkResultVisible(c, updated) ? 'results' : 'blocked');
    }, 30_000);
  };

  // ─── START EXAM ───────────────────────────────────────────────────────────────
  // CRITICAL: we use activeVersionRef.current — never state — to avoid stale closure
  const startExam = async () => {
    const ver = activeVersionRef.current;
    const c   = contentRef.current;
    if (!ver || !c || !user) {
      setError('Version not loaded. Please go back and try again.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      // Build question sets using version data
      const mcqSet     = buildQuestionSet(ver.mcqQuestions,     ver.mcqQuestionsToShow);
      const writtenSet = buildQuestionSet(ver.writtenQuestions,  ver.writtenQuestionsToShow);

      // Duration in seconds
      const mcqSecs    = durToSecs(ver.mcqDuration);
      const writtenSecs = durToSecs(ver.writtenDuration);

      // maxMarks = marks of questions actually shown
      const mcqMax     = mcqSet.reduce((s, q) => s + (q.correctMarks ?? 0), 0);
      const writtenMax = writtenSet.reduce((s, q) => s + (q.marks ?? 0), 0);

      const resultVisibility: 'visible' | 'hidden' =
        c.resultPublishType === 'immediate' ? 'visible' : 'hidden';

      const sid = await examService.startExamSession({
        contentId: c.id,
        courseId,
        studentId:    user.uid,
        studentName:  (user as any).name || (user as any).displayName || 'Student',
        studentEmail: (user as any).email,
        mcqQuestionIds:     mcqSet.map(q => q.id),
        writtenQuestionIds: writtenSet.map(q => q.id),
        maxMarks: mcqMax + writtenMax,
        resultVisibility,
      });

      // Set all state atomically before changing phase
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

  // ─── SWITCH MCQ → WRITTEN ─────────────────────────────────────────────────────
  const switchToWritten = () => {
    setMcqTimerOn(false);
    const sid = sessionIdRef.current;
    if (sid) {
      const a = mcqAnswersRef.current;
      examService.saveMCQAnswers(sid, a, a.reduce((s, x) => s + (x.marksAwarded ?? 0), 0)).catch(() => {});
    }
    setActivePart('written');
    setWrittenTimerOn(writtenDurSecs > 0);
    setPhase('written');
  };

  // ─── SUBMIT ───────────────────────────────────────────────────────────────────
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

    return (
      <div className="min-h-screen bg-[#080a12] text-white">
        <div className="fixed inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 70% 35% at 50% -10%,rgba(244,63,94,.08) 0%,transparent 65%)' }} />
        <div className="relative max-w-3xl mx-auto px-4 py-8">
          <BackBtn onClick={() => versions.length > 1 ? setPhase('version_select') : navigate(-1)} />

          {/* Header */}
          <div className="flex items-start gap-4 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/20 flex items-center justify-center shrink-0">
              <ClipboardList size={26} className="text-rose-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{content?.title}</h1>
              <p className="text-white/40 text-sm mt-0.5">{content?.subject}</p>
              {versions.length > 1 && (
                <span className="inline-block mt-1.5 px-2.5 py-0.5 rounded-full bg-violet-500/15 text-violet-300 text-xs font-medium">
                  {ver.versionName}
                </span>
              )}
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {[
              { label: 'Total Marks',   value: content?.totalMarks ?? '—' },
              { label: 'Questions',     value: totalToShow || '—' },
              { label: 'Type',          value: content?.examType?.toUpperCase() ?? '—' },
              { label: 'Attempts Left', value: attemptsLeft === null ? '∞' : String(attemptsLeft) },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-2xl bg-white/4 border border-white/8 p-4 text-center">
                <p className="text-lg font-bold">{value}</p>
                <p className="text-[11px] text-white/35 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Timers */}
          {(mcqDurFmt || writtenDurFmt) && (
            <div className="flex flex-wrap gap-3 mb-8">
              {hasMcq && mcqDurFmt && (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                  <Clock size={14} className="text-rose-400" />
                  <span className="text-sm text-rose-300">MCQ: {mcqDurFmt}</span>
                </div>
              )}
              {hasWritten && writtenDurFmt && (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20">
                  <Clock size={14} className="text-violet-400" />
                  <span className="text-sm text-violet-300">Written: {writtenDurFmt}</span>
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
          )}

          {/* Section instructions */}
          {(ver.mcqDirection || ver.writtenDirection) && (
            <div className="space-y-4 mb-8">
              {hasMcq && ver.mcqDirection && (
                <div className="rounded-2xl bg-white/3 border border-white/8 p-5">
                  <p className="text-[11px] uppercase tracking-widest text-rose-400 font-semibold mb-3">MCQ Instructions</p>
                  <p className="text-white/70 text-sm leading-relaxed whitespace-pre-wrap">{ver.mcqDirection}</p>
                </div>
              )}
              {hasWritten && ver.writtenDirection && (
                <div className="rounded-2xl bg-white/3 border border-white/8 p-5">
                  <p className="text-[11px] uppercase tracking-widest text-violet-400 font-semibold mb-3">Written Instructions</p>
                  <p className="text-white/70 text-sm leading-relaxed whitespace-pre-wrap">{ver.writtenDirection}</p>
                </div>
              )}
            </div>
          )}

          {/* MCQ marking scheme */}
          {hasMcq && (
            <div className="rounded-2xl bg-white/3 border border-white/8 p-5 mb-8">
              <p className="text-[11px] uppercase tracking-widest text-white/40 font-semibold mb-3">Marking Scheme</p>
              <div className="flex flex-wrap gap-5 text-sm">
                <span className="text-emerald-400">✓ Correct answer → +marks</span>
                <span className="text-red-400">✗ Wrong answer → -marks</span>
                <span className="text-white/40">— Skipped → 0 marks</span>
              </div>
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

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Start button */}
          <button onClick={startExam} disabled={submitting}
            className="flex items-center gap-3 px-8 py-3.5 rounded-2xl bg-rose-500 hover:bg-rose-600
                       text-white font-bold text-base transition disabled:opacity-50 shadow-lg shadow-rose-500/20">
            {submitting
              ? <><Loader2 size={18} className="animate-spin" /> Starting…</>
              : <><ClipboardList size={18} /> Start Exam</>}
          </button>
        </div>
      </div>
    );
  }

  // ── MCQ Phase ─────────────────────────────────────────────────────────────────
  if (phase === 'mcq') {
    const q = mcqQuestions[mcqIndex];
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
          {writtenQuestions.length > 0 && (
            <button onClick={switchToWritten}
              className="text-xs px-3 py-1.5 rounded-lg bg-violet-500/15 border border-violet-500/20
                         text-violet-300 hover:bg-violet-500/25 transition whitespace-nowrap">
              Written →
            </button>
          )}
          <button onClick={handleSubmit} disabled={submitting}
            className="px-4 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-sm font-medium transition disabled:opacity-50 whitespace-nowrap">
            {submitting ? <Loader2 size={14} className="animate-spin inline" /> : 'Submit'}
          </button>
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
                  ) : writtenQuestions.length > 0 ? (
                    <button onClick={switchToWritten}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 text-sm transition">
                      Written <ChevronRight size={15} />
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
    return (
      <ResultsPage
        content={content!} session={session}
        mcqQuestions={mcqQuestions} writtenQuestions={writtenQuestions}
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
// RESULTS PAGE
// ═══════════════════════════════════════════════════════════════════════════════
const ResultsPage: React.FC<{
  content: Content; session: ExamSession;
  mcqQuestions: MCQQuestion[]; writtenQuestions: WrittenQuestion[];
  onBack: () => void;
}> = ({ content, session, mcqQuestions, writtenQuestions, onBack }) => {
  const [tab, setTab] = useState<'overview' | 'mcq' | 'written'>('overview');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const fmtSecs = (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m ${ss}s`;
  };

  const pct         = session.maxMarks > 0 ? (session.totalMarks / session.maxMarks) * 100 : 0;
  const pctStr      = pct.toFixed(1);
  const gradeColor  = pct >= 80 ? 'text-emerald-400' : pct >= 60 ? 'text-amber-400' : pct >= 40 ? 'text-orange-400' : 'text-red-400';
  const mcqMax      = mcqQuestions.reduce((s, q) => s + (q.correctMarks || 0), 0);
  const writtenMax  = writtenQuestions.reduce((s, q) => s + (q.marks || 0), 0);

  const tabs = [
    { key: 'overview', label: 'Overview' },
    ...(mcqQuestions.length > 0      ? [{ key: 'mcq',     label: 'MCQ Review'     }] : []),
    ...(writtenQuestions.length > 0  ? [{ key: 'written', label: 'Written Review' }] : []),
  ] as { key: typeof tab; label: string }[];

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
        <div className="flex gap-1 p-1 bg-white/4 rounded-2xl border border-white/8 mb-6">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition
                ${tab === t.key ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'}`}>
              {t.label}
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
                              const userPicked   = ans.selectedOptions?.includes(oi);
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
      </div>
    </div>
  );
};

export default ExamViewer;
