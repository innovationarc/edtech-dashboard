// src/components/liveClass/JitsiRoom.tsx
import React, { useEffect, useRef, useCallback } from 'react';
import { Loader } from 'lucide-react';

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

interface JitsiRoomProps {
  domain: string;
  roomId: string;
  displayName: string;
  isHost: boolean;
  onParticipantJoined?: (id: string, name: string) => void;
  onParticipantLeft?: (id: string) => void;
  onReadyToClose?: () => void;
  onConferenceLeft?: () => void;
}

const JitsiRoom: React.FC<JitsiRoomProps> = ({
  domain,
  roomId,
  displayName,
  isHost,
  onParticipantJoined,
  onParticipantLeft,
  onReadyToClose,
  onConferenceLeft,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  const [loading, setLoading] = React.useState(true);

  const initJitsi = useCallback(() => {
    if (!containerRef.current || !window.JitsiMeetExternalAPI) return;

    // Destroy any existing instance
    if (apiRef.current) {
      try { apiRef.current.dispose(); } catch { /* ignore */ }
    }

    const options = {
      roomName: roomId,
      width: '100%',
      height: '100%',
      parentNode: containerRef.current,
      configOverwrite: {
        prejoinPageEnabled: false,
        disableDeepLinking: true,
        startWithAudioMuted: !isHost,
        startWithVideoMuted: !isHost,
        disableInviteFunctions: !isHost,
        toolbarButtons: isHost
          ? [
              'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
              'fodeviceselection', 'hangup', 'profile', 'chat', 'recording',
              'livestreaming', 'etherpad', 'sharedvideo', 'settings', 'raisehand',
              'videoquality', 'filmstrip', 'shortcuts', 'tileview', 'select-background',
              'mute-everyone', 'security',
            ]
          : [
              'microphone', 'camera', 'closedcaptions', 'fullscreen', 'hangup',
              'chat', 'raisehand', 'videoquality', 'filmstrip', 'tileview',
            ],
      },
      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        SHOW_BRAND_WATERMARK: false,
        BRAND_WATERMARK_LINK: '',
        SHOW_POWERED_BY: false,
        DISPLAY_WELCOME_FOOTER: false,
        MOBILE_APP_PROMO: false,
        HIDE_INVITE_MORE_HEADER: !isHost,
        TOOLBAR_ALWAYS_VISIBLE: false,
        DEFAULT_BACKGROUND: '#111827',
      },
      userInfo: {
        displayName,
      },
    };

    try {
      apiRef.current = new window.JitsiMeetExternalAPI(domain, options);
      setLoading(false);

      apiRef.current.addEventListener('videoConferenceJoined', () => {
        setLoading(false);
      });

      if (onParticipantJoined) {
        apiRef.current.addEventListener(
          'participantJoined',
          (e: { id: string; displayName: string }) =>
            onParticipantJoined(e.id, e.displayName)
        );
      }

      if (onParticipantLeft) {
        apiRef.current.addEventListener('participantLeft', (e: { id: string }) =>
          onParticipantLeft(e.id)
        );
      }

      if (onReadyToClose) {
        apiRef.current.addEventListener('readyToClose', onReadyToClose);
      }

      if (onConferenceLeft) {
        apiRef.current.addEventListener('videoConferenceLeft', onConferenceLeft);
      }
    } catch (err) {
      console.error('Jitsi init error:', err);
      setLoading(false);
    }
  }, [domain, roomId, displayName, isHost, onParticipantJoined, onParticipantLeft, onReadyToClose, onConferenceLeft]);

  useEffect(() => {
    // Load Jitsi External API script dynamically
    const scriptId = 'jitsi-external-api';
    const existing = document.getElementById(scriptId);

    if (existing) {
      if (window.JitsiMeetExternalAPI) {
        initJitsi();
      } else {
        existing.addEventListener('load', initJitsi);
      }
      return () => {
        existing.removeEventListener('load', initJitsi);
        if (apiRef.current) {
          try { apiRef.current.dispose(); } catch { /* ignore */ }
          apiRef.current = null;
        }
      };
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `https://${domain}/external_api.js`;
    script.async = true;
    script.onload = initJitsi;
    script.onerror = () => {
      console.error('Failed to load Jitsi External API');
      setLoading(false);
    };
    document.head.appendChild(script);

    return () => {
      if (apiRef.current) {
        try { apiRef.current.dispose(); } catch { /* ignore */ }
        apiRef.current = null;
      }
    };
  }, [domain, initJitsi]);

  return (
    <div className="relative w-full h-full bg-gray-900 rounded-xl overflow-hidden">
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-10">
          <Loader size={36} className="animate-spin text-primary-500 mb-3" />
          <p className="text-gray-300 text-sm">Connecting to live class…</p>
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
};

export default JitsiRoom;
