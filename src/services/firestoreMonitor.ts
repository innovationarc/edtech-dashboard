// src/services/firestoreMonitor.ts
// Production-grade Firestore read/write monitor.
// Wraps getDocs/getDoc/setDoc/updateDoc/addDoc/deleteDoc to track every operation.
// Runs silently in background — persists to Firestore every 5 min + on page close.
// Modal display is controlled per-dashboard via Firestore config (admin only).
// Zero circular reads — persistence calls bypass the monitor wrapper.

import {
  getDocs as _getDocs,
  getDoc as _getDoc,
  setDoc as _setDoc,
  updateDoc as _updateDoc,
  addDoc as _addDoc,
  deleteDoc as _deleteDoc,
  DocumentReference,
  Query,
  DocumentSnapshot,
  QuerySnapshot,
  CollectionReference,
  UpdateData,
  SetOptions,
  WithFieldValue,
  DocumentData,
} from 'firebase/firestore';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReadEntry {
  id: string;
  timestamp: Date;
  caller: string;
  collection: string;
  docCount: number;
  type: 'getDoc' | 'getDocs';
}

export interface WriteEntry {
  id: string;
  timestamp: Date;
  caller: string;
  collection: string;
  type: 'setDoc' | 'updateDoc' | 'addDoc' | 'deleteDoc';
}

export interface MonitorStats {
  totalReads: number;
  totalWrites: number;
  readEntries: ReadEntry[];
  writeEntries: WriteEntry[];
  byCollection: Record<string, { reads: number; writes: number }>;
  byCaller: Record<string, number>;
  sessionStart: Date;
}

// ─── Internal state ───────────────────────────────────────────────────────────

let _stats: MonitorStats = createEmptyStats();
let _listeners: Array<(stats: MonitorStats) => void> = [];
let _entryId = 0;
// Background monitoring is ALWAYS on (never disabled).
// The modal visibility is a separate concern controlled by config in Firestore.
const _bgEnabled = true;

// Flush callback injected by firestoreMonitorPersistService to avoid circular import
let _flushCallback: (() => Promise<void>) | null = null;

export function registerFlushCallback(cb: () => Promise<void>) {
  _flushCallback = cb;
}

function createEmptyStats(): MonitorStats {
  return {
    totalReads: 0,
    totalWrites: 0,
    readEntries: [],
    writeEntries: [],
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
    for (let i = 4; i < lines.length; i++) {
      const line = lines[i];
      if (
        line.includes('node_modules') ||
        line.includes('firebase') ||
        line.includes('firestoreMonitor') ||
        line.includes('firestoreMonitorPersist') ||
        line.includes('at async Promise') ||
        line.trim() === ''
      ) continue;
      const match =
        line.match(/at (\w[\w.]*)\s+\(([^)]+)\)/) ||
        line.match(/at\s+([^(]+)\(/) ||
        line.match(/at\s+(.+)/);
      if (match) {
        return match[1].trim()
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

function inferCollection(ref: DocumentReference | Query | CollectionReference): string {
  try {
    if ('path' in ref && typeof (ref as any).path === 'string') {
      const path = (ref as any).path as string;
      return path.split('/')[0] || path;
    }
    const q = ref as any;
    if (q._query?.path?.segments) return q._query.path.segments[0] || 'unknown';
    if (q._query?.collectionGroup) return q._query.collectionGroup;
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

// ─── Record operations ────────────────────────────────────────────────────────

function recordRead(type: 'getDoc' | 'getDocs', collection: string, docCount: number) {
  if (!_bgEnabled) return;
  // Skip internal monitor persistence writes to avoid infinite loop
  if (collection === 'firebaseMonitor') return;

  const caller = inferCaller();
  const entry: ReadEntry = {
    id: String(++_entryId),
    timestamp: new Date(),
    caller,
    collection,
    docCount,
    type,
  };

  const colStats = _stats.byCollection[collection] ?? { reads: 0, writes: 0 };
  _stats = {
    ..._stats,
    totalReads: _stats.totalReads + docCount,
    readEntries: [entry, ..._stats.readEntries].slice(0, 500),
    byCollection: {
      ..._stats.byCollection,
      [collection]: { ...colStats, reads: colStats.reads + docCount },
    },
    byCaller: {
      ..._stats.byCaller,
      [caller]: (_stats.byCaller[caller] ?? 0) + docCount,
    },
  };

  _listeners.forEach(fn => fn(_stats));
}

function recordWrite(type: 'setDoc' | 'updateDoc' | 'addDoc' | 'deleteDoc', collection: string) {
  if (!_bgEnabled) return;
  if (collection === 'firebaseMonitor') return;

  const caller = inferCaller();
  const entry: WriteEntry = {
    id: String(++_entryId),
    timestamp: new Date(),
    caller,
    collection,
    type,
  };

  const colStats = _stats.byCollection[collection] ?? { reads: 0, writes: 0 };
  _stats = {
    ..._stats,
    totalWrites: _stats.totalWrites + 1,
    writeEntries: [entry, ..._stats.writeEntries].slice(0, 500),
    byCollection: {
      ..._stats.byCollection,
      [collection]: { ...colStats, writes: colStats.writes + 1 },
    },
  };

  _listeners.forEach(fn => fn(_stats));
}

// ─── Monitored wrappers ───────────────────────────────────────────────────────

export async function getDocs<T>(query: Query<T>): Promise<QuerySnapshot<T>> {
  const result = await _getDocs(query);
  recordRead('getDocs', inferCollection(query), result.size);
  return result;
}

export async function getDoc<T>(ref: DocumentReference<T>): Promise<DocumentSnapshot<T>> {
  const result = await _getDoc(ref);
  recordRead('getDoc', inferCollection(ref), 1);
  return result;
}

export async function setDoc<T>(
  ref: DocumentReference<T>,
  data: WithFieldValue<T>,
  options?: SetOptions,
): Promise<void> {
  const col = inferCollection(ref);
  if (options) {
    await (_setDoc as any)(ref, data, options);
  } else {
    await _setDoc(ref, data);
  }
  recordWrite('setDoc', col);
}

export async function updateDoc<T = DocumentData>(
  ref: DocumentReference<T>,
  data: UpdateData<T>,
): Promise<void> {
  const col = inferCollection(ref);
  await (_updateDoc as any)(ref, data);
  recordWrite('updateDoc', col);
}

export async function addDoc<T>(
  ref: CollectionReference<T>,
  data: WithFieldValue<T>,
): Promise<DocumentReference<T>> {
  const col = inferCollection(ref);
  const result = await _addDoc(ref, data);
  recordWrite('addDoc', col);
  return result;
}

export async function deleteDoc(ref: DocumentReference): Promise<void> {
  const col = inferCollection(ref);
  await _deleteDoc(ref);
  recordWrite('deleteDoc', col);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const firestoreMonitor = {
  get isEnabled() { return _bgEnabled; },

  getStats(): MonitorStats { return _stats; },

  reset() {
    _stats = createEmptyStats();
    _entryId = 0;
    _listeners.forEach(fn => fn(_stats));
  },

  subscribe(fn: (stats: MonitorStats) => void): () => void {
    _listeners.push(fn);
    fn(_stats);
    return () => { _listeners = _listeners.filter(l => l !== fn); };
  },

  topCallers(n = 10): Array<{ caller: string; reads: number }> {
    return Object.entries(_stats.byCaller)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([caller, reads]) => ({ caller, reads }));
  },

  topCollections(n = 10): Array<{ collection: string; reads: number; writes: number }> {
    return Object.entries(_stats.byCollection)
      .sort((a, b) => (b[1].reads + b[1].writes) - (a[1].reads + a[1].writes))
      .slice(0, n)
      .map(([collection, stats]) => ({ collection, reads: stats.reads, writes: stats.writes }));
  },

  /** Trigger a manual flush to Firestore (used by admin page) */
  async flush(): Promise<void> {
    if (_flushCallback) await _flushCallback();
  },
};

// ─── Auto-flush setup (periodic + beforeunload) ───────────────────────────────
// These are wired after the persist service is initialised to avoid circular deps.
// See firestoreMonitorPersistService.ts → init()

export function setupAutoFlush() {
  // Every 5 minutes
  const iv = setInterval(async () => {
    if (_flushCallback) await _flushCallback().catch(() => {});
  }, 5 * 60 * 1000);

  // On visibility hidden (tab switch / close)
  const onHide = () => {
    if (document.visibilityState === 'hidden' && _flushCallback) {
      _flushCallback().catch(() => {});
    }
  };
  document.addEventListener('visibilitychange', onHide);

  // beforeunload fallback
  const onUnload = () => {
    if (_flushCallback) _flushCallback().catch(() => {});
  };
  window.addEventListener('beforeunload', onUnload);

  return () => {
    clearInterval(iv);
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('beforeunload', onUnload);
  };
}
