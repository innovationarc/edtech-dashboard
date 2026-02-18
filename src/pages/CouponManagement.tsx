// src/pages/CouponManagement.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus, Search, Trash2, ToggleLeft, ToggleRight,
  ChevronDown, ChevronRight, Tag, CheckCircle,
  AlertCircle, Loader, X, Copy, Eye, RefreshCw,
  FileText, Layers, Shield, BarChart2, Download, Package
} from 'lucide-react';
import { useDashboard } from '../contexts/DashboardContext';
import { courseService, Course } from '../services/courseService';
import { userService, User as UserModel } from '../services/userService';
import couponService, {
  Coupon, BulkGroup, AuditLog,
  CreateSingleCouponInput, CreateBulkCouponInput,
  NextPurchaseEligibility, DiscountType
} from '../services/couponService';

// ── UI PRIMITIVES ────────────────────────────────────────────────────────────

const Card: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => (
  <div className={`bg-gray-800 border border-gray-700 rounded-xl ${className}`}>{children}</div>
);

const Badge: React.FC<{ variant?: 'success' | 'error' | 'warning' | 'info' | 'default'; children: React.ReactNode }> = ({ variant = 'default', children }) => {
  const cls = { success: 'bg-green-900/40 text-green-400 border-green-700', error: 'bg-red-900/40 text-red-400 border-red-700', warning: 'bg-yellow-900/40 text-yellow-400 border-yellow-700', info: 'bg-blue-900/40 text-blue-400 border-blue-700', default: 'bg-gray-700 text-gray-300 border-gray-600' }[variant];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>{children}</span>;
};

const Lbl: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="block text-sm font-medium text-gray-300 mb-1">{children}</label>
);

const FInput: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }> = ({ label, error, className = '', ...p }) => (
  <div>
    {label && <Lbl>{label}</Lbl>}
    <input className={`w-full bg-gray-700 border ${error ? 'border-red-500' : 'border-gray-600'} text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500 ${className}`} {...p} />
    {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
  </div>
);

const FSelect: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }> = ({ label, children, className = '', ...p }) => (
  <div>
    {label && <Lbl>{label}</Lbl>}
    <select className={`w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${className}`} {...p}>{children}</select>
  </div>
);

const FTextarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }> = ({ label, className = '', ...p }) => (
  <div>
    {label && <Lbl>{label}</Lbl>}
    <textarea className={`w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500 resize-none ${className}`} rows={3} {...p} />
  </div>
);

const Btn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success'; size?: 'sm' | 'md'; loading?: boolean }> = ({ variant = 'secondary', size = 'md', loading, children, className = '', disabled, ...p }) => {
  const vc = { primary: 'bg-indigo-600 hover:bg-indigo-700 text-white', secondary: 'bg-gray-700 hover:bg-gray-600 text-white border border-gray-600', danger: 'bg-red-700 hover:bg-red-600 text-white', ghost: 'hover:bg-gray-700 text-gray-400 hover:text-white', success: 'bg-green-700 hover:bg-green-600 text-white' }[variant];
  const sc = size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm';
  return (
    <button className={`inline-flex items-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${vc} ${sc} ${className}`} disabled={disabled || loading} {...p}>
      {loading && <Loader size={14} className="animate-spin flex-shrink-0" />}{children}
    </button>
  );
};

// ── MULTI-SELECT ─────────────────────────────────────────────────────────────

const MultiSelect: React.FC<{
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
  allLabel?: string;
  isAll?: boolean;
  onAllChange?: (v: boolean) => void;
}> = ({ label, options, selected, onChange, allLabel = 'All', isAll, onAllChange }) => {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <Lbl>{label}</Lbl>
      {onAllChange && (
        <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer mb-1">
          <input type="checkbox" checked={!!isAll} onChange={e => onAllChange(e.target.checked)} className="accent-indigo-500" />{allLabel}
        </label>
      )}
      {!isAll && (
        <div className="relative">
          <button type="button" onClick={() => setOpen(o => !o)} className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm text-left flex items-center justify-between">
            <span className="truncate">{selected.length === 0 ? 'Select...' : `${selected.length} selected`}</span>
            <ChevronDown size={14} />
          </button>
          {open && (
            <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-xl max-h-48 overflow-y-auto">
              {options.length === 0
                ? <p className="px-3 py-2 text-sm text-gray-500">No options</p>
                : options.map(o => (
                  <label key={o.value} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-700 cursor-pointer text-sm text-gray-300">
                    <input type="checkbox" checked={selected.includes(o.value)} onChange={() => onChange(selected.includes(o.value) ? selected.filter(v => v !== o.value) : [...selected, o.value])} className="accent-indigo-500" />
                    {o.label}
                  </label>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── HELPERS ──────────────────────────────────────────────────────────────────

const fmt = (d: Date) => { try { return new Date(d).toLocaleString('en-BD', { dateStyle: 'short', timeStyle: 'short' }); } catch { return '-'; } };
const statusBadge = (s: string) => { const m: Record<string, 'success' | 'error' | 'warning' | 'info'> = { active: 'success', inactive: 'error', expired: 'warning', scheduled: 'info' }; return <Badge variant={m[s] || 'default'}>{s}</Badge>; };

// ── FORM STATE ───────────────────────────────────────────────────────────────

interface FormState {
  couponCode: string; discountType: DiscountType; discountValue: string; maxDiscount: string;
  minimumPurchase: string; startDate: string; endDate: string; activationDate: string;
  usageLimitType: 'unlimited' | 'limited'; usageLimit: string; perUserLimit: string; adminComments: string;
  courseFilterAll: boolean; selectedCourseIds: string[];
  userFilterAll: boolean; selectedUserIds: string[];
  categoryFilterAll: boolean; selectedCategories: string[];
  classFilterAll: boolean; selectedClasses: string[];
  eligibilityEnabled: boolean; eligibilityCourseIds: string[];
}

const blankForm = (): FormState => ({
  couponCode: '', discountType: 'amount', discountValue: '', maxDiscount: '',
  minimumPurchase: '', startDate: '', endDate: '', activationDate: '',
  usageLimitType: 'unlimited', usageLimit: '', perUserLimit: '1', adminComments: '',
  courseFilterAll: true, selectedCourseIds: [],
  userFilterAll: true, selectedUserIds: [],
  categoryFilterAll: true, selectedCategories: [],
  classFilterAll: true, selectedClasses: [],
  eligibilityEnabled: false, eligibilityCourseIds: [],
});

// ── COUPON FORM ──────────────────────────────────────────────────────────────

const CouponForm: React.FC<{
  courses: Course[]; users: UserModel[]; isBulk: boolean; saving: boolean;
  onSubmit: (form: FormState, bulk: { groupName: string; groupId: string; quantity: number }) => Promise<void>;
  onClose: () => void;
}> = ({ courses, users, isBulk, saving, onSubmit, onClose }) => {
  const [form, setForm] = useState<FormState>(blankForm());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [bulkGroupName, setBulkGroupName] = useState('');
  const [bulkGroupId, setBulkGroupId] = useState('');
  const [bulkQuantity, setBulkQuantity] = useState('10');

  const categories = useMemo(() => [...new Set(courses.map(c => c.category).filter(Boolean))].sort(), [courses]);
  const classes = useMemo(() => [...new Set(courses.map(c => c.class).filter(Boolean))].sort(), [courses]);
  const set = (k: keyof FormState, v: any) => setForm(f => ({ ...f, [k]: v }));

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (isBulk) {
      if (!bulkGroupName.trim()) e.groupName = 'Required';
      if (!bulkGroupId.trim()) e.groupId = 'Required';
      const qty = Number(bulkQuantity);
      if (!qty || qty < 1 || qty > 1000) e.quantity = '1–1000';
    } else {
      if (!form.couponCode.trim()) e.couponCode = 'Required';
    }
    if (!form.discountValue || Number(form.discountValue) <= 0) e.discountValue = 'Must be > 0';
    if (form.discountType === 'percentage') {
      if (Number(form.discountValue) > 100) e.discountValue = 'Max 100%';
      if (!form.maxDiscount || Number(form.maxDiscount) <= 0) e.maxDiscount = 'Required';
    }
    if (!form.startDate) e.startDate = 'Required';
    if (!form.endDate) e.endDate = 'Required';
    if (form.startDate && form.endDate && form.startDate >= form.endDate) e.endDate = 'Must be after start';
    if (form.usageLimitType === 'limited' && (!form.usageLimit || Number(form.usageLimit) < 1)) e.usageLimit = 'Must be ≥ 1';
    if (!form.perUserLimit || Number(form.perUserLimit) < 1) e.perUserLimit = 'Must be ≥ 1';
    if (form.eligibilityEnabled && form.eligibilityCourseIds.length === 0) e.eligibility = 'Select at least one course';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    await onSubmit(form, { groupName: bulkGroupName, groupId: bulkGroupId, quantity: Number(bulkQuantity) });
  };

  return (
    <div className="space-y-5 max-h-[72vh] overflow-y-auto pr-1">
      {/* Bulk fields */}
      {isBulk && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-purple-900/20 border border-purple-700/40 rounded-lg">
          <FInput label="Group Name *" value={bulkGroupName} onChange={e => setBulkGroupName(e.target.value)} error={errors.groupName} placeholder="Summer Promo 2025" />
          <FInput label="Group ID *" value={bulkGroupId} onChange={e => setBulkGroupId(e.target.value.toUpperCase())} error={errors.groupId} placeholder="SUMMER25" />
          <FInput label="Quantity (1–1000) *" type="number" min={1} max={1000} value={bulkQuantity} onChange={e => setBulkQuantity(e.target.value)} error={errors.quantity} />
        </div>
      )}
      {/* Coupon code */}
      {!isBulk && <FInput label="Coupon Code *" value={form.couponCode} onChange={e => set('couponCode', e.target.value.toUpperCase())} error={errors.couponCode} placeholder="SAVE50" />}
      {/* Discount */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FSelect label="Discount Type" value={form.discountType} onChange={e => set('discountType', e.target.value as DiscountType)}>
          <option value="amount">Fixed Amount (৳)</option>
          <option value="percentage">Percentage (%)</option>
        </FSelect>
        <FInput label={`Value ${form.discountType === 'percentage' ? '(%)' : '(৳)'} *`} type="number" min={0} value={form.discountValue} onChange={e => set('discountValue', e.target.value)} error={errors.discountValue} />
        {form.discountType === 'percentage'
          ? <FInput label="Max Cap (৳) *" type="number" min={0} value={form.maxDiscount} onChange={e => set('maxDiscount', e.target.value)} error={errors.maxDiscount} />
          : <FInput label="Min. Purchase (৳)" type="number" min={0} value={form.minimumPurchase} onChange={e => set('minimumPurchase', e.target.value)} placeholder="0" />
        }
      </div>
      {form.discountType === 'percentage' && (
        <FInput label="Min. Purchase (৳)" type="number" min={0} value={form.minimumPurchase} onChange={e => set('minimumPurchase', e.target.value)} placeholder="0" />
      )}
      {/* Timeline */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FInput label="Start Date & Time *" type="datetime-local" value={form.startDate} onChange={e => set('startDate', e.target.value)} error={errors.startDate} />
        <FInput label="End Date & Time *" type="datetime-local" value={form.endDate} onChange={e => set('endDate', e.target.value)} error={errors.endDate} />
        <FInput label="Activation Date (optional)" type="datetime-local" value={form.activationDate} onChange={e => set('activationDate', e.target.value)} />
      </div>
      {/* Usage limits */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Lbl>Total Usage Limit</Lbl>
          <div className="flex gap-4 mt-1 mb-2">
            {(['unlimited', 'limited'] as const).map(t => (
              <label key={t} className="flex items-center gap-1.5 text-sm text-gray-400 cursor-pointer">
                <input type="radio" checked={form.usageLimitType === t} onChange={() => set('usageLimitType', t)} className="accent-indigo-500" />
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </label>
            ))}
          </div>
          {form.usageLimitType === 'limited' && <FInput type="number" min={1} value={form.usageLimit} onChange={e => set('usageLimit', e.target.value)} error={errors.usageLimit} placeholder="e.g. 100" />}
        </div>
        <FInput label="Per-User Limit *" type="number" min={1} value={form.perUserLimit} onChange={e => set('perUserLimit', e.target.value)} error={errors.perUserLimit} />
      </div>
      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MultiSelect label="Course Filter" options={courses.map(c => ({ value: c.id, label: c.title }))} selected={form.selectedCourseIds} onChange={v => set('selectedCourseIds', v)} allLabel="All Courses" isAll={form.courseFilterAll} onAllChange={v => set('courseFilterAll', v)} />
        <MultiSelect label="User Filter" options={users.map(u => ({ value: u.uid, label: `${u.name}${u.surname ? ' ' + u.surname : ''} (${u.userId || u.uid.slice(0, 8)})` }))} selected={form.selectedUserIds} onChange={v => set('selectedUserIds', v)} allLabel="All Users" isAll={form.userFilterAll} onAllChange={v => set('userFilterAll', v)} />
        <MultiSelect label="Category Filter" options={categories.map(c => ({ value: c, label: c }))} selected={form.selectedCategories} onChange={v => set('selectedCategories', v)} allLabel="All Categories" isAll={form.categoryFilterAll} onAllChange={v => set('categoryFilterAll', v)} />
        <MultiSelect label="Class Filter" options={classes.map(c => ({ value: c, label: c }))} selected={form.selectedClasses} onChange={v => set('selectedClasses', v)} allLabel="All Classes" isAll={form.classFilterAll} onAllChange={v => set('classFilterAll', v)} />
      </div>
      {/* Eligibility */}
      <div className="p-4 bg-gray-700/30 border border-gray-600 rounded-lg space-y-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.eligibilityEnabled} onChange={e => set('eligibilityEnabled', e.target.checked)} className="accent-indigo-500" />
          <span className="text-sm font-medium text-gray-300">Next-Purchase Eligibility (enrolled students only)</span>
        </label>
        {form.eligibilityEnabled && (
          <>
            <MultiSelect label="Required Enrollment Courses" options={courses.map(c => ({ value: c.id, label: c.title }))} selected={form.eligibilityCourseIds} onChange={v => set('eligibilityCourseIds', v)} />
            {errors.eligibility && <p className="text-xs text-red-400">{errors.eligibility}</p>}
          </>
        )}
      </div>
      {/* Comments */}
      <FTextarea label="Admin Comments (internal)" value={form.adminComments} onChange={e => set('adminComments', e.target.value)} placeholder="Internal notes for audit trail..." />
      {/* Actions */}
      <div className="flex justify-end gap-3 pt-3 border-t border-gray-700">
        <Btn variant="secondary" onClick={onClose} disabled={saving}>Cancel</Btn>
        <Btn variant="primary" loading={saving} onClick={handleSubmit}>
          {isBulk ? <><Package size={14} />Generate Bulk Coupons</> : <><Tag size={14} />Create Coupon</>}
        </Btn>
      </div>
    </div>
  );
};

// ── SUCCESS SCREEN ───────────────────────────────────────────────────────────

const SuccessScreen: React.FC<{ coupons: Coupon[]; group?: BulkGroup; onClose: () => void }> = ({ coupons, group, onClose }) => {
  const exportTxt = () => {
    const header = group ? `Group: ${group.groupName} | ID: ${group.groupId} | Total: ${coupons.length}\n${'='.repeat(60)}\n` : `Coupon: ${coupons[0]?.couponCode}\n${'='.repeat(60)}\n`;
    const rows = coupons.map(c => `${(c.trackingId || c.id.slice(0, 16)).padEnd(22)}| ${c.couponCode.padEnd(18)}| ${c.status}`).join('\n');
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([header + 'Tracking ID             | Code               | Status\n' + '-'.repeat(60) + '\n' + rows], { type: 'text/plain' })),
      download: group ? `coupons_${group.groupId}.txt` : `coupon_${coupons[0]?.couponCode}.txt`,
    });
    a.click(); URL.revokeObjectURL(a.href);
  };
  return (
    <div className="text-center space-y-5">
      <div className="flex justify-center"><div className="w-16 h-16 rounded-full bg-green-900/40 border border-green-600 flex items-center justify-center"><CheckCircle size={32} className="text-green-400" /></div></div>
      <div>
        <h3 className="text-xl font-bold text-white">{group ? `${coupons.length} Coupons Created!` : 'Coupon Created!'}</h3>
        {group && <p className="text-gray-400 text-sm mt-1">Group: <span className="text-indigo-400">{group.groupName}</span> · <span className="text-indigo-400 font-mono">{group.groupId}</span></p>}
      </div>
      <div className="bg-gray-700 rounded-lg max-h-52 overflow-y-auto text-left p-3">
        <table className="w-full text-xs">
          <thead><tr className="text-gray-400 border-b border-gray-600"><th className="pb-1 text-left">Tracking ID</th><th className="pb-1 text-left">Code</th><th className="pb-1 text-left">Status</th></tr></thead>
          <tbody>
            {coupons.slice(0, 200).map(c => (
              <tr key={c.id} className="border-b border-gray-600/50">
                <td className="py-1 text-gray-400 font-mono">{c.trackingId || c.id.slice(0, 16)}</td>
                <td className="py-1 text-indigo-400 font-mono font-medium">{c.couponCode}</td>
                <td className="py-1">{statusBadge(c.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {coupons.length > 200 && <p className="text-xs text-gray-500 mt-2 text-center">Showing 200/{coupons.length} — export for full list</p>}
      </div>
      <div className="flex gap-3 justify-center">
        <Btn variant="success" onClick={exportTxt}><Download size={14} />Export .txt</Btn>
        <Btn variant="primary" onClick={onClose}>Done</Btn>
      </div>
    </div>
  );
};

// ── MAIN PAGE ────────────────────────────────────────────────────────────────

const CouponManagement: React.FC = () => {
  const { user } = useDashboard();

  // ─────────────────────────────────────────────────────────────────────────
  // ALL HOOKS MUST BE DECLARED BEFORE ANY CONDITIONAL RETURN
  // (React Rules of Hooks — this was the root cause of the blank screen)
  // ─────────────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'single' | 'bulk'>('single');
  const [singleCoupons, setSingleCoupons] = useState<Coupon[]>([]);
  const [bulkGroups, setBulkGroups] = useState<BulkGroup[]>([]);
  const [groupCoupons, setGroupCoupons] = useState<Record<string, Coupon[]>>({});
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [users, setUsers] = useState<UserModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [showCreateModal, setShowCreateModal] = useState<'single' | 'bulk' | null>(null);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showDetailId, setShowDetailId] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{ coupons: Coupon[]; group?: BulkGroup } | null>(null);
  const [searchQ, setSearchQ] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const isAuthorized = user && (user.role === 'admin' || user.role === 'manager');

  const notify = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadAll = useCallback(async () => {
    if (!isAuthorized) return;
    setLoading(true);
    try {
      const [sc, bg, crs, us] = await Promise.all([
        couponService.getAllSingleCoupons(),
        couponService.getAllBulkGroups(),
        courseService.getAllCourses(),
        userService.getAllUsers(),
      ]);
      setSingleCoupons(sc);
      setBulkGroups(bg);
      setCourses(crs);
      setUsers(us);
    } catch (e: any) {
      notify(e.message || 'Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  }, [isAuthorized]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const loadGroupCoupons = async (gid: string) => {
    if (groupCoupons[gid]) return;
    try {
      const list = await couponService.getCouponsByGroupId(gid);
      setGroupCoupons(p => ({ ...p, [gid]: list }));
    } catch (e: any) { notify(e.message, 'error'); }
  };

  const toggleGroup = (gid: string) => {
    const next = new Set(expandedGroups);
    if (next.has(gid)) { next.delete(gid); } else { next.add(gid); loadGroupCoupons(gid); }
    setExpandedGroups(next);
  };

  const handleFormSubmit = async (form: FormState, bulk: { groupName: string; groupId: string; quantity: number }) => {
    setSaving(true);
    try {
      const courseFilter = form.courseFilterAll ? { type: 'all' as const } : { type: 'specific' as const, courseIds: form.selectedCourseIds };
      const userFilter = form.userFilterAll ? { type: 'all' as const } : { type: 'specific' as const, userIds: form.selectedUserIds };
      const categoryFilter = (form.categoryFilterAll && form.classFilterAll) ? { type: 'all' as const } : { type: 'specific' as const, categories: form.selectedCategories, classes: form.selectedClasses };
      const nextPurchaseEligibility: NextPurchaseEligibility = { enabled: form.eligibilityEnabled, requiredCourseIds: form.eligibilityCourseIds };

      const base = {
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : undefined,
        minimumPurchase: form.minimumPurchase ? Number(form.minimumPurchase) : 0,
        startDate: new Date(form.startDate),
        endDate: new Date(form.endDate),
        activationDate: form.activationDate ? new Date(form.activationDate) : undefined,
        usageLimit: form.usageLimitType === 'unlimited' ? 'unlimited' as const : Number(form.usageLimit),
        perUserLimit: Number(form.perUserLimit),
        adminComments: form.adminComments,
        actorUserId: user!.uid,
        actorName: user!.name,
        courseFilter, userFilter, categoryFilter, nextPurchaseEligibility,
      };

      if (showCreateModal === 'bulk') {
        const input: CreateBulkCouponInput = { ...base, groupName: bulk.groupName, groupId: bulk.groupId, quantity: bulk.quantity };
        const { group, coupons } = await couponService.createBulkCoupons(input);
        setShowCreateModal(null);
        setSuccessData({ coupons, group });
        setBulkGroups(p => [group, ...p]);
      } else {
        const input: CreateSingleCouponInput = { ...base, couponCode: form.couponCode };
        const coupon = await couponService.createSingleCoupon(input);
        setShowCreateModal(null);
        setSuccessData({ coupons: [coupon] });
        setSingleCoupons(p => [coupon, ...p]);
      }
    } catch (e: any) {
      notify(e.message || 'Failed to create coupon', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (c: Coupon) => {
    const next = c.status === 'active' ? 'inactive' : 'active';
    try {
      await couponService.toggleCouponStatus(c.id, next, user!.uid, user!.name);
      const upd = (list: Coupon[]) => list.map(x => x.id === c.id ? { ...x, status: next as any } : x);
      setSingleCoupons(upd);
      setGroupCoupons(p => { const n = { ...p }; Object.keys(n).forEach(k => { n[k] = upd(n[k]); }); return n; });
      notify(`Coupon ${next}`);
    } catch (e: any) { notify(e.message, 'error'); }
  };

  const handleDelete = async (c: Coupon) => {
    if (!window.confirm(`Delete "${c.couponCode}"? This cannot be undone.`)) return;
    try {
      await couponService.deleteCoupon(c.id, user!.uid, user!.name);
      setSingleCoupons(p => p.filter(x => x.id !== c.id));
      setGroupCoupons(p => { const n = { ...p }; Object.keys(n).forEach(k => { n[k] = n[k].filter(x => x.id !== c.id); }); return n; });
      notify('Coupon deleted');
    } catch (e: any) { notify(e.message, 'error'); }
  };

  const loadAudit = async () => {
    try {
      setAuditLogs(await couponService.getAuditLogs());
      setShowAuditModal(true);
    } catch (e: any) { notify(e.message, 'error'); }
  };

  const filteredSingle = useMemo(() => {
    const q = searchQ.toLowerCase();
    return singleCoupons
      .filter(c => !q || c.couponCode.toLowerCase().includes(q) || c.id.toLowerCase().includes(q))
      .filter(c => filterStatus === 'all' || c.status === filterStatus);
  }, [singleCoupons, searchQ, filterStatus]);

  const filteredGroups = useMemo(() => {
    const q = searchQ.toLowerCase();
    return !q ? bulkGroups : bulkGroups.filter(g => g.groupName.toLowerCase().includes(q) || g.groupId.toLowerCase().includes(q));
  }, [bulkGroups, searchQ]);

  // ── ACCESS GUARD (after all hooks) ────────────────────────────────────────
  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Shield size={44} className="text-red-400" />
        <h2 className="text-xl font-bold text-white">Access Denied</h2>
        <p className="text-gray-400">Only Admins and Managers can access Coupon Management.</p>
      </div>
    );
  }

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-10">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] flex items-center gap-2 px-4 py-3 rounded-lg shadow-xl border text-sm font-medium ${toast.type === 'success' ? 'bg-green-900 border-green-600 text-green-200' : 'bg-red-900 border-red-600 text-red-200'}`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />} {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Tag size={22} className="text-indigo-400" />Coupon Management</h1>
          <p className="text-gray-400 text-sm mt-1">Create, manage, and track coupons and promotions</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Btn variant="ghost" size="sm" onClick={loadAudit}><FileText size={14} />Audit Log</Btn>
          <Btn variant="ghost" size="sm" onClick={loadAll}><RefreshCw size={14} />Refresh</Btn>
          <Btn variant="secondary" onClick={() => setShowCreateModal('bulk')}><Package size={14} />Bulk Coupons</Btn>
          <Btn variant="primary" onClick={() => setShowCreateModal('single')}><Plus size={14} />Single Coupon</Btn>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Single Coupons', val: singleCoupons.length, icon: Tag, color: 'text-indigo-400' },
          { label: 'Bulk Groups', val: bulkGroups.length, icon: Layers, color: 'text-purple-400' },
          { label: 'Active', val: singleCoupons.filter(c => c.status === 'active').length, icon: CheckCircle, color: 'text-green-400' },
          { label: 'Total Usage', val: singleCoupons.reduce((s, c) => s + (c.usageCount || 0), 0), icon: BarChart2, color: 'text-yellow-400' },
        ].map(({ label, val, icon: Icon, color }) => (
          <Card key={label} className="p-4 flex items-center gap-3">
            <Icon size={22} className={color} />
            <div><p className="text-2xl font-bold text-white">{val}</p><p className="text-xs text-gray-400">{label}</p></div>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-700">
        {(['single', 'bulk'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)} className={`pb-3 px-1 border-b-2 text-sm font-medium transition-colors ${activeTab === t ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-400 hover:text-white'}`}>
            {t === 'single' ? `Single Coupons (${singleCoupons.length})` : `Bulk Groups (${bulkGroups.length})`}
          </button>
        ))}
      </div>

      {/* Search/Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-2.5 text-gray-400" />
          <input className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500"
            placeholder={activeTab === 'single' ? 'Search by code or ID...' : 'Search by group name or ID...'}
            value={searchQ} onChange={e => setSearchQ(e.target.value)} />
        </div>
        {activeTab === 'single' && (
          <select className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="expired">Expired</option>
            <option value="scheduled">Scheduled</option>
          </select>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-40 gap-3 text-gray-400">
          <Loader size={26} className="animate-spin text-indigo-400" /><span>Loading...</span>
        </div>
      ) : activeTab === 'single' ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-900/60">
                <tr className="text-gray-400 text-xs uppercase tracking-wider">
                  {['Coupon ID', 'Code', 'Discount', 'Min. Purchase', 'Timeline', 'Usage', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {filteredSingle.length === 0 && (
                  <tr><td colSpan={8} className="text-center text-gray-500 py-12">No coupons found</td></tr>
                )}
                {filteredSingle.map(c => (
                  <React.Fragment key={c.id}>
                    <tr className="hover:bg-gray-700/30 transition-colors">
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs">{c.id.slice(0, 10)}…</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-indigo-400">{c.couponCode}</span>
                          <button onClick={() => { navigator.clipboard.writeText(c.couponCode); notify('Copied!'); }} className="text-gray-500 hover:text-gray-300"><Copy size={12} /></button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-white whitespace-nowrap">
                        {c.discountType === 'amount' ? `৳${c.discountValue}` : `${c.discountValue}%`}
                        {c.maxDiscount ? <span className="text-gray-500 text-xs ml-1">(max ৳{c.maxDiscount})</span> : null}
                      </td>
                      <td className="px-4 py-3 text-gray-300">৳{c.minimumPurchase || 0}</td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                        <div>{fmt(c.startDate)}</div><div className="text-gray-500">→ {fmt(c.endDate)}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{c.usageCount} / {c.usageLimit}</td>
                      <td className="px-4 py-3">{statusBadge(c.status)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Btn variant="ghost" size="sm" onClick={() => setShowDetailId(showDetailId === c.id ? null : c.id)}><Eye size={13} /></Btn>
                          <Btn variant="ghost" size="sm" onClick={() => handleToggle(c)}>
                            {c.status === 'active' ? <ToggleRight size={14} className="text-green-400" /> : <ToggleLeft size={14} className="text-gray-400" />}
                          </Btn>
                          <Btn variant="ghost" size="sm" onClick={() => handleDelete(c)}><Trash2 size={13} className="text-red-400" /></Btn>
                        </div>
                      </td>
                    </tr>
                    {showDetailId === c.id && (
                      <tr><td colSpan={8} className="px-4 pb-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm p-3 bg-gray-900/50 rounded-lg">
                          <div><span className="text-gray-500">Courses: </span><span className="text-white">{c.courseFilter?.type === 'all' ? 'All' : `${c.courseFilter?.courseIds?.length || 0} selected`}</span></div>
                          <div><span className="text-gray-500">Users: </span><span className="text-white">{c.userFilter?.type === 'all' ? 'All' : `${c.userFilter?.userIds?.length || 0} selected`}</span></div>
                          <div><span className="text-gray-500">Per-User: </span><span className="text-white">{c.perUserLimit}</span></div>
                          <div><span className="text-gray-500">Created: </span><span className="text-white">{fmt(c.createdAt)}</span></div>
                          {c.nextPurchaseEligibility?.enabled && (
                            <div className="col-span-2 md:col-span-4"><span className="text-gray-500">Eligibility: </span><span className="text-indigo-400">{courses.filter(x => (c.nextPurchaseEligibility?.requiredCourseIds || []).includes(x.id)).map(x => x.title).join(', ') || 'Selected courses'}</span></div>
                          )}
                          {c.adminComments && <div className="col-span-2 md:col-span-4"><span className="text-gray-500">Notes: </span><span className="text-gray-300">{c.adminComments}</span></div>}
                        </div>
                      </td></tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredGroups.length === 0 && <Card className="p-12 text-center text-gray-500">No bulk coupon groups found</Card>}
          {filteredGroups.map(group => (
            <Card key={group.id} className="overflow-hidden">
              <button className="w-full flex items-center justify-between p-4 hover:bg-gray-700/30 transition-colors text-left" onClick={() => toggleGroup(group.id)}>
                <div className="flex items-center gap-3">
                  {expandedGroups.has(group.id) ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
                  <Package size={20} className="text-purple-400" />
                  <div>
                    <p className="font-semibold text-white">{group.groupName}</p>
                    <p className="text-xs text-gray-400">ID: <span className="text-indigo-400 font-mono">{group.groupId}</span> · {group.couponCount} coupons · {fmt(group.createdAt)}</p>
                  </div>
                </div>
                <Badge variant="info">{group.couponCount} coupons</Badge>
              </button>
              {expandedGroups.has(group.id) && (
                <div className="border-t border-gray-700">
                  {!groupCoupons[group.id]
                    ? <div className="flex items-center justify-center p-6 gap-2 text-gray-400"><Loader size={18} className="animate-spin" /> Loading…</div>
                    : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-900/60">
                            <tr className="text-gray-400 text-xs uppercase tracking-wider">
                              {['Tracking ID', 'Code', 'Discount', 'Usage', 'Status', 'Actions'].map(h => <th key={h} className="px-4 py-2 text-left whitespace-nowrap">{h}</th>)}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-700/50">
                            {groupCoupons[group.id].map(c => (
                              <tr key={c.id} className="hover:bg-gray-700/20">
                                <td className="px-4 py-2 font-mono text-xs text-gray-400">{c.trackingId}</td>
                                <td className="px-4 py-2">
                                  <div className="flex items-center gap-1">
                                    <span className="font-mono text-indigo-400">{c.couponCode}</span>
                                    <button onClick={() => { navigator.clipboard.writeText(c.couponCode); notify('Copied!'); }} className="text-gray-500 hover:text-gray-300"><Copy size={11} /></button>
                                  </div>
                                </td>
                                <td className="px-4 py-2 text-white text-xs whitespace-nowrap">{c.discountType === 'amount' ? `৳${c.discountValue}` : `${c.discountValue}%`}</td>
                                <td className="px-4 py-2 text-gray-300 text-xs whitespace-nowrap">{c.usageCount}/{c.usageLimit}</td>
                                <td className="px-4 py-2">{statusBadge(c.status)}</td>
                                <td className="px-4 py-2">
                                  <div className="flex gap-1">
                                    <Btn variant="ghost" size="sm" onClick={() => handleToggle(c)}>{c.status === 'active' ? <ToggleRight size={13} className="text-green-400" /> : <ToggleLeft size={13} />}</Btn>
                                    <Btn variant="ghost" size="sm" onClick={() => handleDelete(c)}><Trash2 size={13} className="text-red-400" /></Btn>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  }
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-4xl my-8 shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-700">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                {showCreateModal === 'bulk' ? <Package size={18} className="text-purple-400" /> : <Tag size={18} className="text-indigo-400" />}
                {showCreateModal === 'bulk' ? 'Create Bulk Coupon Group' : 'Create Single Coupon'}
              </h2>
              <button onClick={() => { if (!saving) setShowCreateModal(null); }} disabled={saving} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 disabled:opacity-50"><X size={20} /></button>
            </div>
            <div className="p-5">
              <CouponForm
                courses={courses} users={users}
                isBulk={showCreateModal === 'bulk'}
                saving={saving}
                onSubmit={handleFormSubmit}
                onClose={() => { if (!saving) setShowCreateModal(null); }}
              />
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS MODAL */}
      {successData && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-xl shadow-2xl p-6">
            <SuccessScreen coupons={successData.coupons} group={successData.group} onClose={() => setSuccessData(null)} />
          </div>
        </div>
      )}

      {/* AUDIT MODAL */}
      {showAuditModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl my-8 shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-700">
              <h2 className="text-lg font-bold text-white flex items-center gap-2"><FileText size={18} className="text-yellow-400" />Audit Log</h2>
              <button onClick={() => setShowAuditModal(false)} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400"><X size={20} /></button>
            </div>
            <div className="p-4 max-h-[70vh] overflow-y-auto space-y-2">
              {auditLogs.length === 0
                ? <p className="text-center text-gray-500 py-8">No audit logs found</p>
                : auditLogs.map(log => (
                  <div key={log.id} className="bg-gray-800 rounded-lg p-3 text-sm border border-gray-700">
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant={log.actionType.includes('create') ? 'success' : log.actionType === 'delete' ? 'error' : log.actionType === 'deactivate' ? 'warning' : 'info'}>
                        {log.actionType.replace(/_/g, ' ').toUpperCase()}
                      </Badge>
                      <span className="text-xs text-gray-500">{fmt(log.timestamp)}</span>
                    </div>
                    <p className="text-gray-300 text-xs">
                      <span className="text-gray-400">By: </span>{log.actorName || log.actorUserId}
                      {log.couponCode && <><span className="text-gray-400"> · Code: </span><span className="text-indigo-400 font-mono">{log.couponCode}</span></>}
                      {log.groupId && <><span className="text-gray-400"> · Group: </span><span className="text-purple-400 font-mono">{log.groupId}</span></>}
                    </p>
                    {log.adminComments && <p className="text-xs text-gray-500 mt-1 italic">{log.adminComments}</p>}
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CouponManagement;
