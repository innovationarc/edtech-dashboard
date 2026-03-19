// src/services/liveClassService.ts
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  Timestamp,
  runTransaction,
  setDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  LiveClass,
  LiveClassAttendance,
  LiveClassSettings,
  ScheduleClassForm,
  HMSKey,
} from '../types/liveClassTypes';

// ─── Settings ────────────────────────────────────────────────────────────────

const SETTINGS_DOC = 'app_settings/live_class';

export const liveClassSettingsService = {
  async get(): Promise<LiveClassSettings | null> {
    try {
      const snap = await getDoc(doc(db, 'app_settings', 'live_class'));
      if (!snap.exists()) return null;
      return snap.data() as LiveClassSettings;
    } catch {
      return null;
    }
  },

  async save(settings: Partial<LiveClassSettings>, updatedBy: string): Promise<void> {
    await setDoc(
      doc(db, 'app_settings', 'live_class'),
      { ...settings, updatedAt: Timestamp.now(), updatedBy },
      { merge: true }
    );
  },

  onSnapshot(callback: (settings: LiveClassSettings | null) => void): () => void {
    return onSnapshot(doc(db, 'app_settings', 'live_class'), (snap) => {
      callback(snap.exists() ? (snap.data() as LiveClassSettings) : null);
    });
  },
};

// ─── Live Classes ─────────────────────────────────────────────────────────────

export const liveClassService = {
  async getAll(): Promise<LiveClass[]> {
    const q = query(
      collection(db, 'live_classes'),
      orderBy('scheduledAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as LiveClass));
  },

  async getByTeacher(teacherId: string): Promise<LiveClass[]> {
    const q = query(
      collection(db, 'live_classes'),
      where('teacherId', '==', teacherId),
      orderBy('scheduledAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as LiveClass));
  },

  async getById(classId: string): Promise<LiveClass | null> {
    const snap = await getDoc(doc(db, 'live_classes', classId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as LiveClass;
  },

  async schedule(
    form: ScheduleClassForm,
    teacherId: string,
    teacherName: string,
    provider: 'jitsi' | '100ms',
    activeKeyId: string,
    jitsiRoomId: string,
    hmsRoomId?: string,
    contentId?: string
  ): Promise<string> {
    const ref = await addDoc(collection(db, 'live_classes'), {
      title: form.title,
      description: form.description,
      teacherId,
      teacherName,
      courseId: form.courseId || null,
      courseName: form.courseName || null,
      contentId: contentId || null,
      scheduledAt: Timestamp.fromDate(new Date(form.scheduledAt)),
      durationMins: form.durationMins,
      status: 'scheduled',
      jitsiRoomId,
      hmsRoomId: hmsRoomId || null,
      recordingUrl: null,
      bunnyVideoId: null,
      provider,
      activeKeyId,
      startedAt: null,
      endedAt: null,
      actualDurationMins: null,
      createdAt: Timestamp.now(),
    });
    return ref.id;
  },

  async start(classId: string): Promise<void> {
    await updateDoc(doc(db, 'live_classes', classId), {
      status: 'live',
      startedAt: Timestamp.now(),
    });
  },

  async end(classId: string): Promise<void> {
    const classDoc = await getDoc(doc(db, 'live_classes', classId));
    if (!classDoc.exists()) return;

    const data = classDoc.data() as LiveClass;
    const startedAt = data.startedAt?.toDate() ?? new Date();
    const endedAt = new Date();
    const actualDurationMins = Math.round(
      (endedAt.getTime() - startedAt.getTime()) / 60000
    );

    // Run transaction: update class + increment HMS key usage
    await runTransaction(db, async (tx) => {
      tx.update(doc(db, 'live_classes', classId), {
        status: 'ended',
        endedAt: Timestamp.now(),
        actualDurationMins,
      });

      // Increment HMS key minutesUsed if provider was 100ms
      if (data.provider === '100ms' && data.activeKeyId) {
        const settingsRef = doc(db, 'app_settings', 'live_class');
        const settingsSnap = await tx.get(settingsRef);
        if (settingsSnap.exists()) {
          const settings = settingsSnap.data() as LiveClassSettings;
          const keyIndex = settings.hmsKeys?.findIndex(
            (k: HMSKey) => k.id === data.activeKeyId
          );
          if (keyIndex !== undefined && keyIndex >= 0) {
            const updated = [...settings.hmsKeys];
            updated[keyIndex] = {
              ...updated[keyIndex],
              minutesUsed: (updated[keyIndex].minutesUsed || 0) + actualDurationMins,
              lastUsedAt: Timestamp.now(),
            };
            tx.update(settingsRef, { hmsKeys: updated });
          }
        }
      }
    });
  },

  async delete(classId: string): Promise<void> {
    await deleteDoc(doc(db, 'live_classes', classId));
  },

  async setRecording(
    classId: string,
    recordingUrl: string,
    bunnyVideoId?: string,
    contentId?: string,
  ): Promise<void> {
    await updateDoc(doc(db, 'live_classes', classId), {
      recordingUrl,
      bunnyVideoId: bunnyVideoId || null,
      ...(contentId ? { contentId } : {}),
    });
  },

  onSnapshot(callback: (classes: LiveClass[]) => void): () => void {
    const q = query(
      collection(db, 'live_classes'),
      orderBy('scheduledAt', 'desc')
    );
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as LiveClass)));
    });
  },

  onSnapshotByTeacher(
    teacherId: string,
    callback: (classes: LiveClass[]) => void
  ): () => void {
    const q = query(
      collection(db, 'live_classes'),
      where('teacherId', '==', teacherId),
      orderBy('scheduledAt', 'desc')
    );
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as LiveClass)));
    });
  },
};

// ─── Attendance ───────────────────────────────────────────────────────────────

const attendanceId = (classId: string, userId: string) =>
  `${classId}__${userId}`;

export const attendanceService = {
  async join(classId: string, userId: string, userName: string): Promise<void> {
    const id = attendanceId(classId, userId);
    await setDoc(doc(db, 'live_class_attendance', id), {
      id,
      classId,
      userId,
      userName,
      joinedAt: Timestamp.now(),
      leftAt: null,
      durationMins: null,
    });
  },

  async leave(classId: string, userId: string): Promise<void> {
    const id = attendanceId(classId, userId);
    const snap = await getDoc(doc(db, 'live_class_attendance', id));
    if (!snap.exists()) return;
    const joinedAt = (snap.data().joinedAt as Timestamp).toDate();
    const leftAt = new Date();
    const durationMins = Math.round(
      (leftAt.getTime() - joinedAt.getTime()) / 60000
    );
    await updateDoc(doc(db, 'live_class_attendance', id), {
      leftAt: Timestamp.now(),
      durationMins,
    });
  },

  async getByClass(classId: string): Promise<LiveClassAttendance[]> {
    const q = query(
      collection(db, 'live_class_attendance'),
      where('classId', '==', classId)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...d.data() } as LiveClassAttendance));
  },
};
