// src/components/statistics/CouponStatisticsModal.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X, Loader, TrendingUp, Users, Tag, BarChart2, Calendar,
  CheckCircle, XCircle, Clock, AlertCircle, Download, RefreshCw,
  Package, Zap, Award, Target, Activity, Info
} from 'lucide-react';
import {
  collection, getDocs, query, where, orderBy, Timestamp
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Coupon, BulkGroup } from '../../services/couponService';

// ── TYPES ─────────────────────────────────────────────────────────────────────

export interface CouponUsageRecord {
  id: string;
  couponId: string;
  userId: string;
  courseId: string;
  usedAt: Date;
  userName?: string;
  courseName?: string;
  amountPaid?: number;
  discountApplied?: number;
}

export interface CouponStats {
  totalUsages: number;
  uniqueUsers: number;
  uniqueCourses: number;

  totalCoupons?: number;
  usedCoupons?: number;
  unusedCoupons?: number;
  totalUsagesAcrossGroup?: number;

  estimatedDiscountGiven: number;
  dailyUsages: { date: string; count: number }[];
  topCourses: { courseId: string; courseName: string; count: number }[];
  topUsers: { userId: string; userName: string; count: number }[];

  daysRemaining: number;
  daysTotal: number;
  usageRate: number;

  usageRecords: CouponUsageRecord[];
}

interface Props {
  coupon?: Coupon;
  group?: BulkGroup;
  groupCoupons?: Coupon[];
  courses: { id: string; title: string }[];
  onClose: () => void;
}

// ── HELPERS ───────────────────────────────────────────────────────────────────

const fmt = (d: Date) => {
  try { return new Date(d).toLocaleDateString('en-BD', { dateStyle: 'medium' }); }
  catch { return '-'; }
};

const fmtDateTime = (d: Date) => {
  try { return new Date(d).toLocaleString('en-BD', { dateStyle: 'short', timeStyle: 'short' }); }
  catch { return '-'; }
};

const toDate = (v: any): Date => {
  if (!v) return new Date();
  if (typeof v.toDate === 'function') return v.toDate();
  if (v instanceof Date) return v;
  return new Date(v);
};

const last30Days = (): string[] => {
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
};

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

// ── MINI COMPONENTS ───────────────────────────────────────────────────────────

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  highlight?: boolean;
}> = ({ icon, label, value, sub, color = 'text-indigo-400', highlight }) => (
  <div className={`bg-gray-800/80 border ${highlight ? 'border-indigo-500/50' : 'border-gray-700'} rounded-xl p-4 flex flex-col gap-2`}>
    <div className={`flex items-center gap-2 ${color} text-sm font-medium`}>
      {icon}
      <span className="text-gray-400 font-normal">{label}</span>
    </div>
    <div className="text-2xl font-bold text-white">{value}</div>
    {sub && <div className="text-xs text-gray-500">{sub}</div>}
  </div>
);

const SectionTitle: React.FC<{ icon: React.ReactNode; title: string; badge?: string }> = ({ icon, title, badge }) => (
  <div className="flex items-center gap-2 mb-3">
    <span className="text-indigo-400">{icon}</span>
    <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">{title}</h3>
    {badge && (
      <span className="ml-auto text-xs bg-indigo-900/40 text-indigo-400 border border-indigo-700/50 rounded-full px-2 py-0.5">{badge}</span>
    )}
  </div>
);

const MiniBarChart: React.FC<{ data: { date: string; count: number }[] }> = ({ data }) => {
  const max = Math.max(...data.map(d => d.count), 1);
  const nonZero = data.filter(d => d.count > 0);

  if (nonZero.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-gray-500 text-sm">
        No usage data in the last 30 days
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-end gap-0.5 h-24">
        {data.map((d, i) => {
          const heightPct = max > 0 ? (d.count / max) * 100 : 0;
          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center group relative"
              title={`${d.date}: ${d.count} use${d.count !== 1 ? 's' : ''}`}
            >
              <div
                className="w-full rounded-sm bg-indigo-600/70 hover:bg-indigo-500 transition-all duration-150 cursor-pointer"
                style={{ height: `${Math.max(heightPct, d.count > 0 ? 4 : 0)}%` }}
              />
              {d.count > 0 && (
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-900 border border-gray-700 text-white text-xs rounded px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10 shadow-xl">
                  {d.date.slice(5)}: {d.count}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-gray-600 text-[10px] mt-1">
        <span>{data[0]?.date.slice(5)}</span>
        <span>Today</span>
      </div>
    </div>
  );
};

const ProgressBar: React.FC<{ value: number; max: number; color?: string; label?: string }> = ({
  value, max, color = 'bg-indigo-500', label
}) => {
  const pct = max > 0 ? clamp((value / max) * 100, 0, 100) : 0;
  return (
    <div className="flex items-center gap-3">
      {label && <span className="text-xs text-gray-400 w-24 truncate">{label}</span>}
      <div className="flex-1 bg-gray-700 rounded-full h-2">
        <div className={`h-2 rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-400 w-8 text-right">{value}</span>
    </div>
  );
};

// ── DATA FETCHING ─────────────────────────────────────────────────────────────

async function fetchCouponUsageRecords(couponIds: string[]): Promise<CouponUsageRecord[]> {
  if (couponIds.length === 0) return [];

  const records: CouponUsageRecord[] = [];

  const CHUNK = 30;
  for (let i = 0; i < couponIds.length; i += CHUNK) {
    const chunk = couponIds.slice(i, i + CHUNK);
    const snap = await getDocs(
      query(collection(db, 'couponUsage'), where('couponId', 'in', chunk))
    );
    snap.docs.forEach(d => {
      records.push({
        id: d.id,
        couponId: d.data().couponId,
        userId: d.data().userId,
        courseId: d.data().courseId,
        usedAt: toDate(d.data().usedAt),
        userName: d.data().userName,
        courseName: d.data().courseName,
        amountPaid: d.data().amountPaid,
        discountApplied: d.data().discountApplied,
      });
    });
  }

  return records.sort((a, b) => b.usedAt.getTime() - a.usedAt.getTime());
}

function computeStats(
  coupons: Coupon[],
  records: CouponUsageRecord[],
  courses: { id: string; title: string }[],
  isGroup: boolean
): CouponStats {
  const courseMap = Object.fromEntries(courses.map(c => [c.id, c.title]));

  const days = last30Days();
  const dailyMap: Record<string, number> = {};
  days.forEach(d => (dailyMap[d] = 0));
  records.forEach(r => {
    const day = r.usedAt.toISOString().slice(0, 10);
    if (dailyMap[day] !== undefined) dailyMap[day]++;
  });
  const dailyUsages = days.map(date => ({ date, count: dailyMap[date] }));

  const uniqueUsersSet = new Set(records.map(r => r.userId));
  const uniqueCoursesSet = new Set(records.map(r => r.courseId));

  const courseCounts: Record<string, number> = {};
  records.forEach(r => {
    courseCounts[r.courseId] = (courseCounts[r.courseId] || 0) + 1;
  });
  const topCourses = Object.entries(courseCounts)
    .map(([courseId, count]) => ({ courseId, courseName: courseMap[courseId] || courseId.slice(0, 12) + '…', count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const userCounts: Record<string, number> = {};
  records.forEach(r => {
    userCounts[r.userId] = (userCounts[r.userId] || 0) + 1;
  });
  const topUsers = Object.entries(userCounts)
    .map(([userId, count]) => ({
      userId,
      userName: records.find(r => r.userId === userId)?.userName || userId.slice(0, 12) + '…',
      count
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const estimatedDiscountGiven = records.reduce((sum, r) => sum + (r.discountApplied || 0), 0);

  const usedCouponIds = new Set(records.map(r => r.couponId));
  const usedCoupons = isGroup ? coupons.filter(c => usedCouponIds.has(c.id)).length : undefined;

  const ref = coupons[0];
  const now = new Date();
  const daysTotal = ref
    ? Math.max(1, Math.round((ref.endDate.getTime() - ref.startDate.getTime()) / 86400000))
    : 1;
  const daysRemaining = ref
    ? Math.max(0, Math.round((ref.endDate.getTime() - now.getTime()) / 86400000))
    : 0;

  const totalUsageLimit = coupons.reduce((sum, c) => {
    if (c.usageLimit === 'unlimited') return sum + Infinity;
    return sum + (c.usageLimit as number);
  }, 0);
  const totalUsageCount = coupons.reduce((sum, c) => sum + c.usageCount, 0);
  const usageRate = isFinite(totalUsageLimit) && totalUsageLimit > 0
    ? clamp((totalUsageCount / totalUsageLimit) * 100, 0, 100)
    : totalUsageCount > 0 ? -1 : 0;

  return {
    totalUsages: records.length,
    uniqueUsers: uniqueUsersSet.size,
    uniqueCourses: uniqueCoursesSet.size,
    totalCoupons: isGroup ? coupons.length : undefined,
    usedCoupons: isGroup ? usedCoupons : undefined,
    unusedCoupons: isGroup ? coupons.length - (usedCoupons || 0) : undefined,
    totalUsagesAcrossGroup: isGroup ? records.length : undefined,
    estimatedDiscountGiven,
    dailyUsages,
    topCourses,
    topUsers,
    daysRemaining,
    daysTotal,
    usageRate,
    usageRecords: records,
  };
}

// ── STATUS COLOR ──────────────────────────────────────────────────────────────

const statusColor = (status: string) => ({
  active: 'text-green-400',
  inactive: 'text-gray-400',
  expired: 'text-red-400',
  scheduled: 'text-yellow-400',
}[status] || 'text-gray-400');

// ── MAIN MODAL ────────────────────────────────────────────────────────────────

const CouponStatisticsModal: React.FC<Props> = ({
  coupon,
  group,
  groupCoupons = [],
  courses,
  onClose,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<CouponStats | null>(null);
  const [activeSection, setActiveSection] = useState<'overview' | 'timeline' | 'usage' | 'tokens'>('overview');

  const isGroup = !!group;
  const title = isGroup ? group!.groupName : coupon?.couponCode || '';

  // ── FIX: Memoize allCoupons and the coupon ID key so they don't change on every render ──
  const allCoupons: Coupon[] = useMemo(
    () => (isGroup ? groupCoupons : coupon ? [coupon] : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isGroup, coupon?.id, groupCoupons.map(c => c.id).join(',')]
  );

  const couponIdsKey = useMemo(
    () => allCoupons.map(c => c.id).join(','),
    [allCoupons]
  );

  // ── FIX: useCallback so loadStats reference is stable and doesn't cause re-renders ──
  const loadStats = useCallback(async () => {
    const couponIds = couponIdsKey.split(',').filter(Boolean);

    if (couponIds.length === 0) {
      setStats({
        totalUsages: 0, uniqueUsers: 0, uniqueCourses: 0,
        estimatedDiscountGiven: 0,
        dailyUsages: last30Days().map(date => ({ date, count: 0 })),
        topCourses: [], topUsers: [], daysRemaining: 0, daysTotal: 1, usageRate: 0,
        usageRecords: [],
        totalCoupons: isGroup ? 0 : undefined,
        usedCoupons: isGroup ? 0 : undefined,
        unusedCoupons: isGroup ? 0 : undefined,
        totalUsagesAcrossGroup: isGroup ? 0 : undefined,
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const records = await fetchCouponUsageRecords(couponIds);
      const computed = computeStats(allCoupons, records, courses, isGroup);
      setStats(computed);
    } catch (e: any) {
      setError(e.message || 'Failed to load statistics');
    } finally {
      setLoading(false);
    }
  // allCoupons and courses are stable references thanks to useMemo / parent props
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couponIdsKey, isGroup]);

  // ── FIX: depend only on the stable string key — fires exactly once on mount ──
  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const exportCSV = () => {
    if (!stats) return;
    const rows = [
      ['Used At', 'Coupon ID', 'User ID', 'Course ID', 'Discount Applied'],
      ...stats.usageRecords.map(r => [
        fmtDateTime(r.usedAt),
        r.couponId,
        r.userId,
        r.courseId,
        r.discountApplied ?? '',
      ])
    ];
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `coupon-stats-${title}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const ref = allCoupons[0];

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <BarChart2 size={13} /> },
    { id: 'timeline', label: 'Timeline', icon: <Activity size={13} /> },
    { id: 'usage', label: 'Usage Records', icon: <Users size={13} /> },
    ...(isGroup ? [{ id: 'tokens', label: 'Tokens', icon: <Tag size={13} /> }] : []),
  ] as const;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-4xl my-8 shadow-2xl flex flex-col">

        {/* ── HEADER ── */}
        <div className="flex items-start justify-between p-5 border-b border-gray-700">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-xl ${isGroup ? 'bg-purple-900/40' : 'bg-indigo-900/40'}`}>
              {isGroup
                ? <Package size={20} className="text-purple-400" />
                : <Tag size={20} className="text-indigo-400" />
              }
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">
                  {isGroup ? 'Group Statistics' : 'Coupon Statistics'}
                </h2>
                <span className={`text-sm font-mono font-semibold ${isGroup ? 'text-purple-400' : 'text-indigo-400'}`}>
                  {title}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {isGroup
                  ? `${group!.couponCount} tokens · Group ID: ${group!.groupId}`
                  : `Coupon ID: ${coupon?.id?.slice(0, 14)}… · Status: `
                }
                {!isGroup && coupon && (
                  <span className={`font-medium ${statusColor(coupon.status)}`}>{coupon.status}</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadStats}
              disabled={loading}
              className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors disabled:opacity-40"
              title="Refresh statistics"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={exportCSV}
              disabled={loading || !stats || stats.usageRecords.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs border border-gray-600 transition-colors disabled:opacity-40"
              title="Export usage records as CSV"
            >
              <Download size={13} /> Export CSV
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ── TABS ── */}
        <div className="flex gap-1 px-5 pt-3 border-b border-gray-700/50">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveSection(t.id as any)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg border-b-2 transition-colors ${
                activeSection === t.id
                  ? 'border-indigo-500 text-indigo-300 bg-indigo-950/30'
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* ── BODY ── */}
        <div className="p-5 overflow-y-auto max-h-[70vh]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
              <Loader size={28} className="animate-spin text-indigo-400" />
              <p className="text-sm">Loading statistics…</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <AlertCircle size={28} className="text-red-400" />
              <p className="text-red-400 text-sm">{error}</p>
              <button
                onClick={loadStats}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm border border-gray-600 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : stats ? (
            <>
              {/* ── OVERVIEW ── */}
              {activeSection === 'overview' && (
                <div className="space-y-6">
                  <div className="flex items-start gap-3 bg-blue-900/20 border border-blue-700/40 rounded-xl p-3">
                    <Info size={15} className="text-blue-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-300">
                      Statistics are pulled from <code className="bg-blue-900/40 px-1 rounded">couponUsage</code> records.
                      Once the Course Enrollment Page is upgraded to write full enrollment data (user names, course names,
                      discount amounts), these statistics will automatically show richer details.
                    </p>
                  </div>

                  {/* Coupon Info Strip */}
                  {ref && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-gray-800/40 border border-gray-700/50 rounded-xl p-4">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Discount</p>
                        <p className="text-sm font-bold text-white">
                          {ref.discountType === 'amount' ? `৳${ref.discountValue}` : `${ref.discountValue}%`}
                          {ref.maxDiscount ? <span className="text-xs text-gray-400 font-normal ml-1">(max ৳{ref.maxDiscount})</span> : null}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Valid Period</p>
                        <p className="text-xs text-gray-300">{fmt(ref.startDate)} → {fmt(ref.endDate)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Usage Limit</p>
                        <p className="text-sm font-bold text-white">
                          {ref.usageLimit === 'unlimited' ? '∞ Unlimited' : ref.usageLimit}
                          {ref.usageLimit !== 'unlimited' && (
                            <span className="text-xs text-gray-400 font-normal ml-1">({ref.perUserLimit}/user)</span>
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Eligibility</p>
                        <p className="text-xs text-gray-300">
                          {ref.courseFilter.type === 'all' ? 'All courses' : `${ref.courseFilter.courseIds?.length || 0} courses`}
                          {' · '}
                          {ref.userFilter.type === 'all' ? 'All users' : `${ref.userFilter.userIds?.length || 0} users`}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* KPI Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatCard
                      icon={<Zap size={15} />}
                      label="Total Usages"
                      value={stats.totalUsages}
                      color="text-indigo-400"
                      highlight
                    />
                    <StatCard
                      icon={<Users size={15} />}
                      label="Unique Users"
                      value={stats.uniqueUsers}
                      color="text-green-400"
                    />
                    <StatCard
                      icon={<Target size={15} />}
                      label="Unique Courses"
                      value={stats.uniqueCourses}
                      color="text-yellow-400"
                    />
                    <StatCard
                      icon={<Award size={15} />}
                      label="Est. Discount Given"
                      value={stats.estimatedDiscountGiven > 0 ? `৳${stats.estimatedDiscountGiven.toLocaleString()}` : '—'}
                      sub={stats.estimatedDiscountGiven === 0 ? 'Available after enrollment data' : ''}
                      color="text-pink-400"
                    />
                  </div>

                  {/* Group-specific metrics */}
                  {isGroup && (
                    <div className="grid grid-cols-3 gap-3">
                      <StatCard
                        icon={<Tag size={15} />}
                        label="Total Tokens"
                        value={stats.totalCoupons ?? 0}
                        color="text-purple-400"
                      />
                      <StatCard
                        icon={<CheckCircle size={15} />}
                        label="Used Tokens"
                        value={stats.usedCoupons ?? 0}
                        color="text-green-400"
                      />
                      <StatCard
                        icon={<XCircle size={15} />}
                        label="Unused Tokens"
                        value={stats.unusedCoupons ?? 0}
                        color="text-gray-400"
                      />
                    </div>
                  )}

                  {/* Lifecycle */}
                  <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-4 space-y-4">
                    <SectionTitle icon={<Clock size={14} />} title="Lifecycle" />
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                          <span>Time Elapsed</span>
                          <span className="text-white font-medium">
                            {stats.daysRemaining === 0 ? 'Expired' : `${stats.daysRemaining}d left`}
                          </span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-500 ${
                              stats.daysRemaining === 0 ? 'bg-red-500' :
                              stats.daysRemaining <= 3 ? 'bg-yellow-500' : 'bg-blue-500'
                            }`}
                            style={{ width: `${clamp(((stats.daysTotal - stats.daysRemaining) / stats.daysTotal) * 100, 0, 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                          <span>{ref ? fmt(ref.startDate) : ''}</span>
                          <span>{ref ? fmt(ref.endDate) : ''}</span>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                          <span>Usage Consumed</span>
                          <span className="text-white font-medium">
                            {stats.usageRate === -1 ? 'Unlimited' : `${stats.usageRate.toFixed(1)}%`}
                          </span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          {stats.usageRate === -1 ? (
                            <div className="h-2 rounded-full bg-indigo-500/40" style={{ width: '100%' }} />
                          ) : (
                            <div
                              className={`h-2 rounded-full transition-all duration-500 ${
                                stats.usageRate >= 90 ? 'bg-red-500' :
                                stats.usageRate >= 70 ? 'bg-yellow-500' : 'bg-indigo-500'
                              }`}
                              style={{ width: `${stats.usageRate}%` }}
                            />
                          )}
                        </div>
                        {ref && (
                          <p className="text-[10px] text-gray-600 mt-1">
                            {ref.usageCount} used
                            {ref.usageLimit !== 'unlimited' ? ` / ${ref.usageLimit} limit` : ' (unlimited)'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Top courses & users side by side */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-4">
                      <SectionTitle icon={<Target size={14} />} title="Top Courses" badge={`${stats.topCourses.length}`} />
                      {stats.topCourses.length === 0 ? (
                        <p className="text-xs text-gray-500 text-center py-6">No course data yet</p>
                      ) : (
                        <div className="space-y-2.5">
                          {stats.topCourses.map(c => (
                            <ProgressBar
                              key={c.courseId}
                              label={c.courseName}
                              value={c.count}
                              max={stats.topCourses[0]?.count || 1}
                              color="bg-yellow-500"
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-4">
                      <SectionTitle icon={<Users size={14} />} title="Top Users" badge={`${stats.topUsers.length}`} />
                      {stats.topUsers.length === 0 ? (
                        <p className="text-xs text-gray-500 text-center py-6">No user data yet</p>
                      ) : (
                        <div className="space-y-2.5">
                          {stats.topUsers.map(u => (
                            <ProgressBar
                              key={u.userId}
                              label={u.userName}
                              value={u.count}
                              max={stats.topUsers[0]?.count || 1}
                              color="bg-green-500"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── TIMELINE ── */}
              {activeSection === 'timeline' && (
                <div className="space-y-6">
                  <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-4">
                    <SectionTitle icon={<Activity size={14} />} title="Daily Usages — Last 30 Days" />
                    <MiniBarChart data={stats.dailyUsages} />
                  </div>

                  {/* Usage by day of week */}
                  <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-4">
                    <SectionTitle icon={<Calendar size={14} />} title="Usage by Day of Week" />
                    {(() => {
                      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                      const counts = Array(7).fill(0);
                      stats.usageRecords.forEach(r => {
                        counts[r.usedAt.getDay()]++;
                      });
                      const max = Math.max(...counts, 1);
                      return (
                        <div className="flex items-end gap-3 h-20 mt-2">
                          {days.map((day, i) => (
                            <div key={day} className="flex-1 flex flex-col items-center gap-1">
                              <div
                                className="w-full rounded bg-purple-600/70 hover:bg-purple-500 transition-colors"
                                style={{ height: `${(counts[i] / max) * 64}px` }}
                                title={`${day}: ${counts[i]}`}
                              />
                              <span className="text-[10px] text-gray-500">{day}</span>
                              <span className="text-[10px] text-gray-400">{counts[i]}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Peak hour analysis */}
                  <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-4">
                    <SectionTitle icon={<Clock size={14} />} title="Usage by Hour (UTC)" />
                    {(() => {
                      const hourCounts = Array(24).fill(0);
                      stats.usageRecords.forEach(r => {
                        hourCounts[r.usedAt.getUTCHours()]++;
                      });
                      const max = Math.max(...hourCounts, 1);
                      const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
                      return (
                        <>
                          <div className="flex items-end gap-0.5 h-16 mt-2">
                            {hourCounts.map((c, h) => (
                              <div
                                key={h}
                                className={`flex-1 rounded-sm transition-colors ${h === peakHour && c > 0 ? 'bg-orange-500' : 'bg-teal-700/60 hover:bg-teal-600'}`}
                                style={{ height: `${(c / max) * 60}px` }}
                                title={`${h}:00 UTC — ${c} use${c !== 1 ? 's' : ''}`}
                              />
                            ))}
                          </div>
                          <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                            <span>0:00</span>
                            <span>12:00</span>
                            <span>23:00</span>
                          </div>
                          {Math.max(...hourCounts) > 0 && (
                            <p className="text-xs text-gray-500 mt-2">
                              Peak hour: <span className="text-orange-400 font-medium">{peakHour}:00–{peakHour + 1}:00 UTC</span> with{' '}
                              <span className="text-white">{hourCounts[peakHour]}</span> uses
                            </p>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* ── USAGE RECORDS ── */}
              {activeSection === 'usage' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-400">
                      {stats.usageRecords.length} record{stats.usageRecords.length !== 1 ? 's' : ''} total
                    </p>
                    {stats.usageRecords.length > 0 && (
                      <button
                        onClick={exportCSV}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-lg border border-gray-600 transition-colors"
                      >
                        <Download size={12} /> Export CSV
                      </button>
                    )}
                  </div>

                  {stats.usageRecords.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 gap-3 text-gray-500">
                      <BarChart2 size={32} />
                      <p className="text-sm">No usage records found</p>
                      <p className="text-xs text-gray-600">This coupon hasn't been used yet</p>
                    </div>
                  ) : (
                    <div className="border border-gray-700/50 rounded-xl overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-900/60">
                            <tr className="text-gray-400 uppercase tracking-wider">
                              {['#', 'Used At', 'User ID', 'Course ID', ...(isGroup ? ['Coupon Code'] : []), 'Discount'].map(h => (
                                <th key={h} className="px-3 py-2.5 text-left whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-700/40">
                            {stats.usageRecords.map((r, i) => {
                              const couponForRecord = isGroup
                                ? groupCoupons.find(c => c.id === r.couponId)
                                : coupon;
                              return (
                                <tr key={r.id} className="hover:bg-gray-800/50 transition-colors">
                                  <td className="px-3 py-2 text-gray-600">{i + 1}</td>
                                  <td className="px-3 py-2 text-gray-300 whitespace-nowrap">{fmtDateTime(r.usedAt)}</td>
                                  <td className="px-3 py-2 font-mono text-indigo-400">
                                    {r.userName || r.userId.slice(0, 14) + '…'}
                                  </td>
                                  <td className="px-3 py-2 text-gray-300">
                                    {r.courseName || (courses.find(c => c.id === r.courseId)?.title || r.courseId.slice(0, 14) + '…')}
                                  </td>
                                  {isGroup && (
                                    <td className="px-3 py-2 font-mono text-purple-400">
                                      {couponForRecord?.couponCode || r.couponId.slice(0, 10) + '…'}
                                    </td>
                                  )}
                                  <td className="px-3 py-2 text-green-400">
                                    {r.discountApplied != null ? `৳${r.discountApplied}` : <span className="text-gray-600">—</span>}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── TOKENS (Group only) ── */}
              {activeSection === 'tokens' && isGroup && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-400">
                      {groupCoupons.length} tokens in this group
                    </p>
                  </div>

                  {groupCoupons.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 gap-3 text-gray-500">
                      <Package size={32} />
                      <p className="text-sm">No token data loaded</p>
                    </div>
                  ) : (
                    <div className="border border-gray-700/50 rounded-xl overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-900/60">
                            <tr className="text-gray-400 uppercase tracking-wider">
                              {['#', 'Code', 'Tracking ID', 'Status', 'Usages', 'Per-User Limit'].map(h => (
                                <th key={h} className="px-3 py-2.5 text-left whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-700/40">
                            {groupCoupons.map((c, i) => {
                              const used = stats.usageRecords.filter(r => r.couponId === c.id).length;
                              return (
                                <tr key={c.id} className={`hover:bg-gray-800/50 transition-colors ${used > 0 ? 'bg-green-950/10' : ''}`}>
                                  <td className="px-3 py-2 text-gray-600">{i + 1}</td>
                                  <td className="px-3 py-2 font-mono text-purple-400 font-semibold">{c.couponCode}</td>
                                  <td className="px-3 py-2 font-mono text-gray-500">{c.trackingId || '—'}</td>
                                  <td className="px-3 py-2">
                                    <span className={`font-medium ${statusColor(c.status)}`}>{c.status}</span>
                                  </td>
                                  <td className="px-3 py-2">
                                    <span className={`font-semibold ${used > 0 ? 'text-green-400' : 'text-gray-500'}`}>{c.usageCount}</span>
                                    {c.usageLimit !== 'unlimited' && (
                                      <span className="text-gray-600"> / {c.usageLimit}</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-gray-400">{c.perUserLimit}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Token usage distribution */}
                  {groupCoupons.length > 0 && (
                    <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-4">
                      <SectionTitle icon={<BarChart2 size={14} />} title="Token Usage Distribution" />
                      <div className="grid grid-cols-3 gap-3 mt-2">
                        {[
                          { label: 'Unused', count: groupCoupons.filter(c => c.usageCount === 0).length, color: 'bg-gray-600' },
                          { label: 'Partially Used', count: groupCoupons.filter(c => c.usageCount > 0 && c.usageLimit !== 'unlimited' && c.usageCount < (c.usageLimit as number)).length, color: 'bg-yellow-600' },
                          { label: 'Fully Used', count: groupCoupons.filter(c => c.usageLimit !== 'unlimited' && c.usageCount >= (c.usageLimit as number)).length, color: 'bg-green-600' },
                        ].map(item => (
                          <div key={item.label} className="bg-gray-900/40 rounded-lg p-3 text-center border border-gray-700">
                            <div className={`w-3 h-3 rounded-full ${item.color} mx-auto mb-2`} />
                            <p className="text-lg font-bold text-white">{item.count}</p>
                            <p className="text-xs text-gray-500">{item.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* ── FOOTER ── */}
        <div className="px-5 py-3 border-t border-gray-700/50 flex items-center justify-between">
          <p className="text-xs text-gray-600">
            Statistics reflect <code className="bg-gray-800 px-1 rounded">couponUsage</code> collection.
            Full revenue data will populate after enrollment page upgrade.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg border border-gray-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default CouponStatisticsModal;
