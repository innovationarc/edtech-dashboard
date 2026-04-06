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

import { StudyGoal, StudyPlanEvent, CustomActivity, SelectedTopicItem } from './studyPlanService';

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
  topicNames?:  string[];     // flat topic names (for legacy/fallback)
  topicContext?: Array<{      // rich subject > chapter > topic hierarchy
    subjectName: string;
    chapterName: string;
    topicName:   string;
  }>;
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
  workId:         string;      // unique per GoalWork entry (for round-robin tracking)
  subjectName?:   string;      // set when goal is split by subject (one GoalWork per subject)
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
  topicSlots:     TopicSlot[]; // NEW: cumulative topic timeline
  minsPlaced:     number;      // NEW: total mins placed so far (for topic cursor)
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
// Topic scheduling helpers (NEW)
// ---------------------------------------------------------------------------

interface TopicSlot {
  name:         string;
  subjectName?: string;  // from SelectedTopicItem.subjectName
  chapterName?: string;  // from SelectedTopicItem.chapterName
  startMins:    number;  // cumulative start minute within this GoalWork's total timeline
  endMins:      number;  // cumulative end minute
}

/** Hours a single topic requires given study mode */
function topicHours(t: SelectedTopicItem, mode: 'first_reading' | 'revision'): number {
  if (mode === 'first_reading') return t.maxHours;
  return t.minHours + (t.maxHours - t.minHours) * 0.3;
}

/**
 * Build a timeline of TopicSlots with absolute start/end minutes.
 * Each slot knows which subject and chapter it belongs to.
 */
function buildTopicSlots(topics: SelectedTopicItem[], mode: 'first_reading' | 'revision'): TopicSlot[] {
  let cursor = 0;
  return topics.map(t => {
    const dur  = topicHours(t, mode) * 60;
    const slot: TopicSlot = {
      name:        t.name,
      subjectName: t.subjectName,
      chapterName: t.chapterName,
      startMins:   cursor,
      endMins:     cursor + dur,
    };
    cursor += dur;
    return slot;
  });
}

/**
 * Returns all TopicSlots that overlap the session window [placedMins, placedMins+sessionMins).
 * Standard interval overlap: topic.start < sessionEnd AND topic.end > sessionStart
 */
function getTopicsForSession(slots: TopicSlot[], placedMins: number, sessionMins: number): TopicSlot[] {
  const sessionEnd = placedMins + sessionMins;
  return slots.filter(s => s.startMins < sessionEnd && s.endMins > placedMins);
}

/**
 * Calculate total hours from topics given study mode.
 * Exported so the student UI can display the auto-calculated total.
 */
export function calcTotalHoursFromTopics(
  topics: SelectedTopicItem[],
  mode: 'first_reading' | 'revision'
): number {
  return Math.round(topics.reduce((sum, t) => sum + topicHours(t, mode), 0) * 10) / 10;
}

/**
 * Returns the min and max total hour estimates across all topics.
 * min = sum of topic.minHours, max = sum of topic.maxHours.
 * Use this to show a range (e.g. "4.5–7.2h") in goal creation and edit forms.
 */
export function calcHoursRange(topics: SelectedTopicItem[]): { min: number; max: number } {
  const min = Math.round(topics.reduce((s, t) => s + t.minHours, 0) * 10) / 10;
  const max = Math.round(topics.reduce((s, t) => s + t.maxHours, 0) * 10) / 10;
  return { min, max };
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
    // FIX: cap raised from 3h to 8h — a valid exam-prep block can exceed 3 hours.
    // Values outside [0, 8] are clearly bad data (e.g. overnight timestamps); fall back to 1.5h.
    const dur = rawDur > 0 && rawDur <= 8 ? rawDur : 1.5;

    if (e.completed) {
      completedHours += dur;
      completedCount++;
      // FIX: scope session-number extraction to AI-generated events only.
      // A manually-created event titled "Physics Session 5 — exam notes" previously
      // bumped the AI session counter to 5, causing the next generated session to
      // skip to "Session 6" even if only 1 AI session had ever been completed.
      if (e.isAIGenerated) {
        const m = (e.title || '').match(/Session\s+(\d+)/i);
        if (m) maxSessionNum = Math.max(maxSessionNum, parseInt(m[1], 10));
      }
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
    // FIX: Firestore Timestamps have a .toDate() method; plain JS Dates do not.
    // Calling toDateStr() on a raw Timestamp returns "NaN-NaN-NaN", causing the
    // event to never subtract from any day's free blocks — so sessions get placed
    // overlapping existing events, which appear as duplicates or past-dated entries.
    const rawDate = (e.date as any)?.toDate ? (e.date as any).toDate() : e.date;
    const ds = toDateStr(rawDate as Date);
    if (!existingByDate[ds]) existingByDate[ds] = [];
    existingByDate[ds].push({
      startMins: toMins(e.startTime) - GAP_MINS,
      endMins:   toMins(e.endTime)   + GAP_MINS,
    });
  }

  const slots: DaySlot[] = [];

  // FIX: normalize end to midnight so the comparison is purely date-based.
  // Without this, end = "Apr 9 at 12:00" and d = "Apr 9 at 00:00" satisfies
  // d < end, causing the exam day itself to be included as a scheduling day.
  const endMidnight = new Date(toDateStr(end) + 'T00:00:00');

  for (
    let d = new Date(toDateStr(from) + 'T00:00:00');
    // Strict less-than against midnight boundary — exam day is never a scheduling day.
    d < endMidnight;
    d = addDays(d, 1)
  ) {
    const ds        = toDateStr(d);
    const dayOfWeek = d.getDay();
    const isToday   = ds === toDateStr(from);

    // Base free blocks — sorted by start time so sessions fill chronologically.
    // NOTE: ranges like "00:00–01:30" correctly belong to the calendar day being
    // processed (it is the early morning of that day, before the student sleeps
    // at 02:00). Each day's DaySlot naturally includes its own midnight block.
    let freeBlocks: Block[];
    if (freeTimeMode === 'range' && freeTimeRanges.length > 0) {
      freeBlocks = freeTimeRanges
        .filter(r => toMins(r.end) > toMins(r.start))
        .map(r => ({ startMins: toMins(r.start), endMins: toMins(r.end) }))
        .sort((a, b) => a.startMins - b.startMins);
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
      30  // keep blocks ≥ 30 min so short final sessions can be placed
    );

    slots.push({ date: new Date(d), dateStr: ds, freeBlocks });
  }

  return slots;
}

// ---------------------------------------------------------------------------
// Ideal session duration for a goal
// ---------------------------------------------------------------------------

function idealSessionMins(
  hoursLeft:              number,
  daysLeft:               number,
  freeHoursPerDay:        number,   // nominal (from hours-mode pref, used for maxSessions estimate)
  urgency:                number = 0,
  effectiveFreeHoursPerDay?: number, // FIX: actual daily free hours derived from ranges
                                      // In range mode this differs from freeHoursPerDay.
                                      // e.g. student with 08:00–22:00 range has 14h effective
                                      // but freeHoursPerDay may still be the old hours-mode value (4).
                                      // Using the wrong value causes idealSessionMins to compute
                                      // maxSessions=4 (240min÷60) instead of maxSessions=14 (840min÷60),
                                      // inflating session length and piling work into fewer, longer blocks.
): number {
  // Use effective hours for the session-length arithmetic; fall back to nominal if not supplied.
  const dailyMins = (effectiveFreeHoursPerDay ?? freeHoursPerDay) * 60;

  if (hoursLeft <= 0) return MIN_SESSION_MINS;

  // Dynamic ceiling — extend sessions gracefully when deadline pressure is high.
  // Caps at the actual free window so we never plan impossible days.
  // "Graceful" means: only extend as far as truly needed, never more.
  const dynamicMax =
    daysLeft <= 1 ? Math.min(180, dailyMins)         // last day: up to 3h, capped at free window
    : daysLeft <= 2 || urgency >= 0.85 ? 150          // 2 days or very urgent: 2.5h
    : MAX_SESSION_MINS;                               // normal: 2h

  const minsLeft = hoursLeft * 60;

  // If remaining work fits in a single extended session, schedule it exactly —
  // avoids a 60-min session leaving 20 min unscheduled and wasting the next slot.
  if (minsLeft <= dynamicMax) {
    return Math.max(MIN_SESSION_MINS, snapToGrid(minsLeft, SNAP_MINS));
  }

  // FIX: compute ideal session length as "spread work evenly across remaining days".
  // The old formula (minsLeft / (totalAvailableMins / MIN_SESSION_MINS)) produced
  // sessions as short as 30min because it divided by the total possible session count
  // across ALL days — ignoring that work must be SHARED with other goals.
  // The correct approach: aim to consume (minsLeft / daysLeft) minutes per day,
  // which naturally pressures harder on tighter deadlines and produces longer sessions
  // for goals with fewer days left — exactly what we want for priority scheduling.
  const minsPerDay = minsLeft / Math.max(1, daysLeft);
  const ideal      = Math.min(dynamicMax, Math.max(MIN_SESSION_MINS, minsPerDay));
  return snapToGrid(ideal, SNAP_MINS);
}

// ---------------------------------------------------------------------------
// Subject splitting helpers
// ---------------------------------------------------------------------------

/** Group SelectedTopicItem[] by subjectName, preserving insertion order. */
function groupTopicsBySubject(topics: SelectedTopicItem[]): Map<string, SelectedTopicItem[]> {
  const map = new Map<string, SelectedTopicItem[]>();
  for (const t of topics) {
    const key = t.subjectName?.trim() || 'General';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }
  return map;
}

/**
 * Compute hours-left / session-numbering for a SINGLE subject within a split goal.
 * Matches completed events by [SubjectName] in title OR by topicContext.subjectName.
 */
function computeSubjectWork(
  goal:          StudyGoal,
  subjectName:   string,
  subjectTopics: SelectedTopicItem[],
  allEvents:     StudyPlanEvent[],
  mode:          'first_reading' | 'revision',
): { hoursLeft: number; hoursCompleted: number; nextSessionNum: number; completedCount: number } {
  const base        = goal.subject.split(' (')[0].toLowerCase().trim();
  const subjectLow  = subjectName.toLowerCase();
  const subjectTag  = `[${subjectLow}]`;

  const isThisSubject = (e: StudyPlanEvent) => {
    const t = (e.title || '').toLowerCase();
    return (
      t.includes(subjectTag) ||
      (e.topicContext || []).some(tc => tc.subjectName.toLowerCase() === subjectLow)
    );
  };

  const isCourse = (e: StudyPlanEvent) => {
    const c = (e.course || '').toLowerCase().trim();
    const t = (e.title  || '').toLowerCase();
    return c === base || c.startsWith(base) || base.startsWith(c) || t.startsWith(base);
  };

  const subjectTotalHours = calcTotalHoursFromTopics(subjectTopics, mode);

  let completedHours = 0;
  let partialCredit  = 0;
  let maxSessionNum  = 0;
  let completedCount = 0;

  for (const e of allEvents) {
    if (!isCourse(e) || !isThisSubject(e)) continue;
    const rawDur = (e.startTime && e.endTime) ? (toMins(e.endTime) - toMins(e.startTime)) / 60 : 0;
    // FIX: cap raised from 3h to 8h (mirrors computeGoalWork fix).
    const dur    = rawDur > 0 && rawDur <= 8 ? rawDur : 1.5;
    if (e.completed) {
      completedHours += dur;
      completedCount++;
      // FIX: scope session-number extraction to AI-generated events only (mirrors computeGoalWork fix).
      if (e.isAIGenerated) {
        const m = (e.title || '').match(/Session\s+(\d+)/i);
        if (m) maxSessionNum = Math.max(maxSessionNum, parseInt(m[1], 10));
      }
    } else if ((e.completionPercent || 0) > 0) {
      partialCredit += (e.completionPercent! / 100) * dur;
    }
  }

  // Apply the same manual-progress floor that computeGoalWork uses,
  // proportional to this subject's fraction of the whole goal.
  const progressFloor = subjectTotalHours * (goal.currentProgress / 100);

  const rawDone    = completedHours + partialCredit;
  const totalDone  = Math.min(subjectTotalHours, Math.max(rawDone, progressFloor));
  const hoursLeft  = Math.max(0, parseFloat((subjectTotalHours - totalDone).toFixed(2)));

  return {
    hoursLeft,
    hoursCompleted: parseFloat(totalDone.toFixed(2)),
    nextSessionNum: maxSessionNum + 1,
    completedCount,
  };
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

  // FIX: compute the true daily free minutes from the actual time ranges so that
  // idealSessionMins uses real capacity, not the stale hours-mode default.
  // In range mode a student with 08:00–22:00 has 840 free minutes, not 240.
  // Passing the wrong value inflates session length and under-distributes work.
  const effectiveFreeHoursPerDay: number = (() => {
    if (freeTimeMode === 'range' && freeTimeRanges.length > 0) {
      const totalMins = freeTimeRanges.reduce((sum, r) => {
        const diff = toMins(r.end) - toMins(r.start);
        return sum + (diff > 0 ? diff : 0);
      }, 0);
      return Math.max(1, totalMins / 60);
    }
    return freeHoursPerDay;
  })();

  // Step 1: build GoalWork list
  const workList: GoalWork[] = [];

  for (const goal of goals) {
    if (!goal.isActive) continue;
    // FIX: goal.targetDate may be a Firestore Timestamp — convert safely.
    const safeTargetDate: Date = (goal.targetDate as any)?.toDate
      ? (goal.targetDate as any).toDate()
      : (goal.targetDate instanceof Date ? goal.targetDate : new Date(goal.targetDate as any));
    const daysLeft = calendarDayDiff(safeTargetDate, now);
    // FIX: daysLeft < 0 means the deadline has already passed — skip.
    // daysLeft === 0 means the deadline is TODAY — still schedule if free time remains.
    if (daysLeft < 0) continue;

    const mode           = goal.studyMode ?? 'first_reading';
    const raw            = computeGoalWork(goal, existingEvents);
    if (raw.hoursLeft <= 0) continue;

    // FIX: when daysLeft=0, availableHours is today's free time only.
    // Math.max(0.5, ...) prevents division-by-zero in urgency and
    // ensures a small positive denominator even for same-day deadlines.
    const availableHours = Math.max(0.5, daysLeft * effectiveFreeHoursPerDay);
    // FIX: boost urgency by a deadline-proximity factor so goals with fewer days
    // always sort above goals with more days, even when raw hour-ratios are equal.
    // Without this, Physics (8h/2days) and Math (12h/3days) both get urgency=0.50
    // and round-robin splits slots equally — but Physics has no fallback days after
    // its deadline, so it ends up under-scheduled.
    // The boost = 1 + (1 / daysLeft): Physics gets 1.5×, Math gets 1.33×, Chemistry 1.25×.
    // This preserves relative ordering while ensuring tighter deadlines always win ties.
    const deadlineBoost = 1 + 1 / Math.max(1, daysLeft);
    const urgency = Math.min(1, (raw.hoursLeft / availableHours) * deadlineBoost);

    const priority: 'low' | 'medium' | 'high' =
      goal.difficulty === 'hard' || urgency > 0.7  ? 'high'
      : goal.difficulty === 'easy' && urgency < 0.3 ? 'low'
      : 'medium';

    // ── Multi-subject split ───────────────────────────────────────────────
    // When a goal has topics from MORE than one subject, create one GoalWork
    // per subject so that each session covers exactly one subject.
    if (goal.topics?.length) {
      const bySubject = groupTopicsBySubject(goal.topics);

      if (bySubject.size > 1) {
        for (const [subjectName, subjectTopics] of bySubject) {
          const sw = computeSubjectWork(goal, subjectName, subjectTopics, existingEvents, mode);
          if (sw.hoursLeft <= 0) continue;

          // Urgency for this sub-goal: fraction of this subject's remaining
          // hours vs available time split across all subjects
          const subAvail    = Math.max(0.5, daysLeft * (effectiveFreeHoursPerDay / bySubject.size));
          const deadlineBoostSub = 1 + 1 / Math.max(1, daysLeft);
          const subUrgency  = Math.min(1, (sw.hoursLeft / subAvail) * deadlineBoostSub);

          workList.push({
            goal,
            workId:         `${goal.id}::${subjectName}`,
            subjectName,
            hoursLeft:      sw.hoursLeft,
            minsLeft:       Math.round(sw.hoursLeft * 60),
            hoursCompleted: sw.hoursCompleted,
            nextSessionNum: sw.nextSessionNum,
            completedCount: sw.completedCount,
            urgency:        Math.max(urgency, subUrgency),
            priority,
            daysLeft,
            typeIdx:       0,
            newSessions:   0,
            minsScheduled: 0,
            topicSlots:    buildTopicSlots(subjectTopics, mode),
            // FIX: start topic cursor at already-completed minutes so rescheduled
            // sessions cover remaining topics, not topics from the beginning.
            minsPlaced:    Math.round(sw.hoursCompleted * 60),
          });
        }
        continue; // do not fall through to the single-subject push
      }
    }

    // ── Single subject (or no topics) — original behaviour ────────────────
    workList.push({
      goal,
      workId:         goal.id,
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
      topicSlots:    goal.topics?.length ? buildTopicSlots(goal.topics, mode) : [],
      // FIX: start topic cursor at already-completed minutes so rescheduled
      // sessions cover remaining topics, not topics from the beginning.
      minsPlaced:    Math.round(raw.hoursCompleted * 60),
    });
  }

  if (workList.length === 0) {
    return { sessions: [], goalStats: [] };
  }

  // Step 2: sort by urgency
  workList.sort((a, b) => b.urgency - a.urgency);

  // Step 3: find furthest deadline
  // FIX: targetDate may be a Firestore Timestamp — convert to JS Date before comparison.
  const toSafeDate = (d: any): Date =>
    d?.toDate ? d.toDate() : (d instanceof Date ? d : new Date(d));

  const furthestDeadline = workList.reduce(
    (best, gw) => {
      const td = toSafeDate(gw.goal.targetDate);
      return td > best ? td : best;
    },
    toSafeDate(workList[0].goal.targetDate)
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
      // FIX: targetDate may be a Firestore Timestamp — convert safely before toDateStr.
      const safeTargetDateStr = (gw: GoalWork): string => {
        const td = (gw.goal.targetDate as any)?.toDate
          ? (gw.goal.targetDate as any).toDate()
          : gw.goal.targetDate;
        return toDateStr(td as Date);
      };

      const eligible = workList.filter(
        gw =>
          gw.minsLeft > 0 &&                             // any time remaining (allows short final sessions)
          // FIX: strictly greater-than — a goal must NOT be scheduled on its own deadline day.
          // ">=" was allowing Physics (due Apr 9) to get sessions placed on Apr 9 itself.
          safeTargetDateStr(gw) > ds
      );
      if (eligible.length === 0) break;

      eligible.sort((a, b) => {
        // Rule 1: fewer sessions placed today → higher priority (per-subject fairness)
        const countA = sessionsPlacedToday.get(a.workId) ?? 0;
        const countB = sessionsPlacedToday.get(b.workId) ?? 0;
        if (countA !== countB) return countA - countB;

        // Rule 2: tighter deadline → higher priority (can't catch up later)
        const tdA = (a.goal.targetDate as any)?.toDate ? (a.goal.targetDate as any).toDate() : a.goal.targetDate;
        const tdB = (b.goal.targetDate as any)?.toDate ? (b.goal.targetDate as any).toDate() : b.goal.targetDate;
        const daysA = calendarDayDiff(tdA as Date, new Date(ds + 'T12:00:00'));
        const daysB = calendarDayDiff(tdB as Date, new Date(ds + 'T12:00:00'));
        if (daysA !== daysB) return daysA - daysB;

        // Rule 3: higher urgency as final tiebreaker
        return b.urgency - a.urgency;
      });

      for (const gw of eligible) {
        if (gw.minsLeft <= 0) continue;
        if (slot.freeBlocks.length === 0) break;

        const safeTargetDate = (gw.goal.targetDate as any)?.toDate
          ? (gw.goal.targetDate as any).toDate()
          : gw.goal.targetDate;

        const daysToDeadline = Math.max(
          1,
          calendarDayDiff(safeTargetDate as Date, new Date(ds + 'T12:00:00'))
        );

        // Allow a shorter "final" session when less than MIN_SESSION_MINS remains.
        let sessionMins = gw.minsLeft < MIN_SESSION_MINS
          ? Math.max(30, snapToGrid(gw.minsLeft, SNAP_MINS))
          : idealSessionMins(gw.minsLeft / 60, daysToDeadline, freeHoursPerDay, gw.urgency, effectiveFreeHoursPerDay);

        // Find first block large enough for this session
        let bi = slot.freeBlocks.findIndex(b => b.endMins - b.startMins >= sessionMins);

        if (bi === -1) {
          // Ideal size doesn't fit. Find ANY block ≥ 30 min and shrink the session
          // to fit — critical for later subjects that get a smaller remaining block.
          bi = slot.freeBlocks.findIndex(b => b.endMins - b.startMins >= 30);
          if (bi === -1) continue; // truly no space today
          const available = slot.freeBlocks[bi].endMins - slot.freeBlocks[bi].startMins;
          // Use Math.floor (not round) so we never produce a session longer than the block
          sessionMins = Math.floor(Math.min(available, gw.minsLeft) / SNAP_MINS) * SNAP_MINS;
          if (sessionMins < 30) sessionMins = Math.min(available, gw.minsLeft);
        }

        // Safety: clamp to block size (guards against rounding edge cases)
        const blockSize = slot.freeBlocks[bi].endMins - slot.freeBlocks[bi].startMins;
        if (sessionMins > blockSize) sessionMins = blockSize;

        const block = slot.freeBlocks[bi];
        const start = block.startMins;
        const end   = start + sessionMins;

        const type        = SESSION_TYPES[gw.typeIdx % SESSION_TYPES.length];
        const baseReason  = REASONS[type][gw.newSessions % REASONS[type].length];
        gw.typeIdx++;

        const sessionNum  = gw.nextSessionNum++;

        // Title: "Course [Subject] — Session N" for split goals, "Course — Session N" otherwise
        const sessionTitle = gw.subjectName
          ? `${gw.goal.subject} [${gw.subjectName}] — Session ${sessionNum}`
          : `${gw.goal.subject} — Session ${sessionNum}`;

        // ── Topic resolution ───────────────────────────────────────────────
        const coveredSlots  = gw.topicSlots.length
          ? getTopicsForSession(gw.topicSlots, gw.minsPlaced, sessionMins)
          : [];

        const topicNames    = coveredSlots.length
          ? coveredSlots.map(s => s.name)
          : undefined;

        const topicContext  = coveredSlots.length
          ? coveredSlots.map(s => ({
              subjectName: s.subjectName || '',
              chapterName: s.chapterName || '',
              topicName:   s.name,
            }))
          : undefined;

        // Smart reason: "Subject › Chapter › Topic1, Topic2" when topics are known
        let reason = baseReason;
        if (coveredSlots.length > 0) {
          const uniqueChapters = [...new Set(coveredSlots.map(s => s.chapterName).filter(Boolean))];
          const topicList      = coveredSlots.map(s => s.name).slice(0, 3).join(', ');
          const extra          = coveredSlots.length > 3 ? ` +${coveredSlots.length - 3} more` : '';
          reason = uniqueChapters.length > 0
            ? `${uniqueChapters.join(', ')} › ${topicList}${extra}`
            : `${topicList}${extra}`;
        }

        sessions.push({
          subject:      gw.goal.subject,
          title:        sessionTitle,
          date:         new Date(ds + 'T12:00:00'),
          startTime:    fromMins(start),
          endTime:      fromMins(end),
          sessionType:  type,
          priority:     gw.priority,
          reason,
          durationMins: sessionMins,
          ...(topicNames?.length    ? { topicNames }    : {}),
          ...(topicContext?.length  ? { topicContext }  : {}),
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
        gw.minsPlaced    += sessionMins;
        gw.newSessions++;
        if (gw.minsLeft < SNAP_MINS) gw.minsLeft = 0;  // drop negligible rounding remainders (< 15 min)

        sessionsPlacedToday.set(gw.workId, (sessionsPlacedToday.get(gw.workId) ?? 0) + 1);
        anyPlacedThisRound = true;
      }
    }
  }

  // Step 6: build per-goal stats — aggregate split-subject entries by goal.id
  const statsMap = new Map<string, GoalScheduleStats>();
  for (const gw of workList) {
    const scheduledH = gw.minsScheduled / 60;
    const existing   = statsMap.get(gw.goal.id);
    if (existing) {
      existing.hoursCompleted  += gw.hoursCompleted;
      existing.hoursLeft       += gw.hoursLeft;
      existing.hoursScheduled   = parseFloat((existing.hoursScheduled + scheduledH).toFixed(2));
      existing.newSessionCount += gw.newSessions;
      existing.completedCount  += gw.completedCount;
      existing.canFullyCover    = existing.canFullyCover && gw.minsLeft === 0;
      existing.progressPct      = gw.goal.hoursNeeded > 0
        ? Math.min(100, Math.round(((existing.hoursCompleted + existing.hoursScheduled) / gw.goal.hoursNeeded) * 100))
        : 0;
    } else {
      const progressPct = gw.goal.hoursNeeded > 0
        ? Math.min(100, Math.round(((gw.hoursCompleted + scheduledH) / gw.goal.hoursNeeded) * 100))
        : 0;
      statsMap.set(gw.goal.id, {
        goalId:          gw.goal.id,
        subject:         gw.goal.subject,
        hoursNeeded:     gw.goal.hoursNeeded,
        hoursCompleted:  gw.hoursCompleted,
        hoursLeft:       gw.hoursLeft,
        hoursScheduled:  parseFloat(scheduledH.toFixed(2)),
        progressPct,
        completedCount:  gw.completedCount,
        newSessionCount: gw.newSessions,
        nextSessionNum:  gw.nextSessionNum,
        canFullyCover:   gw.minsLeft === 0,
      });
    }
  }
  const goalStats = Array.from(statsMap.values());

  // Step 7: sort output by date + time
  sessions.sort((a, b) => {
    const dd = a.date.getTime() - b.date.getTime();
    return dd !== 0 ? dd : toMins(a.startTime) - toMins(b.startTime);
  });

  // Step 8: renumber sessions per subject in chronological order.
  // Round-robin placement assigns numbers during scheduling, which means a subject
  // that gets 3 slots in one day can end up with Session 3 before Session 2 in the
  // sorted output. We fix this by reassigning numbers 1..N per subject after sorting.
  // nextSessionNum in goalStats is also updated to reflect the new highest number.
  const subjectCounters = new Map<string, number>();
  for (const s of sessions) {
    // Key by workId pattern: split goals use "Subject [SubjectName]", simple use "Subject"
    const subjectKey = s.title.replace(/\s*—\s*Session\s+\d+$/i, '').trim();
    const prev = subjectCounters.get(subjectKey) ?? 0;
    const newNum = prev + 1;
    subjectCounters.set(subjectKey, newNum);
    // Replace the session number in the title
    s.title = s.title.replace(/(Session\s+)\d+$/i, `Session ${newNum}`);
  }
  // Update nextSessionNum in goalStats to reflect the renumbered count
  for (const gs of goalStats) {
    const base = gs.subject;
    // Find the highest session number assigned to this subject across all title variants
    let maxNum = 0;
    for (const [key, num] of subjectCounters) {
      if (key === base || key.startsWith(base + ' [')) maxNum = Math.max(maxNum, num);
    }
    if (maxNum > 0) gs.nextSessionNum = maxNum + 1;
  }

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
// Recovery planner — today only
// ---------------------------------------------------------------------------
// Runs a full reschedule then filters to today's sessions only.
// Also returns which subjects got sessions scheduled anywhere in the full
// plan BUT got zero sessions today — so the UI can warn without deleting them.

export function recoverTodayPlan(input: SchedulerInput): {
  sessions:            ScheduledSession[];
  hasSlots:            boolean;
  unscheduledSubjects: string[];  // have future sessions but nothing fits today
} {
  const result   = generateStudySchedule(input);
  const todayStr = toDateStr(input.now);

  const todaySessions = result.sessions.filter(s => {
    const d = s.date instanceof Date ? s.date : new Date(s.date);
    return toDateStr(d) === todayStr;
  });

  // Subjects that appear anywhere in the full schedule (have work to do)
  const allScheduledSubjects = new Set(
    result.sessions.map(s => s.subject.toLowerCase().split(' (')[0].trim())
  );

  // Subjects that got at least one session placed TODAY
  const scheduledTodaySubjects = new Set(
    todaySessions.map(s => s.subject.toLowerCase().split(' (')[0].trim())
  );

  // Subjects with scheduled work but none of it fit today → student should be warned
  // their existing missed sessions will be preserved (not deleted)
  const unscheduledSubjects = result.goalStats
    .filter(gs => {
      const base = gs.subject.toLowerCase().split(' (')[0].trim();
      return allScheduledSubjects.has(base) && !scheduledTodaySubjects.has(base);
    })
    .map(gs => gs.subject);

  return {
    sessions:            todaySessions,
    hasSlots:            todaySessions.length > 0,
    unscheduledSubjects,
  };
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
    hoursCompleted: raw.hoursCompleted,
    // FIX: use measured pct directly — Math.max(goal.currentProgress, pct) was
    // harmful: marking a session incomplete left progress permanently frozen at
    // the old value, causing hoursCompleted and currentProgress to diverge and
    // the next reschedule to underschedule. The manual-progress floor is already
    // applied inside computeGoalWork so the ratchet here was also redundant.
    currentProgress: pct,
  };
}
