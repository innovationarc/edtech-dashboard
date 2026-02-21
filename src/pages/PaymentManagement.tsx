// src/pages/PaymentManagement.tsx
// Production-grade Payment Management System
// Access: Admin, Manager, Course Manager, Student Manager, Coordinator only
// Collection: transactions (Firestore)

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CreditCard,
  Search,
  Download,
  RefreshCw,
  Loader,
  ChevronDown,
  ChevronUp,
  X,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Activity,
  Filter,
  Eye,
  Copy,
  Check,
  Calendar,
  User,
  Package,
  Tag,
  Shield,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { paymentService, Transaction } from '../services/paymentService';
import { useAuth } from '../contexts/AuthContext'; // adjust to your auth context path

// ─── Role Guard ─────────────────────────────────────────────────────────────

const ALLOWED_ROLES = ['admin', 'manager', 'course_manager', 'student_manager', 'coordinator'];

// ─── Types ───────────────────────────────────────────────────────────────────

type SortField = 'createdAt' | 'amount' | 'status' | 'transactionId' | 'userName';
type SortDir = 'asc' | 'desc';

interface Filters {
  search: string;
  status: string;
  gateway: string;
  productType: string;
  dateFrom: string;
  dateTo: string;
  amountMin: string;
  amountMax: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency = 'BDT') {
  return new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(date: Date | undefined) {
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-BD', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function truncate(str: string, n = 20) {
  return str.length > n ? str.slice(0, n) + '…' : str;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { label: string; cls: string; Icon: any }> = {
    success: { label: 'Success', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', Icon: CheckCircle },
    failed: { label: 'Failed', cls: 'bg-red-500/15 text-red-400 border-red-500/30', Icon: XCircle },
    pending: { label: 'Pending', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30', Icon: Clock },
    validating: { label: 'Validating', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/30', Icon: Activity },
    refunded: { label: 'Refunded', cls: 'bg-purple-500/15 text-purple-400 border-purple-500/30', Icon: AlertTriangle },
    cancelled: { label: 'Cancelled', cls: 'bg-gray-500/15 text-gray-400 border-gray-500/30', Icon: X },
  };
  const { label, cls, Icon } = map[status] ?? { label: status, cls: 'bg-gray-500/15 text-gray-400 border-gray-500/30', Icon: AlertTriangle };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cls}`}>
      <Icon size={11} />
      {label}
    </span>
  );
};

const StatCard = ({
  label,
  value,
  sub,
  Icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  Icon: any;
  accent: string;
}) => (
  <div className="relative overflow-hidden rounded-xl border border-white/5 bg-[#0f1117] p-5 flex flex-col gap-3">
    <div className={`absolute inset-0 opacity-5 bg-gradient-to-br ${accent}`} />
    <div className="flex items-start justify-between relative">
      <span className="text-xs font-medium text-gray-400 uppercase tracking-widest">{label}</span>
      <span className={`p-1.5 rounded-lg bg-gradient-to-br ${accent} opacity-80`}>
        <Icon size={14} className="text-white" />
      </span>
    </div>
    <div className="relative">
      <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  </div>
);

// Copy-to-clipboard button
const CopyBtn = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={copy}
      className="ml-1 text-gray-500 hover:text-gray-300 transition-colors"
      title="Copy"
    >
      {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
    </button>
  );
};

// ─── Detail Modal ─────────────────────────────────────────────────────────────

const DetailModal = ({ txn, onClose }: { txn: Transaction; onClose: () => void }) => {
  const rows: [string, any, any?][] = [
    ['Transaction ID', txn.transactionId, <CopyBtn text={txn.transactionId} />],
    ['Document ID', txn.id, <CopyBtn text={txn.id} />],
    ['Status', <StatusBadge status={txn.status} />],
    ['Amount', formatCurrency(txn.amount, txn.currency)],
    ['Currency', txn.currency],
    ['Gateway', txn.gateway || '—'],
    ['Payment Method', txn.paymentMethod || '—'],
    ['Bank Txn ID', txn.bankTransactionId || '—'],
    ['Validation ID', txn.validationId || '—'],
    ['Risk Level', txn.riskLevel || '—'],
    ['User Name', txn.userName],
    ['User Email', txn.userEmail],
    ['User ID', txn.userId],
    ['Product Name', txn.productName],
    ['Product ID', txn.productId],
    ['Product Type', txn.productType],
    ['Created At', formatDate(txn.createdAt)],
    ['Updated At', formatDate(txn.updatedAt)],
    ['Completed At', formatDate(txn.completedAt)],
  ];

  // Discounts
  const disc = txn.appliedDiscounts;
  if (disc) {
    if (disc.couponDiscount) rows.push(['Coupon Discount', `${disc.couponDiscount}%`]);
    if (disc.previousStudentDiscount) rows.push(['Returning Student Discount', `${disc.previousStudentDiscount}%`]);
    if (disc.extraDiscount) rows.push(['Extra Discount', `${disc.extraDiscount}%`]);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0d0f14] shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#0d0f14]">
          <div>
            <h2 className="text-white font-bold text-lg">Transaction Details</h2>
            <p className="text-xs text-gray-500 font-mono mt-0.5">{txn.transactionId}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-1">
          {rows.map(([label, val, extra]) => (
            <div key={label as string} className="flex items-start justify-between py-2.5 border-b border-white/[0.04] last:border-0">
              <span className="text-xs text-gray-500 font-medium w-44 shrink-0">{label}</span>
              <span className="text-sm text-gray-200 text-right break-all flex items-center gap-1">
                {val}
                {extra}
              </span>
            </div>
          ))}

          {/* Metadata */}
          {txn.metadata && Object.keys(txn.metadata).length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-gray-500 font-medium mb-2 uppercase tracking-widest">Metadata</p>
              <pre className="text-xs text-gray-300 bg-black/30 rounded-lg p-4 overflow-x-auto border border-white/5">
                {JSON.stringify(txn.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Filters Panel ────────────────────────────────────────────────────────────

const FiltersPanel = ({
  filters,
  onChange,
  onReset,
  gateways,
  productTypes,
}: {
  filters: Filters;
  onChange: (k: keyof Filters, v: string) => void;
  onReset: () => void;
  gateways: string[];
  productTypes: string[];
}) => {
  const inputCls =
    'w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary-500 placeholder-gray-600';

  return (
    <div className="rounded-xl border border-white/5 bg-[#0f1117] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Filter size={14} className="text-primary-400" />
          Filters
        </h3>
        <button onClick={onReset} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
          Reset all
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {/* Status */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Status</label>
          <select
            value={filters.status}
            onChange={(e) => onChange('status', e.target.value)}
            className={inputCls}
          >
            <option value="all">All Statuses</option>
            <option value="success">Success</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="validating">Validating</option>
            <option value="refunded">Refunded</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* Gateway */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Gateway</label>
          <select
            value={filters.gateway}
            onChange={(e) => onChange('gateway', e.target.value)}
            className={inputCls}
          >
            <option value="all">All Gateways</option>
            {gateways.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>

        {/* Product Type */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Product Type</label>
          <select
            value={filters.productType}
            onChange={(e) => onChange('productType', e.target.value)}
            className={inputCls}
          >
            <option value="all">All Types</option>
            {productTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Date From */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Date From</label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => onChange('dateFrom', e.target.value)}
            className={inputCls + ' [color-scheme:dark]'}
          />
        </div>

        {/* Date To */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Date To</label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => onChange('dateTo', e.target.value)}
            className={inputCls + ' [color-scheme:dark]'}
          />
        </div>

        {/* Amount Min */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Min Amount (BDT)</label>
          <input
            type="number"
            placeholder="0"
            value={filters.amountMin}
            onChange={(e) => onChange('amountMin', e.target.value)}
            className={inputCls}
          />
        </div>

        {/* Amount Max */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Max Amount (BDT)</label>
          <input
            type="number"
            placeholder="∞"
            value={filters.amountMax}
            onChange={(e) => onChange('amountMax', e.target.value)}
            className={inputCls}
          />
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_FILTERS: Filters = {
  search: '',
  status: 'all',
  gateway: 'all',
  productType: 'all',
  dateFrom: '',
  dateTo: '',
  amountMin: '',
  amountMax: '',
};

const PaymentManagement = () => {
  const { userProfile } = useAuth(); // adjust to your actual auth context

  // ── State ──
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);
  const [activeTab, setActiveTab] = useState<'transactions' | 'gateways' | 'reports'>('transactions');

  // ── Role Guard ──
  const hasAccess = userProfile && ALLOWED_ROLES.includes(userProfile.role);

  // ── Data ──
  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError('');
    try {
      const data = await paymentService.getAllTransactions();
      setTransactions(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load transactions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (hasAccess) loadData();
  }, [hasAccess, loadData]);

  // ── Derived ──
  const gateways = useMemo(
    () => [...new Set(transactions.map((t) => t.gateway).filter(Boolean))],
    [transactions]
  );
  const productTypes = useMemo(
    () => [...new Set(transactions.map((t) => t.productType).filter(Boolean))],
    [transactions]
  );

  const filtered = useMemo(() => {
    let list = [...transactions];

    // Search
    if (filters.search.trim()) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        (t) =>
          t.transactionId.toLowerCase().includes(q) ||
          t.userName?.toLowerCase().includes(q) ||
          t.userEmail?.toLowerCase().includes(q) ||
          t.productName?.toLowerCase().includes(q) ||
          t.userId?.toLowerCase().includes(q)
      );
    }
    // Status
    if (filters.status !== 'all') list = list.filter((t) => t.status === filters.status);
    // Gateway
    if (filters.gateway !== 'all') list = list.filter((t) => t.gateway === filters.gateway);
    // Product type
    if (filters.productType !== 'all') list = list.filter((t) => t.productType === filters.productType);
    // Date from
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom);
      list = list.filter((t) => t.createdAt >= from);
    }
    // Date to
    if (filters.dateTo) {
      const to = new Date(filters.dateTo);
      to.setHours(23, 59, 59, 999);
      list = list.filter((t) => t.createdAt <= to);
    }
    // Amount
    if (filters.amountMin) list = list.filter((t) => t.amount >= Number(filters.amountMin));
    if (filters.amountMax) list = list.filter((t) => t.amount <= Number(filters.amountMax));

    // Sort
    list.sort((a, b) => {
      let av: any, bv: any;
      switch (sortField) {
        case 'amount': av = a.amount; bv = b.amount; break;
        case 'status': av = a.status; bv = b.status; break;
        case 'transactionId': av = a.transactionId; bv = b.transactionId; break;
        case 'userName': av = a.userName; bv = b.userName; break;
        default: av = a.createdAt?.getTime() ?? 0; bv = b.createdAt?.getTime() ?? 0;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [transactions, filters, sortField, sortDir]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  // Stats
  const stats = useMemo(() => {
    const success = transactions.filter((t) => t.status === 'success');
    const revenue = success.reduce((s, t) => s + t.amount, 0);
    return {
      total: transactions.length,
      success: success.length,
      pending: transactions.filter((t) => t.status === 'pending').length,
      failed: transactions.filter((t) => t.status === 'failed').length,
      revenue,
    };
  }, [transactions]);

  // ── Handlers ──
  const handleFilter = (k: keyof Filters, v: string) => {
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(1);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('desc'); }
    setPage(1);
  };

  const handleRefresh = () => loadData(true);

  // CSV Export
  const handleExport = () => {
    const headers = [
      'Transaction ID', 'Document ID', 'Status', 'Amount', 'Currency',
      'User Name', 'User Email', 'User ID',
      'Product Name', 'Product ID', 'Product Type',
      'Gateway', 'Payment Method', 'Bank Txn ID', 'Validation ID',
      'Created At', 'Completed At',
    ];
    const rows = filtered.map((t) => [
      t.transactionId,
      t.id,
      t.status,
      t.amount,
      t.currency,
      t.userName,
      t.userEmail,
      t.userId,
      t.productName,
      t.productId,
      t.productType,
      t.gateway,
      t.paymentMethod || '',
      t.bankTransactionId || '',
      t.validationId || '',
      t.createdAt?.toISOString() || '',
      t.completedAt?.toISOString() || '',
    ]);

    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const SortBtn = ({ field, label }: { field: SortField; label: string }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 group whitespace-nowrap"
    >
      {label}
      <ArrowUpDown
        size={12}
        className={`${sortField === field ? 'text-primary-400' : 'text-gray-600 group-hover:text-gray-400'} transition-colors`}
      />
    </button>
  );

  // ── Access Denied ──
  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center space-y-3">
        <Shield size={40} className="text-red-400" />
        <h2 className="text-white font-semibold text-lg">Access Denied</h2>
        <p className="text-gray-400 text-sm max-w-xs">
          You do not have permission to view Payment Management.
        </p>
      </div>
    );
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader size={30} className="animate-spin text-primary-400" />
        <p className="text-gray-500 text-sm">Loading transactions…</p>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Payment Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {transactions.length.toLocaleString()} total transactions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.07] text-gray-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-primary-600 hover:bg-primary-700 text-white transition-colors"
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm">
          <XCircle size={16} />
          {error}
          <button onClick={() => setError('')} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-white/5">
        {(['transactions', 'gateways', 'reports'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-3 text-sm font-medium capitalize border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-primary-500 text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab === 'transactions' ? 'Transactions' : tab === 'gateways' ? 'Payment Gateways' : 'Reports'}
          </button>
        ))}
      </div>

      {/* ── Transactions Tab ── */}
      {activeTab === 'transactions' && (
        <div className="space-y-5">

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <StatCard label="Total Transactions" value={stats.total.toLocaleString()} Icon={Activity} accent="from-blue-500 to-cyan-500" />
            <StatCard label="Successful" value={stats.success.toLocaleString()} Icon={CheckCircle} accent="from-emerald-500 to-teal-500" />
            <StatCard label="Pending" value={stats.pending.toLocaleString()} Icon={Clock} accent="from-amber-500 to-orange-500" />
            <StatCard label="Failed" value={stats.failed.toLocaleString()} Icon={XCircle} accent="from-red-500 to-rose-500" />
            <StatCard
              label="Total Revenue"
              value={`৳${stats.revenue.toLocaleString('en-BD', { minimumFractionDigits: 0 })}`}
              sub="Successful transactions only"
              Icon={TrendingUp}
              accent="from-violet-500 to-purple-500"
            />
          </div>

          {/* Search & Filter toggle */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Search by transaction ID, user, product…"
                value={filters.search}
                onChange={(e) => handleFilter('search', e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-sm bg-white/[0.04] border border-white/10 text-white rounded-xl focus:outline-none focus:ring-1 focus:ring-primary-500 placeholder-gray-600"
              />
              {filters.search && (
                <button
                  onClick={() => handleFilter('search', '')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm rounded-xl border transition-colors ${
                showFilters
                  ? 'border-primary-500/50 bg-primary-500/10 text-primary-400'
                  : 'border-white/10 bg-white/[0.04] text-gray-400 hover:text-gray-200'
              }`}
            >
              <Filter size={14} />
              Filters
              {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <FiltersPanel
              filters={filters}
              onChange={handleFilter}
              onReset={() => { setFilters(DEFAULT_FILTERS); setPage(1); }}
              gateways={gateways}
              productTypes={productTypes}
            />
          )}

          {/* Results count */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              {filtered.length.toLocaleString()} result{filtered.length !== 1 ? 's' : ''}
              {filtered.length !== transactions.length && ` (filtered from ${transactions.length.toLocaleString()})`}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="text-xs bg-white/[0.04] border border-white/10 text-gray-300 rounded-lg px-2 py-1 focus:outline-none"
              >
                {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-xl border border-white/5 bg-[#0f1117] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 bg-white/[0.02]">
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">
                      <SortBtn field="transactionId" label="Transaction ID" />
                    </th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">
                      <SortBtn field="userName" label="User" />
                    </th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Product</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">
                      <SortBtn field="amount" label="Amount" />
                    </th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">
                      <SortBtn field="status" label="Status" />
                    </th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Gateway</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">
                      <SortBtn field="createdAt" label="Date" />
                    </th>
                    <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-16 text-gray-500">
                        <DollarSign size={28} className="mx-auto mb-3 text-gray-700" />
                        No transactions match your filters.
                      </td>
                    </tr>
                  ) : (
                    paginated.map((txn) => (
                      <tr
                        key={txn.id}
                        className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors group"
                      >
                        {/* Transaction ID */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-xs text-gray-200">{truncate(txn.transactionId, 22)}</span>
                            <CopyBtn text={txn.transactionId} />
                          </div>
                        </td>

                        {/* User */}
                        <td className="px-4 py-3.5">
                          <div>
                            <p className="text-gray-200 font-medium text-xs">{txn.userName || '—'}</p>
                            <p className="text-gray-500 text-xs">{truncate(txn.userEmail || '', 24)}</p>
                          </div>
                        </td>

                        {/* Product */}
                        <td className="px-4 py-3.5">
                          <div>
                            <p className="text-gray-200 text-xs">{truncate(txn.productName || '—', 22)}</p>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-gray-400 capitalize">
                              {txn.productType}
                            </span>
                          </div>
                        </td>

                        {/* Amount */}
                        <td className="px-4 py-3.5">
                          <span className="text-white font-semibold">
                            ৳{txn.amount.toLocaleString('en-BD', { minimumFractionDigits: 2 })}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5">
                          <StatusBadge status={txn.status} />
                        </td>

                        {/* Gateway */}
                        <td className="px-4 py-3.5 text-gray-400 text-xs">{txn.gateway || '—'}</td>

                        {/* Date */}
                        <td className="px-4 py-3.5">
                          <div className="text-xs text-gray-400">
                            {txn.createdAt
                              ? new Intl.DateTimeFormat('en-BD', {
                                  month: 'short', day: '2-digit',
                                  year: 'numeric', hour: '2-digit', minute: '2-digit',
                                }).format(txn.createdAt)
                              : '—'}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5 text-right">
                          <button
                            onClick={() => setSelectedTxn(txn)}
                            className="inline-flex items-center gap-1.5 text-xs text-primary-400 hover:text-primary-300 opacity-0 group-hover:opacity-100 transition-all px-2.5 py-1.5 rounded-lg hover:bg-primary-500/10"
                          >
                            <Eye size={12} />
                            Details
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
                <p className="text-xs text-gray-500">
                  Page {page} of {totalPages} · {filtered.length} results
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  {/* Page numbers */}
                  {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                    const p = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page + i - 3;
                    if (p < 1 || p > totalPages) return null;
                    return (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`w-7 h-7 text-xs rounded-lg transition-colors ${
                          p === page
                            ? 'bg-primary-500 text-white'
                            : 'text-gray-400 hover:bg-white/5'
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Gateways Tab ── */}
      {activeTab === 'gateways' && (
        <div className="rounded-xl border border-white/5 bg-[#0f1117] p-6 space-y-4">
          <p className="text-sm text-gray-500">
            Gateway management is handled server-side. Below is a summary of gateways detected from your transaction history.
          </p>
          {gateways.length === 0 ? (
            <p className="text-gray-600 text-sm">No gateways detected yet.</p>
          ) : (
            <div className="space-y-3">
              {gateways.map((gw) => {
                const count = transactions.filter((t) => t.gateway === gw).length;
                const rev = transactions
                  .filter((t) => t.gateway === gw && t.status === 'success')
                  .reduce((s, t) => s + t.amount, 0);
                return (
                  <div key={gw} className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-lg bg-primary-500/10">
                        <CreditCard size={18} className="text-primary-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium text-sm">{gw}</p>
                        <p className="text-xs text-gray-500">{count} transaction{count !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-semibold text-sm">
                        ৳{rev.toLocaleString('en-BD', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-gray-500">Revenue collected</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Reports Tab ── */}
      {activeTab === 'reports' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                label: 'Full Transaction Report',
                desc: 'All transactions with complete details',
                filter: () => transactions,
                filename: 'all_transactions',
                Icon: Activity,
                accent: 'text-blue-400',
              },
              {
                label: 'Successful Payments',
                desc: 'Completed, revenue-generating transactions',
                filter: () => transactions.filter((t) => t.status === 'success'),
                filename: 'successful_payments',
                Icon: CheckCircle,
                accent: 'text-emerald-400',
              },
              {
                label: 'Failed & Cancelled',
                desc: 'Transactions that did not complete',
                filter: () => transactions.filter((t) => ['failed', 'cancelled'].includes(t.status)),
                filename: 'failed_cancelled',
                Icon: XCircle,
                accent: 'text-red-400',
              },
            ].map(({ label, desc, filter, filename, Icon, accent }) => (
              <button
                key={label}
                onClick={() => {
                  const data = filter();
                  const headers = ['Transaction ID', 'Status', 'Amount', 'Currency', 'User Name', 'User Email', 'Product Name', 'Gateway', 'Created At'];
                  const rows = data.map((t) => [t.transactionId, t.status, t.amount, t.currency, t.userName, t.userEmail, t.productName, t.gateway, t.createdAt?.toISOString() || '']);
                  const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="text-left p-5 rounded-xl border border-white/5 bg-[#0f1117] hover:bg-white/[0.04] transition-colors group"
              >
                <div className={`mb-3 ${accent}`}>
                  <Icon size={22} />
                </div>
                <p className="text-white font-semibold text-sm group-hover:text-primary-300 transition-colors">{label}</p>
                <p className="text-xs text-gray-500 mt-1">{desc}</p>
                <p className="text-xs text-primary-500 mt-3 flex items-center gap-1">
                  <Download size={11} />
                  Download CSV
                </p>
              </button>
            ))}
          </div>

          {/* Summary stats */}
          <div className="rounded-xl border border-white/5 bg-[#0f1117] p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Revenue Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {(['success', 'pending', 'failed', 'refunded'] as const).map((st) => {
                const list = transactions.filter((t) => t.status === st);
                const total = list.reduce((s, t) => s + t.amount, 0);
                return (
                  <div key={st} className="space-y-1">
                    <StatusBadge status={st} />
                    <p className="text-lg font-bold text-white">
                      ৳{total.toLocaleString('en-BD', { minimumFractionDigits: 0 })}
                    </p>
                    <p className="text-xs text-gray-500">{list.length} transactions</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedTxn && (
        <DetailModal txn={selectedTxn} onClose={() => setSelectedTxn(null)} />
      )}
    </div>
  );
};

export default PaymentManagement;
