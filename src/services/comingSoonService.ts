// src/services/comingSoonService.ts
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
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
  iconName: string;
  progress: number;
  expectedDate: string;
  status: FeatureStatus;
  order: number;
  createdBy?: string;
  createdByUserId?: string; // human-readable e.g. AD-2601-00001
  createdByName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type EarlyAccessStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface EarlyAccessRequest {
  id: string;
  featureId: string;
  featureTitle: string;
  studentId: string;
  studentName: string;
  studentUserId?: string; // human-readable e.g. ST-2601-00001
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
  studentUserId?: string;
  status: FeatureRequestStatus;
  adminNote?: string;
  requestedAt: Date;
  updatedAt: Date;
}

// ─── Activity Log ─────────────────────────────────────────────────────────────

export type ActivityLogAction =
  | 'feature_added'
  | 'feature_edited'
  | 'feature_deleted'
  | 'early_access_approved'
  | 'early_access_rejected'
  | 'early_access_cancelled'
  | 'feature_request_status_updated'
  | 'feature_request_deleted';

export interface ActivityLog {
  id: string;
  action: ActivityLogAction;
  actorId: string;
  actorUserId?: string;
  actorName: string;
  targetId?: string;
  targetTitle?: string;
  details?: string;
  timestamp: Date;
}

// ─── Collections ──────────────────────────────────────────────────────────────

const FEATURES_COL         = 'comingSoonFeatures';
const EARLY_ACCESS_COL     = 'earlyAccessRequests';
const FEATURE_REQUESTS_COL = 'featureRequests';
const ACTIVITY_LOG_COL     = 'comingSoonActivityLog';

// ─── Mappers ──────────────────────────────────────────────────────────────────

const toDate = (val: any): Date => {
  if (!val) return new Date();
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  return new Date(val);
};

const mapFeature = (id: string, d: any): ComingSoonFeature => ({
  id,
  title: d.title ?? '',
  description: d.description ?? '',
  iconName: d.iconName ?? 'Zap',
  progress: d.progress ?? 0,
  expectedDate: d.expectedDate ?? '',
  status: d.status ?? 'in_development',
  order: d.order ?? 0,
  createdBy: d.createdBy,
  createdByUserId: d.createdByUserId,
  createdByName: d.createdByName,
  createdAt: toDate(d.createdAt),
  updatedAt: toDate(d.updatedAt),
});

const mapEarlyAccess = (id: string, d: any): EarlyAccessRequest => ({
  id,
  featureId: d.featureId ?? '',
  featureTitle: d.featureTitle ?? '',
  studentId: d.studentId ?? '',
  studentName: d.studentName ?? '',
  studentUserId: d.studentUserId,
  studentEmail: d.studentEmail,
  status: d.status ?? 'pending',
  accessLink: d.accessLink,
  guidelines: d.guidelines,
  requestedAt: toDate(d.requestedAt),
  reviewedAt: d.reviewedAt ? toDate(d.reviewedAt) : undefined,
  reviewedBy: d.reviewedBy,
});

const mapFeatureRequest = (id: string, d: any): FeatureRequest => ({
  id,
  description: d.description ?? '',
  studentId: d.studentId ?? '',
  studentName: d.studentName ?? '',
  studentUserId: d.studentUserId,
  status: d.status ?? 'pending',
  adminNote: d.adminNote,
  requestedAt: toDate(d.requestedAt),
  updatedAt: toDate(d.updatedAt),
});

const mapLog = (id: string, d: any): ActivityLog => ({
  id,
  action: d.action,
  actorId: d.actorId ?? '',
  actorUserId: d.actorUserId,
  actorName: d.actorName ?? '',
  targetId: d.targetId,
  targetTitle: d.targetTitle,
  details: d.details,
  timestamp: toDate(d.timestamp),
});

// ─── Internal log writer ──────────────────────────────────────────────────────

type Actor = { uid: string; userId?: string; name: string };

async function writeLog(
  action: ActivityLogAction,
  actor: Actor,
  target?: { id?: string; title?: string },
  details?: string,
): Promise<void> {
  try {
    await addDoc(collection(db, ACTIVITY_LOG_COL), {
      action,
      actorId: actor.uid,
      actorUserId: actor.userId ?? null,
      actorName: actor.name,
      targetId: target?.id ?? null,
      targetTitle: target?.title ?? null,
      details: details ?? null,
      timestamp: serverTimestamp(),
    });
  } catch {
    // Logging should never block primary operations
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const comingSoonService = {

  // ── Features ──────────────────────────────────────────────────────────────

  async getFeatures(): Promise<ComingSoonFeature[]> {
    const q = query(collection(db, FEATURES_COL), orderBy('order', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => mapFeature(d.id, d.data()));
  },

  async addFeature(
    data: Omit<ComingSoonFeature, 'id' | 'createdAt' | 'updatedAt'>,
    actor: Actor,
  ): Promise<string> {
    const ref = await addDoc(collection(db, FEATURES_COL), {
      ...data,
      createdBy: actor.uid,
      createdByUserId: actor.userId ?? null,
      createdByName: actor.name,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await writeLog('feature_added', actor, { id: ref.id, title: data.title });
    return ref.id;
  },

  async updateFeature(
    id: string,
    data: Partial<Omit<ComingSoonFeature, 'id' | 'createdAt'>>,
    actor: Actor,
    featureTitle?: string,
  ): Promise<void> {
    await updateDoc(doc(db, FEATURES_COL, id), {
      ...data,
      updatedAt: serverTimestamp(),
    });
    const changed: string[] = [];
    if (data.progress !== undefined) changed.push(`progress → ${data.progress}%`);
    if (data.expectedDate) changed.push(`expected → ${data.expectedDate}`);
    if (data.status) changed.push(`status → ${data.status}`);
    await writeLog('feature_edited', actor, { id, title: featureTitle ?? data.title }, changed.join(', ') || undefined);
  },

  async deleteFeature(id: string, title: string, actor: Actor): Promise<void> {
    await deleteDoc(doc(db, FEATURES_COL, id));
    await writeLog('feature_deleted', actor, { id, title });
  },

  // ── Early Access Requests ────────────────────────────────────────────────

  async requestEarlyAccess(
    featureId: string,
    featureTitle: string,
    studentId: string,
    studentName: string,
    studentUserId?: string,
    studentEmail?: string,
  ): Promise<string> {
    const ref = await addDoc(collection(db, EARLY_ACCESS_COL), {
      featureId,
      featureTitle,
      studentId,
      studentName,
      studentUserId: studentUserId ?? null,
      studentEmail: studentEmail ?? '',
      status: 'pending',
      requestedAt: serverTimestamp(),
    });
    return ref.id;
  },

  async cancelEarlyAccess(requestId: string): Promise<void> {
    await deleteDoc(doc(db, EARLY_ACCESS_COL, requestId));
  },

  async getEarlyAccessByStudent(studentId: string): Promise<EarlyAccessRequest[]> {
    const q = query(collection(db, EARLY_ACCESS_COL), where('studentId', '==', studentId));
    const snap = await getDocs(q);
    return snap.docs.map(d => mapEarlyAccess(d.id, d.data()));
  },

  // Real-time listener for a student's early access requests
  // Returns an unsubscribe function — call it on component unmount
  subscribeEarlyAccessByStudent(
    studentId: string,
    callback: (requests: EarlyAccessRequest[]) => void,
  ): () => void {
    const q = query(
      collection(db, EARLY_ACCESS_COL),
      where('studentId', '==', studentId),
    );
    return onSnapshot(q, snap => {
      callback(snap.docs.map(d => mapEarlyAccess(d.id, d.data())));
    }, () => {
      // On error fall back silently
    });
  },

  async getEarlyAccessByFeature(featureId: string): Promise<EarlyAccessRequest[]> {
    const q = query(collection(db, EARLY_ACCESS_COL), where('featureId', '==', featureId));
    const snap = await getDocs(q);
    const results = snap.docs.map(d => mapEarlyAccess(d.id, d.data()));
    return results.sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
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
    actor: Actor,
    featureTitle?: string,
    studentName?: string,
  ): Promise<void> {
    await updateDoc(doc(db, EARLY_ACCESS_COL, requestId), {
      status: 'approved',
      accessLink,
      guidelines,
      reviewedBy: actor.uid,
      reviewedAt: serverTimestamp(),
    });
    await writeLog(
      'early_access_approved',
      actor,
      { id: requestId, title: featureTitle },
      `Student: ${studentName ?? '?'} | Link: ${accessLink}`,
    );
  },

  async rejectEarlyAccess(
    requestId: string,
    actor: Actor,
    featureTitle?: string,
    studentName?: string,
  ): Promise<void> {
    await updateDoc(doc(db, EARLY_ACCESS_COL, requestId), {
      status: 'rejected',
      reviewedBy: actor.uid,
      reviewedAt: serverTimestamp(),
    });
    await writeLog(
      'early_access_rejected',
      actor,
      { id: requestId, title: featureTitle },
      `Student: ${studentName ?? '?'}`,
    );
  },

  // ── Feature Requests ──────────────────────────────────────────────────────

  async submitFeatureRequest(
    description: string,
    studentId: string,
    studentName: string,
    studentUserId?: string,
  ): Promise<string> {
    const ref = await addDoc(collection(db, FEATURE_REQUESTS_COL), {
      description,
      studentId,
      studentName,
      studentUserId: studentUserId ?? null,
      status: 'pending',
      requestedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  },

  async deleteFeatureRequest(requestId: string): Promise<void> {
    await deleteDoc(doc(db, FEATURE_REQUESTS_COL, requestId));
  },

  async getFeatureRequestsByStudent(studentId: string): Promise<FeatureRequest[]> {
    const q = query(collection(db, FEATURE_REQUESTS_COL), where('studentId', '==', studentId));
    const snap = await getDocs(q);
    const results = snap.docs.map(d => mapFeatureRequest(d.id, d.data()));
    return results.sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
  },

  async getAllFeatureRequests(): Promise<FeatureRequest[]> {
    const q = query(collection(db, FEATURE_REQUESTS_COL), orderBy('requestedAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => mapFeatureRequest(d.id, d.data()));
  },

  async updateFeatureRequestStatus(
    requestId: string,
    status: FeatureRequestStatus,
    actor: Actor,
    adminNote?: string,
    studentName?: string,
  ): Promise<void> {
    await updateDoc(doc(db, FEATURE_REQUESTS_COL, requestId), {
      status,
      ...(adminNote !== undefined ? { adminNote } : {}),
      updatedAt: serverTimestamp(),
    });
    await writeLog(
      'feature_request_status_updated',
      actor,
      { id: requestId, title: `Request by ${studentName ?? '?'}` },
      `Status → ${status}`,
    );
  },

  async adminDeleteFeatureRequest(
    requestId: string,
    actor: Actor,
    studentName?: string,
  ): Promise<void> {
    await deleteDoc(doc(db, FEATURE_REQUESTS_COL, requestId));
    await writeLog(
      'feature_request_deleted',
      actor,
      { id: requestId, title: `Request by ${studentName ?? '?'}` },
    );
  },

  // ── Activity Log ──────────────────────────────────────────────────────────

  async getActivityLogs(limitCount = 150): Promise<ActivityLog[]> {
    const q = query(
      collection(db, ACTIVITY_LOG_COL),
      orderBy('timestamp', 'desc'),
      limit(limitCount),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => mapLog(d.id, d.data()));
  },
};
