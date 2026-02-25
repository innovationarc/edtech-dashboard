// src/services/videoStreamService.ts
// Platform B — Secure Video Streaming Service
// Handles URL conversion, Firebase storage of secured video records,
// and communication with the /api/videoStream serverless endpoint.
// This is a STANDALONE service — it does NOT modify contentService.ts

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ─── Public types ─────────────────────────────────────────────────────────────

export type VideoSourcePlatform =
  | 'dropbox'
  | 'gdrive'
  | 'youtube'
  | 'vimeo'
  | 'dailymotion';

export interface SecuredVideo {
  /** Firestore document ID */
  id: string;
  /** The canonical proxy URL that the player (Platform C / ContentLibrary) uses */
  proxyUrl: string;
  /** Original source platform */
  platform: VideoSourcePlatform;
  /** Whether this is an embed (YouTube/Vimeo/Dailymotion) vs direct proxy (Dropbox/GDrive) */
  isEmbed: boolean;
  /** Display label supplied by the caller */
  label: string;
  /** ISO string – when the record was created */
  createdAt: string;
  /** Who created it */
  createdBy: string;
}

export interface SubmitVideoResult {
  success: boolean;
  /** The proxy URL to store in the content record's videoUrl field */
  proxyUrl: string;
  /** Firestore video record ID */
  videoId: string;
  platform: VideoSourcePlatform;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Derives the API base URL from the current window location so the service
 *  works in both local dev and Vercel production without any env config. */
function getApiBase(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return '';
}

// ─── Platform B URL converters (mirrors server.js logic, client-side) ─────────

function convertDropboxUrl(url: string): { streamUrl: string; success: boolean; message?: string } {
  try {
    let directUrl = url;
    if (!url.includes('raw=1')) {
      if (url.includes('dl=0')) directUrl = url.replace('dl=0', 'raw=1');
      else if (url.includes('dl=1')) directUrl = url.replace('dl=1', 'raw=1');
      else directUrl = url + (url.includes('?') ? '&' : '?') + 'raw=1';
    }
    return { streamUrl: directUrl, success: true };
  } catch (e: any) {
    return { streamUrl: '', success: false, message: e.message };
  }
}

function convertGoogleDriveUrl(url: string): { streamUrl: string; success: boolean; message?: string } {
  try {
    const matchFile = url.match(/\/file\/d\/([^/?]+)/);
    const matchOpen = url.match(/[?&]id=([^&]+)/);
    const fileId = matchFile ? matchFile[1] : matchOpen ? matchOpen[1] : null;
    if (fileId) {
      return {
        streamUrl: `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`,
        success: true,
      };
    }
    return { streamUrl: '', success: false, message: 'Invalid Google Drive URL' };
  } catch (e: any) {
    return { streamUrl: '', success: false, message: e.message };
  }
}

function convertYouTubeUrl(url: string): { streamUrl: string; success: boolean; message?: string } {
  try {
    const urlObj = new URL(url);
    const videoId = urlObj.hostname.includes('youtu.be')
      ? urlObj.pathname.slice(1)
      : urlObj.searchParams.get('v');
    if (videoId) {
      return {
        streamUrl: `https://www.youtube.com/embed/${videoId}`,
        success: true,
      };
    }
    return { streamUrl: '', success: false, message: 'Invalid YouTube URL' };
  } catch (e: any) {
    return { streamUrl: '', success: false, message: e.message };
  }
}

function convertVimeoUrl(url: string): { streamUrl: string; success: boolean; message?: string } {
  try {
    const urlObj = new URL(url);
    const videoId = urlObj.pathname.split('/').filter(Boolean)[0];
    if (videoId) {
      return {
        streamUrl: `https://player.vimeo.com/video/${videoId}`,
        success: true,
      };
    }
    return { streamUrl: '', success: false, message: 'Invalid Vimeo URL' };
  } catch (e: any) {
    return { streamUrl: '', success: false, message: e.message };
  }
}

function convertDailymotionUrl(url: string): { streamUrl: string; success: boolean; message?: string } {
  try {
    const urlObj = new URL(url);
    const videoId = urlObj.pathname.split('/').filter((p) => p && p !== 'video')[0];
    if (videoId) {
      return {
        streamUrl: `https://www.dailymotion.com/embed/video/${videoId}`,
        success: true,
      };
    }
    return { streamUrl: '', success: false, message: 'Invalid Dailymotion URL' };
  } catch (e: any) {
    return { streamUrl: '', success: false, message: e.message };
  }
}

const EMBED_PLATFORMS: VideoSourcePlatform[] = ['youtube', 'vimeo', 'dailymotion'];

// ─── videoStreamService ───────────────────────────────────────────────────────

export const videoStreamService = {
  /**
   * Submit a source video URL to the Platform B backend.
   * The backend converts it, stores it in Firebase, and returns a secure proxy URL.
   * That proxy URL is what you store in `content.videoUrl` instead of the raw source URL.
   *
   * @param sourceUrl   The original Dropbox / GDrive / YouTube / etc. URL
   * @param platform    Which platform the URL is from
   * @param label       Human-readable label (e.g. content title) for the record
   * @param createdBy   User UID
   */
  async submitVideo(
    sourceUrl: string,
    platform: VideoSourcePlatform,
    label: string,
    createdBy: string
  ): Promise<SubmitVideoResult> {
    const response = await fetch(`${getApiBase()}/api/videoStream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'submit', sourceUrl, platform, label, createdBy }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: 'Network error' }));
      throw new Error(err.message || `Server error ${response.status}`);
    }

    const data = await response.json();
    if (!data.success) throw new Error(data.message || 'Failed to submit video');
    return data as SubmitVideoResult;
  },

  /**
   * Validate a source URL format on the CLIENT side before even hitting the API.
   * Returns an error message string if invalid, or null if valid.
   */
  validateSourceUrl(url: string, platform: VideoSourcePlatform): string | null {
    if (!url || !url.trim()) return 'URL is required';

    try {
      new URL(url); // basic URL check
    } catch {
      return 'Invalid URL format';
    }

    switch (platform) {
      case 'dropbox':
        if (!url.includes('dropbox.com')) return 'URL does not appear to be a Dropbox link';
        break;
      case 'gdrive':
        if (!url.includes('drive.google.com') && !url.includes('docs.google.com'))
          return 'URL does not appear to be a Google Drive link';
        break;
      case 'youtube':
        if (!url.includes('youtube.com') && !url.includes('youtu.be'))
          return 'URL does not appear to be a YouTube link';
        break;
      case 'vimeo':
        if (!url.includes('vimeo.com')) return 'URL does not appear to be a Vimeo link';
        break;
      case 'dailymotion':
        if (!url.includes('dailymotion.com')) return 'URL does not appear to be a Dailymotion link';
        break;
    }

    return null; // valid
  },

  /**
   * Get metadata for a secured video by its Firestore video ID.
   * Returns stream tokens (for Dropbox/GDrive) or a proxyUrl (for embeds).
   * Called by the ContentLibrary / player component.
   */
  async getVideoMetadata(videoId: string, securityString: string) {
    const response = await fetch(`${getApiBase()}/api/videoStream?action=meta&videoId=${videoId}`, {
      headers: { 'x-security-string': securityString },
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: 'Network error' }));
      throw new Error(err.message || `Server error ${response.status}`);
    }

    return response.json();
  },

  /**
   * Fetch a single chunk from the Platform B chunk proxy.
   * Called by the MediaSource pump loop in the ContentLibrary player.
   */
  async fetchChunk(
    videoId: string,
    chunkIndex: number,
    chunkToken: string
  ): Promise<{ blob: ArrayBuffer; nextChunkToken: string; isLastChunk: boolean }> {
    const response = await fetch(
      `${getApiBase()}/api/videoStream?action=chunk&videoId=${encodeURIComponent(videoId)}&chunk=${chunkIndex}`,
      { headers: { 'x-chunk-token': chunkToken } }
    );

    if (response.status === 204) {
      // Past end of file
      return { blob: new ArrayBuffer(0), nextChunkToken: '', isLastChunk: true };
    }

    if (!response.ok) throw new Error(`Chunk fetch failed: ${response.status}`);

    const blob = await response.arrayBuffer();
    const nextChunkToken = response.headers.get('x-next-chunk-token') || '';
    const isLastChunk = response.headers.get('x-is-last-chunk') === 'true';

    return { blob, nextChunkToken, isLastChunk };
  },

  /**
   * Delete a secured video record from Firebase.
   * Call this when the corresponding content record is deleted.
   */
  async deleteSecuredVideo(videoId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'securedVideos', videoId));
      console.log('Secured video record deleted:', videoId);
    } catch (error: any) {
      console.error('Error deleting secured video record:', error);
    }
  },

  /**
   * List all secured video records created by a user.
   * Useful for admin inspection / cleanup.
   */
  async getSecuredVideosByUser(userId: string): Promise<SecuredVideo[]> {
    const q = query(
      collection(db, 'securedVideos'),
      where('createdBy', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as SecuredVideo));
  },

  /**
   * Extract a videoId from a proxy URL produced by submitVideo.
   * Proxy URLs look like: https://yourdomain.com/api/videoStream?action=meta&videoId=<id>
   * or the content-facing format stored in Firestore: secured://<videoId>
   */
  extractVideoId(proxyUrl: string): string | null {
    if (proxyUrl.startsWith('secured://')) {
      return proxyUrl.replace('secured://', '');
    }
    try {
      const url = new URL(proxyUrl);
      return url.searchParams.get('videoId');
    } catch {
      return null;
    }
  },

  /** Returns human-readable platform label for UI display */
  getPlatformLabel(platform: VideoSourcePlatform): string {
    const labels: Record<VideoSourcePlatform, string> = {
      dropbox: 'Dropbox',
      gdrive: 'Google Drive',
      youtube: 'YouTube',
      vimeo: 'Vimeo',
      dailymotion: 'Dailymotion',
    };
    return labels[platform] || platform;
  },

  /** Returns platform icon emoji for UI display */
  getPlatformIcon(platform: VideoSourcePlatform): string {
    const icons: Record<VideoSourcePlatform, string> = {
      dropbox: '📦',
      gdrive: '📁',
      youtube: '▶️',
      vimeo: '🎬',
      dailymotion: '🎥',
    };
    return icons[platform] || '🎞️';
  },

  /** Whether this platform uses an iframe embed or the chunked MSE stream */
  isEmbedPlatform(platform: VideoSourcePlatform): boolean {
    return EMBED_PLATFORMS.includes(platform);
  },

  // ─── Client-side URL conversion helpers (exposed for the API route) ──────────
  // These are used server-side in api/videoStream.ts via re-export,
  // but also exposed here so any consumer can use them.

  _convertDropboxUrl: convertDropboxUrl,
  _convertGoogleDriveUrl: convertGoogleDriveUrl,
  _convertYouTubeUrl: convertYouTubeUrl,
  _convertVimeoUrl: convertVimeoUrl,
  _convertDailymotionUrl: convertDailymotionUrl,
};
