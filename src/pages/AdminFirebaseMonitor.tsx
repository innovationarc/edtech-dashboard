// src/pages/AdminFirebaseMonitor.tsx
// Admin-only Firebase Monitor page.
// Shows historical read/write stats per dashboard with time filters.
// Controls global enable + per-dashboard modal toggle.

import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity, BarChart2, Eye, EyeOff, RefreshCw, Save,
  Database, TrendingUp, TrendingDown, Zap, Shield,
  ChevronDown, Calendar, Globe, Users, BookOpen, Layout,
  ToggleLeft, ToggleRight, Download, Clock,
} from 'lucide-react';
import {
  firestoreMonitorPersistService,
  MonitorConfig,
  DashboardKey,
  YearlyStatsDoc,
  RWBucket,
  DEFAULT_CONFIG,
} from '../services/firestoreMonitorPersistService';
import { firestoreMonitor } from '../services/firestoreMonitor';
import { useDashboard } from '../contexts/DashboardContext';

// ─── Constants ────────────────────────────────────────────────────────────────

const DASHBOARDS: { key: DashboardKey; label: string; icon: React.ReactNode; color: string }[] = [
  { key: '_global',       label: 'Global (All)',      icon: <Globe size={16} />,    color: '#6366f1' },
  { key: 'admin',         label: 'Admin',             icon: <Shield size={16} />,   color: '#ef4444' },
  { key: 'student',       label: 'Student',           icon: <BookOpen size={16} />, color: '#22c55e' },
  { key: 'teacher',       label: 'Teacher',           icon: <Users size={16} />,    color: '#f59e0b' },
  { key: 'manager',       label: 'Manager',           icon: <Layout size={16} />,   color: '#0ea5e9' },
  { key: 'course_manager',label: 'Course Manager',    icon: <Database size={16} />, color: '#a78bfa' },
];

type FilterMode = 'yearly' | 'monthly' | 'weekly' | 'daily' | 'hourly' | 'custom';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmt(n: number) { return (n ?? 0).toLocaleString(); }
function pad(n: number) { return String(n).padStart(2, '0'); }

// ─── Bar chart (simple inline SVG) ───────────────────────────────────────────

interface BarData { label: string; reads: number; writes: number }

const BarChart: React.FC<{ data: BarData[]; height?: number }> = ({ data, height = 140 }) => {
  if (!data.length) return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>No data</div>;
  const maxVal = Math.max(...data.map(d => d.reads + d.writes), 1);
  const barW = Math.max(8, Math.min(40, (600 / data.length) - 4));
  const gap   = Math.max(2, barW * 0.15);

  return (
    <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
      <svg
        viewBox={`0 0 ${data.length * (barW + gap)} ${height + 30}`}
        style={{ display: 'block', minWidth: Math.min(data.length * (barW + gap), 640), width: '100%' }}
      >
        {data.map((d, i) => {
          const x = i * (barW + gap);
          const readH  = Math.max(2, (d.reads  / maxVal) * height);
          const writeH = Math.max(2, (d.writes / maxVal) * height);
          const totalH = Math.max(2, ((d.reads + d.writes) / maxVal) * height);
          return (
            <g key={i}>
              {/* reads */}
              <rect x={x} y={height - totalH} width={barW} height={readH} fill="#22c55e" rx={2} opacity={0.85} />
              {/* writes on top */}
              <rect x={x} y={height - totalH + readH} width={barW} height={writeH} fill="#a78bfa" rx={2} opacity={0.85} />
              {/* label */}
              <text x={x + barW / 2} y={height + 16} textAnchor="middle"
                    fill="rgba(255,255,255,0.35)" fontSize={9}
                    style={{ fontFamily: 'monospace' }}>
                {d.label.length > 5 ? d.label.slice(-4) : d.label}
              </text>
            </g>
          );
        })}
        {/* Zero line */}
        <line x1={0} y1={height} x2={data.length * (barW + gap)} y2={height} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
      </svg>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#22c55e' }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: '#22c55e' }} /> Reads
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#a78bfa' }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: '#a78bfa' }} /> Writes
        </div>
      </div>
    </div>
  );
};

// ─── Stat card ────────────────────────────────────────────────────────────────

const StatCard: React.FC<{ label: string; value: string | number; icon: React.ReactNode; color: string; sub?: string }> = ({ label, value, icon, color, sub }) => (
  <div style={{
    background: 'rgba(255,255,255,0.04)', border: `1px solid ${color}33`,
    borderRadius: 12, padding: '16px 18px',
    display: 'flex', flexDirection: 'column', gap: 4,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color, opacity: 0.8 }}>
      {icon}
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>{label}</span>
    </div>
    <div style={{ fontSize: 28, fontWeight: 800, color, letterSpacing: '-0.02em' }}>{typeof value === 'number' ? fmt(value) : value}</div>
    {sub && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{sub}</div>}
  </div>
);

// ─── Toggle row ───────────────────────────────────────────────────────────────

const ToggleRow: React.FC<{
  label: string; icon: React.ReactNode; color: string;
  checked: boolean; onChange: (v: boolean) => void; description?: string;
}> = ({ label, icon, color, checked, onChange, description }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '12px 16px', borderRadius: 10,
    background: checked ? `${color}11` : 'rgba(255,255,255,0.03)',
    border: `1px solid ${checked ? color + '44' : 'rgba(255,255,255,0.07)'}`,
    transition: 'all 0.2s',
  }}>
    <div style={{ color, opacity: 0.8 }}>{icon}</div>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{label}</div>
      {description && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{description}</div>}
    </div>
    <button
      onClick={() => onChange(!checked)}
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: checked ? color : 'rgba(255,255,255,0.25)', padding: 0 }}
    >
      {checked ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
    </button>
  </div>
);

// ─── Main page ────────────────────────────────────────────────────────────────

const AdminFirebaseMonitor: React.FC = () => {
  const { user } = useDashboard();

  const [config, setConfig]             = useState<MonitorConfig>(DEFAULT_CONFIG);
  const [localConfig, setLocalConfig]   = useState<MonitorConfig>(DEFAULT_CONFIG);
  const [configDirty, setConfigDirty]   = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  const [selectedDb, setSelectedDb]     = useState<DashboardKey>('_global');
  const [filterMode, setFilterMode]     = useState<FilterMode>('monthly');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([new Date().getFullYear()]);

  const [yearDoc, setYearDoc]           = useState<YearlyStatsDoc | null>(null);
  const [loading, setLoading]           = useState(false);

  // Custom date range
  const [customFrom, setCustomFrom]     = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [customTo, setCustomTo]         = useState(() => new Date().toISOString().slice(0, 10));

  // Live session stats
  const [liveStats, setLiveStats]       = useState(firestoreMonitor.getStats());
  const [flushing, setFlushing]         = useState(false);

  // ── Load config ──────────────────────────────────────────────────────────
  useEffect(() => {
    firestoreMonitorPersistService.getMonitorConfig().then(cfg => {
      setConfig(cfg);
      setLocalConfig(cfg);
    });
  }, []);

  // ── Live stats subscription ──────────────────────────────────────────────
  useEffect(() => firestoreMonitor.subscribe(setLiveStats), []);

  // ── Load years ────────────────────────────────────────────────────────────
  useEffect(() => {
    firestoreMonitorPersistService.getAvailableYears(selectedDb).then(years => {
      const all = Array.from(new Set([...years, new Date().getFullYear()])).sort((a, b) => b - a);
      setAvailableYears(all);
      if (!all.includes(selectedYear)) setSelectedYear(all[0]);
    });
  }, [selectedDb]);

  // ── Load year doc ──────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    const doc = await firestoreMonitorPersistService.getYearlyStats(selectedDb, selectedYear);
    setYearDoc(doc);
    setLoading(false);
  }, [selectedDb, selectedYear]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Build chart data ───────────────────────────────────────────────────
  const chartData = React.useMemo((): BarData[] => {
    if (!yearDoc) return [];

    if (filterMode === 'yearly') {
      // Single bar for total year
      const total = Object.values(yearDoc.monthly).reduce((acc, b) => ({
        reads: acc.reads + b.reads, writes: acc.writes + b.writes,
      }), { reads: 0, writes: 0 } as RWBucket);
      return [{ label: String(yearDoc.year), ...total }];
    }

    if (filterMode === 'monthly') {
      return Array.from({ length: 12 }, (_, i) => {
        const b = yearDoc.monthly[String(i + 1)] ?? { reads: 0, writes: 0 };
        return { label: MONTHS[i], ...b };
      });
    }

    if (filterMode === 'weekly') {
      const weeks = Object.entries(yearDoc.weekly)
        .map(([w, b]) => ({ label: `W${w}`, ...b }))
        .sort((a, b) => parseInt(a.label.slice(1)) - parseInt(b.label.slice(1)));
      return weeks;
    }

    if (filterMode === 'daily') {
      const days = Object.entries(yearDoc.daily)
        .filter(([d]) => d.startsWith(String(selectedYear)))
        .map(([d, b]) => ({ label: d.slice(5), ...b }))
        .sort((a, b) => a.label.localeCompare(b.label));
      return days;
    }

    if (filterMode === 'hourly') {
      const hours = Object.entries(yearDoc.hourly)
        .map(([h, b]) => ({ label: h.slice(11) + 'h', ...b }))
        .sort((a, b) => a.label.localeCompare(b.label));
      return hours;
    }

    if (filterMode === 'custom') {
      const days = Object.entries(yearDoc.daily)
        .filter(([d]) => d >= customFrom && d <= customTo)
        .map(([d, b]) => ({ label: d.slice(5), ...b }))
        .sort((a, b) => a.label.localeCompare(b.label));
      return days;
    }

    return [];
  }, [yearDoc, filterMode, selectedYear, customFrom, customTo]);

  // ── Summary totals ────────────────────────────────────────────────────
  const totals = React.useMemo(() => {
    return chartData.reduce((acc, d) => ({ reads: acc.reads + d.reads, writes: acc.writes + d.writes }), { reads: 0, writes: 0 });
  }, [chartData]);

  // ── Config helpers ────────────────────────────────────────────────────
  const updateLocalConfig = (patch: Partial<MonitorConfig>) => {
    setLocalConfig(prev => ({ ...prev, ...patch }));
    setConfigDirty(true);
  };

  const toggleDashboard = (dk: DashboardKey, val: boolean) => {
    setLocalConfig(prev => ({
      ...prev,
      dashboardToggles: { ...prev.dashboardToggles, [dk]: val },
    }));
    setConfigDirty(true);
  };

  const saveConfig = async () => {
    setSavingConfig(true);
    try {
      await firestoreMonitorPersistService.saveMonitorConfig(localConfig);
      setConfig(localConfig);
      setConfigDirty(false);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleFlush = async () => {
    setFlushing(true);
    try {
      await firestoreMonitorPersistService.flush();
      await loadData();
    } finally {
      setFlushing(false);
    }
  };

  const exportData = () => {
    const payload = { dashboard: selectedDb, year: selectedYear, chartData, totals, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `firebase-monitor-${selectedDb}-${selectedYear}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  if (user?.role !== 'admin') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.4)' }}>
        <Shield size={32} style={{ marginRight: 12 }} /> Admin access required
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'Outfit', sans-serif", color: '#e2e8f0', maxWidth: 1100, margin: '0 auto' }}>
      {/* ── Page Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Activity size={22} style={{ color: '#6366f1' }} />
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>Firebase Monitor</h1>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
            Background read/write tracking · persisted per dashboard · admin-only
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={handleFlush} disabled={flushing} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
            borderRadius: 8, border: '1px solid rgba(99,102,241,0.4)',
            background: 'rgba(99,102,241,0.1)', color: '#818cf8', cursor: flushing ? 'not-allowed' : 'pointer',
            fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
          }}>
            {flushing ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={14} />}
            Flush Now
          </button>
          <button onClick={exportData} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
            borderRadius: 8, border: '1px solid rgba(16,185,129,0.4)',
            background: 'rgba(16,185,129,0.1)', color: '#34d399', cursor: 'pointer',
            fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
          }}>
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      {/* ── Live session stats ── */}
      <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: '14px 18px', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 12, fontWeight: 700, color: '#818cf8', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          <Activity size={14} /> Live Session
          <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
            Since page load · {Math.floor((Date.now() - liveStats.sessionStart.getTime()) / 1000)}s ago
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 12 }}>
          <StatCard label="Reads"  value={liveStats.totalReads}  icon={<Eye size={16} />}      color="#22c55e" />
          <StatCard label="Writes" value={liveStats.totalWrites} icon={<Database size={16} />} color="#a78bfa" />
          <StatCard label="Ops"    value={liveStats.readEntries.length + liveStats.writeEntries.length} icon={<Activity size={16} />} color="#f59e0b" />
          <StatCard label="Collections" value={Object.keys(liveStats.byCollection).length} icon={<BarChart2 size={16} />} color="#0ea5e9" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>
        {/* ── Left: Historical stats ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Dashboard selector */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Dashboard</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {DASHBOARDS.map(d => (
                <button key={d.key} onClick={() => setSelectedDb(d.key)} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                  borderRadius: 8, border: `1px solid ${selectedDb === d.key ? d.color + '88' : 'rgba(255,255,255,0.07)'}`,
                  background: selectedDb === d.key ? d.color + '22' : 'transparent',
                  color: selectedDb === d.key ? d.color : 'rgba(255,255,255,0.5)',
                  cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}>
                  {d.icon} {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Filter bar */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Filter</div>
              {(['yearly','monthly','weekly','daily','hourly','custom'] as FilterMode[]).map(m => (
                <button key={m} onClick={() => setFilterMode(m)} style={{
                  padding: '5px 10px', borderRadius: 6,
                  border: `1px solid ${filterMode === m ? '#6366f1' : 'rgba(255,255,255,0.07)'}`,
                  background: filterMode === m ? 'rgba(99,102,241,0.2)' : 'transparent',
                  color: filterMode === m ? '#818cf8' : 'rgba(255,255,255,0.45)',
                  cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
                  textTransform: 'capitalize',
                }}>
                  {m}
                </button>
              ))}
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Calendar size={14} style={{ color: 'rgba(255,255,255,0.3)' }} />
                <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} style={{
                  background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 6, padding: '4px 8px', color: '#e2e8f0', fontSize: 12, fontFamily: 'inherit',
                  cursor: 'pointer', outline: 'none',
                }}>
                  {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <button onClick={loadData} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: 4, display: 'flex' }}>
                  <RefreshCw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
                </button>
              </div>
            </div>

            {/* Custom date range */}
            {filterMode === 'custom' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                <Clock size={13} style={{ color: 'rgba(255,255,255,0.3)' }} />
                <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{
                  background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 6, padding: '4px 8px', color: '#e2e8f0', fontSize: 12, fontFamily: 'inherit', outline: 'none',
                }} />
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>to</span>
                <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{
                  background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 6, padding: '4px 8px', color: '#e2e8f0', fontSize: 12, fontFamily: 'inherit', outline: 'none',
                }} />
              </div>
            )}
          </div>

          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
            <StatCard label="Total Reads"  value={totals.reads}  icon={<Eye size={16} />}                color="#22c55e" sub={`${filterMode} view`} />
            <StatCard label="Total Writes" value={totals.writes} icon={<Database size={16} />}           color="#a78bfa" sub={`${filterMode} view`} />
            <StatCard label="Ops/Day"      value={filterMode === 'daily' ? Math.round((totals.reads + totals.writes) / Math.max(chartData.length, 1)) : '—'} icon={<TrendingUp size={16} />} color="#f59e0b" />
            <StatCard label="Read/Write"   value={totals.writes > 0 ? (totals.reads / totals.writes).toFixed(1) + 'x' : '∞'} icon={<BarChart2 size={16} />} color="#0ea5e9" sub="reads per write" />
          </div>

          {/* Chart */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>
                {DASHBOARDS.find(d => d.key === selectedDb)?.label} · {selectedYear} · {filterMode}
              </div>
              {loading && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> loading…
              </div>}
            </div>
            <BarChart data={chartData} height={160} />
          </div>

          {/* Top collections table */}
          {yearDoc && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 14 }}>Top Collections · {selectedYear}</div>
              {(() => {
                const cols = Object.entries(yearDoc.daily).reduce((acc, [, b]) => {
                  // daily doesn't have per-collection breakdown — show monthly totals
                  return acc;
                }, {} as Record<string, RWBucket>);
                // Use monthly totals directly
                const totalsMonth = Object.values(yearDoc.monthly).reduce((acc, b) => ({
                  reads: acc.reads + b.reads, writes: acc.writes + b.writes,
                }), { reads: 0, writes: 0 });
                return (
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', padding: '12px 0' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 120px', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 8, marginBottom: 8 }}>
                      <span style={{ fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>Period</span>
                      <span style={{ textAlign: 'right', fontWeight: 700, color: '#22c55e' }}>Reads</span>
                      <span style={{ textAlign: 'right', fontWeight: 700, color: '#a78bfa' }}>Writes</span>
                      <span style={{ textAlign: 'right', fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>Total</span>
                    </div>
                    {Object.entries(yearDoc.monthly).sort((a, b) => Number(a[0]) - Number(b[0])).map(([m, b]) => (
                      <div key={m} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 120px', gap: 8, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <span>{MONTHS[Number(m) - 1]} {selectedYear}</span>
                        <span style={{ textAlign: 'right', color: '#22c55e' }}>{fmt(b.reads)}</span>
                        <span style={{ textAlign: 'right', color: '#a78bfa' }}>{fmt(b.writes)}</span>
                        <span style={{ textAlign: 'right' }}>{fmt(b.reads + b.writes)}</span>
                      </div>
                    ))}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 120px', gap: 8, padding: '8px 0 0', fontWeight: 700 }}>
                      <span style={{ color: '#e2e8f0' }}>Yearly Total</span>
                      <span style={{ textAlign: 'right', color: '#22c55e' }}>{fmt(totalsMonth.reads)}</span>
                      <span style={{ textAlign: 'right', color: '#a78bfa' }}>{fmt(totalsMonth.writes)}</span>
                      <span style={{ textAlign: 'right', color: '#e2e8f0' }}>{fmt(totalsMonth.reads + totalsMonth.writes)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* ── Right: Controls ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 16 }}>
          {/* Monitor controls */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>
              Monitor Controls
            </div>

            <ToggleRow
              label="Global Enable"
              icon={<Globe size={16} />}
              color="#6366f1"
              checked={localConfig.globalEnabled}
              onChange={v => updateLocalConfig({ globalEnabled: v })}
              description="Master switch — enables background tracking + modal system"
            />

            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '14px 0 10px' }}>
              Dashboard Modals
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {DASHBOARDS.filter(d => d.key !== '_global').map(d => (
                <ToggleRow
                  key={d.key}
                  label={d.label}
                  icon={d.icon}
                  color={d.color}
                  checked={localConfig.dashboardToggles[d.key] ?? false}
                  onChange={v => toggleDashboard(d.key, v)}
                  description={`Show live modal on ${d.label} dashboard`}
                />
              ))}
            </div>

            {configDirty && (
              <button
                onClick={saveConfig}
                disabled={savingConfig}
                style={{
                  width: '100%', marginTop: 14, padding: '10px 0',
                  borderRadius: 8, border: 'none',
                  background: savingConfig ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.8)',
                  color: '#fff', fontWeight: 700, fontSize: 13, cursor: savingConfig ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'background 0.2s',
                }}
              >
                {savingConfig
                  ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</>
                  : <><Save size={14} /> Save Config</>
                }
              </button>
            )}
          </div>

          {/* Info card */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
              How it works
            </div>
            <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: 11, color: 'rgba(255,255,255,0.35)', lineHeight: 1.8 }}>
              <li>Background monitoring is always on</li>
              <li>Flushes to Firestore every 5 min</li>
              <li>Also flushes on tab hide / close</li>
              <li>1 doc per year, per dashboard</li>
              <li>Modal visibility is dashboard-specific</li>
              <li>Zero overhead when modal is off</li>
            </ul>
          </div>

          {/* Per-dashboard comparison */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
              Quick Compare ({new Date().getFullYear()})
            </div>
            <DashboardCompare year={new Date().getFullYear()} />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

// ─── Quick compare widget ─────────────────────────────────────────────────────

const DashboardCompare: React.FC<{ year: number }> = ({ year }) => {
  const [data, setData] = useState<Record<DashboardKey, { reads: number; writes: number }>>({} as any);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const dks: DashboardKey[] = ['admin','student','teacher','manager','course_manager'];
    Promise.all(dks.map(dk => firestoreMonitorPersistService.getYearlyStats(dk, year)
      .then(doc => ({
        dk,
        totals: doc
          ? Object.values(doc.monthly).reduce((a, b) => ({ reads: a.reads + b.reads, writes: a.writes + b.writes }), { reads: 0, writes: 0 })
          : { reads: 0, writes: 0 },
      }))
    )).then(results => {
      const map: any = {};
      results.forEach(r => { map[r.dk] = r.totals; });
      setData(map);
      setLoading(false);
    });
  }, [year]);

  if (loading) return <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', textAlign: 'center', padding: '8px 0' }}>Loading…</div>;

  const dks: DashboardKey[] = ['admin','student','teacher','manager','course_manager'];
  const maxR = Math.max(...dks.map(dk => data[dk]?.reads ?? 0), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {dks.map(dk => {
        const d  = DASHBOARDS.find(x => x.key === dk)!;
        const r  = data[dk]?.reads  ?? 0;
        const w  = data[dk]?.writes ?? 0;
        return (
          <div key={dk}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <span style={{ color: d.color, opacity: 0.8 }}>{d.icon}</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', flex: 1 }}>{d.label}</span>
              <span style={{ fontSize: 10, color: '#22c55e', fontFamily: 'monospace' }}>{fmt(r)}R</span>
              <span style={{ fontSize: 10, color: '#a78bfa', fontFamily: 'monospace' }}>{fmt(w)}W</span>
            </div>
            <div style={{ height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 2 }}>
              <div style={{ height: '100%', width: `${(r / maxR) * 100}%`, background: d.color, borderRadius: 2, opacity: 0.7 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AdminFirebaseMonitor;
