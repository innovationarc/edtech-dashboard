// src/services/videoUploadService.ts
// Handles LOCAL video upload to Bunny.net Storage (browser → Bunny directly).
// Notes and exam images continue to use uploadService (Supabase) — this file is video-only.
//
// Required .env vars (all VITE_ prefix so Vite exposes them to the browser):
//   VITE_BUNNY_ENABLED=true              ← master switch; set false to disable local video upload
//   VITE_BUNNY_STORAGE_ZONE=myzone       ← your Bunny Storage Zone name
//   VITE_BUNNY_API_KEY=xxxx              ← Storage Zone Password (from Bunny dashboard → FTP & API Access)
//   VITE_BUNNY_CDN_HOSTNAME=myzone.b-cdn.net  ← Pull Zone hostname (no https://)
//   VITE_BUNNY_STORAGE_HOST=https://storage.bunnycdn.com  ← Storage API base (default shown)

export interface VideoUploadProgress {
  percentage: number;
  speed?: number; // bytes per second
}

// ── Read env once at module load ──
const BUNNY_ENABLED       = import.meta.env.VITE_BUNNY_ENABLED === 'true';
const BUNNY_STORAGE_ZONE  = import.meta.env.VITE_BUNNY_STORAGE_ZONE  || '';
const BUNNY_API_KEY       = import.meta.env.VITE_BUNNY_API_KEY        || '';
const BUNNY_CDN_HOSTNAME  = import.meta.env.VITE_BUNNY_CDN_HOSTNAME   || '';
// Default storage host for EU region; use https://uk.storage.bunnycdn.com etc. for other regions
const BUNNY_STORAGE_HOST  = import.meta.env.VITE_BUNNY_STORAGE_HOST   || 'https://storage.bunnycdn.com';

function assertBunnyConfig(): void {
  if (!BUNNY_ENABLED) {
    throw new Error(
      'Local video upload is disabled. Set VITE_BUNNY_ENABLED=true in your .env and add your Bunny.net credentials.'
    );
  }
  const missing: string[] = [];
  if (!BUNNY_STORAGE_ZONE) missing.push('VITE_BUNNY_STORAGE_ZONE');
  if (!BUNNY_API_KEY)       missing.push('VITE_BUNNY_API_KEY');
  if (!BUNNY_CDN_HOSTNAME)  missing.push('VITE_BUNNY_CDN_HOSTNAME');
  if (missing.length) {
    throw new Error(`Missing Bunny.net env vars: ${missing.join(', ')}`);
  }
}

export const videoUploadService = {
  /** Whether local video upload is currently enabled (env flag). */
  isEnabled(): boolean {
    return BUNNY_ENABLED;
  },

  /**
   * Upload a video file directly from the browser to Bunny.net Storage via XHR PUT.
   * The server never touches the video bytes.
   *
   * @param file     The video File object selected by the admin
   * @param folder   Storage folder path, e.g. "content/lesson/videos"
   * @param onProgress  Optional progress callback (percentage 0–100, speed in bytes/s)
   * @returns { url, fileName }
   *   url      — public CDN URL (https://<CDN_HOSTNAME>/<STORAGE_ZONE>/<folder>/<fileName>)
   *   fileName — the stored file name (timestamp_originalname)
   */
  async uploadVideo(
    file: File,
    folder: string,
    onProgress?: (progress: VideoUploadProgress) => void
  ): Promise<{ url: string; fileName: string }> {
    assertBunnyConfig();

    if (!file) throw new Error('No file provided');

    const startTime   = Date.now();
    const sanitized   = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName    = `${startTime}_${sanitized}`;
    const remotePath  = `${folder}/${fileName}`;
    const uploadUrl   = `${BUNNY_STORAGE_HOST}/${BUNNY_STORAGE_ZONE}/${remotePath}`;

    console.log('[Bunny] Uploading video:', remotePath);

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl, true);
      xhr.setRequestHeader('AccessKey', BUNNY_API_KEY);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const percentage = Math.round((event.loaded / event.total) * 100);
          const elapsedSec = (Date.now() - startTime) / 1000;
          const speed      = elapsedSec > 0 ? Math.round(event.loaded / elapsedSec) : 0;
          onProgress({ percentage, speed });
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(
            new Error(`Bunny.net upload failed: HTTP ${xhr.status} — ${xhr.responseText || xhr.statusText}`)
          );
        }
      };

      xhr.onerror   = () => reject(new Error('Bunny.net upload failed: Network error'));
      xhr.onabort   = () => reject(new Error('Bunny.net upload aborted'));
      xhr.ontimeout = () => reject(new Error('Bunny.net upload timed out'));

      xhr.send(file);
    });

    const publicUrl = `https://${BUNNY_CDN_HOSTNAME}/${BUNNY_STORAGE_ZONE}/${remotePath}`;
    console.log('[Bunny] Upload complete:', publicUrl);

    return { url: publicUrl, fileName };
  },

  /**
   * Delete a video file from Bunny.net Storage.
   * Silently skips URLs that don't belong to Bunny (secured://, GDrive, etc.).
   *
   * @param fileUrl  The public CDN URL returned by uploadVideo()
   */
  async deleteVideo(fileUrl: string): Promise<void> {
    if (!fileUrl) return;

    // Skip non-Bunny URLs (secured proxy, GDrive links, Supabase URLs, etc.)
    const cdnPrefix = `https://${BUNNY_CDN_HOSTNAME}/`;
    if (!fileUrl.startsWith(cdnPrefix)) {
      console.log('[Bunny] deleteVideo: not a Bunny URL, skipping:', fileUrl);
      return;
    }

    if (!BUNNY_ENABLED || !BUNNY_STORAGE_ZONE || !BUNNY_API_KEY) {
      console.warn('[Bunny] deleteVideo: Bunny not configured, skipping deletion for:', fileUrl);
      return;
    }

    try {
      // remotePath = everything after "https://<CDN_HOSTNAME>/"
      const remotePath = fileUrl.slice(cdnPrefix.length);
      const deleteUrl  = `${BUNNY_STORAGE_HOST}/${BUNNY_STORAGE_ZONE}/${remotePath}`;

      const resp = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: { AccessKey: BUNNY_API_KEY },
      });

      if (resp.ok) {
        console.log('[Bunny] Deleted:', remotePath);
      } else {
        console.error('[Bunny] Delete failed:', resp.status, resp.statusText);
      }
    } catch (err: any) {
      console.error('[Bunny] deleteVideo error:', err.message);
    }
  },
};
