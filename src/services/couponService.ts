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
  orderBy,
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
  courseNames?: string[];
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
  requiredCourseNames?: string[];
}

export interface Coupon {
  id: string;
  couponCode: string;
  discountType: DiscountType;
  discountValue: number;
  maxDiscount?: number; // for percentage only
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

  // Bulk group info (null for single coupons)
  bulkGroupId?: string;
  bulkGroupName?: string;
  trackingId?: string; // GroupID_SerialNumber

  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BulkGroup {
  id: string;
  groupName: string;
  groupId: string;
  couponCount: number;
  template: Omit<Coupon, 'id' | 'couponCode' | 'bulkGroupId' | 'bulkGroupName' | 'trackingId' | 'createdAt' | 'updatedAt'>;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLog {
  id: string;
  actionType: 'create_single' | 'create_bulk' | 'update' | 'activate' | 'deactivate' | 'delete' | 'create_bulk_group';
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
  const random = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return prefix ? `${prefix.toUpperCase()}-${random}` : random;
};

const toTimestamp = (date: Date) => Timestamp.fromDate(date);

const fromFirestore = (docData: any, id: string): Coupon => ({
  ...docData,
  id,
  startDate: docData.startDate?.toDate?.() || new Date(docData.startDate),
  endDate: docData.endDate?.toDate?.() || new Date(docData.endDate),
  activationDate: docData.activationDate?.toDate?.(),
  createdAt: docData.createdAt?.toDate?.() || new Date(),
  updatedAt: docData.updatedAt?.toDate?.() || new Date(),
});

const fromFirestoreBulkGroup = (docData: any, id: string): BulkGroup => ({
  ...docData,
  id,
  createdAt: docData.createdAt?.toDate?.() || new Date(),
  updatedAt: docData.updatedAt?.toDate?.() || new Date(),
});

const fromFirestoreLog = (docData: any, id: string): AuditLog => ({
  ...docData,
  id,
  timestamp: docData.timestamp?.toDate?.() || new Date(),
});

const computeStatus = (coupon: Omit<Coupon, 'id'>): CouponStatus => {
  const now = new Date();
  if (coupon.status === 'inactive') return 'inactive';
  if (coupon.endDate < now) return 'expired';
  if (coupon.startDate > now) return 'scheduled';
  return 'active';
};

// ==================== AUDIT LOGGING ====================

const writeAuditLog = async (log: Omit<AuditLog, 'id'>): Promise<void> => {
  try {
    await addDoc(collection(db, 'couponAuditLogs'), {
      ...log,
      timestamp: toTimestamp(log.timestamp),
    });
  } catch {
    // Silent fail for audit — don't break main operation
  }
};

// ==================== COUPON SERVICE ====================

export const couponService = {

  // ── SINGLE COUPON ──────────────────────────────────────────────────────

  async createSingleCoupon(input: CreateSingleCouponInput): Promise<Coupon> {
    // Validate unique code
    const existing = await this.getCouponByCode(input.couponCode);
    if (existing) throw new Error(`Coupon code "${input.couponCode}" already exists.`);

    // Validate dates
    if (input.startDate >= input.endDate) throw new Error('Start date must be before end date.');
    if (input.discountType === 'percentage' && !input.maxDiscount) {
      throw new Error('Percentage discounts require a maximum discount cap.');
    }
    if (input.discountType === 'percentage' && (input.discountValue <= 0 || input.discountValue > 100)) {
      throw new Error('Percentage discount must be between 1 and 100.');
    }
    if (input.minimumPurchase < 0) throw new Error('Minimum purchase must be >= 0.');
    if (input.nextPurchaseEligibility.enabled && input.nextPurchaseEligibility.requiredCourseIds.length === 0) {
      throw new Error('Next-purchase eligibility requires at least one course selection.');
    }

    const now = new Date();
    const data = {
      couponCode: input.couponCode.toUpperCase().trim(),
      discountType: input.discountType,
      discountValue: input.discountValue,
      maxDiscount: input.maxDiscount,
      minimumPurchase: input.minimumPurchase,
      courseFilter: input.courseFilter,
      userFilter: input.userFilter,
      categoryFilter: input.categoryFilter,
      startDate: toTimestamp(input.startDate),
      endDate: toTimestamp(input.endDate),
      activationDate: input.activationDate ? toTimestamp(input.activationDate) : null,
      usageLimit: input.usageLimit,
      perUserLimit: input.perUserLimit,
      usageCount: 0,
      status: 'active' as CouponStatus,
      adminComments: input.adminComments || '',
      nextPurchaseEligibility: input.nextPurchaseEligibility,
      bulkGroupId: null,
      bulkGroupName: null,
      trackingId: null,
      createdBy: input.actorUserId,
      createdAt: toTimestamp(now),
      updatedAt: toTimestamp(now),
    };

    const ref = await addDoc(collection(db, 'coupons'), data);
    const coupon = fromFirestore({ ...data, status: computeStatus(data as any) }, ref.id);

    await writeAuditLog({
      actionType: 'create_single',
      actorUserId: input.actorUserId,
      actorName: input.actorName,
      couponId: ref.id,
      couponCode: input.couponCode.toUpperCase(),
      adminComments: input.adminComments,
      timestamp: now,
    });

    return coupon;
  },

  // ── BULK COUPONS ───────────────────────────────────────────────────────

  async createBulkCoupons(input: CreateBulkCouponInput): Promise<{ group: BulkGroup; coupons: Coupon[] }> {
    if (!input.groupName?.trim()) throw new Error('Group name is required.');
    if (!input.groupId?.trim()) throw new Error('Group ID is required.');
    if (input.quantity < 1 || input.quantity > 1000) throw new Error('Quantity must be between 1 and 1000.');
    if (input.startDate >= input.endDate) throw new Error('Start date must be before end date.');
    if (input.discountType === 'percentage' && !input.maxDiscount) {
      throw new Error('Percentage discounts require a maximum discount cap.');
    }
    if (input.nextPurchaseEligibility.enabled && input.nextPurchaseEligibility.requiredCourseIds.length === 0) {
      throw new Error('Next-purchase eligibility requires at least one course selection.');
    }

    const now = new Date();

    // Create group document
    const groupData = {
      groupName: input.groupName.trim(),
      groupId: input.groupId.toUpperCase().trim(),
      couponCount: input.quantity,
      template: {
        couponCode: '',
        discountType: input.discountType,
        discountValue: input.discountValue,
        maxDiscount: input.maxDiscount,
        minimumPurchase: input.minimumPurchase,
        courseFilter: input.courseFilter,
        userFilter: input.userFilter,
        categoryFilter: input.categoryFilter,
        startDate: input.startDate,
        endDate: input.endDate,
        activationDate: input.activationDate,
        usageLimit: input.usageLimit,
        perUserLimit: input.perUserLimit,
        usageCount: 0,
        status: 'active' as CouponStatus,
        adminComments: input.adminComments || '',
        nextPurchaseEligibility: input.nextPurchaseEligibility,
        createdBy: input.actorUserId,
      },
      createdBy: input.actorUserId,
      createdAt: toTimestamp(now),
      updatedAt: toTimestamp(now),
    };

    const groupRef = await addDoc(collection(db, 'bulkCouponGroups'), groupData);
    const group = fromFirestoreBulkGroup(groupData, groupRef.id) as BulkGroup;

    // Generate coupons in batches of 500 (Firestore batch limit)
    const coupons: Coupon[] = [];
    const batchSize = 499;
    let serial = 1;

    while (serial <= input.quantity) {
      const batch = writeBatch(db);
      const end = Math.min(serial + batchSize - 1, input.quantity);

      for (let i = serial; i <= end; i++) {
        const code = generateCouponCode(input.codePrefix || input.groupId);
        const trackingId = `${input.groupId.toUpperCase()}_${String(i).padStart(5, '0')}`;
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
          startDate: toTimestamp(input.startDate),
          endDate: toTimestamp(input.endDate),
          activationDate: input.activationDate ? toTimestamp(input.activationDate) : null,
          usageLimit: input.usageLimit,
          perUserLimit: input.perUserLimit,
          usageCount: 0,
          status: 'active' as CouponStatus,
          adminComments: input.adminComments || '',
          nextPurchaseEligibility: input.nextPurchaseEligibility,
          bulkGroupId: groupRef.id,
          bulkGroupName: input.groupName.trim(),
          trackingId,
          createdBy: input.actorUserId,
          createdAt: toTimestamp(now),
          updatedAt: toTimestamp(now),
        };

        batch.set(couponRef, couponData);
        coupons.push(fromFirestore(couponData, couponRef.id));
      }

      await batch.commit();
      serial = end + 1;
    }

    await writeAuditLog({
      actionType: 'create_bulk_group',
      actorUserId: input.actorUserId,
      actorName: input.actorName,
      groupId: input.groupId,
      groupName: input.groupName,
      adminComments: input.adminComments,
      metadata: { quantity: input.quantity },
      timestamp: now,
    });

    return { group, coupons };
  },

  // ── READ ───────────────────────────────────────────────────────────────

  async getAllSingleCoupons(): Promise<Coupon[]> {
    const q = query(
      collection(db, 'coupons'),
      where('bulkGroupId', '==', null),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => fromFirestore(d.data(), d.id));
  },

  async getAllBulkGroups(): Promise<BulkGroup[]> {
    const snap = await getDocs(query(collection(db, 'bulkCouponGroups'), orderBy('createdAt', 'desc')));
    return snap.docs.map(d => fromFirestoreBulkGroup(d.data(), d.id));
  },

  async getCouponsByGroupId(groupId: string): Promise<Coupon[]> {
    const q = query(
      collection(db, 'coupons'),
      where('bulkGroupId', '==', groupId),
      orderBy('createdAt', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => fromFirestore(d.data(), d.id));
  },

  async getCouponByCode(code: string): Promise<Coupon | null> {
    const q = query(collection(db, 'coupons'), where('couponCode', '==', code.toUpperCase().trim()));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return fromFirestore(d.data(), d.id);
  },

  async getCouponById(id: string): Promise<Coupon | null> {
    const d = await getDoc(doc(db, 'coupons', id));
    if (!d.exists()) return null;
    return fromFirestore(d.data(), d.id);
  },

  async getAuditLogs(limit = 100): Promise<AuditLog[]> {
    const q = query(collection(db, 'couponAuditLogs'), orderBy('timestamp', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.slice(0, limit).map(d => fromFirestoreLog(d.data(), d.id));
  },

  // ── UPDATE ─────────────────────────────────────────────────────────────

  async updateCoupon(
    couponId: string,
    updates: Partial<Omit<Coupon, 'id' | 'createdAt' | 'createdBy'>>,
    actorUserId: string,
    actorName?: string
  ): Promise<void> {
    const now = new Date();
    const updateData: any = { ...updates, updatedAt: toTimestamp(now) };

    // Convert dates
    if (updates.startDate) updateData.startDate = toTimestamp(updates.startDate);
    if (updates.endDate) updateData.endDate = toTimestamp(updates.endDate);
    if (updates.activationDate) updateData.activationDate = toTimestamp(updates.activationDate);

    await updateDoc(doc(db, 'coupons', couponId), updateData);

    await writeAuditLog({
      actionType: 'update',
      actorUserId,
      actorName,
      couponId,
      adminComments: updates.adminComments,
      timestamp: now,
    });
  },

  async toggleCouponStatus(
    couponId: string,
    newStatus: 'active' | 'inactive',
    actorUserId: string,
    actorName?: string,
    adminComments?: string
  ): Promise<void> {
    const now = new Date();
    await updateDoc(doc(db, 'coupons', couponId), {
      status: newStatus,
      updatedAt: toTimestamp(now),
    });

    await writeAuditLog({
      actionType: newStatus === 'active' ? 'activate' : 'deactivate',
      actorUserId,
      actorName,
      couponId,
      adminComments,
      timestamp: now,
    });
  },

  async deleteCoupon(
    couponId: string,
    actorUserId: string,
    actorName?: string,
    adminComments?: string
  ): Promise<void> {
    const coupon = await this.getCouponById(couponId);
    const now = new Date();
    await deleteDoc(doc(db, 'coupons', couponId));

    await writeAuditLog({
      actionType: 'delete',
      actorUserId,
      actorName,
      couponId,
      couponCode: coupon?.couponCode,
      adminComments,
      timestamp: now,
    });
  },

  // ── CHECKOUT VALIDATION ────────────────────────────────────────────────

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

    if (coupon.usageLimit !== 'unlimited' && coupon.usageCount >= coupon.usageLimit) {
      return { valid: false, reason: 'Coupon usage limit reached.' };
    }

    if (purchaseAmount < coupon.minimumPurchase) {
      return { valid: false, reason: `Minimum purchase of ৳${coupon.minimumPurchase} required.` };
    }

    // User filter check
    if (coupon.userFilter.type === 'specific') {
      if (!coupon.userFilter.userIds?.includes(userId)) {
        return { valid: false, reason: 'This coupon is not applicable to your account.' };
      }
    }

    // Course filter check
    if (coupon.courseFilter.type === 'specific') {
      if (!coupon.courseFilter.courseIds?.includes(courseId)) {
        return { valid: false, reason: 'This coupon is not valid for this course.' };
      }
    }

    // Enrollment eligibility check
    if (coupon.nextPurchaseEligibility.enabled) {
      const hasRequiredEnrollment = coupon.nextPurchaseEligibility.requiredCourseIds.some(
        id => userEnrolledCourseIds.includes(id)
      );
      if (!hasRequiredEnrollment) {
        return { valid: false, reason: 'You must be enrolled in a required course to use this coupon.' };
      }
    }

    // Per-user limit check (requires couponUsage collection)
    const usageQ = query(
      collection(db, 'couponUsage'),
      where('couponId', '==', coupon.id),
      where('userId', '==', userId)
    );
    const usageSnap = await getDocs(usageQ);
    if (usageSnap.size >= coupon.perUserLimit) {
      return { valid: false, reason: `You have reached the per-user limit for this coupon.` };
    }

    // Calculate discount
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
    };
  },

  async recordCouponUsage(couponId: string, userId: string, courseId: string): Promise<void> {
    const batch = writeBatch(db);
    const couponRef = doc(db, 'coupons', couponId);
    const usageRef = doc(collection(db, 'couponUsage'));

    batch.update(couponRef, { usageCount: increment(1), updatedAt: Timestamp.now() });
    batch.set(usageRef, { couponId, userId, courseId, usedAt: Timestamp.now() });

    await batch.commit();
  },
};

export default couponService;
