// /src/components/ui/HamburgerMenuIcon.tsx
// COMPLETE REPLICA of p1.html - ALL 130+ lines of CSS converted
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
  const isActive = state === 'open' || state === 'opening';

  // CSS Variables from :root
  const PRIMARY = '#6366f1';
  const UI_ICON = 'currentColor'; // Using currentColor instead of fixed color
  const TRANSITION_SPEED = '0.6s';
  const TIMING_FUNCTION = 'cubic-bezier(0.68, -0.6, 0.32, 1.6)';

  return (
    <svg 
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      style={{
        // From .ham-svg
        pointerEvents: 'none',
        transition: `transform ${TRANSITION_SPEED} ${TIMING_FUNCTION}`,
        // From .active .ham-svg
        transform: isActive ? 'rotate(45deg)' : 'rotate(0deg)',
      }}
    >
      {/* Top Line */}
      <path 
        d="m 30,33 h 40 c 3.72,0 7.5,3.12 7.5,8.57 0,5.45 -2.72,8.42 -7.5,8.42 h -20 v -20"
        fill="none"
        // KEY: stroke changes to PRIMARY when active!
        stroke={isActive ? PRIMARY : UI_ICON}
        strokeWidth="5"
        strokeLinecap="round"
        style={{
          // From .line
          transition: `stroke-dasharray ${TRANSITION_SPEED} ${TIMING_FUNCTION}, stroke-dashoffset ${TRANSITION_SPEED} ${TIMING_FUNCTION}, stroke 0.3s ease`,
          // From .top
          strokeDasharray: '40 160',
          // From .active .top
          strokeDashoffset: isActive ? '-64px' : '0',
        }}
      />
      
      {/* Middle Line */}
      <path 
        d="m 30,50 h 40"
        fill="none"
        // KEY: stroke changes to PRIMARY when active!
        stroke={isActive ? PRIMARY : UI_ICON}
        strokeWidth="5"
        strokeLinecap="round"
        style={{
          // From .line
          transition: `stroke-dasharray ${TRANSITION_SPEED} ${TIMING_FUNCTION}, stroke-dashoffset ${TRANSITION_SPEED} ${TIMING_FUNCTION}, stroke 0.3s ease`,
          // From .middle (default)
          strokeDasharray: isActive ? '0 142' : '40 142',
          // From .active .middle
          strokeDashoffset: isActive ? '-20px' : '0',
        }}
      />
      
      {/* Bottom Line */}
      <path 
        d="m 70,67 h -40 c 0,0 -7.5,-0.8 -7.5,-8.36 0,-7.56 7.5,-8.63 7.5,-8.63 h 20 v 20"
        fill="none"
        // KEY: stroke changes to PRIMARY when active!
        stroke={isActive ? PRIMARY : UI_ICON}
        strokeWidth="5"
        strokeLinecap="round"
        style={{
          // From .line
          transition: `stroke-dasharray ${TRANSITION_SPEED} ${TIMING_FUNCTION}, stroke-dashoffset ${TRANSITION_SPEED} ${TIMING_FUNCTION}, stroke 0.3s ease`,
          // From .bottom
          strokeDasharray: '40 85',
          // From .active .bottom
          strokeDashoffset: isActive ? '-64px' : '0',
        }}
      />
    </svg>
  );
};

export default HamburgerMenuIcon;
