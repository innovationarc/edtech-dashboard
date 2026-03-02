// src/components/ui/GhostIcon.tsx
import React, { useEffect, useRef } from 'react';

interface GhostIconProps {
  size?: number;
  isActive?: boolean;
  eyeOffset?: { x: number; y: number };
}

const GhostIcon: React.FC<GhostIconProps> = ({ size = 72, isActive = false }) => {
  const wrapRef       = useRef<HTMLDivElement>(null);
  const leftPupilRef  = useRef<SVGEllipseElement>(null);
  const rightPupilRef = useRef<SVGEllipseElement>(null);
  const leftEyeRef    = useRef<SVGEllipseElement>(null);
  const rightEyeRef   = useRef<SVGEllipseElement>(null);
  const mouthSmileRef = useRef<SVGPathElement>(null);
  const mouthORef     = useRef<SVGEllipseElement>(null);

  const isDragging    = useRef(false); // single source of truth
  const prev          = useRef({ x: 0, y: 0 });
  const pupilY        = useRef(0);     // track vertical separately
  const targetTilt    = useRef(0);
  const currentTilt   = useRef(0);
  const rafId         = useRef(0);
  const resetTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blinkTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clamp = (v: number, max: number) => Math.max(-max, Math.min(max, v));
    const lerp  = (a: number, b: number, t: number) => a + (b - a) * t;

    const setEyeRy = (ry: number) => {
      leftEyeRef.current?.setAttribute('ry',  String(ry));
      rightEyeRef.current?.setAttribute('ry', String(ry));
    };

    const setPupils = (px: number, py: number) => {
      const t = `translate(${px}px,${py}px)`;
      if (leftPupilRef.current)  leftPupilRef.current.style.transform  = t;
      if (rightPupilRef.current) rightPupilRef.current.style.transform = t;
    };

    const setMouth = (drag: boolean) => {
      if (mouthSmileRef.current) mouthSmileRef.current.style.display = drag || isActive ? 'none' : '';
      if (mouthORef.current)     mouthORef.current.style.display     = drag ? '' : 'none';
    };

    // ── JS blink — checks isDragging ref on EVERY frame so it stops instantly ──
    const scheduleBlink = () => {
      if (blinkTimer.current) clearTimeout(blinkTimer.current);
      blinkTimer.current = setTimeout(() => {
        // Abort immediately if dragging
        if (isDragging.current) { scheduleBlink(); return; }

        const duration = 160;
        const start = performance.now();

        const animFrame = (now: number) => {
          // Stop mid-blink the moment drag starts
          if (isDragging.current) {
            setEyeRy(12);
            scheduleBlink();
            return;
          }
          const t = Math.min((now - start) / duration, 1);
          const ry = t < 0.5 ? lerp(12, 1, t * 2) : lerp(1, 12, (t - 0.5) * 2);
          setEyeRy(ry);
          if (t < 1) {
            requestAnimationFrame(animFrame);
          } else {
            scheduleBlink(); // next blink
          }
        };
        requestAnimationFrame(animFrame);
      }, 2500 + Math.random() * 2000);
    };

    scheduleBlink();

    // ── Main rAF: tilt lerp + pupil sync ──
    const tick = () => {
      currentTilt.current = lerp(currentTilt.current, targetTilt.current, 0.28);
      if (wrapRef.current) {
        wrapRef.current.style.transform = `rotate(${currentTilt.current}deg)`;
      }
      if (isDragging.current) {
        const px = clamp(currentTilt.current * 0.22, 6);
        setPupils(px, pupilY.current);
      }
      rafId.current = requestAnimationFrame(tick);
    };
    rafId.current = requestAnimationFrame(tick);

    // ── Drag events ──
    const getPos = (e: MouseEvent | TouchEvent) =>
      'touches' in e
        ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
        : { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY };

    const onDown = (e: MouseEvent | TouchEvent) => {
      isDragging.current = true;
      pupilY.current = 0;
      prev.current = getPos(e);
      setEyeRy(13); // wide open
      setMouth(true);
    };

    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging.current) return;
      const pos = getPos(e);
      const dx = pos.x - prev.current.x;
      const dy = pos.y - prev.current.y;
      prev.current = pos;

      targetTilt.current = clamp(targetTilt.current + dx * 2.8, 30);
      // Vertical pupil tracked separately, accumulated with decay
      pupilY.current = clamp(pupilY.current + dy * 0.7, 4);

      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => {
        targetTilt.current = 0;
        pupilY.current = 0;
      }, 120);
    };

    const onUp = () => {
      isDragging.current = false;
      if (resetTimer.current) clearTimeout(resetTimer.current);
      targetTilt.current = 0;
      pupilY.current = 0;
      setPupils(0, 0);
      setMouth(false);
      setEyeRy(12);
      scheduleBlink();
    };

    window.addEventListener('mousedown',  onDown);
    window.addEventListener('mousemove',  onMove);
    window.addEventListener('mouseup',    onUp);
    window.addEventListener('touchstart', onDown as EventListener);
    window.addEventListener('touchmove',  onMove as EventListener);
    window.addEventListener('touchend',   onUp);

    return () => {
      cancelAnimationFrame(rafId.current);
      if (blinkTimer.current) clearTimeout(blinkTimer.current);
      if (resetTimer.current) clearTimeout(resetTimer.current);
      window.removeEventListener('mousedown',  onDown);
      window.removeEventListener('mousemove',  onMove);
      window.removeEventListener('mouseup',    onUp);
      window.removeEventListener('touchstart', onDown as EventListener);
      window.removeEventListener('touchmove',  onMove as EventListener);
      window.removeEventListener('touchend',   onUp);
    };
  }, [isActive]);

  return (
    <div ref={wrapRef} style={{ display: 'inline-block', transformOrigin: 'center bottom', willChange: 'transform' }}>
      <svg width={size} height={size} viewBox="0 0 160 170" fill="none"
        xmlns="http://www.w3.org/2000/svg" style={{ overflow: 'visible' }}>
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
            <stop offset="100%" stopColor="#6d28d9" stopOpacity="0"   />
          </radialGradient>
        </defs>

        <ellipse cx="80" cy="164" rx="40" ry="7" fill="url(#g-aura)">
          <animate attributeName="rx"      values="40;50;40"  dur="2s" repeatCount="indefinite" calcMode="spline" keySplines="0.5 0 0.5 1;0.5 0 0.5 1" />
          <animate attributeName="opacity" values="0.7;1;0.7" dur="2s" repeatCount="indefinite" calcMode="spline" keySplines="0.5 0 0.5 1;0.5 0 0.5 1" />
        </ellipse>

        <g filter="url(#g-glow)">
          <animateTransform attributeName="transform" type="translate"
            values="0,0; 0,-14; 0,0" dur="2s" repeatCount="indefinite"
            calcMode="spline" keySplines="0.45 0.05 0.55 0.95;0.45 0.05 0.55 0.95" />

          <path fill="url(#g-body)">
            <animate attributeName="d" dur="1.8s" repeatCount="indefinite" calcMode="spline"
              keySplines="0.5 0 0.5 1; 0.5 0 0.5 1; 0.5 0 0.5 1"
              values="
                M 80,12 C 112,12 138,36 138,70 C 138,96 138,118 138,130 C 138,140 128,140 122,140 C 116,140 112,130 106,130 C 100,130 96,152 80,152 C 64,152 60,130 54,130 C 48,130 44,140 38,140 C 32,140 22,140 22,130 C 22,118 22,96 22,70 C 22,36 48,12 80,12 Z;
                M 80,12 C 112,12 138,36 138,70 C 138,96 138,118 138,130 C 138,140 128,140 122,140 C 116,140 112,128 106,128 C 100,128 96,156 80,156 C 64,156 60,128 54,128 C 48,128 44,140 38,140 C 32,140 22,140 22,130 C 22,118 22,96 22,70 C 22,36 48,12 80,12 Z;
                M 80,12 C 112,12 138,36 138,70 C 138,96 138,118 138,130 C 138,140 128,140 122,140 C 116,140 112,132 106,132 C 100,132 96,150 80,150 C 64,150 60,132 54,132 C 48,132 44,140 38,140 C 32,140 22,140 22,130 C 22,118 22,96 22,70 C 22,36 48,12 80,12 Z;
                M 80,12 C 112,12 138,36 138,70 C 138,96 138,118 138,130 C 138,140 128,140 122,140 C 116,140 112,130 106,130 C 100,130 96,152 80,152 C 64,152 60,130 54,130 C 48,130 44,140 38,140 C 32,140 22,140 22,130 C 22,118 22,96 22,70 C 22,36 48,12 80,12 Z"
            />
          </path>

          {/* Eyes — ry fully JS controlled, no SVG animate */}
          <ellipse ref={leftEyeRef}    cx="60"  cy="72" rx="11.5" ry="12" fill="#1c0b30" filter="url(#g-eye)" />
          <ellipse ref={leftPupilRef}  cx="64"  cy="66" rx="3" ry="4" fill="white" opacity="0.55" style={{ willChange: 'transform' }} />
          <ellipse ref={rightEyeRef}   cx="100" cy="72" rx="11.5" ry="12" fill="#1c0b30" filter="url(#g-eye)" />
          <ellipse ref={rightPupilRef} cx="104" cy="66" rx="3" ry="4" fill="white" opacity="0.55" style={{ willChange: 'transform' }} />

          {/* Smile */}
          <path ref={mouthSmileRef} d="M67,102 Q80,116 93,102" stroke="#1c0b30" strokeWidth="5"
            strokeLinecap="round" fill="none" opacity="0.82"
            style={{ display: isActive ? 'none' : '' }} />
          {/* Open (chat active) */}
          {isActive && (
            <>
              <ellipse cx="80" cy="104" rx="9"   ry="11"  fill="#1c0b30" opacity="0.92" />
              <ellipse cx="80" cy="106" rx="6.5" ry="7.5" fill="#3a1070" opacity="0.5"  />
            </>
          )}
          {/* Surprised O (drag) */}
          <ellipse ref={mouthORef} cx="80" cy="106" rx="5" ry="5"
            fill="#1c0b30" opacity="0.9" style={{ display: 'none' }} />
        </g>
      </svg>
    </div>
  );
};

export default GhostIcon;
