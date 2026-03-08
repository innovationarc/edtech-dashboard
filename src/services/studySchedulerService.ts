// src/services/studySchedulerService.ts
// Deterministic Study Planner — zero AI, zero network calls, instant results.
//
// ALGORITHM OVERVIEW
// ------------------
// 1. For each goal: compute exact hours remaining by measuring real completed
//    session durations + partial credit + manual progress floor.
// 2. Build a timeline of "free blocks" per day:
//      base free windows -> subtract custom activities -> subtract existing events
//      -> clamp today's blocks to (now + 30 min)
// 3. Assign sessions via urgency-ordered day-filling:
//    - Goals sorted by urgency = hoursLeft / (daysLeft x freeHoursPerDay)
//    - Each day: fill most-urgent goal first, then next, interleaving goals
//    - Session length adapts to deadline pressure (60-120 min, 15-min grid)
//    - Daily cap enforced via actual freeBlocks — naturally limits overload
// 4. Session numbering: read highest COMPLETED session number only
//    (uncompleted sessions are deleted on reschedule so only completed count)
// 5. Session type cycles: focus -> practice -> review per goal independently
//
// STUDENT PROBLEMS THIS SOLVES
// -----------------------------
// "I forgot to study, now it's too late"
//   -> urgency re-packs remaining hours into longer/denser sessions automatically
// "I have a job/sport/class that blocks time"
//   -> custom activities subtracted from free blocks before any session is placed
// "Sessions are scheduled during my sleep"
//   -> hard clamp to freeTimeRanges; hours mode uses 09:00-(09:00+N)
// "Duplicate session numbers after reschedule"
//   -> nextSessionNum reads only completed events; uncompleted wiped first
// "Progress bar wrong — I actually studied!"
//   -> hoursCompleted measured from real startTime/endTime deltas, not a % field
// "Partial sessions waste my progress"
//   -> completionPercent contributes fractional hours, reducing future sessions
// "All sessions pile up on one day"
//   -> daily cap enforced by freeBlocks arithmetic — excess spills to next day

import { StudyGoal, StudyPlanEvent, CustomActivity } from './studyPlanService';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface TimeRange {
  start: string; // "HH:MM"
  end:   string; // "HH:MM"
}

export interface SchedulerInput {
  goals:            StudyGoal[];
  existingEvents:   StudyPlanEvent[];  // ALL events: completed, uncompleted, non-AI
  customActivities: CustomActivity[];
  freeTimeMode:     'hours' | 'range';
  freeHoursPerDay:  number;            // used when mode === 'hours'
  freeTimeRanges:   TimeRange[];       // used when mode === 'range'
  now:              Date;
  studentId:        string;
}

export interface ScheduledSession {
  subject:      string;
  title:        string;       // "<Subject> — Session N"
  date:         Date;
  startTime:    string;       // "HH:MM"
  endTime:      string;       // "HH:MM"
  sessionType:  'focus' | 'review' | 'practice';
  priority:     'low' | 'medium' | 'high';
  reason:       string;
  durationMins: number;
}

export interface GoalScheduleStats {
  goalId:          string;
  subject:         string;
  hoursNeeded:     number;
  hoursCompleted:  number;
  hoursLeft:       number;
  hoursScheduled:  number;
  progressPct:     number;   // 0-100 visual
  completedCount:  number;
  newSessionCount: number;
  nextSessionNum:  number;
  canFullyCover:   boolean;  // false if deadline too tight
}

export interface ScheduleResult {
  sessions:  ScheduledSession[];
  goalStats: GoalScheduleStats[];
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

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

// CRITICAL: use local date components — NOT toISOString() which returns UTC.
// toISOString() on local midnight in UTC+X gives the previous day in UTC,
// so "2026-03-08T00:00:00" local → "2026-03-07T..." UTC → "2026-03-07" slice.
// This breaks isToday detection, deadline comparisons, and day-slot boundaries.
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
      // Only completed sessions determine next number — uncompleted get cleared
      const m = (e.title || '').match(/Session\s+(\d+)/i);
      if (m) maxSessionNum = Math.max(maxSessionNum, parseInt(m[1], 10));
    } else if ((e.completionPercent || 0) > 0) {
      partialCredit += (e.completionPercent! / 100) * dur;
    }
  }

  // Take max of real measured progress vs manually-set currentProgress %
  const progressHours = goal.hoursNeeded * (goal.currentProgress / 100);
  const totalDone     = Math.max(completedHours + partialCredit, progressHours);
  const hoursLeft     = Math.max(0, parseFloat((goal.hoursNeeded - totalDone).toFixed(2)));

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

  // Pre-index existing event blocks by date
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

    // Base free blocks
    let freeBlocks: Block[];
    if (freeTimeMode === 'range' && freeTimeRanges.length > 0) {
      freeBlocks = freeTimeRanges
        .filter(r => toMins(r.end) > toMins(r.start))
        .map(r => ({ startMins: toMins(r.start), endMins: toMins(r.end) }));
    } else {
      const s = 9 * 60;
      freeBlocks = [{ startMins: s, endMins: s + freeHoursPerDay * 60 }];
    }

    // Clamp today to now+30min
    if (isToday) {
      const earliest = nowMins + 30;
      freeBlocks = freeBlocks
        .map(b => ({ ...b, startMins: Math.max(b.startMins, earliest) }))
        .filter(b => b.endMins - b.startMins > 0);
    }

    // Subtract non-flexible custom activities
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

    // Subtract existing events
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

  // Dynamic ceiling — extend sessions gracefully when deadline pressure is high.
  // Caps at the actual free window so we never plan impossible days.
  // "Graceful" means: only extend as far as truly needed, never more.
  const dynamicMax =
    daysLeft <= 1 ? Math.min(180, freeHoursPerDay * 60)  // last day: up to 3h, capped at free window
    : daysLeft <= 2 || urgency >= 0.85 ? 150              // 2 days or very urgent: 2.5h
    : MAX_SESSION_MINS;                                    // normal: 2h

  const minsLeft = hoursLeft * 60;

  // If remaining work fits in a single extended session, schedule it exactly —
  // avoids a 60-min session leaving 20 min unscheduled and wasting the next slot.
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
      typeIdx:       0,
      newSessions:   0,
      minsScheduled: 0,
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

  // Step 5: assign sessions day by day
  //
  // SCHEDULING STRATEGY — three layered rules:
  //
  //  Rule 1 — Round-robin fairness: within each day, track how many sessions
  //    each goal has already received. Goals with fewer sessions go first.
  //    This prevents a high-urgency goal from monopolising all available slots.
  //
  //  Rule 2 — Tighter deadline wins ties: when two goals have equal session
  //    counts today, the one expiring soonest gets priority. A goal due tomorrow
  //    cannot "make up" missed sessions the way a goal due next week can.
  //
  //  Rule 3 — Urgency breaks remaining ties: when deadline distance is equal,
  //    the goal needing a higher fraction of remaining free time goes first.
  //
  // WHY THIS FIXES THE PHYSICS / CHEMISTRY BUG:
  //   Chemistry urgency (0.50) > Physics urgency (0.42), so Chemistry won every
  //   round and stole the third daily slot. Physics only had 3 days before
  //   expiry, so it finished with 3h instead of 5h.
  //   With Rule 2: after round 1 (both have 1 session), Physics (fewer days)
  //   gets priority for the third slot. Chemistry catches up after Physics
  //   expires, filling the remaining days exclusively.
  const sessions: ScheduledSession[] = [];

  for (const slot of daySlots) {
    if (slot.freeBlocks.length === 0) continue;

    const ds = slot.dateStr;

    // Per-day session counter — reset each day, used for round-robin fairness
    const sessionsPlacedToday = new Map<string, number>();

    let anyPlacedThisRound = true;
    while (anyPlacedThisRound && slot.freeBlocks.length > 0) {
      anyPlacedThisRound = false;

      // Re-filter each round so goals that just ran out are excluded
      const eligible = workList.filter(
        gw =>
          gw.minsLeft >= MIN_SESSION_MINS &&
          toDateStr(gw.goal.targetDate) >= ds
      );
      if (eligible.length === 0) break;

      eligible.sort((a, b) => {
        // Rule 1: fewer sessions placed today → higher priority
        const countA = sessionsPlacedToday.get(a.goal.id) ?? 0;
        const countB = sessionsPlacedToday.get(b.goal.id) ?? 0;
        if (countA !== countB) return countA - countB;

        // Rule 2: tighter deadline → higher priority (can't catch up later)
        const daysA = calendarDayDiff(a.goal.targetDate, new Date(ds + 'T12:00:00'));
        const daysB = calendarDayDiff(b.goal.targetDate, new Date(ds + 'T12:00:00'));
        if (daysA !== daysB) return daysA - daysB;

        // Rule 3: higher urgency as final tiebreaker
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

        // Find first block large enough for this session
        const bi = slot.freeBlocks.findIndex(
          b => b.endMins - b.startMins >= sessionMins
        );
        if (bi === -1) continue; // no room for this goal today — try next goal

        const block = slot.freeBlocks[bi];
        const start = block.startMins;
        const end   = start + sessionMins;

        const type   = SESSION_TYPES[gw.typeIdx % SESSION_TYPES.length];
        const reason = REASONS[type][gw.newSessions % REASONS[type].length];
        gw.typeIdx++;

        const sessionNum = gw.nextSessionNum++;

        sessions.push({
          subject:      gw.goal.subject,
          title:        `${gw.goal.subject} — Session ${sessionNum}`,
          date:         new Date(ds + 'T12:00:00'),
          startTime:    fromMins(start),
          endTime:      fromMins(end),
          sessionType:  type,
          priority:     gw.priority,
          reason,
          durationMins: sessionMins,
        });

        // Shrink the consumed block or remove it if exhausted
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
    const progressPct = gw.goal.hoursNeeded > 0
      ? Math.min(100, Math.round(
          ((gw.hoursCompleted + gw.minsScheduled / 60) / gw.goal.hoursNeeded) * 100
        ))
      : 0;
    return {
      goalId:          gw.goal.id,
      subject:         gw.goal.subject,
      hoursNeeded:     gw.goal.hoursNeeded,
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
// Identical to generateStudySchedule. The scheduler handles reschedule
// automatically: computeGoalWork reads only completed sessions for
// hoursCompleted and nextSessionNum; uncompleted sessions are deleted
// by clearAllStudentAIEventsFromFirestore before this runs.

export function rescheduleStudyPlan(input: SchedulerInput): ScheduleResult {
  return generateStudySchedule(input);
}

// ---------------------------------------------------------------------------
// Goal progress updater
// ---------------------------------------------------------------------------
// Call this after marking a session complete or setting a partial %.
// Returns the values to write back to the Firestore StudyGoal document.

export function computeGoalProgressUpdate(
  goal:      StudyGoal,
  allEvents: StudyPlanEvent[],
): { hoursCompleted: number; currentProgress: number } {
  const raw = computeGoalWork(goal, allEvents);
  const pct = goal.hoursNeeded > 0
    ? Math.min(100, Math.round((raw.hoursCompleted / goal.hoursNeeded) * 100))
    : 0;
  return {
    hoursCompleted:  raw.hoursCompleted,
    currentProgress: Math.max(goal.currentProgress, pct),
  };
}
