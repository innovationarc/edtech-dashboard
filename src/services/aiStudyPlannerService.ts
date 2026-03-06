// src/services/aiStudyPlannerService.ts
// Gemini 2.5 Flash — Smart Schedule · Time Slots · Auto-Draft · Chat · Calendar Extraction
// Cost-optimized: session caching, minimal tokens, smart batching

// ─── Interfaces ───────────────────────────────────────────────────────────────

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

// NEW: Calendar event extracted from chat
export interface CalendarEventFromChat {
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
  subject: string;
  eventType: 'study_session' | 'exam' | 'assignment' | 'deadline' | 'class';
  priority: 'low' | 'medium' | 'high';
  description?: string;
}

// NEW: Rich chat context
export interface ChatContext {
  studentName: string;
  totalEvents: number;
  subjects: string[];
  upcomingExams: string[];
  enrolledCourses: { title: string; subjects: string[]; totalLessons: number; progress: number }[];
  customActivities: { name: string; days: string[]; time: string; priority: string }[];
  activeGoals: { subject: string; targetDate: string; hoursNeeded: number; progress: number }[];
  completionRate: number;
  streak: number;
  pomodoroSessions: number;
}

// NEW: Chat response with optional calendar data
export interface ChatResponse {
  response: string;
  calendarEvents?: CalendarEventFromChat[];
}

// ─── Gemini 2.5 Flash ─────────────────────────────────────────────────────────

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL   = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Single-turn call
async function callGemini(prompt: string, apiKey: string, maxTokens = 1024, temp = 0.7): Promise<string> {
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

// Multi-turn chat call — uses Gemini's native conversation format
async function callGeminiChat(
  systemPrompt: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  userMessage: string,
  apiKey: string,
  maxTokens = 700,
  temp = 0.85
): Promise<string> {
  // Convert history to Gemini format (model = assistant)
  const contents: any[] = history.slice(-8).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  // Add current message
  contents.push({ role: 'user', parts: [{ text: userMessage }] });

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
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

// Extract PLAN_JSON block from AI chat response
function extractPlanJSON(response: string): { cleanResponse: string; events: CalendarEventFromChat[] } {
  const match = response.match(/<!--PLAN_JSON\s*([\s\S]*?)\s*PLAN_JSON-->/);
  if (!match) return { cleanResponse: response.trim(), events: [] };

  const cleanResponse = response.replace(/<!--PLAN_JSON[\s\S]*?PLAN_JSON-->/, '').trim();
  try {
    const raw = match[1].trim();
    const events = JSON.parse(raw) as CalendarEventFromChat[];
    if (!Array.isArray(events)) return { cleanResponse, events: [] };
    return { cleanResponse, events };
  } catch {
    return { cleanResponse, events: [] };
  }
}

// ─── Session-level caching (cost optimization) ────────────────────────────────

function getCached<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch { return null; }
}

function setCache(key: string, value: any): void {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const aiStudyPlannerService = {

  // ── Smart Schedule ──────────────────────────────────────────────────────────
  async generateSmartSchedule(
    goals: StudyGoal[],
    existing: { date: Date; startTime: string; endTime: string }[],
    hoursPerDay: number,
    apiKey: string,
    options?: {
      enrolledCourses?: { title: string; subjects: string[] }[];
      customActivities?: { name: string; daysOfWeek: number[]; startTime: string; endTime: string; isFlexible: boolean }[];
    }
  ): Promise<AIScheduleSuggestion[]> {
    const today = new Date().toISOString().split('T')[0];

    const blockedSlotsText = options?.customActivities?.length
      ? options.customActivities.map(a => {
          const dayNames = a.daysOfWeek.map(d => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join('/');
          return `  - ${a.name}: ${dayNames} ${a.startTime}-${a.endTime}${a.isFlexible ? ' (can skip if urgent)' : ''}`;
        }).join('\n')
      : '  None';

    const courseContext = options?.enrolledCourses?.length
      ? options.enrolledCourses.map(c => `  - ${c.title} (${c.subjects.join(', ')})`).join('\n')
      : '';

    const prompt = `Create an optimized study schedule using spaced repetition and cognitive load theory.

Goals:
${goals.map(g => `- ${g.subject}: ${g.hoursNeeded}h needed, deadline ${g.targetDate.toISOString().split('T')[0]}, difficulty: ${g.difficulty}, progress: ${g.currentProgress}%`).join('\n')}
${courseContext ? `\nEnrolled Courses:\n${courseContext}` : ''}

Available: ${hoursPerDay}h/day
Blocked times:
${blockedSlotsText}

Existing events (avoid overlap):
${existing.map(e => `  - ${e.date.toISOString().split('T')[0]} ${e.startTime}-${e.endTime}`).join('\n') || '  None'}

Today: ${today}

Rules:
- Hard/new topics → 8am-11am (peak energy)
- Reviews → 1pm-4pm
- Practice → 6pm-8pm
- Max 90-min sessions, space same subject 1+ day apart
- Prioritize by urgency×difficulty, generate 7-14 sessions total
- No sessions past 9pm or before 7am

Return ONLY valid JSON array, no markdown:
[{"title":"string","subject":"string","date":"YYYY-MM-DD","startTime":"HH:MM","endTime":"HH:MM","reason":"string","priority":"low|medium|high","sessionType":"focus|review|practice","tips":["t1","t2"]}]`;

    const raw = await callGemini(prompt, apiKey, 2500, 0.55);
    const parsed = parseJSON<any[]>(raw, [], true);
    return parsed.filter((s: any) => s.date && s.startTime).map((s: any) => ({
      ...s,
      date: new Date(s.date),
      tips: Array.isArray(s.tips) ? s.tips : [],
    }));
  },

  // ── Time Slot Suggestions ───────────────────────────────────────────────────
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
    const prompt = `Suggest 3 optimal time slots.
Event: "${eventTitle}" | Type: ${eventType} | Subject: ${subject} | Duration: ${durationMins}min | Date: ${preferredDate}
Busy:\n${busy}
Prefs: morning=${prefs.preferMorning}, evening=${prefs.preferEvening}

Rules: exams/hard→morning, reviews→afternoon, practice→evening ok, 15min buffer, never past 22:00.

Return ONLY valid JSON array of exactly 3:
[{"date":"YYYY-MM-DD","startTime":"HH:MM","endTime":"HH:MM","reason":"1-sentence reason","energyLevel":"peak|medium|low","sessionType":"focus|review|practice|break","estimatedProductivity":0-100,"conflictWarning":"string or null"}]`;

    return parseJSON<AITimeSlotSuggestion[]>(await callGemini(prompt, apiKey, 800, 0.5), [], true);
  },

  // ── Auto-Draft ──────────────────────────────────────────────────────────────
  async draftEventFromTitle(title: string, subject: string, eventType: string, apiKey: string): Promise<AIEventDraft> {
    const prompt = `Auto-fill study event. Title: "${title}" | Subject: "${subject}" | Type: ${eventType}
Return ONLY valid JSON:
{"title":"improved title","description":"1-2 sentence description","priority":"low|medium|high","estimatedDuration":minutes,"suggestedPrep":["s1","s2","s3"],"relatedTopics":["t1","t2"]}`;

    return parseJSON<AIEventDraft>(
      await callGemini(prompt, apiKey, 400, 0.6),
      { title, description: '', priority: 'medium', estimatedDuration: 60, suggestedPrep: [], relatedTopics: [] }
    );
  },

  // ── Personalized Insights (session-cached) ──────────────────────────────────
  async getPersonalizedInsights(
    studentName: string,
    upcoming: { title: string; date: Date; priority: string; eventType: string }[],
    completionRate: number,
    apiKey: string,
    cacheKey?: string
  ): Promise<AIInsight[]> {
    // Cache per student per session — saves API cost
    const key = cacheKey ? `insights_${cacheKey}` : null;
    if (key) {
      const cached = getCached<AIInsight[]>(key);
      if (cached) return cached;
    }

    const urgent = upcoming
      .filter(e => Math.ceil((e.date.getTime() - Date.now()) / 86400000) <= 7)
      .map(e => `${e.title} in ${Math.max(0, Math.ceil((e.date.getTime() - Date.now()) / 86400000))}d`);

    const prompt = `Generate 3-4 personalized study insights for ${studentName}.
Completion rate: ${completionRate}%. Urgent items: ${urgent.join(', ') || 'none'}.
Return ONLY valid JSON array:
[{"type":"warning|success|tip|motivation","title":"3-5 words","message":"max 90 chars","action":"short CTA or null"}]`;

    const result = parseJSON<AIInsight[]>(
      await callGemini(prompt, apiKey, 450, 0.8),
      [{ type: 'tip', title: 'Stay Consistent', message: 'Short daily sessions beat long cramming sessions every time.', action: 'Start Pomodoro' }],
      true
    );

    if (key) setCache(key, result);
    return result;
  },

  // ── AI Chat (warm, contextual, with calendar extraction) ────────────────────
  async chatWithAI(
    message: string,
    context: ChatContext,
    history: { role: 'user' | 'assistant'; content: string }[],
    apiKey: string
  ): Promise<ChatResponse> {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const goalsText = context.activeGoals.length
      ? context.activeGoals.map(g => `  • ${g.subject}: ${g.hoursNeeded}h needed, due ${g.targetDate}, ${g.progress}% done`).join('\n')
      : '  No active goals yet';

    const coursesText = context.enrolledCourses.length
      ? context.enrolledCourses.map(c => `  • ${c.title} (${c.subjects.slice(0,2).join(', ')}), ${c.totalLessons} lessons, ${c.progress}% complete`).join('\n')
      : '  No enrolled courses';

    const activitiesText = context.customActivities.length
      ? context.customActivities.map(a => `  • ${a.name}: ${a.days.join('/')} ${a.time} (${a.priority})`).join('\n')
      : '  No activities added';

    const systemPrompt = `You are Sage, ${context.studentName}'s personal AI study companion. You're like their smart, caring friend who genuinely wants them to succeed. You speak naturally, warmly, and practically — never robotic or overly formal.

About ${context.studentName} right now:
• Completion rate: ${context.completionRate}% | Study streak: ${context.streak} days | Pomodoros: ${context.pomodoroSessions}
• Active subjects: ${context.subjects.join(', ') || 'not set yet'}
• Upcoming exams: ${context.upcomingExams.join(', ') || 'none'}

Study Goals:
${goalsText}

Enrolled Courses:
${coursesText}

Daily Activities (blocked time):
${activitiesText}

Today: ${today}

IMPORTANT — When ${context.studentName} asks you to create a study plan, schedule, or timetable, you MUST include a machine-readable JSON block at the very end of your response using this EXACT format (no spaces inside the tags):
<!--PLAN_JSON
[{"title":"Session Name","date":"YYYY-MM-DD","startTime":"HH:MM","endTime":"HH:MM","subject":"Subject Name","eventType":"study_session","priority":"high","description":"What to do in this session"}]
PLAN_JSON-->

Tone guidelines:
- Speak like a real person, occasionally use their name but not every message
- Be specific and actionable — no vague platitudes
- Keep responses under 180 words UNLESS creating a full schedule
- If they ask for something unrealistic, gently say so and suggest a better approach
- Use light formatting with bullet points when listing things, but no excessive markdown
- Encourage without being cheesy`;

    const raw = await callGeminiChat(systemPrompt, history, message, apiKey, 750, 0.85);
    const { cleanResponse, events } = extractPlanJSON(raw);

    return {
      response: cleanResponse,
      calendarEvents: events.length > 0 ? events : undefined,
    };
  },

  // ── Study Tips (cached in memory by caller) ─────────────────────────────────
  async generateStudyTips(subject: string, eventType: string, apiKey: string): Promise<string[]> {
    const prompt = `3 specific, actionable study tips for: "${subject}" (${eventType}). Be concrete, not generic. Return ONLY JSON array: ["tip1","tip2","tip3"]`;
    return parseJSON<string[]>(
      await callGemini(prompt, apiKey, 250, 0.7),
      ['Review key concepts actively', 'Practice past questions', 'Summarize in your own words'],
      true
    );
  },

  // ── Task Prioritization ─────────────────────────────────────────────────────
  async prioritizeTasks(
    tasks: { id: string; title: string; dueDate: Date; estimatedHours: number; subject: string; priority: string }[],
    apiKey: string
  ): Promise<{ id: string; newPriority: 'low' | 'medium' | 'high'; urgencyScore: number; reason: string }[]> {
    const prompt = `Reprioritize tasks using Eisenhower matrix + deadline urgency.
${tasks.map(t => `${t.id}|${t.title}|due:${t.dueDate.toISOString().split('T')[0]}|${t.estimatedHours}h|${t.subject}|${t.priority}`).join('\n')}
Today: ${new Date().toISOString().split('T')[0]}
Return ONLY valid JSON array: [{"id":"string","newPriority":"low|medium|high","urgencyScore":0-100,"reason":"brief"}]`;

    return parseJSON<any[]>(
      await callGemini(prompt, apiKey, 900, 0.4),
      tasks.map(t => ({ id: t.id, newPriority: t.priority, urgencyScore: 50, reason: 'Manual' })),
      true
    );
  },

  // ── Weekly Digest ───────────────────────────────────────────────────────────
  async generateWeeklyDigestSummary(
    studentName: string,
    upcoming: { title: string; eventType: string; daysUntil: number; priority: string }[],
    completedThisWeek: number,
    totalThisWeek: number,
    streakDays: number,
    topSubjects: string[],
    apiKey: string
  ): Promise<WeeklyDigestAI> {
    const prompt = `Write a student weekly digest as a caring study coach.
Student: ${studentName} | Done: ${completedThisWeek}/${totalThisWeek} | Streak: ${streakDays}d | Subjects: ${topSubjects.join(', ') || 'various'}
Upcoming: ${upcoming.slice(0, 5).map(e => `${e.title}(${e.daysUntil}d,${e.priority})`).join(', ') || 'none'}
Return ONLY valid JSON:
{"summary":"2-3 sentence personalized overview","tips":["t1","t2","t3"],"urgentItems":["item if <=3d else empty array"],"motivationalMessage":"one warm sentence"}`;

    return parseJSON<WeeklyDigestAI>(
      await callGemini(prompt, apiKey, 600, 0.75),
      { summary: `Hi ${studentName}, here's your weekly study digest.`, tips: ['Review notes daily', 'Use active recall', 'Take regular breaks'], urgentItems: [], motivationalMessage: 'Every study session brings you closer to your goals!' }
    );
  },

  // ── Study Pattern Analysis ──────────────────────────────────────────────────
  async analyzeStudyPatterns(
    sessions: PomodoroSession[],
    events: { date: Date; eventType: string; course: string; isPersonal: boolean }[],
    apiKey: string
  ): Promise<StudyAnalytics> {
    const summary = sessions.slice(-30)
      .map(s => `${s.subject}:${s.duration}min`)
      .join(', ');

    const prompt = `Analyze student study data briefly.
Sessions (last 30d): ${summary || 'none'}. Total events: ${events.length}.
Return ONLY valid JSON:
{"weeklyHours":number,"subjectDistribution":[{"subject":"s","hours":number,"color":"#hex"}],"productivityScore":0-100,"streakDays":number,"completionRate":0-100,"insights":["i1","i2","i3"],"recommendations":["r1","r2","r3"]}`;

    return parseJSON<StudyAnalytics>(
      await callGemini(prompt, apiKey, 800, 0.5),
      { weeklyHours: 0, subjectDistribution: [], productivityScore: 50, streakDays: 0, completionRate: 0, insights: ['Start tracking sessions to get AI insights!'], recommendations: ['Add your first Pomodoro session'] }
    );
  },
};
