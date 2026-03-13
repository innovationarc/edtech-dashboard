// src/components/liveClass/HMSRoom.tsx

import React, { useEffect, useCallback } from 'react';
import {
  HMSRoomProvider,
  useHMSStore,
  useHMSActions,
  selectIsConnectedToRoom,
  selectPeers,
  selectLocalPeer,
  selectIsPeerAudioEnabled,
  selectIsPeerVideoEnabled,
  useVideo,
} from '@100mslive/react-sdk';
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, MonitorUp, Users, Loader,
} from 'lucide-react';

// ─── Video Tile ───────────────────────────────────────────────────────────────

interface VideoTileProps {
  peer: any;
  isLocal?: boolean;
}

const VideoTile: React.FC<VideoTileProps> = ({ peer, isLocal }) => {
  const { videoRef } = useVideo({ trackId: peer.videoTrack });
  const isAudioOn = useHMSStore(selectIsPeerAudioEnabled(peer.id));
  const isVideoOn = useHMSStore(selectIsPeerVideoEnabled(peer.id));

  return (
    <div className="relative bg-gray-800 rounded-xl overflow-hidden aspect-video flex items-center justify-center">
      {isVideoOn ? (
        <video
          ref={videoRef}
          autoPlay
          muted={isLocal}
          playsInline
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 rounded-full bg-primary-700 flex items-center justify-center text-2xl font-bold text-white">
            {peer.name?.charAt(0).toUpperCase() ?? '?'}
          </div>
          <p className="text-gray-300 text-sm">{peer.name}</p>
        </div>
      )}

      {/* Name + status overlay */}
      <div className="absolute bottom-2 left-2 flex items-center gap-2">
        <span className="bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
          {peer.name}{isLocal ? ' (You)' : ''}
        </span>
        {!isAudioOn && (
          <span className="bg-red-600/80 rounded-full p-1">
            <MicOff size={10} className="text-white" />
          </span>
        )}
      </div>
    </div>
  );
};

// ─── Controls ─────────────────────────────────────────────────────────────────

interface ControlsProps {
  isHost: boolean;
  onLeave: () => void;
}

const Controls: React.FC<ControlsProps> = ({ isHost, onLeave }) => {
  const hmsActions = useHMSActions();
  const localPeer = useHMSStore(selectLocalPeer);
  const isAudioOn = useHMSStore(localPeer ? selectIsPeerAudioEnabled(localPeer.id) : () => false);
  const isVideoOn = useHMSStore(localPeer ? selectIsPeerVideoEnabled(localPeer.id) : () => false);

  const toggleAudio = () => hmsActions.setLocalAudioEnabled(!isAudioOn);
  const toggleVideo = () => hmsActions.setLocalVideoEnabled(!isVideoOn);
  const shareScreen = async () => {
    try { await hmsActions.setScreenShareEnabled(true); } catch { /* user cancelled */ }
  };

  const CtrlBtn = ({ onClick, active, danger, icon, label }: {
    onClick: () => void; active?: boolean; danger?: boolean;
    icon: React.ReactNode; label: string;
  }) => (
    <button
      onClick={onClick}
      title={label}
      className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 ${
        danger
          ? 'bg-red-600 hover:bg-red-700 text-white'
          : active
          ? 'bg-gray-600 hover:bg-gray-500 text-white'
          : 'bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white'
      }`}
    >
      {icon}
      <span className="text-xs hidden sm:block">{label}</span>
    </button>
  );

  return (
    <div className="flex items-center justify-center gap-3 py-3 px-4 bg-gray-900 border-t border-gray-700">
      <CtrlBtn
        onClick={toggleAudio}
        active={!isAudioOn}
        icon={isAudioOn ? <Mic size={20} /> : <MicOff size={20} />}
        label={isAudioOn ? 'Mute' : 'Unmute'}
      />
      <CtrlBtn
        onClick={toggleVideo}
        active={!isVideoOn}
        icon={isVideoOn ? <Video size={20} /> : <VideoOff size={20} />}
        label={isVideoOn ? 'Camera Off' : 'Camera On'}
      />
      {isHost && (
        <CtrlBtn
          onClick={shareScreen}
          icon={<MonitorUp size={20} />}
          label="Share Screen"
        />
      )}
      <CtrlBtn
        onClick={onLeave}
        danger
        icon={<PhoneOff size={20} />}
        label="Leave"
      />
    </div>
  );
};

// ─── Conference Room ──────────────────────────────────────────────────────────

interface ConferenceProps {
  authToken: string;
  displayName: string;
  isHost: boolean;
  onLeave: () => void;
  onParticipantCount?: (count: number) => void;
}

const Conference: React.FC<ConferenceProps> = ({
  authToken,
  displayName,
  isHost,
  onLeave,
  onParticipantCount,
}) => {
  const hmsActions = useHMSActions();
  const isConnected = useHMSStore(selectIsConnectedToRoom);
  const peers = useHMSStore(selectPeers);
  const localPeer = useHMSStore(selectLocalPeer);

  useEffect(() => {
    if (authToken && !isConnected) {
      hmsActions.join({
        authToken,
        userName: displayName,
        settings: {
          isAudioMuted: !isHost,
          isVideoMuted: !isHost,
        },
      });
    }
  }, [authToken, displayName, isHost, isConnected, hmsActions]);

  useEffect(() => {
    onParticipantCount?.(peers.length);
  }, [peers.length, onParticipantCount]);

  const handleLeave = useCallback(async () => {
    await hmsActions.leave();
    onLeave();
  }, [hmsActions, onLeave]);

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-900">
        <Loader size={36} className="animate-spin text-primary-500 mb-3" />
        <p className="text-gray-300 text-sm">Connecting to live class…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-sm font-medium text-white">Live Class</span>
        </div>
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <Users size={14} />
          <span>{peers.length} participants</span>
        </div>
      </div>

      {/* Video Grid */}
      <div className="flex-1 overflow-y-auto p-3">
        <div
          className={`grid gap-3 h-full ${
            peers.length <= 1
              ? 'grid-cols-1'
              : peers.length <= 4
              ? 'grid-cols-2'
              : 'grid-cols-3'
          }`}
        >
          {peers.map((peer) => (
            <VideoTile
              key={peer.id}
              peer={peer}
              isLocal={peer.id === localPeer?.id}
            />
          ))}
        </div>
      </div>

      {/* Controls */}
      <Controls isHost={isHost} onLeave={handleLeave} />
    </div>
  );
};

// ─── Public Component (wraps with HMSRoomProvider) ───────────────────────────

interface HMSRoomProps {
  authToken: string;
  displayName: string;
  isHost: boolean;
  onLeave: () => void;
  onParticipantCount?: (count: number) => void;
}

const HMSRoom: React.FC<HMSRoomProps> = (props) => (
  <HMSRoomProvider>
    <Conference {...props} />
  </HMSRoomProvider>
);

export default HMSRoom;
