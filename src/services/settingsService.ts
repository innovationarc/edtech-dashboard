// src/services/settingsService.ts
import {
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  where,
  writeBatch,
  Timestamp,
  deleteDoc,
} from 'firebase/firestore';
import { getDocs, getDoc } from './firestoreMonitor';
import { db } from '../config/firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AppearanceSettings {
  theme: string;
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
  glitterTheme: string; // kept for backward compat — use `background` going forward
  background: string;   // 'none' | 'silver' | 'gold' | 'purple' | image-id (e.g. 'lunar-horizon')
  cardStyle: string;
  cardAnimation: string;
}

export interface GeneralSettings {
  siteName: string;
  siteTagline: string;
  contactEmail: string;
  timezone: string;
}

export interface NotificationSettings {
  // ── Legacy admin fields (kept for backwards-compat) ──────────────────────
  newUserRegistrations: boolean;
  newContentUploads: boolean;
  studyPlanUpdates: boolean;
  systemAlerts: boolean;
  userActivityUpdates: boolean;
  contentEngagementMetrics: boolean;
  weeklySummaryReports: boolean;
  notificationFrequency: 'immediate' | 'hourly' | 'daily' | 'weekly';

  // ── Per-category in-app notification toggles ─────────────────────────────
  // When false, that category is hidden in NotificationsPage for this user.
  notifyAnnouncements: boolean;      // type: announcement
  notifyCourseEnrollment: boolean;   // relatedType: courseEnrollment
  notifyQaAnswers: boolean;          // relatedType: qa  (answered only)
  notifyTaskAssigned: boolean;       // relatedType: taskGroup
  notifyTaskEvaluation: boolean;     // relatedType: task (grade)
  notifyExamResults: boolean;        // relatedType: exam
  notifyStudyPlan: boolean;          // relatedType: studyGoal | studySchedule | streakFreeze
  notifyEarlyAccess: boolean;        // relatedType: earlyAccess | featureRequest (approve/reject/status)
  notifyNewComingSoonFeatures: boolean; // relatedType: comingSoon (new feature announced)
}

export interface SecuritySettings {
  requireStrongPasswords: boolean;
  forcePasswordReset90Days: boolean;
  preventPasswordReuse: boolean;
  require2FAForAdmins: boolean;
  allowSMSVerification: boolean;
  allowAuthenticatorApps: boolean;
  autoLogoutMinutes: number;
  allowConcurrentSessions: boolean;
  maxFailedLoginAttempts: number;
  lockoutDurationMinutes: number;
}

export interface UsersPermissionsSettings {
  allowPublicRegistration: boolean;
  requireEmailVerification: boolean;
  requireAdminApproval: boolean;
}

export interface UserGeneralSettings {
  language: 'en' | 'bn';
  timezoneMode: 'auto' | 'manual';
  manualTimezone: string;
}

export interface LoginLog {
  browser: string;
  os: string;
  ip: string;
  city: string;
  country: string;
  createdAt: unknown; // Firestore Timestamp
}

// ─── Pomodoro / ambient sound types ──────────────────────────────────────────

/**
 * A sound track uploaded by an admin.
 * Stored in: pomodoroSounds/{soundId}
 *
 * url: raw GitHub URL (https://raw.githubusercontent.com/...) or any CDN URL.
 *      Must be a direct audio stream (WebM, MP3, OGG). No GDrive share links.
 */
export interface PomodoroSound {
  id: string;           // Firestore document id (populated client-side after fetch)
  title: string;        // Display name shown in the student selector
  url: string;          // Direct streamable audio URL
  isDefault: boolean;   // If true, applied to users who have never picked a sound
  uploadedBy: string;   // admin uid
  createdAt: unknown;   // Firestore Timestamp
}

/**
 * Per-user Pomodoro preferences.
 * Stored inside users/{uid}/settings/preferences under the key "pomodoro".
 *
 * selectedSoundId:
 *   null  → user has never opened settings → fall back to the default sound
 *   'none' → user explicitly chose silence
 *   '<id>' → user picked a specific sound
 */
export interface PomodoroSettings {
  selectedSoundId: string | null; // null | 'none' | soundId
  volume: number;                 // 0–1, default 0.5
}

export interface UserSettings {
  appearance?: AppearanceSettings;
  notifications?: NotificationSettings;
  general?: UserGeneralSettings;
  pomodoro?: PomodoroSettings;
  updatedAt?: unknown;
}

export interface GlobalSettings {
  general?: GeneralSettings;
  security?: SecuritySettings;
  usersPermissions?: UsersPermissionsSettings;
  updatedAt?: unknown;
}

// ─── Collection paths ──────────────────────────────────────────────────────────
// Per-user settings: users/{uid}/settings/preferences
// Global (admin) settings: settings/global
// Pomodoro sounds (global): pomodoroSounds/{soundId}

const userSettingsRef = (uid: string) =>
  doc(db, 'users', uid, 'settings', 'preferences');

const globalSettingsRef = () => doc(db, 'settings', 'global');

const pomodoroSoundsCol = () => collection(db, 'pomodoroSounds');
const pomodoroSoundRef  = (id: string) => doc(db, 'pomodoroSounds', id);

// ─── User settings (appearance, notifications) ────────────────────────────────

export const getUserSettings = async (uid: string): Promise<UserSettings> => {
  const snap = await getDoc(userSettingsRef(uid));
  return snap.exists() ? (snap.data() as UserSettings) : {};
};

export const saveAppearanceSettings = async (
  uid: string,
  settings: AppearanceSettings
): Promise<void> => {
  const ref = userSettingsRef(uid);
  const snap = await getDoc(ref);
  const payload = { appearance: settings, updatedAt: serverTimestamp() };
  if (snap.exists()) {
    await updateDoc(ref, payload);
  } else {
    await setDoc(ref, payload);
  }
};

export const saveNotificationSettings = async (
  uid: string,
  settings: NotificationSettings
): Promise<void> => {
  const ref = userSettingsRef(uid);
  const snap = await getDoc(ref);
  const payload = { notifications: settings, updatedAt: serverTimestamp() };
  if (snap.exists()) {
    await updateDoc(ref, payload);
  } else {
    await setDoc(ref, payload);
  }
};

// ─── Global settings (admin only) ────────────────────────────────────────────

export const getGlobalSettings = async (): Promise<GlobalSettings> => {
  const snap = await getDoc(globalSettingsRef());
  return snap.exists() ? (snap.data() as GlobalSettings) : {};
};

export const saveGeneralSettings = async (
  settings: GeneralSettings
): Promise<void> => {
  const ref = globalSettingsRef();
  const snap = await getDoc(ref);
  const payload = { general: settings, updatedAt: serverTimestamp() };
  if (snap.exists()) {
    await updateDoc(ref, payload);
  } else {
    await setDoc(ref, payload);
  }
};

export const saveSecuritySettings = async (
  settings: SecuritySettings
): Promise<void> => {
  const ref = globalSettingsRef();
  const snap = await getDoc(ref);
  const payload = { security: settings, updatedAt: serverTimestamp() };
  if (snap.exists()) {
    await updateDoc(ref, payload);
  } else {
    await setDoc(ref, payload);
  }
};

export const saveUsersPermissionsSettings = async (
  settings: UsersPermissionsSettings
): Promise<void> => {
  const ref = globalSettingsRef();
  const snap = await getDoc(ref);
  const payload = { usersPermissions: settings, updatedAt: serverTimestamp() };
  if (snap.exists()) {
    await updateDoc(ref, payload);
  } else {
    await setDoc(ref, payload);
  }
};

// ─── User general settings (language, timezone) ───────────────────────────────

export const saveUserGeneralSettings = async (
  uid: string,
  settings: UserGeneralSettings
): Promise<void> => {
  const ref = userSettingsRef(uid);
  const snap = await getDoc(ref);
  const payload = { general: settings, updatedAt: serverTimestamp() };
  if (snap.exists()) {
    await updateDoc(ref, payload);
  } else {
    await setDoc(ref, payload);
  }
};

export const getUserGeneralSettings = async (
  uid: string
): Promise<UserGeneralSettings | null> => {
  const snap = await getDoc(userSettingsRef(uid));
  if (!snap.exists()) return null;
  return (snap.data() as UserSettings).general ?? null;
};

export const getUserNotificationSettings = async (
  uid: string
): Promise<NotificationSettings | null> => {
  const snap = await getDoc(userSettingsRef(uid));
  if (!snap.exists()) return null;
  return (snap.data() as UserSettings).notifications ?? null;
};

// ─── Pomodoro sound settings (per-user) ───────────────────────────────────────

export const getUserPomodoroSettings = async (
  uid: string
): Promise<PomodoroSettings | null> => {
  const snap = await getDoc(userSettingsRef(uid));
  if (!snap.exists()) return null;
  return (snap.data() as UserSettings).pomodoro ?? null;
};

export const saveUserPomodoroSettings = async (
  uid: string,
  settings: PomodoroSettings
): Promise<void> => {
  const ref = userSettingsRef(uid);
  const snap = await getDoc(ref);
  const payload = { pomodoro: settings, updatedAt: serverTimestamp() };
  if (snap.exists()) {
    await updateDoc(ref, payload);
  } else {
    await setDoc(ref, payload);
  }
};

// ─── Pomodoro sounds library (admin CRUD) ─────────────────────────────────────

/** Fetch all sounds ordered by creation date (ascending = upload order). */
export const getPomodoroSounds = async (): Promise<PomodoroSound[]> => {
  const q = query(pomodoroSoundsCol(), orderBy('createdAt', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<PomodoroSound, 'id'>) }));
};

/**
 * Add a new sound.
 * If isDefault is true, clears isDefault on all existing sounds first
 * (only one sound can be default at a time).
 */
export const addPomodoroSound = async (
  sound: Omit<PomodoroSound, 'id' | 'createdAt'>
): Promise<string> => {
  if (sound.isDefault) {
    await _clearAllDefaults();
  }
  const ref = await addDoc(pomodoroSoundsCol(), {
    title:      sound.title,
    url:        sound.url,
    isDefault:  sound.isDefault,
    uploadedBy: sound.uploadedBy,
    createdAt:  serverTimestamp(),
  });
  return ref.id;
};

/**
 * Mark a sound as default; clears the previous default first.
 */
export const setPomodoroSoundDefault = async (soundId: string): Promise<void> => {
  await _clearAllDefaults();
  await updateDoc(pomodoroSoundRef(soundId), { isDefault: true });
};

/**
 * Remove default from a sound without setting a new one.
 */
export const clearPomodoroSoundDefault = async (soundId: string): Promise<void> => {
  await updateDoc(pomodoroSoundRef(soundId), { isDefault: false });
};

/** Delete a sound document. */
export const deletePomodoroSound = async (soundId: string): Promise<void> => {
  await deleteDoc(pomodoroSoundRef(soundId));
};

/** Internal helper: batch-clear isDefault on all sounds that have it set. */
const _clearAllDefaults = async (): Promise<void> => {
  const q = query(pomodoroSoundsCol(), where('isDefault', '==', true));
  const snap = await getDocs(q);
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.update(d.ref, { isDefault: false }));
  await batch.commit();
};

// ─── Login logs ───────────────────────────────────────────────────────────────
// Each login writes a document to users/{uid}/loginLogs

const loginLogsRef = (uid: string) =>
  collection(db, 'users', uid, 'loginLogs');

export const saveLoginLog = async (
  uid: string,
  log: Omit<LoginLog, 'createdAt'>
): Promise<void> => {
  try {
    await addDoc(loginLogsRef(uid), {
      ...log,
      createdAt: serverTimestamp(),
    });
  } catch {
    // Non-blocking — never fail a login because of log write
  }
};

export const getLoginLogs = async (
  uid: string,
  limitCount = 10
): Promise<LoginLog[]> => {
  const cutoff = Timestamp.fromDate(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  );

  // Fetch recent logs to display
  const q = query(loginLogsRef(uid), orderBy('createdAt', 'desc'), limit(limitCount));
  const snap = await getDocs(q);

  // Purge logs older than 30 days — non-blocking, never throws
  getDocs(query(loginLogsRef(uid), where('createdAt', '<', cutoff)))
    .then(oldSnap => {
      if (oldSnap.empty) return;
      const batch = writeBatch(db);
      oldSnap.docs.forEach(d => batch.delete(d.ref));
      return batch.commit();
    })
    .catch(() => {});

  return snap.docs.map(d => d.data() as LoginLog);
};
