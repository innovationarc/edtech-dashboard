// src/components/shared/StudyPlanEventModal.tsx
// Enhanced with AI Time Slots · Auto-Draft · Study Tips
// Uses admin-configured AI provider (Firestore aiModelConfig/current)

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Calendar, Clock, Target, Users, BookOpen, Check,
  Brain, Sparkles, Loader, AlertTriangle, Lightbulb,
  TrendingUp, CheckCircle2, Zap,
} from 'lucide-react';
import { format, addMinutes, parse } from 'date-fns';
import { StudyPlanEvent } from '../../services/studyPlanService';
import { aiStudyPlannerService, AITimeSlotSuggestion, AIEventDraft } from '../../services/aiStudyPlannerService';
import { aiModelConfigService, callProviderDirect, AIModelConfig } from '../../services/aiModelConfigService';
import { useDashboard } from '../../contexts/DashboardContext';

// ─── Theme helpers (exact copy from StudentStudyPlan.tsx) ─────────────────────

const hexRgb = (hex: string) => {
  if (!hex || hex.length < 7) return '99,102,241';
  return `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`;
};

const THEME_BG: Record<string, string> = {
  dark: '#0d1117', light: '#ebe8e1', slate: '#0f172a',
  ocean: '#0c1a2e', forest: '#0a1f14', purple: '#1e1b4b',
  pink: '#831843', sunset: '#1c0a00',
};

// ─── Props (100% backwards compatible with original) ──────────────────────────

interface StudyPlanEventModalProps {
  selectedDate: Date;
  currentUser: any;
  allStudents?: { uid: string; name: string; email: string }[];
  allCourses?: { id: string; title: string; instructorName?: string }[];
  onClose: () => void;
  onSave: (eventData: any) => void;
  isPersonalEvent: boolean;
  event?: any; // For editing existing events
  /** All student events — modal filters by formData.date to get same-day context */
  existingEvents?: { title: string; date: Date; startTime: string; endTime: string; eventType?: string }[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EVENT_TYPES = [
  { value: 'class',         label: 'Class',         emoji: '🏫' },
  { value: 'assignment',    label: 'Assignment',     emoji: '📋' },
  { value: 'exam',          label: 'Exam',           emoji: '🎯' },
  { value: 'study_session', label: 'Study Session',  emoji: '📚' },
  { value: 'deadline',      label: 'Deadline',       emoji: '⏰' },
  { value: 'personal',      label: 'Personal',       emoji: '📝' },
];

const ENERGY_STYLE: Record<string, string> = {
  peak:   'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  medium: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  low:    'bg-slate-500/20 text-slate-300 border-slate-500/40',
};
const ENERGY_ICON: Record<string, string> = { peak: '⚡', medium: '🔋', low: '🌙' };

function calcEnd(start: string, mins: number): string {
  try { return format(addMinutes(parse(start, 'HH:mm', new Date()), mins), 'HH:mm'); }
  catch { return start; }
}

// ─── Component ────────────────────────────────────────────────────────────────

const StudyPlanEventModal: React.FC<StudyPlanEventModalProps> = ({
  selectedDate, currentUser,
  allStudents = [], allCourses = [],
  onClose, onSave, isPersonalEvent, event,
  existingEvents = [],
}) => {
  const isEditing = !!event;

  // ── Theme tokens — exact match to StudentStudyPlan.tsx ──────────────────────
  const { theme, primaryColor, accentColor, glitterTheme } = useDashboard();
  const darkMode = theme !== 'light';
  const isLight = theme === 'light';
  const pRgb = hexRgb(primaryColor);
  const baseBg = THEME_BG[theme] ?? '#0d1117';

  const T = {
    text:         isLight ? '#111827' : '#f1f5f9',
    text2:        isLight ? '#6b7280' : '#94a3b8',
    text3:        isLight ? '#9ca3af' : '#475569',
    border:       isLight ? 'rgba(0,0,0,0.08)' : `rgba(${pRgb},0.15)`,
    divider:      isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.06)',
    inputBg:      isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)',
    inputBorder:  isLight ? 'rgba(0,0,0,0.10)' : `rgba(${pRgb},0.22)`,
    surface:      isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)',
    btnSecBg:     isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.07)',
    btnSecBorder: isLight ? 'rgba(0,0,0,0.09)' : 'rgba(255,255,255,0.09)',
    gradient:     `linear-gradient(135deg,${primaryColor} 0%,${accentColor} 100%)`,
    primaryColor, pRgb,
  };

  // ── ModalShell-equivalent vars (exact match to StudentStudyPlan.tsx) ─────────
  const sbSparkle = `radial-gradient(ellipse at 20% 20%, rgba(${pRgb},0.18) 0%, transparent 60%),
     radial-gradient(ellipse at 80% 80%, rgba(${pRgb},0.12) 0%, transparent 50%),
     radial-gradient(ellipse at 50% 50%, ${darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.55)'} 0%, transparent 70%)`;
  const sbBorder = darkMode ? `1px solid rgba(${pRgb},0.22)` : `1px solid rgba(255,255,255,0.95)`;
  const sbShadow = darkMode
    ? `0 8px 40px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(${pRgb},0.12), 0 0 60px rgba(${pRgb},0.06)`
    : `0 8px 32px rgba(0,0,0,0.10), inset 0 0 0 1px rgba(255,255,255,0.8), 0 0 40px rgba(${pRgb},0.07)`;

  // ── Form state ──────────────────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    title:           event?.title         || '',
    description:     event?.description   || '',
    date:            event?.date ? event.date.toISOString().slice(0, 10) : selectedDate.toISOString().slice(0, 10),
    startTime:       event?.startTime     || '09:00',
    endTime:         event?.endTime       || '10:00',
    course:          event?.course        || '',
    eventType:       event?.eventType     || (isPersonalEvent ? 'personal' : 'class'),
    priority:        event?.priority      || 'medium',
    targetAudience:  event?.targetAudience || (isPersonalEvent ? 'specific_student' : 'all'),
    targetStudentIds: event?.targetStudentIds || [] as string[],
    targetCourseIds:  event?.targetCourseIds  || [] as string[],
    reminderMinutes: event?.reminderMinutes   ?? 15,
    recurrence:      event?.recurrence        || 'none',
  });

  const setField = (key: string, value: any) =>
    setFormData(p => ({ ...p, [key]: value }));

  // ── AI config (loaded from Firestore — supports all providers) ──────────────
  const [aiConfig, setAiConfig] = useState<AIModelConfig | null>(null);
  const aiReady = !!aiConfig?.apiKey;

  useEffect(() => {
    aiModelConfigService.getConfig()
      .then(cfg => { if (cfg?.apiKey) setAiConfig(cfg); })
      .catch(() => {});
  }, []);

  // ── AI state ─────────────────────────────────────────────────────────────────
  const [aiPanel, setAiPanel]             = useState<'slots' | 'tips' | null>(null);
  const [slotsLoading, setSlotsLoading]   = useState(false);
  const [slots, setSlots]                 = useState<AITimeSlotSuggestion[]>([]);
  const [appliedSlot, setAppliedSlot]     = useState<AITimeSlotSuggestion | null>(null);
  const [tipsLoading, setTipsLoading]     = useState(false);
  const [tips, setTips]                   = useState<string[]>([]);
  const [tipsSource, setTipsSource]       = useState<'draft' | 'ai' | null>(null);
  const [draftLoading, setDraftLoading]   = useState(false);
  const [draft, setDraft]                 = useState<AIEventDraft | null>(null);
  const [draftApplied, setDraftApplied]   = useState(false);
  const [isSaving, setIsSaving]           = useState(false);
  const [slotsError, setSlotsError]       = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Auto-draft on title change ─────────────────────────────────────────────
  useEffect(() => {
    if (!formData.title || formData.title.length < 5 || !aiReady || draftApplied || isEditing) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setDraftLoading(true);
      try {
        const isRevision = /\b(revision|revise|review|recap|revisit|quick|brief|summary|summarize|overview)\b/i.test(formData.title);
        const prompt = `Suggest details for a study event titled "${formData.title}" (type: ${formData.eventType}, subject: ${formData.course || 'General'}).
Estimate session duration based on topic complexity and intent:
- Revision/review/recap sessions (re-reading known material): 20-45min
- Standard first-time study session: 60min  
- Complex/advanced/multi-part/mastering/deep-dive topics: 90-120min
${isRevision ? 'NOTE: This title contains revision/review keywords — prefer a shorter duration (20-45min) unless the scope is clearly large.' : ''}
Return ONLY valid JSON — no markdown, no explanation:
{"title":"improved title","description":"2-3 sentence description of what to cover in this session","priority":"low|medium|high","estimatedDuration":60,"suggestedPrep":["prep step 1","prep step 2"]}`;
        const raw = await callProviderDirect(prompt, aiConfig!, 400, 0.5);
        const cleaned = raw.replace(/```json|```/g, '').trim();
        const d: AIEventDraft = JSON.parse(cleaned);
        setDraft(d);
      } catch { /* silent */ } finally { setDraftLoading(false); }
    }, 900);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [formData.title, formData.eventType, formData.course, aiReady]);

  const applyDraft = () => {
    if (!draft) return;
    setFormData(p => ({
      ...p,
      title:       draft.title || p.title,
      description: draft.description || p.description,
      priority:    draft.priority,
      endTime:     calcEnd(p.startTime, draft.estimatedDuration),
    }));
    setTips(draft.suggestedPrep.length ? draft.suggestedPrep : tips);
    if (draft.suggestedPrep.length) setTipsSource('draft');
    setDraftApplied(true);
    setDraft(null);
  };

  const handleGetSlots = async () => {
    if (!aiReady) return;
    setSlotsLoading(true);
    setSlotsError(null);
    setSlots([]);
    setAiPanel('slots');
    try {
      // Always read duration from current form fields — reflects both draft-applied and manual edits
      const computedDuration = (() => {
        try {
          const [sh, sm] = formData.startTime.split(':').map(Number);
          const [eh, em] = formData.endTime.split(':').map(Number);
          const mins = (eh * 60 + em) - (sh * 60 + sm);
          return mins > 0 ? mins : 60;
        } catch { return 60; }
      })();

      // Filter existing events to the selected date (always correct even after manual date change)
      const sameDayEvents = existingEvents.filter(e => {
        try { return e.date.toISOString().slice(0, 10) === formData.date; } catch { return false; }
      }).sort((a, b) => a.startTime.localeCompare(b.startTime));

      const busyBlocks = sameDayEvents.length > 0
        ? sameDayEvents.map(e => `  ${e.startTime}–${e.endTime}: "${e.title}"${e.eventType ? ` (${e.eventType})` : ''}`).join('\n')
        : '  None — day is fully free';

      // Pre-compute free windows so the LLM can reason about actual gaps
      const toMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
      const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
      const freeWindows: string[] = [];
      if (sameDayEvents.length > 0) {
        let cursor = toMins('06:00');
        for (const ev of sameDayEvents) {
          const evStart = toMins(ev.startTime);
          if (evStart - cursor >= computedDuration + 15) freeWindows.push(`${toTime(cursor)}–${toTime(evStart)}`);
          cursor = Math.max(cursor, toMins(ev.endTime));
        }
        if (toMins('23:00') - cursor >= computedDuration) freeWindows.push(`${toTime(cursor)}–23:00`);
      }
      const freeContext = sameDayEvents.length === 0
        ? 'Entire day is free — pick slots based purely on energy level and topic type.'
        : freeWindows.length > 0
          ? `Free windows (≥${computedDuration}min gap + 15min buffer):\n${freeWindows.map(w => `  ${w}`).join('\n')}`
          : 'Day is heavily booked — suggest the best available gaps; set conflictWarning if tight.';

      const isRevision = /\b(revision|revise|review|recap|revisit|quick|brief|summary|summarize|overview)\b/i.test(formData.title);

      const prompt = `You are an expert study scheduler with full visibility of the student's day.

SESSION TO SCHEDULE
  Title: "${formData.title || 'Study Session'}"
  Subject: "${formData.course || 'General'}"
  Type: ${formData.eventType}
  Duration: ${computedDuration} minutes — every slot MUST span exactly ${computedDuration} minutes (startTime + ${computedDuration}min = endTime)
  Date: ${formData.date}
  Nature: ${isRevision ? 'REVISION/REVIEW — lower cognitive load, flexible timing, fits smaller gaps' : 'New/deep study — needs focused uninterrupted time, prefer peak windows'}

STUDENT'S SCHEDULE ON ${formData.date}
Already booked:
${busyBlocks}

${freeContext}

RULES
1. No slot may overlap any booked session; maintain ≥15min buffer before and after each existing session
2. Slots must be within 06:00–23:00
3. ${isRevision ? 'Revision: afternoon or evening slots are fine; peak morning not required' : 'Deep study: prioritise morning peak (07:00–10:00) first, then afternoon'}
4. Vary energy levels across the 4 suggestions so student has real choices
5. estimatedProductivity = time-of-day energy × topic fit (revision in evening can still score 75+)
6. In "reason", explicitly reference the day's schedule — mention why this gap works, what comes before/after
7. If a slot is tight (buffer < 20min from another session), set conflictWarning with a brief note

Return ONLY a valid JSON array of exactly 4 objects — no markdown, no explanation:
[{"date":"${formData.date}","startTime":"HH:MM","endTime":"HH:MM","reason":"2 sentences referencing the day schedule","energyLevel":"peak|medium|low","sessionType":"focus|review|practice","estimatedProductivity":85,"conflictWarning":null}]`;

      const raw = await callProviderDirect(prompt, aiConfig!, 1200, 0.5);
      const cleaned = raw.replace(/```json|```/g, '').trim();
      const parsed: AITimeSlotSuggestion[] = JSON.parse(cleaned);
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Model returned no time slots. Check your AI model settings or try again.');
      setSlots(parsed);
    } catch (err: any) {
      setSlotsError(err?.message || 'AI request failed. Check Admin > AI Model Settings.');
    } finally {
      setSlotsLoading(false);
    }
  };

  const handleGetTips = async () => {
    if (!aiReady) return;
    setTipsLoading(true);
    setAiPanel('tips');
    try {
      const subject = formData.course || formData.title || 'General';
      const prompt = `You are an expert academic coach specialising in ${subject}.
Generate 5 highly specific, detailed, and actionable study tips for: "${subject}" — session type: ${formData.eventType}.

STRICT RULES:
- Every tip MUST be directly relevant to ${subject}, not generic advice
- Reference concrete techniques used in this specific field (e.g., for mathematics: worked-example method; for history: causal chain mapping; for languages: spaced repetition with context sentences)
- Each tip must be 2–4 sentences: explain WHAT to do AND exactly HOW to do it
- Mention specific strategies, tools, or cognitive techniques appropriate for this discipline
- Do NOT include generic advice such as "take breaks", "stay organised", "review notes", or "get enough sleep"

Return ONLY a valid JSON array of 5 strings — no markdown, no explanation:
["full detailed tip 1", "full detailed tip 2", "full detailed tip 3", "full detailed tip 4", "full detailed tip 5"]`;

      const raw = await callProviderDirect(prompt, aiConfig!, 1000, 0.7);
      const cleaned = raw.replace(/```json|```/g, '').trim();
      const parsed: string[] = JSON.parse(cleaned);
      setTips(Array.isArray(parsed) ? parsed : []);
      if (Array.isArray(parsed) && parsed.length) setTipsSource('ai');
    } catch { /* silent */ } finally { setTipsLoading(false); }
  };

  const applySlot = (slot: AITimeSlotSuggestion) => {
    setFormData(p => ({ ...p, date: slot.date, startTime: slot.startTime, endTime: slot.endTime }));
    setAppliedSlot(slot);
    setAiPanel(null);
  };

  // ── Submit (same logic as original) ───────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || isSaving) return;
    setIsSaving(true);

    const eventData = {
      title:       formData.title.trim(),
      description: formData.description.trim(),
      date:        new Date(formData.date + 'T12:00:00'),
      startTime:   formData.startTime,
      endTime:     formData.endTime,
      course:      formData.course.trim(),
      eventType:   formData.eventType,
      priority:    formData.priority,
      isPersonal:  isPersonalEvent,
      reminderMinutes: formData.reminderMinutes,
      recurrence:  formData.recurrence,
      ...(isPersonalEvent ? {
        studentId:       currentUser.uid,
        instructorId:    currentUser.uid,
        instructorName:  currentUser.displayName || currentUser.name || '',
        targetAudience:  'specific_student',
        targetStudentIds: [currentUser.uid],
        targetCourseIds: [],
      } : {
        instructorId:    currentUser.uid,
        instructorName:  currentUser.displayName || currentUser.name || '',
        targetAudience:  formData.targetAudience,
        targetStudentIds: formData.targetAudience === 'specific_student' ? formData.targetStudentIds : [],
        targetCourseIds:  formData.targetAudience === 'course_students'  ? formData.targetCourseIds  : [],
      }),
    };

    try {
      await Promise.resolve(onSave(eventData));
    } finally {
      setIsSaving(false);
    }
  };

  // ── Input styles — exact match to StudentStudyPlan.tsx ────────────────────
  const inputCls = `w-full text-sm rounded-xl px-3 py-2.5 border focus:outline-none transition-colors placeholder-gray-500`;
  const inputStyle: React.CSSProperties = {
    background: T.inputBg,
    borderColor: T.inputBorder,
    color: T.text,
    fontFamily: "'Outfit', sans-serif",
  };
  const labelStyle: React.CSSProperties = { color: T.text2, fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6, fontFamily: "'Outfit',sans-serif" };

  // ─── Render ────────────────────────────────────────────────────────────────
  return createPortal(
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Shell — exact match to ModalShell in StudentStudyPlan.tsx */}
      <div
        className="w-full max-w-lg"
        style={{
          backgroundColor: baseBg,
          backgroundImage: sbSparkle,
          backdropFilter: 'blur(32px) saturate(200%)',
          WebkitBackdropFilter: 'blur(32px) saturate(200%)',
          border: sbBorder,
          borderRadius: 24,
          boxShadow: sbShadow,
          fontFamily: "'Outfit', sans-serif",
          position: 'relative',
          isolation: 'isolate',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Noise overlay */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none', zIndex: 0,
          background: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
          opacity: darkMode ? 0.04 : 0.025, mixBlendMode: 'overlay',
        }} />
        {/* Accent glow top */}
        <div style={{
          position: 'absolute', top: -30, left: '50%', transform: 'translateX(-50%)',
          width: 120, height: 120, borderRadius: '50%',
          background: `radial-gradient(circle, rgba(${pRgb},${darkMode ? 0.20 : 0.12}) 0%, transparent 70%)`,
          pointerEvents: 'none', zIndex: 0, filter: 'blur(20px)',
        }} />

        {/* Content wrapper — exact match to ModalShell children wrapper */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

          {/* ── HEADER (sticky, flexShrink:0) — matches reschedule modal header style */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px 14px', borderBottom: `1px solid ${T.divider}`, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `rgba(${pRgb},0.15)`, border: `1px solid rgba(${pRgb},0.25)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Calendar size={15} style={{ color: primaryColor }} />
              </div>
              <div>
                <h3 style={{ color: T.text, fontWeight: 700, fontSize: 15, margin: 0, fontFamily: "'Outfit',sans-serif" }}>
                  {isEditing ? 'Edit Event' : `${isPersonalEvent ? 'Personal ' : ''}Event`}
                </h3>
                <p style={{ color: T.text3, fontSize: 11, margin: '2px 0 0', fontFamily: "'Outfit',sans-serif" }}>
                  {isPersonalEvent ? 'Add a personal study event to your calendar' : 'Create an event for students'}
                  {aiReady && <span style={{ marginLeft: 6, color: primaryColor }}><Sparkles size={9} style={{ display: 'inline', verticalAlign: 'middle' }} /> AI Enhanced</span>}
                </p>
              </div>
            </div>
            <button onClick={onClose} style={{ padding: 6, color: T.text2, background: 'none', border: 'none', cursor: 'pointer', borderRadius: 8, display: 'flex' }}><X size={16} /></button>
          </div>

          {/* ── BODY (scrollable, flex:1) — matches reschedule modal body style */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <form id="study-event-form" onSubmit={handleSubmit} style={{ display: 'contents' }}>

            {/* AI Auto-Draft Banner */}
            {draft && !draftApplied && (
              <div style={{ borderRadius: 12, border: `1px solid rgba(${pRgb},0.30)`, background: `rgba(${pRgb},0.08)`, padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: `rgba(${pRgb},0.20)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Brain size={14} style={{ color: primaryColor }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: T.text, margin: '0 0 2px', fontFamily: "'Outfit',sans-serif" }}>AI Draft Ready</p>
                    <p style={{ fontSize: 11, color: T.text2, lineHeight: 1.5, margin: 0, fontFamily: "'Outfit',sans-serif" }}>
                      "{draft.title}" · {draft.estimatedDuration}min · {draft.priority} priority
                    </p>
                    {draft.suggestedPrep.length > 0 && (
                      <p style={{ fontSize: 11, color: T.text3, margin: '3px 0 0', fontFamily: "'Outfit',sans-serif" }}>Prep: {draft.suggestedPrep.slice(0, 2).join(' · ')}</p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button type="button" onClick={applyDraft}
                      style={{ fontSize: 11, background: primaryColor, color: '#fff', border: 'none', padding: '5px 10px', borderRadius: 8, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontFamily: "'Outfit',sans-serif" }}>
                      <Check size={10} /> Apply
                    </button>
                    <button type="button" onClick={() => setDraft(null)}
                      style={{ fontSize: 11, background: T.btnSecBg, border: `1px solid ${T.btnSecBorder}`, color: T.text2, padding: '5px 10px', borderRadius: 8, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
                      Skip
                    </button>
                  </div>
                </div>
              </div>
            )}

            {draftLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: primaryColor, background: `rgba(${pRgb},0.08)`, border: `1px solid rgba(${pRgb},0.18)`, borderRadius: 10, padding: '9px 14px', fontFamily: "'Outfit',sans-serif" }}>
                <Loader size={12} className="animate-spin" /> AI is drafting details…
              </div>
            )}

            {/* Title */}
            <div>
              <label style={labelStyle}>Title *</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text" value={formData.title} required
                  onChange={e => setField('title', e.target.value)}
                  className={inputCls} style={inputStyle}
                  placeholder="e.g. Chapter 5 Exam Review, Physics Assignment…"
                />
                {draftLoading && (
                  <Loader size={13} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: primaryColor }} className="animate-spin" />
                )}
              </div>
            </div>

            {/* Description */}
            <div>
              <label style={labelStyle}>Description</label>
              <textarea
                value={formData.description}
                onChange={e => setField('description', e.target.value)}
                className={inputCls + ' resize-none'} style={inputStyle}
                placeholder="What will you cover in this session?"
                rows={2}
              />
            </div>

            {/* Date & Time */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>Date & Time *</label>
                {aiReady && (
                  <button type="button" onClick={handleGetSlots} disabled={slotsLoading}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, background: `rgba(${pRgb},0.10)`, border: `1px solid rgba(${pRgb},0.25)`, color: primaryColor, padding: '5px 10px', borderRadius: 8, fontWeight: 600, cursor: slotsLoading ? 'not-allowed' : 'pointer', opacity: slotsLoading ? 0.5 : 1, fontFamily: "'Outfit',sans-serif" }}>
                    {slotsLoading ? <Loader size={10} className="animate-spin" /> : <Brain size={10} />}
                    {slotsLoading ? 'Finding…' : 'AI Suggest Times'}
                  </button>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                <input type="date" value={formData.date} required onChange={e => setField('date', e.target.value)} className={inputCls} style={inputStyle} />
                <input type="time" value={formData.startTime} required onChange={e => setField('startTime', e.target.value)} className={inputCls} style={inputStyle} />
                <input type="time" value={formData.endTime} required onChange={e => setField('endTime', e.target.value)} className={inputCls} style={inputStyle} />
              </div>
              {appliedSlot && (
                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#4ade80', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.18)', borderRadius: 8, padding: '7px 12px', fontFamily: "'Outfit',sans-serif" }}>
                  <CheckCircle2 size={11} /> AI slot applied · {appliedSlot.reason}
                  <button type="button" onClick={() => setAppliedSlot(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: T.text3, display: 'flex' }}><X size={10} /></button>
                </div>
              )}
            </div>

            {/* AI Time Slot Panel */}
            {aiPanel === 'slots' && (
              <div style={{ borderRadius: 12, border: `1px solid rgba(${pRgb},0.22)`, background: T.surface, overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', borderBottom: `1px solid ${T.divider}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Brain size={13} style={{ color: primaryColor }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: T.text, fontFamily: "'Outfit',sans-serif" }}>AI Suggested Time Slots</span>
                  </div>
                  <button type="button" onClick={() => setAiPanel(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.text3, display: 'flex' }}><X size={13} /></button>
                </div>
                {slotsLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '22px 14px', gap: 8, color: primaryColor, fontSize: 12, fontFamily: "'Outfit',sans-serif" }}>
                    <Loader size={14} className="animate-spin" /> Analyzing your schedule…
                  </div>
                ) : slots.length > 0 ? (
                  <div>
                    {slots.map((slot, i) => (
                      <div key={i} style={{ padding: '12px 14px', borderBottom: i < slots.length - 1 ? `1px solid ${T.divider}` : 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const, marginBottom: 4 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: T.text, fontFamily: "'Outfit',sans-serif" }}>{slot.startTime} – {slot.endTime}</span>
                              <span style={{ fontSize: 10, color: T.text3 }}>{slot.date}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ENERGY_STYLE[slot.energyLevel]}`}>{ENERGY_ICON[slot.energyLevel]} {slot.energyLevel}</span>
                              <span style={{ fontSize: 10, color: T.text3, background: T.surface, padding: '1px 6px', borderRadius: 999, textTransform: 'capitalize' as const }}>{slot.sessionType}</span>
                            </div>
                            <p style={{ fontSize: 11, color: T.text2, lineHeight: 1.5, margin: 0, fontFamily: "'Outfit',sans-serif" }}>{slot.reason}</p>
                            {slot.conflictWarning && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4, fontSize: 11, color: '#fbbf24' }}>
                                <AlertTriangle size={10} /> {slot.conflictWarning}
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                              <TrendingUp size={10} style={{ color: '#4ade80' }} />
                              <span style={{ fontSize: 11, fontWeight: 700, color: '#4ade80', fontFamily: "'Outfit',sans-serif" }}>{slot.estimatedProductivity}%</span>
                            </div>
                            <button type="button" onClick={() => applySlot(slot)}
                              style={{ fontSize: 11, background: primaryColor, color: '#fff', border: 'none', padding: '5px 12px', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
                              Use This
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : slotsError ? (
                  <div style={{ padding: '16px 14px', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 8, textAlign: 'center' as const }}>
                    <AlertTriangle size={18} style={{ color: '#f87171' }} />
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#fca5a5', margin: 0, fontFamily: "'Outfit',sans-serif" }}>AI request failed</p>
                    <p style={{ fontSize: 11, color: '#fca5a580', margin: 0, fontFamily: 'monospace' }}>{slotsError}</p>
                    <p style={{ fontSize: 11, color: T.text3, fontFamily: "'Outfit',sans-serif" }}>Go to <strong style={{ color: T.text2 }}>Admin → AI Model Settings</strong> to verify your provider.</p>
                  </div>
                ) : (
                  <p style={{ padding: '18px 14px', textAlign: 'center' as const, color: T.text3, fontSize: 12, fontFamily: "'Outfit',sans-serif" }}>No suggestions — enter a title first</p>
                )}
              </div>
            )}

            {/* Course */}
            <div>
              <label style={labelStyle}>Course / Subject</label>
              {allCourses.length > 0 ? (
                <select value={formData.course} onChange={e => setField('course', e.target.value)} className={inputCls} style={inputStyle}>
                  <option value="">Select course…</option>
                  {allCourses.map(c => <option key={c.id} value={c.title}>{c.title}</option>)}
                </select>
              ) : (
                <input type="text" value={formData.course} onChange={e => setField('course', e.target.value)} className={inputCls} style={inputStyle} placeholder="Enter course or subject name…" />
              )}
            </div>

            {/* Event Type + Priority */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Event Type</label>
                <select value={formData.eventType} onChange={e => setField('eventType', e.target.value)} className={inputCls} style={inputStyle}>
                  {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Priority</label>
                <select value={formData.priority} onChange={e => setField('priority', e.target.value)} className={inputCls} style={inputStyle}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            {/* Reminder + Recurrence */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Reminder</label>
                <select value={formData.reminderMinutes} onChange={e => setField('reminderMinutes', Number(e.target.value))} className={inputCls} style={inputStyle}>
                  <option value={0}>No reminder</option>
                  <option value={5}>5 min before</option>
                  <option value={15}>15 min before</option>
                  <option value={30}>30 min before</option>
                  <option value={60}>1 hour before</option>
                  <option value={1440}>1 day before</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Repeat</label>
                <select value={formData.recurrence} onChange={e => setField('recurrence', e.target.value)} className={inputCls} style={inputStyle}>
                  <option value="none">No repeat</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                </select>
              </div>
            </div>

            {/* AI Study Tips */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>Study Tips</label>
                {aiReady && (
                  <button type="button" onClick={handleGetTips} disabled={tipsLoading}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.25)', color: '#fbbf24', padding: '5px 10px', borderRadius: 8, fontWeight: 600, cursor: tipsLoading ? 'not-allowed' : 'pointer', opacity: tipsLoading ? 0.5 : 1, fontFamily: "'Outfit',sans-serif" }}>
                    {tipsLoading ? <Loader size={10} className="animate-spin" /> : <Lightbulb size={10} />}
                    {tipsLoading ? 'Loading…' : 'AI Tips'}
                  </button>
                )}
              </div>
              {aiPanel === 'tips' && tipsLoading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#fbbf24', background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.18)', borderRadius: 8, padding: '8px 12px', fontFamily: "'Outfit',sans-serif" }}>
                  <Loader size={11} className="animate-spin" /> Generating tips for {formData.course || formData.title || 'this subject'}…
                </div>
              )}
              {tips.length === 0 && !tipsLoading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: T.text3, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 12px', fontFamily: "'Outfit',sans-serif" }}>
                  <Lightbulb size={10} /> Click <span style={{ color: '#fbbf24', fontWeight: 600, margin: '0 2px' }}>AI Tips</span> to get study suggestions for this topic
                </div>
              )}
              {tips.length > 0 && !tipsLoading && (
                <div style={{ borderRadius: 10, border: '1px solid rgba(245,158,11,0.18)', background: 'rgba(245,158,11,0.05)', padding: '12px 14px', display: 'flex', flexDirection: 'column' as const, gap: 7 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 5, margin: 0, fontFamily: "'Outfit',sans-serif" }}>
                      <Lightbulb size={11} /> AI Study Tips <span style={{ color: T.text3, fontWeight: 400 }}>· {formData.course || 'General'}</span>
                    </p>
                    {tipsSource === 'draft' && <span style={{ fontSize: 10, color: T.text3, fontStyle: 'italic', fontFamily: "'Outfit',sans-serif" }}>Click AI Tips for more</span>}
                  </div>
                  {tips.map((tip, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: T.text2, fontFamily: "'Outfit',sans-serif" }}>
                      <span style={{ color: '#fbbf24', fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                      <span style={{ lineHeight: 1.5 }}>{tip}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Target Audience (teacher only) */}
            {!isPersonalEvent && (
              <div>
                <label style={labelStyle}>Target Audience</label>
                <select value={formData.targetAudience}
                  onChange={e => setFormData(p => ({ ...p, targetAudience: e.target.value, targetStudentIds: [], targetCourseIds: [] }))}
                  className={inputCls} style={inputStyle}>
                  <option value="all">All Students</option>
                  <option value="specific_student">Specific Students</option>
                  <option value="course_students">Students in Courses</option>
                </select>
              </div>
            )}

            {/* Specific Students */}
            {!isPersonalEvent && formData.targetAudience === 'specific_student' && (
              <div>
                <label style={labelStyle}>Select Students</label>
                <div style={{ background: T.surface, borderRadius: 10, padding: 10, maxHeight: 180, overflowY: 'auto', border: `1px solid ${T.border}` }}>
                  {allStudents.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '12px 0', color: T.text3 }}>
                      <Users size={20} style={{ margin: '0 auto 6px', display: 'block' }} />
                      <p style={{ fontSize: 12, margin: 0, fontFamily: "'Outfit',sans-serif" }}>No students available</p>
                    </div>
                  ) : allStudents.map(s => (
                    <label key={s.uid} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 4px', borderRadius: 6, cursor: 'pointer' }}>
                      <input type="checkbox" checked={formData.targetStudentIds.includes(s.uid)}
                        onChange={e => setField('targetStudentIds', e.target.checked ? [...formData.targetStudentIds, s.uid] : formData.targetStudentIds.filter(id => id !== s.uid))}
                        style={{ width: 14, height: 14, accentColor: primaryColor }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: T.text, fontSize: 12, fontFamily: "'Outfit',sans-serif" }}>{s.name}</div>
                        <div style={{ color: T.text3, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'Outfit',sans-serif" }}>{s.email}</div>
                      </div>
                      {formData.targetStudentIds.includes(s.uid) && <Check size={13} style={{ color: '#4ade80' }} />}
                    </label>
                  ))}
                </div>
                {formData.targetStudentIds.length > 0 && (
                  <p style={{ marginTop: 6, fontSize: 11, color: T.text2, fontFamily: "'Outfit',sans-serif" }}>{formData.targetStudentIds.length} student{formData.targetStudentIds.length !== 1 ? 's' : ''} selected</p>
                )}
              </div>
            )}

            {/* Course Students */}
            {!isPersonalEvent && formData.targetAudience === 'course_students' && (
              <div>
                <label style={labelStyle}>Select Courses</label>
                <div style={{ background: T.surface, borderRadius: 10, padding: 10, maxHeight: 180, overflowY: 'auto', border: `1px solid ${T.border}` }}>
                  {allCourses.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '12px 0', color: T.text3 }}>
                      <BookOpen size={20} style={{ margin: '0 auto 6px', display: 'block' }} />
                      <p style={{ fontSize: 12, margin: 0, fontFamily: "'Outfit',sans-serif" }}>No courses available</p>
                    </div>
                  ) : allCourses.map(c => (
                    <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 4px', borderRadius: 6, cursor: 'pointer' }}>
                      <input type="checkbox" checked={formData.targetCourseIds.includes(c.id)}
                        onChange={e => setField('targetCourseIds', e.target.checked ? [...formData.targetCourseIds, c.id] : formData.targetCourseIds.filter(id => id !== c.id))}
                        style={{ width: 14, height: 14, accentColor: primaryColor }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: T.text, fontSize: 12, fontFamily: "'Outfit',sans-serif" }}>{c.title}</div>
                        {c.instructorName && <div style={{ color: T.text3, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'Outfit',sans-serif" }}>by {c.instructorName}</div>}
                      </div>
                      {formData.targetCourseIds.includes(c.id) && <Check size={13} style={{ color: '#4ade80' }} />}
                    </label>
                  ))}
                </div>
                {formData.targetCourseIds.length > 0 && (
                  <p style={{ marginTop: 6, fontSize: 11, color: T.text2, fontFamily: "'Outfit',sans-serif" }}>{formData.targetCourseIds.length} course{formData.targetCourseIds.length !== 1 ? 's' : ''} selected</p>
                )}
              </div>
            )}

            </form>
          </div>{/* end body */}

          {/* ── FOOTER (sticky, flexShrink:0) — matches reschedule modal footer style */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 20px', borderTop: `1px solid ${T.divider}`, flexShrink: 0, flexWrap: 'wrap' as const }}>
            {/* Left: AI shortcut buttons */}
            <div style={{ display: 'flex', gap: 6 }}>
              {aiReady && aiPanel === null && (
                <>
                  <button type="button" onClick={handleGetSlots}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, background: `rgba(${pRgb},0.10)`, border: `1px solid rgba(${pRgb},0.25)`, color: primaryColor, padding: '7px 12px', borderRadius: 10, fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
                    <Brain size={11} /> AI Times
                  </button>
                  <button type="button" onClick={handleGetTips}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.25)', color: '#fbbf24', padding: '7px 12px', borderRadius: 10, fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
                    <Lightbulb size={11} /> Tips
                  </button>
                </>
              )}
            </div>
            {/* Right: Cancel + Submit */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={onClose}
                style={{ padding: '9px 18px', background: T.btnSecBg, border: `1px solid ${T.btnSecBorder}`, color: T.text2, borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>
                Cancel
              </button>
              <button type="submit" form="study-event-form" disabled={isSaving}
                style={{ padding: '9px 20px', background: T.gradient, color: '#fff', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.6 : 1, fontFamily: "'Outfit',sans-serif", display: 'flex', alignItems: 'center', gap: 6 }}>
                {isSaving
                  ? <><Loader size={13} className="animate-spin" />{isEditing ? 'Updating…' : 'Creating…'}</>
                  : <><CheckCircle2 size={13} />{isEditing ? 'Update Event' : 'Create Event'}</>
                }
              </button>
            </div>
          </div>

        </div>{/* end content wrapper */}
      </div>{/* end shell */}
    </div>,
    document.body
  );
};

export default StudyPlanEventModal;
