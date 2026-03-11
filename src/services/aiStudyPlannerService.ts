// src/services/aiStudyPlannerService.ts
// Multi-provider AI — Smart Schedule · Time Slots · Auto-Draft · Chat · Digest
// Provider configured in Firestore via Admin → AI Model Settings
// Supports: Gemini · Groq · OpenAI · Anthropic · DeepSeek
// v3: Minerva — full planner context, goal creation, OCR image support, human-like conversation

import { aiModelConfigService, callProviderDirect, callWithFailover, AIModelConfig, AIFeatureId } from './aiModelConfigService';

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

// CalendarEventFromChat — events the AI creates during chat
export interface CalendarEventFromChat {
  title: string;
  date: string;           // YYYY-MM-DD
  startTime: string;      // HH:MM
  endTime: string;        // HH:MM
  subject: string;
  eventType?: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
}

// GoalFromChat — study goals the AI creates during chat
export interface GoalFromChat {
  subject: string;
  targetDate: string;     // YYYY-MM-DD
  hoursNeeded: number;
  difficulty: 'easy' | 'medium' | 'hard';
  description?: string;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function resolveConfig(legacyKey = ''): Promise<AIModelConfig> {
  if (legacyKey) return { provider: 'gemini', model: 'gemini-2.0-flash', apiKey: legacyKey };
  return aiModelConfigService.getConfig();
}

async function callAI(
  prompt: string,
  maxTokens = 2048,
  temp = 0.7,
  legacyKey = '',
  featureId: AIFeatureId = 'study_schedule'
): Promise<string> {
  if (legacyKey) {
    return callProviderDirect(prompt, { provider: 'gemini', model: 'gemini-2.0-flash', apiKey: legacyKey }, maxTokens, temp);
  }
  return callWithFailover(prompt, featureId, maxTokens, temp);
}

// Robust JSON parser — handles markdown fences, extra text, nested structures
function parseJSON<T>(raw: string, fallback: T, isArray = false): T {
  if (!raw) return fallback;
  try {
    let cleaned = raw.replace(/```(?:json)?\s*([\s\S]*?)```/g, '$1').trim();
    try { return JSON.parse(cleaned) as T; } catch { /* continue */ }
    const pattern = isArray ? /\[[\s\S]*\]/ : /\{[\s\S]*\}/;
    const m = cleaned.match(pattern);
    if (m) return JSON.parse(m[0]) as T;
    const m2 = raw.match(pattern);
    if (m2) return JSON.parse(m2[0]) as T;
    return fallback;
  } catch {
    return fallback;
  }
}

// Session-level insights cache (keyed by studentId)
const _insightsCache: Record<string, { data: AIInsight[]; ts: number }> = {};
const INSIGHTS_TTL = 30 * 60 * 1000; // 30 min

// ─── Service ──────────────────────────────────────────────────────────────────

export const aiStudyPlannerService = {

  // ── Smart schedule ──────────────────────────────────────────────────────────

  async generateSmartSchedule(
    goals: StudyGoal[],
    existing: { date: Date; startTime: string; endTime: string }[],
    hoursPerDay: number,
    apiKey = '',
    options?: {
      enrolledCourses?: { title: string; subjects: string[] }[];
      customActivities?: { name: string; daysOfWeek: number[]; startTime: string; endTime: string; isFlexible: boolean }[];
      nowDateTime?: Date;
      timeRanges?: { start: string; end: string }[];
    }
  ): Promise<AIScheduleSuggestion[]> {
    const now         = options?.nowDateTime ?? new Date();
    const todayStr    = now.toISOString().slice(0, 10);
    const currentTime = now.toTimeString().slice(0, 5);

    const rangesDesc = options?.timeRanges?.length
      ? options.timeRanges.map(r => `${r.start}–${r.end}`).join(', ')
      : null;
    const timeRangesRule = rangesDesc
      ? `\nSCHEDULING WINDOWS: Sessions MUST fall within these time ranges each day: ${rangesDesc}. Do not schedule outside these windows.`
      : '';

    const courseCtx = options?.enrolledCourses?.length
      ? `\nEnrolled courses: ${options.enrolledCourses.map(c => `${c.title} (${c.subjects.join(', ')})`).join('; ')}`
      : '';
    const activityCtx = options?.customActivities?.length
      ? `\nFixed activities (avoid scheduling over these unless flexible):\n${options.customActivities.map(a =>
          `- ${a.name}: days ${a.daysOfWeek.join(',')} ${a.startTime}-${a.endTime}${a.isFlexible ? ' (flexible)' : ' (fixed)'}`
        ).join('\n')}`
      : '';

    const prompt = `You are an expert AI study planner using spaced repetition + cognitive load theory.

TODAY: ${todayStr} | CURRENT TIME: ${currentTime}
⚠️ CRITICAL TIME RULES:
- Do NOT schedule any session on ${todayStr} that starts before ${currentTime}.
- Do NOT schedule any session on a date that has already passed.
- All sessions must be on ${todayStr} or later.
TITLE FORMAT: Use exactly "<Subject> — Session N" (e.g. "Math — Session 1", "Physics — Session 2"). Never invent subtopics, chapters, or specific problems.${timeRangesRule}

Goals:
${goals.map(g => `- ${g.subject}: ${g.hoursNeeded}h needed, deadline ${g.targetDate.toISOString().split('T')[0]}, difficulty: ${g.difficulty}, progress: ${g.currentProgress}%`).join('\n')}

Existing commitments:
${existing.map(e => `- ${e.date.toISOString().split('T')[0]} ${e.startTime}-${e.endTime}`).join('\n') || 'None'}
${courseCtx}${activityCtx}

Available: ${hoursPerDay}h/day.

Rules: morning=hard topics, afternoon=review, vary focus/review/practice, space across days, prioritize by urgency×difficulty. Sessions are 60–90 minutes each.

Return ONLY a valid JSON array with no markdown, no explanation:
[{"title":"string","subject":"string","date":"YYYY-MM-DD","startTime":"HH:MM","endTime":"HH:MM","reason":"string","priority":"low|medium|high","sessionType":"focus|review|practice|break","tips":["t1","t2"]}]`;

    const raw = await callAI(prompt, 3000, 0.6, apiKey, 'study_schedule');
    const parsed = parseJSON<any[]>(raw, [], true);
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('AI returned no schedule. Try adjusting your goals or free hours.');
    return parsed.map((s: any) => ({ ...s, date: new Date(s.date) }));
  },

  // ── Time slot suggestions ───────────────────────────────────────────────────

  async suggestTimeSlots(
    eventTitle: string,
    eventType: string,
    subject: string,
    durationMins: number,
    preferredDate: string,
    existingOnDay: { startTime: string; endTime: string; title: string }[],
    prefs: { preferMorning: boolean; preferEvening: boolean; peakHour?: number },
    apiKey = ''
  ): Promise<AITimeSlotSuggestion[]> {
    const busy = existingOnDay.map(e => `  ${e.startTime}-${e.endTime} (${e.title})`).join('\n') || '  None';
    const prompt = `Suggest exactly 3 optimal time slots for a study event.

Event: "${eventTitle}" | Type: ${eventType} | Subject: ${subject} | Duration: ${durationMins}min | Date: ${preferredDate}
Busy times:
${busy}
Preferences: morning=${prefs.preferMorning}, evening=${prefs.preferEvening}, peak hour=${prefs.peakHour ?? 'unknown'}

Rules: exams/hard topics → peak energy (morning), reviews → afternoon, practice → evening ok, 15min buffer between slots, never past 23:00.

Return ONLY a valid JSON array of exactly 3 objects with no markdown, no explanation:
[{"date":"YYYY-MM-DD","startTime":"HH:MM","endTime":"HH:MM","reason":"one sentence","energyLevel":"peak|medium|low","sessionType":"focus|review|practice|break","estimatedProductivity":75,"conflictWarning":null}]`;

    const raw = await callAI(prompt, 1024, 0.5, apiKey, 'study_slots');
    const parsed = parseJSON<AITimeSlotSuggestion[]>(raw, [], true);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('AI returned no time slots. Check your AI model settings or try again.');
    }
    return parsed;
  },

  // ── Auto-draft event from title ─────────────────────────────────────────────

  async draftEventFromTitle(title: string, subject: string, eventType: string, apiKey = ''): Promise<AIEventDraft> {
    const prompt = `Auto-fill study event details.
Title: "${title}" | Subject: "${subject}" | Type: ${eventType}
Return ONLY a valid JSON object with no markdown:
{"title":"improved title","description":"1-2 sentence description","priority":"low|medium|high","estimatedDuration":60,"suggestedPrep":["step1","step2","step3"],"relatedTopics":["topic1","topic2"]}`;

    return parseJSON<AIEventDraft>(
      await callAI(prompt, 512, 0.6, apiKey, 'study_draft'),
      { title, description: '', priority: 'medium', estimatedDuration: 60, suggestedPrep: [], relatedTopics: [] }
    );
  },

  // ── Personalised insights ───────────────────────────────────────────────────

  async getPersonalizedInsights(
    studentName: string,
    upcoming: { title: string; date: Date; priority: string; eventType: string }[],
    completionRate: number,
    apiKey = '',
    cacheKey?: string
  ): Promise<AIInsight[]> {
    if (cacheKey) {
      const cached = _insightsCache[cacheKey];
      if (cached && Date.now() - cached.ts < INSIGHTS_TTL) return cached.data;
    }

    const urgent = upcoming
      .filter(e => Math.ceil((e.date.getTime() - Date.now()) / 86400000) <= 7)
      .map(e => `${e.title} in ${Math.ceil((e.date.getTime() - Date.now()) / 86400000)}d`);

    const prompt = `Generate 3-4 personalized study insights for a student.
Student: ${studentName} | Completion rate: ${completionRate}% | Urgent items: ${urgent.join(', ') || 'none'}
Return ONLY a valid JSON array with no markdown:
[{"type":"warning|success|tip|motivation","title":"3-5 word title","message":"max 100 chars","action":"CTA string or null"}]`;

    const result = parseJSON<AIInsight[]>(
      await callAI(prompt, 512, 0.8, apiKey, 'study_insights'),
      [{ type: 'tip', title: 'Stay Consistent', message: 'Short daily sessions beat long cramming.', action: 'Start Pomodoro' }],
      true
    );

    if (cacheKey) _insightsCache[cacheKey] = { data: result, ts: Date.now() };
    return result;
  },

  // ── AI Chat (Minerva) ───────────────────────────────────────────────────────
  // Returns response + optional calendar events + optional goals to add

  async chatWithAI(
    message: string,
    context: {
      studentName?: string;
      totalEvents?: number;
      events?: number;
      subjects: string[];
      upcomingExams: string[];
      enrolledCourses?: { title: string; subjects: string[]; totalLessons?: number; progress?: number }[];
      customActivities?: { name: string; days?: string[]; time?: string; priority?: string }[];
      activeGoals?: { subject: string; targetDate: string; hoursNeeded: number; progress: number }[];
      completionRate?: number;
      streak?: number;
      pomodoroSessions?: number;
      // NEW: rich schedule context
      freeTimeInfo?: string;               // e.g. "14:00–22:00 (8h free)" or "4h/day flexible"
      dailySchedule?: {                    // upcoming sessions next 7 days
        date: string;
        dayLabel: string;
        sessions: { title: string; startTime: string; endTime: string; subject: string }[];
        activitiesBlocked: { name: string; startTime: string; endTime: string }[];
        freeSlotsCount: number;
      }[];
      imageContext?: string;               // OCR-extracted text from uploaded image/routine
    },
    history: { role: 'user' | 'assistant'; content: string }[],
    apiKey = ''
  ): Promise<{ response: string; calendarEvents: CalendarEventFromChat[]; goals: GoalFromChat[] }> {
    const name = context.studentName || 'Student';
    const totalEvents = context.totalEvents ?? context.events ?? 0;
    const today = new Date().toISOString().split('T')[0];

    // Smart history: keep last 10 messages, always include the most recent assistant message for continuity
    const hist = history.slice(-10).map(m =>
      `${m.role === 'user' ? name : 'Minerva'}: ${m.content}`
    ).join('\n');

    // Build context blocks
    const courseCtx = context.enrolledCourses?.length
      ? `\nCourses enrolled: ${context.enrolledCourses.map(c => `${c.title} (${c.progress ?? 0}% done, ${c.totalLessons ?? '?'} lessons)`).join('; ')}`
      : '';

    const activityCtx = context.customActivities?.length
      ? `\nRegular activities (unavailable times): ${context.customActivities.map(a => `${a.name} on ${a.days?.join('/')} ${a.time} (${a.priority})`).join('; ')}`
      : '';

    const goalCtx = context.activeGoals?.length
      ? `\nStudy goals: ${context.activeGoals.map(g => `"${g.subject}" — ${g.progress}% done, due ${g.targetDate}, ${g.hoursNeeded}h needed`).join('; ')}`
      : '\nNo active study goals yet.';

    const freeTimeCtx = context.freeTimeInfo
      ? `\nFree study time: ${context.freeTimeInfo}`
      : '';

    const scheduleCtx = context.dailySchedule?.length
      ? `\nUpcoming 7-day schedule:\n${context.dailySchedule.map(d => {
          const sessions = d.sessions.length
            ? d.sessions.map(s => `  • ${s.startTime}–${s.endTime}: ${s.title}`).join('\n')
            : '  (no sessions)';
          const blocked = d.activitiesBlocked.length
            ? ` | Blocked: ${d.activitiesBlocked.map(a => `${a.name} ${a.startTime}–${a.endTime}`).join(', ')}`
            : '';
          return `${d.dayLabel} (${d.date})${blocked}:\n${sessions}`;
        }).join('\n')}`
      : '';

    const imageCtx = context.imageContext
      ? `\n\n📸 STUDENT UPLOADED A ROUTINE/SCHEDULE IMAGE. OCR Extracted text:\n---\n${context.imageContext}\n---\nUse this to understand their exam schedule, class timetable, or routine. Plan around it.`
      : '';

    const prompt = `You are Minerva, a warm and intelligent AI study companion. You speak like a knowledgeable friend — natural, encouraging, never robotic. You know this student deeply and care about their success.

STUDENT PROFILE:
Name: ${name}
Today: ${today}
Events on platform: ${totalEvents}
Completion rate: ${context.completionRate ?? 0}%
Study streak: ${context.streak ?? 0} days
Pomodoro sessions: ${context.pomodoroSessions ?? 0}
Subjects: ${context.subjects.join(', ') || 'none yet'}
Upcoming exams: ${context.upcomingExams.join(', ') || 'none'}${courseCtx}${activityCtx}${goalCtx}${freeTimeCtx}${scheduleCtx}${imageCtx}

CONVERSATION HISTORY:
${hist || '(no prior conversation)'}

${name}: ${message}

YOUR CAPABILITIES:
1. Create study sessions/events → populate calendarEvents array
2. Create study goals → populate goals array
3. Give personalized advice, motivation, study tips
4. Plan around the student's free time windows and blocked activities
5. Read and use uploaded routine/schedule images

RULES FOR CREATING CONTENT:
- For a GOAL, you need: subject name, target date (YYYY-MM-DD), estimated hours needed, difficulty (easy/medium/hard)
- For an EVENT/SESSION, you need: title, date (YYYY-MM-DD), start/end time (HH:MM), subject
- If the student's request is missing required info, ask for ONLY the missing piece naturally (like a friend would). Don't list requirements robotically.
- If student uploaded a schedule image, extract relevant dates/subjects and use them to suggest a smart plan
- Never schedule anything before today (${today})
- Keep responses under 180 words unless explaining something complex
- Sound warm and personal — use the student's name occasionally, reference their specific courses/goals
- If you already have enough info to create something, do it immediately and tell them naturally

TONE: Warm, smart, personal. Like a senior student friend who also happens to be an expert planner. Not a robot, not a formal tutor.

Respond ONLY with this exact JSON (no markdown, no extra text):
{"response":"your message to the student","calendarEvents":[],"goals":[]}

If creating events:
"calendarEvents":[{"title":"Session Title","date":"YYYY-MM-DD","startTime":"HH:MM","endTime":"HH:MM","subject":"Subject Name","eventType":"study_session","description":"brief note","priority":"medium"}]

If creating goals:
"goals":[{"subject":"Subject Name","targetDate":"YYYY-MM-DD","hoursNeeded":20,"difficulty":"medium","description":"optional note"}]`;

    const raw = await callAI(prompt, 900, 0.75, apiKey, 'study_chat');

    const parsed = parseJSON<{ response: string; calendarEvents: CalendarEventFromChat[]; goals: GoalFromChat[] }>(
      raw,
      { response: '', calendarEvents: [], goals: [] }
    );

    const responseText = parsed.response || raw.replace(/```json[\s\S]*?```/g, '').replace(/\{[\s\S]*\}/g, '').trim() || raw;
    const calendarEvents = Array.isArray(parsed.calendarEvents) ? parsed.calendarEvents : [];
    const goals = Array.isArray(parsed.goals) ? parsed.goals : [];

    return { response: responseText, calendarEvents, goals };
  },

  // ── Prioritize tasks ────────────────────────────────────────────────────────

  async prioritizeTasks(
    tasks: { id: string; title: string; dueDate: Date; estimatedHours: number; subject: string; priority: string }[],
    apiKey = ''
  ): Promise<{ id: string; newPriority: 'low' | 'medium' | 'high'; urgencyScore: number; reason: string }[]> {
    const prompt = `Reprioritize tasks using Eisenhower matrix + deadline urgency.
${tasks.map(t => `${t.id}|${t.title}|due:${t.dueDate.toISOString().split('T')[0]}|${t.estimatedHours}h|${t.subject}|${t.priority}`).join('\n')}
Today: ${new Date().toISOString().split('T')[0]}
Return ONLY a valid JSON array with no markdown:
[{"id":"string","newPriority":"low|medium|high","urgencyScore":0-100,"reason":"brief reason"}]`;

    return parseJSON<any[]>(
      await callAI(prompt, 1024, 0.4, apiKey, 'study_prioritize'),
      tasks.map(t => ({ id: t.id, newPriority: t.priority, urgencyScore: 50, reason: 'Manual' })),
      true
    );
  },

  // ── Study tips ──────────────────────────────────────────────────────────────

  async generateStudyTips(subject: string, eventType: string, apiKey = ''): Promise<string[]> {
    const prompt = `Give 3 specific actionable study tips for: "${subject}" (${eventType}).
Return ONLY a valid JSON array with no markdown:
["tip one here","tip two here","tip three here"]`;
    return parseJSON<string[]>(
      await callAI(prompt, 256, 0.7, apiKey, 'study_tips'),
      ['Review key concepts', 'Practice past questions', 'Summarize in your own words'],
      true
    );
  },

  // ── Weekly digest ───────────────────────────────────────────────────────────

  async generateWeeklyDigestSummary(
    studentName: string,
    upcoming: { title: string; eventType: string; daysUntil: number; priority: string }[],
    completedThisWeek: number,
    totalThisWeek: number,
    streakDays: number,
    topSubjects: string[],
    apiKey = ''
  ): Promise<WeeklyDigestAI> {
    const prompt = `Write a student's weekly digest as a study coach.
Student: ${studentName} | Done: ${completedThisWeek}/${totalThisWeek} | Streak: ${streakDays}d | Subjects: ${topSubjects.join(', ') || 'various'}
Upcoming: ${upcoming.slice(0, 6).map(e => `${e.title}(${e.daysUntil}d,${e.priority})`).join(', ') || 'none'}
Return ONLY a valid JSON object with no markdown:
{"summary":"2-3 sentence personalized overview","tips":["t1","t2","t3"],"urgentItems":["item if <=3d, else empty array"],"motivationalMessage":"one warm sentence"}`;

    return parseJSON<WeeklyDigestAI>(
      await callAI(prompt, 768, 0.75, apiKey, 'study_digest'),
      { summary: `Hi ${studentName}, here's your weekly digest.`, tips: ['Review notes daily', 'Use active recall', 'Take breaks'], urgentItems: [], motivationalMessage: 'Keep it up!' }
    );
  },

  // ── Analyze study patterns ──────────────────────────────────────────────────

  async analyzeStudyPatterns(
    sessions: PomodoroSession[],
    events: { date: Date; eventType: string; course: string; isPersonal: boolean }[],
    apiKey = ''
  ): Promise<StudyAnalytics> {
    const summary = sessions.slice(-30).map(s => `${s.subject}:${s.duration}min on ${s.startTime.toISOString().split('T')[0]}`).join('\n');
    const prompt = `Analyze student study data.
Sessions (last 30d): ${summary || 'none'}
Events: ${events.length}
Return ONLY a valid JSON object with no markdown:
{"weeklyHours":0,"subjectDistribution":[{"subject":"name","hours":0,"color":"#6366f1"}],"productivityScore":0-100,"streakDays":0,"completionRate":0-100,"insights":["i1","i2","i3"],"recommendations":["r1","r2","r3"]}`;

    return parseJSON<StudyAnalytics>(
      await callAI(prompt, 1024, 0.5, apiKey, 'study_patterns'),
      { weeklyHours: 0, subjectDistribution: [], productivityScore: 50, streakDays: 0, completionRate: 0, insights: ['Start tracking to get AI insights!'], recommendations: ['Add your first session'] }
    );
  },
};
