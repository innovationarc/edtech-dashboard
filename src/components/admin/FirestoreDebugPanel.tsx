// src/components/admin/FirestoreDebugPanel.tsx
// Firestore read/write monitor modal — shown per-dashboard based on admin config.
// Reads toggle config from Firestore (_config doc). Zero extra reads of its own beyond that.
// Admin-only: global enable/disable. Per-dashboard: modal visibility toggle.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { firestoreMonitor, MonitorStats, ReadEntry } from '../../services/firestoreMonitor';
import {
  firestoreMonitorPersistService,
  MonitorConfig,
  DashboardKey,
  DEFAULT_CONFIG,
} from '../../services/firestoreMonitorPersistService';
import { useDashboard } from '../../contexts/DashboardContext';

type Tab = 'live' | 'callers' | 'collections';

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
      totalWrites: stats.totalWrites,
      totalOperations: stats.readEntries.length + stats.writeEntries.length,
      byCollection: stats.byCollection,
      byCaller: stats.byCaller,
    },
    readEntries: stats.readEntries.map(e => ({
      id: e.id, timestamp: ts(e.timestamp),
      type: e.type, caller: e.caller,
      collection: e.collection, docCount: e.docCount,
    })),
    writeEntries: stats.writeEntries.map(e => ({
      id: e.id, timestamp: ts(e.timestamp),
      type: e.type, caller: e.caller, collection: e.collection,
    })),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url;
  a.download = `firestore-monitor-${Date.now()}.json`; a.click();
  URL.revokeObjectURL(url);
}

function exportCSV(stats: MonitorStats) {
  const rows = [
    ['timestamp', 'type', 'caller', 'collection', 'docCount'],
    ...stats.readEntries.map(e => [
      ts(e.timestamp), e.type,
      `"${e.caller.replace(/"/g, '""')}"`,
      e.collection, String(e.docCount),
    ]),
    ...stats.writeEntries.map(e => [
      ts(e.timestamp), e.type,
      `"${e.caller.replace(/"/g, '""')}"`,
      e.collection, '1',
    ]),
  ];
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url;
  a.download = `firestore-monitor-${Date.now()}.csv`; a.click();
  URL.revokeObjectURL(url);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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

const BarRow: React.FC<{ label: string; value: number; max: number; fullscreen: boolean; color?: string }> = ({ label, value, max, fullscreen, color }) => (
  <div style={{ padding: fullscreen ? '5px 12px' : '3px 8px', fontFamily: 'monospace' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
      <span style={{ color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                     maxWidth: fullscreen ? 600 : 180, fontSize: fullscreen ? 12 : 10.5 }} title={label}>{label}</span>
      <span style={{ color: color ?? readsColor(value), fontWeight: 700, marginLeft: 12, fontSize: fullscreen ? 13 : 11 }}>{fmt(value)}</span>
    </div>
    <div style={{ height: fullscreen ? 4 : 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
      <div style={{ height: '100%', width: `${(value / max) * 100}%`, background: color ?? readsColor(value), borderRadius: 2, transition: 'width 0.3s ease' }} />
    </div>
  </div>
);

const StatBox: React.FC<{ label: string; value: string; color: string; fs: boolean }> = ({ label, value, color, fs }) => (
  <div style={{ textAlign: 'center' }}>
    <div style={{ fontSize: fs ? 18 : 14, fontWeight: 800, color }}>{value}</div>
    <div style={{ fontSize: fs ? 9 : 8, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 1 }}>{label}</div>
  </div>
);

const EmptyState: React.FC = () => (
  <div style={{ padding: '32px 0', textAlign: 'center', color: 'rgba(255,255,255,0.18)', fontSize: 11 }}>
    Waiting for Firestore operations…
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

// ─── Inner panel (always rendered when visible) ───────────────────────────────

const FirestoreDebugPanelInner: React.FC = () => {
  const [stats, setStats]         = useState<MonitorStats>(firestoreMonitor.getStats());
  const [tab, setTab]             = useState<Tab>('live');
  const [filter, setFilter]       = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [position, setPosition]   = useState({ x: 0, y: 0 });
  const [flushing, setFlushing]   = useState(false);

  const dragging    = useRef(false);
  const dragStart   = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);
  const panelRef    = useRef<HTMLDivElement>(null);
  const sparkW      = fullscreen ? 500 : 220;

  useEffect(() => firestoreMonitor.subscribe(setStats), []);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (fullscreen) return;
    if ((e.target as HTMLElement).closest('button, input, select')) return;
    dragging.current = true;
    dragStart.current = { mx: e.clientX, my: e.clientY, px: position.x, py: position.y };
    e.preventDefault();
  }, [fullscreen, position]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current || !dragStart.current) return;
      setPosition({
        x: dragStart.current.px + (e.clientX - dragStart.current.mx),
        y: dragStart.current.py + (e.clientY - dragStart.current.my),
      });
    };
    const onUp = () => { dragging.current = false; dragStart.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  const now = Date.now();
  const recentReads = stats.readEntries.filter(e => now - e.timestamp.getTime() < 60_000);
  const readsPerMin = recentReads.reduce((s, e) => s + e.docCount, 0);
  const sessionSecs = Math.floor((now - stats.sessionStart.getTime()) / 1000);

  const filteredEntries = filter
    ? stats.readEntries.filter(e => e.caller.includes(filter) || e.collection.includes(filter))
    : stats.readEntries;

  const topCallers = firestoreMonitor.topCallers(20);
  const topCols    = firestoreMonitor.topCollections(20);
  const maxCaller  = Math.max(...topCallers.map(c => c.reads), 1);
  const maxCol     = Math.max(...topCols.map(c => c.reads + c.writes), 1);

  const contentH = fullscreen ? undefined : (collapsed ? 0 : 200);

  const handleFlush = async () => {
    setFlushing(true);
    try { await firestoreMonitorPersistService.flush(); } finally { setFlushing(false); }
  };

  const panelStyle: React.CSSProperties = fullscreen
    ? { position: 'fixed', inset: 0, zIndex: 300, borderRadius: 0, display: 'flex', flexDirection: 'column' }
    : {
        position: 'fixed',
        bottom: 20, left: 20,
        transform: `translate(${position.x}px, ${position.y}px)`,
        zIndex: 9998,
        width: 320,
        borderRadius: 12,
        cursor: dragging.current ? 'grabbing' : 'grab',
        maxHeight: collapsed ? 'none' : 480,
        display: 'flex', flexDirection: 'column',
      };

  return (
    <div
      ref={panelRef}
      onMouseDown={onMouseDown}
      style={{
        ...panelStyle,
        background: 'rgba(10,12,18,0.97)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        color: '#e2e8f0',
        userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: fullscreen ? '10px 16px' : '7px 10px',
        borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0,
        background: 'rgba(99,102,241,0.08)',
      }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e',
                      boxShadow: '0 0 6px #22c55e' }} />
        <span style={{ color: '#e2e8f0', fontSize: fullscreen ? 14 : 11, fontWeight: 700, letterSpacing: '0.05em', flex: 1 }}>
          FIRESTORE MONITOR
          {fullscreen && <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400, marginLeft: 10, fontSize: 11 }}>— live session</span>}
        </span>
        <span style={{ fontSize: fullscreen ? 18 : 13, fontWeight: 800, color: readsColor(stats.totalReads), minWidth: 50, textAlign: 'right' }}>
          {fmt(stats.totalReads)}R / {fmt(stats.totalWrites)}W
        </span>
        <Btn color="#22c55e" title="Flush to Firestore now" onClick={handleFlush}>{flushing ? '⏳' : '⬆'}</Btn>
        <Btn color="#6366f1" title="Reset session counters" onClick={() => firestoreMonitor.reset()}>↺</Btn>
        <Btn color="#0ea5e9" title="Export JSON" onClick={() => exportJSON(stats)}>⬇J</Btn>
        <Btn color="#10b981" title="Export CSV"  onClick={() => exportCSV(stats)}>⬇C</Btn>
        <Btn color="#f59e0b" title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'} onClick={() => setFullscreen(v => !v)}>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr',
                        padding: fullscreen ? '8px 16px' : '5px 8px', gap: 4,
                        borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
            <StatBox label="Reads"    value={fmt(stats.totalReads)}    color={readsColor(stats.totalReads)} fs={fullscreen} />
            <StatBox label="Writes"   value={fmt(stats.totalWrites)}   color="#a78bfa" fs={fullscreen} />
            <StatBox label="R/min"    value={fmt(readsPerMin)}          color={readsPerMin > 100 ? '#ef4444' : '#94a3b8'} fs={fullscreen} />
            <StatBox label="Ops"      value={fmt(stats.readEntries.length + stats.writeEntries.length)} color="#94a3b8" fs={fullscreen} />
            <StatBox label="Session"  value={`${sessionSecs}s`}         color="rgba(255,255,255,0.3)" fs={fullscreen} />
          </div>

          {/* Sparkline */}
          <div style={{ padding: fullscreen ? '6px 16px 4px' : '4px 8px 2px',
                        borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', marginBottom: 3 }}>LAST 60s READS</div>
            <Sparkline entries={stats.readEntries} width={sparkW} />
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
            {(['live', 'callers', 'collections'] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                flex: 1, padding: fullscreen ? '8px 0' : '5px 0',
                fontSize: fullscreen ? 11 : 10, fontWeight: 600,
                background: tab === t ? 'rgba(99,102,241,0.2)' : 'transparent',
                color: tab === t ? '#818cf8' : 'rgba(255,255,255,0.3)',
                border: 'none', cursor: 'pointer',
                borderBottom: tab === t ? '2px solid #6366f1' : '2px solid transparent',
                textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'inherit',
              }}>
                {t === 'live' ? `Live (${filteredEntries.length})` : t === 'callers' ? `Callers (${topCallers.length})` : `Collections (${topCols.length})`}
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

          {/* Column headers (live tab) */}
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
                ? <EmptyState />
                : filteredEntries.map(e => <EntryRow key={e.id} entry={e} fullscreen={fullscreen} />)
            )}
            {tab === 'callers' && (
              topCallers.length === 0 ? <EmptyState />
                : <div style={{ padding: '4px 0' }}>
                    {topCallers.map(({ caller, reads }) => <BarRow key={caller} label={caller} value={reads} max={maxCaller} fullscreen={fullscreen} />)}
                  </div>
            )}
            {tab === 'collections' && (
              topCols.length === 0 ? <EmptyState />
                : <div style={{ padding: '4px 0' }}>
                    {topCols.map(({ collection, reads, writes }) => (
                      <div key={collection}>
                        <BarRow label={`${collection} (reads)`}  value={reads}  max={maxCol} fullscreen={fullscreen} color="#22c55e" />
                        <BarRow label={`${collection} (writes)`} value={writes} max={maxCol} fullscreen={fullscreen} color="#a78bfa" />
                      </div>
                    ))}
                  </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: fullscreen ? '6px 16px' : '3px 8px', fontSize: 9,
                        color: 'rgba(255,255,255,0.18)',
                        borderTop: '1px solid rgba(255,255,255,0.04)',
                        display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
            <span>⬆ flush to DB · ⊞ fullscreen · ↺ reset</span>
            <span>{stats.readEntries.length + stats.writeEntries.length} ops · max 500</span>
          </div>
        </>
      )}
    </div>
  );
};

// ─── Config-aware guard ───────────────────────────────────────────────────────

const FirestoreDebugPanel: React.FC = () => {
  const { user } = useDashboard();
  const [config, setConfig] = useState<MonitorConfig>(DEFAULT_CONFIG);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    firestoreMonitorPersistService.getMonitorConfig().then(cfg => {
      setConfig(cfg);
      setLoaded(true);
    });
    // Re-check config every 30s so admin changes propagate without refresh
    const iv = setInterval(() => {
      firestoreMonitorPersistService.getMonitorConfig().then(setConfig);
    }, 30_000);
    return () => clearInterval(iv);
  }, []);

  if (!loaded || !user) return null;
  if (!config.globalEnabled) return null;

  // Map user role to dashboard key
  const dk: DashboardKey = (user.role === 'admin' ? 'admin'
    : user.role === 'student' ? 'student'
    : user.role === 'teacher' ? 'teacher'
    : user.role === 'manager' || user.role === 'coordinator' ? 'manager'
    : user.role === 'course_manager' ? 'course_manager'
    : '_global') as DashboardKey;

  if (!config.dashboardToggles[dk]) return null;

  return <FirestoreDebugPanelInner />;
};

export default FirestoreDebugPanel;
