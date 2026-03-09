
// src/services/studySchedulerService.ts
// Deterministic Study Planner — zero AI, zero network calls, instant results.
// NEW: Topic-aware sessions — sessions show topic names and respect min/max hours per topic.
//
// ALGORITHM OVERVIEW
// ------------------
// 1. For each goal: compute exact hours remaining by measuring real completed
//    session durations + partial credit + manual progress floor.
//    If goal has topics[], total hours = sum of allocated topic hours (based on studyMode).
// 2. Build a timeline of "free blocks" per day:
//      base free windows -> subtract custom activities -> subtract existing events
//      -> clamp today's blocks to (now + 30 min)
// 3. Assign sessions via urgency-ordered day-filling (round-robin + deadline priority)
// 4. Topic-aware naming: sessions are titled with the specific topic being studied.
//    Topics are consumed in order; a session may span topic boundaries.

import { StudyGoal, StudyPlanEvent, CustomActivity, GoalTopic } from './studyPlanService';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface TimeRange {
  start: string;
  end:   string;
}

export interface SchedulerInput {
  goals:            StudyGoal[];
  existingEvents:   StudyPlanEvent[];
  customActivities: CustomActivity[];
  freeTimeMode:     'hours' | 'range';
  freeHoursPerDay:  number;
  freeTimeRanges:   TimeRange[];
  now:              Date;
  studentId:        string;
}

export interface ScheduledSession {
  subject:         string;
  title:           string;
  date:            Date;
  startTime:       string;
  endTime:         string;
  sessionType:     'focus' | 'review' | 'practice';
  priority:        'low' | 'medium' | 'high';
  reason:          string;
  durationMins:    number;
  topicName?:      string;     // ── NEW: specific topic being studied
  topicsIncluded?: string[];   // ── NEW: all topics covered if session spans multiple
}

export interface GoalScheduleStats {
  goalId:          string;
  subject:         string;
  hoursNeeded:     number;
  hoursCompleted:  number;
  hoursLeft:       number;
  hoursScheduled:  number;
  progressPct:     number;
  completedCount:  number;
  newSessionCount: number;
  nextSessionNum:  number;
  canFullyCover:   boolean;
}

export interface ScheduleResult {
  sessions:  ScheduledSession[];
  goalStats: GoalScheduleStats[];
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface TopicQueueItem {
  name:     string;
  minsLeft: number;
}

interface GoalWork {
  goal:           StudyGoal;
  hoursLeft:      number;
  minsLeft:       number;
  hoursCompleted: number;
  nextSessionNum: number;
  completedCount: number;
  urgency:        number;
  priority:       'low' | 'medium' | 'high';
  daysLeft:       number;
  typeIdx:        number;
  newSessions:    number;
  minsScheduled:  number;
  topicQueue:     TopicQueueItem[];  // ── NEW: ordered topic queue (empty if no topics)
}

interface Block {
  startMins: number;
  endMins:   number;
}

interface DaySlot {
  date:       Date;
  dateStr:    string;
  freeBlocks: Block[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_SESSION_MINS = 60;
const MAX_SESSION_MINS = 120;
const GAP_MINS         = 10;
const SNAP_MINS        = 15;
const MAX_DAYS_AHEAD   = 90;

const SESSION_TYPES = ['focus', 'practice', 'review'] as const;
type SessionType = typeof SESSION_TYPES[number];

const REASONS: Record<SessionType, string[]> = {
  focus: [
    'Build deep understanding of new concepts.',
    'Work through core theory and take structured notes.',
    'Tackle the hardest material while your mind is fresh.',
  ],
  practice: [
    'Solve problems and apply what you have learned.',
    'Work through exercises to reinforce understanding.',
    'Test yourself with practice questions.',
  ],
  review: [
    'Consolidate knowledge and close any remaining gaps.',
    'Revisit key topics and self-quiz.',
    'Reinforce what you know and identify weak spots before the deadline.',
  ],
};

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function toMins(hhmm: string): number {
  if (!hhmm) return 0;
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function fromMins(mins: number): string {
  const h = Math.floor(Math.max(0, mins) / 60) % 24;
  const m = Math.max(0, mins) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function calendarDayDiff(a: Date, b: Date): number {
  const ms =
    new Date(toDateStr(a) + 'T00:00:00').getTime() -
    new Date(toDateStr(b) + 'T00:00:00').getTime();
  return Math.round(ms / 86400000);
}

function snapToGrid(mins: number, grid = SNAP_MINS): number {
  return Math.round(mins / grid) * grid;
}

// ---------------------------------------------------------------------------
// Block arithmetic
// ---------------------------------------------------------------------------

function subtractBlocks(base: Block[], remove: Block[], minLen = 1): Block[] {
  let result = [...base];
  for (const rm of remove) {
    const next: Block[] = [];
    for (const b of result) {
      if (rm.endMins <= b.startMins || rm.startMins >= b.endMins) {
        next.push(b);
      } else {
        if (rm.startMins > b.startMins)
          next.push({ startMins: b.startMins, endMins: rm.startMins });
        if (rm.endMins < b.endMins)
          next.push({ startMins: rm.endMins, endMins: b.endMins });
      }
    }
    result = next;
  }
  return result.filter(b => b.endMins - b.startMins >= minLen);
}

// ---------------------------------------------------------------------------
// Topic queue builder — NEW
// Converts goal.topics[] into an ordered queue of { name, minsLeft }
// based on the goal's studyMode (first_reading uses maxHours, revision uses closer to minHours)
// ---------------------------------------------------------------------------

function buildTopicQueue(goal: StudyGoal): TopicQueueItem[] {
  if (!goal.topics || goal.topics.length === 0) return [];
  return goal.topics.map((t: GoalTopic) => {
    let allocHours: number;
    if (goal.studyMode === 'first_reading') {
      allocHours = t.maxHours;
    } else if (goal.studyMode === 'revision') {
      // Revision: closer to minHours — use min + 25% of the min→max spread
      allocHours = t.minHours + (t.maxHours - t.minHours) * 0.25;
    } else {
      allocHours = (t.minHours + t.maxHours) / 2;
    }
    return { name: t.name, minsLeft: Math.max(30, Math.round(allocHours * 60)) };
  });
}

/**
 * Compute total allocated hours from topics (based on studyMode).
 * Used to override goal.hoursNeeded when topics are present.
 */
function computeTopicTotalHours(goal: StudyGoal): number {
  if (!goal.topics || goal.topics.length === 0) return goal.hoursNeeded;
  return goal.topics.reduce((sum, t) => {
    let h: number;
    if (goal.studyMode === 'first_reading') h = t.maxHours;
    else if (goal.studyMode === 'revision') h = t.minHours + (t.maxHours - t.minHours) * 0.25;
    else h = (t.minHours + t.maxHours) / 2;
    return sum + h;
  }, 0);
}

// ---------------------------------------------------------------------------
// Per-goal work computation
// ---------------------------------------------------------------------------

interface GoalWorkRaw {
  hoursCompleted:  number;
  hoursLeft:       number;
  completedCount:  number;
  nextSessionNum:  number;
}

function computeGoalWork(goal: StudyGoal, allEvents: StudyPlanEvent[]): GoalWorkRaw {
  const base = goal.subject.split(' (')[0].toLowerCase().trim();

  const mine = allEvents.filter(e => {
    const c = (e.course || '').toLowerCase().trim();
    const t = (e.title  || '').toLowerCase();
    return c === base || c.startsWith(base) || base.startsWith(c) || t.startsWith(base);
  });

  let completedHours = 0;
  let completedCount = 0;
  let partialCredit  = 0;
  let maxSessionNum  = 0;

  for (const e of mine) {
    const rawDur = (e.startTime && e.endTime)
      ? (toMins(e.endTime) - toMins(e.startTime)) / 60
      : 0;
    const dur = rawDur > 0 && rawDur <= 3 ? rawDur : 1.5;

    if (e.completed) {
      completedHours += dur;
      completedCount++;
      const m = (e.title || '').match(/Session\s+(\d+)/i);
      if (m) maxSessionNum = Math.max(maxSessionNum, parseInt(m[1], 10));
    } else if ((e.completionPercent || 0) > 0) {
      partialCredit += (e.completionPercent! / 100) * dur;
    }
  }

  // Effective hoursNeeded: use topic-based total if topics are defined
  const effectiveHoursNeeded = computeTopicTotalHours(goal);

  const progressHours = effectiveHoursNeeded * (goal.currentProgress / 100);
  const totalDone     = Math.max(completedHours + partialCredit, progressHours);
  const hoursLeft     = Math.max(0, parseFloat((effectiveHoursNeeded - totalDone).toFixed(2)));

  return {
    hoursCompleted: parseFloat(totalDone.toFixed(2)),
    hoursLeft,
    completedCount,
    nextSessionNum: maxSessionNum + 1,
  };
}

// ---------------------------------------------------------------------------
// Day slot builder
// ---------------------------------------------------------------------------

function buildDaySlots(
  from:             Date,
  upTo:             Date,
  freeTimeMode:     'hours' | 'range',
  freeHoursPerDay:  number,
  freeTimeRanges:   TimeRange[],
  customActivities: CustomActivity[],
  existingEvents:   StudyPlanEvent[],
  nowMins:          number,
): DaySlot[] {
  const cap = addDays(from, MAX_DAYS_AHEAD);
  const end = upTo < cap ? upTo : cap;

  const existingByDate: Record<string, Block[]> = {};
  for (const e of existingEvents) {
    if (!e.startTime || !e.endTime) continue;
    const ds = toDateStr(e.date);
    if (!existingByDate[ds]) existingByDate[ds] = [];
    existingByDate[ds].push({
      startMins: toMins(e.startTime) - GAP_MINS,
      endMins:   toMins(e.endTime)   + GAP_MINS,
    });
  }

  const slots: DaySlot[] = [];

  for (
    let d = new Date(toDateStr(from) + 'T00:00:00');
    d <= end;
    d = addDays(d, 1)
  ) {
    const ds        = toDateStr(d);
    const dayOfWeek = d.getDay();
    const isToday   = ds === toDateStr(from);

    let freeBlocks: Block[];
    if (freeTimeMode === 'range' && freeTimeRanges.length > 0) {
      freeBlocks = freeTimeRanges
        .filter(r => toMins(r.end) > toMins(r.start))
        .map(r => ({ startMins: toMins(r.start), endMins: toMins(r.end) }));
    } else {
      const s = 9 * 60;
      freeBlocks = [{ startMins: s, endMins: s + freeHoursPerDay * 60 }];
    }

    if (isToday) {
      const earliest = nowMins + 30;
      freeBlocks = freeBlocks
        .map(b => ({ ...b, startMins: Math.max(b.startMins, earliest) }))
        .filter(b => b.endMins - b.startMins > 0);
    }

    const actBlocks: Block[] = [];
    for (const act of customActivities) {
      if (act.isFlexible) continue;
      const applies =
        act.scheduleType === 'recurring'
          ? act.daysOfWeek.includes(dayOfWeek)
          : (act.specificDates || []).includes(ds);
      if (applies) {
        actBlocks.push({
          startMins: toMins(act.startTime) - GAP_MINS,
          endMins:   toMins(act.endTime)   + GAP_MINS,
        });
      }
    }

    const evBlocks = existingByDate[ds] || [];

    freeBlocks = subtractBlocks(
      freeBlocks,
      [...actBlocks, ...evBlocks],
      MIN_SESSION_MINS
    );

    slots.push({ date: new Date(d), dateStr: ds, freeBlocks });
  }

  return slots;
}

// ---------------------------------------------------------------------------
// Ideal session duration for a goal
// ---------------------------------------------------------------------------

function idealSessionMins(
  hoursLeft:       number,
  daysLeft:        number,
  freeHoursPerDay: number,
  urgency:         number = 0,
): number {
  if (hoursLeft <= 0) return MIN_SESSION_MINS;

  const dynamicMax =
    daysLeft <= 1 ? Math.min(180, freeHoursPerDay * 60)
    : daysLeft <= 2 || urgency >= 0.85 ? 150
    : MAX_SESSION_MINS;

  const minsLeft = hoursLeft * 60;

  if (minsLeft <= dynamicMax) {
    return Math.max(MIN_SESSION_MINS, snapToGrid(minsLeft, SNAP_MINS));
  }

  const availableMins = Math.max(1, daysLeft) * freeHoursPerDay * 60;
  const maxSessions   = Math.floor(availableMins / MIN_SESSION_MINS);
  if (maxSessions <= 0) return dynamicMax;

  const ideal   = minsLeft / maxSessions;
  const clamped = Math.min(dynamicMax, Math.max(MIN_SESSION_MINS, ideal));
  return snapToGrid(clamped, SNAP_MINS);
}

// ---------------------------------------------------------------------------
// Topic resolution for a session — NEW
// Determines which topic(s) a session covers and consumes from the queue.
// Returns { topicName, topicsIncluded } for the session.
// ---------------------------------------------------------------------------

function resolveTopicForSession(
  topicQueue: TopicQueueItem[],
  sessionMins: number,
): { topicName: string | undefined; topicsIncluded: string[] } {
  if (topicQueue.length === 0) return { topicName: undefined, topicsIncluded: [] };

  const topicsIncluded: string[] = [];
  let minsToConsume = sessionMins;

  while (minsToConsume > 0 && topicQueue.length > 0) {
    const current = topicQueue[0];
    topicsIncluded.push(current.name);
    if (current.minsLeft <= minsToConsume) {
      minsToConsume -= current.minsLeft;
      topicQueue.shift();
    } else {
      current.minsLeft -= minsToConsume;
      minsToConsume = 0;
    }
  }

  // Primary topic is the first one consumed
  const topicName = topicsIncluded[0];
  return { topicName, topicsIncluded };
}

// ---------------------------------------------------------------------------
// Main export: generate full schedule
// ---------------------------------------------------------------------------

export function generateStudySchedule(input: SchedulerInput): ScheduleResult {
  const {
    goals, existingEvents, customActivities,
    freeTimeMode, freeHoursPerDay, freeTimeRanges, now,
  } = input;

  const nowMins = now.getHours() * 60 + now.getMinutes();

  // Step 1: build GoalWork list
  const workList: GoalWork[] = [];

  for (const goal of goals) {
    if (!goal.isActive) continue;
    const daysLeft = calendarDayDiff(goal.targetDate, now);
    if (daysLeft < 0) continue;

    const raw = computeGoalWork(goal, existingEvents);
    if (raw.hoursLeft <= 0) continue;

    const effectiveHoursNeeded = computeTopicTotalHours(goal);
    const availableHours = Math.max(0.5, daysLeft * freeHoursPerDay);
    const urgency        = Math.min(1, raw.hoursLeft / availableHours);

    const priority: 'low' | 'medium' | 'high' =
      goal.difficulty === 'hard' || urgency > 0.7  ? 'high'
      : goal.difficulty === 'easy' && urgency < 0.3 ? 'low'
      : 'medium';

    workList.push({
      goal,
      hoursLeft:      raw.hoursLeft,
      minsLeft:       Math.round(raw.hoursLeft * 60),
      hoursCompleted: raw.hoursCompleted,
      nextSessionNum: raw.nextSessionNum,
      completedCount: raw.completedCount,
      urgency,
      priority,
      daysLeft,
      typeIdx:        0,
      newSessions:    0,
      minsScheduled:  0,
      topicQueue:     buildTopicQueue(goal),  // ── NEW
    });
  }

  if (workList.length === 0) {
    return { sessions: [], goalStats: [] };
  }

  // Step 2: sort by urgency
  workList.sort((a, b) => b.urgency - a.urgency);

  // Step 3: find furthest deadline
  const furthestDeadline = workList.reduce(
    (d, gw) => gw.goal.targetDate > d ? gw.goal.targetDate : d,
    workList[0].goal.targetDate
  );

  // Step 4: build day slots
  const daySlots = buildDaySlots(
    now, furthestDeadline,
    freeTimeMode, freeHoursPerDay, freeTimeRanges,
    customActivities, existingEvents, nowMins
  );

  // Step 5: assign sessions day by day (round-robin + deadline priority)
  const sessions: ScheduledSession[] = [];

  for (const slot of daySlots) {
    if (slot.freeBlocks.length === 0) continue;

    const ds = slot.dateStr;
    const sessionsPlacedToday = new Map<string, number>();

    let anyPlacedThisRound = true;
    while (anyPlacedThisRound && slot.freeBlocks.length > 0) {
      anyPlacedThisRound = false;

      const eligible = workList.filter(
        gw =>
          gw.minsLeft >= MIN_SESSION_MINS &&
          toDateStr(gw.goal.targetDate) >= ds
      );
      if (eligible.length === 0) break;

      eligible.sort((a, b) => {
        const countA = sessionsPlacedToday.get(a.goal.id) ?? 0;
        const countB = sessionsPlacedToday.get(b.goal.id) ?? 0;
        if (countA !== countB) return countA - countB;

        const daysA = calendarDayDiff(a.goal.targetDate, new Date(ds + 'T12:00:00'));
        const daysB = calendarDayDiff(b.goal.targetDate, new Date(ds + 'T12:00:00'));
        if (daysA !== daysB) return daysA - daysB;

        return b.urgency - a.urgency;
      });

      for (const gw of eligible) {
        if (gw.minsLeft < MIN_SESSION_MINS) continue;
        if (slot.freeBlocks.length === 0) break;

        const daysToDeadline = Math.max(
          1,
          calendarDayDiff(gw.goal.targetDate, new Date(ds + 'T12:00:00'))
        );
        const sessionMins = idealSessionMins(
          gw.minsLeft / 60,
          daysToDeadline,
          freeHoursPerDay,
          gw.urgency,
        );

        const bi = slot.freeBlocks.findIndex(
          b => b.endMins - b.startMins >= sessionMins
        );
        if (bi === -1) continue;

        const block = slot.freeBlocks[bi];
        const start = block.startMins;
        const end   = start + sessionMins;

        const type   = SESSION_TYPES[gw.typeIdx % SESSION_TYPES.length];
        const reason = REASONS[type][gw.newSessions % REASONS[type].length];
        gw.typeIdx++;

        // ── NEW: resolve topic for this session ──────────────────────────────
        const { topicName, topicsIncluded } = resolveTopicForSession(
          gw.topicQueue,
          sessionMins
        );

        // Build session title:
        // - Topic-based goals: use topic name as title (no session number)
        // - Manual goals: existing "Subject — Session N" format
        const sessionNum = gw.nextSessionNum++;
        const hasTopics  = topicName !== undefined;
        const sessionTitle = hasTopics
          ? topicName!
          : `${gw.goal.subject} — Session ${sessionNum}`;

        sessions.push({
          subject:         gw.goal.subject,
          title:           sessionTitle,
          date:            new Date(ds + 'T12:00:00'),
          startTime:       fromMins(start),
          endTime:         fromMins(end),
          sessionType:     type,
          priority:        gw.priority,
          reason:          hasTopics
            ? `${reason} Topic: ${topicName}${topicsIncluded.length > 1 ? ` (+${topicsIncluded.length - 1} more)` : ''}`
            : reason,
          durationMins:    sessionMins,
          topicName,                                             // ── NEW
          topicsIncluded:  topicsIncluded.length > 0            // ── NEW
            ? topicsIncluded
            : undefined,
        });

        // Shrink/remove consumed block
        const nextStart = end + GAP_MINS;
        if (nextStart < block.endMins) {
          slot.freeBlocks[bi] = { startMins: nextStart, endMins: block.endMins };
        } else {
          slot.freeBlocks.splice(bi, 1);
        }

        gw.minsLeft      -= sessionMins;
        gw.minsScheduled += sessionMins;
        gw.newSessions++;
        if (gw.minsLeft < MIN_SESSION_MINS) gw.minsLeft = 0;

        sessionsPlacedToday.set(gw.goal.id, (sessionsPlacedToday.get(gw.goal.id) ?? 0) + 1);
        anyPlacedThisRound = true;
      }
    }
  }

  // Step 6: build per-goal stats
  const goalStats: GoalScheduleStats[] = workList.map(gw => {
    const effectiveHoursNeeded = computeTopicTotalHours(gw.goal);
    const progressPct = effectiveHoursNeeded > 0
      ? Math.min(100, Math.round(
          ((gw.hoursCompleted + gw.minsScheduled / 60) / effectiveHoursNeeded) * 100
        ))
      : 0;
    return {
      goalId:          gw.goal.id,
      subject:         gw.goal.subject,
      hoursNeeded:     effectiveHoursNeeded,
      hoursCompleted:  gw.hoursCompleted,
      hoursLeft:       gw.hoursLeft,
      hoursScheduled:  parseFloat((gw.minsScheduled / 60).toFixed(2)),
      progressPct,
      completedCount:  gw.completedCount,
      newSessionCount: gw.newSessions,
      nextSessionNum:  gw.nextSessionNum,
      canFullyCover:   gw.minsLeft === 0,
    };
  });

  // Step 7: sort output by date + time
  sessions.sort((a, b) => {
    const dd = a.date.getTime() - b.date.getTime();
    return dd !== 0 ? dd : toMins(a.startTime) - toMins(b.startTime);
  });

  return { sessions, goalStats };
}

// ---------------------------------------------------------------------------
// Reschedule alias
// ---------------------------------------------------------------------------

export function rescheduleStudyPlan(input: SchedulerInput): ScheduleResult {
  return generateStudySchedule(input);
}

// ---------------------------------------------------------------------------
// Goal progress updater
// ---------------------------------------------------------------------------

export function computeGoalProgressUpdate(
  goal:      StudyGoal,
  allEvents: StudyPlanEvent[],
): { hoursCompleted: number; currentProgress: number } {
  const raw = computeGoalWork(goal, allEvents);
  const effectiveHoursNeeded = computeTopicTotalHours(goal);
  const pct = effectiveHoursNeeded > 0
    ? Math.min(100, Math.round((raw.hoursCompleted / effectiveHoursNeeded) * 100))
    : 0;
  return {
    hoursCompleted:  raw.hoursCompleted,
    currentProgress: Math.max(goal.currentProgress, pct),
  };
}
