/**
 * pie Academy — Sync Service
 *
 * Bidirectional sync between Firestore and local IndexedDB (Dexie).
 *
 * Strategy:
 *  - All reads → IndexedDB first (instant, offline-safe)
 *  - All writes → IndexedDB immediately + queue for Firestore
 *  - When online → flush queue to Firestore + pull latest from Firestore
 *  - When offline → queue builds up, syncs automatically when reconnected
 *
 * Usage:
 *   import { syncService } from '@/lib/syncService';
 *   syncService.init(userId); // call once after auth
 *   syncService.destroy();    // call on logout
 *
 * ─────────────────────────────────────────────────────────────────────────
 * 2026-08 SCHEMA FIX
 * The Firestore-side queries below were written against an older schema
 * (userId-keyed docs, singular studyPlans/contentProgress collections) that
 * no longer matches firestore.rules / the live web app. This caused every
 * initial sync to fail with "Missing or insufficient permissions" because
 * several collections (studyPlans, contentProgress) don't exist under those
 * names anymore, so Firestore's default-deny rule rejected the reads.
 *
 * Local Dexie table names, LocalX types, and _synced/_pendingSync shapes are
 * UNCHANGED — every other file that reads from localDB.* keeps working
 * exactly as before. Only the Firestore collection names / field names used
 * to populate those local tables were corrected, and results are mapped
 * back into the original Local* shape (e.g. studentId → userId) so nothing
 * downstream needs to change.
 * ─────────────────────────────────────────────────────────────────────────
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db as localDB } from './dexie';
import type {
  LocalUser,
  LocalCourse,
  LocalContent,
  LocalProgress,
  LocalEnrollment,
  LocalStudyPlan,
  LocalPomodoroSession,
  LocalAnnouncement,
  LocalNotification,
  LocalLeaderboard,
  LocalAchievement,
  LocalTask,
  SyncQueueItem,
} from './dexie';

import { db as firestore } from '../config/firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

type SyncListener = (status: SyncStatus) => void;

// ─── Sync Service ─────────────────────────────────────────────────────────────

class SyncService {
  private userId: string | null = null;
  private unsubscribers: Unsubscribe[] = [];
  private syncListeners: SyncListener[] = [];
  private status: SyncStatus = 'idle';
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private isOnline = navigator.onLine;

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  async init(userId: string): Promise<void> {
    this.userId = userId;
    this.isOnline = navigator.onLine;

    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);

    // Pull initial data from Firestore → IndexedDB
    await this.initialSync();

    // Set up real-time listeners for user-specific data
    this.setupRealtimeListeners();

    // Flush any pending writes from previous session
    if (this.isOnline) {
      await this.flushSyncQueue();
    }
  }

  destroy(): void {
    this.userId = null;
    this.unsubscribers.forEach(u => u());
    this.unsubscribers = [];
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    if (this.flushTimer) clearTimeout(this.flushTimer);
  }

  // ── Status ─────────────────────────────────────────────────────────────────

  onStatusChange(listener: SyncListener): () => void {
    this.syncListeners.push(listener);
    return () => {
      this.syncListeners = this.syncListeners.filter(l => l !== listener);
    };
  }

  private setStatus(status: SyncStatus): void {
    this.status = status;
    this.syncListeners.forEach(l => l(status));
  }

  getStatus(): SyncStatus {
    return this.status;
  }

  // ── Online/Offline Handlers ────────────────────────────────────────────────

  private handleOnline = async (): Promise<void> => {
    this.isOnline = true;
    this.setStatus('syncing');
    await this.flushSyncQueue();
    await this.refreshFromFirestore();
    this.setStatus('idle');
  };

  private handleOffline = (): void => {
    this.isOnline = false;
    this.setStatus('offline');
  };

  // ── Initial Sync: Firestore → IndexedDB ───────────────────────────────────
  // Each sync* method below is independently try/caught so one missing/denied
  // collection (e.g. a role-gated collection for a student account) can't
  // abort the entire initial sync — it logs a warning and moves on instead.

  private async initialSync(): Promise<void> {
    if (!this.userId || !this.isOnline) return;
    this.setStatus('syncing');

    const tasks: Array<[string, () => Promise<void>]> = [
      ['userProfile', () => this.syncUserProfile()],
      ['courses', () => this.syncCourses()],
      ['enrollments', () => this.syncEnrollments()],
      ['progress', () => this.syncProgress()],
      ['studyPlan', () => this.syncStudyPlan()],
      ['pomodoroSessions', () => this.syncPomodoroSessions()],
      ['announcements', () => this.syncAnnouncements()],
      ['notifications', () => this.syncNotifications()],
      ['leaderboard', () => this.syncLeaderboard()],
      ['achievements', () => this.syncAchievements()],
      ['tasks', () => this.syncTasks()],
    ];

    const results = await Promise.allSettled(tasks.map(([, fn]) => fn()));

    let hadFailure = false;
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        hadFailure = true;
        console.warn(`[SyncService] "${tasks[i][0]}" sync failed (non-fatal):`, r.reason);
      }
    });

    // Only surface 'error' status if EVERYTHING failed (e.g. fully offline/auth issue).
    // Partial failures (one collection denied for this role) still count as idle,
    // since the rest of the app's data did sync successfully.
    this.setStatus(hadFailure && results.every(r => r.status === 'rejected') ? 'error' : 'idle');
  }

  private async refreshFromFirestore(): Promise<void> {
    await this.initialSync();
  }

  // ── Real-time Listeners (online only) ─────────────────────────────────────

  private setupRealtimeListeners(): void {
    if (!this.userId) return;

    // Notifications — real-time for badge count
    const notifUnsub = onSnapshot(
      query(
        collection(firestore, 'notifications'),
        where('userId', '==', this.userId),
        orderBy('createdAt', 'desc'),
        limit(50)
      ),
      async (snap) => {
        const items: LocalNotification[] = snap.docs.map(d => ({
          id: d.id,
          ...(d.data() as Omit<LocalNotification, 'id'>),
          _synced: true,
        }));
        await localDB.notifications.bulkPut(items);
      },
      (err) => console.warn('[SyncService] Notifications listener error:', err)
    );
    this.unsubscribers.push(notifUnsub);

    // Announcements — real-time
    const announcementUnsub = onSnapshot(
      query(
        collection(firestore, 'announcements'),
        orderBy('createdAt', 'desc'),
        limit(30)
      ),
      async (snap) => {
        const items: LocalAnnouncement[] = snap.docs.map(d => ({
          id: d.id,
          ...(d.data() as Omit<LocalAnnouncement, 'id'>),
          _synced: true,
        }));
        await localDB.announcements.bulkPut(items);
      },
      (err) => console.warn('[SyncService] Announcements listener error:', err)
    );
    this.unsubscribers.push(announcementUnsub);
  }

  // ── Individual Collection Syncs ────────────────────────────────────────────

  private async syncUserProfile(): Promise<void> {
    if (!this.userId) return;
    const snap = await getDoc(doc(firestore, 'users', this.userId));
    if (snap.exists()) {
      await localDB.users.put({
        id: snap.id,
        ...(snap.data() as Omit<LocalUser, 'id'>),
        _synced: true,
      });
    }
  }

  private async syncCourses(): Promise<void> {
    const snap = await getDocs(
      query(collection(firestore, 'courses'), where('isPublished', '==', true))
    );
    const courses: LocalCourse[] = snap.docs.map(d => ({
      id: d.id,
      ...(d.data() as Omit<LocalCourse, 'id'>),
      _synced: true,
    }));
    await localDB.courses.bulkPut(courses);

    // Also sync content for enrolled courses
    const enrollments = await localDB.enrollments
      .where('userId')
      .equals(this.userId!)
      .toArray();
    for (const enrollment of enrollments) {
      await this.syncCourseContent(enrollment.courseId);
    }
  }

  private async syncCourseContent(courseId: string): Promise<void> {
    // NOTE: live schema stores lessons/exams etc. in the top-level `content`
    // collection (see firestore.rules `match /content/{contentId}`), not a
    // `courses/{courseId}/content` subcollection. Query by courseId instead.
    const snap = await getDocs(
      query(collection(firestore, 'content'), where('courseId', '==', courseId))
    );
    const items: LocalContent[] = snap.docs.map(d => ({
      id: d.id,
      courseId,
      ...(d.data() as Omit<LocalContent, 'id' | 'courseId'>),
      _synced: true,
    }));
    await localDB.content.bulkPut(items);
  }

  private async syncEnrollments(): Promise<void> {
    if (!this.userId) return;
    // Live schema: enrollments use `studentId`, with `userId` kept on some
    // legacy docs (see firestore.rules — create accepts either field).
    // Query both and merge so nothing is missed regardless of which field
    // a given doc was written with.
    const [byStudentId, byUserId] = await Promise.all([
      getDocs(
        query(collection(firestore, 'enrollments'), where('studentId', '==', this.userId))
      ),
      getDocs(
        query(collection(firestore, 'enrollments'), where('userId', '==', this.userId))
      ).catch(() => ({ docs: [] as typeof Array.prototype })), // tolerate if none exist
    ]);

    const seen = new Set<string>();
    const items: LocalEnrollment[] = [];
    for (const d of [...byStudentId.docs, ...(byUserId as any).docs ?? []]) {
      if (seen.has(d.id)) continue;
      seen.add(d.id);
      const data = d.data() as Record<string, unknown>;
      items.push({
        id: d.id,
        userId: this.userId!,
        courseId: (data.courseId as string) ?? '',
        enrolledAt: (data.enrolledAt as number) ?? undefined,
        paymentStatus: (data.paymentStatus as string) ?? undefined,
        _synced: true,
      });
    }
    await localDB.enrollments.bulkPut(items);
  }

  private async syncProgress(): Promise<void> {
    if (!this.userId) return;
    // Live collection is `content_progress` (underscore), keyed by
    // studentId, doc id format `${contentId}__${studentId}`.
    const snap = await getDocs(
      query(
        collection(firestore, 'content_progress'),
        where('studentId', '==', this.userId)
      )
    );
    const items: LocalProgress[] = snap.docs.map(d => {
      const data = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        userId: this.userId!,
        courseId: (data.courseId as string) ?? '',
        contentId: (data.contentId as string) ?? '',
        completed: Boolean(data.completed),
        score: data.score as number | undefined,
        watchedSeconds: data.watchedSeconds as number | undefined,
        lastAccessedAt: data.lastAccessedAt as number | undefined,
        updatedAt: data.updatedAt as number | undefined,
        _synced: true,
        _pendingSync: false,
      };
    });
    await localDB.progress.bulkPut(items);
  }

  private async syncStudyPlan(): Promise<void> {
    if (!this.userId) return;
    // Live schema replaced the single `studyPlans/{uid}` doc with a
    // multi-doc `studyGoals` collection (one doc per goal, field studentId).
    // Collapse the goals into the single LocalStudyPlan record shape so
    // every other file reading localDB.studyPlans keeps working unchanged.
    const snap = await getDocs(
      query(collection(firestore, 'studyGoals'), where('studentId', '==', this.userId))
    );
    const goals = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    await localDB.studyPlans.put({
      id: this.userId,
      userId: this.userId,
      sessions: [], // live schema has no AI session array at this layer anymore
      goals,
      generatedAt: Date.now(),
      updatedAt: Date.now(),
      _synced: true,
      _pendingSync: false,
    });
  }

  private async syncPomodoroSessions(): Promise<void> {
    if (!this.userId) return;
    // Live schema field is `studentId`, and timestamps use `startTime`
    // (Firestore Timestamp) rather than `completedAt`. `duration` is the
    // live field name (minutes) — mapped to durationMinutes below.
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const snap = await getDocs(
      query(
        collection(firestore, 'pomodoroSessions'),
        where('studentId', '==', this.userId),
        where('startTime', '>=', Timestamp.fromMillis(thirtyDaysAgo)),
        orderBy('startTime', 'desc')
      )
    );
    const items: LocalPomodoroSession[] = snap.docs.map(d => {
      const data = d.data() as Record<string, unknown>;
      const startTime = data.startTime as Timestamp | number | undefined;
      const completedAtMs =
        startTime instanceof Timestamp ? startTime.toMillis() : (startTime as number) ?? Date.now();
      return {
        id: d.id,
        userId: this.userId!,
        subject: data.subject as string | undefined,
        topic: data.topic as string | undefined,
        durationMinutes: (data.duration as number) ?? 0,
        completedAt: completedAtMs,
        _synced: true,
        _pendingSync: false,
      };
    });
    await localDB.pomodoroSessions.bulkPut(items);
  }

  private async syncAnnouncements(): Promise<void> {
    const snap = await getDocs(
      query(
        collection(firestore, 'announcements'),
        orderBy('createdAt', 'desc'),
        limit(30)
      )
    );
    const items: LocalAnnouncement[] = snap.docs.map(d => ({
      id: d.id,
      ...(d.data() as Omit<LocalAnnouncement, 'id'>),
      _synced: true,
    }));
    await localDB.announcements.bulkPut(items);
  }

  private async syncNotifications(): Promise<void> {
    if (!this.userId) return;
    const snap = await getDocs(
      query(
        collection(firestore, 'notifications'),
        where('userId', '==', this.userId),
        orderBy('createdAt', 'desc'),
        limit(50)
      )
    );
    const items: LocalNotification[] = snap.docs.map(d => ({
      id: d.id,
      ...(d.data() as Omit<LocalNotification, 'id'>),
      _synced: true,
      _pendingSync: false,
    }));
    await localDB.notifications.bulkPut(items);
  }

  private async syncLeaderboard(): Promise<void> {
    // NOTE: live `leaderboard` collection is doc-per-user but there's no
    // guarantee every doc has a `score` field indexed the same way — if this
    // starts throwing a missing-index error again, use `leaderboardCache`
    // instead (already precomputed server-side per firestore.rules).
    const snap = await getDocs(
      query(
        collection(firestore, 'leaderboard'),
        orderBy('score', 'desc'),
        limit(100)
      )
    );
    const items: LocalLeaderboard[] = snap.docs.map((d, i) => ({
      id: d.id,
      ...(d.data() as Omit<LocalLeaderboard, 'id'>),
      rank: i + 1,
      _synced: true,
    }));
    await localDB.leaderboard.bulkPut(items);
  }

  private async syncAchievements(): Promise<void> {
    if (!this.userId) return;
    const snap = await getDocs(
      query(
        collection(firestore, 'achievements'),
        where('userId', '==', this.userId)
      )
    );
    const items: LocalAchievement[] = snap.docs.map(d => ({
      id: d.id,
      ...(d.data() as Omit<LocalAchievement, 'id'>),
      _synced: true,
    }));
    await localDB.achievements.bulkPut(items);
  }

  private async syncTasks(): Promise<void> {
    if (!this.userId) return;
    // Live schema has no student-owned `tasks` collection filterable by
    // userId — tasks belong to teacher-created `taskGroups` and are read
    // via the `tasks` collection with a blanket isSignedIn() read (no
    // ownership `where` is enforced server-side, so querying without a
    // `where` clause and filtering client-side is the only viable approach
    // that matches the actual rules).
    const snap = await getDocs(collection(firestore, 'tasks'));
    const items = snap.docs
      .map(d => ({ id: d.id, ...(d.data() as Record<string, unknown>) }))
      .filter(t => !t.assignedTo || (t.assignedTo as string[]).includes(this.userId!))
      .map(t => ({
        id: t.id as string,
        userId: this.userId!,
        title: (t.title as string) ?? '',
        completed: Boolean(t.completed),
        dueDate: t.dueDate as number | undefined,
        priority: t.priority as LocalTask['priority'],
        createdAt: t.createdAt as number | undefined,
        updatedAt: t.updatedAt as number | undefined,
        _synced: true,
        _pendingSync: false,
      }));
    await localDB.tasks.bulkPut(items);
  }

  // ── Write Methods (IndexedDB first, then Firestore) ───────────────────────

  /**
   * Write a document — saves locally immediately, syncs to Firestore if online.
   * If offline, queues for later.
   */
  async writeDoc(
    collectionName: string,
    docId: string,
    data: Record<string, unknown>,
    merge = true
  ): Promise<void> {
    // Always write to IndexedDB first based on collection
    await this.writeToLocalDB(collectionName, docId, data);

    if (this.isOnline) {
      try {
        const ref = doc(firestore, collectionName, docId);
        if (merge) {
          await setDoc(ref, data, { merge: true });
        } else {
          await setDoc(ref, data);
        }
      } catch (err) {
        console.warn('[SyncService] Firestore write failed, queuing:', err);
        await this.queueWrite(collectionName, docId, 'set', data);
      }
    } else {
      await this.queueWrite(collectionName, docId, 'set', data);
    }
  }

  /**
   * Delete a document — removes locally, queues Firestore delete.
   */
  async deleteDoc(collectionName: string, docId: string): Promise<void> {
    await this.deleteFromLocalDB(collectionName, docId);

    if (this.isOnline) {
      try {
        await deleteDoc(doc(firestore, collectionName, docId));
      } catch (err) {
        await this.queueWrite(collectionName, docId, 'delete');
      }
    } else {
      await this.queueWrite(collectionName, docId, 'delete');
    }
  }

  // ── Local DB Routing ───────────────────────────────────────────────────────

  private async writeToLocalDB(
    collectionName: string,
    docId: string,
    data: Record<string, unknown>
  ): Promise<void> {
    const record = { id: docId, ...data, _synced: false, _pendingSync: true };

    switch (collectionName) {
      case 'contentProgress':
      case 'content_progress':
        await localDB.progress.put(record as LocalProgress);
        break;
      case 'studyPlans':
      case 'studyGoals':
        await localDB.studyPlans.put(record as LocalStudyPlan);
        break;
      case 'pomodoroSessions':
        await localDB.pomodoroSessions.put(record as LocalPomodoroSession);
        break;
      case 'notifications':
        await localDB.notifications.put(record as LocalNotification);
        break;
      case 'tasks':
        await localDB.tasks.put(record as LocalTask);
        break;
      case 'users':
        await localDB.users.put(record as LocalUser);
        break;
      default:
        console.warn(`[SyncService] Unknown collection for local write: ${collectionName}`);
    }
  }

  private async deleteFromLocalDB(
    collectionName: string,
    docId: string
  ): Promise<void> {
    switch (collectionName) {
      case 'tasks':
        await localDB.tasks.delete(docId);
        break;
      case 'notifications':
        await localDB.notifications.delete(docId);
        break;
      default:
        console.warn(`[SyncService] Unknown collection for local delete: ${collectionName}`);
    }
  }

  // ── Sync Queue ─────────────────────────────────────────────────────────────

  private async queueWrite(
    collection: string,
    docId: string,
    operation: SyncQueueItem['operation'],
    data?: Record<string, unknown>
  ): Promise<void> {
    await localDB.syncQueue.add({
      collection,
      docId,
      operation,
      data,
      timestamp: Date.now(),
      retries: 0,
    });
  }

  async flushSyncQueue(): Promise<void> {
    if (!this.isOnline) return;

    const pending = await localDB.syncQueue.toArray();
    if (pending.length === 0) return;

    const succeeded: number[] = [];
    const failed: number[] = [];

    for (const item of pending) {
      try {
        const ref = doc(firestore, item.collection, item.docId);

        if (item.operation === 'delete') {
          await deleteDoc(ref);
        } else if (item.operation === 'set' && item.data) {
          await setDoc(ref, item.data, { merge: true });
        } else if (item.operation === 'update' && item.data) {
          await updateDoc(ref, item.data);
        }

        if (item.id !== undefined) succeeded.push(item.id);
      } catch (err) {
        console.warn('[SyncService] Queue flush failed for item:', item.id, err);
        if (item.id !== undefined) {
          // Increment retry count — abandon after 5 retries
          if (item.retries >= 5) {
            failed.push(item.id);
          } else {
            await localDB.syncQueue.update(item.id, { retries: item.retries + 1 });
          }
        }
      }
    }

    // Remove succeeded and permanently failed items
    await localDB.syncQueue.bulkDelete([...succeeded, ...failed]);

    console.log(
      `[SyncService] Queue flushed: ${succeeded.length} succeeded, ${failed.length} abandoned`
    );
  }

  // ── Public Helpers ─────────────────────────────────────────────────────────

  get online(): boolean {
    return this.isOnline;
  }

  get pendingWrites(): Promise<number> {
    return localDB.syncQueue.count();
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const syncService = new SyncService();
export default syncService;
