// /src/components/ui/HamburgerMenuIcon.tsx
// EXACT REPLICA of p1.html - Fresh component name
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

  return (
    <svg 
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      style={{
        pointerEvents: 'none',
        transition: 'transform 0.6s cubic-bezier(0.68, -0.6, 0.32, 1.6)',
        transform: isActive ? 'rotate(45deg)' : 'rotate(0deg)',
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
          transition: 'stroke-dasharray 0.6s cubic-bezier(0.68, -0.6, 0.32, 1.6), stroke-dashoffset 0.6s cubic-bezier(0.68, -0.6, 0.32, 1.6), stroke 0.3s ease',
          strokeDasharray: '40 160',
          strokeDashoffset: isActive ? '-64px' : '0',
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
          transition: 'stroke-dasharray 0.6s cubic-bezier(0.68, -0.6, 0.32, 1.6), stroke-dashoffset 0.6s cubic-bezier(0.68, -0.6, 0.32, 1.6), stroke 0.3s ease',
          strokeDasharray: isActive ? '0 142' : '40 142',
          strokeDashoffset: isActive ? '-20px' : '0',
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
          transition: 'stroke-dasharray 0.6s cubic-bezier(0.68, -0.6, 0.32, 1.6), stroke-dashoffset 0.6s cubic-bezier(0.68, -0.6, 0.32, 1.6), stroke 0.3s ease',
          strokeDasharray: '40 85',
          strokeDashoffset: isActive ? '-64px' : '0',
        }}
      />
    </svg>
  );
};

export default HamburgerMenuIcon;
