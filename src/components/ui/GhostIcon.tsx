// src/components/ui/GhostIcon.tsx
import React, { useEffect, useRef } from 'react';

interface GhostIconProps {
  size?: number;
  isActive?: boolean;
  eyeOffset?: { x: number; y: number };
}

const GhostIcon: React.FC<GhostIconProps> = ({ size = 72, isActive = false }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const leftPupilRef = useRef<SVGEllipseElement>(null);
  const rightPupilRef = useRef<SVGEllipseElement>(null);
  const mouthRef = useRef<SVGPathElement>(null);
  const mouthORef = useRef<SVGEllipseElement>(null);
  const leftEyeRef = useRef<SVGEllipseElement>(null);
  const rightEyeRef = useRef<SVGEllipseElement>(null);

  const prev = useRef({ x: 0, y: 0 });
  const active = useRef(false);
  const tilt = useRef(0);
  const rafId = useRef(0);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clamp = (v: number, max: number) => Math.max(-max, Math.min(max, v));
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    let targetTilt = 0;
    let dragging = false;

    const applyPupil = (px: number, py: number) => {
      const t = `translate(${px}px, ${py}px)`;
      if (leftPupilRef.current)  leftPupilRef.current.style.transform  = t;
      if (rightPupilRef.current) rightPupilRef.current.style.transform = t;
    };

    const setMouth = (state: 'drag' | 'idle') => {
      if (mouthRef.current)  mouthRef.current.style.display  = state === 'idle' && !isActive ? '' : 'none';
      if (mouthORef.current) mouthORef.current.style.display = state === 'drag' ? '' : 'none';
    };

    const setEyeWide = (wide: boolean) => {
      const ry = wide ? '14' : '12';
      if (leftEyeRef.current)  leftEyeRef.current.setAttribute('ry', ry);
      if (rightEyeRef.current) rightEyeRef.current.setAttribute('ry', ry);
    };

    const tick = () => {
      tilt.current = lerp(tilt.current, targetTilt, 0.25);
      if (wrapRef.current) {
        wrapRef.current.style.transform = `rotate(${tilt.current}deg)`;
      }
      rafId.current = requestAnimationFrame(tick);
    };
    rafId.current = requestAnimationFrame(tick);

    const getPos = (e: MouseEvent | TouchEvent) =>
      'touches' in e
        ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
        : { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY };

    const onDown = (e: MouseEvent | TouchEvent) => {
      active.current = true;
      dragging = true;
      prev.current = getPos(e);
      setMouth('drag');
      setEyeWide(true);
    };

    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!active.current) return;
      const pos = getPos(e);
      const dx = pos.x - prev.current.x;
      const dy = pos.y - prev.current.y;
      prev.current = pos;

      // Direct pupil update — no setState
      applyPupil(clamp(dx * 1.2, 7), clamp(dy * 0.9, 5));

      // Target tilt — lerp loop applies smoothly
      targetTilt = clamp(dx * 3.5, 30);

      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => {
        applyPupil(0, 0);
        targetTilt = 0;
      }, 100);
    };

    const onUp = () => {
      active.current = false;
      dragging = false;
      if (resetTimer.current) clearTimeout(resetTimer.current);
      applyPupil(0, 0);
      targetTilt = 0;
      setMouth('idle');
      setEyeWide(isActive);
    };

    window.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchstart', onDown as EventListener);
    window.addEventListener('touchmove', onMove as EventListener);
    window.addEventListener('touchend', onUp);

    return () => {
      cancelAnimationFrame(rafId.current);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchstart', onDown as EventListener);
      window.removeEventListener('touchmove', onMove as EventListener);
      window.removeEventListener('touchend', onUp);
    };
  }, [isActive]);

  return (
    <div
      ref={wrapRef}
      style={{ display: 'inline-block', transformOrigin: 'center bottom', willChange: 'transform' }}
    >
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
          <animate attributeName="rx"      values="40;50;40"  dur="2s" repeatCount="indefinite" calcMode="spline" keySplines="0.5 0 0.5 1;0.5 0 0.5 1" />
          <animate attributeName="opacity" values="0.7;1;0.7" dur="2s" repeatCount="indefinite" calcMode="spline" keySplines="0.5 0 0.5 1;0.5 0 0.5 1" />
        </ellipse>

        <g filter="url(#g-glow)">
          <animateTransform
            attributeName="transform" type="translate"
            values="0,0; 0,-14; 0,0"
            dur="2s" repeatCount="indefinite"
            calcMode="spline"
            keySplines="0.45 0.05 0.55 0.95;0.45 0.05 0.55 0.95"
          />

          <path fill="url(#g-body)">
            <animate
              attributeName="d"
              dur="1.8s"
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
          <ellipse ref={leftEyeRef} cx="60" cy="72" rx="11.5" ry={isActive ? 14 : 12} fill="#1c0b30" filter="url(#g-eye)">
            {!isActive && (
              <animate attributeName="ry" values="12;1.2;12" dur="5s" begin="2s" repeatCount="indefinite"
                calcMode="spline" keySplines="0.5 0 0.5 1;0.5 0 0.5 1" />
            )}
          </ellipse>
          <ellipse ref={leftPupilRef} cx="64" cy="66" rx="3" ry="4" fill="white" opacity="0.55"
            style={{ willChange: 'transform' }} />

          {/* Right eye */}
          <ellipse ref={rightEyeRef} cx="100" cy="72" rx="11.5" ry={isActive ? 14 : 12} fill="#1c0b30" filter="url(#g-eye)">
            {!isActive && (
              <animate attributeName="ry" values="12;1.2;12" dur="5s" begin="2s" repeatCount="indefinite"
                calcMode="spline" keySplines="0.5 0 0.5 1;0.5 0 0.5 1" />
            )}
          </ellipse>
          <ellipse ref={rightPupilRef} cx="104" cy="66" rx="3" ry="4" fill="white" opacity="0.55"
            style={{ willChange: 'transform' }} />

          {/* Mouth — smile (idle/default) */}
          <path ref={mouthRef}
            d="M67,102 Q80,116 93,102"
            stroke="#1c0b30" strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.82"
            style={{ display: isActive ? 'none' : '' }}
          />
          {/* Mouth — open (chat active) */}
          {isActive && (
            <>
              <ellipse cx="80" cy="104" rx="9"   ry="11"  fill="#1c0b30" opacity="0.92" />
              <ellipse cx="80" cy="106" rx="6.5" ry="7.5" fill="#3a1070" opacity="0.5"  />
            </>
          )}
          {/* Mouth — surprised O (drag) */}
          <ellipse ref={mouthORef} cx="80" cy="106" rx="5" ry="5" fill="#1c0b30" opacity="0.9"
            style={{ display: 'none' }} />
        </g>
      </svg>
    </div>
  );
};

export default GhostIcon;
