// src/pages/TeacherLiveClass.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Video, Plus, Play, Square, Users, Clock, Calendar, Upload,
  ChevronRight, Loader, AlertCircle, CheckCircle, Trash2, Eye,
  X, BookOpen, Radio,
} from 'lucide-react';
import { format, isPast, isWithinInterval, subMinutes, addMinutes } from 'date-fns';
import { useDashboard } from '../contexts/DashboardContext';
import { liveClassService, attendanceService, liveClassSettingsService } from '../services/liveClassService';
import { prepareClassRoom } from '../services/liveClassProviderService';
import { generateHMSAuthToken } from '../services/liveClassProviderService';
import { LiveClass, ScheduleClassForm, JoinInfo } from '../types/liveClassTypes';
import { contentService, Content } from '../services/contentService';
import JitsiRoom from '../components/liveClass/JitsiRoom';
import HMSRoom from '../components/liveClass/HMSRoom';

// ─── Schedule Modal ───────────────────────────────────────────────────────────

interface ScheduleModalProps {
  onClose: () => void;
  onScheduled: () => void;
  teacherId: string;
  teacherName: string;
}

const ScheduleModal: React.FC<ScheduleModalProps> = ({
  onClose, onScheduled, teacherId, teacherName,
}) => {
  const [form, setForm] = useState<ScheduleClassForm>({
    title: '',
    description: '',
    courseId: '',
    courseName: '',
    scheduledAt: '',
    durationMins: 60,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!form.title.trim()) return setError('Class title is required.');
    if (!form.scheduledAt) return setError('Please select a date and time.');
    if (new Date(form.scheduledAt) < new Date()) return setError('Scheduled time must be in the future.');
    setError('');
    setLoading(true);
    try {
      const room = await prepareClassRoom(form.title, form.courseId, teacherId);
      await liveClassService.schedule(
        form, teacherId, teacherName,
        room.provider, room.activeKeyId,
        room.jitsiRoomId ?? '',
        room.hmsRoomId
      );
      (window as any).addNotification?.('Class scheduled successfully!', 'success');
      onScheduled();
      onClose();
    } catch (e: any) {
      setError(e.message ?? 'Failed to schedule class.');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-start justify-center pt-20 sm:pt-24 p-4 overflow-y-auto bg-black/75 backdrop-blur-xl">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Calendar size={20} className="text-primary-400" />
            Schedule Live Class
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-700 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 bg-red-900/30 border border-red-700 text-red-400 rounded-xl px-4 py-3 text-sm">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-300 mb-1.5 font-medium">Class Title *</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Introduction to Algebra"
              className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-primary-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1.5 font-medium">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              placeholder="What will be covered in this class?"
              className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-primary-500 text-sm resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1.5 font-medium">Date & Time *</label>
              <input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                min={new Date().toISOString().slice(0, 16)}
                className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-primary-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1.5 font-medium">Duration (minutes)</label>
              <select
                value={form.durationMins}
                onChange={(e) => setForm({ ...form, durationMins: parseInt(e.target.value) })}
                className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-primary-500 text-sm"
              >
                {[30, 45, 60, 90, 120, 180].map((d) => (
                  <option key={d} value={d}>{d} min</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">Course ID (optional)</label>
              <input
                value={form.courseId}
                onChange={(e) => setForm({ ...form, courseId: e.target.value })}
                placeholder="Course ID"
                className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-primary-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">Course Name (optional)</label>
              <input
                value={form.courseName}
                onChange={(e) => setForm({ ...form, courseName: e.target.value })}
                placeholder="Course Name"
                className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-primary-500 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 pb-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? <Loader size={16} className="animate-spin" /> : <Calendar size={16} />}
            {loading ? 'Scheduling…' : 'Schedule Class'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ─── Recording Modal (content picker) ────────────────────────────────────────

interface RecordingModalProps {
  classItem: LiveClass;
  onClose: () => void;
  onSaved: () => void;
}

const RecordingModal: React.FC<RecordingModalProps> = ({ classItem, onClose, onSaved }) => {
  const [contents, setContents] = useState<Content[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Content | null>(null);
  const [loadingContents, setLoadingContents] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    contentService.getAllContent().then((all) => {
      setContents(all.filter((c) => c.type === 'lesson' || c.type === 'trick'));
      setLoadingContents(false);
    }).catch(() => setLoadingContents(false));
  }, []);

  const filtered = contents.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    (c.subject && c.subject.toLowerCase().includes(search.toLowerCase()))
  );

  const handleSave = async () => {
    if (!selected?.videoUrl) return;
    setSaving(true);
    try {
      await liveClassService.setRecording(classItem.id, selected.videoUrl, '', selected.id);
      (window as any).addNotification?.('Recording linked successfully!', 'success');
      onSaved();
      onClose();
    } catch {
      (window as any).addNotification?.('Failed to save recording.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-start justify-center pt-20 sm:pt-24 p-4 overflow-y-auto bg-black/75 backdrop-blur-xl">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-700 shrink-0">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Upload size={18} className="text-primary-400" />
            {classItem.recordingUrl ? 'Update Recording' : 'Add Recording'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-700 shrink-0">
          <p className="text-xs text-gray-400 mb-3">Select a lesson or tricks &amp; hacks content to use as the class recording.</p>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or subject…"
            className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-primary-500 text-sm"
          />
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loadingContents ? (
            <div className="flex justify-center py-8">
              <Loader size={24} className="animate-spin text-primary-500" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-gray-500 py-8 text-sm">No matching lessons or tricks &amp; hacks found.</p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelected(c)}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                  selected?.id === c.id
                    ? 'bg-primary-600/20 border-primary-500 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{c.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{c.subject}{c.topic ? ` · ${c.topic}` : ''}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                    c.type === 'lesson'
                      ? 'bg-blue-500/20 text-blue-300'
                      : 'bg-purple-500/20 text-purple-300'
                  }`}>
                    {c.type === 'lesson' ? 'Lesson' : 'Tricks & Hacks'}
                  </span>
                </div>
                {!c.videoUrl && (
                  <p className="text-xs text-yellow-500 mt-1">⚠ No video URL on this content</p>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-gray-700 shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || !selected?.videoUrl}
            className="flex-1 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-sm font-medium flex items-center justify-center gap-2"
          >
            {saving ? <Loader size={16} className="animate-spin" /> : <Upload size={16} />}
            {saving ? 'Saving…' : 'Set as Recording'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ─── Status Badge ─────────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: LiveClass['status'] }> = ({ status }) => {
  const cfg = {
    scheduled: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    live: 'bg-red-500/20 text-red-300 border-red-500/30 animate-pulse',
    ended: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  }[status];

  const labels = { scheduled: 'Scheduled', live: '● LIVE', ended: 'Ended' };

  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg}`}>
      {labels[status]}
    </span>
  );
};

// ─── Class Card ───────────────────────────────────────────────────────────────

interface ClassCardProps {
  cls: LiveClass;
  onStart: () => void;
  onJoin: () => void;
  onEnd: () => void;
  onAddRecording: () => void;
  onDelete: () => void;
  onViewAttendees: () => void;
  isProcessing: boolean;
}

const ClassCard: React.FC<ClassCardProps> = ({
  cls, onStart, onJoin, onEnd, onAddRecording, onDelete, onViewAttendees, isProcessing,
}) => {
  const scheduledDate = cls.scheduledAt.toDate();
  const canStart = isWithinInterval(new Date(), {
    start: subMinutes(scheduledDate, 10),
    end: addMinutes(scheduledDate, cls.durationMins),
  });
  const isPastClass = isPast(addMinutes(scheduledDate, cls.durationMins + 30));

  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-2xl overflow-hidden hover:border-gray-600 transition-all group">
      {/* Top accent line */}
      <div className={`h-1 ${cls.status === 'live' ? 'bg-red-500' : cls.status === 'scheduled' ? 'bg-primary-500' : 'bg-gray-600'}`} />

      <div className="p-5 space-y-4">
        {/* Title row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <StatusBadge status={cls.status} />
              {cls.provider && (
                <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full capitalize">
                  {cls.provider === '100ms' ? '100ms' : 'Jitsi'}
                </span>
              )}
            </div>
            <h4 className="font-semibold text-white text-base leading-tight truncate">{cls.title}</h4>
            {cls.description && (
              <p className="text-sm text-gray-400 mt-1 line-clamp-2">{cls.description}</p>
            )}
          </div>
        </div>

        {/* Meta info */}
        <div className="flex flex-wrap gap-3 text-sm text-gray-400">
          <span className="flex items-center gap-1.5">
            <Calendar size={14} className="text-gray-500" />
            {format(scheduledDate, 'MMM d, yyyy')}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock size={14} className="text-gray-500" />
            {format(scheduledDate, 'h:mm a')}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock size={14} className="text-gray-500" />
            {cls.durationMins} min
          </span>
          {cls.courseName && (
            <span className="flex items-center gap-1.5">
              <BookOpen size={14} className="text-gray-500" />
              {cls.courseName}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {cls.status === 'scheduled' && canStart && (
            <button
              onClick={onStart}
              disabled={isProcessing}
              className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            >
              {isProcessing ? <Loader size={14} className="animate-spin" /> : <Play size={14} />}
              Start Class
            </button>
          )}

          {cls.status === 'live' && (
            <>
              <button
                onClick={onJoin}
                className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              >
                <Radio size={14} /> Rejoin
              </button>
              <button
                onClick={onEnd}
                disabled={isProcessing}
                className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-60 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              >
                {isProcessing ? <Loader size={14} className="animate-spin" /> : <Square size={14} />}
                End Class
              </button>
            </>
          )}

          {cls.status === 'ended' && (
            <button
              onClick={onAddRecording}
              className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-xl text-sm transition-colors"
            >
              <Upload size={14} />
              {cls.recordingUrl ? 'Update Recording' : 'Add Recording'}
            </button>
          )}

          <button
            onClick={onViewAttendees}
            className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white px-3 py-2 rounded-xl text-sm transition-colors"
          >
            <Users size={14} /> Attendees
          </button>

          {cls.status === 'scheduled' && !canStart && isPastClass && (
            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 text-red-400 hover:text-red-300 px-3 py-2 rounded-xl text-sm transition-colors ml-auto hover:bg-red-900/20"
            >
              <Trash2 size={14} /> Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Attendees Modal ──────────────────────────────────────────────────────────

const AttendeesModal: React.FC<{ classId: string; title: string; onClose: () => void }> = ({
  classId, title, onClose,
}) => {
  const [attendees, setAttendees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    attendanceService.getByClass(classId).then((list) => {
      setAttendees(list);
      setLoading(false);
    });
  }, [classId]);

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-start justify-center pt-20 sm:pt-24 p-4 overflow-y-auto bg-black/75 backdrop-blur-xl">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-700">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Users size={18} className="text-primary-400" /> Attendees — {title}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-5 max-h-96 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader size={24} className="animate-spin text-primary-500" />
            </div>
          ) : attendees.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No attendance records yet.</p>
          ) : (
            <div className="space-y-2">
              {attendees.map((a, i) => (
                <div key={i} className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-white text-sm font-medium">{a.userName}</p>
                    <p className="text-gray-400 text-xs">
                      Joined {format(a.joinedAt.toDate(), 'h:mm a')}
                      {a.leftAt && ` · Left ${format(a.leftAt.toDate(), 'h:mm a')}`}
                    </p>
                  </div>
                  {a.durationMins != null && (
                    <span className="text-xs text-primary-400">{a.durationMins} min</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="p-5 border-t border-gray-700 flex justify-between text-sm text-gray-400">
          <span>{attendees.length} attendee{attendees.length !== 1 ? 's' : ''}</span>
          <button onClick={onClose} className="text-primary-400 hover:text-primary-300">Close</button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ─── Live Room Modal ──────────────────────────────────────────────────────────

interface LiveRoomModalProps {
  joinInfo: JoinInfo;
  title: string;
  displayName: string;
  onLeave: () => void;
}

const LiveRoomModal: React.FC<LiveRoomModalProps> = ({
  joinInfo, title, displayName, onLeave,
}) => {
  const handleParticipantJoined = useCallback(async (id: string, name: string) => {
    await attendanceService.join(joinInfo.classId, id, name).catch(() => {});
  }, [joinInfo.classId]);

  const handleParticipantLeft = useCallback(async (id: string) => {
    await attendanceService.leave(joinInfo.classId, id).catch(() => {});
  }, [joinInfo.classId]);

  return (
    <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
          <span className="font-semibold text-white text-sm">{title}</span>
          <span className="text-xs text-gray-400 hidden sm:block">You are the host</span>
        </div>
        <button
          onClick={onLeave}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 transition-colors"
        >
          <X size={16} /> Exit Room
        </button>
      </div>

      {/* Video room */}
      <div className="flex-1 overflow-hidden">
        {joinInfo.provider === 'jitsi' ? (
          <JitsiRoom
            domain={joinInfo.jitsiDomain ?? 'meet.jit.si'}
            roomId={joinInfo.jitsiRoomId ?? ''}
            displayName={displayName}
            isHost={joinInfo.isHost}
            onParticipantJoined={handleParticipantJoined}
            onParticipantLeft={handleParticipantLeft}
            onConferenceLeft={onLeave}
            onReadyToClose={onLeave}
          />
        ) : joinInfo.hmsAuthToken ? (
          <HMSRoom
            authToken={joinInfo.hmsAuthToken}
            displayName={displayName}
            isHost={joinInfo.isHost}
            onLeave={onLeave}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <AlertCircle size={32} className="text-red-400 mb-3" />
            <p className="text-white font-medium">Failed to generate room token.</p>
            <button onClick={onLeave} className="mt-4 text-primary-400 hover:underline text-sm">Go back</button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const TeacherLiveClass: React.FC = () => {
  const { user } = useDashboard();
  const [classes, setClasses] = useState<LiveClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [recordingTarget, setRecordingTarget] = useState<LiveClass | null>(null);
  const [attendeesTarget, setAttendeesTarget] = useState<{ id: string; title: string } | null>(null);
  const [activeRoom, setActiveRoom] = useState<{ info: JoinInfo; title: string } | null>(null);
  const unsubRef = useRef<() => void>();

  // Real-time listener
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    unsubRef.current = liveClassService.onSnapshotByTeacher(user.uid, (list) => {
      setClasses(list);
      setLoading(false);
    });
    return () => unsubRef.current?.();
  }, [user]);

  const handleStart = async (cls: LiveClass) => {
    if (!user) return;
    setProcessingId(cls.id);
    try {
      // Load settings for HMS token if needed
      let hmsAuthToken: string | undefined;
      if (cls.provider === '100ms' && cls.hmsRoomId) {
        const settings = await liveClassSettingsService.get();
        const key = settings?.hmsKeys.find((k) => k.id === cls.activeKeyId);
        if (key) {
          hmsAuthToken = await generateHMSAuthToken(
            key.appKey, key.appSecret, cls.hmsRoomId, user.uid, 'host'
          );
        }
      }

      await liveClassService.start(cls.id);

      const info: JoinInfo = {
        classId: cls.id,
        provider: cls.provider,
        jitsiDomain: cls.provider === 'jitsi' ? (await liveClassSettingsService.get())?.jitsiKeys.find(k => k.id === cls.activeKeyId)?.domain ?? 'meet.jit.si' : undefined,
        jitsiRoomId: cls.jitsiRoomId,
        hmsRoomId: cls.hmsRoomId,
        hmsAuthToken,
        isHost: true,
      };
      setActiveRoom({ info, title: cls.title });
    } catch (e: any) {
      (window as any).addNotification?.(e.message ?? 'Failed to start class.', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleJoin = async (cls: LiveClass) => {
    if (!user) return;
    let hmsAuthToken: string | undefined;
    if (cls.provider === '100ms' && cls.hmsRoomId) {
      const settings = await liveClassSettingsService.get();
      const key = settings?.hmsKeys.find((k) => k.id === cls.activeKeyId);
      if (key) {
        hmsAuthToken = await generateHMSAuthToken(
          key.appKey, key.appSecret, cls.hmsRoomId, user.uid, 'host'
        ).catch(() => undefined);
      }
    }

    const info: JoinInfo = {
      classId: cls.id,
      provider: cls.provider,
      jitsiDomain: cls.provider === 'jitsi' ? (await liveClassSettingsService.get())?.jitsiKeys.find(k => k.id === cls.activeKeyId)?.domain ?? 'meet.jit.si' : undefined,
      jitsiRoomId: cls.jitsiRoomId,
      hmsRoomId: cls.hmsRoomId,
      hmsAuthToken,
      isHost: true,
    };
    setActiveRoom({ info, title: cls.title });
  };

  const handleEnd = async (cls: LiveClass) => {
    if (!confirm('End this live class? Students will be disconnected.')) return;
    setProcessingId(cls.id);
    try {
      await liveClassService.end(cls.id);
      setActiveRoom(null);
      (window as any).addNotification?.('Class ended successfully.', 'success');
    } catch (e: any) {
      (window as any).addNotification?.(e.message ?? 'Failed to end class.', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (classId: string) => {
    if (!confirm('Delete this class? This cannot be undone.')) return;
    await liveClassService.delete(classId).catch(() => {});
  };

  const handleLeaveRoom = useCallback(() => {
    setActiveRoom(null);
  }, []);

  const liveClasses = classes.filter((c) => c.status === 'live');
  const scheduledClasses = classes.filter((c) => c.status === 'scheduled');
  const endedClasses = classes.filter((c) => c.status === 'ended');

  if (!user) return null;

  // Full screen room
  if (activeRoom) {
    return (
      <LiveRoomModal
        joinInfo={activeRoom.info}
        title={activeRoom.title}
        displayName={`${user.name}${user.surname ? ' ' + user.surname : ''}`}
        onLeave={handleLeaveRoom}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Video size={26} className="text-primary-400" />
            Live Classes
          </h1>
          <p className="text-gray-400 mt-1 text-sm">Schedule, host, and manage your live classes.</p>
        </div>
        <button
          onClick={() => setShowScheduleModal(true)}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 rounded-xl transition-colors font-medium text-sm shadow-lg"
        >
          <Plus size={18} /> Schedule New Class
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Live Now', value: liveClasses.length, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
          { label: 'Upcoming', value: scheduledClasses.length, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
          { label: 'Completed', value: endedClasses.length, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`border rounded-2xl p-4 text-center ${bg}`}>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3">
          <Loader size={32} className="animate-spin text-primary-500" />
          <p className="text-gray-400">Loading your classes…</p>
        </div>
      ) : classes.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4 bg-gray-800/40 border border-gray-700 rounded-2xl">
          <Video size={48} className="text-gray-600" />
          <div className="text-center">
            <h3 className="text-white font-semibold">No classes yet</h3>
            <p className="text-gray-400 text-sm mt-1">Schedule your first live class to get started.</p>
          </div>
          <button
            onClick={() => setShowScheduleModal(true)}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-xl text-sm font-medium"
          >
            <Plus size={16} /> Schedule First Class
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* LIVE */}
          {liveClasses.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" /> Live Now
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {liveClasses.map((cls) => (
                  <ClassCard
                    key={cls.id} cls={cls}
                    onStart={() => handleStart(cls)}
                    onJoin={() => handleJoin(cls)}
                    onEnd={() => handleEnd(cls)}
                    onAddRecording={() => setRecordingTarget(cls)}
                    onDelete={() => handleDelete(cls.id)}
                    onViewAttendees={() => setAttendeesTarget({ id: cls.id, title: cls.title })}
                    isProcessing={processingId === cls.id}
                  />
                ))}
              </div>
            </section>
          )}

          {/* UPCOMING */}
          {scheduledClasses.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-blue-400 uppercase tracking-wider mb-3">Upcoming</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {scheduledClasses.map((cls) => (
                  <ClassCard
                    key={cls.id} cls={cls}
                    onStart={() => handleStart(cls)}
                    onJoin={() => handleJoin(cls)}
                    onEnd={() => handleEnd(cls)}
                    onAddRecording={() => setRecordingTarget(cls)}
                    onDelete={() => handleDelete(cls.id)}
                    onViewAttendees={() => setAttendeesTarget({ id: cls.id, title: cls.title })}
                    isProcessing={processingId === cls.id}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ENDED */}
          {endedClasses.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Past Classes</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {endedClasses.map((cls) => (
                  <ClassCard
                    key={cls.id} cls={cls}
                    onStart={() => handleStart(cls)}
                    onJoin={() => handleJoin(cls)}
                    onEnd={() => handleEnd(cls)}
                    onAddRecording={() => setRecordingTarget(cls)}
                    onDelete={() => handleDelete(cls.id)}
                    onViewAttendees={() => setAttendeesTarget({ id: cls.id, title: cls.title })}
                    isProcessing={processingId === cls.id}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Modals */}
      {showScheduleModal && (
        <ScheduleModal
          onClose={() => setShowScheduleModal(false)}
          onScheduled={() => {}}
          teacherId={user.uid}
          teacherName={`${user.name}${user.surname ? ' ' + user.surname : ''}`}
        />
      )}
      {recordingTarget && (
        <RecordingModal
          classItem={recordingTarget}
          onClose={() => setRecordingTarget(null)}
          onSaved={() => setRecordingTarget(null)}
        />
      )}
      {attendeesTarget && (
        <AttendeesModal
          classId={attendeesTarget.id}
          title={attendeesTarget.title}
          onClose={() => setAttendeesTarget(null)}
        />
      )}
    </div>
  );
};

export default TeacherLiveClass;
