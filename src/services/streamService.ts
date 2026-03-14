// src/services/streamService.ts
import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, orderBy, limit,
  Timestamp, increment, setDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  LiveStream, StreamChatMessage, StreamingSettings,
  StreamProvider, StreamScheduleForm,
} from '../types/streamTypes';

// ─── Settings ─────────────────────────────────────────────────────────────────

export const streamingSettingsService = {
  async get(): Promise<StreamingSettings | null> {
    const snap = await getDoc(doc(db, 'app_settings', 'streaming'));
    return snap.exists() ? (snap.data() as StreamingSettings) : null;
  },

  async save(settings: Partial<StreamingSettings>, updatedBy: string): Promise<void> {
    await setDoc(
      doc(db, 'app_settings', 'streaming'),
      { ...settings, updatedAt: Timestamp.now(), updatedBy },
      { merge: true }
    );
  },

  onSnapshot(cb: (s: StreamingSettings | null) => void): () => void {
    return onSnapshot(doc(db, 'app_settings', 'streaming'), snap =>
      cb(snap.exists() ? (snap.data() as StreamingSettings) : null)
    );
  },
};

// ─── Provider API: Cloudflare ─────────────────────────────────────────────────

export async function createCloudflareLiveInput(
  accountId: string,
  apiToken: string,
  name: string
): Promise<{ inputId: string; rtmpUrl: string; streamKey: string; whipEndpoint: string; customerSubdomain: string }> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/live_inputs`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        meta: { name },
        recording: { mode: 'automatic', timeoutSeconds: 300 },
      }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.errors?.[0]?.message ?? 'Cloudflare live input creation failed');
  }
  const { result } = await res.json();
  return {
    inputId: result.uid,
    rtmpUrl: result.rtmps.url,
    streamKey: result.rtmps.streamKey,
    whipEndpoint: result.webRTC?.url ?? '',
    customerSubdomain: '', // supplied from settings
  };
}

export async function deleteCloudflareLiveInput(
  accountId: string,
  apiToken: string,
  inputId: string
): Promise<void> {
  await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/live_inputs/${inputId}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${apiToken}` } }
  );
}

// ─── Provider API: Bunny Stream ───────────────────────────────────────────────

export async function createBunnyLiveStream(
  apiKey: string,
  title: string
): Promise<{ streamId: string; rtmpUrl: string; streamKey: string; playbackUrl: string }> {
  // Bunny Stream Live API
  const res = await fetch('https://video.bunnycdn.com/stream', {
    method: 'POST',
    headers: {
      AccessKey: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: title }),
  });
  if (!res.ok) throw new Error('Bunny live stream creation failed');
  const data = await res.json();
  return {
    streamId: data.guid,
    rtmpUrl: `rtmp://live.bunnycdn.com/live`,
    streamKey: data.streamKey ?? data.guid,
    playbackUrl: `https://stream.bunnycdn.com/${data.guid}/playlist.m3u8`,
  };
}

// ─── Stream CRUD ──────────────────────────────────────────────────────────────

export const streamService = {
  async getAll(): Promise<LiveStream[]> {
    const q = query(collection(db, 'live_streams'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as LiveStream));
  },

  async getByTeacher(teacherId: string): Promise<LiveStream[]> {
    const q = query(
      collection(db, 'live_streams'),
      where('teacherId', '==', teacherId),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as LiveStream));
  },

  async getById(id: string): Promise<LiveStream | null> {
    const snap = await getDoc(doc(db, 'live_streams', id));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as LiveStream) : null;
  },

  async create(data: Omit<LiveStream, 'id' | 'createdAt' | 'viewerCount'>): Promise<string> {
    const ref = await addDoc(collection(db, 'live_streams'), {
      ...data,
      viewerCount: 0,
      createdAt: Timestamp.now(),
    });
    return ref.id;
  },

  async setLive(streamId: string): Promise<void> {
    await updateDoc(doc(db, 'live_streams', streamId), {
      status: 'live',
      startedAt: Timestamp.now(),
    });
  },

  async setEnded(streamId: string): Promise<void> {
    await updateDoc(doc(db, 'live_streams', streamId), {
      status: 'ended',
      endedAt: Timestamp.now(),
    });
  },

  async setRecording(streamId: string, recordingUrl: string): Promise<void> {
    await updateDoc(doc(db, 'live_streams', streamId), { recordingUrl });
  },

  async delete(streamId: string): Promise<void> {
    await deleteDoc(doc(db, 'live_streams', streamId));
  },

  onSnapshot(cb: (streams: LiveStream[]) => void): () => void {
    const q = query(collection(db, 'live_streams'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap =>
      cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as LiveStream)))
    );
  },

  onSnapshotByTeacher(teacherId: string, cb: (streams: LiveStream[]) => void): () => void {
    const q = query(
      collection(db, 'live_streams'),
      where('teacherId', '==', teacherId),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, snap =>
      cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as LiveStream)))
    );
  },

  onSingleSnapshot(streamId: string, cb: (stream: LiveStream | null) => void): () => void {
    return onSnapshot(doc(db, 'live_streams', streamId), snap =>
      cb(snap.exists() ? ({ id: snap.id, ...snap.data() } as LiveStream) : null)
    );
  },
};

// ─── Viewer Tracking ──────────────────────────────────────────────────────────

export const viewerService = {
  async join(streamId: string, userId: string): Promise<void> {
    await setDoc(doc(db, 'live_stream_viewers', `${streamId}__${userId}`), {
      streamId, userId, joinedAt: Timestamp.now(), lastSeen: Timestamp.now(),
    });
    await updateDoc(doc(db, 'live_streams', streamId), {
      viewerCount: increment(1),
    }).catch(() => {});
  },

  async heartbeat(streamId: string, userId: string): Promise<void> {
    await setDoc(
      doc(db, 'live_stream_viewers', `${streamId}__${userId}`),
      { lastSeen: Timestamp.now() },
      { merge: true }
    ).catch(() => {});
  },

  async leave(streamId: string, userId: string): Promise<void> {
    await deleteDoc(doc(db, 'live_stream_viewers', `${streamId}__${userId}`)).catch(() => {});
    await updateDoc(doc(db, 'live_streams', streamId), {
      viewerCount: increment(-1),
    }).catch(() => {});
  },
};

// ─── Chat ─────────────────────────────────────────────────────────────────────

export const streamChatService = {
  async send(
    streamId: string,
    userId: string,
    userName: string,
    userRole: string,
    message: string
  ): Promise<void> {
    await addDoc(collection(db, 'live_streams', streamId, 'chat'), {
      streamId, userId, userName, userRole,
      message: message.trim(),
      createdAt: Timestamp.now(),
      deleted: false,
    });
  },

  async delete(streamId: string, msgId: string): Promise<void> {
    await updateDoc(doc(db, 'live_streams', streamId, 'chat', msgId), {
      deleted: true,
    });
  },

  onSnapshot(
    streamId: string,
    cb: (messages: StreamChatMessage[]) => void
  ): () => void {
    const q = query(
      collection(db, 'live_streams', streamId, 'chat'),
      orderBy('createdAt', 'asc'),
      limit(200)
    );
    return onSnapshot(q, snap =>
      cb(snap.docs
        .map(d => ({ id: d.id, ...d.data() } as StreamChatMessage))
        .filter(m => !m.deleted)
      )
    );
  },
};

// ─── High-level: Schedule a new stream ───────────────────────────────────────

export async function scheduleStream(
  form: StreamScheduleForm,
  teacherId: string,
  teacherName: string
): Promise<string> {
  const settings = await streamingSettingsService.get();
  const provider = form.provider;

  let rtmpUrl: string | undefined;
  let streamKey: string | undefined;
  let playbackUrl = '';
  let embedUrl: string | undefined;
  let bunnyStreamId: string | undefined;
  let cloudflareInputId: string | undefined;
  let whipEndpoint: string | undefined;
  let youtubeVideoId: string | undefined;

  if (provider === 'cloudflare' && settings?.cloudflare?.accountId) {
    const cf = await createCloudflareLiveInput(
      settings.cloudflare.accountId,
      settings.cloudflare.apiToken,
      form.title
    );
    cloudflareInputId = cf.inputId;
    rtmpUrl           = cf.rtmpUrl;
    streamKey         = cf.streamKey;
    whipEndpoint      = cf.whipEndpoint;
    playbackUrl       = `https://customer-${settings.cloudflare.customerSubdomain}.cloudflarestream.com/${cf.streamKey}/manifest/video.m3u8`;
    embedUrl          = `https://customer-${settings.cloudflare.customerSubdomain}.cloudflarestream.com/${cf.streamKey}/iframe`;
  } else if (provider === 'bunny' && settings?.bunny?.apiKey) {
    const bn  = await createBunnyLiveStream(settings.bunny.apiKey, form.title);
    bunnyStreamId = bn.streamId;
    rtmpUrl       = bn.rtmpUrl;
    streamKey     = bn.streamKey;
    playbackUrl   = bn.playbackUrl;
    embedUrl      = `https://iframe.mediadelivery.net/embed/live/${bn.streamId}`;
  } else if (provider === 'youtube') {
    youtubeVideoId = form.youtubeVideoId;
    rtmpUrl        = 'rtmp://a.rtmp.youtube.com/live2';
    streamKey      = form.youtubeStreamKey;
    playbackUrl    = youtubeVideoId ?? '';
    embedUrl       = youtubeVideoId
      ? `https://www.youtube.com/embed/${youtubeVideoId}?autoplay=1`
      : '';
  }

  const streamId = await streamService.create({
    title: form.title,
    description: form.description,
    teacherId,
    teacherName,
    courseId:  form.courseId  ?? null as any,
    courseName: form.courseName ?? null as any,
    provider,
    status: 'scheduled',
    mode: form.mode,
    rtmpUrl,
    streamKey,
    playbackUrl,
    embedUrl,
    bunnyStreamId,
    cloudflareInputId,
    whipEndpoint,
    youtubeVideoId,
    chatEnabled: true,
    recordingUrl: null as any,
    scheduledAt: form.scheduledAt ? Timestamp.fromDate(new Date(form.scheduledAt)) : undefined,
    startedAt: null as any,
    endedAt:   null as any,
  });

  return streamId;
}
