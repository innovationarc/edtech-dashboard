// src/services/comingSoonService.ts
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
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type FeatureStatus = 'in_development' | 'beta' | 'released';

export interface ComingSoonFeature {
  id: string;
  title: string;
  description: string;
  iconName: string; // lucide icon name stored as string
  progress: number; // 0-100
  expectedDate: string; // e.g. "Q2 2025"
  status: FeatureStatus;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export type EarlyAccessStatus = 'pending' | 'approved' | 'rejected';

export interface EarlyAccessRequest {
  id: string;
  featureId: string;
  featureTitle: string;
  studentId: string;
  studentName: string;
  studentEmail?: string;
  status: EarlyAccessStatus;
  accessLink?: string;
  guidelines?: string;
  requestedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
}

export type FeatureRequestStatus = 'pending' | 'in_review' | 'reviewed' | 'planned' | 'declined';

export interface FeatureRequest {
  id: string;
  description: string;
  studentId: string;
  studentName: string;
  status: FeatureRequestStatus;
  adminNote?: string;
  requestedAt: Date;
  updatedAt: Date;
}

// ─── Feature CRUD ─────────────────────────────────────────────────────────────

const FEATURES_COL = 'comingSoonFeatures';
const EARLY_ACCESS_COL = 'earlyAccessRequests';
const FEATURE_REQUESTS_COL = 'featureRequests';

const toDate = (val: any): Date => {
  if (!val) return new Date();
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  return new Date(val);
};

const mapFeature = (id: string, data: any): ComingSoonFeature => ({
  id,
  title: data.title ?? '',
  description: data.description ?? '',
  iconName: data.iconName ?? 'Zap',
  progress: data.progress ?? 0,
  expectedDate: data.expectedDate ?? '',
  status: data.status ?? 'in_development',
  order: data.order ?? 0,
  createdAt: toDate(data.createdAt),
  updatedAt: toDate(data.updatedAt),
});

const mapEarlyAccess = (id: string, data: any): EarlyAccessRequest => ({
  id,
  featureId: data.featureId ?? '',
  featureTitle: data.featureTitle ?? '',
  studentId: data.studentId ?? '',
  studentName: data.studentName ?? '',
  studentEmail: data.studentEmail,
  status: data.status ?? 'pending',
  accessLink: data.accessLink,
  guidelines: data.guidelines,
  requestedAt: toDate(data.requestedAt),
  reviewedAt: data.reviewedAt ? toDate(data.reviewedAt) : undefined,
  reviewedBy: data.reviewedBy,
});

const mapFeatureRequest = (id: string, data: any): FeatureRequest => ({
  id,
  description: data.description ?? '',
  studentId: data.studentId ?? '',
  studentName: data.studentName ?? '',
  status: data.status ?? 'pending',
  adminNote: data.adminNote,
  requestedAt: toDate(data.requestedAt),
  updatedAt: toDate(data.updatedAt),
});

export const comingSoonService = {

  // ── Features ────────────────────────────────────────────────────────────────

  async getFeatures(): Promise<ComingSoonFeature[]> {
    const q = query(collection(db, FEATURES_COL), orderBy('order', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => mapFeature(d.id, d.data()));
  },

  async addFeature(data: Omit<ComingSoonFeature, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const ref = await addDoc(collection(db, FEATURES_COL), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  },

  async updateFeature(id: string, data: Partial<Omit<ComingSoonFeature, 'id' | 'createdAt'>>): Promise<void> {
    await updateDoc(doc(db, FEATURES_COL, id), {
      ...data,
      updatedAt: serverTimestamp(),
    });
  },

  async deleteFeature(id: string): Promise<void> {
    await deleteDoc(doc(db, FEATURES_COL, id));
  },

  // ── Early Access Requests ───────────────────────────────────────────────────

  async requestEarlyAccess(
    featureId: string,
    featureTitle: string,
    studentId: string,
    studentName: string,
    studentEmail?: string,
  ): Promise<string> {
    const ref = await addDoc(collection(db, EARLY_ACCESS_COL), {
      featureId,
      featureTitle,
      studentId,
      studentName,
      studentEmail: studentEmail ?? '',
      status: 'pending',
      requestedAt: serverTimestamp(),
    });
    return ref.id;
  },

  async getEarlyAccessByStudent(studentId: string): Promise<EarlyAccessRequest[]> {
    const q = query(
      collection(db, EARLY_ACCESS_COL),
      where('studentId', '==', studentId),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => mapEarlyAccess(d.id, d.data()));
  },

  async getEarlyAccessByFeature(featureId: string): Promise<EarlyAccessRequest[]> {
    const q = query(
      collection(db, EARLY_ACCESS_COL),
      where('featureId', '==', featureId),
      orderBy('requestedAt', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => mapEarlyAccess(d.id, d.data()));
  },

  async getAllEarlyAccessRequests(): Promise<EarlyAccessRequest[]> {
    const q = query(collection(db, EARLY_ACCESS_COL), orderBy('requestedAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => mapEarlyAccess(d.id, d.data()));
  },

  async approveEarlyAccess(
    requestId: string,
    accessLink: string,
    guidelines: string,
    reviewedBy: string,
  ): Promise<void> {
    await updateDoc(doc(db, EARLY_ACCESS_COL, requestId), {
      status: 'approved',
      accessLink,
      guidelines,
      reviewedBy,
      reviewedAt: serverTimestamp(),
    });
  },

  async rejectEarlyAccess(requestId: string, reviewedBy: string): Promise<void> {
    await updateDoc(doc(db, EARLY_ACCESS_COL, requestId), {
      status: 'rejected',
      reviewedBy,
      reviewedAt: serverTimestamp(),
    });
  },

  // ── Feature Requests (student suggestions) ──────────────────────────────────

  async submitFeatureRequest(
    description: string,
    studentId: string,
    studentName: string,
  ): Promise<string> {
    const ref = await addDoc(collection(db, FEATURE_REQUESTS_COL), {
      description,
      studentId,
      studentName,
      status: 'pending',
      requestedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  },

  async getFeatureRequestsByStudent(studentId: string): Promise<FeatureRequest[]> {
    const q = query(
      collection(db, FEATURE_REQUESTS_COL),
      where('studentId', '==', studentId),
      orderBy('requestedAt', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => mapFeatureRequest(d.id, d.data()));
  },

  async getAllFeatureRequests(): Promise<FeatureRequest[]> {
    const q = query(collection(db, FEATURE_REQUESTS_COL), orderBy('requestedAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => mapFeatureRequest(d.id, d.data()));
  },

  async updateFeatureRequestStatus(
    requestId: string,
    status: FeatureRequestStatus,
    adminNote?: string,
  ): Promise<void> {
    await updateDoc(doc(db, FEATURE_REQUESTS_COL, requestId), {
      status,
      ...(adminNote !== undefined ? { adminNote } : {}),
      updatedAt: serverTimestamp(),
    });
  },
};
