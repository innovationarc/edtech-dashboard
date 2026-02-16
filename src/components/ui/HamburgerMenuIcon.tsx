// src/components/ui/HamburgerMenuIcon.tsx
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

  return (
    <>
      <style>{`
        .ham-svg {
          -webkit-tap-highlight-color: transparent;
          -webkit-touch-callout: none;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          user-select: none;
        }
      `}</style>
      <svg 
        className={`ham-svg ${className}`}
        width={size}
        height={size}
        viewBox="0 0 100 100"
        style={{
          pointerEvents: 'none',
          transition: 'transform 0.6s cubic-bezier(0.68, -0.6, 0.32, 1.6)',
          transform: isActive ? 'rotate(45deg)' : 'rotate(0deg)',
          display: 'block'
        }}
      >
        <path 
          className="line top" 
          d="m 30,33 h 40 c 3.72,0 7.5,3.12 7.5,8.57 0,5.45 -2.72,8.42 -7.5,8.42 h -20 v -20"
          fill="none"
          stroke={isActive ? '#6366f1' : '#f8fafc'}
          strokeWidth="5"
          strokeLinecap="round"
          style={{
            strokeDasharray: '40 160',
            strokeDashoffset: isActive ? '-64px' : '0px',
            transition: 'stroke-dasharray 0.6s cubic-bezier(0.68, -0.6, 0.32, 1.6), stroke-dashoffset 0.6s cubic-bezier(0.68, -0.6, 0.32, 1.6), stroke 0.3s ease'
          }}
        />
        <path 
          className="line middle" 
          d="m 30,50 h 40"
          fill="none"
          stroke={isActive ? '#6366f1' : '#f8fafc'}
          strokeWidth="5"
          strokeLinecap="round"
          style={{
            strokeDasharray: isActive ? '0 142' : '40 142',
            strokeDashoffset: isActive ? '-20px' : '0px',
            transition: 'stroke-dasharray 0.6s cubic-bezier(0.68, -0.6, 0.32, 1.6), stroke-dashoffset 0.6s cubic-bezier(0.68, -0.6, 0.32, 1.6), stroke 0.3s ease'
          }}
        />
        <path 
          className="line bottom" 
          d="m 70,67 h -40 c 0,0 -7.5,-0.8 -7.5,-8.36 0,-7.56 7.5,-8.63 7.5,-8.63 h 20 v 20"
          fill="none"
          stroke={isActive ? '#6366f1' : '#f8fafc'}
          strokeWidth="5"
          strokeLinecap="round"
          style={{
            strokeDasharray: '40 85',
            strokeDashoffset: isActive ? '-64px' : '0px',
            transition: 'stroke-dasharray 0.6s cubic-bezier(0.68, -0.6, 0.32, 1.6), stroke-dashoffset 0.6s cubic-bezier(0.68, -0.6, 0.32, 1.6), stroke 0.3s ease'
          }}
        />
      </svg>
    </>
  );
};

export default HamburgerMenuIcon;
