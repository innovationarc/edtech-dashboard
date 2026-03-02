// src/components/ui/GhostIconTest.tsx
// TEMPORARY TEST COMPONENT — delete after verification
import React, { useState, useEffect, useRef } from 'react';

const GhostIconTest: React.FC = () => {
  const [pupil, setPupil] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
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
      setDragging(true);
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

      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setPupil({ x: 0, y: 0 }), 120);
    };

    const onUp = () => {
      active.current = false;
      setDragging(false);
      if (resetTimer.current) clearTimeout(resetTimer.current);
      setPupil({ x: 0, y: 0 });
    };

    window.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchstart', onDown as any);
    window.addEventListener('touchmove', onMove as any);
    window.addEventListener('touchend', onUp);

    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchstart', onDown as any);
      window.removeEventListener('touchmove', onMove as any);
      window.removeEventListener('touchend', onUp);
    };
  }, []);

  return (
    <div style={{ textAlign: 'center' }}>
      {/* Big obvious state label */}
      <div style={{
        background: dragging ? '#22c55e' : '#ef4444',
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
        padding: '2px 8px',
        borderRadius: 4,
        marginBottom: 4,
      }}>
        {dragging ? '👁 DRAGGING' : '😴 IDLE'}
      </div>

      {/* Raw pupil values */}
      <div style={{ color: '#a78bfa', fontSize: 11, marginBottom: 4 }}>
        x:{pupil.x.toFixed(1)} y:{pupil.y.toFixed(1)}
      </div>

      {/* Ghost face — pupils are BIG RED DOTS so movement is unmistakable */}
      <svg width={80} height={90} viewBox="0 0 160 170" fill="none" style={{ overflow: 'visible' }}>
        {/* Body */}
        <path fill="#c8b8f5" d="M 80,12 C 112,12 138,36 138,70 C 138,96 138,118 138,130 C 138,140 128,140 122,140 C 116,140 112,130 106,130 C 100,130 96,152 80,152 C 64,152 60,130 54,130 C 48,130 44,140 38,140 C 32,140 22,140 22,130 C 22,118 22,96 22,70 C 22,36 48,12 80,12 Z" />

        {/* Left eye socket */}
        <ellipse cx="60" cy="72" rx="16" ry="16" fill="white" />
        {/* Left pupil — BIG RED DOT */}
        <ellipse
          cx="60" cy="72" rx="8" ry="8"
          fill={dragging ? '#ef4444' : '#1c0b30'}
          style={{ transition: 'transform 0.08s ease-out', transform: `translate(${pupil.x * 2}px, ${pupil.y * 2}px)` }}
        />

        {/* Right eye socket */}
        <ellipse cx="100" cy="72" rx="16" ry="16" fill="white" />
        {/* Right pupil — BIG RED DOT */}
        <ellipse
          cx="100" cy="72" rx="8" ry="8"
          fill={dragging ? '#ef4444' : '#1c0b30'}
          style={{ transition: 'transform 0.08s ease-out', transform: `translate(${pupil.x * 2}px, ${pupil.y * 2}px)` }}
        />

        {/* Mouth */}
        <path d="M67,102 Q80,116 93,102" stroke="#1c0b30" strokeWidth="5" strokeLinecap="round" fill="none" />
      </svg>
    </div>
  );
};

export default GhostIconTest;
