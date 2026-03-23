// src/services/novaUserDataService.ts
// Nova RAG — Fetches a user's personal context from Firestore and formats it
// as a compact, prompt-ready string injected into every Nova request.
//
// Data fetched (all non-blocking — any failure returns partial data):
//   • User profile    : users/{uid}
//   • Enrolled courses: enrollments (paymentStatus === 'completed')
//   • Active goals    : studyGoals  (isActive === true)
//   • Upcoming events : studyPlanEvents (next 7 days, studentId match)

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { UserProfile } from './authService';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface NovaUserContext {
  /** Ready-to-inject multi-line string for the prompt */
  formatted: string;
  /** Raw data exposed for any caller that wants structured access */
  raw: {
    profile:        UserProfile | null;
    enrolledCourses: string[];          // course titles
    activeGoals:     string[];          // "Subject (deadline)"
    upcomingEvents:  string[];          // "Title — date time"
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDate(v: any): Date {
  if (!v) return new Date();
  if (v instanceof Date) return v;
  if (typeof v.toDate === 'function') return v.toDate();
  return new Date(v);
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateTime(d: Date, startTime?: string): string {
  const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return startTime ? `${dateStr} at ${startTime}` : dateStr;
}

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    student:         'Student',
    teacher:         'Teacher',
    admin:           'Administrator',
    manager:         'Manager',
    coordinator:     'Coordinator',
    course_manager:  'Course Manager',
    student_manager: 'Student Manager',
    parent:          'Parent',
  };
  return map[role] || role;
}

// ─── Cache ────────────────────────────────────────────────────────────────────
// getUserContext fires 3-4 Firestore queries per Nova message per user.
// Cache per userId for 5 minutes — enrollments, goals, and events change slowly.
const userContextCache = new Map<string, { data: NovaUserContext; ts: number }>();
const USER_CONTEXT_TTL = 5 * 60 * 1000; // 5 minutes

/** Invalidate a user's context cache — call after enrolling, saving a goal, etc. */
export function invalidateUserContextCache(userId: string) {
  userContextCache.delete(userId);
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const novaUserDataService = {

  /**
   * Fetch and format personal context for a user.
   * All sub-fetches are independent — partial failure yields partial data.
   * Never throws — returns empty formatted string on total failure.
   */
  async getUserContext(userId: string, profile: UserProfile | null): Promise<NovaUserContext> {
    // Return cached context if still fresh — avoids 3-4 Firestore reads per message
    if (userId) {
      const cached = userContextCache.get(userId);
      if (cached && Date.now() - cached.ts < USER_CONTEXT_TTL) return cached.data;
    }

    const raw: NovaUserContext['raw'] = {
      profile,
      enrolledCourses: [],
      activeGoals:     [],
      upcomingEvents:  [],
    };

    if (!userId) {
      return { formatted: '', raw };
    }

    // ── Enrolled courses ──────────────────────────────────────────────────────
    try {
      const enrollSnap = await getDocs(
        query(
          collection(db, 'enrollments'),
          where('studentId', '==', userId),
          where('paymentStatus', '==', 'completed')
        )
      );

      const courseIds = enrollSnap.docs
        .map(d => d.data().courseId as string)
        .filter(Boolean);

      if (courseIds.length > 0) {
        // Fetch course titles in parallel (cap at 10 to limit reads)
        const titlesToFetch = courseIds.slice(0, 10);
        const courseDocs = await Promise.allSettled(
          titlesToFetch.map(cid => getDoc(doc(db, 'courses', cid)))
        );
        raw.enrolledCourses = courseDocs
          .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled' && r.value.exists())
          .map(r => (r.value.data().title || 'Untitled Course') as string);
      }
    } catch (e) {
      console.warn('[novaUserData] Could not fetch enrollments (non-fatal):', e);
    }

    // ── Active study goals (students only) ────────────────────────────────────
    if (profile?.role === 'student') {
      try {
        const goalsSnap = await getDocs(
          query(
            collection(db, 'studyGoals'),
            where('studentId', '==', userId),
            where('isActive', '==', true)
          )
        );
        raw.activeGoals = goalsSnap.docs.map(d => {
          const data = d.data();
          const subject  = data.subject || 'Unknown';
          const deadline = data.targetDate ? fmtDate(toDate(data.targetDate)) : 'No deadline';
          const progress = typeof data.hoursCompleted === 'number' && typeof data.hoursNeeded === 'number'
            ? ` — ${data.hoursCompleted}/${data.hoursNeeded}h done`
            : '';
          return `${subject} (due ${deadline}${progress})`;
        });
      } catch (e) {
        console.warn('[novaUserData] Could not fetch goals (non-fatal):', e);
      }
    }

    // ── Upcoming study events (next 7 days) ───────────────────────────────────
    if (profile?.role === 'student') {
      try {
        const now     = new Date();
        const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        const eventsSnap = await getDocs(
          query(
            collection(db, 'studyPlanEvents'),
            where('studentId', '==', userId),
            where('isPersonal', '==', true)
          )
        );

        raw.upcomingEvents = eventsSnap.docs
          .map(d => {
            const data = d.data();
            return {
              title:     (data.title || 'Study session') as string,
              date:      toDate(data.date),
              startTime: (data.startTime || '') as string,
              completed: !!data.completed,
            };
          })
          .filter(e => !e.completed && e.date >= now && e.date <= in7Days)
          .sort((a, b) => a.date.getTime() - b.date.getTime())
          .slice(0, 8)
          .map(e => `${e.title} — ${fmtDateTime(e.date, e.startTime)}`);
      } catch (e) {
        console.warn('[novaUserData] Could not fetch events (non-fatal):', e);
      }
    }

    // ── Format ────────────────────────────────────────────────────────────────
    const lines: string[] = [];

    if (profile) {
      const displayName = [profile.name, profile.surname].filter(Boolean).join(' ');
      lines.push(`Name: ${displayName}`);
      lines.push(`Role: ${roleLabel(profile.role)}`);
      if (profile.classGrade) lines.push(`Class/Grade: ${profile.classGrade}`);
      if (profile.userId)     lines.push(`Student ID: ${profile.userId}`);
    }

    if (raw.enrolledCourses.length > 0) {
      lines.push(`Enrolled courses: ${raw.enrolledCourses.join(', ')}`);
    }

    if (raw.activeGoals.length > 0) {
      lines.push(`Active study goals: ${raw.activeGoals.join(' | ')}`);
    }

    if (raw.upcomingEvents.length > 0) {
      lines.push(`Upcoming sessions (next 7 days): ${raw.upcomingEvents.join(' | ')}`);
    }

    const result: NovaUserContext = {
      formatted: lines.join('\n'),
      raw,
    };
    if (userId) userContextCache.set(userId, { data: result, ts: Date.now() });
    return result;
  },
};
