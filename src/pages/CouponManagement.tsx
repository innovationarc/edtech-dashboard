// src/pages/CouponManagement.tsx
// Production-Grade Coupon Management Panel

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus, Search, Filter, Download, Edit2, Trash2, ToggleLeft, ToggleRight,
  ChevronDown, ChevronRight, Tag, Users, Clock, CheckCircle, XCircle,
  AlertCircle, Loader, X, Copy, Eye, RefreshCw, FileText, Layers,
  Shield, BarChart2, Calendar, DollarSign, Percent, Package, AlertTriangle
} from 'lucide-react';
import { useDashboard } from '../contexts/DashboardContext';
import { courseService, Course } from '../services/courseService';
import { userService, User as UserModel } from '../services/userService';
import couponService, {
  Coupon, BulkGroup, AuditLog, CreateSingleCouponInput, CreateBulkCouponInput,
  CourseFilter, UserFilter, CategoryFilter, NextPurchaseEligibility, DiscountType
} from '../services/couponService';

// ==================== TINY UI PRIMITIVES ====================

const Card: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => (
  <div className={`bg-gray-800 border border-gray-700 rounded-xl ${className}`}>{children}</div>
);

const Badge: React.FC<{ variant?: 'success' | 'error' | 'warning' | 'info' | 'default'; children: React.ReactNode }> = ({
  variant = 'default', children
}) => {
  const colors = {
    success: 'bg-green-900/40 text-green-400 border-green-700',
    error: 'bg-red-900/40 text-red-400 border-red-700',
    warning: 'bg-yellow-900/40 text-yellow-400 border-yellow-700',
    info: 'bg-blue-900/40 text-blue-400 border-blue-700',
    default: 'bg-gray-700 text-gray-300 border-gray-600',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colors[variant]}`}>
      {children}
    </span>
  );
};

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }> = ({
  label, error, className = '', ...props
}) => (
  <div className="space-y-1">
    {label && <label className="block text-sm font-medium text-gray-300">{label}</label>}
    <input
      className={`w-full bg-gray-700 border ${error ? 'border-red-500' : 'border-gray-600'} text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500 ${className}`}
      {...props}
    />
    {error && <p className="text-xs text-red-400">{error}</p>}
  </div>
);

const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }> = ({
  label, className = '', children, ...props
}) => (
  <div className="space-y-1">
    {label && <label className="block text-sm font-medium text-gray-300">{label}</label>}
    <select
      className={`w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${className}`}
      {...props}
    >
      {children}
    </select>
  </div>
);

const Textarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }> = ({
  label, className = '', ...props
}) => (
  <div className="space-y-1">
    {label && <label className="block text-sm font-medium text-gray-300">{label}</label>}
    <textarea
      className={`w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500 resize-none ${className}`}
      rows={3}
      {...props}
    />
  </div>
);

const Btn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}> = ({ variant = 'secondary', size = 'md', loading, children, className = '', disabled, ...props }) => {
  const variants = {
    primary: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    secondary: 'bg-gray-700 hover:bg-gray-600 text-white border border-gray-600',
    danger: 'bg-red-700 hover:bg-red-600 text-white',
    ghost: 'hover:bg-gray-700 text-gray-400 hover:text-white',
    success: 'bg-green-700 hover:bg-green-600 text-white',
  };
  const sizes = { sm: 'px-2 py-1 text-xs', md: 'px-3 py-2 text-sm', lg: 'px-4 py-2.5 text-sm' };
  return (
    <button
      className={`inline-flex items-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader size={14} className="animate-spin" />}
      {children}
    </button>
  );
};

// ==================== HELPERS ====================

const fmt = (d: Date) => new Date(d).toLocaleString('en-BD', { dateStyle: 'short', timeStyle: 'short' });
const fmtDate = (d: Date) => new Date(d).toISOString().slice(0, 16);

const statusBadge = (s: string) => {
  const map: Record<string, 'success' | 'error' | 'warning' | 'info'> = {
    active: 'success', inactive: 'error', expired: 'warning', scheduled: 'info'
  };
  return <Badge variant={map[s] || 'default'}>{s}</Badge>;
};

// ==================== MULTI-SELECT COMPONENT ====================

const MultiSelect: React.FC<{
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (vals: string[]) => void;
  allLabel?: string;
  isAll?: boolean;
  onAllChange?: (all: boolean) => void;
}> = ({ label, options, selected, onChange, allLabel = 'All', isAll, onAllChange }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-1 relative">
      <label className="block text-sm font-medium text-gray-300">{label}</label>
      {onAllChange && (
        <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer mb-1">
          <input type="checkbox" checked={!!isAll} onChange={e => onAllChange(e.target.checked)} className="accent-indigo-500" />
          {allLabel}
        </label>
      )}
      {!isAll && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm text-left flex items-center justify-between"
          >
            <span className="truncate">{selected.length === 0 ? 'Select...' : `${selected.length} selected`}</span>
            <ChevronDown size={14} />
          </button>
          {open && (
            <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-xl max-h-48 overflow-y-auto">
              {options.map(o => (
                <label key={o.value} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-700 cursor-pointer text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={selected.includes(o.value)}
                    onChange={() => onChange(
                      selected.includes(o.value) ? selected.filter(v => v !== o.value) : [...selected, o.value]
                    )}
                    className="accent-indigo-500"
                  />
                  {o.label}
                </label>
              ))}
              {options.length === 0 && <p className="px-3 py-2 text-sm text-gray-500">No options available</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ==================== COUPON FORM ====================

interface CouponFormState {
  couponCode: string;
  discountType: DiscountType;
  discountValue: number | '';
  maxDiscount: number | '';
  minimumPurchase: number | '';
  startDate: string;
  endDate: string;
  activationDate: string;
  usageLimitType: 'unlimited' | 'limited';
  usageLimit: number | '';
  perUserLimit: number | '';
  adminComments: string;
  // Course filter
  courseFilterAll: boolean;
  selectedCourseIds: string[];
  // User filter
  userFilterAll: boolean;
  selectedUserIds: string[];
  // Category filter
  categoryFilterAll: boolean;
  selectedCategories: string[];
  selectedClasses: string[];
  // Eligibility
  eligibilityEnabled: boolean;
  eligibilityCourseIds: string[];
}

const defaultForm = (): CouponFormState => ({
  couponCode: '',
  discountType: 'amount',
  discountValue: '',
  maxDiscount: '',
  minimumPurchase: '',
  startDate: '',
  endDate: '',
  activationDate: '',
  usageLimitType: 'unlimited',
  usageLimit: '',
  perUserLimit: 1,
  adminComments: '',
  courseFilterAll: true,
  selectedCourseIds: [],
  userFilterAll: true,
  selectedUserIds: [],
  categoryFilterAll: true,
  selectedCategories: [],
  selectedClasses: [],
  eligibilityEnabled: false,
  eligibilityCourseIds: [],
});

const CouponForm: React.FC<{
  courses: Course[];
  users: UserModel[];
  onSubmit: (data: CouponFormState) => Promise<void>;
  onClose: () => void;
  isBulk?: boolean;
  bulkGroupName?: string;
  bulkGroupId?: string;
  bulkQuantity?: number;
  onBulkFieldChange?: (f: string, v: string | number) => void;
  bulkErrors?: Record<string, string>;
  saving: boolean;
}> = ({ courses, users, onSubmit, onClose, isBulk, bulkGroupName, bulkGroupId, bulkQuantity, onBulkFieldChange, bulkErrors, saving }) => {
  const [form, setForm] = useState<CouponFormState>(defaultForm());
  const [errors, setErrors] = useState<Record<string, string>>({});

  const categories = useMemo(() => [...new Set(courses.map(c => c.category).filter(Boolean))], [courses]);
  const classes = useMemo(() => [...new Set(courses.map(c => c.class).filter(Boolean))], [courses]);

  const set = (field: keyof CouponFormState, value: any) => setForm(f => ({ ...f, [field]: value }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!isBulk && !form.couponCode.trim()) e.couponCode = 'Required';
    if (!form.discountValue || Number(form.discountValue) <= 0) e.discountValue = 'Must be > 0';
    if (form.discountType === 'percentage') {
      if (Number(form.discountValue) > 100) e.discountValue = 'Max 100%';
      if (!form.maxDiscount || Number(form.maxDiscount) <= 0) e.maxDiscount = 'Required for percentage';
    }
    if (!form.startDate) e.startDate = 'Required';
    if (!form.endDate) e.endDate = 'Required';
    if (form.startDate && form.endDate && form.startDate >= form.endDate) e.endDate = 'Must be after start';
    if (form.usageLimitType === 'limited' && (!form.usageLimit || Number(form.usageLimit) < 1)) e.usageLimit = 'Must be >= 1';
    if (!form.perUserLimit || Number(form.perUserLimit) < 1) e.perUserLimit = 'Must be >= 1';
    if (form.eligibilityEnabled && form.eligibilityCourseIds.length === 0) e.eligibility = 'Select at least one course';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    await onSubmit(form);
  };

  return (
    <div className="space-y-6">
      {/* Bulk-only fields */}
      {isBulk && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="Group Name *"
            value={bulkGroupName || ''}
            onChange={e => onBulkFieldChange?.('groupName', e.target.value)}
            error={bulkErrors?.groupName}
            placeholder="Summer Promo 2025"
          />
          <Input
            label="Group ID *"
            value={bulkGroupId || ''}
            onChange={e => onBulkFieldChange?.('groupId', e.target.value.toUpperCase())}
            error={bulkErrors?.groupId}
            placeholder="SUMMER25"
          />
          <Input
            label="Quantity (1–1000) *"
            type="number"
            min={1}
            max={1000}
            value={bulkQuantity || ''}
            onChange={e => onBulkFieldChange?.('quantity', Number(e.target.value))}
            error={bulkErrors?.quantity}
          />
        </div>
      )}

      {/* Coupon code (single only) */}
      {!isBulk && (
        <Input
          label="Coupon Code *"
          value={form.couponCode}
          onChange={e => set('couponCode', e.target.value.toUpperCase())}
          error={errors.couponCode}
          placeholder="SAVE50"
        />
      )}

      {/* Discount */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Select label="Discount Type" value={form.discountType} onChange={e => set('discountType', e.target.value as DiscountType)}>
          <option value="amount">Fixed Amount (৳)</option>
          <option value="percentage">Percentage (%)</option>
        </Select>
        <Input
          label={`Discount Value ${form.discountType === 'percentage' ? '(%)' : '(৳)'} *`}
          type="number"
          min={0}
          value={form.discountValue}
          onChange={e => set('discountValue', e.target.value === '' ? '' : Number(e.target.value))}
          error={errors.discountValue}
        />
        {form.discountType === 'percentage' && (
          <Input
            label="Max Discount Cap (৳) *"
            type="number"
            min={0}
            value={form.maxDiscount}
            onChange={e => set('maxDiscount', e.target.value === '' ? '' : Number(e.target.value))}
            error={errors.maxDiscount}
          />
        )}
        <Input
          label="Minimum Purchase (৳)"
          type="number"
          min={0}
          value={form.minimumPurchase}
          onChange={e => set('minimumPurchase', e.target.value === '' ? '' : Number(e.target.value))}
          placeholder="0"
        />
      </div>

      {/* Timeline */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input label="Start Date & Time *" type="datetime-local" value={form.startDate}
          onChange={e => set('startDate', e.target.value)} error={errors.startDate} />
        <Input label="End Date & Time *" type="datetime-local" value={form.endDate}
          onChange={e => set('endDate', e.target.value)} error={errors.endDate} />
        <Input label="Activation Date & Time" type="datetime-local" value={form.activationDate}
          onChange={e => set('activationDate', e.target.value)} />
      </div>

      {/* Usage Limits */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">Total Usage Limit</label>
          <div className="flex gap-3">
            {(['unlimited', 'limited'] as const).map(t => (
              <label key={t} className="flex items-center gap-1.5 text-sm text-gray-400 cursor-pointer">
                <input type="radio" checked={form.usageLimitType === t} onChange={() => set('usageLimitType', t)} className="accent-indigo-500" />
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </label>
            ))}
          </div>
          {form.usageLimitType === 'limited' && (
            <Input type="number" min={1} value={form.usageLimit}
              onChange={e => set('usageLimit', e.target.value === '' ? '' : Number(e.target.value))}
              error={errors.usageLimit} placeholder="e.g. 100" />
          )}
        </div>
        <Input
          label="Per-User Limit *"
          type="number"
          min={1}
          value={form.perUserLimit}
          onChange={e => set('perUserLimit', e.target.value === '' ? '' : Number(e.target.value))}
          error={errors.perUserLimit}
        />
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <MultiSelect
          label="Course Filter"
          options={courses.map(c => ({ value: c.id, label: `${c.title} (${c.id.slice(0, 6)})` }))}
          selected={form.selectedCourseIds}
          onChange={v => set('selectedCourseIds', v)}
          allLabel="All Courses"
          isAll={form.courseFilterAll}
          onAllChange={v => set('courseFilterAll', v)}
        />
        <MultiSelect
          label="User Filter"
          options={users.map(u => ({ value: u.uid, label: `${u.name} ${u.surname || ''} (${u.userId || u.uid.slice(0, 8)})` }))}
          selected={form.selectedUserIds}
          onChange={v => set('selectedUserIds', v)}
          allLabel="All Users"
          isAll={form.userFilterAll}
          onAllChange={v => set('userFilterAll', v)}
        />
        <MultiSelect
          label="Category Filter"
          options={categories.map(c => ({ value: c, label: c }))}
          selected={form.selectedCategories}
          onChange={v => set('selectedCategories', v)}
          allLabel="All Categories"
          isAll={form.categoryFilterAll}
          onAllChange={v => set('categoryFilterAll', v)}
        />
        <MultiSelect
          label="Class Filter"
          options={classes.map(c => ({ value: c, label: c }))}
          selected={form.selectedClasses}
          onChange={v => set('selectedClasses', v)}
          allLabel="All Classes"
          isAll={form.categoryFilterAll}
          onAllChange={() => {}}
        />
      </div>

      {/* Next-Purchase Eligibility */}
      <Card className="p-4 space-y-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.eligibilityEnabled}
            onChange={e => set('eligibilityEnabled', e.target.checked)} className="accent-indigo-500" />
          <span className="text-sm font-medium text-gray-300">Next-Purchase Eligibility (enrolled students only)</span>
        </label>
        {form.eligibilityEnabled && (
          <div>
            <MultiSelect
              label="Required Enrollment Courses"
              options={courses.map(c => ({ value: c.id, label: c.title }))}
              selected={form.eligibilityCourseIds}
              onChange={v => set('eligibilityCourseIds', v)}
            />
            {errors.eligibility && <p className="text-xs text-red-400 mt-1">{errors.eligibility}</p>}
          </div>
        )}
      </Card>

      {/* Admin Comments */}
      <Textarea label="Admin Comments (internal)" value={form.adminComments}
        onChange={e => set('adminComments', e.target.value)} placeholder="Internal notes for audit trail..." />

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2 border-t border-gray-700">
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" loading={saving} onClick={handleSubmit}>
          {isBulk ? <><Package size={14} />Create Bulk Coupons</> : <><Tag size={14} />Create Coupon</>}
        </Btn>
      </div>
    </div>
  );
};

// ==================== SUCCESS SCREEN ====================

const SuccessScreen: React.FC<{
  coupons: Coupon[];
  group?: BulkGroup;
  onClose: () => void;
}> = ({ coupons, group, onClose }) => {
  const exportTxt = () => {
    const lines = [
      group ? `Group: ${group.groupName} | Group ID: ${group.groupId}` : '',
      group ? `Total Coupons: ${coupons.length}` : '',
      '='.repeat(60),
      'Tracking ID          | Coupon Code     | Status',
      '-'.repeat(60),
      ...coupons.map(c =>
        `${(c.trackingId || c.id.slice(0, 16)).padEnd(20)} | ${c.couponCode.padEnd(15)} | ${c.status}`
      ),
    ].filter(Boolean).join('\n');

    const blob = new Blob([lines], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = group ? `coupons_${group.groupId}.txt` : `coupon_${coupons[0]?.couponCode}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="text-center space-y-6">
      <div className="flex justify-center">
        <div className="w-20 h-20 rounded-full bg-green-900/40 border border-green-600 flex items-center justify-center">
          <CheckCircle size={40} className="text-green-400" />
        </div>
      </div>
      <div>
        <h3 className="text-2xl font-bold text-white mb-2">
          {group ? `${coupons.length} Coupons Created!` : 'Coupon Created!'}
        </h3>
        {group && <p className="text-gray-400">Group: <span className="text-indigo-400">{group.groupName}</span> | ID: <span className="text-indigo-400">{group.groupId}</span></p>}
      </div>
      <Card className="p-4 max-h-64 overflow-y-auto text-left">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="pb-2 text-left">Tracking ID</th>
              <th className="pb-2 text-left">Code</th>
              <th className="pb-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {coupons.slice(0, 200).map(c => (
              <tr key={c.id} className="border-b border-gray-700/50">
                <td className="py-1.5 text-gray-400 font-mono text-xs">{c.trackingId || c.id.slice(0, 16)}</td>
                <td className="py-1.5 text-indigo-400 font-mono font-medium">{c.couponCode}</td>
                <td className="py-1.5">{statusBadge(c.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {coupons.length > 200 && <p className="text-xs text-gray-500 mt-2">Showing 200 of {coupons.length}. Download full list.</p>}
      </Card>
      <div className="flex gap-3 justify-center">
        <Btn variant="success" onClick={exportTxt}>
          <Download size={16} /> Export as .txt
        </Btn>
        <Btn variant="primary" onClick={onClose}>
          Done
        </Btn>
      </div>
    </div>
  );
};

// ==================== COUPON ROW DETAIL ====================

const CouponDetail: React.FC<{ coupon: Coupon; courses: Course[] }> = ({ coupon, courses }) => {
  const eligCourses = courses.filter(c => coupon.nextPurchaseEligibility.requiredCourseIds.includes(c.id));
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm p-3 bg-gray-900/50 rounded-lg">
      <div><span className="text-gray-500">Discount: </span><span className="text-white">{coupon.discountType === 'amount' ? `৳${coupon.discountValue}` : `${coupon.discountValue}%`}{coupon.maxDiscount ? ` (max ৳${coupon.maxDiscount})` : ''}</span></div>
      <div><span className="text-gray-500">Min Purchase: </span><span className="text-white">৳{coupon.minimumPurchase}</span></div>
      <div><span className="text-gray-500">Usage: </span><span className="text-white">{coupon.usageCount} / {coupon.usageLimit}</span></div>
      <div><span className="text-gray-500">Per User: </span><span className="text-white">{coupon.perUserLimit}</span></div>
      <div><span className="text-gray-500">Start: </span><span className="text-white">{fmt(coupon.startDate)}</span></div>
      <div><span className="text-gray-500">End: </span><span className="text-white">{fmt(coupon.endDate)}</span></div>
      <div><span className="text-gray-500">Courses: </span><span className="text-white">{coupon.courseFilter.type === 'all' ? 'All' : coupon.courseFilter.courseIds?.length + ' courses'}</span></div>
      <div><span className="text-gray-500">Users: </span><span className="text-white">{coupon.userFilter.type === 'all' ? 'All' : coupon.userFilter.userIds?.length + ' users'}</span></div>
      {coupon.nextPurchaseEligibility.enabled && (
        <div className="col-span-2 md:col-span-4">
          <span className="text-gray-500">Eligibility: </span>
          <span className="text-indigo-400">{eligCourses.map(c => c.title).join(', ') || 'Selected courses'}</span>
        </div>
      )}
      {coupon.adminComments && (
        <div className="col-span-2 md:col-span-4">
          <span className="text-gray-500">Notes: </span>
          <span className="text-gray-300">{coupon.adminComments}</span>
        </div>
      )}
    </div>
  );
};

// ==================== MAIN PAGE ====================

const CouponManagement: React.FC = () => {
  const { user } = useDashboard();

  // Access guard
  if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Shield size={48} className="text-red-400" />
        <h2 className="text-xl font-bold text-white">Access Denied</h2>
        <p className="text-gray-400">Only Admins and Managers can access Coupon Management.</p>
      </div>
    );
  }

  // ── STATE ────────────────────────────────────────────────────────────
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

  // Modals
  const [showCreateModal, setShowCreateModal] = useState<'single' | 'bulk' | null>(null);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showDetailId, setShowDetailId] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{ coupons: Coupon[]; group?: BulkGroup } | null>(null);

  // Bulk form extra fields
  const [bulkGroupName, setBulkGroupName] = useState('');
  const [bulkGroupId, setBulkGroupId] = useState('');
  const [bulkQuantity, setBulkQuantity] = useState<number>(10);
  const [bulkErrors, setBulkErrors] = useState<Record<string, string>>({});

  // Filters
  const [searchQ, setSearchQ] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortCol, setSortCol] = useState<'createdAt' | 'usageCount' | 'endDate'>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ── LOAD DATA ────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sc, bg, crs, us] = await Promise.all([
        couponService.getAllSingleCoupons(),
        couponService.getAllBulkGroups(),
        courseService.getPublishedCourses(),
        userService.getAllUsers(),
      ]);
      setSingleCoupons(sc);
      setBulkGroups(bg);
      setCourses(crs);
      setUsers(us);
    } catch (e: any) {
      showToast(e.message || 'Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const loadGroupCoupons = async (groupId: string) => {
    if (groupCoupons[groupId]) return;
    try {
      const coupons = await couponService.getCouponsByGroupId(groupId);
      setGroupCoupons(prev => ({ ...prev, [groupId]: coupons }));
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const toggleGroup = (groupId: string) => {
    const next = new Set(expandedGroups);
    if (next.has(groupId)) {
      next.delete(groupId);
    } else {
      next.add(groupId);
      loadGroupCoupons(groupId);
    }
    setExpandedGroups(next);
  };

  // ── CREATE HANDLERS ──────────────────────────────────────────────────
  const buildFilters = (form: CouponFormState) => ({
    courseFilter: form.courseFilterAll
      ? { type: 'all' as const }
      : { type: 'specific' as const, courseIds: form.selectedCourseIds },
    userFilter: form.userFilterAll
      ? { type: 'all' as const }
      : { type: 'specific' as const, userIds: form.selectedUserIds },
    categoryFilter: form.categoryFilterAll
      ? { type: 'all' as const }
      : { type: 'specific' as const, categories: form.selectedCategories, classes: form.selectedClasses },
    nextPurchaseEligibility: {
      enabled: form.eligibilityEnabled,
      requiredCourseIds: form.eligibilityCourseIds,
    } as NextPurchaseEligibility,
  });

  const handleCreateSingle = async (form: CouponFormState) => {
    setSaving(true);
    try {
      const input: CreateSingleCouponInput = {
        couponCode: form.couponCode,
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        maxDiscount: form.maxDiscount !== '' ? Number(form.maxDiscount) : undefined,
        minimumPurchase: form.minimumPurchase !== '' ? Number(form.minimumPurchase) : 0,
        startDate: new Date(form.startDate),
        endDate: new Date(form.endDate),
        activationDate: form.activationDate ? new Date(form.activationDate) : undefined,
        usageLimit: form.usageLimitType === 'unlimited' ? 'unlimited' : Number(form.usageLimit),
        perUserLimit: Number(form.perUserLimit),
        adminComments: form.adminComments,
        actorUserId: user!.uid,
        actorName: user!.name,
        ...buildFilters(form),
      };
      const coupon = await couponService.createSingleCoupon(input);
      setShowCreateModal(null);
      setSuccessData({ coupons: [coupon] });
      setSingleCoupons(prev => [coupon, ...prev]);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateBulk = async (form: CouponFormState) => {
    const be: Record<string, string> = {};
    if (!bulkGroupName.trim()) be.groupName = 'Required';
    if (!bulkGroupId.trim()) be.groupId = 'Required';
    if (!bulkQuantity || bulkQuantity < 1 || bulkQuantity > 1000) be.quantity = 'Must be 1–1000';
    setBulkErrors(be);
    if (Object.keys(be).length > 0) return;

    setSaving(true);
    try {
      const input: CreateBulkCouponInput = {
        groupName: bulkGroupName,
        groupId: bulkGroupId,
        quantity: bulkQuantity,
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        maxDiscount: form.maxDiscount !== '' ? Number(form.maxDiscount) : undefined,
        minimumPurchase: form.minimumPurchase !== '' ? Number(form.minimumPurchase) : 0,
        startDate: new Date(form.startDate),
        endDate: new Date(form.endDate),
        activationDate: form.activationDate ? new Date(form.activationDate) : undefined,
        usageLimit: form.usageLimitType === 'unlimited' ? 'unlimited' : Number(form.usageLimit),
        perUserLimit: Number(form.perUserLimit),
        adminComments: form.adminComments,
        actorUserId: user!.uid,
        actorName: user!.name,
        ...buildFilters(form),
      };
      const { group, coupons } = await couponService.createBulkCoupons(input);
      setShowCreateModal(null);
      setSuccessData({ coupons, group });
      setBulkGroups(prev => [group, ...prev]);
      // reset bulk fields
      setBulkGroupName('');
      setBulkGroupId('');
      setBulkQuantity(10);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── TOGGLE STATUS ────────────────────────────────────────────────────
  const handleToggleStatus = async (coupon: Coupon) => {
    const newStatus = coupon.status === 'active' ? 'inactive' : 'active';
    try {
      await couponService.toggleCouponStatus(coupon.id, newStatus, user!.uid, user!.name);
      const update = (list: Coupon[]) => list.map(c => c.id === coupon.id ? { ...c, status: newStatus } : c);
      setSingleCoupons(update);
      setGroupCoupons(prev => {
        const next = { ...prev };
        for (const gid of Object.keys(next)) {
          next[gid] = update(next[gid]);
        }
        return next;
      });
      showToast(`Coupon ${newStatus}`);
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  // ── DELETE ───────────────────────────────────────────────────────────
  const handleDelete = async (coupon: Coupon) => {
    if (!window.confirm(`Delete coupon "${coupon.couponCode}"? This cannot be undone.`)) return;
    try {
      await couponService.deleteCoupon(coupon.id, user!.uid, user!.name);
      setSingleCoupons(prev => prev.filter(c => c.id !== coupon.id));
      setGroupCoupons(prev => {
        const next = { ...prev };
        for (const gid of Object.keys(next)) {
          next[gid] = next[gid].filter(c => c.id !== coupon.id);
        }
        return next;
      });
      showToast('Coupon deleted');
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  // ── LOAD AUDIT ───────────────────────────────────────────────────────
  const loadAudit = async () => {
    try {
      const logs = await couponService.getAuditLogs();
      setAuditLogs(logs);
      setShowAuditModal(true);
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  // ── FILTERED DATA ────────────────────────────────────────────────────
  const filteredSingle = useMemo(() => {
    let arr = [...singleCoupons];
    if (searchQ) {
      const q = searchQ.toLowerCase();
      arr = arr.filter(c =>
        c.couponCode.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        (c.trackingId || '').toLowerCase().includes(q)
      );
    }
    if (filterStatus !== 'all') arr = arr.filter(c => c.status === filterStatus);
    arr.sort((a, b) => {
      const va = sortCol === 'usageCount' ? a.usageCount : new Date(a[sortCol]).getTime();
      const vb = sortCol === 'usageCount' ? b.usageCount : new Date(b[sortCol]).getTime();
      return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
    return arr;
  }, [singleCoupons, searchQ, filterStatus, sortCol, sortDir]);

  const filteredGroups = useMemo(() => {
    if (!searchQ) return bulkGroups;
    const q = searchQ.toLowerCase();
    return bulkGroups.filter(g => g.groupName.toLowerCase().includes(q) || g.groupId.toLowerCase().includes(q));
  }, [bulkGroups, searchQ]);

  // ── RENDER ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-10">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-xl border text-sm font-medium ${toast.type === 'success' ? 'bg-green-900 border-green-600 text-green-200' : 'bg-red-900 border-red-600 text-red-200'}`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Tag size={24} className="text-indigo-400" /> Coupon Management
          </h1>
          <p className="text-gray-400 text-sm mt-1">Create, manage, and track coupons and promotions</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Btn variant="ghost" size="sm" onClick={loadAudit}><FileText size={14} />Audit Log</Btn>
          <Btn variant="ghost" size="sm" onClick={loadAll}><RefreshCw size={14} />Refresh</Btn>
          <Btn variant="secondary" onClick={() => setShowCreateModal('bulk')}>
            <Package size={14} />Bulk Coupons
          </Btn>
          <Btn variant="primary" onClick={() => setShowCreateModal('single')}>
            <Plus size={14} />Single Coupon
          </Btn>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Single Coupons', val: singleCoupons.length, icon: Tag, color: 'text-indigo-400' },
          { label: 'Bulk Groups', val: bulkGroups.length, icon: Layers, color: 'text-purple-400' },
          { label: 'Active', val: singleCoupons.filter(c => c.status === 'active').length, icon: CheckCircle, color: 'text-green-400' },
          { label: 'Total Usage', val: singleCoupons.reduce((s, c) => s + c.usageCount, 0), icon: BarChart2, color: 'text-yellow-400' },
        ].map(({ label, val, icon: Icon, color }) => (
          <Card key={label} className="p-4 flex items-center gap-3">
            <Icon size={24} className={color} />
            <div>
              <p className="text-2xl font-bold text-white">{val}</p>
              <p className="text-xs text-gray-400">{label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-700">
        {(['single', 'bulk'] as const).map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`pb-3 px-1 border-b-2 text-sm font-medium transition-colors ${activeTab === t ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-400 hover:text-white'}`}
          >
            {t === 'single' ? `Single Coupons (${singleCoupons.length})` : `Bulk Groups (${bulkGroups.length})`}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500"
            placeholder={activeTab === 'single' ? 'Search by code, ID, tracking ID...' : 'Search by group name or group ID...'}
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
          />
        </div>
        {activeTab === 'single' && (
          <>
            <select
              className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="expired">Expired</option>
              <option value="scheduled">Scheduled</option>
            </select>
            <select
              className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm"
              value={`${sortCol}_${sortDir}`}
              onChange={e => {
                const [col, dir] = e.target.value.split('_') as [typeof sortCol, typeof sortDir];
                setSortCol(col); setSortDir(dir);
              }}
            >
              <option value="createdAt_desc">Newest First</option>
              <option value="createdAt_asc">Oldest First</option>
              <option value="usageCount_desc">Most Used</option>
              <option value="endDate_asc">Expiring Soon</option>
            </select>
          </>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-40 gap-3 text-gray-400">
          <Loader size={28} className="animate-spin text-indigo-400" />
          <span>Loading coupons...</span>
        </div>
      ) : activeTab === 'single' ? (
        /* SINGLE COUPONS TABLE */
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-900/60">
                <tr className="text-gray-400 text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">Coupon ID</th>
                  <th className="px-4 py-3 text-left">Code</th>
                  <th className="px-4 py-3 text-left">Discount</th>
                  <th className="px-4 py-3 text-left">Min. Purchase</th>
                  <th className="px-4 py-3 text-left">Timeline</th>
                  <th className="px-4 py-3 text-left">Usage</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {filteredSingle.length === 0 && (
                  <tr><td colSpan={8} className="text-center text-gray-500 py-10">No coupons found</td></tr>
                )}
                {filteredSingle.map(c => (
                  <React.Fragment key={c.id}>
                    <tr className="hover:bg-gray-700/30 transition-colors">
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs">{c.id.slice(0, 12)}…</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-indigo-400">{c.couponCode}</span>
                          <button onClick={() => { navigator.clipboard.writeText(c.couponCode); showToast('Copied!'); }}
                            className="text-gray-500 hover:text-gray-300"><Copy size={12} /></button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-white">
                        {c.discountType === 'amount' ? `৳${c.discountValue}` : `${c.discountValue}%`}
                        {c.maxDiscount ? <span className="text-gray-500 text-xs ml-1">(max ৳{c.maxDiscount})</span> : null}
                      </td>
                      <td className="px-4 py-3 text-gray-300">৳{c.minimumPurchase}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        <div>{fmt(c.startDate)}</div>
                        <div className="text-gray-500">→ {fmt(c.endDate)}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {c.usageCount} / {c.usageLimit}
                      </td>
                      <td className="px-4 py-3">{statusBadge(c.status)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Btn variant="ghost" size="sm" onClick={() => setShowDetailId(showDetailId === c.id ? null : c.id)}>
                            <Eye size={14} />
                          </Btn>
                          <Btn variant="ghost" size="sm" onClick={() => handleToggleStatus(c)}
                            title={c.status === 'active' ? 'Deactivate' : 'Activate'}>
                            {c.status === 'active' ? <ToggleRight size={14} className="text-green-400" /> : <ToggleLeft size={14} className="text-gray-400" />}
                          </Btn>
                          <Btn variant="ghost" size="sm" onClick={() => handleDelete(c)}>
                            <Trash2 size={14} className="text-red-400" />
                          </Btn>
                        </div>
                      </td>
                    </tr>
                    {showDetailId === c.id && (
                      <tr>
                        <td colSpan={8} className="px-4 pb-3">
                          <CouponDetail coupon={c} courses={courses} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        /* BULK GROUPS */
        <div className="space-y-4">
          {filteredGroups.length === 0 && (
            <Card className="p-10 text-center text-gray-500">No bulk coupon groups found</Card>
          )}
          {filteredGroups.map(group => (
            <Card key={group.id} className="overflow-hidden">
              <button
                className="w-full flex items-center justify-between p-4 hover:bg-gray-700/30 transition-colors text-left"
                onClick={() => toggleGroup(group.id)}
              >
                <div className="flex items-center gap-3">
                  {expandedGroups.has(group.id) ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
                  <Package size={20} className="text-purple-400" />
                  <div>
                    <p className="font-semibold text-white">{group.groupName}</p>
                    <p className="text-xs text-gray-400">ID: <span className="text-indigo-400 font-mono">{group.groupId}</span> • {group.couponCount} coupons • Created {fmt(group.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="info">{group.couponCount} coupons</Badge>
                </div>
              </button>

              {expandedGroups.has(group.id) && (
                <div className="border-t border-gray-700">
                  {!groupCoupons[group.id] ? (
                    <div className="flex items-center justify-center p-6 gap-2 text-gray-400">
                      <Loader size={18} className="animate-spin" /> Loading...
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-900/60">
                          <tr className="text-gray-400 text-xs uppercase tracking-wider">
                            <th className="px-4 py-2 text-left">Tracking ID</th>
                            <th className="px-4 py-2 text-left">Code</th>
                            <th className="px-4 py-2 text-left">Discount</th>
                            <th className="px-4 py-2 text-left">Usage</th>
                            <th className="px-4 py-2 text-left">Status</th>
                            <th className="px-4 py-2 text-left">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700/50">
                          {groupCoupons[group.id].map(c => (
                            <tr key={c.id} className="hover:bg-gray-700/20">
                              <td className="px-4 py-2 font-mono text-xs text-gray-400">{c.trackingId}</td>
                              <td className="px-4 py-2">
                                <div className="flex items-center gap-1">
                                  <span className="font-mono text-indigo-400">{c.couponCode}</span>
                                  <button onClick={() => { navigator.clipboard.writeText(c.couponCode); showToast('Copied!'); }}
                                    className="text-gray-500 hover:text-gray-300"><Copy size={11} /></button>
                                </div>
                              </td>
                              <td className="px-4 py-2 text-white text-xs">
                                {c.discountType === 'amount' ? `৳${c.discountValue}` : `${c.discountValue}%`}
                              </td>
                              <td className="px-4 py-2 text-gray-300 text-xs">{c.usageCount}/{c.usageLimit}</td>
                              <td className="px-4 py-2">{statusBadge(c.status)}</td>
                              <td className="px-4 py-2">
                                <div className="flex gap-1">
                                  <Btn variant="ghost" size="sm" onClick={() => handleToggleStatus(c)}>
                                    {c.status === 'active' ? <ToggleRight size={13} className="text-green-400" /> : <ToggleLeft size={13} />}
                                  </Btn>
                                  <Btn variant="ghost" size="sm" onClick={() => handleDelete(c)}>
                                    <Trash2 size={13} className="text-red-400" />
                                  </Btn>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* ── CREATE MODAL ── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-4xl my-8 shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-700">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                {showCreateModal === 'bulk' ? <Package size={20} className="text-purple-400" /> : <Tag size={20} className="text-indigo-400" />}
                {showCreateModal === 'bulk' ? 'Create Bulk Coupon Group' : 'Create Single Coupon'}
              </h2>
              <button onClick={() => setShowCreateModal(null)} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400">
                <X size={20} />
              </button>
            </div>
            <div className="p-5">
              <CouponForm
                courses={courses}
                users={users}
                onSubmit={showCreateModal === 'bulk' ? handleCreateBulk : handleCreateSingle}
                onClose={() => setShowCreateModal(null)}
                isBulk={showCreateModal === 'bulk'}
                bulkGroupName={bulkGroupName}
                bulkGroupId={bulkGroupId}
                bulkQuantity={bulkQuantity}
                onBulkFieldChange={(f, v) => {
                  if (f === 'groupName') setBulkGroupName(String(v));
                  if (f === 'groupId') setBulkGroupId(String(v));
                  if (f === 'quantity') setBulkQuantity(Number(v));
                }}
                bulkErrors={bulkErrors}
                saving={saving}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── SUCCESS MODAL ── */}
      {successData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl shadow-2xl p-6">
            <SuccessScreen
              coupons={successData.coupons}
              group={successData.group}
              onClose={() => setSuccessData(null)}
            />
          </div>
        </div>
      )}

      {/* ── AUDIT LOG MODAL ── */}
      {showAuditModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl my-8 shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-700">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <FileText size={20} className="text-yellow-400" /> Audit Log
              </h2>
              <button onClick={() => setShowAuditModal(false)} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 max-h-[70vh] overflow-y-auto">
              {auditLogs.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No audit logs found</p>
              ) : (
                <div className="space-y-2">
                  {auditLogs.map(log => (
                    <div key={log.id} className="bg-gray-800 rounded-lg p-3 text-sm border border-gray-700">
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant={
                          log.actionType.includes('create') ? 'success' :
                          log.actionType === 'delete' ? 'error' :
                          log.actionType === 'deactivate' ? 'warning' : 'info'
                        }>
                          {log.actionType.replace(/_/g, ' ').toUpperCase()}
                        </Badge>
                        <span className="text-xs text-gray-500">{fmt(log.timestamp)}</span>
                      </div>
                      <p className="text-gray-300">
                        <span className="text-gray-400">By: </span>{log.actorName || log.actorUserId}
                        {log.couponCode && <><span className="text-gray-400"> | Code: </span><span className="text-indigo-400 font-mono">{log.couponCode}</span></>}
                        {log.groupId && <><span className="text-gray-400"> | Group: </span><span className="text-purple-400">{log.groupId}</span></>}
                      </p>
                      {log.adminComments && <p className="text-xs text-gray-500 mt-1 italic">{log.adminComments}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CouponManagement;
