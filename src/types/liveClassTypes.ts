// src/types/liveClassTypes.ts
import { Timestamp } from 'firebase/firestore';

// ─── Provider Config Types ───────────────────────────────────────────────────

export interface JitsiKey {
  id: string;
  label: string;
  domain: string;
  roomPrefix: string;
  isActive: boolean;
  usageCount: number;
}

export interface HMSKey {
  id: string;
  label: string;
  appKey: string;
  appSecret: string;
  templateId: string;
  isActive: boolean;
  minutesUsed: number;
  minutesLimit: number;
  lastUsedAt?: Timestamp;
  resetAt?: Timestamp;
}

export interface BunnyConfig {
  libraryId: string;
  apiKey: string;
  cdnUrl: string;
}

export interface LiveClassSettings {
  provider: 'jitsi' | '100ms';

  jitsiKeys: JitsiKey[];
  activeJitsiKeyId: string;

  hmsKeys: HMSKey[];
  activeHmsKeyId: string;
  hmsRotationMode: 'manual' | 'auto';

  bunny: BunnyConfig;
  updatedAt?: Timestamp;
  updatedBy?: string;
}

// ─── Live Class Document ─────────────────────────────────────────────────────

export type ClassStatus = 'scheduled' | 'live' | 'ended';
export type VideoProvider = 'jitsi' | '100ms';

export interface LiveClass {
  id: string;
  title: string;
  description: string;
  teacherId: string;
  teacherName: string;
  courseId?: string;
  courseName?: string;
  scheduledAt: Timestamp;
  durationMins: number;
  status: ClassStatus;
  jitsiRoomId: string;
  hmsRoomId?: string;
  recordingUrl?: string;
  bunnyVideoId?: string;
  provider: VideoProvider;
  activeKeyId: string;
  startedAt?: Timestamp;
  endedAt?: Timestamp;
  actualDurationMins?: number;
  createdAt: Timestamp;
}

// ─── Attendance ──────────────────────────────────────────────────────────────

export interface LiveClassAttendance {
  id: string;
  classId: string;
  userId: string;
  userName: string;
  joinedAt: Timestamp;
  leftAt?: Timestamp;
  durationMins?: number;
}

// ─── Form / UI Types ─────────────────────────────────────────────────────────

export interface ScheduleClassForm {
  title: string;
  description: string;
  courseId?: string;
  courseName?: string;
  scheduledAt: string; // ISO date-time string for input
  durationMins: number;
}

export interface JoinInfo {
  classId: string;
  provider: VideoProvider;
  jitsiDomain?: string;
  jitsiRoomId?: string;
  hmsRoomId?: string;
  hmsAuthToken?: string;
  isHost: boolean;
}
