// src/services/aiStudyPlannerService.ts
// Advanced AI Study Planner Service using Gemini API

export interface StudyGoal {
  subject: string;
  targetDate: Date;
  hoursNeeded: number;
  difficulty: 'easy' | 'medium' | 'hard';
  currentProgress: number; // 0-100
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

export interface StudyAnalytics {
  weeklyHours: number;
  subjectDistribution: { subject: string; hours: number; color: string }[];
  productivityScore: number;
  streakDays: number;
  completionRate: number;
  insights: string[];
  recommendations: string[];
}

export interface AIInsight {
  type: 'warning' | 'success' | 'tip' | 'motivation';
  title: string;
  message: string;
  action?: string;
}

export interface PomodoroSession {
  id: string;
  subject: string;
  startTime: Date;
  duration: number; // minutes
  completed: boolean;
  notes: string;
}

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

export const aiStudyPlannerService = {
  async generateSmartSchedule(
    goals: StudyGoal[],
    existingEvents: { date: Date; startTime: string; endTime: string }[],
    availableHoursPerDay: number,
    apiKey: string
  ): Promise<AIScheduleSuggestion[]> {
    const prompt = `You are an expert AI study planner. Generate an optimized study schedule.

Student Goals:
${goals.map(g => `- ${g.subject}: needs ${g.hoursNeeded}h, deadline ${g.formatDate?.(g.targetDate) || g.targetDate.toISOString().split('T')[0]}, difficulty: ${g.difficulty}, progress: ${g.currentProgress}%`).join('\n')}

Existing commitments:
${existingEvents.map(e => `- ${e.date.toISOString().split('T')[0]} ${e.startTime}-${e.endTime}`).join('\n')}

Available hours per day: ${availableHoursPerDay}h
Today: ${new Date().toISOString().split('T')[0]}

Return ONLY valid JSON array (no markdown) of study sessions for next 7 days:
[{
  "title": "string",
  "subject": "string", 
  "date": "YYYY-MM-DD",
  "startTime": "HH:MM",
  "endTime": "HH:MM",
  "reason": "why this time is optimal",
  "priority": "low|medium|high",
  "sessionType": "focus|review|practice|break",
  "tips": ["tip1", "tip2"]
}]

Use spaced repetition, prioritize deadlines, vary session types.`;

    const raw = await callGemini(prompt, apiKey);
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    return parsed.map((s: any) => ({
      ...s,
      date: new Date(s.date),
    }));
  },

  async analyzeStudyPatterns(
    completedSessions: PomodoroSession[],
    events: { date: Date; eventType: string; course: string; isPersonal: boolean }[],
    apiKey: string
  ): Promise<StudyAnalytics> {
    const sessionsSummary = completedSessions
      .slice(-30)
      .map(s => `${s.subject}: ${s.duration}min on ${s.startTime.toISOString().split('T')[0]}`)
      .join('\n');

    const prompt = `Analyze this student's study data and return insights.

Completed study sessions (last 30 days):
${sessionsSummary || 'No sessions recorded yet'}

Scheduled events: ${events.length} total

Return ONLY valid JSON (no markdown):
{
  "weeklyHours": number,
  "subjectDistribution": [{"subject": "string", "hours": number, "color": "#hexcolor"}],
  "productivityScore": number (0-100),
  "streakDays": number,
  "completionRate": number (0-100),
  "insights": ["insight1", "insight2", "insight3"],
  "recommendations": ["rec1", "rec2", "rec3"]
}`;

    try {
      const raw = await callGemini(prompt, apiKey);
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON');
      return JSON.parse(jsonMatch[0]);
    } catch {
      return {
        weeklyHours: 0,
        subjectDistribution: [],
        productivityScore: 50,
        streakDays: 0,
        completionRate: 0,
        insights: ['Start tracking your sessions to get AI insights!'],
        recommendations: ['Add your first study session to begin analysis'],
      };
    }
  },

  async getPersonalizedInsights(
    studentName: string,
    upcomingEvents: { title: string; date: Date; priority: string; eventType: string }[],
    completionRate: number,
    apiKey: string
  ): Promise<AIInsight[]> {
    const urgentEvents = upcomingEvents
      .filter(e => {
        const daysUntil = Math.ceil((e.date.getTime() - Date.now()) / 86400000);
        return daysUntil <= 7;
      })
      .map(e => `${e.title} (${e.eventType}) in ${Math.ceil((e.date.getTime() - Date.now()) / 86400000)} days`);

    const prompt = `Generate 3-4 personalized study insights for a student.

Student: ${studentName}
Completion rate: ${completionRate}%
Urgent upcoming (within 7 days): ${urgentEvents.join(', ') || 'none'}

Return ONLY valid JSON array:
[{
  "type": "warning|success|tip|motivation",
  "title": "short title",
  "message": "helpful message (max 100 chars)",
  "action": "optional action text"
}]`;

    try {
      const raw = await callGemini(prompt, apiKey);
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('No JSON');
      return JSON.parse(jsonMatch[0]);
    } catch {
      return [
        {
          type: 'tip',
          title: 'Stay Consistent',
          message: 'Regular study sessions of 25-50 minutes are more effective than long cramming sessions.',
          action: 'Start Pomodoro',
        },
      ];
    }
  },

  async chatWithAI(
    message: string,
    context: { events: number; subjects: string[]; upcomingExams: string[] },
    chatHistory: { role: 'user' | 'assistant'; content: string }[],
    apiKey: string
  ): Promise<string> {
    const historyText = chatHistory
      .slice(-6)
      .map(m => `${m.role === 'user' ? 'Student' : 'AI Tutor'}: ${m.content}`)
      .join('\n');

    const prompt = `You are an expert AI study assistant for an EdTech platform. Be helpful, encouraging, and concise.

Student context:
- Total scheduled events: ${context.events}
- Subjects: ${context.subjects.join(', ') || 'not specified'}
- Upcoming exams: ${context.upcomingExams.join(', ') || 'none'}

Recent conversation:
${historyText}

Student: ${message}

Respond as AI Tutor (max 200 words, be actionable and supportive):`;

    return callGemini(prompt, apiKey);
  },

  async prioritizeTasks(
    tasks: { id: string; title: string; dueDate: Date; estimatedHours: number; subject: string; priority: string }[],
    apiKey: string
  ): Promise<{ id: string; newPriority: 'low' | 'medium' | 'high'; urgencyScore: number; reason: string }[]> {
    const prompt = `Reprioritize these study tasks using Eisenhower matrix + deadline urgency.

Tasks:
${tasks.map(t => `ID:${t.id} | ${t.title} | due:${t.dueDate.toISOString().split('T')[0]} | est:${t.estimatedHours}h | subject:${t.subject} | current:${t.priority}`).join('\n')}

Today: ${new Date().toISOString().split('T')[0]}

Return ONLY valid JSON array:
[{"id": "string", "newPriority": "low|medium|high", "urgencyScore": number(0-100), "reason": "brief reason"}]`;

    try {
      const raw = await callGemini(prompt, apiKey);
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('No JSON');
      return JSON.parse(jsonMatch[0]);
    } catch {
      return tasks.map(t => ({ id: t.id, newPriority: t.priority as any, urgencyScore: 50, reason: 'Manual priority' }));
    }
  },

  async generateStudyTips(subject: string, eventType: string, apiKey: string): Promise<string[]> {
    const prompt = `Give 3 specific, actionable study tips for: ${subject} (${eventType}).
Return ONLY a JSON array of strings: ["tip1", "tip2", "tip3"]`;

    try {
      const raw = await callGemini(prompt, apiKey);
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('No JSON');
      return JSON.parse(jsonMatch[0]);
    } catch {
      return ['Review key concepts', 'Practice with past questions', 'Summarize in your own words'];
    }
  },
};
