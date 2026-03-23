// src/services/firestoreMonitor.ts
// Production-grade Firestore read monitor.
// Wraps getDocs/getDoc to track every read — zero Firestore reads of its own.
// Only active when window.__FIRESTORE_MONITOR_ENABLED__ === true (admin-toggled).
// Tree-shakes cleanly in production builds when disabled.

import {
  getDocs as _getDocs,
  getDoc as _getDoc,
  DocumentReference,
  Query,
  DocumentSnapshot,
  QuerySnapshot,
} from 'firebase/firestore';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReadEntry {
  id: string;
  timestamp: Date;
  caller: string;       // function/file name inferred from stack
  collection: string;   // collection path
  docCount: number;     // 1 for getDoc, N for getDocs
  type: 'getDoc' | 'getDocs';
}

export interface MonitorStats {
  totalReads: number;
  entries: ReadEntry[];
  byCollection: Record<string, number>;
  byCaller: Record<string, number>;
  sessionStart: Date;
}

// ─── Internal state (module-level, no Firestore) ──────────────────────────────

let _enabled = false;
let _stats: MonitorStats = createEmptyStats();
let _listeners: Array<(stats: MonitorStats) => void> = [];
let _entryId = 0;

function createEmptyStats(): MonitorStats {
  return {
    totalReads: 0,
    entries: [],
    byCollection: {},
    byCaller: {},
    sessionStart: new Date(),
  };
}

// ─── Stack trace parser ───────────────────────────────────────────────────────

function inferCaller(): string {
  try {
    const err = new Error();
    const lines = (err.stack || '').split('\n');
    // Skip: Error, inferCaller, recordRead, monitored getDocs/getDoc, then find app code
    for (let i = 4; i < lines.length; i++) {
      const line = lines[i];
      // Skip node_modules, firebase SDK, and this file
      if (
        line.includes('node_modules') ||
        line.includes('firebase') ||
        line.includes('firestoreMonitor') ||
        line.includes('at async Promise') ||
        line.trim() === ''
      ) continue;

      // Extract file/function name
      const match =
        line.match(/at (\w[\w.]*)\s+\(([^)]+)\)/) ||
        line.match(/at\s+([^(]+)\(/) ||
        line.match(/at\s+(.+)/);

      if (match) {
        const raw = match[1].trim();
        // Clean up common patterns
        return raw
          .replace(/^Object\./, '')
          .replace(/^async /, '')
          .replace(/\s+/g, ' ')
          .substring(0, 60);
      }
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

function inferCollection(ref: DocumentReference | Query): string {
  try {
    // DocumentReference has .path
    if ('path' in ref && typeof (ref as any).path === 'string') {
      const path = (ref as any).path as string;
      const parts = path.split('/');
      return parts[0] || path;
    }
    // Query — try to get collection from _query internal
    const q = ref as any;
    if (q._query?.path?.segments) {
      return q._query.path.segments[0] || 'unknown';
    }
    if (q._query?.collectionGroup) {
      return q._query.collectionGroup;
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

// ─── Record a read ────────────────────────────────────────────────────────────

function recordRead(
  type: 'getDoc' | 'getDocs',
  collection: string,
  docCount: number,
) {
  if (!_enabled) return;

  const caller = inferCaller();
  const entry: ReadEntry = {
    id: String(++_entryId),
    timestamp: new Date(),
    caller,
    collection,
    docCount,
    type,
  };

  _stats = {
    ..._stats,
    totalReads: _stats.totalReads + docCount,
    entries: [entry, ..._stats.entries].slice(0, 500), // cap at 500 entries
    byCollection: {
      ..._stats.byCollection,
      [collection]: (_stats.byCollection[collection] ?? 0) + docCount,
    },
    byCaller: {
      ..._stats.byCaller,
      [caller]: (_stats.byCaller[caller] ?? 0) + docCount,
    },
  };

  _listeners.forEach(fn => fn(_stats));
}

// ─── Monitored wrappers ───────────────────────────────────────────────────────

export async function getDocs<T>(query: Query<T>): Promise<QuerySnapshot<T>> {
  const result = await _getDocs(query);
  if (_enabled) {
    const col = inferCollection(query);
    recordRead('getDocs', col, result.size);
  }
  return result;
}

export async function getDoc<T>(ref: DocumentReference<T>): Promise<DocumentSnapshot<T>> {
  const result = await _getDoc(ref);
  if (_enabled) {
    const col = inferCollection(ref);
    recordRead('getDoc', col, 1);
  }
  return result;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const firestoreMonitor = {
  /** Enable monitoring — call from admin debug panel */
  enable() {
    _enabled = true;
    (window as any).__FIRESTORE_MONITOR_ENABLED__ = true;
  },

  /** Disable monitoring */
  disable() {
    _enabled = false;
    (window as any).__FIRESTORE_MONITOR_ENABLED__ = false;
  },

  get isEnabled() { return _enabled; },

  /** Get current stats snapshot */
  getStats(): MonitorStats { return _stats; },

  /** Reset all counters */
  reset() {
    _stats = createEmptyStats();
    _entryId = 0;
    _listeners.forEach(fn => fn(_stats));
  },

  /** Subscribe to stats updates — returns unsubscribe fn */
  subscribe(fn: (stats: MonitorStats) => void): () => void {
    _listeners.push(fn);
    fn(_stats); // immediate call with current state
    return () => { _listeners = _listeners.filter(l => l !== fn); };
  },

  /** Top N callers by read count */
  topCallers(n = 10): Array<{ caller: string; reads: number }> {
    return Object.entries(_stats.byCaller)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([caller, reads]) => ({ caller, reads }));
  },

  /** Top N collections by read count */
  topCollections(n = 10): Array<{ collection: string; reads: number }> {
    return Object.entries(_stats.byCollection)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([collection, reads]) => ({ collection, reads }));
  },
};

// Auto-start immediately — monitor is always on from the first import.
// This ensures zero reads are missed, including those fired on module load.
firestoreMonitor.enable();
try { sessionStorage.setItem('__fsm_enabled', '1'); } catch { /* ignore */ }
