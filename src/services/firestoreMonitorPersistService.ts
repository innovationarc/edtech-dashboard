// src/services/firestoreMonitorPersistService.ts
// Handles persisting monitor stats to Firestore + reading them for the admin page.
//
// Firestore schema:
//   firebaseMonitor/{dashboardKey}/
//     stats/{year}   — yearly doc with hourly/daily/monthly buckets
//
// dashboardKey: 'admin' | 'student' | 'teacher' | 'manager' | 'course_manager' | '_global'
//
// Doc structure (stats/{year}):
// {
//   year: number,
//   updatedAt: Timestamp,
//   monthly: { "1": { reads, writes }, "2": ..., ... "12": ... },
//   weekly:  { "1": ..., "53": ... },  // ISO week number
//   daily:   { "2025-03-01": { reads, writes }, ... },
//   hourly:  { "2025-03-25T14": { reads, writes }, ... },  // last 72h only kept
// }

import {
  doc,
  setDoc as _setDoc,
  getDoc as _getDoc,
  collection,
  getDocs as _getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  firestoreMonitor,
  registerFlushCallback,
  setupAutoFlush,
} from './firestoreMonitor';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DashboardKey = 'admin' | 'student' | 'teacher' | 'manager' | 'course_manager' | '_global';

export interface RWBucket { reads: number; writes: number }

export interface YearlyStatsDoc {
  year: number;
  updatedAt: any;
  monthly: Record<string, RWBucket>;   // "1".."12"
  weekly:  Record<string, RWBucket>;   // "1".."53"
  daily:   Record<string, RWBucket>;   // "YYYY-MM-DD"
  hourly:  Record<string, RWBucket>;   // "YYYY-MM-DDTHH" (72h window)
}

export interface MonitorConfig {
  /** Global toggle — if false, nothing is shown anywhere */
  globalEnabled: boolean;
  /** Per-dashboard modal visibility toggle */
  dashboardToggles: Record<DashboardKey, boolean>;
  updatedAt?: any;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function nowKeys() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1);
  const day = now.toISOString().slice(0, 10);
  const hour = now.toISOString().slice(0, 13); // "YYYY-MM-DDTHH"

  // ISO week number
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = String(Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7));

  return { year, month, day, hour, week };
}

function emptyBucket(): RWBucket { return { reads: 0, writes: 0 }; }

function mergeBucket(existing: RWBucket | undefined, delta: RWBucket): RWBucket {
  return {
    reads:  (existing?.reads  ?? 0) + delta.reads,
    writes: (existing?.writes ?? 0) + delta.writes,
  };
}

function pruneHourly(hourly: Record<string, RWBucket>): Record<string, RWBucket> {
  // Keep only last 72 hours
  const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000);
  const pruned: Record<string, RWBucket> = {};
  for (const [key, val] of Object.entries(hourly)) {
    // key is "YYYY-MM-DDTHH"
    const dt = new Date(key + ':00:00Z');
    if (dt >= cutoff) pruned[key] = val;
  }
  return pruned;
}

// ─── State ───────────────────────────────────────────────────────────────────

let _currentDashboard: DashboardKey = '_global';
let _lastFlushedReads = 0;
let _lastFlushedWrites = 0;
let _initialised = false;
let _cleanupAutoFlush: (() => void) | null = null;

// ─── Core flush ──────────────────────────────────────────────────────────────

async function flush(): Promise<void> {
  try {
    const stats = firestoreMonitor.getStats();
    const deltaReads  = stats.totalReads  - _lastFlushedReads;
    const deltaWrites = stats.totalWrites - _lastFlushedWrites;

    if (deltaReads === 0 && deltaWrites === 0) return;

    const delta: RWBucket = { reads: deltaReads, writes: deltaWrites };
    const { year, month, day, hour, week } = nowKeys();

    _lastFlushedReads  = stats.totalReads;
    _lastFlushedWrites = stats.totalWrites;

    const dashboards: DashboardKey[] = [_currentDashboard];
    if (_currentDashboard !== '_global') dashboards.push('_global');

    for (const dk of dashboards) {
      const ref = doc(db, 'firebaseMonitor', dk, 'stats', String(year));
      let existing: YearlyStatsDoc | null = null;
      try {
        const snap = await _getDoc(ref);
        existing = snap.exists() ? (snap.data() as YearlyStatsDoc) : null;
      } catch { /* first write */ }

      const base: YearlyStatsDoc = existing ?? {
        year,
        updatedAt: Timestamp.now(),
        monthly: {},
        weekly:  {},
        daily:   {},
        hourly:  {},
      };

      const updated: YearlyStatsDoc = {
        ...base,
        updatedAt: Timestamp.now(),
        monthly: { ...base.monthly, [month]: mergeBucket(base.monthly[month], delta) },
        weekly:  { ...base.weekly,  [week]:  mergeBucket(base.weekly[week],   delta) },
        daily:   { ...base.daily,   [day]:   mergeBucket(base.daily[day],     delta) },
        hourly:  pruneHourly({ ...base.hourly, [hour]: mergeBucket(base.hourly[hour], delta) }),
      };

      await _setDoc(ref, updated);
    }
  } catch (err) {
    // Silent — never block the app
    console.warn('[firestoreMonitorPersist] flush error:', err);
  }
}

// ─── Config helpers ───────────────────────────────────────────────────────────

const CONFIG_DOC = doc(db, 'firebaseMonitor', '_config');

export const DEFAULT_CONFIG: MonitorConfig = {
  globalEnabled: false,
  dashboardToggles: {
    admin: false,
    student: false,
    teacher: false,
    manager: false,
    course_manager: false,
    _global: false,
  },
};

export async function getMonitorConfig(): Promise<MonitorConfig> {
  try {
    const snap = await _getDoc(CONFIG_DOC);
    if (!snap.exists()) return DEFAULT_CONFIG;
    return snap.data() as MonitorConfig;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function saveMonitorConfig(config: MonitorConfig): Promise<void> {
  await _setDoc(CONFIG_DOC, { ...config, updatedAt: Timestamp.now() });
}

// ─── Read historical stats ────────────────────────────────────────────────────

export async function getYearlyStats(
  dashboard: DashboardKey,
  year: number,
): Promise<YearlyStatsDoc | null> {
  try {
    const ref = doc(db, 'firebaseMonitor', dashboard, 'stats', String(year));
    const snap = await _getDoc(ref);
    return snap.exists() ? (snap.data() as YearlyStatsDoc) : null;
  } catch {
    return null;
  }
}

export async function getAvailableYears(dashboard: DashboardKey): Promise<number[]> {
  try {
    const col = collection(db, 'firebaseMonitor', dashboard, 'stats');
    const snap = await _getDocs(col);
    return snap.docs.map(d => Number(d.id)).filter(Boolean).sort((a, b) => b - a);
  } catch {
    return [];
  }
}

// ─── Init ────────────────────────────────────────────────────────────────────

export const firestoreMonitorPersistService = {
  /** Call once at app boot with the current user's dashboard role */
  init(dashboardKey: DashboardKey) {
    if (_initialised) {
      _currentDashboard = dashboardKey;
      return;
    }
    _initialised = true;
    _currentDashboard = dashboardKey;

    // Wire flush callback into the monitor
    registerFlushCallback(flush);

    // Setup auto-flush (5min interval + visibilitychange + beforeunload)
    _cleanupAutoFlush = setupAutoFlush();
  },

  setDashboard(dk: DashboardKey) {
    _currentDashboard = dk;
  },

  /** Force an immediate flush (e.g. called from admin UI) */
  async flush() {
    await flush();
  },

  destroy() {
    if (_cleanupAutoFlush) {
      _cleanupAutoFlush();
      _cleanupAutoFlush = null;
    }
    _initialised = false;
  },

  getMonitorConfig,
  saveMonitorConfig,
  getYearlyStats,
  getAvailableYears,
};
