// src/components/admin/FirestoreDebugPanel.tsx
// Admin-only floating Firestore read monitor.
// Zero reads of its own — purely observes via firestoreMonitor.
// Only renders for admin role. Draggable, collapsible, production-safe.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { firestoreMonitor, MonitorStats, ReadEntry } from '../../services/firestoreMonitor';
import { useDashboard } from '../../contexts/DashboardContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'live' | 'callers' | 'collections';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString();
}

function elapsed(from: Date): string {
  const s = Math.floor((Date.now() - from.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

function readsColor(n: number): string {
  if (n >= 1000) return '#ef4444';
  if (n >= 500)  return '#f97316';
  if (n >= 100)  return '#eab308';
  return '#22c55e';
}

// ─── Mini sparkline ───────────────────────────────────────────────────────────

const Sparkline: React.FC<{ entries: ReadEntry[] }> = ({ entries }) => {
  const buckets = 20;
  const now = Date.now();
  const windowMs = 60_000; // last 60 seconds
  const counts = Array(buckets).fill(0);

  entries.forEach(e => {
    const age = now - e.timestamp.getTime();
    if (age > windowMs) return;
    const idx = Math.floor((1 - age / windowMs) * (buckets - 1));
    counts[Math.max(0, Math.min(buckets - 1, idx))] += e.docCount;
  });

  const max = Math.max(...counts, 1);
  const h = 28;
  const w = 120;

  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      {counts.map((c, i) => {
        const barH = Math.max(2, (c / max) * h);
        const x = (i / buckets) * w;
        const barW = (w / buckets) - 1;
        return (
          <rect
            key={i}
            x={x}
            y={h - barH}
            width={barW}
            height={barH}
            fill={c > 0 ? readsColor(c * 10) : 'rgba(255,255,255,0.08)'}
            rx={1}
          />
        );
      })}
    </svg>
  );
};

// ─── Entry row ────────────────────────────────────────────────────────────────

const EntryRow: React.FC<{ entry: ReadEntry }> = ({ entry }) => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: '42px 1fr 70px 50px',
    gap: 6,
    padding: '4px 8px',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    fontSize: 10.5,
    alignItems: 'center',
    fontFamily: 'monospace',
  }}>
    <span style={{
      color: entry.docCount >= 50 ? '#ef4444' : entry.docCount >= 10 ? '#f97316' : '#22c55e',
      fontWeight: 700,
      fontSize: 12,
    }}>
      {entry.docCount}
    </span>
    <span style={{ color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title={entry.caller}>
      {entry.caller}
    </span>
    <span style={{ color: '#6366f1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title={entry.collection}>
      {entry.collection}
    </span>
    <span style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'right' }}>
      {elapsed(entry.timestamp)}
    </span>
  </div>
);

// ─── Bar chart row ────────────────────────────────────────────────────────────

const BarRow: React.FC<{ label: string; value: number; max: number }> = ({ label, value, max }) => (
  <div style={{ padding: '3px 8px', fontFamily: 'monospace', fontSize: 10.5 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
      <span style={{ color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}
            title={label}>{label}</span>
      <span style={{ color: readsColor(value), fontWeight: 700, marginLeft: 8 }}>{fmt(value)}</span>
    </div>
    <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
      <div style={{
        height: '100%',
        width: `${(value / max) * 100}%`,
        background: readsColor(value),
        borderRadius: 2,
        transition: 'width 0.3s ease',
      }} />
    </div>
  </div>
);

// ─── Main panel ───────────────────────────────────────────────────────────────

const FirestoreDebugPanelInner: React.FC = () => {
  const [stats, setStats] = useState<MonitorStats>(firestoreMonitor.getStats());
  const [enabled, setEnabled] = useState(firestoreMonitor.isEnabled);
  const [collapsed, setCollapsed] = useState(false);
  const [tab, setTab] = useState<Tab>('live');
  const [pos, setPos] = useState({ x: 16, y: 80 });
  const [filter, setFilter] = useState('');
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Subscribe to monitor
  useEffect(() => {
    return firestoreMonitor.subscribe(s => setStats({ ...s }));
  }, []);

  // Toggle monitor
  const toggle = useCallback(() => {
    if (enabled) {
      firestoreMonitor.disable();
      try { sessionStorage.removeItem('__fsm_enabled'); } catch {}
    } else {
      firestoreMonitor.enable();
      try { sessionStorage.setItem('__fsm_enabled', '1'); } catch {}
    }
    setEnabled(!enabled);
  }, [enabled]);

  const reset = useCallback(() => {
    firestoreMonitor.reset();
  }, []);

  // Drag handlers
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input')) return;
    dragging.current = true;
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    e.preventDefault();
  }, [pos]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const x = Math.max(0, Math.min(window.innerWidth - 320, e.clientX - dragOffset.current.x));
      const y = Math.max(0, Math.min(window.innerHeight - 60, e.clientY - dragOffset.current.y));
      setPos({ x, y });
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  // Filtered entries
  const filteredEntries = filter
    ? stats.entries.filter(e =>
        e.caller.toLowerCase().includes(filter.toLowerCase()) ||
        e.collection.toLowerCase().includes(filter.toLowerCase())
      )
    : stats.entries;

  const topCallers = firestoreMonitor.topCallers(15);
  const topCols = firestoreMonitor.topCollections(15);
  const maxCaller = topCallers[0]?.reads ?? 1;
  const maxCol = topCols[0]?.reads ?? 1;

  const sessionSecs = Math.floor((Date.now() - stats.sessionStart.getTime()) / 1000);
  const readsPerMin = sessionSecs > 0 ? Math.round((stats.totalReads / sessionSecs) * 60) : 0;

  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    left: pos.x,
    top: pos.y,
    width: 320,
    zIndex: 99999,
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
    borderRadius: 12,
    overflow: 'hidden',
    boxShadow: '0 8px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,102,241,0.3)',
    background: 'rgba(10,10,20,0.97)',
    backdropFilter: 'blur(20px)',
    userSelect: 'none',
    cursor: dragging.current ? 'grabbing' : 'grab',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 10px',
    background: 'rgba(99,102,241,0.15)',
    borderBottom: '1px solid rgba(99,102,241,0.2)',
  };

  return createPortal(
    <div ref={panelRef} style={panelStyle} onMouseDown={onMouseDown}>
      {/* Header */}
      <div style={headerStyle}>
        {/* Status dot */}
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: enabled ? '#22c55e' : '#ef4444',
          boxShadow: enabled ? '0 0 6px #22c55e' : 'none',
          flexShrink: 0,
        }} />
        <span style={{ color: '#e2e8f0', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', flex: 1 }}>
          FIRESTORE MONITOR
        </span>
        {/* Read count badge */}
        <span style={{
          fontSize: 13, fontWeight: 800,
          color: readsColor(stats.totalReads),
          minWidth: 40, textAlign: 'right',
        }}>
          {fmt(stats.totalReads)}
        </span>
        {/* Buttons */}
        <button onClick={toggle} style={btnStyle(enabled ? '#ef4444' : '#22c55e')} title={enabled ? 'Stop' : 'Start'}>
          {enabled ? '■' : '▶'}
        </button>
        <button onClick={reset} style={btnStyle('#6366f1')} title="Reset">↺</button>
        <button onClick={() => setCollapsed(c => !c)} style={btnStyle('#475569')} title={collapsed ? 'Expand' : 'Collapse'}>
          {collapsed ? '▾' : '▴'}
        </button>
      </div>

      {!collapsed && (
        <>
          {/* Stats bar */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
            padding: '6px 8px', gap: 4,
            borderBottom: '1px solid rgba(255,255,255,0.05)',
          }}>
            <StatBox label="Total reads" value={fmt(stats.totalReads)} color={readsColor(stats.totalReads)} />
            <StatBox label="Reads/min" value={fmt(readsPerMin)} color={readsPerMin > 100 ? '#ef4444' : '#94a3b8'} />
            <StatBox label="Operations" value={fmt(stats.entries.length)} color="#94a3b8" />
          </div>

          {/* Sparkline */}
          <div style={{ padding: '4px 8px 2px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginBottom: 2 }}>LAST 60s</div>
            <Sparkline entries={stats.entries} />
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {(['live', 'callers', 'collections'] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                flex: 1, padding: '5px 0', fontSize: 10, fontWeight: 600,
                background: tab === t ? 'rgba(99,102,241,0.2)' : 'transparent',
                color: tab === t ? '#818cf8' : 'rgba(255,255,255,0.35)',
                border: 'none', cursor: 'pointer',
                borderBottom: tab === t ? '2px solid #6366f1' : '2px solid transparent',
                textTransform: 'uppercase', letterSpacing: '0.06em',
                fontFamily: 'inherit',
              }}>
                {t === 'live' ? `Live (${filteredEntries.length})` : t === 'callers' ? `Callers (${topCallers.length})` : `Collections (${topCols.length})`}
              </button>
            ))}
          </div>

          {/* Filter (live tab only) */}
          {tab === 'live' && (
            <div style={{ padding: '4px 8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <input
                value={filter}
                onChange={e => setFilter(e.target.value)}
                placeholder="Filter by caller or collection…"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 6, padding: '3px 8px', color: '#e2e8f0',
                  fontSize: 10.5, fontFamily: 'inherit', outline: 'none',
                }}
              />
            </div>
          )}

          {/* Content */}
          <div ref={listRef} style={{ maxHeight: 300, overflowY: 'auto', cursor: 'default' }}
               onMouseDown={e => e.stopPropagation()}>
            {tab === 'live' && (
              filteredEntries.length === 0 ? (
                <EmptyState enabled={enabled} />
              ) : (
                <>
                  {/* Column headers */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: '42px 1fr 70px 50px',
                    gap: 6, padding: '3px 8px',
                    fontSize: 9, color: 'rgba(255,255,255,0.25)',
                    fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <span>DOCS</span><span>CALLER</span><span>COLLECTION</span><span style={{ textAlign: 'right' }}>TIME</span>
                  </div>
                  {filteredEntries.map(e => <EntryRow key={e.id} entry={e} />)}
                </>
              )
            )}

            {tab === 'callers' && (
              topCallers.length === 0 ? <EmptyState enabled={enabled} /> : (
                <div style={{ padding: '4px 0' }}>
                  {topCallers.map(({ caller, reads }) => (
                    <BarRow key={caller} label={caller} value={reads} max={maxCaller} />
                  ))}
                </div>
              )
            )}

            {tab === 'collections' && (
              topCols.length === 0 ? <EmptyState enabled={enabled} /> : (
                <div style={{ padding: '4px 0' }}>
                  {topCols.map(({ collection, reads }) => (
                    <BarRow key={collection} label={collection} value={reads} max={maxCol} />
                  ))}
                </div>
              )
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: '4px 8px', fontSize: 9, color: 'rgba(255,255,255,0.2)',
            borderTop: '1px solid rgba(255,255,255,0.04)',
            display: 'flex', justifyContent: 'space-between',
          }}>
            <span>Admin only · drag to move</span>
            <span>session: {sessionSecs}s</span>
          </div>
        </>
      )}
    </div>,
    document.body
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatBox: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div style={{ textAlign: 'center' }}>
    <div style={{ fontSize: 15, fontWeight: 800, color }}>{value}</div>
    <div style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 1 }}>{label}</div>
  </div>
);

const EmptyState: React.FC<{ enabled: boolean }> = ({ enabled }) => (
  <div style={{ padding: '24px 0', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>
    {enabled ? 'Waiting for Firestore reads…' : 'Press ▶ to start monitoring'}
  </div>
);

function btnStyle(color: string): React.CSSProperties {
  return {
    width: 22, height: 22, borderRadius: 6, border: 'none', cursor: 'pointer',
    background: `${color}22`, color, fontSize: 12, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'inherit', flexShrink: 0,
    transition: 'background 0.15s',
  };
}

const FirestoreDebugPanel: React.FC = () => {
  const { user } = useDashboard();
  // TEMP: show for all users to debug reads — revert to admin-only after testing
  if (!user) return null;
  return <FirestoreDebugPanelInner />;
};

export default FirestoreDebugPanel;
