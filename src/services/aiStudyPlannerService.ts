// src/services/aiStudyPlannerService.ts
// Multi-Provider AI — Gemini · Groq · OpenAI · Anthropic · DeepSeek
// Reads active provider config from Firestore (set in Admin → AI Model Settings)
// Falls back to VITE_GEMINI_API_KEY + gemini-2.0-flash if no config saved

import { aiModelConfigService, callProviderDirect, AIModelConfig } from './aiModelConfigService';

// ─── Exported Interfaces (unchanged — 100% backward compatible) ───────────────

export interface StudyGoal {
  subject: string;
  targetDate: Date;
  hoursNeeded: number;
  difficulty: 'easy' | 'medium' | 'hard';
  currentProgress: number;
}

export interface AIScheduleSuggestion {
  title: string;
  subject: string;
  date: Date;
  startTime: string;
  endTime: string;
  reason: string;
  priority: 'low' | 'medium' | 'high';
  sessionType: 'focus' | 'review' | 'practice' | 'break';
  tips: string[];
}

export interface AITimeSlotSuggestion {
  date: string;
  startTime: string;
  endTime: string;
  reason: string;
  energyLevel: 'peak' | 'medium' | 'low';
  sessionType: 'focus' | 'review' | 'practice' | 'break';
  estimatedProductivity: number;
  conflictWarning: string | null;
}

export interface AIEventDraft {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  estimatedDuration: number;
  suggestedPrep: string[];
  relatedTopics: string[];
}

export interface AIInsight {
  type: 'warning' | 'success' | 'tip' | 'motivation';
  title: string;
  message: string;
  action?: string;
}

export interface WeeklyDigestAI {
  summary: string;
  tips: string[];
  urgentItems: string[];
  motivationalMessage: string;
}

export interface StudyAnalytics {
  weeklyHours: number;
  subjectDistribution: { subject: string; hours: number; color: string }[];
  productivityScore: number;
  streakDays: number;
  completionRate: number;
  insights: string[];
  recommendations: string[];
}

export interface PomodoroSession {
  id: string;
  subject: string;
  startTime: Date;
  duration: number;
  completed: boolean;
  notes: string;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function parseJSON<T>(raw: string, fallback: T, isArray = false): T {
  try {
    const m = raw.match(isArray ? /\[[\s\S]*\]/ : /\{[\s\S]*\}/);
    if (!m) throw new Error('no json block found');
    return JSON.parse(m[0]) as T;
  } catch {
    return fallback;
  }
}

/**
 * Resolve the AI config to use for a call.
 * - If apiKeyOverride is a non-empty string, build a gemini-2.0-flash config from it (backward compat).
 * - Otherwise load from Firestore (with in-memory cache).
 */
async function resolveConfig(apiKeyOverride?: string): Promise<AIModelConfig> {
  if (apiKeyOverride && apiKeyOverride.trim()) {
    return { provider: 'gemini', model: 'gemini-2.5-flash', apiKey: apiKeyOverride };
  }
  return aiModelConfigService.getConfig();
}

/** Unified AI call — resolves config then routes to the correct provider. Throws on error. */
async function callAI(
  prompt: string,
  maxTokens: number,
  temp: number,
  apiKeyOverride?: string
): Promise<string> {
  const config = await resolveConfig(apiKeyOverride);
  return callProviderDirect(prompt, config, maxTokens, temp);
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const aiStudyPlannerService = {

  async generateSmartSchedule(
    goals: StudyGoal[],
    existing: { date: Date; startTime: string; endTime: string }[],
    hoursPerDay: number,
    apiKey: string
  ): Promise<AIScheduleSuggestion[]> {
    const prompt = `You are an expert AI study planner using spaced repetition + cognitive load theory.

Goals:
${goals.map(g => `- ${g.subject}: ${g.hoursNeeded}h needed, deadline ${g.targetDate.toISOString().split('T')[0]}, difficulty: ${g.difficulty}, progress: ${g.currentProgress}%`).join('\n')}

Existing commitments:
${existing.map(e => `- ${e.date.toISOString().split('T')[0]} ${e.startTime}-${e.endTime}`).join('\n') || 'None'}

Available: ${hoursPerDay}h/day. Today: ${new Date().toISOString().split('T')[0]}

Rules: morning=hard topics, afternoon=review, vary focus/review/practice, space across days, prioritize by urgency x difficulty. Max 14 sessions.

Return ONLY valid JSON array, no markdown:
[{"title":"string","subject":"string","date":"YYYY-MM-DD","startTime":"HH:MM","endTime":"HH:MM","reason":"string","priority":"low|medium|high","sessionType":"focus|review|practice|break","tips":["t1","t2"]}]`;

    const raw = await callAI(prompt, 3000, 0.6, apiKey);
    const parsed = parseJSON<any[]>(raw, [], true);
    return parsed.map((s: any) => ({ ...s, date: new Date(s.date) }));
  },

  async suggestTimeSlots(
    eventTitle: string,
    eventType: string,
    subject: string,
    durationMins: number,
    preferredDate: string,
    existingOnDay: { startTime: string; endTime: string; title: string }[],
    prefs: { preferMorning: boolean; preferEvening: boolean; peakHour?: number },
    apiKey: string
  ): Promise<AITimeSlotSuggestion[]> {
    const busy = existingOnDay.map(e => `  ${e.startTime}-${e.endTime} (${e.title})`).join('\n') || '  None';
    const prompt = `Suggest 3 optimal time slots for a study event.

Event: "${eventTitle}" | Type: ${eventType} | Subject: ${subject} | Duration: ${durationMins}min | Date: ${preferredDate}
Busy:
${busy}
Prefs: morning=${prefs.preferMorning}, evening=${prefs.preferEvening}, peak=${prefs.peakHour ?? 'unknown'}

Rules: exams/hard topics go morning (peak energy), reviews in afternoon, practice is fine in evenings, always add 15min buffer between sessions, never schedule past 23:00.

Return ONLY a valid JSON array of exactly 3 objects. No markdown. No explanation. Just the array:
[{"date":"YYYY-MM-DD","startTime":"HH:MM","endTime":"HH:MM","reason":"one sentence","energyLevel":"peak|medium|low","sessionType":"focus|review|practice|break","estimatedProductivity":85,"conflictWarning":null}]`;

    // Throws on API error — caller must catch and show error state in UI
    const raw = await callAI(prompt, 1024, 0.5, apiKey);
    const result = parseJSON<AITimeSlotSuggestion[]>(raw, [], true);
    if (!Array.isArray(result) || result.length === 0) {
      throw new Error('Model returned no time slots. Check your AI model settings or try again.');
    }
    return result;
  },

  async draftEventFromTitle(
    title: string,
    subject: string,
    eventType: string,
    apiKey: string
  ): Promise<AIEventDraft> {
    const prompt = `Auto-fill study event details.
Title: "${title}" | Subject: "${subject}" | Type: ${eventType}
Return ONLY valid JSON (no markdown):
{"title":"improved title","description":"1-2 sentence description","priority":"low|medium|high","estimatedDuration":60,"suggestedPrep":["s1","s2","s3"],"relatedTopics":["t1","t2"]}`;

    const raw = await callAI(prompt, 512, 0.6, apiKey);
    return parseJSON<AIEventDraft>(
      raw,
      { title, description: '', priority: 'medium', estimatedDuration: 60, suggestedPrep: [], relatedTopics: [] }
    );
  },

  async getPersonalizedInsights(
    studentName: string,
    upcoming: { title: string; date: Date; priority: string; eventType: string }[],
    completionRate: number,
    apiKey: string
  ): Promise<AIInsight[]> {
    const urgent = upcoming
      .filter(e => Math.ceil((e.date.getTime() - Date.now()) / 86400000) <= 7)
      .map(e => `${e.title} in ${Math.ceil((e.date.getTime() - Date.now()) / 86400000)}d`);

    const prompt = `Generate 3-4 personalized study insights.
Student: ${studentName} | Completion: ${completionRate}% | Urgent: ${urgent.join(', ') || 'none'}
Return ONLY valid JSON array (no markdown):
[{"type":"warning|success|tip|motivation","title":"3-5 words","message":"max 100 chars","action":"CTA or null"}]`;

    const raw = await callAI(prompt, 512, 0.8, apiKey);
    return parseJSON<AIInsight[]>(
      raw,
      [{ type: 'tip', title: 'Stay Consistent', message: 'Short daily sessions beat long cramming.', action: 'Start Pomodoro' }],
      true
    );
  },

  async chatWithAI(
    message: string,
    context: { events: number; subjects: string[]; upcomingExams: string[] },
    history: { role: 'user' | 'assistant'; content: string }[],
    apiKey: string
  ): Promise<string> {
    const hist = history.slice(-6).map(m => `${m.role === 'user' ? 'Student' : 'Sage'}: ${m.content}`).join('\n');
    const prompt = `You are Sage, a warm and knowledgeable AI study companion on an EdTech platform. Be encouraging, concise, and actionable.
Context: ${context.events} events, subjects: ${context.subjects.join(', ') || 'none'}, exams: ${context.upcomingExams.join(', ') || 'none'}
${hist}
Student: ${message}
Sage (max 200 words, warm and helpful):`;
    return callAI(prompt, 700, 0.8, apiKey);
  },

  async prioritizeTasks(
    tasks: { id: string; title: string; dueDate: Date; estimatedHours: number; subject: string; priority: string }[],
    apiKey: string
  ): Promise<{ id: string; newPriority: 'low' | 'medium' | 'high'; urgencyScore: number; reason: string }[]> {
    const prompt = `Reprioritize tasks using Eisenhower matrix + deadline urgency.
${tasks.map(t => `${t.id}|${t.title}|due:${t.dueDate.toISOString().split('T')[0]}|${t.estimatedHours}h|${t.subject}|${t.priority}`).join('\n')}
Today: ${new Date().toISOString().split('T')[0]}
Return ONLY valid JSON array (no markdown): [{"id":"string","newPriority":"low|medium|high","urgencyScore":50,"reason":"brief"}]`;

    const raw = await callAI(prompt, 1024, 0.4, apiKey);
    return parseJSON<any[]>(
      raw,
      tasks.map(t => ({ id: t.id, newPriority: t.priority, urgencyScore: 50, reason: 'Manual' })),
      true
    );
  },

  async generateStudyTips(
    subject: string,
    eventType: string,
    apiKey: string
  ): Promise<string[]> {
    const prompt = `3 specific actionable study tips for: "${subject}" (${eventType}). Return ONLY a JSON array of 3 strings (no markdown): ["tip1","tip2","tip3"]`;
    const raw = await callAI(prompt, 256, 0.7, apiKey);
    return parseJSON<string[]>(
      raw,
      ['Review key concepts', 'Practice past questions', 'Summarize in your own words'],
      true
    );
  },

  async generateWeeklyDigestSummary(
    studentName: string,
    upcoming: { title: string; eventType: string; daysUntil: number; priority: string }[],
    completedThisWeek: number,
    totalThisWeek: number,
    streakDays: number,
    topSubjects: string[],
    apiKey: string
  ): Promise<WeeklyDigestAI> {
    const prompt = `Write a student weekly digest as a study coach.
Student: ${studentName} | Done: ${completedThisWeek}/${totalThisWeek} | Streak: ${streakDays}d | Subjects: ${topSubjects.join(', ') || 'various'}
Upcoming: ${upcoming.slice(0, 6).map(e => `${e.title}(${e.daysUntil}d,${e.priority})`).join(', ') || 'none'}
Return ONLY valid JSON (no markdown):
{"summary":"2-3 sentence personalized overview","tips":["t1","t2","t3"],"urgentItems":["item if within 3 days"],"motivationalMessage":"one warm sentence"}`;

    const raw = await callAI(prompt, 768, 0.75, apiKey);
    return parseJSON<WeeklyDigestAI>(
      raw,
      { summary: `Hi ${studentName}, here's your weekly digest.`, tips: ['Review notes daily', 'Use active recall', 'Take breaks'], urgentItems: [], motivationalMessage: 'Keep it up!' }
    );
  },

  async analyzeStudyPatterns(
    sessions: PomodoroSession[],
    events: { date: Date; eventType: string; course: string; isPersonal: boolean }[],
    apiKey: string
  ): Promise<StudyAnalytics> {
    const summary = sessions.slice(-30).map(s => `${s.subject}:${s.duration}min on ${s.startTime.toISOString().split('T')[0]}`).join('\n');
    const prompt = `Analyze student study data.
Sessions (last 30d): ${summary || 'none'}
Events: ${events.length}
Return ONLY valid JSON (no markdown):
{"weeklyHours":0,"subjectDistribution":[{"subject":"s","hours":1,"color":"#6366f1"}],"productivityScore":70,"streakDays":0,"completionRate":0,"insights":["i1","i2","i3"],"recommendations":["r1","r2","r3"]}`;

    const raw = await callAI(prompt, 1024, 0.5, apiKey);
    return parseJSON<StudyAnalytics>(
      raw,
      { weeklyHours: 0, subjectDistribution: [], productivityScore: 50, streakDays: 0, completionRate: 0, insights: ['Start tracking to get AI insights!'], recommendations: ['Add your first session'] }
    );
  },
};
