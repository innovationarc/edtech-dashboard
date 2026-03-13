// src/services/liveClassProviderService.ts
import { LiveClassSettings, HMSKey, JitsiKey } from '../types/liveClassTypes';
import { liveClassSettingsService } from './liveClassService';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Generate a unique room identifier */
export const generateRoomId = (courseId?: string): string => {
  const prefix = courseId ? courseId.slice(0, 12) : 'general';
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 7);
  return `${prefix}-${ts}-${rand}`;
};

/** Base64url encode (used for JWT) */
function b64url(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlFromBuffer(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Build a signed JWT (HS256) for 100ms */
async function signJwt(
  payload: Record<string, unknown>,
  secret: string
): Promise<string> {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const signingInput = `${header}.${body}`;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(signingInput));
  return `${signingInput}.${b64urlFromBuffer(sig)}`;
}

// ─── 100ms Management Token ───────────────────────────────────────────────────

/** Generate a 100ms management token (used for HMS REST API calls) */
async function generateHMSManagementToken(
  appKey: string,
  appSecret: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return signJwt(
    {
      access_key: appKey,
      type: 'management',
      version: 2,
      iat: now,
      nbf: now,
      exp: now + 86400, // 24 hours
    },
    appSecret
  );
}

// ─── 100ms Auth Token (for joining) ──────────────────────────────────────────

/** Generate a 100ms auth token for a specific user joining a room */
export async function generateHMSAuthToken(
  appKey: string,
  appSecret: string,
  roomId: string,
  userId: string,
  role: 'host' | 'guest'
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return signJwt(
    {
      access_key: appKey,
      room_id: roomId,
      user_id: userId,
      role,
      type: 'app',
      version: 2,
      iat: now,
      nbf: now,
      exp: now + 86400,
    },
    appSecret
  );
}

// ─── 100ms Room Creation ──────────────────────────────────────────────────────

export async function createHMSRoom(
  key: HMSKey,
  roomName: string
): Promise<string> {
  const mgmtToken = await generateHMSManagementToken(key.appKey, key.appSecret);

  const res = await fetch('https://api.100ms.live/v2/rooms', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${mgmtToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: roomName,
      template_id: key.templateId,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || '100ms room creation failed');
  }
  const data = await res.json();
  return data.id as string;
}

// ─── Auto Rotation ────────────────────────────────────────────────────────────

/**
 * Returns the best active HMS key considering rotation mode.
 * In auto mode: picks first key with remaining minutes.
 * In manual mode: uses the currently selected key.
 * Returns null if all keys are exhausted (fallback to Jitsi).
 */
export function selectHMSKey(settings: LiveClassSettings): HMSKey | null {
  if (!settings.hmsKeys?.length) return null;

  if (settings.hmsRotationMode === 'auto') {
    const candidates = settings.hmsKeys.filter(
      (k) => k.isActive && k.minutesUsed < k.minutesLimit
    );
    if (!candidates.length) return null;
    // Pick the one with most remaining minutes
    return candidates.sort(
      (a, b) => b.minutesLimit - b.minutesUsed - (a.minutesLimit - a.minutesUsed)
    )[0];
  }

  // Manual: use the selected key
  const active = settings.hmsKeys.find(
    (k) => k.id === settings.activeHmsKeyId && k.isActive
  );
  return active ?? null;
}

/**
 * Returns the active Jitsi server config.
 */
export function selectJitsiKey(settings: LiveClassSettings): JitsiKey | null {
  if (!settings.jitsiKeys?.length) return null;
  return (
    settings.jitsiKeys.find(
      (k) => k.id === settings.activeJitsiKeyId && k.isActive
    ) ?? null
  );
}

// ─── Update active HMS key in Firestore after auto-rotation ──────────────────

export async function persistHMSKeyRotation(
  newKeyId: string,
  updatedBy: string
): Promise<void> {
  await updateDoc(doc(db, 'app_settings', 'live_class'), {
    activeHmsKeyId: newKeyId,
  });
}

// ─── High-level: Prepare a class room ────────────────────────────────────────

export interface PreparedRoom {
  provider: 'jitsi' | '100ms';
  activeKeyId: string;
  jitsiDomain?: string;
  jitsiRoomId?: string;
  hmsRoomId?: string;
}

/**
 * Determines which provider to use, creates the necessary room,
 * and returns all info needed to start the class.
 */
export async function prepareClassRoom(
  classTitle: string,
  courseId: string | undefined,
  teacherUid: string
): Promise<PreparedRoom> {
  const settings = await liveClassSettingsService.get();

  if (!settings) {
    // No settings yet — default to Jitsi with public server
    const roomId = generateRoomId(courseId);
    return {
      provider: 'jitsi',
      activeKeyId: 'default',
      jitsiDomain: 'meet.jit.si',
      jitsiRoomId: roomId,
    };
  }

  const roomName = generateRoomId(courseId);

  if (settings.provider === '100ms') {
    const hmsKey = selectHMSKey(settings);

    if (hmsKey) {
      // Auto-rotate: update Firestore if key changed
      if (settings.hmsRotationMode === 'auto' && hmsKey.id !== settings.activeHmsKeyId) {
        await persistHMSKeyRotation(hmsKey.id, teacherUid);
      }

      const hmsRoomId = await createHMSRoom(hmsKey, roomName).catch(() => null);
      if (hmsRoomId) {
        return {
          provider: '100ms',
          activeKeyId: hmsKey.id,
          hmsRoomId,
          jitsiRoomId: roomName,
        };
      }
      // If HMS creation failed, fall through to Jitsi
    }
    // All keys exhausted or creation failed — fall back to Jitsi
  }

  // Jitsi path
  const jitsiKey = selectJitsiKey(settings);
  const domain = jitsiKey?.domain ?? 'meet.jit.si';
  const prefix = jitsiKey?.roomPrefix ?? '';

  return {
    provider: 'jitsi',
    activeKeyId: jitsiKey?.id ?? 'default',
    jitsiDomain: domain,
    jitsiRoomId: `${prefix}${roomName}`,
  };
}
