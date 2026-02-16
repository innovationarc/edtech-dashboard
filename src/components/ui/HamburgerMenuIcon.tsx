// src/components/ui/HamburgerMenuIcon.tsx
// FIXED VERSION - Proper SVG rendering with correct React syntax
import React from 'react';

interface HamburgerMenuIconProps {
  state: 'closed' | 'opening' | 'open' | 'closing';
  size?: number;
  className?: string;
}

const HamburgerMenuIcon: React.FC<HamburgerMenuIconProps> = ({ 
  state, 
  size = 44,
  className = ''
}) => {
  const isActive = state === 'open' || state === 'opening';

  const PRIMARY = '#6366f1';
  const UI_ICON = '#f8fafc';
  const TRANSITION_SPEED = '0.6s';
  const TIMING_FUNCTION = 'cubic-bezier(0.68, -0.6, 0.32, 1.6)';

  // Common path styles
  const pathStyle = {
    fill: 'none',
    strokeWidth: 5,
    strokeLinecap: 'round' as const,
    transition: `stroke-dasharray ${TRANSITION_SPEED} ${TIMING_FUNCTION}, stroke-dashoffset ${TRANSITION_SPEED} ${TIMING_FUNCTION}, stroke 0.3s ease`,
  };

  return (
    <svg 
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      style={{
        display: 'block',
        pointerEvents: 'none',
        transition: `transform ${TRANSITION_SPEED} ${TIMING_FUNCTION}`,
        transform: isActive ? 'rotate(45deg)' : 'rotate(0deg)',
        willChange: 'transform',
      }}
    >
      {/* Top Line */}
      <path 
        d="m 30,33 h 40 c 3.72,0 7.5,3.12 7.5,8.57 0,5.45 -2.72,8.42 -7.5,8.42 h -20 v -20"
        stroke={isActive ? PRIMARY : UI_ICON}
        strokeDasharray="40 160"
        strokeDashoffset={isActive ? -64 : 0}
        {...pathStyle}
      />
      
      {/* Middle Line */}
      <path 
        d="m 30,50 h 40"
        stroke={isActive ? PRIMARY : UI_ICON}
        strokeDasharray={isActive ? '0 142' : '40 142'}
        strokeDashoffset={isActive ? -20 : 0}
        {...pathStyle}
      />
      
      {/* Bottom Line */}
      <path 
        d="m 70,67 h -40 c 0,0 -7.5,-0.8 -7.5,-8.36 0,-7.56 7.5,-8.63 7.5,-8.63 h 20 v 20"
        stroke={isActive ? PRIMARY : UI_ICON}
        strokeDasharray="40 85"
        strokeDashoffset={isActive ? -64 : 0}
        {...pathStyle}
      />
    </svg>
  );
};

export default HamburgerMenuIcon;
