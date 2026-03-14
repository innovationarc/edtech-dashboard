// src/components/stream/CloudflareWebRTCStream.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Video, VideoOff, Mic, MicOff, Square, Loader, AlertCircle, Radio } from 'lucide-react';

interface CloudflareWebRTCStreamProps {
  whipEndpoint: string;
  onStreamStart?: () => void;
  onStreamStop?: () => void;
}

type Status = 'idle' | 'requesting' | 'starting' | 'live' | 'error';

const CloudflareWebRTCStream: React.FC<CloudflareWebRTCStreamProps> = ({
  whipEndpoint, onStreamStart, onStreamStop,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);

  const stop = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus('idle');
    setCamOn(true);
    setMicOn(true);
    onStreamStop?.();
  };

  const start = async () => {
    setStatus('requesting');
    setError('');
    try {
      // Request camera + mic
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true; // prevent echo
      }
      setStatus('starting');

      // Build peer connection
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }],
        bundlePolicy: 'max-bundle',
      });
      pcRef.current = pc;

      // Add tracks
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering (max 5s)
      await new Promise<void>(resolve => {
        if (pc.iceGatheringState === 'complete') return resolve();
        const check = () => {
          if (pc.iceGatheringState === 'complete') {
            pc.removeEventListener('icegatheringstatechange', check);
            resolve();
          }
        };
        pc.addEventListener('icegatheringstatechange', check);
        setTimeout(resolve, 5000);
      });

      // WHIP negotiation
      const res = await fetch(whipEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp' },
        body: pc.localDescription?.sdp ?? offer.sdp,
      });

      if (!res.ok) {
        throw new Error(`WHIP endpoint returned ${res.status}. Verify your Cloudflare settings and WHIP endpoint URL.`);
      }

      const answerSdp = await res.text();
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: answerSdp }));

      setStatus('live');
      onStreamStart?.();
    } catch (e: any) {
      const msg = e.name === 'NotAllowedError'
        ? 'Camera/microphone access denied. Please allow permissions and try again.'
        : e.name === 'NotFoundError'
        ? 'No camera or microphone found.'
        : e.message ?? 'Failed to start browser stream.';
      setError(msg);
      stop();
      setStatus('error');
    }
  };

  const toggleCam = () => {
    streamRef.current?.getVideoTracks().forEach(t => { t.enabled = !camOn; });
    setCamOn(v => !v);
  };

  const toggleMic = () => {
    streamRef.current?.getAudioTracks().forEach(t => { t.enabled = !micOn; });
    setMicOn(v => !v);
  };

  // Cleanup on unmount
  useEffect(() => () => { stop(); }, []);

  const isActive = status === 'live';
  const isLoading = status === 'requesting' || status === 'starting';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Preview */}
      <div
        style={{
          position: 'relative', background: '#000', borderRadius: 12,
          overflow: 'hidden', aspectRatio: '16/9',
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />

        {/* LIVE badge */}
        {isActive && (
          <div
            style={{
              position: 'absolute', top: 12, left: 12,
              display: 'flex', alignItems: 'center', gap: 6,
              background: '#dc2626', borderRadius: 999, padding: '5px 12px',
            }}
          >
            <span
              style={{
                width: 7, height: 7, background: '#fff', borderRadius: '50%',
                animation: 'pulse 1.2s ease-in-out infinite',
              }}
            />
            <span style={{ color: '#fff', fontSize: 11, fontWeight: 800, letterSpacing: '0.06em' }}>LIVE</span>
          </div>
        )}

        {/* Cam off overlay */}
        {isActive && !camOn && (
          <div
            style={{
              position: 'absolute', inset: 0, background: '#1f2937',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <VideoOff size={36} style={{ color: '#4b5563' }} />
            <p style={{ color: '#6b7280', fontSize: 12 }}>Camera is off</p>
          </div>
        )}

        {/* Idle placeholder */}
        {!streamRef.current && !isLoading && (
          <div
            style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 8, color: '#4b5563',
            }}
          >
            <Video size={40} />
            <p style={{ fontSize: 12 }}>Camera preview appears here</p>
          </div>
        )}

        {/* Loading overlay */}
        {isLoading && (
          <div
            style={{
              position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}
          >
            <Loader size={30} style={{ color: '#6366f1', animation: 'spin 1s linear infinite' }} />
            <p style={{ color: '#d1d5db', fontSize: 13 }}>
              {status === 'requesting' ? 'Requesting camera access…' : 'Connecting to Cloudflare…'}
            </p>
          </div>
        )}
      </div>

      {/* Error */}
      {status === 'error' && error && (
        <div
          style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            padding: '12px 14px', borderRadius: 10,
            background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.28)',
          }}
        >
          <AlertCircle size={16} style={{ color: '#f87171', flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 12, color: '#f87171', lineHeight: 1.5 }}>{error}</span>
        </div>
      )}

      {/* Controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {!isActive ? (
          <button
            onClick={start}
            disabled={isLoading}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 20px', borderRadius: 10, border: 'none',
              background: isLoading ? '#6b7280' : '#dc2626',
              color: '#fff', fontSize: 13, fontWeight: 700,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontFamily: "'Outfit', sans-serif",
              opacity: isLoading ? 0.75 : 1,
              transition: 'all 0.15s',
            }}
          >
            {isLoading ? <Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Radio size={15} />}
            {isLoading ? (status === 'requesting' ? 'Requesting Access…' : 'Connecting…') : 'Go Live (Browser)'}
          </button>
        ) : (
          <>
            <button
              onClick={toggleCam}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 10, border: 'none',
                background: camOn ? '#374151' : 'rgba(239,68,68,0.18)',
                color: camOn ? '#d1d5db' : '#f87171', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', fontFamily: "'Outfit', sans-serif", transition: 'all 0.15s',
              }}
            >
              {camOn ? <Video size={14} /> : <VideoOff size={14} />}
              {camOn ? 'Camera' : 'Cam Off'}
            </button>

            <button
              onClick={toggleMic}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 10, border: 'none',
                background: micOn ? '#374151' : 'rgba(239,68,68,0.18)',
                color: micOn ? '#d1d5db' : '#f87171', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', fontFamily: "'Outfit', sans-serif", transition: 'all 0.15s',
              }}
            >
              {micOn ? <Mic size={14} /> : <MicOff size={14} />}
              {micOn ? 'Mic' : 'Mic Off'}
            </button>

            <button
              onClick={stop}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 10, border: 'none',
                background: '#374151', color: '#d1d5db', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', fontFamily: "'Outfit', sans-serif",
                marginLeft: 'auto', transition: 'all 0.15s',
              }}
            >
              <Square size={13} /> Stop Stream
            </button>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
      `}</style>
    </div>
  );
};

export default CloudflareWebRTCStream;
