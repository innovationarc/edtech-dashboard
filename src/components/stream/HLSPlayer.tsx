// src/components/stream/HLSPlayer.tsx
import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Loader, AlertCircle, RefreshCw } from 'lucide-react';

interface HLSPlayerProps {
  src: string;
  poster?: string;
  autoPlay?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onError?: () => void;
  onReady?: () => void;
}

const HLSPlayer: React.FC<HLSPlayerProps> = ({
  src, poster, autoPlay = true, className, style, onError, onReady,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  const cleanup = () => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  };

  const init = () => {
    const video = videoRef.current;
    if (!video || !src) return;
    cleanup();
    setStatus('loading');
    setErrorMsg('');

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 10,
      });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setStatus('ready');
        onReady?.();
        if (autoPlay) video.play().catch(() => {});
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              // Try to recover from network errors
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              setStatus('error');
              setErrorMsg('Stream unavailable. It may not have started yet, or has ended.');
              onError?.();
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      video.src = src;
      const onLoad = () => {
        setStatus('ready');
        onReady?.();
        if (autoPlay) video.play().catch(() => {});
      };
      const onErr = () => {
        setStatus('error');
        setErrorMsg('Stream unavailable.');
        onError?.();
      };
      video.addEventListener('loadedmetadata', onLoad, { once: true });
      video.addEventListener('error', onErr, { once: true });
    } else {
      setStatus('error');
      setErrorMsg('Your browser does not support HLS streams. Please use Chrome, Firefox, or Edge.');
    }
  };

  useEffect(() => {
    init();
    return cleanup;
  }, [src]);

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        background: '#000',
        borderRadius: 12,
        overflow: 'hidden',
        aspectRatio: '16/9',
        ...style,
      }}
    >
      <video
        ref={videoRef}
        poster={poster}
        controls
        playsInline
        style={{
          width: '100%',
          height: '100%',
          display: status === 'error' ? 'none' : 'block',
          objectFit: 'contain',
        }}
      />

      {status === 'loading' && (
        <div
          style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 12, background: 'rgba(0,0,0,0.6)',
          }}
        >
          <Loader size={32} style={{ color: '#6366f1', animation: 'spin 1s linear infinite' }} />
          <p style={{ color: '#d1d5db', fontSize: 13 }}>Connecting to stream…</p>
        </div>
      )}

      {status === 'error' && (
        <div
          style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 16, background: '#111827',
          }}
        >
          <AlertCircle size={40} style={{ color: '#ef4444' }} />
          <p style={{ color: '#d1d5db', fontSize: 13, textAlign: 'center', padding: '0 24px', lineHeight: 1.5 }}>
            {errorMsg}
          </p>
          <button
            onClick={init}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: '#374151', border: 'none', borderRadius: 10,
              color: '#fff', fontSize: 13, fontWeight: 600, padding: '8px 18px',
              cursor: 'pointer', fontFamily: "'Outfit', sans-serif",
            }}
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default HLSPlayer;
