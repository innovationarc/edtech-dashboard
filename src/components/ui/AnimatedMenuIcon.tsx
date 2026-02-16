// /src/components/ui/AnimatedMenuIcon.tsx
// Production-Grade SVG Hamburger Menu Icon with Liquid Animation
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
  // Determine if menu is open based on state
  const isOpen = state === 'open' || state === 'opening';

  return (
    <div 
      className={`inline-flex items-center justify-center ${className}`}
      style={{ 
        width: `${size}px`, 
        height: `${size}px`,
      }}
    >
      <svg 
        className={`ham-svg ${isOpen ? 'active' : ''}`}
        viewBox="0 0 100 100"
        width={size}
        height={size}
        style={{
          pointerEvents: 'none',
          transition: 'transform 0.6s cubic-bezier(0.68, -0.6, 0.32, 1.6)',
          transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)',
        }}
      >
        {/* Top Line */}
        <path 
          className="line top"
          d="m 30,33 h 40 c 3.72,0 7.5,3.12 7.5,8.57 0,5.45 -2.72,8.42 -7.5,8.42 h -20 v -20"
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          style={{
            strokeDasharray: '40 160',
            strokeDashoffset: isOpen ? '-64px' : '0',
            transition: 'stroke-dasharray 0.6s cubic-bezier(0.68, -0.6, 0.32, 1.6), stroke-dashoffset 0.6s cubic-bezier(0.68, -0.6, 0.32, 1.6), stroke 0.3s ease',
          }}
        />
        
        {/* Middle Line */}
        <path 
          className="line middle"
          d="m 30,50 h 40"
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          style={{
            strokeDasharray: isOpen ? '0 142' : '40 142',
            strokeDashoffset: isOpen ? '-20px' : '0',
            transition: 'stroke-dasharray 0.6s cubic-bezier(0.68, -0.6, 0.32, 1.6), stroke-dashoffset 0.6s cubic-bezier(0.68, -0.6, 0.32, 1.6), stroke 0.3s ease',
          }}
        />
        
        {/* Bottom Line */}
        <path 
          className="line bottom"
          d="m 70,67 h -40 c 0,0 -7.5,-0.8 -7.5,-8.36 0,-7.56 7.5,-8.63 7.5,-8.63 h 20 v 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          style={{
            strokeDasharray: '40 85',
            strokeDashoffset: isOpen ? '-64px' : '0',
            transition: 'stroke-dasharray 0.6s cubic-bezier(0.68, -0.6, 0.32, 1.6), stroke-dashoffset 0.6s cubic-bezier(0.68, -0.6, 0.32, 1.6), stroke 0.3s ease',
          }}
        />
      </svg>
    </div>
  );
};

export default AnimatedMenuIcon;
