// src/components/shared/StudyPlanEventModal.tsx
// Enhanced with AI Time Slots · Auto-Draft · Study Tips — Gemini 2.5 Flash
// Fully backwards compatible with original prop interface

import React, { useState, useEffect, useRef } from 'react';
import {
  X, Calendar, Clock, Target, Users, BookOpen, Check,
  Brain, Sparkles, Loader, AlertTriangle, Lightbulb,
  TrendingUp, CheckCircle2, Zap,
} from 'lucide-react';
import { format, addMinutes, parse } from 'date-fns';
import { StudyPlanEvent } from '../../services/studyPlanService';
import { aiStudyPlannerService, AITimeSlotSuggestion, AIEventDraft } from '../../services/aiStudyPlannerService';

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
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

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
}) => {
  const isEditing = !!event;

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

  // ── AI state ─────────────────────────────────────────────────────────────────
  const [aiPanel, setAiPanel]             = useState<'slots' | 'tips' | null>(null);
  const [slotsLoading, setSlotsLoading]   = useState(false);
  const [slots, setSlots]                 = useState<AITimeSlotSuggestion[]>([]);
  const [appliedSlot, setAppliedSlot]     = useState<AITimeSlotSuggestion | null>(null);
  const [tipsLoading, setTipsLoading]     = useState(false);
  const [tips, setTips]                   = useState<string[]>([]);
  const [draftLoading, setDraftLoading]   = useState(false);
  const [draft, setDraft]                 = useState<AIEventDraft | null>(null);
  const [draftApplied, setDraftApplied]   = useState(false);
  const [isSaving, setIsSaving]           = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Auto-draft on title change ─────────────────────────────────────────────
  useEffect(() => {
    if (!formData.title || formData.title.length < 5 || !GEMINI_KEY || draftApplied || isEditing) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setDraftLoading(true);
      try {
        const d = await aiStudyPlannerService.draftEventFromTitle(
          formData.title, formData.course || 'General', formData.eventType, GEMINI_KEY
        );
        setDraft(d);
      } catch { /* silent */ } finally { setDraftLoading(false); }
    }, 900);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [formData.title, formData.eventType, formData.course]);

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
    setDraftApplied(true);
    setDraft(null);
  };

  const handleGetSlots = async () => {
    if (!GEMINI_KEY) return;
    setSlotsLoading(true);
    setAiPanel('slots');
    try {
      const result = await aiStudyPlannerService.suggestTimeSlots(
        formData.title || 'Study Session', formData.eventType,
        formData.course || 'General', 60, formData.date, [],
        { preferMorning: true, preferEvening: false }, GEMINI_KEY
      );
      setSlots(result);
    } catch { /* silent */ } finally { setSlotsLoading(false); }
  };

  const handleGetTips = async () => {
    if (!GEMINI_KEY) return;
    setTipsLoading(true);
    setAiPanel('tips');
    try {
      const result = await aiStudyPlannerService.generateStudyTips(
        formData.course || formData.title || 'General', formData.eventType, GEMINI_KEY
      );
      setTips(result);
    } catch { /* silent */ } finally { setTipsLoading(false); }
  };

  const applySlot = (slot: AITimeSlotSuggestion) => {
    setFormData(p => ({ ...p, date: slot.date, startTime: slot.startTime, endTime: slot.endTime }));
    setAppliedSlot(slot);
    setAiPanel(null);
  };

  // ── Submit — guarded against double-click duplicates via isSaving ──────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || isSaving) return;

    setIsSaving(true);
    const eventData = {
      title:       formData.title.trim(),
      description: formData.description.trim(),
      date:        new Date(formData.date),
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
      setIsSaving(false); // reset on error so user can retry; parent closes modal on success
    }
  };

  // ── Input styles ───────────────────────────────────────────────────────────
  const inputCls = 'w-full bg-background-800 text-white rounded-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500 border border-transparent focus:border-primary-500 transition-colors text-sm placeholder-gray-500';
  const labelCls = 'block text-sm font-medium text-gray-400 mb-2';

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-background-900 rounded-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto relative border border-background-700 shadow-2xl">

        {/* Close */}
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-white transition-colors z-10 p-1 rounded-lg hover:bg-background-700">
          <X size={20} />
        </button>

        <div className="p-6">

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary-600 to-purple-600 flex items-center justify-center flex-shrink-0">
              <Calendar size={22} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-white">
                  {isEditing ? 'Edit Event' : `Create ${isPersonalEvent ? 'Personal ' : ''}Event`}
                </h2>
                {GEMINI_KEY && (
                  <span className="text-xs flex items-center gap-1 bg-purple-500/15 border border-purple-500/30 text-purple-300 px-2 py-0.5 rounded-full">
                    <Sparkles size={9} /> AI Enhanced
                  </span>
                )}
              </div>
              <p className="text-gray-400 text-sm mt-0.5">
                {isPersonalEvent ? 'Add a personal study event' : 'Create an event for students'}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* ── AI Auto-Draft Banner ── */}
            {draft && !draftApplied && (
              <div className="rounded-xl border border-purple-500/30 bg-purple-500/8 p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-600/25 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Brain size={15} className="text-purple-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-purple-200 mb-0.5">✨ AI Draft Ready</p>
                    <p className="text-xs text-purple-300/70 leading-relaxed">
                      Gemini suggests: <span className="text-white font-medium">"{draft.title}"</span>
                      {' · '}{draft.estimatedDuration}min · {draft.priority} priority
                    </p>
                    {draft.suggestedPrep.length > 0 && (
                      <p className="text-xs text-purple-300/50 mt-1">Prep: {draft.suggestedPrep.slice(0, 2).join(' · ')}</p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button type="button" onClick={applyDraft}
                      className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1">
                      <Check size={11} /> Apply
                    </button>
                    <button type="button" onClick={() => setDraft(null)}
                      className="text-xs bg-background-700 hover:bg-background-600 text-gray-400 px-3 py-1.5 rounded-lg transition-colors">
                      Skip
                    </button>
                  </div>
                </div>
              </div>
            )}

            {draftLoading && (
              <div className="flex items-center gap-2 text-xs text-purple-300 bg-purple-500/8 border border-purple-500/20 rounded-lg px-4 py-2.5">
                <Loader size={12} className="animate-spin" /> Gemini is drafting details…
              </div>
            )}

            {/* Title */}
            <div>
              <label className={labelCls}>Title *</label>
              <div className="relative">
                <input
                  type="text" value={formData.title} required
                  onChange={e => setField('title', e.target.value)}
                  className={inputCls}
                  placeholder="e.g. Chapter 5 Exam Review, Physics Assignment…"
                />
                {draftLoading && (
                  <Loader size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-purple-400" />
                )}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className={labelCls}>Description</label>
              <textarea
                value={formData.description}
                onChange={e => setField('description', e.target.value)}
                className={inputCls + ' resize-none'}
                placeholder="What will you cover in this session?"
                rows={3}
              />
            </div>

            {/* Date + AI Suggest Times */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={labelCls + ' mb-0'}>Date & Time *</label>
                {GEMINI_KEY && (
                  <button type="button" onClick={handleGetSlots} disabled={slotsLoading}
                    className="flex items-center gap-1.5 text-xs bg-purple-600/15 hover:bg-purple-600/25 border border-purple-500/30 text-purple-300 px-3 py-1.5 rounded-lg font-medium transition-all disabled:opacity-50">
                    {slotsLoading ? <Loader size={11} className="animate-spin" /> : <Brain size={11} />}
                    {slotsLoading ? 'Finding…' : '✨ AI Suggest Times'}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input type="date" value={formData.date} required onChange={e => setField('date', e.target.value)} className={inputCls} />
                <input type="time" value={formData.startTime} required onChange={e => setField('startTime', e.target.value)} className={inputCls} />
                <input type="time" value={formData.endTime} required onChange={e => setField('endTime', e.target.value)} className={inputCls} />
              </div>

              {/* Applied slot badge */}
              {appliedSlot && (
                <div className="mt-2 flex items-center gap-2 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                  <CheckCircle2 size={12} /> AI slot applied · {appliedSlot.reason}
                  <button type="button" onClick={() => setAppliedSlot(null)} className="ml-auto text-gray-500 hover:text-gray-300"><X size={11} /></button>
                </div>
              )}
            </div>

            {/* AI Time Slot Panel */}
            {aiPanel === 'slots' && (
              <div className="rounded-xl border border-purple-500/25 bg-background-800 overflow-hidden">
                <div className="px-4 py-3 border-b border-background-700 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Brain size={14} className="text-purple-400" />
                    <span className="text-sm font-semibold text-white">AI Suggested Time Slots</span>
                    <span className="text-xs text-gray-500">Gemini 2.5 Flash</span>
                  </div>
                  <button type="button" onClick={() => setAiPanel(null)} className="text-gray-500 hover:text-white"><X size={14} /></button>
                </div>

                {slotsLoading ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-purple-300 text-sm">
                    <Loader size={16} className="animate-spin" /> Analyzing your schedule…
                  </div>
                ) : slots.length > 0 ? (
                  <div className="divide-y divide-background-700">
                    {slots.map((slot, i) => (
                      <div key={i} className="p-4 hover:bg-background-750 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1.5">
                              <span className="text-sm font-bold text-white">{slot.startTime} – {slot.endTime}</span>
                              <span className="text-xs text-gray-400">{slot.date}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ENERGY_STYLE[slot.energyLevel]}`}>
                                {ENERGY_ICON[slot.energyLevel]} {slot.energyLevel} energy
                              </span>
                              <span className="text-xs text-gray-400 capitalize bg-background-700 px-2 py-0.5 rounded-full">{slot.sessionType}</span>
                            </div>
                            <p className="text-xs text-gray-300 leading-relaxed">{slot.reason}</p>
                            {slot.conflictWarning && (
                              <div className="flex items-center gap-1.5 mt-1.5 text-xs text-amber-400">
                                <AlertTriangle size={11} /> {slot.conflictWarning}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2 flex-shrink-0">
                            <div className="flex items-center gap-1">
                              <TrendingUp size={11} className="text-emerald-400" />
                              <span className="text-xs font-bold text-emerald-400">{slot.estimatedProductivity}%</span>
                            </div>
                            <button type="button" onClick={() => applySlot(slot)}
                              className="text-xs bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors">
                              Use This
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-6 text-center text-gray-500 text-sm">No suggestions available</p>
                )}
              </div>
            )}

            {/* Course */}
            <div>
              <label className={labelCls}>Course / Subject</label>
              {allCourses.length > 0 ? (
                <select value={formData.course} onChange={e => setField('course', e.target.value)} className={inputCls}>
                  <option value="">Select course…</option>
                  {allCourses.map(c => <option key={c.id} value={c.title}>{c.title}</option>)}
                </select>
              ) : (
                <input type="text" value={formData.course} onChange={e => setField('course', e.target.value)}
                  className={inputCls} placeholder="Enter course or subject name…" />
              )}
            </div>

            {/* Type + Priority */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Event Type</label>
                <select value={formData.eventType} onChange={e => setField('eventType', e.target.value)} className={inputCls}>
                  {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Priority</label>
                <select value={formData.priority} onChange={e => setField('priority', e.target.value)} className={inputCls}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            {/* Reminder + Recurrence */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Reminder</label>
                <select value={formData.reminderMinutes} onChange={e => setField('reminderMinutes', Number(e.target.value))} className={inputCls}>
                  <option value={0}>No reminder</option>
                  <option value={5}>5 min before</option>
                  <option value={15}>15 min before</option>
                  <option value={30}>30 min before</option>
                  <option value={60}>1 hour before</option>
                  <option value={1440}>1 day before</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Repeat</label>
                <select value={formData.recurrence} onChange={e => setField('recurrence', e.target.value)} className={inputCls}>
                  <option value="none">No repeat</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                </select>
              </div>
            </div>

            {/* AI Study Tips */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={labelCls + ' mb-0'}>Study Tips</label>
                {GEMINI_KEY && (
                  <button type="button" onClick={handleGetTips} disabled={tipsLoading}
                    className="flex items-center gap-1.5 text-xs bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 text-amber-300 px-3 py-1.5 rounded-lg transition-all font-medium disabled:opacity-50">
                    {tipsLoading ? <Loader size={11} className="animate-spin" /> : <Lightbulb size={11} />}
                    {tipsLoading ? 'Loading…' : 'AI Tips'}
                  </button>
                )}
              </div>

              {aiPanel === 'tips' && tipsLoading && (
                <div className="flex items-center gap-2 text-xs text-amber-300 bg-amber-500/8 border border-amber-500/20 rounded-lg px-4 py-3">
                  <Loader size={12} className="animate-spin" /> Generating tips for {formData.course || formData.title || 'this subject'}…
                </div>
              )}

              {tips.length > 0 && !tipsLoading && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-2">
                  <p className="text-xs font-semibold text-amber-300 flex items-center gap-1.5 mb-3">
                    <Lightbulb size={12} /> AI Study Tips
                    <span className="text-gray-500 font-normal">· {formData.course || 'General'}</span>
                  </p>
                  {tips.map((tip, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-sm text-gray-200">
                      <span className="text-amber-400 font-bold flex-shrink-0 mt-0.5">{i + 1}.</span>
                      <span className="leading-relaxed">{tip}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Target Audience (teacher only) */}
            {!isPersonalEvent && (
              <div>
                <label className={labelCls}>Target Audience</label>
                <select
                  value={formData.targetAudience}
                  onChange={e => setFormData(p => ({ ...p, targetAudience: e.target.value, targetStudentIds: [], targetCourseIds: [] }))}
                  className={inputCls}>
                  <option value="all">All Students</option>
                  <option value="specific_student">Specific Students</option>
                  <option value="course_students">Students in Courses</option>
                </select>
              </div>
            )}

            {/* Specific Students */}
            {!isPersonalEvent && formData.targetAudience === 'specific_student' && (
              <div>
                <label className={labelCls}>Select Students</label>
                <div className="bg-background-800 rounded-lg p-3 max-h-48 overflow-y-auto border border-background-700">
                  {allStudents.length === 0 ? (
                    <div className="text-center py-4 text-gray-400">
                      <Users size={24} className="mx-auto mb-2" />
                      <p className="text-sm">No students available</p>
                    </div>
                  ) : allStudents.map(s => (
                    <label key={s.uid} className="flex items-center gap-3 p-2 hover:bg-background-700 rounded-lg cursor-pointer transition-colors">
                      <input type="checkbox"
                        checked={formData.targetStudentIds.includes(s.uid)}
                        onChange={e => setField('targetStudentIds',
                          e.target.checked ? [...formData.targetStudentIds, s.uid] : formData.targetStudentIds.filter(id => id !== s.uid)
                        )}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-700 rounded" />
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-sm">{s.name}</div>
                        <div className="text-gray-400 text-xs truncate">{s.email}</div>
                      </div>
                      {formData.targetStudentIds.includes(s.uid) && <Check size={16} className="text-emerald-400" />}
                    </label>
                  ))}
                </div>
                {formData.targetStudentIds.length > 0 && (
                  <p className="mt-2 text-sm text-gray-400">{formData.targetStudentIds.length} student{formData.targetStudentIds.length !== 1 ? 's' : ''} selected</p>
                )}
              </div>
            )}

            {/* Course Students */}
            {!isPersonalEvent && formData.targetAudience === 'course_students' && (
              <div>
                <label className={labelCls}>Select Courses</label>
                <div className="bg-background-800 rounded-lg p-3 max-h-48 overflow-y-auto border border-background-700">
                  {allCourses.length === 0 ? (
                    <div className="text-center py-4 text-gray-400">
                      <BookOpen size={24} className="mx-auto mb-2" />
                      <p className="text-sm">No courses available</p>
                    </div>
                  ) : allCourses.map(c => (
                    <label key={c.id} className="flex items-center gap-3 p-2 hover:bg-background-700 rounded-lg cursor-pointer transition-colors">
                      <input type="checkbox"
                        checked={formData.targetCourseIds.includes(c.id)}
                        onChange={e => setField('targetCourseIds',
                          e.target.checked ? [...formData.targetCourseIds, c.id] : formData.targetCourseIds.filter(id => id !== c.id)
                        )}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-700 rounded" />
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-sm">{c.title}</div>
                        {c.instructorName && <div className="text-gray-400 text-xs truncate">by {c.instructorName}</div>}
                      </div>
                      {formData.targetCourseIds.includes(c.id) && <Check size={16} className="text-emerald-400" />}
                    </label>
                  ))}
                </div>
                {formData.targetCourseIds.length > 0 && (
                  <p className="mt-2 text-sm text-gray-400">{formData.targetCourseIds.length} course{formData.targetCourseIds.length !== 1 ? 's' : ''} selected</p>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-background-700">
              <div className="flex gap-2">
                {GEMINI_KEY && aiPanel === null && (
                  <>
                    <button type="button" onClick={handleGetSlots} disabled={slotsLoading || isSaving}
                      className="flex items-center gap-1.5 text-xs bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/25 text-purple-300 px-3 py-2 rounded-lg transition-all disabled:opacity-50">
                      <Brain size={12} /> AI Times
                    </button>
                    <button type="button" onClick={handleGetTips} disabled={tipsLoading || isSaving}
                      className="flex items-center gap-1.5 text-xs bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 text-amber-300 px-3 py-2 rounded-lg transition-all disabled:opacity-50">
                      <Lightbulb size={12} /> Tips
                    </button>
                  </>
                )}
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={onClose} disabled={isSaving}
                  className="px-5 py-2.5 bg-background-800 hover:bg-background-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50">
                  Cancel
                </button>
                <button type="submit" disabled={isSaving}
                  className="px-6 py-2.5 bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 text-white rounded-lg transition-all text-sm font-semibold shadow-lg flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
                  {isSaving
                    ? <><Loader size={15} className="animate-spin" />{isEditing ? 'Updating…' : 'Creating…'}</>
                    : <><CheckCircle2 size={15} />{isEditing ? 'Update Event' : 'Create Event'}</>
                  }
                </button>
              </div>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
};

export default StudyPlanEventModal;
