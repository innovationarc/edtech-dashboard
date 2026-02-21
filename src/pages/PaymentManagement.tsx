// src/pages/PaymentManagement.tsx
// Production-grade · World-class Payment Management System
// Features: list, search, filters, sort, pagination, detail modal,
//           status change, delete with confirmation, security audit log,
//           readable userId fetch, CSV export, revenue reports
// Access: admin | manager | course_manager | student_manager | coordinator
// Blocked: teacher | parent | student

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  CreditCard, Search, Download, RefreshCw, Loader,
  ChevronDown, ChevronUp, X, CheckCircle, XCircle, Clock,
  AlertTriangle, TrendingUp, DollarSign, Activity, Filter,
  Eye, Copy, Check, Shield, ArrowUpDown, ChevronLeft,
  ChevronRight, Trash2, Edit2, ClipboardList, AlertCircle,
  Info, RotateCcw, Ban, ArrowRight,
} from 'lucide-react';
import {
  paymentService,
  Transaction,
  AuditLog,
  AuditAction,
} from '../services/paymentService';
import { useDashboard } from '../contexts/DashboardContext';

// ─── Constants ───────────────────────────────────────────────────────────────

const ALLOWED_ROLES = ['admin', 'manager', 'course_manager', 'student_manager', 'coordinator'];
// Only admins and managers can delete or change status
const POWER_ROLES = ['admin', 'manager'];
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const ALL_STATUSES = ['success', 'failed', 'pending', 'validating', 'refunded', 'cancelled'] as const;

// ─── Types ───────────────────────────────────────────────────────────────────

type SortField = 'createdAt' | 'amount' | 'status' | 'transactionId' | 'userName';
type SortDir = 'asc' | 'desc';
type TabId = 'transactions' | 'gateways' | 'reports' | 'audit';

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

const DEFAULT_FILTERS: Filters = {
  search: '', status: 'all', gateway: 'all',
  productType: 'all', dateFrom: '', dateTo: '',
  amountMin: '', amountMax: '',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(date: Date | undefined, compact = false) {
  if (!date) return '—';
  if (compact) return new Intl.DateTimeFormat('en-BD', { month: 'short', day: '2-digit', year: 'numeric' }).format(date);
  return new Intl.DateTimeFormat('en-BD', {
    year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(date);
}

function trunc(str: string, n = 20) {
  if (!str) return '—';
  return str.length > n ? str.slice(0, n) + '…' : str;
}

function diff<T extends object>(before: T, after: Partial<T>) {
  return (Object.keys(after) as (keyof T)[]).flatMap((k) => {
    if (JSON.stringify(before[k]) === JSON.stringify(after[k])) return [];
    return [{ field: String(k), oldValue: before[k], newValue: after[k] }];
  });
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; cls: string; dot: string; Icon: any }> = {
  success:    { label: 'Success',    cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400', Icon: CheckCircle },
  failed:     { label: 'Failed',     cls: 'bg-red-500/15 text-red-400 border-red-500/30',             dot: 'bg-red-400',     Icon: XCircle },
  pending:    { label: 'Pending',    cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30',       dot: 'bg-amber-400',   Icon: Clock },
  validating: { label: 'Validating', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/30',          dot: 'bg-blue-400',    Icon: Activity },
  refunded:   { label: 'Refunded',   cls: 'bg-purple-500/15 text-purple-400 border-purple-500/30',    dot: 'bg-purple-400',  Icon: RotateCcw },
  cancelled:  { label: 'Cancelled',  cls: 'bg-gray-500/15 text-gray-400 border-gray-500/30',          dot: 'bg-gray-400',    Icon: Ban },
};

const AUDIT_CFG: Record<AuditAction, { label: string; cls: string; Icon: any }> = {
  status_changed:       { label: 'Status Changed',       cls: 'text-blue-400',   Icon: Edit2 },
  transaction_deleted:  { label: 'Transaction Deleted',  cls: 'text-red-400',    Icon: Trash2 },
  transaction_viewed:   { label: 'Viewed',               cls: 'text-gray-400',   Icon: Eye },
  transaction_created:  { label: 'Created',              cls: 'text-emerald-400',Icon: CheckCircle },
  transaction_updated:  { label: 'Updated',              cls: 'text-amber-400',  Icon: Edit2 },
};

// ─── Small reusable components ───────────────────────────────────────────────

const StatusBadge = ({ status }: { status: string }) => {
  const cfg = STATUS_CFG[status] ?? { label: status, cls: 'bg-gray-500/15 text-gray-400 border-gray-500/30', Icon: AlertCircle };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.cls}`}>
      <cfg.Icon size={11} />
      {cfg.label}
    </span>
  );
};

const CopyBtn = ({ text }: { text: string }) => {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1500); }); }}
      className="ml-1 text-gray-600 hover:text-gray-300 transition-colors shrink-0"
      title="Copy"
    >
      {ok ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
    </button>
  );
};

const StatCard = ({ label, value, sub, Icon, accent }: { label: string; value: string; sub?: string; Icon: any; accent: string }) => (
  <div className="relative overflow-hidden rounded-xl border border-white/5 bg-[#0f1117] p-5 flex flex-col gap-3">
    <div className={`absolute inset-0 opacity-[0.04] bg-gradient-to-br ${accent}`} />
    <div className="flex items-start justify-between relative">
      <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">{label}</span>
      <span className={`p-1.5 rounded-lg bg-gradient-to-br ${accent} opacity-70`}>
        <Icon size={13} className="text-white" />
      </span>
    </div>
    <div className="relative">
      <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
      {sub && <p className="text-[11px] text-gray-500 mt-0.5">{sub}</p>}
    </div>
  </div>
);

// Toast notification
const Toast = ({ msg, type, onClose }: { msg: string; type: 'success' | 'error' | 'info'; onClose: () => void }) => {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  const cls = type === 'success' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
    : type === 'error' ? 'bg-red-500/20 border-red-500/40 text-red-300'
    : 'bg-blue-500/20 border-blue-500/40 text-blue-300';
  return (
    <div className={`fixed bottom-6 right-6 z-[200] flex items-center gap-3 px-4 py-3 rounded-xl border ${cls} shadow-2xl backdrop-blur-sm max-w-sm animate-in`}>
      {type === 'success' ? <CheckCircle size={16} /> : type === 'error' ? <XCircle size={16} /> : <Info size={16} />}
      <span className="text-sm font-medium">{msg}</span>
      <button onClick={onClose} className="ml-auto opacity-60 hover:opacity-100"><X size={14} /></button>
    </div>
  );
};

// ─── Confirm Delete Modal ─────────────────────────────────────────────────────

const ConfirmDeleteModal = ({
  txn, onConfirm, onCancel, loading,
}: { txn: Transaction; onConfirm: () => void; onCancel: () => void; loading: boolean }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }}>
    <div className="w-full max-w-md rounded-2xl border border-red-500/20 bg-[#0d0f14] shadow-2xl p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-full bg-red-500/15 border border-red-500/30">
          <Trash2 size={18} className="text-red-400" />
        </div>
        <div>
          <h3 className="text-white font-bold text-base">Delete Transaction</h3>
          <p className="text-xs text-gray-500 mt-0.5">This action cannot be undone</p>
        </div>
      </div>
      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Transaction ID</span>
          <span className="text-gray-200 font-mono">{trunc(txn.transactionId, 28)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">User</span>
          <span className="text-gray-200">{txn.userName}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Amount</span>
          <span className="text-white font-semibold">৳{txn.amount.toLocaleString('en-BD', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="flex justify-between text-xs items-center">
          <span className="text-gray-500">Status</span>
          <StatusBadge status={txn.status} />
        </div>
      </div>
      <p className="text-xs text-gray-400 leading-relaxed">
        This will permanently delete the transaction record and write a security audit log. This action is <span className="text-red-400 font-semibold">irreversible</span>.
      </p>
      <div className="flex gap-3">
        <button onClick={onCancel} disabled={loading} className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm hover:bg-white/5 transition-colors disabled:opacity-50">Cancel</button>
        <button onClick={onConfirm} disabled={loading} className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? <Loader size={14} className="animate-spin" /> : <Trash2 size={14} />}
          {loading ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </div>
  </div>
);

// ─── Status Change Modal ──────────────────────────────────────────────────────

const StatusChangeModal = ({
  txn, onConfirm, onCancel, loading,
}: { txn: Transaction; onConfirm: (newStatus: Transaction['status']) => void; onCancel: () => void; loading: boolean }) => {
  const [selected, setSelected] = useState<Transaction['status']>(txn.status);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }}>
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d0f14] shadow-2xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-full bg-blue-500/15 border border-blue-500/30">
            <Edit2 size={18} className="text-blue-400" />
          </div>
          <div>
            <h3 className="text-white font-bold text-base">Change Status</h3>
            <p className="text-xs text-gray-500 font-mono mt-0.5">{trunc(txn.transactionId, 30)}</p>
          </div>
          <button onClick={onCancel} className="ml-auto text-gray-500 hover:text-white"><X size={16} /></button>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-gray-500 uppercase tracking-widest font-medium mb-3">Select New Status</p>
          {ALL_STATUSES.map((s) => {
            const cfg = STATUS_CFG[s];
            const isCurrent = s === txn.status;
            const isSelected = s === selected;
            return (
              <button
                key={s}
                onClick={() => setSelected(s)}
                disabled={isCurrent}
                className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                  isCurrent ? 'border-white/5 bg-white/[0.02] opacity-40 cursor-not-allowed'
                  : isSelected ? 'border-primary-500/50 bg-primary-500/10'
                  : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.05]'
                }`}
              >
                <span className={`inline-flex items-center gap-2 text-sm ${cfg.cls.split(' ').find(c => c.startsWith('text-')) ?? 'text-gray-300'}`}>
                  <cfg.Icon size={14} />
                  {cfg.label}
                </span>
                <div className="flex items-center gap-2">
                  {isCurrent && <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">Current</span>}
                  {isSelected && !isCurrent && <Check size={14} className="text-primary-400" />}
                </div>
              </button>
            );
          })}
        </div>

        {selected !== txn.status && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
            <AlertTriangle size={13} />
            Changing from <StatusBadge status={txn.status} /> to <StatusBadge status={selected} />. This will be logged in the audit trail.
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onCancel} disabled={loading} className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm hover:bg-white/5 transition-colors disabled:opacity-50">Cancel</button>
          <button
            onClick={() => onConfirm(selected)}
            disabled={loading || selected === txn.status}
            className="flex-1 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {loading ? <Loader size={14} className="animate-spin" /> : <Check size={14} />}
            {loading ? 'Saving…' : 'Confirm Change'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Detail Modal ─────────────────────────────────────────────────────────────

const DetailModal = ({
  txn, readableUserId, onClose, onDelete, onChangeStatus, canModify,
}: {
  txn: Transaction;
  readableUserId: string | null;
  onClose: () => void;
  onDelete: () => void;
  onChangeStatus: () => void;
  canModify: boolean;
}) => {
  const rows: [string, React.ReactNode][] = [
    ['Transaction ID',  <span className="flex items-center font-mono text-xs">{txn.transactionId}<CopyBtn text={txn.transactionId} /></span>],
    ['Document ID',     <span className="flex items-center font-mono text-xs">{txn.id}<CopyBtn text={txn.id} /></span>],
    ['Status',          <StatusBadge status={txn.status} />],
    ['Amount',          <span className="text-white font-bold">৳{txn.amount.toLocaleString('en-BD', { minimumFractionDigits: 2 })} {txn.currency}</span>],
    ['Gateway',         txn.gateway || '—'],
    ['Payment Method',  txn.paymentMethod || '—'],
    ['Bank Txn ID',     txn.bankTransactionId || '—'],
    ['Validation ID',   txn.validationId || '—'],
    ['Risk Level',      txn.riskLevel || '—'],
    ['User Name',       txn.userName || '—'],
    ['User Email',      txn.userEmail || '—'],
    ['User ID (Readable)', readableUserId ? <span className="flex items-center gap-1 font-mono text-emerald-400">{readableUserId}<CopyBtn text={readableUserId} /></span> : <span className="text-gray-500 text-xs">Loading…</span>],
    ['Auth UID',        <span className="flex items-center font-mono text-xs">{txn.userId}<CopyBtn text={txn.userId} /></span>],
    ['Product Name',    txn.productName || '—'],
    ['Product ID',      txn.productId || '—'],
    ['Product Type',    txn.productType || '—'],
    ['Created At',      fmtDate(txn.createdAt)],
    ['Updated At',      fmtDate(txn.updatedAt)],
    ['Completed At',    fmtDate(txn.completedAt)],
  ];

  const disc = txn.appliedDiscounts;
  if (disc?.couponDiscount) rows.push(['Coupon Discount', `${disc.couponDiscount}%`]);
  if (disc?.previousStudentDiscount) rows.push(['Returning Student Discount', `${disc.previousStudentDiscount}%`]);
  if (disc?.extraDiscount) rows.push(['Extra Discount', `${disc.extraDiscount}%`]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0d0f14] shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#0d0f14]">
          <div>
            <h2 className="text-white font-bold text-base">Transaction Details</h2>
            <p className="text-[11px] text-gray-500 font-mono mt-0.5">{trunc(txn.transactionId, 40)}</p>
          </div>
          <div className="flex items-center gap-2">
            {canModify && (
              <>
                <button
                  onClick={onChangeStatus}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-colors"
                >
                  <Edit2 size={12} /> Status
                </button>
                <button
                  onClick={onDelete}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors"
                >
                  <Trash2 size={12} /> Delete
                </button>
              </>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors ml-1">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Rows */}
        <div className="p-6 space-y-0">
          {rows.map(([label, val]) => (
            <div key={label as string} className="flex items-start justify-between py-2.5 border-b border-white/[0.04] last:border-0 gap-4">
              <span className="text-xs text-gray-500 font-medium w-44 shrink-0">{label}</span>
              <span className="text-sm text-gray-200 text-right break-all">{val}</span>
            </div>
          ))}
        </div>

        {/* Metadata */}
        {txn.metadata && Object.keys(txn.metadata).length > 0 && (
          <div className="px-6 pb-6">
            <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-widest mb-2">Metadata</p>
            <pre className="text-xs text-gray-300 bg-black/30 rounded-lg p-4 overflow-x-auto border border-white/5">
              {JSON.stringify(txn.metadata, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Audit Log Tab ────────────────────────────────────────────────────────────

const AuditLogTab = ({ logs, loading, error, onRefresh }: {
  logs: AuditLog[];
  loading: boolean;
  error: string;
  onRefresh: () => void;
}) => {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  const filtered = useMemo(() => logs.filter(l => {
    const q = search.toLowerCase();
    const matchSearch = !q || l.transactionId.toLowerCase().includes(q) || l.performedByName.toLowerCase().includes(q) || l.performedByRole.toLowerCase().includes(q);
    const matchAction = actionFilter === 'all' || l.action === actionFilter;
    return matchSearch && matchAction;
  }), [logs, search, actionFilter]);

  const inputCls = 'bg-white/[0.04] border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary-500 placeholder-gray-600';

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-primary-400" />
          <h3 className="text-white font-semibold text-sm">Security Audit Log</h3>
          <span className="text-xs text-gray-500 bg-white/[0.04] px-2 py-0.5 rounded-full">{filtered.length} entries</span>
        </div>
        <button onClick={onRefresh} disabled={loading} className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.04] text-gray-300 hover:text-white transition-colors disabled:opacity-50">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input type="text" placeholder="Search by transaction ID, actor name…" value={search} onChange={e => setSearch(e.target.value)} className={`${inputCls} pl-9 w-full`} />
        </div>
        <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} className={inputCls}>
          <option value="all">All Actions</option>
          {Object.entries(AUDIT_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          <XCircle size={14} /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-gray-500">
          <Loader size={20} className="animate-spin" /> Loading audit logs…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-600">
          <ClipboardList size={32} className="mb-3 text-gray-700" />
          <p className="text-sm">No audit log entries found.</p>
          <p className="text-xs mt-1">Actions like status changes, deletions, and updates are recorded here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((log) => {
            const cfg = AUDIT_CFG[log.action] ?? { label: log.action, cls: 'text-gray-400', Icon: Info };
            return (
              <div key={log.id} className="rounded-xl border border-white/5 bg-[#0f1117] p-4 space-y-3">
                {/* Header row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-white/[0.04]">
                      <cfg.Icon size={13} className={cfg.cls} />
                    </div>
                    <div>
                      <span className={`text-xs font-semibold ${cfg.cls}`}>{cfg.label}</span>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        by <span className="text-gray-300 font-medium">{log.performedByName}</span>
                        <span className="mx-1 text-gray-600">·</span>
                        <span className="text-gray-500">{log.performedByRole}</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-gray-400">{fmtDate(log.timestamp)}</p>
                  </div>
                </div>

                {/* Transaction ref */}
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-gray-600">TXN:</span>
                  <span className="font-mono text-gray-400">{trunc(log.transactionId, 36)}</span>
                  <CopyBtn text={log.transactionId} />
                </div>

                {/* Changes */}
                {log.changes && log.changes.length > 0 && (
                  <div className="space-y-1.5 pt-1 border-t border-white/5">
                    <p className="text-[10px] text-gray-600 uppercase tracking-widest font-medium">Changes</p>
                    {log.changes.map((c, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs bg-white/[0.02] rounded-lg px-3 py-2">
                        <span className="text-gray-500 font-medium w-28 shrink-0">{c.field}</span>
                        <span className="text-red-400 line-through">{String(c.oldValue ?? '—')}</span>
                        <ArrowRight size={11} className="text-gray-600 shrink-0" />
                        <span className="text-emerald-400">{String(c.newValue ?? '—')}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Note */}
                {log.note && (
                  <p className="text-[11px] text-gray-500 italic border-t border-white/5 pt-2">{log.note}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Filters Panel ────────────────────────────────────────────────────────────

const FiltersPanel = ({
  filters, onChange, onReset, gateways, productTypes,
}: {
  filters: Filters;
  onChange: (k: keyof Filters, v: string) => void;
  onReset: () => void;
  gateways: string[];
  productTypes: string[];
}) => {
  const sel = 'w-full bg-white/[0.04] border border-white/10 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary-500 [color-scheme:dark]';
  return (
    <div className="rounded-xl border border-white/5 bg-[#0f1117] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-400 flex items-center gap-1.5"><Filter size={12} className="text-primary-400" /> Advanced Filters</p>
        <button onClick={onReset} className="text-xs text-gray-600 hover:text-gray-300 transition-colors">Reset all</button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2">
        <div>
          <label className="text-[10px] text-gray-600 mb-1 block uppercase tracking-wider">Status</label>
          <select value={filters.status} onChange={e => onChange('status', e.target.value)} className={sel}>
            <option value="all">All</option>
            {ALL_STATUSES.map(s => <option key={s} value={s}>{STATUS_CFG[s].label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-gray-600 mb-1 block uppercase tracking-wider">Gateway</label>
          <select value={filters.gateway} onChange={e => onChange('gateway', e.target.value)} className={sel}>
            <option value="all">All</option>
            {gateways.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-gray-600 mb-1 block uppercase tracking-wider">Product Type</label>
          <select value={filters.productType} onChange={e => onChange('productType', e.target.value)} className={sel}>
            <option value="all">All</option>
            {productTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-gray-600 mb-1 block uppercase tracking-wider">Date From</label>
          <input type="date" value={filters.dateFrom} onChange={e => onChange('dateFrom', e.target.value)} className={sel} />
        </div>
        <div>
          <label className="text-[10px] text-gray-600 mb-1 block uppercase tracking-wider">Date To</label>
          <input type="date" value={filters.dateTo} onChange={e => onChange('dateTo', e.target.value)} className={sel} />
        </div>
        <div>
          <label className="text-[10px] text-gray-600 mb-1 block uppercase tracking-wider">Min Amount</label>
          <input type="number" placeholder="0" value={filters.amountMin} onChange={e => onChange('amountMin', e.target.value)} className={sel} />
        </div>
        <div>
          <label className="text-[10px] text-gray-600 mb-1 block uppercase tracking-wider">Max Amount</label>
          <input type="number" placeholder="∞" value={filters.amountMax} onChange={e => onChange('amountMax', e.target.value)} className={sel} />
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const PaymentManagement = () => {
  const { user: userProfile } = useDashboard();

  // ── Core state ──
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // ── Filters / sort / pagination ──
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // ── Tab ──
  const [activeTab, setActiveTab] = useState<TabId>('transactions');

  // ── Modals ──
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);
  const [deleteTxn, setDeleteTxn] = useState<Transaction | null>(null);
  const [statusTxn, setStatusTxn] = useState<Transaction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // ── Readable userIds cache ──
  const [readableIds, setReadableIds] = useState<Record<string, string | null>>({});
  const fetchingUids = useRef(new Set<string>());

  // ── Audit log ──
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState('');

  // ── Toast ──
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => setToast({ msg, type });

  // ── Role checks ──
  const hasAccess = !!userProfile && ALLOWED_ROLES.includes(userProfile.role);
  const canModify = !!userProfile && POWER_ROLES.includes(userProfile.role);

  // ── Actor info for audit logs ──
  const actorInfo = useMemo(() => ({
    performedBy: userProfile?.uid ?? 'unknown',
    performedByName: userProfile?.fullName ?? userProfile?.name ?? 'Unknown',
    performedByRole: userProfile?.role ?? 'unknown',
  }), [userProfile]);

  // ── Load transactions ──
  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
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

  // ── Load audit logs ──
  const loadAuditLogs = useCallback(async () => {
    setAuditLoading(true);
    setAuditError('');
    try {
      const logs = await paymentService.getAuditLogs(undefined, 500);
      setAuditLogs(logs);
    } catch (e: any) {
      setAuditError(e.message || 'Failed to load audit logs');
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasAccess) {
      loadData();
    }
  }, [hasAccess, loadData]);

  useEffect(() => {
    if (hasAccess && activeTab === 'audit') {
      loadAuditLogs();
    }
  }, [hasAccess, activeTab, loadAuditLogs]);

  // ── Fetch readable userId for visible transactions ──
  useEffect(() => {
    const uids = transactions.map(t => t.userId).filter(uid => uid && !(uid in readableIds) && !fetchingUids.current.has(uid));
    if (uids.length === 0) return;
    uids.forEach(uid => fetchingUids.current.add(uid));
    Promise.allSettled(
      uids.map(uid =>
        paymentService.getReadableUserId(uid).then(rid => ({ uid, rid }))
      )
    ).then(results => {
      const updates: Record<string, string | null> = {};
      results.forEach(r => {
        if (r.status === 'fulfilled') updates[r.value.uid] = r.value.rid;
      });
      setReadableIds(prev => ({ ...prev, ...updates }));
    });
  }, [transactions]);

  // ── Derived data ──
  const gateways = useMemo(() => [...new Set(transactions.map(t => t.gateway).filter(Boolean))], [transactions]);
  const productTypes = useMemo(() => [...new Set(transactions.map(t => t.productType).filter(Boolean))], [transactions]);

  const filtered = useMemo(() => {
    let list = [...transactions];
    const q = filters.search.trim().toLowerCase();
    if (q) list = list.filter(t =>
      t.transactionId?.toLowerCase().includes(q) ||
      t.userName?.toLowerCase().includes(q) ||
      t.userEmail?.toLowerCase().includes(q) ||
      t.productName?.toLowerCase().includes(q) ||
      t.userId?.toLowerCase().includes(q) ||
      (readableIds[t.userId] ?? '').toLowerCase().includes(q)
    );
    if (filters.status !== 'all') list = list.filter(t => t.status === filters.status);
    if (filters.gateway !== 'all') list = list.filter(t => t.gateway === filters.gateway);
    if (filters.productType !== 'all') list = list.filter(t => t.productType === filters.productType);
    if (filters.dateFrom) { const d = new Date(filters.dateFrom); list = list.filter(t => t.createdAt >= d); }
    if (filters.dateTo) { const d = new Date(filters.dateTo); d.setHours(23, 59, 59, 999); list = list.filter(t => t.createdAt <= d); }
    if (filters.amountMin) list = list.filter(t => t.amount >= Number(filters.amountMin));
    if (filters.amountMax) list = list.filter(t => t.amount <= Number(filters.amountMax));
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
  }, [transactions, filters, sortField, sortDir, readableIds]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const stats = useMemo(() => {
    const success = transactions.filter(t => t.status === 'success');
    return {
      total: transactions.length,
      success: success.length,
      pending: transactions.filter(t => t.status === 'pending').length,
      failed: transactions.filter(t => t.status === 'failed').length,
      revenue: success.reduce((s, t) => s + t.amount, 0),
    };
  }, [transactions]);

  // ── Handlers ──
  const handleFilter = (k: keyof Filters, v: string) => { setFilters(f => ({ ...f, [k]: v })); setPage(1); };
  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
    setPage(1);
  };

  // ── Delete ──
  const handleDeleteConfirm = async () => {
    if (!deleteTxn) return;
    setActionLoading(true);
    try {
      // Write audit log BEFORE deleting (so we still have the data)
      await paymentService.writeAuditLog({
        transactionId: deleteTxn.transactionId,
        transactionDocId: deleteTxn.id,
        action: 'transaction_deleted',
        ...actorInfo,
        note: `Transaction permanently deleted`,
        snapshotBefore: {
          transactionId: deleteTxn.transactionId,
          status: deleteTxn.status,
          amount: deleteTxn.amount,
          userName: deleteTxn.userName,
          productName: deleteTxn.productName,
        },
      });
      await paymentService.deleteTransactionById(deleteTxn.id);
      setTransactions(prev => prev.filter(t => t.id !== deleteTxn.id));
      setDeleteTxn(null);
      setSelectedTxn(null);
      showToast('Transaction deleted and audit log written.', 'success');
      // Refresh audit logs if that tab is active
      if (activeTab === 'audit') loadAuditLogs();
    } catch (e: any) {
      showToast(e.message || 'Delete failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Status change ──
  const handleStatusConfirm = async (newStatus: Transaction['status']) => {
    if (!statusTxn) return;
    setActionLoading(true);
    try {
      const changes = diff(statusTxn, { status: newStatus });
      await paymentService.writeAuditLog({
        transactionId: statusTxn.transactionId,
        transactionDocId: statusTxn.id,
        action: 'status_changed',
        ...actorInfo,
        changes,
        snapshotBefore: { status: statusTxn.status },
      });
      await paymentService.updateTransactionStatusById(statusTxn.id, newStatus);
      setTransactions(prev => prev.map(t => t.id === statusTxn.id ? { ...t, status: newStatus, updatedAt: new Date() } : t));
      // Also update the detail modal if open
      if (selectedTxn?.id === statusTxn.id) setSelectedTxn(prev => prev ? { ...prev, status: newStatus, updatedAt: new Date() } : null);
      setStatusTxn(null);
      showToast(`Status changed to "${STATUS_CFG[newStatus]?.label ?? newStatus}"`, 'success');
      if (activeTab === 'audit') loadAuditLogs();
    } catch (e: any) {
      showToast(e.message || 'Status update failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // ── CSV Export ──
  const handleExport = () => {
    const headers = ['Transaction ID', 'Doc ID', 'Status', 'Amount', 'Currency',
      'User Name', 'User Email', 'Auth UID', 'Readable User ID',
      'Product Name', 'Product ID', 'Product Type',
      'Gateway', 'Payment Method', 'Bank Txn ID', 'Validation ID', 'Risk Level',
      'Created At', 'Updated At', 'Completed At'];
    const rows = filtered.map(t => [
      t.transactionId, t.id, t.status, t.amount, t.currency,
      t.userName, t.userEmail, t.userId, readableIds[t.userId] ?? '',
      t.productName, t.productId, t.productType,
      t.gateway ?? '', t.paymentMethod ?? '', t.bankTransactionId ?? '', t.validationId ?? '', t.riskLevel ?? '',
      t.createdAt?.toISOString() ?? '', t.updatedAt?.toISOString() ?? '', t.completedAt?.toISOString() ?? '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: `transactions_${new Date().toISOString().slice(0, 10)}.csv` });
    a.click();
  };

  const SortBtn = ({ field, label }: { field: SortField; label: string }) => (
    <button onClick={() => handleSort(field)} className="flex items-center gap-1 group whitespace-nowrap">
      {label}
      <ArrowUpDown size={11} className={`${sortField === field ? 'text-primary-400' : 'text-gray-700 group-hover:text-gray-400'} transition-colors`} />
    </button>
  );

  // ── Access Denied ──
  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center space-y-3">
        <Shield size={40} className="text-red-400" />
        <h2 className="text-white font-semibold text-lg">Access Denied</h2>
        <p className="text-gray-500 text-sm max-w-xs">You do not have permission to view Payment Management.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader size={28} className="animate-spin text-primary-400" />
        <p className="text-gray-500 text-sm">Loading transactions…</p>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-10">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Payment Management</h1>
          <p className="text-xs text-gray-500 mt-0.5">{transactions.length.toLocaleString()} total transactions</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.07] text-gray-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-primary-600 hover:bg-primary-700 text-white transition-colors"
          >
            <Download size={13} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Global error */}
      {error && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm">
          <XCircle size={15} /> {error}
          <button onClick={() => setError('')} className="ml-auto"><X size={13} /></button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-white/5 gap-1">
        {([
          { id: 'transactions', label: 'Transactions', count: transactions.length },
          { id: 'gateways', label: 'Gateways', count: null },
          { id: 'reports', label: 'Reports', count: null },
          { id: 'audit', label: 'Audit Log', count: auditLogs.length || null },
        ] as { id: TabId; label: string; count: number | null }[]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === tab.id
                ? 'border-primary-500 text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab.label}
            {tab.count !== null && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-primary-500/20 text-primary-400' : 'bg-white/5 text-gray-500'}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══ TRANSACTIONS TAB ══ */}
      {activeTab === 'transactions' && (
        <div className="space-y-5">

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <StatCard label="Total" value={stats.total.toLocaleString()} Icon={Activity} accent="from-blue-500 to-cyan-500" />
            <StatCard label="Successful" value={stats.success.toLocaleString()} Icon={CheckCircle} accent="from-emerald-500 to-teal-500" />
            <StatCard label="Pending" value={stats.pending.toLocaleString()} Icon={Clock} accent="from-amber-500 to-orange-500" />
            <StatCard label="Failed" value={stats.failed.toLocaleString()} Icon={XCircle} accent="from-red-500 to-rose-500" />
            <StatCard
              label="Revenue"
              value={`৳${stats.revenue.toLocaleString('en-BD', { minimumFractionDigits: 0 })}`}
              sub="Successful only"
              Icon={TrendingUp}
              accent="from-violet-500 to-purple-500"
            />
          </div>

          {/* Search + filter toggle */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Search transaction ID, user, product, readable user ID…"
                value={filters.search}
                onChange={e => handleFilter('search', e.target.value)}
                className="w-full pl-9 pr-8 py-2.5 text-sm bg-white/[0.04] border border-white/10 text-white rounded-xl focus:outline-none focus:ring-1 focus:ring-primary-500 placeholder-gray-600"
              />
              {filters.search && (
                <button onClick={() => handleFilter('search', '')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"><X size={13} /></button>
              )}
            </div>
            <button
              onClick={() => setShowFilters(v => !v)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm rounded-xl border transition-colors ${showFilters ? 'border-primary-500/50 bg-primary-500/10 text-primary-400' : 'border-white/10 bg-white/[0.04] text-gray-400 hover:text-gray-200'}`}
            >
              <Filter size={13} />
              Filters
              {showFilters ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          </div>

          {showFilters && (
            <FiltersPanel filters={filters} onChange={handleFilter} onReset={() => { setFilters(DEFAULT_FILTERS); setPage(1); }} gateways={gateways} productTypes={productTypes} />
          )}

          {/* Results bar */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              {filtered.length.toLocaleString()} result{filtered.length !== 1 ? 's' : ''}
              {filtered.length !== transactions.length && ` (filtered from ${transactions.length.toLocaleString()})`}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600">Rows:</span>
              <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }} className="text-xs bg-white/[0.04] border border-white/10 text-gray-300 rounded-lg px-2 py-1 focus:outline-none">
                {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-xl border border-white/5 bg-[#0f1117] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 bg-white/[0.015]">
                    <th className="text-left px-4 py-3 text-[10px] text-gray-500 font-semibold uppercase tracking-wider"><SortBtn field="transactionId" label="TXN ID" /></th>
                    <th className="text-left px-4 py-3 text-[10px] text-gray-500 font-semibold uppercase tracking-wider">User ID</th>
                    <th className="text-left px-4 py-3 text-[10px] text-gray-500 font-semibold uppercase tracking-wider"><SortBtn field="userName" label="User" /></th>
                    <th className="text-left px-4 py-3 text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Product</th>
                    <th className="text-left px-4 py-3 text-[10px] text-gray-500 font-semibold uppercase tracking-wider"><SortBtn field="amount" label="Amount" /></th>
                    <th className="text-left px-4 py-3 text-[10px] text-gray-500 font-semibold uppercase tracking-wider"><SortBtn field="status" label="Status" /></th>
                    <th className="text-left px-4 py-3 text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Gateway</th>
                    <th className="text-left px-4 py-3 text-[10px] text-gray-500 font-semibold uppercase tracking-wider"><SortBtn field="createdAt" label="Date" /></th>
                    <th className="text-right px-4 py-3 text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-16 text-gray-600">
                        <DollarSign size={28} className="mx-auto mb-3 text-gray-700" />
                        No transactions match your filters.
                      </td>
                    </tr>
                  ) : paginated.map(txn => {
                    const rid = readableIds[txn.userId];
                    return (
                      <tr key={txn.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors group">
                        {/* TXN ID */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-[11px] text-gray-300">{trunc(txn.transactionId, 20)}</span>
                            <CopyBtn text={txn.transactionId} />
                          </div>
                        </td>

                        {/* User ID (readable) */}
                        <td className="px-4 py-3.5">
                          {rid === undefined ? (
                            <span className="text-gray-600 text-[11px]">…</span>
                          ) : rid ? (
                            <span className="font-mono text-[11px] text-emerald-400">{rid}</span>
                          ) : (
                            <span className="text-gray-600 text-[11px]">—</span>
                          )}
                        </td>

                        {/* User */}
                        <td className="px-4 py-3.5">
                          <p className="text-gray-200 text-xs font-medium">{txn.userName || '—'}</p>
                          <p className="text-gray-500 text-[10px]">{trunc(txn.userEmail || '', 22)}</p>
                        </td>

                        {/* Product */}
                        <td className="px-4 py-3.5">
                          <p className="text-gray-200 text-xs">{trunc(txn.productName || '—', 20)}</p>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.05] text-gray-500 capitalize">{txn.productType}</span>
                        </td>

                        {/* Amount */}
                        <td className="px-4 py-3.5">
                          <span className="text-white font-bold text-xs">৳{txn.amount.toLocaleString('en-BD', { minimumFractionDigits: 2 })}</span>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5"><StatusBadge status={txn.status} /></td>

                        {/* Gateway */}
                        <td className="px-4 py-3.5 text-gray-500 text-xs">{txn.gateway || '—'}</td>

                        {/* Date */}
                        <td className="px-4 py-3.5 text-gray-400 text-xs whitespace-nowrap">
                          {txn.createdAt ? fmtDate(txn.createdAt) : '—'}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => setSelectedTxn(txn)}
                              className="p-1.5 rounded-lg hover:bg-primary-500/10 text-gray-500 hover:text-primary-400 transition-colors"
                              title="View details"
                            >
                              <Eye size={13} />
                            </button>
                            {canModify && (
                              <>
                                <button
                                  onClick={() => setStatusTxn(txn)}
                                  className="p-1.5 rounded-lg hover:bg-blue-500/10 text-gray-500 hover:text-blue-400 transition-colors"
                                  title="Change status"
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  onClick={() => setDeleteTxn(txn)}
                                  className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
                <p className="text-xs text-gray-500">Page {page} of {totalPages} · {filtered.length.toLocaleString()} results</p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 disabled:opacity-30 transition-colors">
                    <ChevronLeft size={15} />
                  </button>
                  {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                    const p = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page + i - 3;
                    if (p < 1 || p > totalPages) return null;
                    return (
                      <button key={p} onClick={() => setPage(p)} className={`w-7 h-7 text-xs rounded-lg transition-colors ${p === page ? 'bg-primary-500 text-white' : 'text-gray-400 hover:bg-white/5'}`}>{p}</button>
                    );
                  })}
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 disabled:opacity-30 transition-colors">
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ GATEWAYS TAB ══ */}
      {activeTab === 'gateways' && (
        <div className="rounded-xl border border-white/5 bg-[#0f1117] p-6 space-y-4">
          <p className="text-sm text-gray-500">Gateway configuration is managed server-side via environment variables. Below is a live summary derived from your transaction history.</p>
          {gateways.length === 0 ? (
            <p className="text-gray-600 text-sm py-8 text-center">No gateways detected in transaction history.</p>
          ) : (
            <div className="space-y-3">
              {gateways.map(gw => {
                const count = transactions.filter(t => t.gateway === gw).length;
                const rev = transactions.filter(t => t.gateway === gw && t.status === 'success').reduce((s, t) => s + t.amount, 0);
                const successRate = count > 0 ? Math.round((transactions.filter(t => t.gateway === gw && t.status === 'success').length / count) * 100) : 0;
                return (
                  <div key={gw} className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-lg bg-primary-500/10 border border-primary-500/20">
                        <CreditCard size={16} className="text-primary-400" />
                      </div>
                      <div>
                        <p className="text-white font-semibold text-sm">{gw}</p>
                        <p className="text-xs text-gray-500">{count} transaction{count !== 1 ? 's' : ''} · {successRate}% success rate</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-bold">৳{rev.toLocaleString('en-BD', { minimumFractionDigits: 2 })}</p>
                      <p className="text-xs text-gray-500">Collected revenue</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══ REPORTS TAB ══ */}
      {activeTab === 'reports' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: 'Full Transaction Report', desc: 'All transactions, all statuses', fn: () => transactions, file: 'all_transactions', Icon: Activity, cls: 'text-blue-400' },
              { label: 'Successful Payments', desc: 'Revenue-generating transactions only', fn: () => transactions.filter(t => t.status === 'success'), file: 'successful', Icon: CheckCircle, cls: 'text-emerald-400' },
              { label: 'Failed & Cancelled', desc: 'Transactions that did not complete', fn: () => transactions.filter(t => ['failed', 'cancelled'].includes(t.status)), file: 'failed_cancelled', Icon: XCircle, cls: 'text-red-400' },
              { label: 'Pending & Validating', desc: 'In-progress transactions', fn: () => transactions.filter(t => ['pending', 'validating'].includes(t.status)), file: 'pending', Icon: Clock, cls: 'text-amber-400' },
              { label: 'Refunded', desc: 'Refunded transaction records', fn: () => transactions.filter(t => t.status === 'refunded'), file: 'refunded', Icon: RotateCcw, cls: 'text-purple-400' },
              { label: 'Filtered View Export', desc: 'Export currently applied filters', fn: () => filtered, file: 'filtered_export', Icon: Filter, cls: 'text-primary-400' },
            ].map(({ label, desc, fn, file, Icon, cls }) => (
              <button
                key={label}
                onClick={() => {
                  const data = fn();
                  const headers = ['Transaction ID', 'Status', 'Amount', 'Currency', 'User Name', 'User Email', 'Auth UID', 'Readable User ID', 'Product Name', 'Product ID', 'Product Type', 'Gateway', 'Created At', 'Completed At'];
                  const rows = data.map(t => [t.transactionId, t.status, t.amount, t.currency, t.userName, t.userEmail, t.userId, readableIds[t.userId] ?? '', t.productName, t.productId, t.productType, t.gateway, t.createdAt?.toISOString() ?? '', t.completedAt?.toISOString() ?? '']);
                  const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
                  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: `${file}_${new Date().toISOString().slice(0, 10)}.csv` });
                  a.click();
                }}
                className="text-left p-5 rounded-xl border border-white/5 bg-[#0f1117] hover:bg-white/[0.04] transition-colors group"
              >
                <div className={`mb-3 ${cls}`}><Icon size={20} /></div>
                <p className="text-white font-semibold text-sm group-hover:text-primary-300 transition-colors">{label}</p>
                <p className="text-xs text-gray-500 mt-1">{desc}</p>
                <p className="text-xs text-primary-600 mt-3 flex items-center gap-1"><Download size={11} /> Download CSV</p>
              </button>
            ))}
          </div>

          {/* Revenue breakdown */}
          <div className="rounded-xl border border-white/5 bg-[#0f1117] p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Revenue Breakdown by Status</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {ALL_STATUSES.map(st => {
                const list = transactions.filter(t => t.status === st);
                const total = list.reduce((s, t) => s + t.amount, 0);
                return (
                  <div key={st} className="space-y-2">
                    <StatusBadge status={st} />
                    <p className="text-lg font-bold text-white">৳{total.toLocaleString('en-BD', { minimumFractionDigits: 0 })}</p>
                    <p className="text-[11px] text-gray-500">{list.length} txn{list.length !== 1 ? 's' : ''}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══ AUDIT LOG TAB ══ */}
      {activeTab === 'audit' && (
        <AuditLogTab
          logs={auditLogs}
          loading={auditLoading}
          error={auditError}
          onRefresh={loadAuditLogs}
        />
      )}

      {/* ══ MODALS ══ */}

      {selectedTxn && (
        <DetailModal
          txn={selectedTxn}
          readableUserId={readableIds[selectedTxn.userId] ?? null}
          onClose={() => setSelectedTxn(null)}
          onDelete={() => { setDeleteTxn(selectedTxn); setSelectedTxn(null); }}
          onChangeStatus={() => { setStatusTxn(selectedTxn); setSelectedTxn(null); }}
          canModify={canModify}
        />
      )}

      {deleteTxn && (
        <ConfirmDeleteModal
          txn={deleteTxn}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTxn(null)}
          loading={actionLoading}
        />
      )}

      {statusTxn && (
        <StatusChangeModal
          txn={statusTxn}
          onConfirm={handleStatusConfirm}
          onCancel={() => setStatusTxn(null)}
          loading={actionLoading}
        />
      )}

      {/* Toast */}
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

    </div>
  );
};

export default PaymentManagement;
