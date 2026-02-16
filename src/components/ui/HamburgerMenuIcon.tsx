// src/components/ui/HamburgerMenuIcon.tsx
// 1000% IDENTICAL to p1.html - Line-by-line CSS conversion
import React from 'react';

interface HamburgerMenuIconProps {
  state: 'closed' | 'opening' | 'open' | 'closing';
  size?: number;
  className?: string;
}

const HamburgerMenuIcon: React.FC<HamburgerMenuIconProps> = ({ 
  state, 
  size = 44, // HTML line 61: width: 44px
  className = ''
}) => {
  const isActive = state === 'open' || state === 'opening';

  // HTML lines 7-14: CSS variables from :root
  const PRIMARY = '#6366f1';      // line 7: --primary
  const UI_ICON = '#f8fafc';      // line 8: --ui-icon
  const TRANSITION_SPEED = '0.6s'; // line 13: --transition-speed
  const TIMING_FUNCTION = 'cubic-bezier(0.68, -0.6, 0.32, 1.6)'; // line 14

  return (
    <svg 
      // HTML line 113: viewBox="0 0 100 100"
      viewBox="0 0 100 100"
      // HTML lines 61-62: width: 44px, height: 44px
      width={size}
      height={size}
      className={className}
      style={{
        // HTML line 63: pointer-events: none
        pointerEvents: 'none',
        // HTML line 64: transition: transform var(--transition-speed) var(--timing-function)
        transition: `transform ${TRANSITION_SPEED} ${TIMING_FUNCTION}`,
        // HTML lines 83-85: .active .ham-svg { transform: rotate(45deg) }
        transform: isActive ? 'rotate(45deg)' : 'rotate(0deg)',
        // Performance optimization
        willChange: 'transform',
      }}
    >
      {/* HTML line 114: Top path with class "line top" */}
      <path 
        d="m 30,33 h 40 c 3.72,0 7.5,3.12 7.5,8.57 0,5.45 -2.72,8.42 -7.5,8.42 h -20 v -20"
        // HTML line 68: fill: none
        fill="none"
        // HTML line 70: stroke-width: 5
        strokeWidth="5"
        // HTML line 71: stroke-linecap: round
        strokeLinecap="round"
        // HTML line 69 + 87-89: stroke: var(--ui-icon) OR stroke: var(--primary) when active
        stroke={isActive ? PRIMARY : UI_ICON}
        style={{
          // HTML lines 72-74: full transition with all three properties
          transition: `stroke-dasharray ${TRANSITION_SPEED} ${TIMING_FUNCTION}, stroke-dashoffset ${TRANSITION_SPEED} ${TIMING_FUNCTION}, stroke 0.3s ease`,
          // HTML line 78: .top { stroke-dasharray: 40 160 }
          strokeDasharray: '40 160',
          // HTML lines 91-93: .active .top { stroke-dashoffset: -64px }
          strokeDashoffset: isActive ? '-64px' : '0',
        }}
      />
      
      {/* HTML line 115: Middle path with class "line middle" */}
      <path 
        d="m 30,50 h 40"
        fill="none"
        strokeWidth="5"
        strokeLinecap="round"
        stroke={isActive ? PRIMARY : UI_ICON}
        style={{
          transition: `stroke-dasharray ${TRANSITION_SPEED} ${TIMING_FUNCTION}, stroke-dashoffset ${TRANSITION_SPEED} ${TIMING_FUNCTION}, stroke 0.3s ease`,
          // HTML line 79: .middle { stroke-dasharray: 40 142 }
          // HTML lines 95-97: .active .middle { stroke-dasharray: 0 142 }
          strokeDasharray: isActive ? '0 142' : '40 142',
          // HTML line 97: stroke-dashoffset: -20px
          strokeDashoffset: isActive ? '-20px' : '0',
        }}
      />
      
      {/* HTML line 116: Bottom path with class "line bottom" */}
      <path 
        d="m 70,67 h -40 c 0,0 -7.5,-0.8 -7.5,-8.36 0,-7.56 7.5,-8.63 7.5,-8.63 h 20 v 20"
        fill="none"
        strokeWidth="5"
        strokeLinecap="round"
        stroke={isActive ? PRIMARY : UI_ICON}
        style={{
          transition: `stroke-dasharray ${TRANSITION_SPEED} ${TIMING_FUNCTION}, stroke-dashoffset ${TRANSITION_SPEED} ${TIMING_FUNCTION}, stroke 0.3s ease`,
          // HTML line 80: .bottom { stroke-dasharray: 40 85 }
          strokeDasharray: '40 85',
          // HTML lines 100-102: .active .bottom { stroke-dashoffset: -64px }
          strokeDashoffset: isActive ? '-64px' : '0',
        }}
      />
    </svg>
  );
};

export default HamburgerMenuIcon;
