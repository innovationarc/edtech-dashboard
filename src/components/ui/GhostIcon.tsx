// src/components/ui/GhostIcon.tsx
import React from 'react';

interface GhostIconProps {
  size?: number;
  isActive?: boolean;
  eyeOffset?: { x: number; y: number }; // drag direction offset for pupils
}

const GhostIcon: React.FC<GhostIconProps> = ({ size = 72, isActive = false, eyeOffset = { x: 0, y: 0 } }) => {
  // Clamp eye offset so pupils stay within the eye whites
  const clamp = (v: number, max: number) => Math.max(-max, Math.min(max, v));
  const ex = clamp(eyeOffset.x, 4);
  const ey = clamp(eyeOffset.y, 3);

  return (
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
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="g-eye" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
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

      {/* Ground shadow */}
      <ellipse cx="80" cy="164" rx="40" ry="7" fill="url(#g-aura)">
        <animate attributeName="rx"      values="40;50;40"  dur="3.4s" repeatCount="indefinite" calcMode="spline" keySplines="0.5 0 0.5 1;0.5 0 0.5 1" />
        <animate attributeName="opacity" values="0.7;1;0.7" dur="3.4s" repeatCount="indefinite" calcMode="spline" keySplines="0.5 0 0.5 1;0.5 0 0.5 1" />
      </ellipse>

      <g filter="url(#g-glow)">
        <animateTransform
          attributeName="transform" type="translate"
          values="0,0; 0,-12; 0,0"
          dur="3.4s" repeatCount="indefinite"
          calcMode="spline"
          keySplines="0.45 0.05 0.55 0.95;0.45 0.05 0.55 0.95"
        />

        <path fill="url(#g-body)">
          <animate
            attributeName="d"
            dur="2.4s"
            repeatCount="indefinite"
            calcMode="spline"
            keySplines="0.5 0 0.5 1; 0.5 0 0.5 1; 0.5 0 0.5 1"
            values="
              M 80,12
              C 112,12 138,36 138,70
              C 138,96 138,118 138,130
              C 138,140 128,140 122,140
              C 116,140 112,130 106,130
              C 100,130 96,152 80,152
              C 64,152 60,130 54,130
              C 48,130 44,140 38,140
              C 32,140 22,140 22,130
              C 22,118 22,96 22,70
              C 22,36 48,12 80,12 Z;

              M 80,12
              C 112,12 138,36 138,70
              C 138,96 138,118 138,130
              C 138,140 128,140 122,140
              C 116,140 112,128 106,128
              C 100,128 96,156 80,156
              C 64,156 60,128 54,128
              C 48,128 44,140 38,140
              C 32,140 22,140 22,130
              C 22,118 22,96 22,70
              C 22,36 48,12 80,12 Z;

              M 80,12
              C 112,12 138,36 138,70
              C 138,96 138,118 138,130
              C 138,140 128,140 122,140
              C 116,140 112,132 106,132
              C 100,132 96,150 80,150
              C 64,150 60,132 54,132
              C 48,132 44,140 38,140
              C 32,140 22,140 22,130
              C 22,118 22,96 22,70
              C 22,36 48,12 80,12 Z;

              M 80,12
              C 112,12 138,36 138,70
              C 138,96 138,118 138,130
              C 138,140 128,140 122,140
              C 116,140 112,130 106,130
              C 100,130 96,152 80,152
              C 64,152 60,130 54,130
              C 48,130 44,140 38,140
              C 32,140 22,140 22,130
              C 22,118 22,96 22,70
              C 22,36 48,12 80,12 Z
            "
          />
        </path>

        {/* Left eye white */}
        <ellipse cx="60" cy="72" rx="11.5" ry={isActive ? 14 : 12} fill="#1c0b30" filter="url(#g-eye)">
          {!isActive && (
            <animate attributeName="ry" values="12;1.2;12" dur="5s" begin="2s" repeatCount="indefinite"
              calcMode="spline" keySplines="0.5 0 0.5 1;0.5 0 0.5 1" />
          )}
        </ellipse>
        {/* Left eye pupil highlight — moves with drag */}
        <ellipse
          cx={64 + ex}
          cy={66 + ey}
          rx="3" ry="4"
          fill="white" opacity="0.55"
          style={{ transition: 'cx 0.15s ease, cy 0.15s ease' }}
        />

        {/* Right eye white */}
        <ellipse cx="100" cy="72" rx="11.5" ry={isActive ? 14 : 12} fill="#1c0b30" filter="url(#g-eye)">
          {!isActive && (
            <animate attributeName="ry" values="12;1.2;12" dur="5s" begin="2s" repeatCount="indefinite"
              calcMode="spline" keySplines="0.5 0 0.5 1;0.5 0 0.5 1" />
          )}
        </ellipse>
        {/* Right eye pupil highlight — moves with drag */}
        <ellipse
          cx={104 + ex}
          cy={66 + ey}
          rx="3" ry="4"
          fill="white" opacity="0.55"
          style={{ transition: 'cx 0.15s ease, cy 0.15s ease' }}
        />

        {/* Mouth */}
        {isActive ? (
          <>
            <ellipse cx="80" cy="104" rx="9"   ry="11"  fill="#1c0b30" opacity="0.92" />
            <ellipse cx="80" cy="106" rx="6.5" ry="7.5" fill="#3a1070" opacity="0.5"  />
          </>
        ) : (
          <path d="M67,102 Q80,116 93,102" stroke="#1c0b30" strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.82" />
        )}
      </g>
    </svg>
  );
};

export default GhostIcon;
