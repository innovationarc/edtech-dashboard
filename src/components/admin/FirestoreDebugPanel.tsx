// src/components/admin/FirestoreDebugPanel.tsx
// Firestore read monitor — fullscreen mode + JSON/CSV export.
// Zero reads of its own. Draggable, touch-friendly, production-safe.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { firestoreMonitor, MonitorStats, ReadEntry } from '../../services/firestoreMonitor';
import { dashboardStatsService } from '../../services/dashboardStatsService';
import { useDashboard } from '../../contexts/DashboardContext';

type Tab = 'live' | 'callers' | 'collections' | 'cleanup';

function fmt(n: number): string { return n.toLocaleString(); }
function elapsed(from: Date): string {
  const s = Math.floor((Date.now() - from.getTime()) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h`;
}
function readsColor(n: number): string {
  if (n >= 500) return '#ef4444';
  if (n >= 100) return '#f97316';
  if (n >= 20)  return '#eab308';
  return '#22c55e';
}
function ts(d: Date): string {
  return d.toISOString().replace('T', ' ').substring(0, 23);
}

function exportJSON(stats: MonitorStats) {
  const payload = {
    exportedAt: new Date().toISOString(),
    sessionStart: stats.sessionStart.toISOString(),
    summary: {
      totalReads: stats.totalReads,
      totalOperations: stats.entries.length,
      byCollection: stats.byCollection,
      byCaller: stats.byCaller,
    },
    entries: stats.entries.map(e => ({
      id: e.id,
      timestamp: ts(e.timestamp),
      type: e.type,
      caller: e.caller,
      collection: e.collection,
      docCount: e.docCount,
    })),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `firestore-reads-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportCSV(stats: MonitorStats) {
  const rows = [
    ['timestamp', 'type', 'caller', 'collection', 'docCount'],
    ...stats.entries.map(e => [
      ts(e.timestamp), e.type,
      `"${e.caller.replace(/"/g, '""')}"`,
      e.collection, String(e.docCount),
    ]),
  ];
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `firestore-reads-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const Sparkline: React.FC<{ entries: ReadEntry[]; width: number }> = ({ entries, width }) => {
  const buckets = 30;
  const now = Date.now();
  const windowMs = 60_000;
  const counts = Array(buckets).fill(0);
  entries.forEach(e => {
    const age = now - e.timestamp.getTime();
    if (age > windowMs) return;
    const idx = Math.floor((1 - age / windowMs) * (buckets - 1));
    counts[Math.max(0, Math.min(buckets - 1, idx))] += e.docCount;
  });
  const max = Math.max(...counts, 1);
  const h = 32;
  return (
    <svg width={width} height={h} style={{ display: 'block' }}>
      {counts.map((c, i) => {
        const barH = Math.max(2, (c / max) * h);
        const x = (i / buckets) * width;
        const barW = Math.max(1, (width / buckets) - 1);
        return <rect key={i} x={x} y={h - barH} width={barW} height={barH}
          fill={c > 0 ? readsColor(c * 5) : 'rgba(255,255,255,0.06)'} rx={1} />;
      })}
    </svg>
  );
};

const EntryRow: React.FC<{ entry: ReadEntry; fullscreen: boolean }> = ({ entry, fullscreen }) => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: fullscreen ? '50px 1fr 150px 90px 55px' : '40px 1fr 70px 42px',
    gap: 6, padding: '4px 10px',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    fontSize: fullscreen ? 11.5 : 10, alignItems: 'center', fontFamily: 'monospace',
  }}>
    <span style={{ color: readsColor(entry.docCount), fontWeight: 700, fontSize: fullscreen ? 13 : 11 }}>
      {entry.docCount}
    </span>
    <span style={{ color: '#c4b5fd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title={entry.caller}>{entry.caller}</span>
    <span style={{ color: '#67e8f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title={entry.collection}>{entry.collection}</span>
    {fullscreen && (
      <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>{entry.type}</span>
    )}
    <span style={{ color: 'rgba(255,255,255,0.25)', textAlign: 'right', fontSize: 10 }}>
      {elapsed(entry.timestamp)}
    </span>
  </div>
);

const BarRow: React.FC<{ label: string; value: number; max: number; fullscreen: boolean }> = ({ label, value, max, fullscreen }) => (
  <div style={{ padding: fullscreen ? '5px 12px' : '3px 8px', fontFamily: 'monospace' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
      <span style={{ color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                     maxWidth: fullscreen ? 600 : 180, fontSize: fullscreen ? 12 : 10.5 }} title={label}>{label}</span>
      <span style={{ color: readsColor(value), fontWeight: 700, marginLeft: 12, fontSize: fullscreen ? 13 : 11 }}>{fmt(value)}</span>
    </div>
    <div style={{ height: fullscreen ? 4 : 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
      <div style={{ height: '100%', width: `${(value / max) * 100}%`, background: readsColor(value), borderRadius: 2, transition: 'width 0.3s ease' }} />
    </div>
  </div>
);

const StatBox: React.FC<{ label: string; value: string; color: string; fs: boolean }> = ({ label, value, color, fs }) => (
  <div style={{ textAlign: 'center' }}>
    <div style={{ fontSize: fs ? 18 : 14, fontWeight: 800, color }}>{value}</div>
    <div style={{ fontSize: fs ? 9 : 8, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 1 }}>{label}</div>
  </div>
);

const EmptyState: React.FC<{ enabled: boolean }> = ({ enabled }) => (
  <div style={{ padding: '32px 0', textAlign: 'center', color: 'rgba(255,255,255,0.18)', fontSize: 11 }}>
    {enabled ? 'Waiting for Firestore reads…' : 'Press ▶ to start monitoring'}
  </div>
);

const Btn: React.FC<{ color: string; title: string; onClick: () => void; children: React.ReactNode }> = ({ color, title, onClick, children }) => (
  <button onClick={onClick} title={title} style={{
    minWidth: 26, height: 26, borderRadius: 6, border: 'none', cursor: 'pointer',
    background: `${color}22`, color, fontSize: 11, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px',
    fontFamily: 'inherit', flexShrink: 0,
  }}>{children}</button>
);

// ─── Main panel ───────────────────────────────────────────────────────────────

const FirestoreDebugPanelInner: React.FC = () => {
  const [stats, setStats]         = useState<MonitorStats>(firestoreMonitor.getStats());
  const [enabled, setEnabled]     = useState(firestoreMonitor.isEnabled);
  const [collapsed, setCollapsed] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [tab, setTab]             = useState<Tab>('live');
  const [pos, setPos]             = useState({ x: 8, y: Math.max(80, window.innerHeight - 460) });
  const [filter, setFilter]       = useState('');
  const [cleaning, setCleaning]   = useState(false);
  const [cleanLog, setCleanLog]   = useState<string[]>([]);
  const dragging    = useRef(false);
  const dragOffset  = useRef({ x: 0, y: 0 });

  useEffect(() => firestoreMonitor.subscribe(s => setStats({ ...s })), []);

  const toggle = useCallback(() => {
    if (enabled) { firestoreMonitor.disable(); }
    else         { firestoreMonitor.enable();  }
    setEnabled(v => !v);
  }, [enabled]);

  const reset = useCallback(() => firestoreMonitor.reset(), []);

  const runCleanup = useCallback(async () => {
    const uid = (window as any).__currentStudentIdForCleanup;
    if (!uid) {
      alert('Open the student dashboard first, then run cleanup.\nThe student UID will be detected automatically.');
      return;
    }
    setCleaning(true);
    setCleanLog([]);
    try {
      await dashboardStatsService.cleanupAppUsageLogs(uid, msg => {
        setCleanLog(prev => [...prev.slice(-8), msg]);
      });
    } catch (e: any) {
      setCleanLog(prev => [...prev, `ERROR: ${e.message}`]);
    } finally {
      setCleaning(false);
    }
  }, []);

  // Mouse drag
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (fullscreen || (e.target as HTMLElement).closest('button, input')) return;
    dragging.current = true;
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    e.preventDefault();
  }, [pos, fullscreen]);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragging.current) return;
      setPos({ x: Math.max(0, Math.min(window.innerWidth - 320, e.clientX - dragOffset.current.x)),
               y: Math.max(0, Math.min(window.innerHeight - 60,  e.clientY - dragOffset.current.y)) });
    };
    const up = () => { dragging.current = false; };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, []);

  // Touch drag
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (fullscreen || (e.target as HTMLElement).closest('button, input')) return;
    const t = e.touches[0];
    dragging.current = true;
    dragOffset.current = { x: t.clientX - pos.x, y: t.clientY - pos.y };
  }, [pos, fullscreen]);

  useEffect(() => {
    const move = (e: TouchEvent) => {
      if (!dragging.current) return;
      const t = e.touches[0];
      setPos({ x: Math.max(0, Math.min(window.innerWidth - 320, t.clientX - dragOffset.current.x)),
               y: Math.max(0, Math.min(window.innerHeight - 60,  t.clientY - dragOffset.current.y)) });
    };
    const up = () => { dragging.current = false; };
    window.addEventListener('touchmove', move, { passive: true });
    window.addEventListener('touchend', up);
    return () => { window.removeEventListener('touchmove', move); window.removeEventListener('touchend', up); };
  }, []);

  const filteredEntries = filter
    ? stats.entries.filter(e => e.caller.toLowerCase().includes(filter.toLowerCase()) || e.collection.toLowerCase().includes(filter.toLowerCase()))
    : stats.entries;

  const topCallers = firestoreMonitor.topCallers(50);
  const topCols    = firestoreMonitor.topCollections(50);
  const maxCaller  = topCallers[0]?.reads ?? 1;
  const maxCol     = topCols[0]?.reads ?? 1;
  const sessionSecs = Math.floor((Date.now() - stats.sessionStart.getTime()) / 1000);
  const readsPerMin = sessionSecs > 0 ? Math.round((stats.totalReads / sessionSecs) * 60) : 0;
  const sparkW = fullscreen ? Math.min(window.innerWidth - 28, 1400) : 298;
  const contentH = fullscreen ? 'calc(100vh - 200px)' : '260px';

  const panelStyle: React.CSSProperties = fullscreen
    ? { position: 'fixed', inset: 0, zIndex: 99999, fontFamily: "'JetBrains Mono','Fira Code','Consolas',monospace",
        background: 'rgba(6,6,14,0.99)', backdropFilter: 'blur(20px)', display: 'flex', flexDirection: 'column' }
    : { position: 'fixed', left: pos.x, top: pos.y, width: 320, zIndex: 99999,
        fontFamily: "'JetBrains Mono','Fira Code','Consolas',monospace",
        borderRadius: 12, overflow: 'hidden',
        boxShadow: '0 8px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,102,241,0.3)',
        background: 'rgba(10,10,20,0.97)', backdropFilter: 'blur(20px)',
        userSelect: 'none', cursor: 'grab' };

  return (
    <div style={panelStyle} onMouseDown={onMouseDown} onTouchStart={onTouchStart}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6,
                    padding: fullscreen ? '10px 16px' : '7px 10px',
                    background: 'rgba(99,102,241,0.15)',
                    borderBottom: '1px solid rgba(99,102,241,0.25)', flexShrink: 0 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: enabled ? '#22c55e' : '#ef4444',
                      boxShadow: enabled ? '0 0 6px #22c55e' : 'none' }} />
        <span style={{ color: '#e2e8f0', fontSize: fullscreen ? 14 : 11, fontWeight: 700, letterSpacing: '0.05em', flex: 1 }}>
          FIRESTORE MONITOR
          {fullscreen && <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400, marginLeft: 10, fontSize: 11 }}>— fullscreen · drag disabled</span>}
        </span>
        <span style={{ fontSize: fullscreen ? 18 : 13, fontWeight: 800, color: readsColor(stats.totalReads), minWidth: 50, textAlign: 'right' }}>
          {fmt(stats.totalReads)}
        </span>
        <Btn color={enabled ? '#ef4444' : '#22c55e'} title={enabled ? 'Stop' : 'Start'} onClick={toggle}>{enabled ? '■' : '▶'}</Btn>
        <Btn color="#6366f1"  title="Reset"           onClick={reset}>↺</Btn>
        <Btn color="#0ea5e9"  title="Export JSON"      onClick={() => exportJSON(stats)}>⬇J</Btn>
        <Btn color="#10b981"  title="Export CSV"       onClick={() => exportCSV(stats)}>⬇C</Btn>
        <Btn color="#f59e0b"  title={fullscreen ? 'Exit fullscreen' : 'Open fullscreen'} onClick={() => setFullscreen(v => !v)}>
          {fullscreen ? '⊡' : '⊞'}
        </Btn>
        {!fullscreen && (
          <Btn color="#475569" title={collapsed ? 'Expand' : 'Collapse'} onClick={() => setCollapsed(v => !v)}>
            {collapsed ? '▾' : '▴'}
          </Btn>
        )}
      </div>

      {!collapsed && (
        <>
          {/* Stats bar */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
                        padding: fullscreen ? '8px 16px' : '5px 8px', gap: 4,
                        borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
            <StatBox label="Total reads"  value={fmt(stats.totalReads)}    color={readsColor(stats.totalReads)} fs={fullscreen} />
            <StatBox label="Reads/min"    value={fmt(readsPerMin)}          color={readsPerMin > 100 ? '#ef4444' : '#94a3b8'} fs={fullscreen} />
            <StatBox label="Operations"   value={fmt(stats.entries.length)} color="#94a3b8" fs={fullscreen} />
            <StatBox label="Session"      value={`${sessionSecs}s`}         color="rgba(255,255,255,0.3)" fs={fullscreen} />
          </div>

          {/* Sparkline */}
          <div style={{ padding: fullscreen ? '6px 16px 4px' : '4px 8px 2px',
                        borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', marginBottom: 3 }}>LAST 60s ACTIVITY</div>
            <Sparkline entries={stats.entries} width={sparkW} />
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
            {(['live', 'callers', 'collections', 'cleanup'] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                flex: 1, padding: fullscreen ? '8px 0' : '5px 0',
                fontSize: fullscreen ? 11 : 10, fontWeight: 600,
                background: tab === t ? 'rgba(99,102,241,0.2)' : 'transparent',
                color: tab === t ? '#818cf8' : t === 'cleanup' ? '#f59e0b' : 'rgba(255,255,255,0.3)',
                border: 'none', cursor: 'pointer',
                borderBottom: tab === t ? '2px solid #6366f1' : '2px solid transparent',
                textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'inherit',
              }}>
                {t === 'live' ? `Live (${filteredEntries.length})` : t === 'callers' ? `Callers (${topCallers.length})` : t === 'collections' ? `Collections (${topCols.length})` : '🧹 Fix'}
              </button>
            ))}
          </div>

          {/* Filter */}
          {tab === 'live' && (
            <div style={{ padding: fullscreen ? '6px 14px' : '4px 8px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
              <input value={filter} onChange={e => setFilter(e.target.value)}
                placeholder="Filter by caller or collection…"
                style={{ width: '100%', boxSizing: 'border-box',
                         background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                         borderRadius: 6, padding: fullscreen ? '5px 10px' : '3px 8px', color: '#e2e8f0',
                         fontSize: fullscreen ? 12 : 10.5, fontFamily: 'inherit', outline: 'none' }} />
            </div>
          )}

          {/* Column headers */}
          {tab === 'live' && filteredEntries.length > 0 && (
            <div style={{ display: 'grid',
                          gridTemplateColumns: fullscreen ? '50px 1fr 150px 90px 55px' : '40px 1fr 70px 42px',
                          gap: 6, padding: fullscreen ? '4px 10px' : '3px 8px',
                          fontSize: 9, color: 'rgba(255,255,255,0.2)', fontWeight: 700,
                          letterSpacing: '0.08em', textTransform: 'uppercase',
                          borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
              <span>DOCS</span><span>CALLER</span><span>COLLECTION</span>
              {fullscreen && <span>TYPE</span>}
              <span style={{ textAlign: 'right' }}>AGO</span>
            </div>
          )}

          {/* Scrollable list */}
          <div style={{ height: contentH, overflowY: 'auto', cursor: 'default', flex: fullscreen ? 1 : 'none' }}
               onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}>
            {tab === 'live' && (
              filteredEntries.length === 0
                ? <EmptyState enabled={enabled} />
                : filteredEntries.map(e => <EntryRow key={e.id} entry={e} fullscreen={fullscreen} />)
            )}
            {tab === 'callers' && (
              topCallers.length === 0 ? <EmptyState enabled={enabled} />
                : <div style={{ padding: '4px 0' }}>
                    {topCallers.map(({ caller, reads }) => <BarRow key={caller} label={caller} value={reads} max={maxCaller} fullscreen={fullscreen} />)}
                  </div>
            )}
            {tab === 'collections' && (
              topCols.length === 0 ? <EmptyState enabled={enabled} />
                : <div style={{ padding: '4px 0' }}>
                    {topCols.map(({ collection, reads }) => <BarRow key={collection} label={collection} value={reads} max={maxCol} fullscreen={fullscreen} />)}
                  </div>
            )}
            {tab === 'cleanup' && (
              <div style={{ padding: 14, fontFamily: 'monospace' }}>
                <div style={{ color: '#f59e0b', fontWeight: 700, fontSize: 12, marginBottom: 8 }}>🧹 appUsageLogs Cleanup</div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginBottom: 12, lineHeight: 1.6 }}>
                  Merges duplicate per-session docs into one doc per day.<br/>
                  Reduces heatmap reads from 700+ to ~70. Run once per student.<br/>
                  Safe to run multiple times — idempotent.
                </div>
                <button onClick={runCleanup} disabled={cleaning} style={{
                  width: '100%', padding: '8px 0', borderRadius: 8, border: 'none',
                  background: cleaning ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.2)',
                  color: '#f59e0b', fontWeight: 700, fontSize: 12, cursor: cleaning ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit', marginBottom: 10,
                }}>
                  {cleaning ? '⏳ Running...' : '▶ Run Cleanup for Current Student'}
                </button>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', marginBottom: 6 }}>LOG</div>
                <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: 6, padding: 8, minHeight: 60, maxHeight: 140, overflowY: 'auto' }}>
                  {cleanLog.length === 0
                    ? <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10 }}>No output yet</span>
                    : cleanLog.map((line, i) => (
                        <div key={i} style={{ color: line.startsWith('ERROR') ? '#ef4444' : line.startsWith('Done') ? '#22c55e' : '#94a3b8', fontSize: 10, marginBottom: 2 }}>{line}</div>
                      ))
                  }
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: fullscreen ? '6px 16px' : '3px 8px', fontSize: 9,
                        color: 'rgba(255,255,255,0.18)',
                        borderTop: '1px solid rgba(255,255,255,0.04)',
                        display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
            <span>⬇J = JSON export · ⬇C = CSV export · ⊞ = fullscreen</span>
            <span>{stats.entries.length} ops · max 500</span>
          </div>
        </>
      )}
    </div>
  );
};

// ─── Guard wrapper ────────────────────────────────────────────────────────────

const FirestoreDebugPanel: React.FC = () => {
  const { user } = useDashboard();
  // TEMP: show for all users to debug reads — revert to: user?.role !== 'admin' after testing
  if (!user) return null;
  return <FirestoreDebugPanelInner />;
};

export default FirestoreDebugPanel;
