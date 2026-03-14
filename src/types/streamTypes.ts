// src/types/streamTypes.ts
import { Timestamp } from 'firebase/firestore';

// ─── Provider Types ───────────────────────────────────────────────────────────

export type StreamProvider = 'bunny' | 'cloudflare' | 'youtube';
export type StreamStatus   = 'scheduled' | 'live' | 'ended';
export type StreamMode     = 'obs' | 'browser'; // browser only works with Cloudflare WHIP

// ─── Admin Settings (app_settings/streaming) ──────────────────────────────────

export interface BunnyStreamConfig {
  apiKey: string;         // Bunny Stream API key
  pullZoneHostname: string; // e.g. myplatform.b-cdn.net
}

export interface CloudflareStreamConfig {
  accountId: string;
  apiToken: string;
  customerSubdomain: string; // the "customer-xxxx" part of the playback URL
}

export interface StreamingSettings {
  activeProvider: StreamProvider;
  bunny: BunnyStreamConfig;
  cloudflare: CloudflareStreamConfig;
  // YouTube needs no platform credentials — teacher supplies their own stream key
  updatedAt?: Timestamp;
  updatedBy?: string;
}

// ─── Live Stream Document (live_streams/{streamId}) ───────────────────────────

export interface LiveStream {
  id: string;
  title: string;
  description: string;
  teacherId: string;
  teacherName: string;
  courseId?: string;
  courseName?: string;
  provider: StreamProvider;
  status: StreamStatus;
  mode: StreamMode;

  // OBS / RTMP info (shown to teacher, hidden from students)
  rtmpUrl?: string;
  streamKey?: string;

  // Playback (given to students)
  playbackUrl: string;    // HLS m3u8 for Bunny/Cloudflare, video ID for YouTube
  embedUrl?: string;      // full iframe-ready URL

  // Provider-specific IDs
  bunnyStreamId?: string;
  cloudflareInputId?: string;
  youtubeVideoId?: string;

  // Cloudflare browser streaming
  whipEndpoint?: string;

  // Stats
  viewerCount: number;
  chatEnabled: boolean;

  // Recording
  recordingUrl?: string;

  // Timestamps
  scheduledAt?: Timestamp;
  startedAt?: Timestamp;
  endedAt?: Timestamp;
  createdAt: Timestamp;
}

// ─── Chat Message (live_streams/{streamId}/chat/{msgId}) ─────────────────────

export interface StreamChatMessage {
  id: string;
  streamId: string;
  userId: string;
  userName: string;
  userRole: string;
  message: string;
  createdAt: Timestamp;
  deleted?: boolean;
}

// ─── Form Types ───────────────────────────────────────────────────────────────

export interface StreamScheduleForm {
  title: string;
  description: string;
  courseId?: string;
  courseName?: string;
  provider: StreamProvider;
  mode: StreamMode;
  scheduledAt: string;
  // YouTube — teacher supplies their own keys
  youtubeVideoId?: string;
  youtubeStreamKey?: string;
}
