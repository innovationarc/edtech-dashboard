// src/services/aiStudyPlannerService.ts
// Gemini 2.5 Flash — Smart Schedule · Time Slots · Auto-Draft · Chat · Digest

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

// ─── Gemini 2.5 Flash ─────────────────────────────────────────────────────────

const GEMINI_MODEL = 'gemini-2.5-flash-preview-04-17';
const GEMINI_URL   = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

async function callGemini(prompt: string, apiKey: string, maxTokens = 2048, temp = 0.7): Promise<string> {
  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: temp, maxOutputTokens: maxTokens },
    }),
  });
  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text().catch(() => res.statusText)}`);
  const d = await res.json();
  return d.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

function parseJSON<T>(raw: string, fallback: T, isArray = false): T {
  try {
    const m = raw.match(isArray ? /\[[\s\S]*\]/ : /\{[\s\S]*\}/);
    if (!m) throw new Error('no json');
    return JSON.parse(m[0]) as T;
  } catch { return fallback; }
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

Rules: morning=hard topics, afternoon=review, vary focus/review/practice, space across days, prioritize by urgency×difficulty.

Return ONLY valid JSON array, no markdown:
[{"title":"string","subject":"string","date":"YYYY-MM-DD","startTime":"HH:MM","endTime":"HH:MM","reason":"string","priority":"low|medium|high","sessionType":"focus|review|practice|break","tips":["t1","t2"]}]`;

    const raw = await callGemini(prompt, apiKey, 3000, 0.6);
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
Busy: \n${busy}
Prefs: morning=${prefs.preferMorning}, evening=${prefs.preferEvening}, peak=${prefs.peakHour ?? 'unknown'}

Rules: exams/hard→peak energy (morning), reviews→afternoon, practice→evening ok, 15min buffer, never past 23:00.

Return ONLY valid JSON array of exactly 3 (no markdown):
[{"date":"YYYY-MM-DD","startTime":"HH:MM","endTime":"HH:MM","reason":"1-sentence reason","energyLevel":"peak|medium|low","sessionType":"focus|review|practice|break","estimatedProductivity":0-100,"conflictWarning":"string or null"}]`;

    return parseJSON<AITimeSlotSuggestion[]>(await callGemini(prompt, apiKey, 1024, 0.5), [], true);
  },

  async draftEventFromTitle(title: string, subject: string, eventType: string, apiKey: string): Promise<AIEventDraft> {
    const prompt = `Auto-fill study event details.
Title: "${title}" | Subject: "${subject}" | Type: ${eventType}
Return ONLY valid JSON (no markdown):
{"title":"improved title","description":"1-2 sentence description","priority":"low|medium|high","estimatedDuration":minutes,"suggestedPrep":["s1","s2","s3"],"relatedTopics":["t1","t2"]}`;

    return parseJSON<AIEventDraft>(
      await callGemini(prompt, apiKey, 512, 0.6),
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

    return parseJSON<AIInsight[]>(
      await callGemini(prompt, apiKey, 512, 0.8),
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
    const hist = history.slice(-6).map(m => `${m.role === 'user' ? 'Student' : 'AI'}: ${m.content}`).join('\n');
    const prompt = `You are an expert AI study assistant for an EdTech platform. Be helpful, encouraging, concise.
Context: ${context.events} events, subjects: ${context.subjects.join(', ') || 'none'}, exams: ${context.upcomingExams.join(', ') || 'none'}
${hist}
Student: ${message}
Respond as AI Tutor (max 200 words, actionable and warm):`;
    return callGemini(prompt, apiKey, 512, 0.8);
  },

  async prioritizeTasks(
    tasks: { id: string; title: string; dueDate: Date; estimatedHours: number; subject: string; priority: string }[],
    apiKey: string
  ): Promise<{ id: string; newPriority: 'low' | 'medium' | 'high'; urgencyScore: number; reason: string }[]> {
    const prompt = `Reprioritize tasks using Eisenhower matrix + deadline urgency.
${tasks.map(t => `${t.id}|${t.title}|due:${t.dueDate.toISOString().split('T')[0]}|${t.estimatedHours}h|${t.subject}|${t.priority}`).join('\n')}
Today: ${new Date().toISOString().split('T')[0]}
Return ONLY valid JSON array (no markdown): [{"id":"string","newPriority":"low|medium|high","urgencyScore":0-100,"reason":"brief"}]`;

    return parseJSON<any[]>(
      await callGemini(prompt, apiKey, 1024, 0.4),
      tasks.map(t => ({ id: t.id, newPriority: t.priority, urgencyScore: 50, reason: 'Manual' })),
      true
    );
  },

  async generateStudyTips(subject: string, eventType: string, apiKey: string): Promise<string[]> {
    const prompt = `3 specific actionable study tips for: "${subject}" (${eventType}). Return ONLY JSON array (no markdown): ["t1","t2","t3"]`;
    return parseJSON<string[]>(
      await callGemini(prompt, apiKey, 256, 0.7),
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
    const prompt = `Write a student's weekly digest as a study coach.
Student: ${studentName} | Done: ${completedThisWeek}/${totalThisWeek} | Streak: ${streakDays}d | Subjects: ${topSubjects.join(', ') || 'various'}
Upcoming: ${upcoming.slice(0, 6).map(e => `${e.title}(${e.daysUntil}d,${e.priority})`).join(', ') || 'none'}
Return ONLY valid JSON (no markdown):
{"summary":"2-3 sentence personalized overview","tips":["t1","t2","t3"],"urgentItems":["item if <=3d else empty"],"motivationalMessage":"one warm sentence"}`;

    return parseJSON<WeeklyDigestAI>(
      await callGemini(prompt, apiKey, 768, 0.75),
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
{"weeklyHours":number,"subjectDistribution":[{"subject":"s","hours":number,"color":"#hex"}],"productivityScore":0-100,"streakDays":number,"completionRate":0-100,"insights":["i1","i2","i3"],"recommendations":["r1","r2","r3"]}`;

    return parseJSON<StudyAnalytics>(
      await callGemini(prompt, apiKey, 1024, 0.5),
      { weeklyHours: 0, subjectDistribution: [], productivityScore: 50, streakDays: 0, completionRate: 0, insights: ['Start tracking to get AI insights!'], recommendations: ['Add your first session'] }
    );
  },
};
