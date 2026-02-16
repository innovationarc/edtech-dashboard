// /src/components/ui/AnimatedMenuIcon.tsx
// EXACT REPLICA of the HTML hamburger menu - Production Grade
import React from 'react';

interface AnimatedMenuIconProps {
  state: 'closed' | 'opening' | 'open' | 'closing';
  size?: number;
  className?: string;
}

const AnimatedMenuIcon: React.FC<AnimatedMenuIconProps> = ({ 
  state, 
  size = 24,
  className = ''
}) => {
  // Determine if menu is open
  const isActive = state === 'open' || state === 'opening';

  return (
    <svg 
      className={className}
      viewBox="0 0 100 100"
      width={size}
      height={size}
      style={{
        pointerEvents: 'none',
        transition: 'transform 0.6s cubic-bezier(0.68, -0.6, 0.32, 1.6)',
        transform: isActive ? 'rotate(45deg)' : 'rotate(0deg)',
        willChange: 'transform'
      }}
    >
      {/* Top Line */}
      <path 
        d="m 30,33 h 40 c 3.72,0 7.5,3.12 7.5,8.57 0,5.45 -2.72,8.42 -7.5,8.42 h -20 v -20"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        style={{
          strokeDasharray: '40 160',
          strokeDashoffset: isActive ? '-64px' : '0',
          transition: 'stroke-dasharray 0.6s cubic-bezier(0.68, -0.6, 0.32, 1.6), stroke-dashoffset 0.6s cubic-bezier(0.68, -0.6, 0.32, 1.6)',
          willChange: 'stroke-dashoffset'
        }}
      />
      
      {/* Middle Line */}
      <path 
        d="m 30,50 h 40"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        style={{
          strokeDasharray: isActive ? '0 142' : '40 142',
          strokeDashoffset: isActive ? '-20px' : '0',
          transition: 'stroke-dasharray 0.6s cubic-bezier(0.68, -0.6, 0.32, 1.6), stroke-dashoffset 0.6s cubic-bezier(0.68, -0.6, 0.32, 1.6)',
          willChange: 'stroke-dasharray, stroke-dashoffset'
        }}
      />
      
      {/* Bottom Line */}
      <path 
        d="m 70,67 h -40 c 0,0 -7.5,-0.8 -7.5,-8.36 0,-7.56 7.5,-8.63 7.5,-8.63 h 20 v 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        style={{
          strokeDasharray: '40 85',
          strokeDashoffset: isActive ? '-64px' : '0',
          transition: 'stroke-dasharray 0.6s cubic-bezier(0.68, -0.6, 0.32, 1.6), stroke-dashoffset 0.6s cubic-bezier(0.68, -0.6, 0.32, 1.6)',
          willChange: 'stroke-dashoffset'
        }}
      />
    </svg>
  );
};

export default AnimatedMenuIcon;
