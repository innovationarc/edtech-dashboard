// src/pages/PaymentManagement.tsx

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  CreditCard, Search, Download, RefreshCw, Loader,
  ChevronDown, ChevronUp, X, CheckCircle, XCircle, Clock,
  AlertTriangle, TrendingUp, DollarSign, Activity, Filter,
  Eye, Copy, Check, Shield, ArrowUpDown, ChevronLeft,
  ChevronRight, Trash2, Edit2, ClipboardList, AlertCircle,
  Info, RotateCcw, Ban, ArrowRight, BarChart2, PieChart,
  BookOpen, Phone, Tag, History, Undo2,
} from 'lucide-react';
import {
  paymentService,
  Transaction,
  TrashRecord,
  AuditLog,
  AuditAction,
} from '../services/paymentService';
import { useDashboard } from '../contexts/DashboardContext';

// ─── Constants ───────────────────────────────────────────────────────────────

const ALLOWED_ROLES = ['admin', 'manager', 'course_manager', 'student_manager', 'coordinator'];
const POWER_ROLES = ['admin', 'manager'];
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const ALL_STATUSES = ['success', 'failed', 'pending', 'validating', 'refunded', 'cancelled'] as const;

// ─── Types ───────────────────────────────────────────────────────────────────

type SortField = 'createdAt' | 'amount' | 'status' | 'transactionId' | 'userName';
type SortDir = 'asc' | 'desc';
type TabId = 'transactions' | 'gateways' | 'reports' | 'audit' | 'statistics' | 'trash';

interface Filters {
  search: string;
  status: string;
  gateway: string;
  productType: string;
  courseId: string;
  dateFrom: string;
  dateTo: string;
  amountMin: string;
  amountMax: string;
}

const DEFAULT_FILTERS: Filters = {
  search: '', status: 'all', gateway: 'all',
  productType: 'all', courseId: 'all', dateFrom: '', dateTo: '',
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

function isFilterActive(f: Filters) {
  return f.search !== '' || f.status !== 'all' || f.gateway !== 'all' ||
    f.productType !== 'all' || f.courseId !== 'all' || f.dateFrom !== '' ||
    f.dateTo !== '' || f.amountMin !== '' || f.amountMax !== '';
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
  status_changed:                 { label: 'Status Changed',         cls: 'text-blue-400',   Icon: Edit2 },
  transaction_deleted:            { label: 'Transaction Deleted',    cls: 'text-red-400',    Icon: Trash2 },
  transaction_moved_to_trash:     { label: 'Moved to Trash',         cls: 'text-orange-400', Icon: Trash2 },
  transaction_restored_from_trash:{ label: 'Restored from Trash',    cls: 'text-emerald-400',Icon: Undo2 },
  transaction_purged:             { label: 'Auto-Purged',            cls: 'text-gray-400',   Icon: Ban },
  transaction_viewed:             { label: 'Viewed',                 cls: 'text-gray-400',   Icon: Eye },
  transaction_created:            { label: 'Created',                cls: 'text-emerald-400',Icon: CheckCircle },
  transaction_updated:            { label: 'Updated',                cls: 'text-amber-400',  Icon: Edit2 },
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

// ─── Confirm Delete Modal (now asks for reason, explains trash) ───────────────

const ConfirmDeleteModal = ({
  txn, onConfirm, onCancel, loading,
}: { txn: Transaction; onConfirm: (reason: string) => void; onCancel: () => void; loading: boolean }) => {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const isValid = reason.trim().length >= 5;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }}>
      <div className="w-full max-w-md rounded-2xl border border-red-500/20 bg-[#0d0f14] shadow-2xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-full bg-red-500/15 border border-red-500/30">
            <Trash2 size={18} className="text-red-400" />
          </div>
          <div>
            <h3 className="text-white font-bold text-base">Move to Trash</h3>
            <p className="text-xs text-gray-500 mt-0.5">Transaction will be moved to trash for 30 days</p>
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
        {/* Mandatory Reason */}
        <div>
          <label className="text-xs text-gray-400 font-medium mb-1.5 block">
            Reason for deletion <span className="text-red-400">*</span>
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="Explain why this transaction is being removed…"
            rows={3}
            className={`w-full bg-white/[0.04] border rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 resize-none transition-colors ${touched && !isValid ? 'border-red-500/50 focus:ring-red-500' : 'border-white/10 focus:ring-primary-500'}`}
          />
          {touched && !isValid && (
            <p className="text-xs text-red-400 mt-1">Reason must be at least 5 characters.</p>
          )}
        </div>
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
          <History size={13} />
          Record will be kept in Trash for 30 days, then auto-purged. All actions are audit-logged.
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={loading} className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm hover:bg-white/5 transition-colors disabled:opacity-50">Cancel</button>
          <button
            onClick={() => { setTouched(true); if (isValid) onConfirm(reason.trim()); }}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader size={14} className="animate-spin" /> : <Trash2 size={14} />}
            {loading ? 'Moving…' : 'Move to Trash'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Status Change Modal (now asks for mandatory reason) ─────────────────────

const StatusChangeModal = ({
  txn, onConfirm, onCancel, loading,
}: { txn: Transaction; onConfirm: (newStatus: Transaction['status'], reason: string) => void; onCancel: () => void; loading: boolean }) => {
  const [selected, setSelected] = useState<Transaction['status']>(txn.status);
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const isValid = reason.trim().length >= 5;

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
            Changing from <StatusBadge status={txn.status} /> to <StatusBadge status={selected} />. This will be logged.
          </div>
        )}

        {/* Mandatory Reason */}
        <div>
          <label className="text-xs text-gray-400 font-medium mb-1.5 block">
            Reason for status change <span className="text-red-400">*</span>
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="Explain why the status is being changed…"
            rows={3}
            className={`w-full bg-white/[0.04] border rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 resize-none transition-colors ${touched && !isValid ? 'border-red-500/50 focus:ring-red-500' : 'border-white/10 focus:ring-primary-500'}`}
          />
          {touched && !isValid && (
            <p className="text-xs text-red-400 mt-1">Reason must be at least 5 characters.</p>
          )}
        </div>

        <div className="flex gap-3">
          <button onClick={onCancel} disabled={loading} className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm hover:bg-white/5 transition-colors disabled:opacity-50">Cancel</button>
          <button
            onClick={() => { setTouched(true); if (isValid && selected !== txn.status) onConfirm(selected, reason.trim()); }}
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
  txn, readableUserId, userPhone, onClose, onDelete, onChangeStatus, canModify,
}: {
  txn: Transaction;
  readableUserId: string | null;
  userPhone: string | null;
  onClose: () => void;
  onDelete: () => void;
  onChangeStatus: () => void;
  canModify: boolean;
}) => {
  const disc = txn.appliedDiscounts;
  const rows: [string, React.ReactNode][] = [
    ['Transaction ID',  <span className="flex items-center font-mono text-xs">{txn.transactionId}<CopyBtn text={txn.transactionId} /></span>],
    ['Status',          <StatusBadge status={txn.status} />],
    ['Amount Paid',     <span className="text-white font-bold">৳{txn.amount.toLocaleString('en-BD', { minimumFractionDigits: 2 })} {txn.currency}</span>],
  ];

  // Show base price if available
  if (txn.basePrice !== undefined && txn.basePrice !== null) {
    rows.push(['Base Price', <span className="text-gray-200">৳{txn.basePrice.toLocaleString('en-BD', { minimumFractionDigits: 2 })}</span>]);
  }

  rows.push(
    ['Gateway',         txn.gateway || '—'],
    ['Payment Method',  txn.paymentMethod || '—'],
    ['Bank Txn ID',     txn.bankTransactionId || '—'],
    ['Validation ID',   txn.validationId || '—'],
    ['Risk Level',      txn.riskLevel || '—'],
    ['User Name',       txn.userName || '—'],
    ['Phone Number',    userPhone
      ? <span className="flex items-center gap-1"><Phone size={11} className="text-primary-400" />{userPhone}<CopyBtn text={userPhone} /></span>
      : <span className="text-gray-500 text-xs">—</span>],
    ['User ID (Readable)', readableUserId
      ? <span className="flex items-center gap-1 font-mono text-emerald-400">{readableUserId}<CopyBtn text={readableUserId} /></span>
      : <span className="text-gray-500 text-xs">Loading…</span>],
    ['Product Name',    txn.productName || '—'],
    ['Product ID',      txn.productId || '—'],
    ['Product Type',    txn.productType || '—'],
    ['Created At',      fmtDate(txn.createdAt)],
    ['Updated At',      fmtDate(txn.updatedAt)],
    ['Completed At',    fmtDate(txn.completedAt)],
  );

  // Discounts — always show in taka; use basePrice from field or metadata fallback
  const effectiveBasePrice: number | null =
    (txn.basePrice !== undefined && txn.basePrice !== null)
      ? txn.basePrice
      : (txn.metadata?.basePrice !== undefined && txn.metadata?.basePrice !== null)
        ? Number(txn.metadata.basePrice)
        : null;

  const discTaka = (pct: number): React.ReactNode => {
    if (effectiveBasePrice !== null && effectiveBasePrice > 0) {
      const taka = effectiveBasePrice * pct / 100;
      return <span>৳{taka.toLocaleString('en-BD', { minimumFractionDigits: 2 })} <span className="text-gray-500 text-xs">({pct}%)</span></span>;
    }
    // Fallback: compute from amount difference if possible, else show just the number as taka
    return <span>৳{pct.toLocaleString('en-BD', { minimumFractionDigits: 2 })}</span>;
  };

  if (disc?.couponCode) {
    rows.push(['Coupon Used', <span className="flex items-center gap-1"><Tag size={11} className="text-amber-400" /><span className="font-mono text-amber-400">{disc.couponCode}</span></span>]);
  }
  // Also check metadata for coupon code
  if (!disc?.couponCode && txn.metadata?.appliedCoupons) {
    try {
      const coupons = typeof txn.metadata.appliedCoupons === 'string'
        ? JSON.parse(txn.metadata.appliedCoupons)
        : txn.metadata.appliedCoupons;
      if (Array.isArray(coupons) && coupons.length > 0) {
        const codes = coupons.map((c: any) => c.couponCode ?? c.couponId ?? '').filter(Boolean).join(', ');
        if (codes) rows.push(['Coupon Used', <span className="flex items-center gap-1"><Tag size={11} className="text-amber-400" /><span className="font-mono text-amber-400">{codes}</span></span>]);
      }
    } catch {}
  }
  if (disc?.couponDiscount) {
    rows.push(['Coupon Discount', discTaka(disc.couponDiscount)]);
  }
  if (disc?.previousStudentDiscount) {
    rows.push(['Returning Student Disc.', discTaka(disc.previousStudentDiscount)]);
  }
  if (disc?.extraDiscount) {
    rows.push(['Extra Discount', discTaka(disc.extraDiscount)]);
  }

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

interface AuditFilters {
  search: string;
  action: string;
  dateFrom: string;
  dateTo: string;
  role: string;
  performedBy: string;
  gateway: string;
  courseId: string;
}

const DEFAULT_AUDIT_FILTERS: AuditFilters = { search: '', action: 'all', dateFrom: '', dateTo: '', role: 'all', performedBy: 'all', gateway: 'all', courseId: 'all' };

const AuditLogTab = ({ logs, loading, error, onRefresh, auditFilters, onAuditFilterChange, onAuditFilterReset }: {
  logs: AuditLog[];
  loading: boolean;
  error: string;
  onRefresh: () => void;
  auditFilters: AuditFilters;
  onAuditFilterChange: (k: keyof AuditFilters, v: string) => void;
  onAuditFilterReset: () => void;
}) => {
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => logs.filter(l => {
    const q = auditFilters.search.toLowerCase();
    const matchSearch = !q || l.transactionId.toLowerCase().includes(q) || l.performedByName.toLowerCase().includes(q) || l.performedByRole.toLowerCase().includes(q) || (l.performedByUserId ?? '').toLowerCase().includes(q);
    const matchAction = auditFilters.action === 'all' || l.action === auditFilters.action;
    const matchRole = auditFilters.role === 'all' || l.performedByRole === auditFilters.role;
    const matchPerformedBy = auditFilters.performedBy === 'all' || l.performedByUserId === auditFilters.performedBy || l.performedByName === auditFilters.performedBy;
    const matchGateway = auditFilters.gateway === 'all' || (l as any).gateway === auditFilters.gateway;
    const matchCourse = auditFilters.courseId === 'all' || (l as any).productId === auditFilters.courseId;
    let matchDate = true;
    if (auditFilters.dateFrom) { const d = new Date(auditFilters.dateFrom); matchDate = matchDate && (l.timestamp >= d); }
    if (auditFilters.dateTo) { const d = new Date(auditFilters.dateTo); d.setHours(23, 59, 59, 999); matchDate = matchDate && (l.timestamp <= d); }
    return matchSearch && matchAction && matchRole && matchPerformedBy && matchGateway && matchCourse && matchDate;
  }), [logs, auditFilters]);

  const allRoles = useMemo(() => [...new Set(logs.map(l => l.performedByRole).filter(Boolean))], [logs]);
  const allActors = useMemo(() => {
    const seen = new Map<string, string>();
    logs.forEach(l => {
      const key = l.performedByUserId || l.performedByName;
      if (key && !seen.has(key)) seen.set(key, l.performedBySurname || l.performedByName);
    });
    return Array.from(seen.entries()).map(([key, label]) => ({ key, label }));
  }, [logs]);
  const allGateways = useMemo(() => [...new Set(logs.map(l => (l as any).gateway).filter(Boolean))], [logs]);
  const allCourses = useMemo(() => {
    const seen = new Map<string, string>();
    logs.forEach(l => { if ((l as any).productId && (l as any).productName && !seen.has((l as any).productId)) seen.set((l as any).productId, (l as any).productName); });
    return Array.from(seen.entries()).map(([productId, productName]) => ({ productId, productName }));
  }, [logs]);

  const isAuditFilterActive = auditFilters.search !== '' || auditFilters.action !== 'all' || auditFilters.dateFrom !== '' || auditFilters.dateTo !== '' || auditFilters.role !== 'all' || auditFilters.performedBy !== 'all' || auditFilters.gateway !== 'all' || auditFilters.courseId !== 'all';

  const inputCls = 'bg-white/[0.04] border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary-500 placeholder-gray-600';
  const sel = 'bg-white/[0.04] border border-white/10 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary-500 [color-scheme:dark]';

  const handleDownloadCSV = () => {
    const headers = ['Timestamp', 'Action', 'Transaction ID', 'Performed By', 'Readable User ID', 'Role', 'Reason', 'Note', 'Changes'];
    const rows = filtered.map(l => [
      l.timestamp?.toISOString() ?? '',
      AUDIT_CFG[l.action]?.label ?? l.action,
      l.transactionId,
      l.performedBySurname || l.performedByName,
      l.performedByUserId ?? '',
      l.performedByRole,
      l.reason ?? '',
      l.note ?? '',
      l.changes ? l.changes.map(c => `${c.field}: ${c.oldValue}→${c.newValue}`).join('; ') : '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: `audit_log_filtered_${new Date().toISOString().slice(0, 10)}.csv` });
    a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-primary-400" />
          <h3 className="text-white font-semibold text-sm">Security Audit Log</h3>
          <span className="text-xs text-gray-500 bg-white/[0.04] px-2 py-0.5 rounded-full">{filtered.length} entries</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadCSV}
            className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.04] text-gray-300 hover:text-white transition-colors"
            title="Download filtered audit log as CSV"
          >
            <Download size={13} /> Export CSV
          </button>
          <button onClick={onRefresh} disabled={loading} className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.04] text-gray-300 hover:text-white transition-colors disabled:opacity-50">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Search + filter toggle */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input type="text" placeholder="Search by transaction ID, actor name, role, user ID…" value={auditFilters.search} onChange={e => onAuditFilterChange('search', e.target.value)} className={`${inputCls} pl-9 w-full`} />
          {auditFilters.search && (
            <button onClick={() => onAuditFilterChange('search', '')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"><X size={13} /></button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(v => !v)}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm rounded-xl border transition-colors ${showFilters ? 'border-primary-500/50 bg-primary-500/10 text-primary-400' : 'border-white/10 bg-white/[0.04] text-gray-400 hover:text-gray-200'}`}
        >
          <Filter size={13} />
          Filters
          {isAuditFilterActive && <span className="w-1.5 h-1.5 rounded-full bg-primary-400" />}
          {showFilters ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="rounded-xl border border-white/5 bg-[#0f1117] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-400 flex items-center gap-1.5"><Filter size={12} className="text-primary-400" /> Audit Log Filters</p>
            <button onClick={onAuditFilterReset} className="text-xs text-gray-600 hover:text-gray-300 transition-colors">Reset all</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-[10px] text-gray-600 mb-1 block uppercase tracking-wider">Action</label>
              <select value={auditFilters.action} onChange={e => onAuditFilterChange('action', e.target.value)} className={`${sel} w-full`}>
                <option value="all">All Actions</option>
                {Object.entries(AUDIT_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-600 mb-1 block uppercase tracking-wider">Role</label>
              <select value={auditFilters.role} onChange={e => onAuditFilterChange('role', e.target.value)} className={`${sel} w-full`}>
                <option value="all">All Roles</option>
                {allRoles.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-600 mb-1 block uppercase tracking-wider">Performed By</label>
              <select value={auditFilters.performedBy} onChange={e => onAuditFilterChange('performedBy', e.target.value)} className={`${sel} w-full`}>
                <option value="all">All Actors</option>
                {allActors.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-600 mb-1 block uppercase tracking-wider flex items-center gap-1"><BookOpen size={9} /> Course</label>
              <select value={auditFilters.courseId} onChange={e => onAuditFilterChange('courseId', e.target.value)} className={`${sel} w-full`}>
                <option value="all">All Courses</option>
                {allCourses.map(c => <option key={c.productId} value={c.productId}>{trunc(c.productName, 28)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-600 mb-1 block uppercase tracking-wider">Gateway</label>
              <select value={auditFilters.gateway} onChange={e => onAuditFilterChange('gateway', e.target.value)} className={`${sel} w-full`}>
                <option value="all">All Gateways</option>
                {allGateways.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-600 mb-1 block uppercase tracking-wider">Date From</label>
              <input type="date" value={auditFilters.dateFrom} onChange={e => onAuditFilterChange('dateFrom', e.target.value)} className={`${sel} w-full`} />
            </div>
            <div>
              <label className="text-[10px] text-gray-600 mb-1 block uppercase tracking-wider">Date To</label>
              <input type="date" value={auditFilters.dateTo} onChange={e => onAuditFilterChange('dateTo', e.target.value)} className={`${sel} w-full`} />
            </div>
          </div>
        </div>
      )}

      {isAuditFilterActive && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-500/10 border border-primary-500/20 text-xs text-primary-300">
          <Filter size={12} />
          Filter active — showing {filtered.length} of {logs.length} audit entries.
          <button onClick={onAuditFilterReset} className="ml-auto text-primary-400 hover:text-primary-200 font-medium">Clear filters</button>
        </div>
      )}

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
                        by{' '}
                        <span className="text-gray-300 font-medium">
                          {log.performedBySurname
                            ? log.performedBySurname
                            : log.performedByName}
                        </span>
                        {log.performedByUserId && (
                          <span className="font-mono text-emerald-500 ml-1">({log.performedByUserId})</span>
                        )}
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

                {/* Reason */}
                {log.reason && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/8 border border-amber-500/15 text-xs text-amber-300">
                    <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                    <span><span className="font-semibold">Reason: </span>{log.reason}</span>
                  </div>
                )}

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
  filters, onChange, onReset, gateways, productTypes, courses,
}: {
  filters: Filters;
  onChange: (k: keyof Filters, v: string) => void;
  onReset: () => void;
  gateways: string[];
  productTypes: string[];
  courses: { productId: string; productName: string }[];
}) => {
  const sel = 'w-full bg-white/[0.04] border border-white/10 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary-500 [color-scheme:dark]';
  return (
    <div className="rounded-xl border border-white/5 bg-[#0f1117] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-400 flex items-center gap-1.5"><Filter size={12} className="text-primary-400" /> Advanced Filters</p>
        <button onClick={onReset} className="text-xs text-gray-600 hover:text-gray-300 transition-colors">Reset all</button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-2">
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
        <div className="col-span-2 sm:col-span-1">
          <label className="text-[10px] text-gray-600 mb-1 block uppercase tracking-wider flex items-center gap-1"><BookOpen size={9} /> Course</label>
          <select value={filters.courseId} onChange={e => onChange('courseId', e.target.value)} className={sel}>
            <option value="all">All Courses</option>
            {courses.map(c => <option key={c.productId} value={c.productId}>{trunc(c.productName, 30)}</option>)}
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

// ─── Statistics Tab ───────────────────────────────────────────────────────────

// SVG Bar Chart — always renders bars and labels; hover shows enhanced tooltip
const SvgBarChart = ({
  data, color, height = 180, yLabel,
}: {
  data: { label: string; value: number; subLabel?: string }[];
  color: string;
  height?: number;
  yLabel?: string;
}) => {
  const [hovered, setHovered] = useState<number | null>(null);
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const padTop = 28;
  const padBottom = 32;
  const padLeft = 8;
  const padRight = 8;
  const chartH = height - padTop - padBottom;
  const barCount = data.length;
  const barGap = 4;

  // Y-axis guide lines
  const guideCount = 4;
  const guides = Array.from({ length: guideCount + 1 }, (_, i) => {
    const val = (maxVal / guideCount) * i;
    const y = padTop + chartH - (chartH * (val / maxVal));
    return { val, y };
  });

  return (
    <div className="relative w-full" style={{ height }}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${Math.max(barCount * 40, 300)} ${height}`}
        preserveAspectRatio="none"
        className="w-full"
      >
        {/* Guide lines */}
        {guides.map((g, i) => (
          <g key={i}>
            <line
              x1={padLeft} y1={g.y}
              x2={`100%`} y2={g.y}
              stroke="rgba(255,255,255,0.04)"
              strokeWidth="1"
            />
            {g.val > 0 && (
              <text
                x={padLeft}
                y={g.y - 3}
                fontSize="8"
                fill="rgba(156,163,175,0.6)"
                textAnchor="start"
              >
                ৳{g.val >= 1000 ? `${(g.val / 1000).toFixed(0)}k` : g.val.toFixed(0)}
              </text>
            )}
          </g>
        ))}

        {/* Bars */}
        {data.map((d, i) => {
          const totalW = Math.max(barCount * 40, 300);
          const slotW = totalW / barCount;
          const barW = Math.max(slotW - barGap * 2, 4);
          const x = i * slotW + barGap;
          const barH = maxVal > 0 ? Math.max((d.value / maxVal) * chartH, d.value > 0 ? 3 : 0) : 0;
          const y = padTop + chartH - barH;
          const isHov = hovered === i;

          return (
            <g key={i} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} style={{ cursor: 'pointer' }}>
              {/* Bar background track */}
              <rect
                x={x} y={padTop}
                width={barW} height={chartH}
                rx="3" ry="3"
                fill="rgba(255,255,255,0.03)"
              />
              {/* Actual bar */}
              <rect
                x={x} y={y}
                width={barW} height={Math.max(barH, 0)}
                rx="3" ry="3"
                fill={isHov ? color.replace('0.8', '1') : color}
                opacity={isHov ? 1 : 0.85}
              />
              {/* Value label on top of bar — always visible when bar is tall enough */}
              {barH > 18 && (
                <text
                  x={x + barW / 2}
                  y={y + 11}
                  fontSize="8"
                  fill="rgba(255,255,255,0.9)"
                  textAnchor="middle"
                  fontWeight="600"
                >
                  {d.value >= 1000 ? `৳${(d.value / 1000).toFixed(0)}k` : `৳${d.value}`}
                </text>
              )}
              {/* X-axis label */}
              <text
                x={x + barW / 2}
                y={height - 4}
                fontSize="8"
                fill={isHov ? 'rgba(156,163,175,0.9)' : 'rgba(156,163,175,0.5)'}
                textAnchor="middle"
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Floating tooltip on hover */}
      {hovered !== null && data[hovered] && (() => {
        const d = data[hovered];
        return (
          <div
            className="absolute pointer-events-none z-20 bg-[#1a1d27] border border-white/15 rounded-lg px-3 py-2 shadow-2xl text-xs"
            style={{
              bottom: padBottom + 4,
              left: `${(hovered / data.length) * 100}%`,
              transform: hovered > data.length / 2 ? 'translateX(-100%)' : 'translateX(8px)',
              minWidth: 100,
            }}
          >
            <p className="text-white font-bold">৳{d.value.toLocaleString('en-BD', { maximumFractionDigits: 0 })}</p>
            {d.subLabel && <p className="text-gray-400 mt-0.5">{d.subLabel}</p>}
            <p className="text-gray-500">{d.label}</p>
          </div>
        );
      })()}
    </div>
  );
};

// SVG Line Chart — smooth sparkline with filled area
const SvgLineChart = ({
  data, height = 140,
}: {
  data: { label: string; value: number; subLabel?: string }[];
  height?: number;
}) => {
  const [hovered, setHovered] = useState<number | null>(null);
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const minVal = 0;
  const padTop = 20;
  const padBottom = 28;
  const padLeft = 10;
  const padRight = 10;
  const W = 600;
  const chartH = height - padTop - padBottom;
  const chartW = W - padLeft - padRight;
  const step = chartW / Math.max(data.length - 1, 1);

  const pts = data.map((d, i) => ({
    x: padLeft + i * step,
    y: padTop + chartH - ((d.value - minVal) / (maxVal - minVal)) * chartH,
  }));

  // Build smooth polyline path
  const pointsStr = pts.map(p => `${p.x},${p.y}`).join(' ');
  // Area fill path
  const areaPath = pts.length > 0
    ? `M${pts[0].x},${padTop + chartH} ` +
      pts.map(p => `L${p.x},${p.y}`).join(' ') +
      ` L${pts[pts.length - 1].x},${padTop + chartH} Z`
    : '';

  return (
    <div className="relative w-full" style={{ height }}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${W} ${height}`}
        preserveAspectRatio="none"
        className="w-full"
      >
        <defs>
          <linearGradient id="lineAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(139,92,246)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="rgb(139,92,246)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {/* Guide lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
          const y = padTop + chartH * (1 - f);
          const val = minVal + (maxVal - minVal) * f;
          return (
            <g key={i}>
              <line x1={padLeft} y1={y} x2={W - padRight} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
              {f > 0 && (
                <text x={padLeft} y={y - 2} fontSize="8" fill="rgba(156,163,175,0.5)" textAnchor="start">
                  ৳{val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val.toFixed(0)}
                </text>
              )}
            </g>
          );
        })}
        {/* Area fill */}
        {areaPath && <path d={areaPath} fill="url(#lineAreaGrad)" />}
        {/* Line */}
        {pts.length > 1 && (
          <polyline
            points={pointsStr}
            fill="none"
            stroke="rgb(139,92,246)"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {/* Data points */}
        {pts.map((p, i) => {
          const d = data[i];
          const isHov = hovered === i;
          return (
            <g key={i} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} style={{ cursor: 'pointer' }}>
              {/* Hover hit area */}
              <rect
                x={p.x - step / 2} y={padTop}
                width={step} height={chartH}
                fill="transparent"
              />
              {/* Dot */}
              <circle cx={p.x} cy={p.y} r={isHov ? 5 : 3} fill="rgb(139,92,246)" stroke="#0d0f14" strokeWidth="2" />
              {/* Always-visible value label above point if enough room */}
              {d.value > 0 && (
                <text
                  x={p.x}
                  y={p.y - 8}
                  fontSize="7.5"
                  fill="rgba(167,139,250,0.85)"
                  textAnchor="middle"
                  fontWeight="600"
                >
                  {d.value >= 1000 ? `৳${(d.value / 1000).toFixed(0)}k` : `৳${d.value}`}
                </text>
              )}
              {/* X label */}
              <text
                x={p.x}
                y={height - 4}
                fontSize="7.5"
                fill={isHov ? 'rgba(156,163,175,0.9)' : 'rgba(156,163,175,0.5)'}
                textAnchor="middle"
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {hovered !== null && data[hovered] && (() => {
        const d = data[hovered];
        return (
          <div
            className="absolute pointer-events-none z-20 bg-[#1a1d27] border border-white/15 rounded-lg px-3 py-2 shadow-2xl text-xs"
            style={{
              bottom: padBottom + 4,
              left: `${(hovered / (data.length - 1)) * 100}%`,
              transform: hovered > data.length / 2 ? 'translateX(-100%)' : 'translateX(8px)',
              minWidth: 110,
            }}
          >
            <p className="text-white font-bold">৳{d.value.toLocaleString('en-BD', { maximumFractionDigits: 0 })}</p>
            {d.subLabel && <p className="text-gray-400 mt-0.5">{d.subLabel}</p>}
            <p className="text-gray-500">{d.label}</p>
          </div>
        );
      })()}
    </div>
  );
};

const StatisticsTab = ({ transactions }: { transactions: Transaction[] }) => {
  const stats = useMemo(() => {
    const success = transactions.filter(t => t.status === 'success');
    const failed = transactions.filter(t => t.status === 'failed');
    const pending = transactions.filter(t => t.status === 'pending');
    const refunded = transactions.filter(t => t.status === 'refunded');
    const cancelled = transactions.filter(t => t.status === 'cancelled');
    const validating = transactions.filter(t => t.status === 'validating');

    const totalRevenue = success.reduce((s, t) => s + t.amount, 0);
    const avgOrder = success.length > 0 ? totalRevenue / success.length : 0;
    const successRate = transactions.length > 0 ? (success.length / transactions.length) * 100 : 0;
    const refundRate = success.length > 0 ? (refunded.length / success.length) * 100 : 0;

    // Revenue by month (last 12 months)
    const now = new Date();
    const monthlyRevenue: { month: string; revenue: number; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = new Intl.DateTimeFormat('en-BD', { month: 'short', year: '2-digit' }).format(d);
      const monthTxns = success.filter(t => {
        const td = t.createdAt;
        return td.getFullYear() === d.getFullYear() && td.getMonth() === d.getMonth();
      });
      monthlyRevenue.push({ month: label, revenue: monthTxns.reduce((s, t) => s + t.amount, 0), count: monthTxns.length });
    }

    // Top products by revenue
    const productRevenue = new Map<string, { name: string; revenue: number; count: number }>();
    success.forEach(t => {
      const existing = productRevenue.get(t.productId) ?? { name: t.productName, revenue: 0, count: 0 };
      productRevenue.set(t.productId, { name: t.productName, revenue: existing.revenue + t.amount, count: existing.count + 1 });
    });
    const topProducts = Array.from(productRevenue.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    // Revenue by gateway
    const gatewayRevenue = new Map<string, { revenue: number; count: number; failed: number }>();
    transactions.forEach(t => {
      const gw = t.gateway || 'Unknown';
      const existing = gatewayRevenue.get(gw) ?? { revenue: 0, count: 0, failed: 0 };
      gatewayRevenue.set(gw, {
        revenue: existing.revenue + (t.status === 'success' ? t.amount : 0),
        count: existing.count + 1,
        failed: existing.failed + (t.status === 'failed' ? 1 : 0),
      });
    });

    // Revenue by day of week
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayRevenue = Array(7).fill(0).map((_, i) => ({
      day: dayLabels[i],
      revenue: success.filter(t => t.createdAt.getDay() === i).reduce((s, t) => s + t.amount, 0),
      count: success.filter(t => t.createdAt.getDay() === i).length,
    }));

    return {
      totalRevenue, avgOrder, successRate, refundRate,
      counts: { success: success.length, failed: failed.length, pending: pending.length, refunded: refunded.length, cancelled: cancelled.length, validating: validating.length },
      monthlyRevenue, topProducts, gatewayRevenue: Array.from(gatewayRevenue.entries()).map(([gw, d]) => ({ gateway: gw, ...d })),
      dayRevenue, totalCount: transactions.length,
    };
  }, [transactions]);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Revenue" value={`৳${stats.totalRevenue.toLocaleString('en-BD', { maximumFractionDigits: 0 })}`} sub="From successful payments" Icon={TrendingUp} accent="from-violet-500 to-purple-600" />
        <StatCard label="Avg. Order Value" value={`৳${stats.avgOrder.toLocaleString('en-BD', { maximumFractionDigits: 0 })}`} sub="Successful txns only" Icon={DollarSign} accent="from-blue-500 to-cyan-500" />
        <StatCard label="Success Rate" value={`${stats.successRate.toFixed(1)}%`} sub={`${stats.counts.success} of ${stats.totalCount} txns`} Icon={CheckCircle} accent="from-emerald-500 to-teal-500" />
        <StatCard label="Refund Rate" value={`${stats.refundRate.toFixed(1)}%`} sub={`${stats.counts.refunded} refunds`} Icon={RotateCcw} accent="from-red-500 to-rose-500" />
      </div>

      {/* Status Distribution */}
      <div className="rounded-xl border border-white/5 bg-[#0f1117] p-5">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><PieChart size={15} className="text-primary-400" /> Transaction Status Distribution</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {ALL_STATUSES.map(st => {
            const count = stats.counts[st as keyof typeof stats.counts] ?? 0;
            const pct = stats.totalCount > 0 ? (count / stats.totalCount * 100).toFixed(1) : '0.0';
            return (
              <div key={st} className="rounded-xl border border-white/5 bg-white/[0.02] p-4 space-y-2">
                <StatusBadge status={st} />
                <p className="text-xl font-bold text-white">{count.toLocaleString()}</p>
                <p className="text-[11px] text-gray-500">{pct}% of total</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Monthly Revenue — SVG Line Chart */}
      <div className="rounded-xl border border-white/5 bg-[#0f1117] p-5">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><BarChart2 size={15} className="text-primary-400" /> Monthly Revenue (Last 12 Months)</h3>
        <SvgLineChart
          height={180}
          data={stats.monthlyRevenue.map(m => ({
            label: m.month,
            value: m.revenue,
            subLabel: `${m.count} txn${m.count !== 1 ? 's' : ''}`,
          }))}
        />
      </div>

      {/* Revenue by Day of Week — SVG Bar Chart */}
      <div className="rounded-xl border border-white/5 bg-[#0f1117] p-5">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><Activity size={15} className="text-primary-400" /> Revenue by Day of Week</h3>
        <SvgBarChart
          height={160}
          color="rgba(52,211,153,0.8)"
          data={stats.dayRevenue.map(d => ({
            label: d.day,
            value: d.revenue,
            subLabel: `${d.count} txn${d.count !== 1 ? 's' : ''}`,
          }))}
        />
      </div>

      {/* Top Products & Gateway Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Products */}
        <div className="rounded-xl border border-white/5 bg-[#0f1117] p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><TrendingUp size={15} className="text-primary-400" /> Top Products by Revenue</h3>
          {stats.topProducts.length === 0 ? (
            <p className="text-gray-600 text-sm py-4 text-center">No successful transactions yet.</p>
          ) : (
            <div className="space-y-3">
              {stats.topProducts.map((p, i) => {
                const pct = stats.totalRevenue > 0 ? (p.revenue / stats.totalRevenue * 100) : 0;
                return (
                  <div key={i} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-200 font-medium truncate flex-1 mr-2">{p.name}</span>
                      <span className="text-white font-bold shrink-0">৳{p.revenue.toLocaleString('en-BD', { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-primary-600 to-primary-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[10px] text-gray-600">{p.count} sale{p.count !== 1 ? 's' : ''} · {pct.toFixed(1)}% of revenue</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Gateway Performance */}
        <div className="rounded-xl border border-white/5 bg-[#0f1117] p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><CreditCard size={15} className="text-primary-400" /> Gateway Performance</h3>
          {stats.gatewayRevenue.length === 0 ? (
            <p className="text-gray-600 text-sm py-4 text-center">No gateway data yet.</p>
          ) : (
            <div className="space-y-3">
              {stats.gatewayRevenue.map((g, i) => {
                const successRate = g.count > 0 ? ((g.count - g.failed) / g.count * 100).toFixed(1) : '0.0';
                return (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/[0.02]">
                    <div>
                      <p className="text-white font-semibold text-sm">{g.gateway}</p>
                      <p className="text-[10px] text-gray-500">{g.count} txns · {successRate}% success</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-bold text-sm">৳{g.revenue.toLocaleString('en-BD', { maximumFractionDigits: 0 })}</p>
                      <p className="text-[10px] text-gray-500">Revenue</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Conversion Funnel */}
      <div className="rounded-xl border border-white/5 bg-[#0f1117] p-5">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><Activity size={15} className="text-primary-400" /> Payment Conversion Funnel</h3>
        <div className="space-y-2">
          {[
            { label: 'Initiated (All)', count: stats.totalCount, color: 'bg-blue-500' },
            { label: 'Validating', count: stats.counts.validating + stats.counts.success + stats.counts.refunded, color: 'bg-cyan-500' },
            { label: 'Successful', count: stats.counts.success, color: 'bg-emerald-500' },
          ].map((f) => {
            const pct = stats.totalCount > 0 ? (f.count / stats.totalCount) * 100 : 0;
            return (
              <div key={f.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">{f.label}</span>
                  <span className="text-white font-semibold">{f.count.toLocaleString()} <span className="text-gray-500 font-normal">({pct.toFixed(1)}%)</span></span>
                </div>
                <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
                  <div className={`h-full ${f.color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── Trash Tab ────────────────────────────────────────────────────────────────

interface TrashFilters {
  search: string;
  status: string;
  gateway: string;
  dateFrom: string;
  dateTo: string;
  courseId: string;
  deletedBy: string;
}

const DEFAULT_TRASH_FILTERS: TrashFilters = { search: '', status: 'all', gateway: 'all', dateFrom: '', dateTo: '', courseId: 'all', deletedBy: 'all' };

const TrashTab = ({
  trashRecords, loading, error, onRefresh, onRestore, canModify,
  trashFilters, onTrashFilterChange, onTrashFilterReset,
}: {
  trashRecords: TrashRecord[];
  loading: boolean;
  error: string;
  onRefresh: () => void;
  onRestore: (record: TrashRecord) => void;
  canModify: boolean;
  trashFilters: TrashFilters;
  onTrashFilterChange: (k: keyof TrashFilters, v: string) => void;
  onTrashFilterReset: () => void;
}) => {
  const [showFilters, setShowFilters] = useState(false);
  const [viewRecord, setViewRecord] = useState<TrashRecord | null>(null);

  const trashGateways = useMemo(() => [...new Set(trashRecords.map(r => r.transaction.gateway).filter(Boolean))], [trashRecords]);
  const trashCourses = useMemo(() => {
    const seen = new Map<string, string>();
    trashRecords.forEach(r => { if (r.transaction.productId && r.transaction.productName && !seen.has(r.transaction.productId)) seen.set(r.transaction.productId, r.transaction.productName); });
    return Array.from(seen.entries()).map(([productId, productName]) => ({ productId, productName }));
  }, [trashRecords]);
  const trashActors = useMemo(() => {
    const seen = new Map<string, string>();
    trashRecords.forEach(r => {
      const key = r.deletedByUserId || r.deletedByName;
      if (key && !seen.has(key)) seen.set(key, r.deletedBySurname || r.deletedByName);
    });
    return Array.from(seen.entries()).map(([key, label]) => ({ key, label }));
  }, [trashRecords]);

  const filtered = useMemo(() => {
    return trashRecords.filter(r => {
      const q = trashFilters.search.toLowerCase();
      const matchSearch = !q ||
        r.transaction.transactionId?.toLowerCase().includes(q) ||
        r.transaction.userName?.toLowerCase().includes(q) ||
        r.deletedByName?.toLowerCase().includes(q) ||
        r.deletedBySurname?.toLowerCase().includes(q) ||
        r.deletedByUserId?.toLowerCase().includes(q);
      const matchStatus = trashFilters.status === 'all' || r.transaction.status === trashFilters.status;
      const matchGateway = trashFilters.gateway === 'all' || r.transaction.gateway === trashFilters.gateway;
      const matchCourse = trashFilters.courseId === 'all' || r.transaction.productId === trashFilters.courseId;
      const matchDeletedBy = trashFilters.deletedBy === 'all' || r.deletedByUserId === trashFilters.deletedBy || r.deletedByName === trashFilters.deletedBy;
      let matchDate = true;
      if (trashFilters.dateFrom) { const d = new Date(trashFilters.dateFrom); matchDate = matchDate && (r.deletedAt >= d); }
      if (trashFilters.dateTo) { const d = new Date(trashFilters.dateTo); d.setHours(23, 59, 59, 999); matchDate = matchDate && (r.deletedAt <= d); }
      return matchSearch && matchStatus && matchGateway && matchCourse && matchDeletedBy && matchDate;
    });
  }, [trashRecords, trashFilters]);

  const isTrashFilterActive = trashFilters.search !== '' || trashFilters.status !== 'all' || trashFilters.gateway !== 'all' || trashFilters.dateFrom !== '' || trashFilters.dateTo !== '' || trashFilters.courseId !== 'all' || trashFilters.deletedBy !== 'all';
  const sel = 'bg-white/[0.04] border border-white/10 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary-500 [color-scheme:dark]';

  return (
    <div className="space-y-4">
      {/* Trash Detail Modal */}
      {viewRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}>
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-red-500/20 bg-[#0d0f14] shadow-2xl">
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#0d0f14]">
              <div>
                <div className="flex items-center gap-2">
                  <Trash2 size={14} className="text-red-400" />
                  <h2 className="text-white font-bold text-base">Deleted Transaction</h2>
                </div>
                <p className="text-[11px] text-gray-500 font-mono mt-0.5">{trunc(viewRecord.transaction.transactionId, 40)}</p>
              </div>
              <button onClick={() => setViewRecord(null)} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Deletion metadata banner */}
              <div className="rounded-xl border border-red-500/20 bg-red-500/8 p-4 space-y-2">
                <p className="text-xs font-semibold text-red-400 flex items-center gap-1.5"><Trash2 size={12} /> Deletion Info</p>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-gray-600">Deleted by</span>
                    <p className="text-gray-200 font-medium mt-0.5">
                      {viewRecord.deletedBySurname
                        ? viewRecord.deletedBySurname
                        : viewRecord.deletedByName}
                    </p>
                    {viewRecord.deletedByUserId
                      ? <p className="font-mono text-emerald-400 text-[10px]">({viewRecord.deletedByUserId})</p>
                      : null}
                    <p className="text-gray-500 text-[10px]">{viewRecord.deletedByRole}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Deleted at</span>
                    <p className="text-gray-200 mt-0.5">{fmtDate(viewRecord.deletedAt)}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Auto-purge</span>
                    <p className="text-gray-200 mt-0.5">{fmtDate(viewRecord.expiresAt)}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Days remaining</span>
                    <p className={`mt-0.5 font-semibold ${Math.max(0, Math.ceil((viewRecord.expiresAt.getTime() - Date.now()) / 86400000)) <= 5 ? 'text-red-400' : 'text-gray-200'}`}>
                      {Math.max(0, Math.ceil((viewRecord.expiresAt.getTime() - Date.now()) / 86400000))} days
                    </p>
                  </div>
                </div>
                {viewRecord.reason && (
                  <div className="flex items-start gap-2 mt-1 p-2.5 rounded-lg bg-amber-500/8 border border-amber-500/15 text-xs text-amber-300">
                    <AlertTriangle size={11} className="shrink-0 mt-0.5" />
                    <span><span className="font-semibold">Reason: </span>{viewRecord.reason}</span>
                  </div>
                )}
              </div>

              {/* Transaction fields table */}
              <div className="space-y-0 rounded-xl overflow-hidden border border-white/5">
                {([
                  ['Transaction ID', <span className="flex items-center gap-1 font-mono text-xs">{viewRecord.transaction.transactionId}<CopyBtn text={viewRecord.transaction.transactionId} /></span>],
                  ['Status', <StatusBadge status={viewRecord.transaction.status} />],
                  ['Amount Paid', <span className="text-white font-bold">৳{viewRecord.transaction.amount?.toLocaleString('en-BD', { minimumFractionDigits: 2 })} {viewRecord.transaction.currency}</span>],
                  ...(viewRecord.transaction.basePrice != null ? [['Base Price', `৳${viewRecord.transaction.basePrice?.toLocaleString('en-BD', { minimumFractionDigits: 2 })}`]] : []),
                  ['Gateway', viewRecord.transaction.gateway || '—'],
                  ['Payment Method', viewRecord.transaction.paymentMethod || '—'],
                  ['Bank Txn ID', viewRecord.transaction.bankTransactionId || '—'],
                  ['Validation ID', viewRecord.transaction.validationId || '—'],
                  ['Risk Level', viewRecord.transaction.riskLevel ?? '—'],
                  ['User Name', viewRecord.transaction.userName || '—'],
                  ['Product Name', viewRecord.transaction.productName || '—'],
                  ['Product ID', viewRecord.transaction.productId || '—'],
                  ['Product Type', viewRecord.transaction.productType || '—'],
                  ['Created At', fmtDate(viewRecord.transaction.createdAt)],
                  ['Updated At', fmtDate(viewRecord.transaction.updatedAt)],
                  ['Completed At', fmtDate(viewRecord.transaction.completedAt)],
                  ...(viewRecord.transaction.appliedDiscounts?.couponCode ? [['Coupon Used', <span className="flex items-center gap-1"><Tag size={11} className="text-amber-400" /><span className="font-mono text-amber-400">{viewRecord.transaction.appliedDiscounts.couponCode}</span></span>]] : []),
                ] as [string, React.ReactNode][]).map(([label, value], i) => (
                  <div key={i} className={`flex items-start justify-between gap-4 px-4 py-3 text-xs ${i % 2 === 0 ? 'bg-white/[0.015]' : 'bg-transparent'}`}>
                    <span className="text-gray-500 shrink-0 w-36">{label}</span>
                    <span className="text-gray-200 text-right break-all">{value}</span>
                  </div>
                ))}
              </div>

              {/* Metadata section */}
              {viewRecord.transaction.metadata && Object.keys(viewRecord.transaction.metadata).length > 0 && (
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                  <p className="text-[10px] text-gray-600 uppercase tracking-widest font-medium mb-2">Metadata</p>
                  <pre className="text-[10px] text-gray-400 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                    {JSON.stringify(viewRecord.transaction.metadata, null, 2)}
                  </pre>
                </div>
              )}

              {/* Footer actions */}
              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <button onClick={() => setViewRecord(null)} className="px-4 py-2 rounded-xl border border-white/10 text-gray-400 text-sm hover:bg-white/5 transition-colors">
                  Close
                </button>
                {canModify && (
                  <button
                    onClick={() => { onRestore(viewRecord); setViewRecord(null); }}
                    className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                  >
                    <Undo2 size={13} /> Restore Transaction
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <Trash2 size={16} className="text-red-400" />
          <h3 className="text-white font-semibold text-sm">Trash</h3>
          <span className="text-xs text-gray-500 bg-white/[0.04] px-2 py-0.5 rounded-full">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
        </div>
        <button onClick={onRefresh} disabled={loading} className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.04] text-gray-300 hover:text-white transition-colors disabled:opacity-50">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/8 border border-amber-500/15 text-xs text-amber-400">
        <History size={13} />
        Records in trash are automatically purged 30 days after deletion. No manual cleanup is possible before the 30-day period. All deletions and purges are audit-logged.
      </div>

      {/* Search + filter toggle */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search by transaction ID, user, deleted by…"
            value={trashFilters.search}
            onChange={e => onTrashFilterChange('search', e.target.value)}
            className="w-full pl-9 pr-8 py-2.5 text-sm bg-white/[0.04] border border-white/10 text-white rounded-xl focus:outline-none focus:ring-1 focus:ring-primary-500 placeholder-gray-600"
          />
          {trashFilters.search && (
            <button onClick={() => onTrashFilterChange('search', '')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"><X size={13} /></button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(v => !v)}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm rounded-xl border transition-colors ${showFilters ? 'border-primary-500/50 bg-primary-500/10 text-primary-400' : 'border-white/10 bg-white/[0.04] text-gray-400 hover:text-gray-200'}`}
        >
          <Filter size={13} />
          Filters
          {isTrashFilterActive && <span className="w-1.5 h-1.5 rounded-full bg-primary-400" />}
          {showFilters ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="rounded-xl border border-white/5 bg-[#0f1117] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-400 flex items-center gap-1.5"><Filter size={12} className="text-primary-400" /> Trash Filters</p>
            <button onClick={onTrashFilterReset} className="text-xs text-gray-600 hover:text-gray-300 transition-colors">Reset all</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-[10px] text-gray-600 mb-1 block uppercase tracking-wider">Status</label>
              <select value={trashFilters.status} onChange={e => onTrashFilterChange('status', e.target.value)} className={`${sel} w-full`}>
                <option value="all">All</option>
                {ALL_STATUSES.map(s => <option key={s} value={s}>{STATUS_CFG[s].label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-600 mb-1 block uppercase tracking-wider">Gateway</label>
              <select value={trashFilters.gateway} onChange={e => onTrashFilterChange('gateway', e.target.value)} className={`${sel} w-full`}>
                <option value="all">All</option>
                {trashGateways.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-600 mb-1 block uppercase tracking-wider flex items-center gap-1"><BookOpen size={9} /> Course</label>
              <select value={trashFilters.courseId} onChange={e => onTrashFilterChange('courseId', e.target.value)} className={`${sel} w-full`}>
                <option value="all">All Courses</option>
                {trashCourses.map(c => <option key={c.productId} value={c.productId}>{trunc(c.productName, 28)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-600 mb-1 block uppercase tracking-wider">Deleted By</label>
              <select value={trashFilters.deletedBy} onChange={e => onTrashFilterChange('deletedBy', e.target.value)} className={`${sel} w-full`}>
                <option value="all">All Users</option>
                {trashActors.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-600 mb-1 block uppercase tracking-wider">Deleted From</label>
              <input type="date" value={trashFilters.dateFrom} onChange={e => onTrashFilterChange('dateFrom', e.target.value)} className={`${sel} w-full`} />
            </div>
            <div>
              <label className="text-[10px] text-gray-600 mb-1 block uppercase tracking-wider">Deleted To</label>
              <input type="date" value={trashFilters.dateTo} onChange={e => onTrashFilterChange('dateTo', e.target.value)} className={`${sel} w-full`} />
            </div>
          </div>
        </div>
      )}

      {isTrashFilterActive && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-500/10 border border-primary-500/20 text-xs text-primary-300">
          <Filter size={12} />
          Filter active — showing {filtered.length} of {trashRecords.length} trash records.
          <button onClick={onTrashFilterReset} className="ml-auto text-primary-400 hover:text-primary-200 font-medium">Clear filters</button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          <XCircle size={14} /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-gray-500">
          <Loader size={20} className="animate-spin" /> Loading trash…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-600">
          <Trash2 size={32} className="mb-3 text-gray-700" />
          <p className="text-sm">Trash is empty.</p>
          <p className="text-xs mt-1">Deleted transactions will appear here for 30 days.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((record) => {
            const daysLeft = Math.max(0, Math.ceil((record.expiresAt.getTime() - Date.now()) / 86400000));
            const isExpiringSoon = daysLeft <= 5;
            return (
              <div key={record.id} className="rounded-xl border border-white/5 bg-[#0f1117] p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <p className="text-white font-semibold text-sm">{record.transaction.userName}</p>
                    <p className="text-gray-400 font-mono text-xs truncate">{trunc(record.transaction.transactionId, 36)}</p>
                    <p className="text-xs text-gray-500">{record.transaction.productName}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className="text-white font-bold text-sm">৳{record.transaction.amount.toLocaleString('en-BD', { minimumFractionDigits: 2 })}</span>
                    <StatusBadge status={record.transaction.status} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-600">Deleted by</span>
                    <p className="text-gray-300 font-medium mt-0.5">
                      {record.deletedBySurname
                        ? record.deletedBySurname
                        : record.deletedByName}
                    </p>
                    {record.deletedByUserId
                      ? <p className="font-mono text-emerald-400 text-[10px]">({record.deletedByUserId})</p>
                      : null}
                    <p className="text-gray-600 text-[10px]">{record.deletedByRole}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Deleted at</span>
                    <p className="text-gray-300 mt-0.5">{fmtDate(record.deletedAt)}</p>
                  </div>
                </div>

                {record.reason && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-white/[0.03] border border-white/5 text-xs text-gray-400">
                    <AlertTriangle size={11} className="shrink-0 mt-0.5 text-amber-500" />
                    <span><span className="text-gray-300 font-medium">Reason: </span>{record.reason}</span>
                  </div>
                )}

                <div className="flex items-center justify-between gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full border ${isExpiringSoon ? 'text-red-400 bg-red-500/10 border-red-500/20' : 'text-gray-500 bg-white/[0.03] border-white/5'}`}>
                    {daysLeft === 0 ? 'Purging soon…' : `Auto-purge in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`}
                  </span>
                  <div className="flex items-center gap-2">
                    {/* View full details */}
                    <button
                      onClick={() => setViewRecord(record)}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-colors"
                    >
                      <Eye size={12} /> View
                    </button>
                    {canModify && (
                      <button
                        onClick={() => onRestore(record)}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                      >
                        <Undo2 size={12} /> Restore
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
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
  const [phoneNumbers, setPhoneNumbers] = useState<Record<string, string | null>>({});
  const fetchingUids = useRef(new Set<string>());
  const fetchingPhones = useRef(new Set<string>());

  // ── Courses list for course filter ──
  const [courses, setCourses] = useState<{ productId: string; productName: string }[]>([]);

  // ── Audit log ──
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState('');
  const [auditFilters, setAuditFilters] = useState<AuditFilters>(DEFAULT_AUDIT_FILTERS);

  // ── Trash ──
  const [trashRecords, setTrashRecords] = useState<TrashRecord[]>([]);
  const [trashLoading, setTrashLoading] = useState(false);
  const [trashError, setTrashError] = useState('');
  const [trashFilters, setTrashFilters] = useState<TrashFilters>(DEFAULT_TRASH_FILTERS);

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
    performedBySurname: userProfile?.surname ?? '',
    performedByUserId: userProfile?.userId ?? '',
    performedByRole: userProfile?.role ?? 'unknown',
  }), [userProfile]);

  // ── Load transactions ──
  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    setError('');
    try {
      const data = await paymentService.getAllTransactions();
      setTransactions(data);
      // Build course list from transaction data
      const seen = new Map<string, string>();
      data.forEach(t => { if (t.productId && t.productName && !seen.has(t.productId)) seen.set(t.productId, t.productName); });
      setCourses(Array.from(seen.entries()).map(([productId, productName]) => ({ productId, productName })));
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

  // ── Load trash ──
  const loadTrash = useCallback(async () => {
    setTrashLoading(true);
    setTrashError('');
    try {
      const records = await paymentService.getTrashTransactions();
      setTrashRecords(records);
    } catch (e: any) {
      setTrashError(e.message || 'Failed to load trash');
    } finally {
      setTrashLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasAccess) {
      loadData();
      // Silently purge expired trash on load
      paymentService.purgeExpiredTrash().catch(() => {});
    }
  }, [hasAccess, loadData]);

  useEffect(() => {
    if (hasAccess && activeTab === 'audit') loadAuditLogs();
  }, [hasAccess, activeTab, loadAuditLogs]);

  useEffect(() => {
    if (hasAccess && activeTab === 'trash') loadTrash();
  }, [hasAccess, activeTab, loadTrash]);

  // ── Fetch readable userId for visible transactions ──
  useEffect(() => {
    const uids = transactions.map(t => t.userId).filter(uid => uid && !(uid in readableIds) && !fetchingUids.current.has(uid));
    if (uids.length === 0) return;
    uids.forEach(uid => fetchingUids.current.add(uid));
    Promise.allSettled(
      uids.map(uid => paymentService.getReadableUserId(uid).then(rid => ({ uid, rid })))
    ).then(results => {
      const updates: Record<string, string | null> = {};
      results.forEach(r => { if (r.status === 'fulfilled') updates[r.value.uid] = r.value.rid; });
      setReadableIds(prev => ({ ...prev, ...updates }));
    });
  }, [transactions]);

  // ── Fetch phone numbers for visible transactions ──
  useEffect(() => {
    const uids = transactions.map(t => t.userId).filter(uid => uid && !(uid in phoneNumbers) && !fetchingPhones.current.has(uid));
    if (uids.length === 0) return;
    uids.forEach(uid => fetchingPhones.current.add(uid));
    Promise.allSettled(
      uids.map(uid => paymentService.getUserPhone(uid).then(phone => ({ uid, phone })))
    ).then(results => {
      const updates: Record<string, string | null> = {};
      results.forEach(r => { if (r.status === 'fulfilled') updates[r.value.uid] = r.value.phone; });
      setPhoneNumbers(prev => ({ ...prev, ...updates }));
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
    if (filters.courseId !== 'all') list = list.filter(t => t.productId === filters.courseId);
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

  // ── Filtered audit logs (for reports CSV) ──
  const filteredAuditLogs = useMemo(() => auditLogs.filter(l => {
    const q = auditFilters.search.toLowerCase();
    const matchSearch = !q || l.transactionId.toLowerCase().includes(q) || l.performedByName.toLowerCase().includes(q) || l.performedByRole.toLowerCase().includes(q) || (l.performedByUserId ?? '').toLowerCase().includes(q);
    const matchAction = auditFilters.action === 'all' || l.action === auditFilters.action;
    const matchRole = auditFilters.role === 'all' || l.performedByRole === auditFilters.role;
    const matchPerformedBy = auditFilters.performedBy === 'all' || l.performedByUserId === auditFilters.performedBy || l.performedByName === auditFilters.performedBy;
    const matchGateway = auditFilters.gateway === 'all' || (l as any).gateway === auditFilters.gateway;
    const matchCourse = auditFilters.courseId === 'all' || (l as any).productId === auditFilters.courseId;
    let matchDate = true;
    if (auditFilters.dateFrom) { const d = new Date(auditFilters.dateFrom); matchDate = matchDate && (l.timestamp >= d); }
    if (auditFilters.dateTo) { const d = new Date(auditFilters.dateTo); d.setHours(23, 59, 59, 999); matchDate = matchDate && (l.timestamp <= d); }
    return matchSearch && matchAction && matchRole && matchPerformedBy && matchGateway && matchCourse && matchDate;
  }), [auditLogs, auditFilters]);

  // ── Filtered trash records (for reports CSV) ──
  const filteredTrashRecords = useMemo(() => trashRecords.filter(r => {
    const q = trashFilters.search.toLowerCase();
    const matchSearch = !q || r.transaction.transactionId?.toLowerCase().includes(q) || r.transaction.userName?.toLowerCase().includes(q) || r.deletedByName?.toLowerCase().includes(q) || r.deletedBySurname?.toLowerCase().includes(q) || r.deletedByUserId?.toLowerCase().includes(q);
    const matchStatus = trashFilters.status === 'all' || r.transaction.status === trashFilters.status;
    const matchGateway = trashFilters.gateway === 'all' || r.transaction.gateway === trashFilters.gateway;
    const matchCourse = trashFilters.courseId === 'all' || r.transaction.productId === trashFilters.courseId;
    const matchDeletedBy = trashFilters.deletedBy === 'all' || r.deletedByUserId === trashFilters.deletedBy || r.deletedByName === trashFilters.deletedBy;
    let matchDate = true;
    if (trashFilters.dateFrom) { const d = new Date(trashFilters.dateFrom); matchDate = matchDate && (r.deletedAt >= d); }
    if (trashFilters.dateTo) { const d = new Date(trashFilters.dateTo); d.setHours(23, 59, 59, 999); matchDate = matchDate && (r.deletedAt <= d); }
    return matchSearch && matchStatus && matchGateway && matchCourse && matchDeletedBy && matchDate;
  }), [trashRecords, trashFilters]);

  // Stats — always based on full transactions (no filter) for the global cards,
  // OR filtered if filter is active
  const filterActive = isFilterActive(filters);
  const statsSource = filterActive ? filtered : transactions;

  const stats = useMemo(() => {
    const success = statsSource.filter(t => t.status === 'success');
    return {
      total: statsSource.length,
      success: success.length,
      pending: statsSource.filter(t => t.status === 'pending').length,
      failed: statsSource.filter(t => t.status === 'failed').length,
      // Revenue = actual amount paid (not base price), same as before
      revenue: success.reduce((s, t) => s + t.amount, 0),
    };
  }, [statsSource]);

  // ── Handlers ──
  const handleFilter = (k: keyof Filters, v: string) => { setFilters(f => ({ ...f, [k]: v })); setPage(1); };
  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
    setPage(1);
  };

  // ── Delete → Trash ──
  const handleDeleteConfirm = async (reason: string) => {
    if (!deleteTxn) return;
    setActionLoading(true);
    try {
      await paymentService.moveTransactionToTrash(
        deleteTxn,
        { uid: actorInfo.performedBy, name: actorInfo.performedByName, role: actorInfo.performedByRole, surname: actorInfo.performedBySurname, userId: actorInfo.performedByUserId },
        reason
      );
      setTransactions(prev => prev.filter(t => t.id !== deleteTxn.id));
      setDeleteTxn(null);
      setSelectedTxn(null);
      showToast('Transaction moved to trash. Auto-purge in 30 days.', 'success');
      if (activeTab === 'audit') loadAuditLogs();
      if (activeTab === 'trash') loadTrash();
    } catch (e: any) {
      showToast(e.message || 'Delete failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Status change ──
  const handleStatusConfirm = async (newStatus: Transaction['status'], reason: string) => {
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
        reason,
        snapshotBefore: { status: statusTxn.status },
        note: `Status changed from "${statusTxn.status}" to "${newStatus}". Reason: ${reason}`,
      });
      await paymentService.updateTransactionStatusById(statusTxn.id, newStatus);
      setTransactions(prev => prev.map(t => t.id === statusTxn.id ? { ...t, status: newStatus, updatedAt: new Date() } : t));
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

  // ── Restore from trash ──
  const handleRestore = async (record: TrashRecord) => {
    setActionLoading(true);
    try {
      await paymentService.restoreTransactionFromTrash(
        record,
        { uid: actorInfo.performedBy, name: actorInfo.performedByName, role: actorInfo.performedByRole, surname: actorInfo.performedBySurname, userId: actorInfo.performedByUserId }
      );
      setTrashRecords(prev => prev.filter(r => r.id !== record.id));
      showToast('Transaction restored successfully.', 'success');
      loadData(true);
      if (activeTab === 'audit') loadAuditLogs();
    } catch (e: any) {
      showToast(e.message || 'Restore failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // ── CSV Export ──
  const handleExport = () => {
    const headers = ['Transaction ID', 'Doc ID', 'Status', 'Amount', 'Base Price', 'Currency',
      'User Name', 'User Phone', 'Readable User ID',
      'Product Name', 'Product ID', 'Product Type',
      'Gateway', 'Payment Method', 'Bank Txn ID', 'Validation ID', 'Risk Level',
      'Coupon Code', 'Coupon Discount %', 'Returning Student Disc %', 'Extra Disc %',
      'Created At', 'Updated At', 'Completed At'];
    const rows = filtered.map(t => [
      t.transactionId, t.id, t.status, t.amount, t.basePrice ?? '', t.currency,
      t.userName, phoneNumbers[t.userId] ?? '', readableIds[t.userId] ?? '',
      t.productName, t.productId, t.productType,
      t.gateway ?? '', t.paymentMethod ?? '', t.bankTransactionId ?? '', t.validationId ?? '', t.riskLevel ?? '',
      t.appliedDiscounts?.couponCode ?? '', t.appliedDiscounts?.couponDiscount ?? '',
      t.appliedDiscounts?.previousStudentDiscount ?? '', t.appliedDiscounts?.extraDiscount ?? '',
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
      <div className="flex border-b border-white/5 gap-1 overflow-x-auto">
        {([
          { id: 'transactions', label: 'Transactions', count: transactions.length },
          { id: 'gateways', label: 'Gateways', count: null },
          { id: 'reports', label: 'Reports', count: null },
          { id: 'statistics', label: 'Statistics', count: null },
          { id: 'audit', label: 'Audit Log', count: auditLogs.length || null },
          { id: 'trash', label: 'Trash', count: trashRecords.length || null },
        ] as { id: TabId; label: string; count: number | null }[]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
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

          {/* Filter active banner */}
          {filterActive && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-500/10 border border-primary-500/20 text-xs text-primary-300">
              <Filter size={12} />
              Filter active — stats below reflect the current filtered view.
              <button onClick={() => { setFilters(DEFAULT_FILTERS); setPage(1); }} className="ml-auto text-primary-400 hover:text-primary-200 font-medium">Clear filters</button>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <StatCard
              label={filterActive ? 'Filtered Total' : 'Total'}
              value={stats.total.toLocaleString()}
              sub={filterActive ? `of ${transactions.length.toLocaleString()} total` : undefined}
              Icon={Activity}
              accent="from-blue-500 to-cyan-500"
            />
            <StatCard
              label={filterActive ? 'Filtered Successful' : 'Successful'}
              value={stats.success.toLocaleString()}
              Icon={CheckCircle}
              accent="from-emerald-500 to-teal-500"
            />
            <StatCard
              label={filterActive ? 'Filtered Pending' : 'Pending'}
              value={stats.pending.toLocaleString()}
              Icon={Clock}
              accent="from-amber-500 to-orange-500"
            />
            <StatCard
              label={filterActive ? 'Filtered Failed' : 'Failed'}
              value={stats.failed.toLocaleString()}
              Icon={XCircle}
              accent="from-red-500 to-rose-500"
            />
            <StatCard
              label={filterActive ? 'Filtered Revenue' : 'Revenue'}
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
              {filterActive && <span className="w-1.5 h-1.5 rounded-full bg-primary-400" />}
              {showFilters ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          </div>

          {showFilters && (
            <FiltersPanel
              filters={filters}
              onChange={handleFilter}
              onReset={() => { setFilters(DEFAULT_FILTERS); setPage(1); }}
              gateways={gateways}
              productTypes={productTypes}
              courses={courses}
            />
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

                        {/* User (name + phone) */}
                        <td className="px-4 py-3.5">
                          <p className="text-gray-200 text-xs font-medium">{txn.userName || '—'}</p>
                          <p className="text-gray-500 text-[10px] flex items-center gap-1">
                            {phoneNumbers[txn.userId]
                              ? <><Phone size={9} className="text-gray-600" />{phoneNumbers[txn.userId]}</>
                              : <span className="text-gray-700">No phone</span>}
                          </p>
                        </td>

                        {/* Product */}
                        <td className="px-4 py-3.5">
                          <p className="text-gray-200 text-xs">{trunc(txn.productName || '—', 20)}</p>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.05] text-gray-500 capitalize">{txn.productType}</span>
                        </td>

                        {/* Amount */}
                        <td className="px-4 py-3.5">
                          <span className="text-white font-bold text-xs">৳{txn.amount.toLocaleString('en-BD', { minimumFractionDigits: 2 })}</span>
                          {txn.appliedDiscounts?.couponCode && (
                            <p className="text-[10px] text-amber-500 flex items-center gap-0.5 mt-0.5">
                              <Tag size={9} />{txn.appliedDiscounts.couponCode}
                            </p>
                          )}
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
                                  title="Move to trash"
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
                  const headers = ['Transaction ID', 'Status', 'Amount', 'Base Price', 'Currency', 'User Name', 'User Phone', 'Readable User ID', 'Product Name', 'Product ID', 'Product Type', 'Gateway', 'Coupon Code', 'Coupon Discount %', 'Created At', 'Completed At'];
                  const rows = data.map(t => [t.transactionId, t.status, t.amount, t.basePrice ?? '', t.currency, t.userName, phoneNumbers[t.userId] ?? '', readableIds[t.userId] ?? '', t.productName, t.productId, t.productType, t.gateway, t.appliedDiscounts?.couponCode ?? '', t.appliedDiscounts?.couponDiscount ?? '', t.createdAt?.toISOString() ?? '', t.completedAt?.toISOString() ?? '']);
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

          {/* Audit Log & Trash CSV exports */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Shield size={13} className="text-primary-400" /> Audit Log &amp; Trash Exports</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Audit Log CSV */}
              <button
                onClick={() => {
                  const data = filteredAuditLogs.length > 0 ? filteredAuditLogs : auditLogs;
                  const headers = ['Timestamp', 'Action', 'Transaction ID', 'Performed By', 'Readable User ID', 'Role', 'Reason', 'Note', 'Changes'];
                  const rows = data.map(l => [
                    l.timestamp?.toISOString() ?? '',
                    AUDIT_CFG[l.action]?.label ?? l.action,
                    l.transactionId,
                    l.performedBySurname || l.performedByName,
                    l.performedByUserId ?? '',
                    l.performedByRole,
                    l.reason ?? '',
                    l.note ?? '',
                    l.changes ? l.changes.map(c => `${c.field}: ${c.oldValue}→${c.newValue}`).join('; ') : '',
                  ]);
                  const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
                  const isFiltered = filteredAuditLogs.length > 0 && filteredAuditLogs.length !== auditLogs.length;
                  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: `audit_log_${isFiltered ? 'filtered_' : ''}${new Date().toISOString().slice(0, 10)}.csv` });
                  a.click();
                }}
                className="text-left p-5 rounded-xl border border-white/5 bg-[#0f1117] hover:bg-white/[0.04] transition-colors group"
              >
                <div className="mb-3 text-blue-400"><Shield size={20} /></div>
                <p className="text-white font-semibold text-sm group-hover:text-primary-300 transition-colors">Audit Log Export</p>
                <p className="text-xs text-gray-500 mt-1">
                  {filteredAuditLogs.length > 0 && filteredAuditLogs.length !== auditLogs.length
                    ? `Filtered view — ${filteredAuditLogs.length} of ${auditLogs.length} entries`
                    : `All ${auditLogs.length} audit log entries`}
                </p>
                <p className="text-xs text-gray-600 mt-1 italic">Apply filters in the Audit Log tab to narrow the export.</p>
                <p className="text-xs text-primary-600 mt-3 flex items-center gap-1"><Download size={11} /> Download CSV</p>
              </button>

              {/* Trash CSV */}
              <button
                onClick={() => {
                  const data = filteredTrashRecords.length > 0 ? filteredTrashRecords : trashRecords;
                  const headers = ['Transaction ID', 'User Name', 'Product Name', 'Amount', 'Status', 'Gateway', 'Deleted By', 'Deleted By User ID', 'Deleted By Role', 'Deleted At', 'Auto-Purge At', 'Reason'];
                  const rows = data.map(r => [
                    r.transaction.transactionId,
                    r.transaction.userName,
                    r.transaction.productName,
                    r.transaction.amount,
                    r.transaction.status,
                    r.transaction.gateway ?? '',
                    r.deletedBySurname || r.deletedByName,
                    r.deletedByUserId ?? '',
                    r.deletedByRole,
                    r.deletedAt?.toISOString() ?? '',
                    r.expiresAt?.toISOString() ?? '',
                    r.reason ?? '',
                  ]);
                  const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
                  const isFiltered = filteredTrashRecords.length > 0 && filteredTrashRecords.length !== trashRecords.length;
                  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: `trash_${isFiltered ? 'filtered_' : ''}${new Date().toISOString().slice(0, 10)}.csv` });
                  a.click();
                }}
                className="text-left p-5 rounded-xl border border-white/5 bg-[#0f1117] hover:bg-white/[0.04] transition-colors group"
              >
                <div className="mb-3 text-red-400"><Trash2 size={20} /></div>
                <p className="text-white font-semibold text-sm group-hover:text-primary-300 transition-colors">Trash Export</p>
                <p className="text-xs text-gray-500 mt-1">
                  {filteredTrashRecords.length > 0 && filteredTrashRecords.length !== trashRecords.length
                    ? `Filtered view — ${filteredTrashRecords.length} of ${trashRecords.length} records`
                    : `All ${trashRecords.length} trash records`}
                </p>
                <p className="text-xs text-gray-600 mt-1 italic">Apply filters in the Trash tab to narrow the export.</p>
                <p className="text-xs text-primary-600 mt-3 flex items-center gap-1"><Download size={11} /> Download CSV</p>
              </button>
            </div>
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

      {/* ══ STATISTICS TAB ══ */}
      {activeTab === 'statistics' && (
        <StatisticsTab transactions={transactions} />
      )}

      {/* ══ AUDIT LOG TAB ══ */}
      {activeTab === 'audit' && (
        <AuditLogTab
          logs={auditLogs}
          loading={auditLoading}
          error={auditError}
          onRefresh={loadAuditLogs}
          auditFilters={auditFilters}
          onAuditFilterChange={(k, v) => setAuditFilters(f => ({ ...f, [k]: v }))}
          onAuditFilterReset={() => setAuditFilters(DEFAULT_AUDIT_FILTERS)}
        />
      )}

      {/* ══ TRASH TAB ══ */}
      {activeTab === 'trash' && (
        <TrashTab
          trashRecords={trashRecords}
          loading={trashLoading}
          error={trashError}
          onRefresh={loadTrash}
          onRestore={handleRestore}
          canModify={canModify}
          trashFilters={trashFilters}
          onTrashFilterChange={(k, v) => setTrashFilters(f => ({ ...f, [k]: v }))}
          onTrashFilterReset={() => setTrashFilters(DEFAULT_TRASH_FILTERS)}
        />
      )}

      {/* ══ MODALS ══ */}

      {selectedTxn && (
        <DetailModal
          txn={selectedTxn}
          readableUserId={readableIds[selectedTxn.userId] ?? null}
          userPhone={phoneNumbers[selectedTxn.userId] ?? null}
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
