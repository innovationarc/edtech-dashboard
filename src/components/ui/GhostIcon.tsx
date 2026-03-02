// src/components/ui/GhostIcon.tsx
import React, { useState, useEffect, useRef } from 'react';

interface GhostIconProps {
  size?: number;
  isActive?: boolean;
  eyeOffset?: { x: number; y: number };
}

const GhostIcon: React.FC<GhostIconProps> = ({ size = 72, isActive = false }) => {
  const [pupil, setPupil] = useState({ x: 0, y: 0 });
  const [tilt, setTilt] = useState(0);
  const [drift, setDrift] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prev = useRef({ x: 0, y: 0 });
  const active = useRef(false);

  useEffect(() => {
    const getPos = (e: MouseEvent | TouchEvent) =>
      'touches' in e
        ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
        : { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY };

    const onDown = (e: MouseEvent | TouchEvent) => {
      active.current = true;
      setIsDragging(true);
      prev.current = getPos(e);
    };

    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!active.current) return;
      const pos = getPos(e);
      const dx = pos.x - prev.current.x;
      const dy = pos.y - prev.current.y;
      prev.current = pos;
      const clamp = (v: number, max: number) => Math.max(-max, Math.min(max, v));
      setPupil({ x: clamp(dx * 0.5, 5), y: clamp(dy * 0.5, 4) });
      setTilt(clamp(dx * 1.2, 18));
      setDrift(clamp(dx * 0.4, 8));
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => {
        setPupil({ x: 0, y: 0 });
        setTilt(0);
        setDrift(0);
      }, 150);
    };

    const onUp = () => {
      active.current = false;
      setIsDragging(false);
      if (resetTimer.current) clearTimeout(resetTimer.current);
      setPupil({ x: 0, y: 0 });
      setTilt(0);
      setDrift(0);
    };

    window.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchstart', onDown as EventListener);
    window.addEventListener('touchmove', onMove as EventListener);
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchstart', onDown as EventListener);
      window.removeEventListener('touchmove', onMove as EventListener);
      window.removeEventListener('touchend', onUp);
    };
  }, []);

  const pupilStyle: React.CSSProperties = {
    transition: 'transform 0.08s ease-out',
    transform: `translate(${pupil.x}px, ${pupil.y}px)`,
  };

  const wrapStyle: React.CSSProperties = {
    display: 'inline-block',
    transition: 'transform 0.12s ease-out',
    transform: isDragging
      ? `translateX(${drift}px) rotate(${tilt}deg)`
      : 'translateX(0px) rotate(0deg)',
    transformOrigin: 'center bottom',
  };

  return (
    <div style={wrapStyle}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 160 170"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ overflow: 'visible' }}
      >
        <defs>
          <filter id="g-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="g-eye" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <radialGradient id="g-body" cx="40%" cy="20%" r="78%" fx="40%" fy="20%">
            <stop offset="0%"   stopColor="#ffffff" />
            <stop offset="30%"  stopColor="#ede8ff" />
            <stop offset="65%"  stopColor="#c8b8f5" />
            <stop offset="100%" stopColor="#a48ee0" />
          </radialGradient>
          <radialGradient id="g-aura" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#6d28d9" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#6d28d9" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ground shadow */}
        <ellipse cx="80" cy="164" rx="40" ry="7" fill="url(#g-aura)">
          <animate attributeName="rx"      values="40;50;40"  dur="3.4s" repeatCount="indefinite" calcMode="spline" keySplines="0.5 0 0.5 1;0.5 0 0.5 1" />
          <animate attributeName="opacity" values="0.7;1;0.7" dur="3.4s" repeatCount="indefinite" calcMode="spline" keySplines="0.5 0 0.5 1;0.5 0 0.5 1" />
        </ellipse>

        {/* Body + face — always rendered, float via CSS on wrapper div instead of animateTransform */}
        <g filter="url(#g-glow)">
          <path fill="url(#g-body)"
            d="M 80,12 C 112,12 138,36 138,70 C 138,96 138,118 138,130 C 138,140 128,140 122,140 C 116,140 112,130 106,130 C 100,130 96,152 80,152 C 64,152 60,130 54,130 C 48,130 44,140 38,140 C 32,140 22,140 22,130 C 22,118 22,96 22,70 C 22,36 48,12 80,12 Z"
          >
            {/* Hem wobble — always on, CSS tilt handles drag feel */}
            <animate
              attributeName="d"
              dur="2.4s"
              repeatCount="indefinite"
              calcMode="spline"
              keySplines="0.5 0 0.5 1; 0.5 0 0.5 1; 0.5 0 0.5 1"
              values="
                M 80,12 C 112,12 138,36 138,70 C 138,96 138,118 138,130 C 138,140 128,140 122,140 C 116,140 112,130 106,130 C 100,130 96,152 80,152 C 64,152 60,130 54,130 C 48,130 44,140 38,140 C 32,140 22,140 22,130 C 22,118 22,96 22,70 C 22,36 48,12 80,12 Z;
                M 80,12 C 112,12 138,36 138,70 C 138,96 138,118 138,130 C 138,140 128,140 122,140 C 116,140 112,128 106,128 C 100,128 96,156 80,156 C 64,156 60,128 54,128 C 48,128 44,140 38,140 C 32,140 22,140 22,130 C 22,118 22,96 22,70 C 22,36 48,12 80,12 Z;
                M 80,12 C 112,12 138,36 138,70 C 138,96 138,118 138,130 C 138,140 128,140 122,140 C 116,140 112,132 106,132 C 100,132 96,150 80,150 C 64,150 60,132 54,132 C 48,132 44,140 38,140 C 32,140 22,140 22,130 C 22,118 22,96 22,70 C 22,36 48,12 80,12 Z;
                M 80,12 C 112,12 138,36 138,70 C 138,96 138,118 138,130 C 138,140 128,140 122,140 C 116,140 112,130 106,130 C 100,130 96,152 80,152 C 64,152 60,130 54,130 C 48,130 44,140 38,140 C 32,140 22,140 22,130 C 22,118 22,96 22,70 C 22,36 48,12 80,12 Z
              "
            />
          </path>

          {/* Left eye */}
          <ellipse cx="60" cy="72" rx="11.5" ry={isActive ? 14 : 12} fill="#1c0b30" filter="url(#g-eye)">
            {!isActive && (
              <animate attributeName="ry" values="12;1.2;12" dur="5s" begin="2s" repeatCount="indefinite"
                calcMode="spline" keySplines="0.5 0 0.5 1;0.5 0 0.5 1" />
            )}
          </ellipse>
          <ellipse cx="64" cy="66" rx="3" ry="4" fill="white" opacity="0.55" style={pupilStyle} />

          {/* Right eye */}
          <ellipse cx="100" cy="72" rx="11.5" ry={isActive ? 14 : 12} fill="#1c0b30" filter="url(#g-eye)">
            {!isActive && (
              <animate attributeName="ry" values="12;1.2;12" dur="5s" begin="2s" repeatCount="indefinite"
                calcMode="spline" keySplines="0.5 0 0.5 1;0.5 0 0.5 1" />
            )}
          </ellipse>
          <ellipse cx="104" cy="66" rx="3" ry="4" fill="white" opacity="0.55" style={pupilStyle} />

          {/* Mouth */}
          {isDragging ? (
            <ellipse cx="80" cy="106" rx="6" ry="6" fill="#1c0b30" opacity="0.9" />
          ) : isActive ? (
            <>
              <ellipse cx="80" cy="104" rx="9"   ry="11"  fill="#1c0b30" opacity="0.92" />
              <ellipse cx="80" cy="106" rx="6.5" ry="7.5" fill="#3a1070" opacity="0.5"  />
            </>
          ) : (
            <path d="M67,102 Q80,116 93,102" stroke="#1c0b30" strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.82" />
          )}
        </g>
      </svg>
    </div>
  );
};

export default GhostIcon;
