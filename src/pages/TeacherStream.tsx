// src/pages/TeacherStream.tsx
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Radio, Plus, Play, Square, Eye, EyeOff, Copy, Check,
  Calendar, Loader, AlertCircle, Trash2, X, BookOpen,
  ChevronDown, ChevronUp, Users, Video,
} from 'lucide-react';
import { format } from 'date-fns';
import { useDashboard } from '../contexts/DashboardContext';
import {
  streamService, scheduleStream, streamingSettingsService,
  deleteCloudflareLiveInput,
} from '../services/streamService';
import { LiveStream, StreamScheduleForm, StreamProvider } from '../types/streamTypes';
import CloudflareWebRTCStream from '../components/stream/CloudflareWebRTCStream';

// ─── Status Badge ─────────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: LiveStream['status'] }> = ({ status }) => {
  const map = {
    scheduled: { cls: 'bg-blue-500/20 text-blue-300 border-blue-500/30', label: 'Scheduled', pulse: false },
    live: { cls: 'bg-red-500/20 text-red-300 border-red-500/30', label: '● LIVE', pulse: true },
    ended: { cls: 'bg-gray-500/20 text-gray-400 border-gray-500/30', label: 'Ended', pulse: false },
  }[status];
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${map.cls} ${map.pulse ? 'animate-pulse' : ''}`}>
      {map.label}
    </span>
  );
};

// ─── Provider Badge ────────────────────────────────────────────────────────────

const ProviderBadge: React.FC<{ provider: StreamProvider }> = ({ provider }) => {
  const map: Record<StreamProvider, { cls: string; label: string }> = {
    youtube: { cls: 'bg-red-500/15 text-red-400 border-red-500/25', label: 'YouTube' },
    bunny: { cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25', label: 'Bunny' },
    cloudflare: { cls: 'bg-orange-500/15 text-orange-400 border-orange-500/25', label: 'Cloudflare' },
  };
  const { cls, label } = map[provider] ?? { cls: 'bg-gray-700 text-gray-400 border-gray-600', label: provider };
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${cls}`}>{label}</span>;
};

// ─── Copy Button ──────────────────────────────────────────────────────────────

const CopyBtn: React.FC<{ value: string }> = ({ value }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
        copied
          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
          : 'bg-gray-700 hover:bg-gray-600 text-gray-300 border border-gray-600'
      }`}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
};

// ─── Create Stream Modal ──────────────────────────────────────────────────────

interface CreateModalProps {
  onClose: () => void;
  onCreated: () => void;
  teacherId: string;
  teacherName: string;
}

const CreateStreamModal: React.FC<CreateModalProps> = ({ onClose, onCreated, teacherId, teacherName }) => {
  const [form, setForm] = useState<StreamScheduleForm>({
    title: '', description: '', provider: 'youtube', mode: 'obs',
    scheduledAt: '', youtubeVideoId: '', youtubeStreamKey: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const providers: { id: StreamProvider; label: string; desc: string; color: string }[] = [
    { id: 'youtube', label: 'YouTube Live', desc: 'Free. Teacher provides stream key.', color: '#ef4444' },
    { id: 'bunny', label: 'Bunny Stream', desc: '~$0.01/GB. Auto RTMP generation.', color: '#f59e0b' },
    { id: 'cloudflare', label: 'Cloudflare', desc: '$5/mo flat. RTMP + browser streaming.', color: '#f97316' },
  ];

  const handleSubmit = async () => {
    if (!form.title.trim()) return setError('Stream title is required.');
    if (!form.scheduledAt) return setError('Please set a scheduled date and time.');
    if (new Date(form.scheduledAt) < new Date()) return setError('Scheduled time must be in the future.');
    if (form.provider === 'youtube') {
      if (!form.youtubeVideoId?.trim()) return setError('YouTube Video ID is required.');
      if (!form.youtubeStreamKey?.trim()) return setError('YouTube Stream Key is required.');
    }
    setError('');
    setLoading(true);
    try {
      await scheduleStream(form, teacherId, teacherName);
      (window as any).addNotification?.('Stream created successfully!', 'success');
      onCreated();
      onClose();
    } catch (e: any) {
      setError(e.message ?? 'Failed to create stream. Make sure provider settings are configured in Stream Settings.');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-start justify-center pt-20 sm:pt-24 p-4 bg-black/75 backdrop-blur-xl overflow-y-auto">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl my-4">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-500/15 border border-primary-500/25 flex items-center justify-center shrink-0">
              <Radio size={18} className="text-primary-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">Create Live Stream</h3>
              <p className="text-xs text-gray-400 mt-0.5">Configure and launch your stream</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-700 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5 max-h-[72vh] overflow-y-auto">
          {error && (
            <div className="flex items-start gap-2 bg-red-900/30 border border-red-700/60 text-red-400 rounded-xl px-4 py-3 text-sm">
              <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm text-gray-300 mb-1.5 font-medium">Stream Title <span className="text-red-400">*</span></label>
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Chapter 5 — Live Lecture"
              className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-primary-500 text-sm"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">Description (optional)</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              placeholder="What will be covered in this stream?"
              className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-primary-500 text-sm resize-none"
            />
          </div>

          {/* Scheduled At */}
          <div>
            <label className="block text-sm text-gray-300 mb-1.5 font-medium">Scheduled Date & Time <span className="text-red-400">*</span></label>
            <input
              type="datetime-local"
              value={form.scheduledAt}
              onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))}
              min={new Date().toISOString().slice(0, 16)}
              className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-primary-500 text-sm"
            />
          </div>

          {/* Provider */}
          <div>
            <label className="block text-sm text-gray-300 mb-2 font-medium">Streaming Provider <span className="text-red-400">*</span></label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {providers.map(p => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => setForm(f => ({ ...f, provider: p.id, mode: p.id === 'cloudflare' ? f.mode : 'obs' }))}
                  className={`text-left p-3.5 rounded-xl border transition-all ${
                    form.provider === p.id
                      ? 'border-primary-500/70 bg-primary-500/10'
                      : 'border-gray-600 hover:border-gray-500 bg-gray-800/40'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
                    <p className={`text-sm font-semibold ${form.provider === p.id ? 'text-primary-300' : 'text-white'}`}>{p.label}</p>
                  </div>
                  <p className="text-xs text-gray-400 leading-snug">{p.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Cloudflare mode selector */}
          {form.provider === 'cloudflare' && (
            <div>
              <label className="block text-sm text-gray-300 mb-2 font-medium">Streaming Mode</label>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { id: 'obs', label: 'OBS / External', desc: 'Stream via OBS or any RTMP encoder' },
                  { id: 'browser', label: 'Browser', desc: 'Stream live from this browser tab' },
                ].map(m => (
                  <button
                    type="button"
                    key={m.id}
                    onClick={() => setForm(f => ({ ...f, mode: m.id as 'obs' | 'browser' }))}
                    className={`text-left p-3.5 rounded-xl border transition-all ${
                      form.mode === m.id ? 'border-primary-500/70 bg-primary-500/10' : 'border-gray-600 hover:border-gray-500 bg-gray-800/40'
                    }`}
                  >
                    <p className={`text-sm font-semibold ${form.mode === m.id ? 'text-primary-300' : 'text-white'}`}>{m.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5 leading-snug">{m.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* YouTube specific */}
          {form.provider === 'youtube' && (
            <div className="space-y-3 bg-red-900/10 border border-red-500/20 rounded-xl p-4">
              <p className="text-xs text-red-400/80 font-medium leading-relaxed">
                First create a live stream in <strong>YouTube Studio → Go Live</strong>, then paste the details below.
              </p>
              <div>
                <label className="block text-sm text-gray-300 mb-1.5 font-medium">YouTube Video ID *</label>
                <input
                  value={form.youtubeVideoId ?? ''}
                  onChange={e => setForm(f => ({ ...f, youtubeVideoId: e.target.value }))}
                  placeholder="e.g. dQw4w9WgXcQ (from your YouTube URL)"
                  className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-primary-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1.5 font-medium">YouTube Stream Key *</label>
                <input
                  type="password"
                  value={form.youtubeStreamKey ?? ''}
                  onChange={e => setForm(f => ({ ...f, youtubeStreamKey: e.target.value }))}
                  placeholder="From YouTube Studio → Stream Key"
                  className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-primary-500 text-sm"
                />
              </div>
            </div>
          )}

          {/* Bunny/Cloudflare auto-gen info */}
          {(form.provider === 'bunny' || form.provider === 'cloudflare') && (
            <div className="bg-blue-900/10 border border-blue-500/20 rounded-xl p-4">
              <p className="text-xs text-blue-400 leading-relaxed">
                ✓ RTMP URL and Stream Key will be <strong>auto-generated</strong> when you click Create.
                Copy them into OBS → Settings → Stream after creation.
                {form.provider === 'cloudflare' && form.mode === 'browser' && (
                  <> Browser streaming will also be available from your dashboard — no OBS needed.</>
                )}
              </p>
            </div>
          )}

          {/* Course (optional) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Course ID <span className="text-gray-600">(optional)</span></label>
              <input
                value={form.courseId ?? ''}
                onChange={e => setForm(f => ({ ...f, courseId: e.target.value }))}
                placeholder="Course ID"
                className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-primary-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Course Name <span className="text-gray-600">(optional)</span></label>
              <input
                value={form.courseName ?? ''}
                onChange={e => setForm(f => ({ ...f, courseName: e.target.value }))}
                placeholder="Course Name"
                className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-primary-500 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-5 border-t border-gray-700">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? <Loader size={16} className="animate-spin" /> : <Check size={16} />}
            {loading ? 'Creating…' : 'Create Stream'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ─── Stream Card ──────────────────────────────────────────────────────────────

interface StreamCardProps {
  stream: LiveStream;
  onGoLive: () => void;
  onEndStream: () => void;
  onDelete: () => void;
  isProcessing: boolean;
}

const StreamCard: React.FC<StreamCardProps> = ({ stream, onGoLive, onEndStream, onDelete, isProcessing }) => {
  const [keyVisible, setKeyVisible] = useState(false);
  const [showOBS, setShowOBS] = useState(stream.status !== 'ended');
  const [showBrowserStream, setShowBrowserStream] = useState(false);

  const hasRTMP = (stream.rtmpUrl && stream.streamKey);
  const showBrowserBtn = (
    stream.provider === 'cloudflare' &&
    stream.mode === 'browser' &&
    stream.status === 'live' &&
    stream.whipEndpoint
  );

  return (
    <div className={`bg-gray-800/60 border rounded-2xl overflow-hidden transition-all ${
      stream.status === 'live' ? 'border-red-500/50 ring-1 ring-red-500/20' : 'border-gray-700 hover:border-gray-600'
    }`}>
      <div className={`h-1 ${stream.status === 'live' ? 'bg-red-500' : stream.status === 'scheduled' ? 'bg-primary-500' : 'bg-gray-600'}`} />

      <div className="p-5 space-y-4">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <StatusBadge status={stream.status} />
            <ProviderBadge provider={stream.provider} />
            {stream.mode === 'browser' && stream.provider === 'cloudflare' && (
              <span className="text-xs bg-purple-500/15 text-purple-400 border border-purple-500/25 px-2 py-0.5 rounded-full">Browser</span>
            )}
          </div>
          <h4 className="font-semibold text-white text-base leading-tight mt-1">{stream.title}</h4>
          {stream.description && <p className="text-sm text-gray-400 mt-1 line-clamp-2">{stream.description}</p>}
        </div>

        {/* Meta */}
        <div className="flex flex-wrap gap-3 text-sm text-gray-400">
          {stream.scheduledAt && (
            <span className="flex items-center gap-1.5">
              <Calendar size={13} className="text-gray-500" />
              {format(stream.scheduledAt.toDate(), 'MMM d, yyyy h:mm a')}
            </span>
          )}
          {stream.courseName && (
            <span className="flex items-center gap-1.5">
              <BookOpen size={13} className="text-gray-500" />
              {stream.courseName}
            </span>
          )}
          {stream.status === 'live' && (
            <span className="flex items-center gap-1.5 text-red-400">
              <Users size={13} /> {stream.viewerCount} watching
            </span>
          )}
        </div>

        {/* OBS Setup */}
        {hasRTMP && stream.status !== 'ended' && (
          <div>
            <button
              onClick={() => setShowOBS(v => !v)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors mb-2"
            >
              {showOBS ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              {showOBS ? 'Hide' : 'Show'} OBS Setup
            </button>
            {showOBS && (
              <div className="space-y-2.5 bg-gray-900/60 rounded-xl p-3.5 border border-gray-700/80">
                <p className="text-xs text-gray-500 font-medium">OBS → Settings → Stream → Custom RTMP</p>

                {/* RTMP URL */}
                <div>
                  <p className="text-xs text-gray-500 mb-1">RTMP Server (Server URL)</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs text-green-400 bg-gray-800 px-3 py-1.5 rounded-lg truncate block font-mono">
                      {stream.provider === 'youtube' ? 'rtmp://a.rtmp.youtube.com/live2' : stream.rtmpUrl}
                    </code>
                    <CopyBtn value={stream.provider === 'youtube' ? 'rtmp://a.rtmp.youtube.com/live2' : (stream.rtmpUrl ?? '')} />
                  </div>
                </div>

                {/* Stream Key */}
                <div>
                  <p className="text-xs text-gray-500 mb-1">Stream Key</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs text-yellow-400 bg-gray-800 px-3 py-1.5 rounded-lg truncate block font-mono">
                      {keyVisible ? stream.streamKey : '••••••••••••••••••••'}
                    </code>
                    <button
                      onClick={() => setKeyVisible(v => !v)}
                      className="p-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-400 hover:text-white transition-colors shrink-0"
                    >
                      {keyVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                    {keyVisible && <CopyBtn value={stream.streamKey ?? ''} />}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Recording info */}
        {stream.status === 'ended' && stream.recordingUrl && (
          <div className="bg-green-900/10 border border-green-500/20 rounded-xl p-3">
            <p className="text-xs text-green-400 font-medium mb-1">Recording Available</p>
            <p className="text-xs text-gray-400 break-all">{stream.recordingUrl}</p>
          </div>
        )}

        {/* Browser streaming */}
        {showBrowserBtn && (
          <div>
            <button
              onClick={() => setShowBrowserStream(v => !v)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                showBrowserStream ? 'bg-purple-600 text-white' : 'bg-purple-500/15 text-purple-400 border border-purple-500/25 hover:bg-purple-500/25'
              }`}
            >
              <Video size={14} /> {showBrowserStream ? 'Hide Browser Stream' : 'Stream from Browser'}
            </button>
            {showBrowserStream && (
              <div className="mt-3 bg-gray-900/60 border border-gray-700 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-3">Your browser camera and mic will be broadcast live to all viewers.</p>
                <CloudflareWebRTCStream
                  whipEndpoint={stream.whipEndpoint!}
                  onStreamStart={() => (window as any).addNotification?.('Browser stream started!', 'success')}
                  onStreamStop={() => (window as any).addNotification?.('Browser stream stopped.', 'info')}
                />
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {stream.status === 'scheduled' && (
            <button
              onClick={onGoLive}
              disabled={isProcessing}
              className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-red-900/30"
            >
              {isProcessing ? <Loader size={14} className="animate-spin" /> : <Play size={14} />}
              {isProcessing ? 'Going Live…' : 'Go Live'}
            </button>
          )}

          {stream.status === 'live' && (
            <button
              onClick={onEndStream}
              disabled={isProcessing}
              className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-60 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            >
              {isProcessing ? <Loader size={14} className="animate-spin" /> : <Square size={14} />}
              {isProcessing ? 'Ending…' : 'End Stream'}
            </button>
          )}

          {stream.status !== 'live' && (
            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 text-red-400 hover:text-red-300 px-3 py-2 rounded-xl text-sm transition-colors hover:bg-red-900/20 ml-auto"
            >
              <Trash2 size={13} /> Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const TeacherStream: React.FC = () => {
  const { user } = useDashboard();
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const unsubRef = useRef<() => void>();

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    unsubRef.current = streamService.onSnapshotByTeacher(user.uid, list => {
      setStreams(list);
      setLoading(false);
    });
    return () => unsubRef.current?.();
  }, [user]);

  const handleGoLive = async (stream: LiveStream) => {
    setProcessingId(stream.id);
    try {
      await streamService.setLive(stream.id);
      (window as any).addNotification?.(`"${stream.title}" is now live!`, 'success');
    } catch (e: any) {
      (window as any).addNotification?.(e.message ?? 'Failed to go live.', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleEndStream = async (stream: LiveStream) => {
    if (!window.confirm('End this stream? All viewers will be disconnected.')) return;
    setProcessingId(stream.id);
    try {
      await streamService.setEnded(stream.id);
      // Cleanup Cloudflare live input
      if (stream.provider === 'cloudflare' && stream.cloudflareInputId) {
        const settings = await streamingSettingsService.get().catch(() => null);
        if (settings?.cloudflare?.accountId) {
          await deleteCloudflareLiveInput(
            settings.cloudflare.accountId,
            settings.cloudflare.apiToken,
            stream.cloudflareInputId
          ).catch(() => {});
        }
      }
      (window as any).addNotification?.('Stream ended successfully.', 'success');
    } catch (e: any) {
      (window as any).addNotification?.(e.message ?? 'Failed to end stream.', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (stream: LiveStream) => {
    if (!window.confirm('Delete this stream? This cannot be undone.')) return;
    try {
      if (stream.provider === 'cloudflare' && stream.cloudflareInputId) {
        const settings = await streamingSettingsService.get().catch(() => null);
        if (settings?.cloudflare?.accountId) {
          await deleteCloudflareLiveInput(
            settings.cloudflare.accountId,
            settings.cloudflare.apiToken,
            stream.cloudflareInputId
          ).catch(() => {});
        }
      }
      await streamService.delete(stream.id);
    } catch {}
  };

  const liveStreams = streams.filter(s => s.status === 'live');
  const scheduledStreams = streams.filter(s => s.status === 'scheduled');
  const endedStreams = streams.filter(s => s.status === 'ended');

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Radio size={26} className="text-primary-400" /> Live Streams
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            Broadcast to unlimited viewers on YouTube, Bunny, or Cloudflare.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-lg"
        >
          <Plus size={18} /> Create Stream
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Live Now', value: liveStreams.length, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
          { label: 'Upcoming', value: scheduledStreams.length, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
          { label: 'Completed', value: endedStreams.length, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`border rounded-2xl p-4 text-center ${bg}`}>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3">
          <Loader size={32} className="animate-spin text-primary-500" />
          <p className="text-gray-400 text-sm">Loading your streams…</p>
        </div>
      ) : streams.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4 bg-gray-800/40 border border-gray-700 rounded-2xl">
          <Radio size={48} className="text-gray-600" />
          <div className="text-center">
            <h3 className="text-white font-semibold">No streams yet</h3>
            <p className="text-gray-400 text-sm mt-1">Create your first live stream to broadcast to students.</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
          >
            <Plus size={16} /> Create First Stream
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {liveStreams.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" /> Live Now
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {liveStreams.map(s => (
                  <StreamCard key={s.id} stream={s}
                    onGoLive={() => handleGoLive(s)} onEndStream={() => handleEndStream(s)}
                    onDelete={() => handleDelete(s)} isProcessing={processingId === s.id}
                  />
                ))}
              </div>
            </section>
          )}

          {scheduledStreams.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-blue-400 uppercase tracking-wider mb-3">Upcoming</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {scheduledStreams.map(s => (
                  <StreamCard key={s.id} stream={s}
                    onGoLive={() => handleGoLive(s)} onEndStream={() => handleEndStream(s)}
                    onDelete={() => handleDelete(s)} isProcessing={processingId === s.id}
                  />
                ))}
              </div>
            </section>
          )}

          {endedStreams.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Past Streams</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {endedStreams.map(s => (
                  <StreamCard key={s.id} stream={s}
                    onGoLive={() => handleGoLive(s)} onEndStream={() => handleEndStream(s)}
                    onDelete={() => handleDelete(s)} isProcessing={processingId === s.id}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Modals */}
      {showCreateModal && user && (
        <CreateStreamModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {}}
          teacherId={user.uid}
          teacherName={`${user.name}${user.surname ? ' ' + user.surname : ''}`}
        />
      )}
    </div>
  );
};

export default TeacherStream;
