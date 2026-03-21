// src/pages/StudentStream.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  Radio, Play, ChevronRight, ArrowLeft, Users, Clock,
  Calendar, MessageSquare, Send, Loader, BookOpen, Video, X,
} from 'lucide-react';
import { format } from 'date-fns';
import { useDashboard } from '../contexts/DashboardContext';
import { streamService, streamChatService, viewerService } from '../services/streamService';
import { LiveStream, StreamChatMessage, StreamProvider } from '../types/streamTypes';
import HLSPlayer from '../components/stream/HLSPlayer';

type Filter = 'all' | 'live' | 'upcoming' | 'ended';

const filterTabs: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'live', label: '● Live' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'ended', label: 'Past' },
];

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

// ─── Chat Message ─────────────────────────────────────────────────────────────

const ChatMessage: React.FC<{
  msg: StreamChatMessage;
  isOwn: boolean;
  canDelete: boolean;
  onDelete: () => void;
}> = ({ msg, isOwn, canDelete, onDelete }) => {
  const roleColor: Record<string, string> = {
    teacher: '#818cf8', admin: '#f59e0b', student: '#94a3b8',
  };
  const color = roleColor[msg.userRole] ?? '#94a3b8';

  return (
    <div className={`flex gap-2 group ${isOwn ? 'flex-row-reverse' : ''}`}>
      <div style={{
        width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
        background: `${color}22`, border: `1px solid ${color}44`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 700, color,
      }}>
        {msg.userName.charAt(0).toUpperCase()}
      </div>
      <div className={`max-w-[76%] flex flex-col gap-0.5 ${isOwn ? 'items-end' : 'items-start'}`}>
        <span style={{ fontSize: 10, color, fontWeight: 600 }}>
          {isOwn ? 'You' : msg.userName}
          {msg.userRole !== 'student' && (
            <span style={{ fontSize: 9, opacity: 0.7, marginLeft: 4, textTransform: 'capitalize' }}>
              {msg.userRole}
            </span>
          )}
        </span>
        <div className={`px-3 py-1.5 rounded-2xl text-xs leading-relaxed ${
          isOwn ? 'bg-primary-600 text-white rounded-tr-sm' : 'bg-gray-700 text-gray-200 rounded-tl-sm'
        }`}>
          {msg.message}
        </div>
        {canDelete && (
          <button onClick={onDelete}
            className="text-xs text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
            Delete
          </button>
        )}
      </div>
    </div>
  );
};

// ─── Watch View ───────────────────────────────────────────────────────────────

const WatchView: React.FC<{
  stream: LiveStream;
  userId: string;
  userRole: string;
  userName: string;
  onBack: () => void;
}> = ({ stream, userId, userRole, userName, onBack }) => {
  const [messages, setMessages] = useState<StreamChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unsubChatRef = useRef<() => void>();

  const isLive = stream.status === 'live';
  const isEnded = stream.status === 'ended';
  const isYouTube = stream.provider === 'youtube';
  const canModerate = userRole === 'admin' || userRole === 'teacher';

  const getYouTubeEmbed = () => {
    const vidId = stream.youtubeVideoId ?? stream.playbackUrl;
    if (!vidId) return '';
    return isLive
      ? `https://www.youtube.com/embed/${vidId}?autoplay=1`
      : `https://www.youtube.com/embed/${vidId}`;
  };

  const getHLSUrl = () => {
    if (isEnded && stream.recordingUrl) return stream.recordingUrl;
    return stream.playbackUrl ?? '';
  };

  useEffect(() => {
    viewerService.join(stream.id, userId).catch(() => {});
    heartbeatRef.current = setInterval(() => {
      viewerService.heartbeat(stream.id, userId).catch(() => {});
    }, 30_000);
    if (stream.chatEnabled) {
      unsubChatRef.current = streamChatService.onSnapshot(stream.id, msgs => setMessages(msgs));
    }
    return () => {
      viewerService.leave(stream.id, userId).catch(() => {});
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      unsubChatRef.current?.();
    };
  }, [stream.id, userId]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const sendMessage = async () => {
    const text = chatInput.trim();
    if (!text || sending) return;
    setSending(true);
    setChatInput('');
    try { await streamChatService.send(stream.id, userId, userName, userRole, text); } catch {}
    setSending(false);
  };

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-start gap-3">
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors shrink-0 mt-1">
          <ArrowLeft size={16} /> Back
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-white font-semibold text-base truncate">{stream.title}</h2>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {isLive && (
              <span className="flex items-center gap-1 text-xs text-red-400">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" /> LIVE
              </span>
            )}
            {isEnded && <span className="text-xs text-gray-500">Recording</span>}
            <ProviderBadge provider={stream.provider} />
            {isLive && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Users size={10} /> {stream.viewerCount} watching
              </span>
            )}
          </div>
        </div>
        {stream.chatEnabled && (
          <button onClick={() => setChatOpen(v => !v)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              chatOpen ? 'bg-primary-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-white'
            }`}>
            <MessageSquare size={12} /> Chat
          </button>
        )}
      </div>

      {/* Player + Chat */}
      <div className={`flex gap-4 ${chatOpen && stream.chatEnabled ? 'flex-col lg:flex-row' : ''}`}>
        {/* Player */}
        <div className={chatOpen && stream.chatEnabled ? 'lg:flex-1' : 'w-full'}>
          {isYouTube ? (
            <div style={{ position: 'relative', background: '#000', borderRadius: 12, overflow: 'hidden', aspectRatio: '16/9' }}>
              {getYouTubeEmbed() ? (
                <iframe src={getYouTubeEmbed()}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen style={{ width: '100%', height: '100%', border: 'none' }}
                  title={stream.title} />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-600">
                  <Video size={40} /><p className="text-sm">Stream not started yet</p>
                </div>
              )}
            </div>
          ) : getHLSUrl() ? (
            <HLSPlayer src={getHLSUrl()} autoPlay={isLive} />
          ) : (
            <div className="bg-gray-900 border border-gray-700 rounded-2xl flex flex-col items-center justify-center gap-3 text-gray-600"
              style={{ aspectRatio: '16/9' }}>
              <Radio size={36} /><p className="text-sm">{isLive ? 'Stream starting soon…' : 'No playback available'}</p>
            </div>
          )}
        </div>

        {/* Chat */}
        {chatOpen && stream.chatEnabled && (
          <div className="lg:w-80 flex flex-col bg-gray-800/60 border border-gray-700 rounded-2xl overflow-hidden"
            style={{ height: 'clamp(300px,46vh,520px)' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 shrink-0">
              <span className="font-semibold text-white text-sm flex items-center gap-2">
                <MessageSquare size={14} className="text-primary-400" /> Live Chat
              </span>
              <span className="text-xs text-gray-500">{messages.length}</span>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3"
              style={{ scrollbarWidth: 'thin', scrollbarColor: '#374151 transparent' }}>
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-600">
                  <MessageSquare size={22} /><p className="text-xs">No messages yet. Say hello!</p>
                </div>
              ) : messages.map(msg => (
                <ChatMessage key={msg.id} msg={msg}
                  isOwn={msg.userId === userId}
                  canDelete={msg.userId === userId || canModerate}
                  onDelete={() => streamChatService.delete(stream.id, msg.id).catch(() => {})} />
              ))}
              <div ref={chatBottomRef} />
            </div>

            {isLive ? (
              <div className="px-3 py-2.5 border-t border-gray-700 flex gap-2 shrink-0">
                <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Send a message…" maxLength={200}
                  className="flex-1 bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-primary-500" />
                <button onClick={sendMessage} disabled={!chatInput.trim() || sending}
                  className="w-9 h-9 shrink-0 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white flex items-center justify-center transition-colors">
                  {sending ? <Loader size={13} className="animate-spin" /> : <Send size={13} />}
                </button>
              </div>
            ) : (
              <div className="px-4 py-2.5 border-t border-gray-700 text-xs text-gray-500 text-center shrink-0">
                Chat available during live streams only
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Stream List Card ─────────────────────────────────────────────────────────

const StreamListCard: React.FC<{ stream: LiveStream; onWatch: () => void }> = ({ stream, onWatch }) => {
  const isLive = stream.status === 'live';
  const isEnded = stream.status === 'ended';
  const scheduledDate = stream.scheduledAt?.toDate() ?? new Date();
  const hasRecording = isEnded && !!stream.recordingUrl;

  return (
    <div className={`bg-gray-800/60 border rounded-2xl overflow-hidden transition-all ${
      isLive ? 'border-red-500/50 ring-1 ring-red-500/20' : 'border-gray-700 hover:border-gray-600'
    }`}>
      <div className={`h-1 ${isLive ? 'bg-red-500' : isEnded ? 'bg-gray-600' : 'bg-primary-500'}`} />

      <div className="p-5 space-y-3">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            {isLive && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full border bg-red-500/20 text-red-300 border-red-500/30 animate-pulse">
                ● LIVE
              </span>
            )}
            {!isLive && (
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                isEnded ? 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                        : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
              }`}>
                {isEnded ? 'Ended' : 'Scheduled'}
              </span>
            )}
            <ProviderBadge provider={stream.provider} />
          </div>
          <h4 className="font-semibold text-white text-base">{stream.title}</h4>
          {stream.description && <p className="text-sm text-gray-400 mt-1 line-clamp-2">{stream.description}</p>}
        </div>

        <div className="flex flex-wrap gap-3 text-sm text-gray-400">
          <span className="flex items-center gap-1.5"><Users size={13} className="text-gray-500" />{stream.teacherName}</span>
          {stream.scheduledAt && (
            <span className="flex items-center gap-1.5">
              <Calendar size={13} className="text-gray-500" />
              {format(scheduledDate, 'MMM d, yyyy h:mm a')}
            </span>
          )}
          {stream.courseName && (
            <span className="flex items-center gap-1.5"><BookOpen size={13} className="text-gray-500" />{stream.courseName}</span>
          )}
          {isLive && (
            <span className="flex items-center gap-1.5 text-red-400"><Users size={13} /> {stream.viewerCount} watching</span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {isLive && (
            <button onClick={onWatch}
              className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-red-900/30">
              <Radio size={14} className="animate-pulse" /> Watch Live
            </button>
          )}
          {hasRecording && (
            <button onClick={onWatch}
              className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
              <Play size={14} /> Watch Recording
            </button>
          )}
          {isEnded && !hasRecording && (
            <span className="text-xs text-gray-500 py-2">Recording not available yet</span>
          )}
          {stream.status === 'scheduled' && (
            <span className="flex items-center gap-1.5 text-sm text-gray-500 py-2">
              <Clock size={13} /> Starts {format(scheduledDate, 'MMM d')} at {format(scheduledDate, 'h:mm a')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const StudentStream: React.FC = () => {
  const { user } = useDashboard();
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [watching, setWatching] = useState<LiveStream | null>(null);
  const unsubRef = useRef<() => void>();

  // Real-time snapshot of ALL streams — only register when authenticated
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    unsubRef.current = streamService.onSnapshot(list => {
      setStreams(list);
      setLoading(false);
    });
    return () => unsubRef.current?.();
  }, [user?.uid]);

  // Keep watching stream synced with real-time updates
  useEffect(() => {
    if (!watching) return;
    const updated = streams.find(s => s.id === watching.id);
    if (updated) setWatching(updated);
  }, [streams]);

  const filtered = streams.filter(s => {
    if (filter === 'all') return true;
    if (filter === 'live') return s.status === 'live';
    if (filter === 'upcoming') return s.status === 'scheduled';
    return s.status === 'ended';
  });

  const liveCount = streams.filter(s => s.status === 'live').length;

  if (!user) return null;

  if (watching) {
    return (
      <WatchView
        stream={watching}
        userId={user.uid}
        userRole={user.role}
        userName={user.name}
        onBack={() => setWatching(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Radio size={26} className="text-primary-400" /> Live Streams
        </h1>
        <p className="text-gray-400 mt-1 text-sm">Watch live broadcasts and recorded sessions.</p>
      </div>

      {liveCount > 0 && (
        <div className="flex items-center gap-3 bg-red-900/20 border border-red-500/30 rounded-2xl px-5 py-3.5">
          <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse shrink-0" />
          <p className="text-red-300 font-medium text-sm">
            {liveCount} stream{liveCount > 1 ? 's are' : ' is'} live right now — don't miss it!
          </p>
          <button onClick={() => setFilter('live')}
            className="ml-auto flex items-center gap-1 text-xs text-red-400 hover:text-red-300 font-semibold shrink-0">
            Watch Now <ChevronRight size={12} />
          </button>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {filterTabs.map(tab => {
          const count = tab.id === 'all' ? streams.length
            : streams.filter(s =>
                tab.id === 'live' ? s.status === 'live'
                : tab.id === 'upcoming' ? s.status === 'scheduled'
                : s.status === 'ended'
              ).length;
          return (
            <button key={tab.id} onClick={() => setFilter(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                filter === tab.id
                  ? 'bg-primary-600 text-white shadow-lg'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}>
              {tab.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${filter === tab.id ? 'bg-white/20' : 'bg-gray-700'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3">
          <Loader size={32} className="animate-spin text-primary-500" />
          <p className="text-gray-400 text-sm">Loading streams…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3 bg-gray-800/40 border border-gray-700 rounded-2xl">
          <Radio size={44} className="text-gray-600" />
          <div className="text-center">
            <h3 className="text-white font-semibold">No streams found</h3>
            <p className="text-gray-500 text-sm mt-1">
              {filter === 'live' ? 'No live streams right now. Check back soon!'
                : filter === 'upcoming' ? 'No upcoming streams scheduled yet.'
                : filter === 'ended' ? 'No past streams available.'
                : 'No streams available yet.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(s => (
            <StreamListCard key={s.id} stream={s} onWatch={() => setWatching(s)} />
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentStream;
