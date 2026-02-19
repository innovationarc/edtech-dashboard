// src/services/couponService.ts
import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  query, where, Timestamp, writeBatch, increment
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ==================== INTERFACES ====================

export type DiscountType = 'amount' | 'percentage';
export type CouponStatus = 'active' | 'inactive' | 'expired' | 'scheduled';

export interface CourseFilter {
  type: 'all' | 'specific';
  courseIds?: string[];
}

export interface UserFilter {
  type: 'all' | 'specific';
  userIds?: string[];
}

export interface CategoryFilter {
  type: 'all' | 'specific';
  categories?: string[];
  classes?: string[];
}

export interface NextPurchaseEligibility {
  enabled: boolean;
  anyCourse: boolean;
  requiredCourseIds: string[];
}

export interface Coupon {
  id: string;
  couponCode: string;
  discountType: DiscountType;
  discountValue: number;
  maxDiscount?: number;
  minimumPurchase: number;
  courseFilter: CourseFilter;
  userFilter: UserFilter;
  categoryFilter: CategoryFilter;
  startDate: Date;
  endDate: Date;
  activationDate?: Date;
  usageLimit: number | 'unlimited';
  perUserLimit: number;
  cooldownHours: number;
  usageCount: number;
  status: CouponStatus;
  adminComments?: string;
  successMessage?: string;
  nextPurchaseEligibility: NextPurchaseEligibility;
  bulkGroupId?: string | null;
  bulkGroupName?: string | null;
  trackingId?: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BulkGroup {
  id: string;
  groupName: string;
  groupId: string;
  couponCount: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EditChanges {
  field: string;
  previousValue: any;
  newValue: any;
}

export interface AuditLog {
  id: string;
  actionType: 'create_single' | 'create_bulk_group' | 'update' | 'update_group' | 'update_group_tokens' | 'activate' | 'deactivate' | 'delete' | 'delete_group';
  actorUserId: string;
  actorName?: string;
  couponId?: string;
  couponCode?: string;
  groupId?: string;
  groupName?: string;
  adminComments?: string;
  changes?: EditChanges[];
  affectedCount?: number;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface CouponValidationResult {
  valid: boolean;
  reason?: string;
  discount?: number;
  finalPrice?: number;
  successMessage?: string;
  cooldownEndsAt?: Date;
}

/**
 * The record written to the `couponUsage` collection each time a coupon is redeemed.
 * Core fields (couponId, userId, courseId, usedAt) are always written.
 * Rich fields (userName, courseName, discountApplied, amountPaid) are written
 * by the enrollment page when it supplies them — the Statistics modal reads all of them.
 */
export interface RecordCouponUsageInput {
  couponId: string;
  userId: string;
  courseId: string;
  userName?: string;
  courseName?: string;
  discountApplied?: number;
  amountPaid?: number;
}

export interface CreateSingleCouponInput {
  couponCode: string;
  discountType: DiscountType;
  discountValue: number;
  maxDiscount?: number;
  minimumPurchase: number;
  courseFilter: CourseFilter;
  userFilter: UserFilter;
  categoryFilter: CategoryFilter;
  startDate: Date;
  endDate: Date;
  activationDate?: Date;
  usageLimit: number | 'unlimited';
  perUserLimit: number;
  cooldownHours: number;
  adminComments?: string;
  successMessage?: string;
  nextPurchaseEligibility: NextPurchaseEligibility;
  actorUserId: string;
  actorName?: string;
}

export interface CreateBulkCouponInput extends Omit<CreateSingleCouponInput, 'couponCode'> {
  groupName: string;
  groupId: string;
  quantity: number;
  codePrefix?: string;
}

export interface UpdateCouponInput {
  discountType: DiscountType;
  discountValue: number;
  maxDiscount?: number;
  minimumPurchase: number;
  courseFilter: CourseFilter;
  userFilter: UserFilter;
  categoryFilter: CategoryFilter;
  startDate: Date;
  endDate: Date;
  activationDate?: Date;
  usageLimit: number | 'unlimited';
  perUserLimit: number;
  cooldownHours: number;
  adminComments?: string;
  successMessage?: string;
  nextPurchaseEligibility: NextPurchaseEligibility;
  actorUserId: string;
  actorName?: string;
}

export interface UpdateBulkGroupInput {
  groupName: string;
  applyToTokens?: boolean;
  discountType?: DiscountType;
  discountValue?: number;
  maxDiscount?: number;
  minimumPurchase?: number;
  courseFilter?: CourseFilter;
  userFilter?: UserFilter;
  categoryFilter?: CategoryFilter;
  startDate?: Date;
  endDate?: Date;
  activationDate?: Date;
  usageLimit?: number | 'unlimited';
  perUserLimit?: number;
  cooldownHours?: number;
  adminComments?: string;
  successMessage?: string;
  nextPurchaseEligibility?: NextPurchaseEligibility;
  actorUserId: string;
  actorName?: string;
}

// ==================== HELPERS ====================

const generateCouponCode = (prefix?: string): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const random = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return prefix ? `${prefix.toUpperCase().slice(0, 6)}-${random}` : random;
};

const toTs = (d: Date) => Timestamp.fromDate(d);

const toDate = (v: any): Date => {
  if (!v) return new Date();
  if (typeof v.toDate === 'function') return v.toDate();
  if (v instanceof Date) return v;
  return new Date(v);
};

/**
 * BUG FIX 1 & 2: Compute the effective runtime status of a coupon based on its dates.
 *
 * Rules (evaluated in order):
 *  1. If now > endDate          → 'expired'   (regardless of stored status)
 *  2. If activationDate is set and now < activationDate → 'scheduled'
 *     (the coupon exists but hasn't been "activated" yet — distinct from startDate)
 *  3. If now < startDate        → 'scheduled'  (coupon period hasn't begun)
 *  4. Otherwise keep the stored status ('active' or 'inactive')
 *
 * startDate  = when the coupon becomes usable
 * activationDate = an optional admin-controlled gate that must also pass before the
 *                  coupon is usable (useful for drip-release campaigns where you set
 *                  dates ahead of time but want a separate activation switch)
 */
const computeEffectiveStatus = (
  storedStatus: string,
  startDate: Date,
  endDate: Date,
  activationDate?: Date
): CouponStatus => {
  const now = new Date();

  // Expired: end date has passed
  if (now > endDate) return 'expired';

  // Scheduled: activation date hasn't arrived yet
  if (activationDate && now < activationDate) return 'scheduled';

  // Scheduled: start date hasn't arrived yet
  if (now < startDate) return 'scheduled';

  // Within valid window — respect stored active/inactive toggle
  return (storedStatus === 'active' || storedStatus === 'inactive')
    ? (storedStatus as CouponStatus)
    : 'active';
};

const fromFirestore = (data: any, id: string): Coupon => {
  const startDate = toDate(data.startDate);
  const endDate = toDate(data.endDate);
  const activationDate = data.activationDate ? toDate(data.activationDate) : undefined;
  const effectiveStatus = computeEffectiveStatus(data.status || 'active', startDate, endDate, activationDate);

  return {
    id,
    couponCode: data.couponCode || '',
    discountType: data.discountType || 'amount',
    discountValue: data.discountValue || 0,
    maxDiscount: data.maxDiscount ?? undefined,
    minimumPurchase: data.minimumPurchase || 0,
    courseFilter: data.courseFilter || { type: 'all' },
    userFilter: data.userFilter || { type: 'all' },
    categoryFilter: data.categoryFilter || { type: 'all' },
    startDate,
    endDate,
    activationDate,
    usageLimit: data.usageLimit ?? 'unlimited',
    perUserLimit: data.perUserLimit || 1,
    cooldownHours: data.cooldownHours || 0,
    usageCount: data.usageCount || 0,
    status: effectiveStatus,
    adminComments: data.adminComments || '',
    successMessage: data.successMessage || '',
    nextPurchaseEligibility: data.nextPurchaseEligibility || { enabled: false, anyCourse: false, requiredCourseIds: [] },
    bulkGroupId: data.bulkGroupId ?? null,
    bulkGroupName: data.bulkGroupName ?? null,
    trackingId: data.trackingId ?? null,
    createdBy: data.createdBy || '',
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
};

const fromFirestoreGroup = (data: any, id: string): BulkGroup => ({
  id,
  groupName: data.groupName || '',
  groupId: data.groupId || '',
  couponCount: data.couponCount || 0,
  createdBy: data.createdBy || '',
  createdAt: toDate(data.createdAt),
  updatedAt: toDate(data.updatedAt),
});

const fromFirestoreLog = (data: any, id: string): AuditLog => ({
  id,
  actionType: data.actionType,
  actorUserId: data.actorUserId || '',
  actorName: data.actorName,
  couponId: data.couponId,
  couponCode: data.couponCode,
  groupId: data.groupId,
  groupName: data.groupName,
  adminComments: data.adminComments,
  changes: data.changes,
  affectedCount: data.affectedCount,
  metadata: data.metadata,
  timestamp: toDate(data.timestamp),
});

const auditLog = async (log: Omit<AuditLog, 'id'>): Promise<void> => {
  try {
    await addDoc(collection(db, 'couponAuditLogs'), { ...log, timestamp: toTs(log.timestamp) });
  } catch { /* silent */ }
};

const computeChanges = (prev: Coupon, next: Record<string, any>): EditChanges[] => {
  const changes: EditChanges[] = [];
  const fields: Array<{ key: keyof Coupon; label: string; serialize?: (v: any) => string }> = [
    { key: 'discountType', label: 'Discount Type' },
    { key: 'discountValue', label: 'Discount Value' },
    { key: 'maxDiscount', label: 'Max Discount Cap' },
    { key: 'minimumPurchase', label: 'Minimum Purchase' },
    { key: 'startDate', label: 'Start Date', serialize: (v) => v instanceof Date ? v.toISOString() : String(v) },
    { key: 'endDate', label: 'End Date', serialize: (v) => v instanceof Date ? v.toISOString() : String(v) },
    { key: 'activationDate', label: 'Activation Date', serialize: (v) => v instanceof Date ? v.toISOString() : String(v) },
    { key: 'usageLimit', label: 'Usage Limit' },
    { key: 'perUserLimit', label: 'Per-User Limit' },
    { key: 'cooldownHours', label: 'Cooldown Hours' },
    { key: 'adminComments', label: 'Admin Comments' },
    { key: 'successMessage', label: 'Success Message' },
    { key: 'courseFilter', label: 'Course Filter', serialize: (v) => JSON.stringify(v) },
    { key: 'userFilter', label: 'User Filter', serialize: (v) => JSON.stringify(v) },
    { key: 'categoryFilter', label: 'Category Filter', serialize: (v) => JSON.stringify(v) },
    { key: 'nextPurchaseEligibility', label: 'Next Purchase Eligibility', serialize: (v) => JSON.stringify(v) },
  ];

  for (const { key, label, serialize } of fields) {
    const prevVal = prev[key];
    const newVal = next[key as string];
    if (newVal === undefined) continue;
    const prevStr = serialize ? serialize(prevVal) : String(prevVal ?? '');
    const newStr = serialize ? serialize(newVal) : String(newVal ?? '');
    if (prevStr !== newStr) {
      changes.push({ field: label, previousValue: prevVal, newValue: newVal });
    }
  }

  return changes;
};

// ==================== SERVICE ====================

export const couponService = {

  async createSingleCoupon(input: CreateSingleCouponInput): Promise<Coupon> {
    if (!input.couponCode?.trim()) throw new Error('Coupon code is required.');
    if (input.startDate >= input.endDate) throw new Error('Start date must be before end date.');
    if (input.discountType === 'percentage' && !input.maxDiscount) throw new Error('Percentage discounts require a maximum discount cap.');
    if (input.discountType === 'percentage' && (input.discountValue <= 0 || input.discountValue > 100)) throw new Error('Percentage discount must be between 1 and 100.');
    if (input.minimumPurchase < 0) throw new Error('Minimum purchase must be >= 0.');
    if (input.nextPurchaseEligibility.enabled && !input.nextPurchaseEligibility.anyCourse && input.nextPurchaseEligibility.requiredCourseIds.length === 0) {
      throw new Error('Next-purchase eligibility requires selecting at least one course (or "Any Course").');
    }

    const existing = await this.getCouponByCode(input.couponCode);
    if (existing) throw new Error(`Coupon code "${input.couponCode.toUpperCase()}" already exists.`);

    const now = new Date();
    // Determine initial stored status: inactive if not yet started/activated, active otherwise
    // The effectiveStatus computed at read-time will handle expired/scheduled dynamically,
    // but we store 'active' as the intent so toggling works correctly.
    const docData = {
      couponCode: input.couponCode.toUpperCase().trim(),
      discountType: input.discountType,
      discountValue: input.discountValue,
      maxDiscount: input.maxDiscount || null,
      minimumPurchase: input.minimumPurchase,
      courseFilter: input.courseFilter,
      userFilter: input.userFilter,
      categoryFilter: input.categoryFilter,
      startDate: toTs(input.startDate),
      endDate: toTs(input.endDate),
      activationDate: input.activationDate ? toTs(input.activationDate) : null,
      usageLimit: input.usageLimit,
      perUserLimit: input.perUserLimit,
      cooldownHours: input.cooldownHours || 0,
      usageCount: 0,
      status: 'active', // stored intent; effective status computed at read-time
      adminComments: input.adminComments || '',
      successMessage: input.successMessage || '',
      nextPurchaseEligibility: input.nextPurchaseEligibility,
      bulkGroupId: null, bulkGroupName: null, trackingId: null,
      createdBy: input.actorUserId,
      createdAt: toTs(now), updatedAt: toTs(now),
    };

    const ref = await addDoc(collection(db, 'coupons'), docData);
    const coupon = fromFirestore(docData, ref.id);

    await auditLog({ actionType: 'create_single', actorUserId: input.actorUserId, actorName: input.actorName, couponId: ref.id, couponCode: docData.couponCode, adminComments: input.adminComments, timestamp: now });

    return coupon;
  },

  async createBulkCoupons(input: CreateBulkCouponInput): Promise<{ group: BulkGroup; coupons: Coupon[] }> {
    if (!input.groupName?.trim()) throw new Error('Group name is required.');
    if (!input.groupId?.trim()) throw new Error('Group ID is required.');
    if (input.quantity < 1 || input.quantity > 1000) throw new Error('Quantity must be between 1 and 1000.');
    if (input.startDate >= input.endDate) throw new Error('Start date must be before end date.');
    if (input.discountType === 'percentage' && !input.maxDiscount) throw new Error('Percentage discounts require a maximum discount cap.');
    if (input.discountType === 'percentage' && (input.discountValue <= 0 || input.discountValue > 100)) throw new Error('Percentage discount must be between 1 and 100.');
    if (input.minimumPurchase < 0) throw new Error('Minimum purchase must be >= 0.');
    if (input.nextPurchaseEligibility.enabled && !input.nextPurchaseEligibility.anyCourse && input.nextPurchaseEligibility.requiredCourseIds.length === 0) {
      throw new Error('Next-purchase eligibility requires selecting at least one course (or "Any Course").');
    }

    const now = new Date();
    const gid = input.groupId.toUpperCase().trim();
    const gname = input.groupName.trim();

    const groupDocData = { groupName: gname, groupId: gid, couponCount: input.quantity, createdBy: input.actorUserId, createdAt: toTs(now), updatedAt: toTs(now) };
    const groupRef = await addDoc(collection(db, 'bulkCouponGroups'), groupDocData);
    const group = fromFirestoreGroup(groupDocData, groupRef.id);

    const coupons: Coupon[] = [];
    const BATCH_SIZE = 499;
    let serial = 1;

    while (serial <= input.quantity) {
      const batch = writeBatch(db);
      const batchEnd = Math.min(serial + BATCH_SIZE - 1, input.quantity);

      for (let i = serial; i <= batchEnd; i++) {
        const code = generateCouponCode(input.codePrefix || gid);
        const trackingId = `${gid}_${String(i).padStart(5, '0')}`;
        const couponRef = doc(collection(db, 'coupons'));

        const couponData = {
          couponCode: code, discountType: input.discountType, discountValue: input.discountValue,
          maxDiscount: input.maxDiscount || null, minimumPurchase: input.minimumPurchase,
          courseFilter: input.courseFilter, userFilter: input.userFilter, categoryFilter: input.categoryFilter,
          startDate: toTs(input.startDate), endDate: toTs(input.endDate),
          activationDate: input.activationDate ? toTs(input.activationDate) : null,
          usageLimit: input.usageLimit, perUserLimit: input.perUserLimit,
          cooldownHours: input.cooldownHours || 0, usageCount: 0, status: 'active',
          adminComments: input.adminComments || '', successMessage: input.successMessage || '',
          nextPurchaseEligibility: input.nextPurchaseEligibility,
          bulkGroupId: groupRef.id, bulkGroupName: gname, trackingId,
          createdBy: input.actorUserId, createdAt: toTs(now), updatedAt: toTs(now),
        };

        batch.set(couponRef, couponData);
        coupons.push(fromFirestore(couponData, couponRef.id));
      }

      await batch.commit();
      serial = batchEnd + 1;
    }

    await auditLog({ actionType: 'create_bulk_group', actorUserId: input.actorUserId, actorName: input.actorName, groupId: gid, groupName: gname, adminComments: input.adminComments, metadata: { quantity: input.quantity }, timestamp: now });

    return { group, coupons };
  },

  // ── READ ─────────────────────────────────────────────────────────────

  async getAllSingleCoupons(): Promise<Coupon[]> {
    const snap = await getDocs(collection(db, 'coupons'));
    return snap.docs
      .map(d => fromFirestore(d.data(), d.id))
      .filter(c => !c.bulkGroupId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },

  async getAllBulkGroups(): Promise<BulkGroup[]> {
    const snap = await getDocs(collection(db, 'bulkCouponGroups'));
    return snap.docs
      .map(d => fromFirestoreGroup(d.data(), d.id))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },

  async getCouponsByGroupId(groupDocId: string): Promise<Coupon[]> {
    const snap = await getDocs(query(collection(db, 'coupons'), where('bulkGroupId', '==', groupDocId)));
    return snap.docs
      .map(d => fromFirestore(d.data(), d.id))
      .sort((a, b) => (a.trackingId || '').localeCompare(b.trackingId || ''));
  },

  async getCouponByCode(code: string): Promise<Coupon | null> {
    const snap = await getDocs(query(collection(db, 'coupons'), where('couponCode', '==', code.toUpperCase().trim())));
    if (snap.empty) return null;
    return fromFirestore(snap.docs[0].data(), snap.docs[0].id);
  },

  async getCouponById(id: string): Promise<Coupon | null> {
    const d = await getDoc(doc(db, 'coupons', id));
    if (!d.exists()) return null;
    return fromFirestore(d.data(), d.id);
  },

  async getAuditLogs(limitCount = 100): Promise<AuditLog[]> {
    const snap = await getDocs(collection(db, 'couponAuditLogs'));
    return snap.docs
      .map(d => fromFirestoreLog(d.data(), d.id))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limitCount);
  },

  // ── UPDATE ───────────────────────────────────────────────────────────

  async updateCoupon(couponId: string, input: UpdateCouponInput): Promise<Coupon> {
    if (input.startDate >= input.endDate) throw new Error('Start date must be before end date.');
    if (input.discountType === 'percentage' && !input.maxDiscount) throw new Error('Percentage discounts require a maximum discount cap.');
    if (input.discountType === 'percentage' && (input.discountValue <= 0 || input.discountValue > 100)) throw new Error('Percentage discount must be between 1 and 100.');
    if (input.minimumPurchase < 0) throw new Error('Minimum purchase must be >= 0.');
    if (input.nextPurchaseEligibility.enabled && !input.nextPurchaseEligibility.anyCourse && input.nextPurchaseEligibility.requiredCourseIds.length === 0) {
      throw new Error('Next-purchase eligibility requires selecting at least one course (or "Any Course").');
    }

    const prevCoupon = await this.getCouponById(couponId);
    if (!prevCoupon) throw new Error('Coupon not found.');

    const now = new Date();
    const updateData: Record<string, any> = {
      discountType: input.discountType,
      discountValue: input.discountValue,
      maxDiscount: input.maxDiscount || null,
      minimumPurchase: input.minimumPurchase,
      courseFilter: input.courseFilter,
      userFilter: input.userFilter,
      categoryFilter: input.categoryFilter,
      startDate: toTs(input.startDate),
      endDate: toTs(input.endDate),
      activationDate: input.activationDate ? toTs(input.activationDate) : null,
      usageLimit: input.usageLimit,
      perUserLimit: input.perUserLimit,
      cooldownHours: input.cooldownHours || 0,
      adminComments: input.adminComments || '',
      successMessage: input.successMessage || '',
      nextPurchaseEligibility: input.nextPurchaseEligibility,
      updatedAt: toTs(now),
    };

    await updateDoc(doc(db, 'coupons', couponId), updateData);

    const updated = await this.getCouponById(couponId);
    if (!updated) throw new Error('Failed to fetch updated coupon.');

    const changesForLog: Record<string, any> = {
      discountType: input.discountType,
      discountValue: input.discountValue,
      maxDiscount: input.maxDiscount,
      minimumPurchase: input.minimumPurchase,
      startDate: input.startDate,
      endDate: input.endDate,
      activationDate: input.activationDate,
      usageLimit: input.usageLimit,
      perUserLimit: input.perUserLimit,
      cooldownHours: input.cooldownHours || 0,
      adminComments: input.adminComments || '',
      successMessage: input.successMessage || '',
      courseFilter: input.courseFilter,
      userFilter: input.userFilter,
      categoryFilter: input.categoryFilter,
      nextPurchaseEligibility: input.nextPurchaseEligibility,
    };
    const changes = computeChanges(prevCoupon, changesForLog);

    // BUG FIX 3: Always include couponCode in audit log for edit actions
    await auditLog({
      actionType: 'update',
      actorUserId: input.actorUserId,
      actorName: input.actorName,
      couponId,
      couponCode: prevCoupon.couponCode, // use prevCoupon — guaranteed correct code
      adminComments: input.adminComments,
      changes,
      timestamp: now,
    });

    return updated;
  },

  async updateBulkGroup(groupDocId: string, input: UpdateBulkGroupInput): Promise<BulkGroup> {
    const now = new Date();

    await updateDoc(doc(db, 'bulkCouponGroups', groupDocId), {
      groupName: input.groupName.trim(),
      updatedAt: toTs(now),
    });

    const d = await getDoc(doc(db, 'bulkCouponGroups', groupDocId));
    if (!d.exists()) throw new Error('Group not found after update.');
    const updated = fromFirestoreGroup(d.data(), d.id);

    await auditLog({
      actionType: 'update_group',
      actorUserId: input.actorUserId,
      actorName: input.actorName,
      groupId: updated.groupId,
      groupName: updated.groupName,
      timestamp: now,
    });

    if (input.applyToTokens) {
      const tokenSnap = await getDocs(query(collection(db, 'coupons'), where('bulkGroupId', '==', groupDocId)));
      if (!tokenSnap.empty) {
        const tokenUpdate: Record<string, any> = { updatedAt: toTs(now) };
        if (input.discountType !== undefined) tokenUpdate.discountType = input.discountType;
        if (input.discountValue !== undefined) tokenUpdate.discountValue = input.discountValue;
        if (input.maxDiscount !== undefined) tokenUpdate.maxDiscount = input.maxDiscount || null;
        if (input.minimumPurchase !== undefined) tokenUpdate.minimumPurchase = input.minimumPurchase;
        if (input.courseFilter !== undefined) tokenUpdate.courseFilter = input.courseFilter;
        if (input.userFilter !== undefined) tokenUpdate.userFilter = input.userFilter;
        if (input.categoryFilter !== undefined) tokenUpdate.categoryFilter = input.categoryFilter;
        if (input.startDate !== undefined) tokenUpdate.startDate = toTs(input.startDate);
        if (input.endDate !== undefined) tokenUpdate.endDate = toTs(input.endDate);
        if (input.activationDate !== undefined) tokenUpdate.activationDate = input.activationDate ? toTs(input.activationDate) : null;
        if (input.usageLimit !== undefined) tokenUpdate.usageLimit = input.usageLimit;
        if (input.perUserLimit !== undefined) tokenUpdate.perUserLimit = input.perUserLimit;
        if (input.cooldownHours !== undefined) tokenUpdate.cooldownHours = input.cooldownHours || 0;
        if (input.adminComments !== undefined) tokenUpdate.adminComments = input.adminComments || '';
        if (input.successMessage !== undefined) tokenUpdate.successMessage = input.successMessage || '';
        if (input.nextPurchaseEligibility !== undefined) tokenUpdate.nextPurchaseEligibility = input.nextPurchaseEligibility;
        tokenUpdate.bulkGroupName = input.groupName.trim();

        const firstToken = fromFirestore(tokenSnap.docs[0].data(), tokenSnap.docs[0].id);
        const changesForLog: Record<string, any> = {};
        if (input.discountType !== undefined) changesForLog.discountType = input.discountType;
        if (input.discountValue !== undefined) changesForLog.discountValue = input.discountValue;
        if (input.maxDiscount !== undefined) changesForLog.maxDiscount = input.maxDiscount;
        if (input.minimumPurchase !== undefined) changesForLog.minimumPurchase = input.minimumPurchase;
        if (input.startDate !== undefined) changesForLog.startDate = input.startDate;
        if (input.endDate !== undefined) changesForLog.endDate = input.endDate;
        if (input.activationDate !== undefined) changesForLog.activationDate = input.activationDate;
        if (input.usageLimit !== undefined) changesForLog.usageLimit = input.usageLimit;
        if (input.perUserLimit !== undefined) changesForLog.perUserLimit = input.perUserLimit;
        if (input.cooldownHours !== undefined) changesForLog.cooldownHours = input.cooldownHours || 0;
        if (input.adminComments !== undefined) changesForLog.adminComments = input.adminComments || '';
        if (input.successMessage !== undefined) changesForLog.successMessage = input.successMessage || '';
        if (input.courseFilter !== undefined) changesForLog.courseFilter = input.courseFilter;
        if (input.userFilter !== undefined) changesForLog.userFilter = input.userFilter;
        if (input.categoryFilter !== undefined) changesForLog.categoryFilter = input.categoryFilter;
        if (input.nextPurchaseEligibility !== undefined) changesForLog.nextPurchaseEligibility = input.nextPurchaseEligibility;
        const changes = computeChanges(firstToken, changesForLog);

        const BATCH_SIZE = 499;
        const docs = tokenSnap.docs;
        for (let i = 0; i < docs.length; i += BATCH_SIZE) {
          const batch = writeBatch(db);
          docs.slice(i, i + BATCH_SIZE).forEach(d => batch.update(d.ref, tokenUpdate));
          await batch.commit();
        }

        await auditLog({
          actionType: 'update_group_tokens',
          actorUserId: input.actorUserId,
          actorName: input.actorName,
          groupId: updated.groupId,
          groupName: updated.groupName,
          changes,
          affectedCount: docs.length,
          timestamp: now,
        });
      }
    }

    return updated;
  },

  // ── TOGGLE / DELETE ──────────────────────────────────────────────────

  async toggleCouponStatus(couponId: string, newStatus: 'active' | 'inactive', actorUserId: string, actorName?: string): Promise<void> {
    const now = new Date();
    // BUG FIX 3: Fetch coupon first to get couponCode for audit log
    const coupon = await this.getCouponById(couponId);
    await updateDoc(doc(db, 'coupons', couponId), { status: newStatus, updatedAt: toTs(now) });
    await auditLog({
      actionType: newStatus === 'active' ? 'activate' : 'deactivate',
      actorUserId,
      actorName,
      couponId,
      couponCode: coupon?.couponCode, // FIX: now included
      timestamp: now,
    });
  },

  async deleteCoupon(couponId: string, actorUserId: string, actorName?: string): Promise<void> {
    const coupon = await this.getCouponById(couponId);
    const now = new Date();

    // BUG FIX 4: If this coupon belongs to a group, decrement the group's couponCount
    if (coupon?.bulkGroupId) {
      try {
        await updateDoc(doc(db, 'bulkCouponGroups', coupon.bulkGroupId), {
          couponCount: increment(-1),
          updatedAt: toTs(now),
        });
      } catch {
        // Non-fatal: group may have already been deleted or doesn't exist
      }
    }

    await deleteDoc(doc(db, 'coupons', couponId));
    // BUG FIX 3: coupon?.couponCode is already fetched above — always present
    await auditLog({
      actionType: 'delete',
      actorUserId,
      actorName,
      couponId,
      couponCode: coupon?.couponCode,
      timestamp: now,
    });
  },

  async deleteBulkGroup(groupDocId: string, actorUserId: string, actorName?: string): Promise<void> {
    const groupDoc = await getDoc(doc(db, 'bulkCouponGroups', groupDocId));
    const groupData = groupDoc.exists() ? groupDoc.data() : null;

    const now = new Date();
    const BATCH_SIZE = 499;

    const tokenSnap = await getDocs(
      query(collection(db, 'coupons'), where('bulkGroupId', '==', groupDocId))
    );

    for (let i = 0; i < tokenSnap.docs.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      tokenSnap.docs.slice(i, i + BATCH_SIZE).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    await deleteDoc(doc(db, 'bulkCouponGroups', groupDocId));

    await auditLog({
      actionType: 'delete_group',
      actorUserId,
      actorName,
      groupId: groupData?.groupId,
      groupName: groupData?.groupName,
      metadata: { deletedTokenCount: tokenSnap.docs.length },
      timestamp: now,
    });
  },

  // ── CHECKOUT VALIDATION ──────────────────────────────────────────────

  async validateCoupon(
    couponCode: string,
    userId: string,
    courseId: string,
    purchaseAmount: number,
    userEnrolledCourseIds: string[]
  ): Promise<CouponValidationResult> {
    const coupon = await this.getCouponByCode(couponCode);
    if (!coupon) return { valid: false, reason: 'Coupon not found.' };

    const now = new Date();

    // BUG FIX 1: Check expiry
    if (now > coupon.endDate) return { valid: false, reason: 'Coupon has expired.' };

    // BUG FIX 2: Check activation date — coupon is not yet released to users
    if (coupon.activationDate && now < coupon.activationDate) {
      return { valid: false, reason: 'Coupon is not yet active.' };
    }

    // BUG FIX 2: Check start date — coupon period hasn't begun
    if (now < coupon.startDate) return { valid: false, reason: 'Coupon has not started yet.' };

    // Check stored status (admin manually deactivated)
    // We check effective status after date checks; if effective is expired/scheduled, already caught above.
    if (coupon.status === 'inactive') return { valid: false, reason: 'Coupon is not active.' };
    if (coupon.status === 'expired') return { valid: false, reason: 'Coupon has expired.' };
    if (coupon.status === 'scheduled') return { valid: false, reason: 'Coupon is not yet active.' };

    if (coupon.usageLimit !== 'unlimited' && coupon.usageCount >= (coupon.usageLimit as number)) {
      return { valid: false, reason: 'Coupon usage limit reached.' };
    }
    if (purchaseAmount < coupon.minimumPurchase) {
      return { valid: false, reason: `Minimum purchase of ৳${coupon.minimumPurchase} required.` };
    }
    if (coupon.userFilter.type === 'specific' && !coupon.userFilter.userIds?.includes(userId)) {
      return { valid: false, reason: 'This coupon is not valid for your account.' };
    }
    if (coupon.courseFilter.type === 'specific' && !coupon.courseFilter.courseIds?.includes(courseId)) {
      return { valid: false, reason: 'This coupon is not valid for this course.' };
    }

    if (coupon.nextPurchaseEligibility?.enabled) {
      const enrolled = userEnrolledCourseIds.length > 0;
      if (coupon.nextPurchaseEligibility.anyCourse) {
        if (!enrolled) return { valid: false, reason: 'You must be enrolled in at least one course to use this coupon.' };
      } else {
        const hasReq = (coupon.nextPurchaseEligibility.requiredCourseIds || []).some(id => userEnrolledCourseIds.includes(id));
        if (!hasReq) return { valid: false, reason: 'You must be enrolled in a required course to use this coupon.' };
      }
    }

    const usageSnap = await getDocs(
      query(collection(db, 'couponUsage'), where('couponId', '==', coupon.id), where('userId', '==', userId))
    );
    const usageCount = usageSnap.size;

    if (usageCount >= coupon.perUserLimit) {
      if (coupon.cooldownHours > 0 && usageCount >= 1) {
        const usages = usageSnap.docs
          .map(d => ({ usedAt: toDate(d.data().usedAt) }))
          .sort((a, b) => b.usedAt.getTime() - a.usedAt.getTime());

        const lastUsed = usages[0]?.usedAt;
        if (lastUsed) {
          const cooldownEndsAt = new Date(lastUsed.getTime() + coupon.cooldownHours * 60 * 60 * 1000);
          if (now < cooldownEndsAt) {
            return {
              valid: false,
              reason: `Coupon is in cooldown. Available again after ${cooldownEndsAt.toLocaleString('en-BD')}.`,
              cooldownEndsAt,
            };
          }
        }
      } else {
        return { valid: false, reason: 'You have reached the per-user limit for this coupon.' };
      }
    }

    let discount = 0;
    if (coupon.discountType === 'amount') {
      discount = Math.min(coupon.discountValue, purchaseAmount);
    } else {
      discount = (purchaseAmount * coupon.discountValue) / 100;
      if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
    }

    return {
      valid: true,
      discount,
      finalPrice: Math.max(0, purchaseAmount - discount),
      successMessage: coupon.successMessage || undefined,
    };
  },

  /**
   * Records a coupon usage after a successful enrollment/purchase.
   *
   * CURRENT USAGE (before enrollment page upgrade):
   *   await couponService.recordCouponUsage({ couponId, userId, courseId });
   *
   * FUTURE USAGE (after enrollment page upgrade — unlocks full statistics):
   *   await couponService.recordCouponUsage({
   *     couponId, userId, courseId,
   *     userName: user.name,
   *     courseName: course.title,
   *     discountApplied: validationResult.discount,
   *     amountPaid: validationResult.finalPrice,
   *   });
   */
  async recordCouponUsage(input: RecordCouponUsageInput): Promise<void> {
    const now = Timestamp.now();
    const usageData: Record<string, any> = {
      couponId: input.couponId,
      userId: input.userId,
      courseId: input.courseId,
      usedAt: now,
    };

    if (input.userName !== undefined) usageData.userName = input.userName;
    if (input.courseName !== undefined) usageData.courseName = input.courseName;
    if (input.discountApplied !== undefined) usageData.discountApplied = input.discountApplied;
    if (input.amountPaid !== undefined) usageData.amountPaid = input.amountPaid;

    const batch = writeBatch(db);
    batch.update(doc(db, 'coupons', input.couponId), { usageCount: increment(1), updatedAt: now });
    batch.set(doc(collection(db, 'couponUsage')), usageData);
    await batch.commit();
  },
};

export default couponService;
