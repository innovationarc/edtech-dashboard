// src/services/settingsService.ts
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AppearanceSettings {
  theme: string;
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
  glitterTheme: string;
}

export interface GeneralSettings {
  siteName: string;
  siteTagline: string;
  contactEmail: string;
  timezone: string;
}

export interface NotificationSettings {
  newUserRegistrations: boolean;
  newContentUploads: boolean;
  studyPlanUpdates: boolean;
  systemAlerts: boolean;
  userActivityUpdates: boolean;
  contentEngagementMetrics: boolean;
  weeklySummaryReports: boolean;
  notificationFrequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
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

export interface UserSettings {
  appearance?: AppearanceSettings;
  notifications?: NotificationSettings;
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

const userSettingsRef = (uid: string) =>
  doc(db, 'users', uid, 'settings', 'preferences');

const globalSettingsRef = () => doc(db, 'settings', 'global');

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
