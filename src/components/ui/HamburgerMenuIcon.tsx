// src/components/ui/HamburgerMenuIcon.tsx
// EXACT 1:1 conversion of p1.html - Every CSS rule, every transition
import React from 'react';

interface HamburgerMenuIconProps {
  state: 'closed' | 'opening' | 'open' | 'closing';
  size?: number;
  className?: string;
}

const HamburgerMenuIcon: React.FC<HamburgerMenuIconProps> = ({ 
  state, 
  size = 24,
  className = ''
}) => {
  // Map state to active boolean (HTML uses .active class)
  const isActive = state === 'open' || state === 'opening';

  // CSS Variables from HTML :root (lines 6-14)
  const PRIMARY = '#6366f1';
  const UI_ICON = '#f8fafc';
  const TRANSITION_SPEED = '0.6s';
  const TIMING_FUNCTION = 'cubic-bezier(0.68, -0.6, 0.32, 1.6)';

  return (
    <svg 
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      style={{
        // From .ham-svg (lines 60-65)
        width: size,
        height: size,
        pointerEvents: 'none',
        transition: `transform ${TRANSITION_SPEED} ${TIMING_FUNCTION}`,
        // From .active .ham-svg (lines 83-85)
        transform: isActive ? 'rotate(45deg)' : 'rotate(0deg)',
      }}
    >
      {/* Top Line - path from line 114 */}
      <path 
        d="m 30,33 h 40 c 3.72,0 7.5,3.12 7.5,8.57 0,5.45 -2.72,8.42 -7.5,8.42 h -20 v -20"
        fill="none"
        // From .active .line (lines 87-89) - stroke changes to PRIMARY when active
        stroke={isActive ? PRIMARY : UI_ICON}
        strokeWidth="5"
        strokeLinecap="round"
        style={{
          // From .line (lines 67-75)
          transition: `stroke-dasharray ${TRANSITION_SPEED} ${TIMING_FUNCTION}, stroke-dashoffset ${TRANSITION_SPEED} ${TIMING_FUNCTION}, stroke 0.3s ease`,
          // From .top (line 78)
          strokeDasharray: '40 160',
          // From .active .top (lines 91-93)
          strokeDashoffset: isActive ? '-64px' : '0',
        }}
      />
      
      {/* Middle Line - path from line 115 */}
      <path 
        d="m 30,50 h 40"
        fill="none"
        // From .active .line (lines 87-89)
        stroke={isActive ? PRIMARY : UI_ICON}
        strokeWidth="5"
        strokeLinecap="round"
        style={{
          // From .line (lines 67-75)
          transition: `stroke-dasharray ${TRANSITION_SPEED} ${TIMING_FUNCTION}, stroke-dashoffset ${TRANSITION_SPEED} ${TIMING_FUNCTION}, stroke 0.3s ease`,
          // From .middle (line 79) and .active .middle (lines 95-98)
          strokeDasharray: isActive ? '0 142' : '40 142',
          strokeDashoffset: isActive ? '-20px' : '0',
        }}
      />
      
      {/* Bottom Line - path from line 116 */}
      <path 
        d="m 70,67 h -40 c 0,0 -7.5,-0.8 -7.5,-8.36 0,-7.56 7.5,-8.63 7.5,-8.63 h 20 v 20"
        fill="none"
        // From .active .line (lines 87-89)
        stroke={isActive ? PRIMARY : UI_ICON}
        strokeWidth="5"
        strokeLinecap="round"
        style={{
          // From .line (lines 67-75)
          transition: `stroke-dasharray ${TRANSITION_SPEED} ${TIMING_FUNCTION}, stroke-dashoffset ${TRANSITION_SPEED} ${TIMING_FUNCTION}, stroke 0.3s ease`,
          // From .bottom (line 80)
          strokeDasharray: '40 85',
          // From .active .bottom (lines 100-102)
          strokeDashoffset: isActive ? '-64px' : '0',
        }}
      />
    </svg>
  );
};

export default HamburgerMenuIcon;
