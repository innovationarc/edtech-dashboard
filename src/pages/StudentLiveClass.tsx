// src/pages/StudentLiveClass.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Video, Play, BookOpen, Clock, Calendar, Users,
  Radio, X, Loader, AlertCircle, ChevronRight,
} from 'lucide-react';
import { format, isPast, isWithinInterval, addMinutes } from 'date-fns';
import { useDashboard } from '../contexts/DashboardContext';
import { liveClassService, attendanceService, liveClassSettingsService } from '../services/liveClassService';
import { generateHMSAuthToken } from '../services/liveClassProviderService';
import { LiveClass, JoinInfo } from '../types/liveClassTypes';
import JitsiRoom from '../components/liveClass/JitsiRoom';
import HMSRoom from '../components/liveClass/HMSRoom';

// ─── Status Badge ─────────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: LiveClass['status'] }> = ({ status }) => {
  const cfg = {
    scheduled: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    live: 'bg-red-500/20 text-red-300 border-red-500/30 animate-pulse',
    ended: 'bg-gray-600/30 text-gray-400 border-gray-600/30',
  }[status];
  const labels = { scheduled: 'Scheduled', live: '● LIVE', ended: 'Ended' };
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg}`}>
      {labels[status]}
    </span>
  );
};

// ─── Recording Viewer ─────────────────────────────────────────────────────────

const RecordingViewer: React.FC<{ url: string; title: string; onClose: () => void }> = ({
  url, title, onClose,
}) => (
  <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
    <div className="flex items-center justify-between px-4 py-2.5 bg-gray-900 border-b border-gray-800 shrink-0">
      <span className="font-semibold text-white text-sm">{title} — Recording</span>
      <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-700">
        <X size={20} />
      </button>
    </div>
    <div className="flex-1 overflow-hidden">
      <iframe
        src={url}
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
        className="w-full h-full border-0"
        title={`Recording: ${title}`}
      />
    </div>
  </div>
);

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
  const didTrackRef = useRef(false);

  useEffect(() => {
    // Track join attendance
    if (!didTrackRef.current) {
      didTrackRef.current = true;
      attendanceService.join(joinInfo.classId, joinInfo.classId + '_student', displayName).catch(() => {});
    }
    return () => {
      attendanceService.leave(joinInfo.classId, joinInfo.classId + '_student').catch(() => {});
    };
  }, [joinInfo.classId, displayName]);

  const handleJitsiParticipantJoined = useCallback(
    async (id: string, name: string) => {
      await attendanceService.join(joinInfo.classId, id, name).catch(() => {});
    },
    [joinInfo.classId]
  );

  const handleJitsiParticipantLeft = useCallback(
    async (id: string) => {
      await attendanceService.leave(joinInfo.classId, id).catch(() => {});
    },
    [joinInfo.classId]
  );

  return (
    <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
          <span className="font-semibold text-white text-sm">{title}</span>
        </div>
        <button
          onClick={onLeave}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 transition-colors"
        >
          <X size={16} /> Leave Class
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        {joinInfo.provider === 'jitsi' ? (
          <JitsiRoom
            domain={joinInfo.jitsiDomain ?? 'meet.jit.si'}
            roomId={joinInfo.jitsiRoomId ?? ''}
            displayName={displayName}
            isHost={false}
            onParticipantJoined={handleJitsiParticipantJoined}
            onParticipantLeft={handleJitsiParticipantLeft}
            onConferenceLeft={onLeave}
            onReadyToClose={onLeave}
          />
        ) : joinInfo.hmsAuthToken ? (
          <HMSRoom
            authToken={joinInfo.hmsAuthToken}
            displayName={displayName}
            isHost={false}
            onLeave={onLeave}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <AlertCircle size={32} className="text-red-400 mb-3" />
            <p className="text-white font-medium">Failed to connect to the room.</p>
            <button onClick={onLeave} className="mt-4 text-primary-400 hover:underline text-sm">Go back</button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Class Card ───────────────────────────────────────────────────────────────

interface ClassCardProps {
  cls: LiveClass;
  onJoin: () => void;
  onWatch: () => void;
  isJoining: boolean;
}

const ClassCard: React.FC<ClassCardProps> = ({ cls, onJoin, onWatch, isJoining }) => {
  const scheduledDate = cls.scheduledAt.toDate();
  const canJoin = cls.status === 'live';

  return (
    <div
      className={`bg-gray-800/60 border rounded-2xl overflow-hidden transition-all ${
        cls.status === 'live' ? 'border-red-500/50 ring-1 ring-red-500/20' : 'border-gray-700 hover:border-gray-600'
      }`}
    >
      <div className={`h-1 ${cls.status === 'live' ? 'bg-red-500' : cls.status === 'scheduled' ? 'bg-primary-500' : 'bg-gray-600'}`} />

      <div className="p-5 space-y-4">
        {/* Top row */}
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <StatusBadge status={cls.status} />
              {cls.provider && (
                <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full capitalize">
                  {cls.provider === '100ms' ? '100ms' : 'Jitsi'}
                </span>
              )}
            </div>
            <h4 className="font-semibold text-white text-base leading-snug">{cls.title}</h4>
            {cls.description && (
              <p className="text-sm text-gray-400 mt-1 line-clamp-2">{cls.description}</p>
            )}
          </div>
        </div>

        {/* Teacher + course */}
        <div className="flex flex-wrap gap-3 text-sm text-gray-400">
          <span className="flex items-center gap-1.5">
            <Users size={13} className="text-gray-500" />
            {cls.teacherName}
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar size={13} className="text-gray-500" />
            {format(scheduledDate, 'MMM d, yyyy')}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock size={13} className="text-gray-500" />
            {format(scheduledDate, 'h:mm a')} · {cls.durationMins} min
          </span>
          {cls.courseName && (
            <span className="flex items-center gap-1.5">
              <BookOpen size={13} className="text-gray-500" />
              {cls.courseName}
            </span>
          )}
        </div>

        {/* CTA */}
        <div className="flex flex-wrap gap-2">
          {canJoin && (
            <button
              onClick={onJoin}
              disabled={isJoining}
              className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-red-900/30"
            >
              {isJoining ? (
                <Loader size={14} className="animate-spin" />
              ) : (
                <Radio size={14} className="animate-pulse" />
              )}
              {isJoining ? 'Joining…' : 'Join Now'}
            </button>
          )}

          {cls.status === 'ended' && cls.recordingUrl && (
            <button
              onClick={onWatch}
              className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            >
              <Play size={14} /> Watch Recording
            </button>
          )}

          {cls.status === 'ended' && !cls.recordingUrl && (
            <span className="text-xs text-gray-500 py-2">Recording not available yet</span>
          )}

          {cls.status === 'scheduled' && (
            <span className="flex items-center gap-1.5 text-sm text-gray-500 py-2">
              <Clock size={13} /> Starts {format(scheduledDate, 'MMM d')} at {format(scheduledDate, 'h:mm a')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Filter Tabs ──────────────────────────────────────────────────────────────

type Filter = 'all' | 'live' | 'upcoming' | 'ended';

const filterTabs: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'live', label: '● Live' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'ended', label: 'Past' },
];

// ─── Main Component ───────────────────────────────────────────────────────────

const StudentLiveClass: React.FC = () => {
  const { user } = useDashboard();
  const [classes, setClasses] = useState<LiveClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [activeRoom, setActiveRoom] = useState<{ info: JoinInfo; title: string } | null>(null);
  const [recordingView, setRecordingView] = useState<{ url: string; title: string } | null>(null);
  const unsubRef = useRef<() => void>();

  // Real-time snapshot of ALL classes — only register when authenticated
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    unsubRef.current = liveClassService.onSnapshot((list) => {
      setClasses(list);
      setLoading(false);
    });
    return () => unsubRef.current?.();
  }, [user?.uid]);

  const handleJoin = async (cls: LiveClass) => {
    if (!user) return;
    setJoiningId(cls.id);
    try {
      let hmsAuthToken: string | undefined;
      let jitsiDomain: string | undefined = 'meet.jit.si';

      const settings = await liveClassSettingsService.get();

      if (cls.provider === '100ms' && cls.hmsRoomId) {
        const key = settings?.hmsKeys.find((k) => k.id === cls.activeKeyId);
        if (key) {
          hmsAuthToken = await generateHMSAuthToken(
            key.appKey, key.appSecret, cls.hmsRoomId, user.uid, 'guest'
          ).catch(() => undefined);
        }
      } else if (cls.provider === 'jitsi') {
        jitsiDomain =
          settings?.jitsiKeys.find((k) => k.id === cls.activeKeyId)?.domain ?? 'meet.jit.si';
      }

      const info: JoinInfo = {
        classId: cls.id,
        provider: cls.provider,
        jitsiDomain,
        jitsiRoomId: cls.jitsiRoomId,
        hmsRoomId: cls.hmsRoomId,
        hmsAuthToken,
        isHost: false,
      };
      setActiveRoom({ info, title: cls.title });
    } catch (e: any) {
      (window as any).addNotification?.(e.message ?? 'Failed to join class.', 'error');
    } finally {
      setJoiningId(null);
    }
  };

  const handleLeaveRoom = useCallback(() => {
    setActiveRoom(null);
  }, []);

  const filtered = classes.filter((c) => {
    if (filter === 'all') return true;
    if (filter === 'live') return c.status === 'live';
    if (filter === 'upcoming') return c.status === 'scheduled';
    return c.status === 'ended';
  });

  const liveCount = classes.filter((c) => c.status === 'live').length;

  if (!user) return null;

  // Full-screen room
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

  // Full-screen recording viewer
  if (recordingView) {
    return (
      <RecordingViewer
        url={recordingView.url}
        title={recordingView.title}
        onClose={() => setRecordingView(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Video size={26} className="text-primary-400" />
          Live Classes
        </h1>
        <p className="text-gray-400 mt-1 text-sm">
          Join live sessions and rewatch recorded classes.
        </p>
      </div>

      {/* Live now banner */}
      {liveCount > 0 && (
        <div className="flex items-center gap-3 bg-red-900/20 border border-red-500/30 rounded-2xl px-5 py-3.5 animate-pulse-slow">
          <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse shrink-0" />
          <p className="text-red-300 font-medium text-sm">
            {liveCount} class{liveCount > 1 ? 'es are' : ' is'} live right now — join before it ends!
          </p>
          <button
            onClick={() => setFilter('live')}
            className="ml-auto flex items-center gap-1 text-xs text-red-400 hover:text-red-300 font-semibold"
          >
            View Live <ChevronRight size={12} />
          </button>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {filterTabs.map((tab) => {
          const count =
            tab.id === 'all'
              ? classes.length
              : classes.filter((c) =>
                  tab.id === 'live'
                    ? c.status === 'live'
                    : tab.id === 'upcoming'
                    ? c.status === 'scheduled'
                    : c.status === 'ended'
                ).length;

          return (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                filter === tab.id
                  ? 'bg-primary-600 text-white shadow-lg'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
              } ${tab.id === 'live' && liveCount > 0 ? 'text-red-300' : ''}`}
            >
              {tab.label}
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full ${
                  filter === tab.id ? 'bg-white/20' : 'bg-gray-700'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Classes list */}
      {loading ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3">
          <Loader size={32} className="animate-spin text-primary-500" />
          <p className="text-gray-400 text-sm">Loading classes…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3 bg-gray-800/40 border border-gray-700 rounded-2xl">
          <Video size={44} className="text-gray-600" />
          <div className="text-center">
            <h3 className="text-white font-semibold">No classes found</h3>
            <p className="text-gray-500 text-sm mt-1">
              {filter === 'live'
                ? 'No live classes right now. Check back soon!'
                : filter === 'upcoming'
                ? 'No upcoming classes scheduled yet.'
                : filter === 'ended'
                ? 'No past classes available.'
                : 'No classes available yet.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((cls) => (
            <ClassCard
              key={cls.id}
              cls={cls}
              isJoining={joiningId === cls.id}
              onJoin={() => handleJoin(cls)}
              onWatch={() =>
                cls.recordingUrl &&
                setRecordingView({ url: cls.recordingUrl, title: cls.title })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentLiveClass;
