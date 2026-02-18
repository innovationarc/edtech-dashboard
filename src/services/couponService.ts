// src/services/couponService.ts
// Production-Grade Coupon Management Service

import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
  writeBatch,
  increment
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
  usageCount: number;
  status: CouponStatus;
  adminComments?: string;
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

export interface AuditLog {
  id: string;
  actionType: 'create_single' | 'create_bulk_group' | 'update' | 'activate' | 'deactivate' | 'delete';
  actorUserId: string;
  actorName?: string;
  couponId?: string;
  couponCode?: string;
  groupId?: string;
  groupName?: string;
  adminComments?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface CouponValidationResult {
  valid: boolean;
  reason?: string;
  discount?: number;
  finalPrice?: number;
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
  adminComments?: string;
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

// ==================== HELPERS ====================

const generateCouponCode = (prefix?: string): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const random = Array.from({ length: 8 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
  return prefix ? `${prefix.toUpperCase().slice(0, 6)}-${random}` : random;
};

const toTs = (d: Date) => Timestamp.fromDate(d);

// Safely convert Firestore Timestamp or string or Date → JS Date
const toDate = (v: any): Date => {
  if (!v) return new Date();
  if (typeof v.toDate === 'function') return v.toDate();
  if (v instanceof Date) return v;
  return new Date(v);
};

const fromFirestore = (data: any, id: string): Coupon => ({
  id,
  couponCode: data.couponCode || '',
  discountType: data.discountType || 'amount',
  discountValue: data.discountValue || 0,
  maxDiscount: data.maxDiscount ?? undefined,
  minimumPurchase: data.minimumPurchase || 0,
  courseFilter: data.courseFilter || { type: 'all' },
  userFilter: data.userFilter || { type: 'all' },
  categoryFilter: data.categoryFilter || { type: 'all' },
  startDate: toDate(data.startDate),
  endDate: toDate(data.endDate),
  activationDate: data.activationDate ? toDate(data.activationDate) : undefined,
  usageLimit: data.usageLimit ?? 'unlimited',
  perUserLimit: data.perUserLimit || 1,
  usageCount: data.usageCount || 0,
  status: data.status || 'active',
  adminComments: data.adminComments || '',
  nextPurchaseEligibility: data.nextPurchaseEligibility || { enabled: false, requiredCourseIds: [] },
  bulkGroupId: data.bulkGroupId ?? null,
  bulkGroupName: data.bulkGroupName ?? null,
  trackingId: data.trackingId ?? null,
  createdBy: data.createdBy || '',
  createdAt: toDate(data.createdAt),
  updatedAt: toDate(data.updatedAt),
});

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
  metadata: data.metadata,
  timestamp: toDate(data.timestamp),
});

const auditLog = async (log: Omit<AuditLog, 'id'>): Promise<void> => {
  try {
    await addDoc(collection(db, 'couponAuditLogs'), {
      ...log,
      timestamp: toTs(log.timestamp),
    });
  } catch {
    // silent — audit must not break main operation
  }
};

// ==================== SERVICE ====================

export const couponService = {

  // ── CREATE SINGLE ────────────────────────────────────────────────────

  async createSingleCoupon(input: CreateSingleCouponInput): Promise<Coupon> {
    if (!input.couponCode?.trim()) throw new Error('Coupon code is required.');
    if (input.startDate >= input.endDate) throw new Error('Start date must be before end date.');
    if (input.discountType === 'percentage' && !input.maxDiscount) {
      throw new Error('Percentage discounts require a maximum discount cap.');
    }
    if (input.discountType === 'percentage' && (input.discountValue <= 0 || input.discountValue > 100)) {
      throw new Error('Percentage discount must be between 1 and 100.');
    }
    if (input.minimumPurchase < 0) throw new Error('Minimum purchase must be >= 0.');
    if (input.nextPurchaseEligibility.enabled && input.nextPurchaseEligibility.requiredCourseIds.length === 0) {
      throw new Error('Next-purchase eligibility requires at least one course.');
    }

    // Check code uniqueness
    const existing = await this.getCouponByCode(input.couponCode);
    if (existing) throw new Error(`Coupon code "${input.couponCode.toUpperCase()}" already exists.`);

    const now = new Date();
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
      usageCount: 0,
      status: 'active',
      adminComments: input.adminComments || '',
      nextPurchaseEligibility: input.nextPurchaseEligibility,
      bulkGroupId: null,
      bulkGroupName: null,
      trackingId: null,
      createdBy: input.actorUserId,
      createdAt: toTs(now),
      updatedAt: toTs(now),
    };

    const ref = await addDoc(collection(db, 'coupons'), docData);
    const coupon = fromFirestore(docData, ref.id);

    await auditLog({
      actionType: 'create_single',
      actorUserId: input.actorUserId,
      actorName: input.actorName,
      couponId: ref.id,
      couponCode: docData.couponCode,
      adminComments: input.adminComments,
      timestamp: now,
    });

    return coupon;
  },

  // ── CREATE BULK ──────────────────────────────────────────────────────

  async createBulkCoupons(input: CreateBulkCouponInput): Promise<{ group: BulkGroup; coupons: Coupon[] }> {
    if (!input.groupName?.trim()) throw new Error('Group name is required.');
    if (!input.groupId?.trim()) throw new Error('Group ID is required.');
    if (input.quantity < 1 || input.quantity > 1000) throw new Error('Quantity must be between 1 and 1000.');
    if (input.startDate >= input.endDate) throw new Error('Start date must be before end date.');
    if (input.discountType === 'percentage' && !input.maxDiscount) {
      throw new Error('Percentage discounts require a maximum discount cap.');
    }
    if (input.nextPurchaseEligibility.enabled && input.nextPurchaseEligibility.requiredCourseIds.length === 0) {
      throw new Error('Next-purchase eligibility requires at least one course.');
    }

    const now = new Date();
    const gid = input.groupId.toUpperCase().trim();
    const gname = input.groupName.trim();

    // Create group doc
    const groupDocData = {
      groupName: gname,
      groupId: gid,
      couponCount: input.quantity,
      createdBy: input.actorUserId,
      createdAt: toTs(now),
      updatedAt: toTs(now),
    };
    const groupRef = await addDoc(collection(db, 'bulkCouponGroups'), groupDocData);
    const group = fromFirestoreGroup(groupDocData, groupRef.id);

    // Generate coupons in batches of 499 (Firestore max is 500 per batch)
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
          couponCode: code,
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
          usageCount: 0,
          status: 'active',
          adminComments: input.adminComments || '',
          nextPurchaseEligibility: input.nextPurchaseEligibility,
          bulkGroupId: groupRef.id,
          bulkGroupName: gname,
          trackingId,
          createdBy: input.actorUserId,
          createdAt: toTs(now),
          updatedAt: toTs(now),
        };

        batch.set(couponRef, couponData);
        coupons.push(fromFirestore(couponData, couponRef.id));
      }

      await batch.commit();
      serial = batchEnd + 1;
    }

    await auditLog({
      actionType: 'create_bulk_group',
      actorUserId: input.actorUserId,
      actorName: input.actorName,
      groupId: gid,
      groupName: gname,
      adminComments: input.adminComments,
      metadata: { quantity: input.quantity },
      timestamp: now,
    });

    return { group, coupons };
  },

  // ── READ ─────────────────────────────────────────────────────────────

  async getAllSingleCoupons(): Promise<Coupon[]> {
    // Fetch entire collection then filter client-side.
    // Avoids composite index requirement for (where bulkGroupId==null + orderBy).
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
    const q = query(collection(db, 'coupons'), where('bulkGroupId', '==', groupDocId));
    const snap = await getDocs(q);
    return snap.docs
      .map(d => fromFirestore(d.data(), d.id))
      .sort((a, b) => (a.trackingId || '').localeCompare(b.trackingId || ''));
  },

  async getCouponByCode(code: string): Promise<Coupon | null> {
    const q = query(
      collection(db, 'coupons'),
      where('couponCode', '==', code.toUpperCase().trim())
    );
    const snap = await getDocs(q);
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

  // ── UPDATE / TOGGLE / DELETE ─────────────────────────────────────────

  async toggleCouponStatus(
    couponId: string,
    newStatus: 'active' | 'inactive',
    actorUserId: string,
    actorName?: string
  ): Promise<void> {
    const now = new Date();
    await updateDoc(doc(db, 'coupons', couponId), {
      status: newStatus,
      updatedAt: toTs(now),
    });
    await auditLog({
      actionType: newStatus === 'active' ? 'activate' : 'deactivate',
      actorUserId,
      actorName,
      couponId,
      timestamp: now,
    });
  },

  async deleteCoupon(
    couponId: string,
    actorUserId: string,
    actorName?: string
  ): Promise<void> {
    const coupon = await this.getCouponById(couponId);
    const now = new Date();
    await deleteDoc(doc(db, 'coupons', couponId));
    await auditLog({
      actionType: 'delete',
      actorUserId,
      actorName,
      couponId,
      couponCode: coupon?.couponCode,
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
    if (coupon.status !== 'active') return { valid: false, reason: 'Coupon is not active.' };
    if (now < coupon.startDate) return { valid: false, reason: 'Coupon has not started yet.' };
    if (now > coupon.endDate) return { valid: false, reason: 'Coupon has expired.' };

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
      const hasReq = (coupon.nextPurchaseEligibility.requiredCourseIds || []).some(
        id => userEnrolledCourseIds.includes(id)
      );
      if (!hasReq) return { valid: false, reason: 'You must be enrolled in a required course to use this coupon.' };
    }

    // Per-user usage check
    const usageSnap = await getDocs(
      query(collection(db, 'couponUsage'), where('couponId', '==', coupon.id), where('userId', '==', userId))
    );
    if (usageSnap.size >= coupon.perUserLimit) {
      return { valid: false, reason: 'You have reached the per-user limit for this coupon.' };
    }

    let discount = 0;
    if (coupon.discountType === 'amount') {
      discount = Math.min(coupon.discountValue, purchaseAmount);
    } else {
      discount = (purchaseAmount * coupon.discountValue) / 100;
      if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
    }

    return { valid: true, discount, finalPrice: Math.max(0, purchaseAmount - discount) };
  },

  async recordCouponUsage(couponId: string, userId: string, courseId: string): Promise<void> {
    const batch = writeBatch(db);
    batch.update(doc(db, 'coupons', couponId), {
      usageCount: increment(1),
      updatedAt: Timestamp.now(),
    });
    batch.set(doc(collection(db, 'couponUsage')), {
      couponId, userId, courseId, usedAt: Timestamp.now(),
    });
    await batch.commit();
  },
};

export default couponService;
