/**
 * pie Academy — IndexedDB via Dexie.js
 *
 * This is the local offline database. It mirrors your Firestore collections
 * and is the single source of truth for all reads in the app.
 * The syncService keeps this in sync with Firestore.
 *
 * Install: npm install dexie
 */

import Dexie, { type Table } from 'dexie';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LocalUser {
  id: string;               // Firebase UID
  email: string;
  role: string;
  displayName?: string;
  photoURL?: string;
  enrolledCourses?: string[];
  createdAt?: number;
  updatedAt?: number;
  _synced?: boolean;
}

export interface LocalCourse {
  id: string;
  title: string;
  description?: string;
  teacherId?: string;
  thumbnail?: string;
  subjects?: string[];
  isPublished?: boolean;
  createdAt?: number;
  updatedAt?: number;
  _synced?: boolean;
}

export interface LocalContent {
  id: string;
  courseId: string;
  type: 'lesson' | 'note' | 'exam' | 'trick';
  title: string;
  topicId?: string;
  chapterId?: string;
  order?: number;
  data?: Record<string, unknown>; // lesson video URL, note content, exam questions, etc.
  createdAt?: number;
  updatedAt?: number;
  _synced?: boolean;
}

export interface LocalProgress {
  id: string;               // `${userId}_${courseId}_${contentId}`
  userId: string;
  courseId: string;
  contentId: string;
  completed: boolean;
  score?: number;
  watchedSeconds?: number;
  lastAccessedAt?: number;
  updatedAt?: number;
  _synced?: boolean;
  _pendingSync?: boolean;   // Queued for upload when back online
}

export interface LocalEnrollment {
  id: string;               // `${userId}_${courseId}`
  userId: string;
  courseId: string;
  enrolledAt?: number;
  paymentStatus?: string;
  _synced?: boolean;
}

export interface LocalStudyPlan {
  id: string;
  userId: string;
  sessions: unknown[];      // AI-generated session array
  goals?: unknown[];
  generatedAt?: number;
  updatedAt?: number;
  _synced?: boolean;
  _pendingSync?: boolean;
}

export interface LocalPomodoroSession {
  id: string;               // timestamp-based unique id
  userId: string;
  subject?: string;
  topic?: string;
  durationMinutes: number;
  completedAt: number;      // unix timestamp
  _synced?: boolean;
  _pendingSync?: boolean;
}

export interface LocalAnnouncement {
  id: string;
  title: string;
  content: string;
  authorId?: string;
  targetRoles?: string[];
  createdAt?: number;
  _synced?: boolean;
}

export interface LocalNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  read: boolean;
  createdAt?: number;
  _synced?: boolean;
  _pendingSync?: boolean;
}

export interface LocalLeaderboard {
  id: string;               // userId
  displayName: string;
  photoURL?: string;
  score: number;
  rank?: number;
  updatedAt?: number;
  _synced?: boolean;
}

export interface LocalAchievement {
  id: string;
  userId: string;
  type: string;
  earnedAt?: number;
  _synced?: boolean;
}

export interface LocalTask {
  id: string;
  userId: string;
  title: string;
  completed: boolean;
  dueDate?: number;
  priority?: 'low' | 'medium' | 'high';
  createdAt?: number;
  updatedAt?: number;
  _synced?: boolean;
  _pendingSync?: boolean;
}

export interface LocalQA {
  id: string;
  courseId?: string;
  authorId: string;
  question: string;
  answer?: string;
  status?: 'open' | 'answered';
  createdAt?: number;
  _synced?: boolean;
}

// ── Sync Queue — stores failed writes to retry when back online ──────────────
export interface SyncQueueItem {
  id?: number;              // auto-incremented
  collection: string;       // Firestore collection name
  docId: string;
  operation: 'set' | 'update' | 'delete';
  data?: Record<string, unknown>;
  timestamp: number;
  retries: number;
}

// ── App Settings (local-only, never synced) ──────────────────────────────────
export interface LocalSettings {
  id: string;               // always 'user_settings'
  theme?: string;
  primaryColor?: string;
  accentColor?: string;
  glitterEnabled?: boolean;
  cardStyle?: string;
  language?: string;
  notifications?: boolean;
  pomodoroWorkMinutes?: number;
  pomodoroBreakMinutes?: number;
  ambientSound?: string;
}

// ─── Database Class ───────────────────────────────────────────────────────────

class PieAcademyDB extends Dexie {
  users!: Table<LocalUser, string>;
  courses!: Table<LocalCourse, string>;
  content!: Table<LocalContent, string>;
  progress!: Table<LocalProgress, string>;
  enrollments!: Table<LocalEnrollment, string>;
  studyPlans!: Table<LocalStudyPlan, string>;
  pomodoroSessions!: Table<LocalPomodoroSession, string>;
  announcements!: Table<LocalAnnouncement, string>;
  notifications!: Table<LocalNotification, string>;
  leaderboard!: Table<LocalLeaderboard, string>;
  achievements!: Table<LocalAchievement, string>;
  tasks!: Table<LocalTask, string>;
  qa!: Table<LocalQA, string>;
  syncQueue!: Table<SyncQueueItem, number>;
  settings!: Table<LocalSettings, string>;

  constructor() {
    super('PieAcademyDB');

    this.version(1).stores({
      // Primary key first, then indexed fields
      users:            'id, role, email',
      courses:          'id, teacherId, isPublished',
      content:          'id, courseId, type, topicId, chapterId',
      progress:         'id, userId, courseId, contentId, _pendingSync',
      enrollments:      'id, userId, courseId',
      studyPlans:       'id, userId, _pendingSync',
      pomodoroSessions: 'id, userId, completedAt, _pendingSync',
      announcements:    'id, createdAt',
      notifications:    'id, userId, read, _pendingSync',
      leaderboard:      'id, score, rank',
      achievements:     'id, userId, type',
      tasks:            'id, userId, completed, dueDate, _pendingSync',
      qa:               'id, courseId, authorId, status',
      syncQueue:        '++id, collection, timestamp, retries',
      settings:         'id',
    });
  }
}

// ─── Singleton Instance ───────────────────────────────────────────────────────

export const db = new PieAcademyDB();

// ─── Helper: Upsert (insert or update) ───────────────────────────────────────

export async function upsert<T extends { id: string }>(
  table: Table<T, string>,
  data: T
): Promise<void> {
  await table.put(data);
}

// ─── Helper: Bulk upsert from Firestore snapshot ─────────────────────────────

export async function bulkUpsert<T extends { id: string }>(
  table: Table<T, string>,
  items: T[]
): Promise<void> {
  await table.bulkPut(items);
}

// ─── Helper: Get all pending sync items ──────────────────────────────────────

export async function getPendingSync(collection: string): Promise<SyncQueueItem[]> {
  return db.syncQueue.where('collection').equals(collection).toArray();
}

// ─── Helper: Clear synced queue items ────────────────────────────────────────

export async function clearSyncQueue(ids: number[]): Promise<void> {
  await db.syncQueue.bulkDelete(ids);
}

export default db;
