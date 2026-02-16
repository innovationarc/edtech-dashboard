// src/components/ui/HamburgerMenuIcon.tsx
// TEST VERSION - Completely different design to verify it's being used
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
    <div
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.5s ease',
        transform: isActive ? 'rotate(180deg)' : 'rotate(0deg)',
      }}
    >
      {isActive ? (
        // OPEN STATE: Big Green Circle with "OPEN" text
        <div
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            backgroundColor: '#10b981', // Bright green
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: size * 0.4,
            fontWeight: 'bold',
            border: '2px solid #34d399',
          }}
        >
          O
        </div>
      ) : (
        // CLOSED STATE: Big Red Square with "MENU" text
        <div
          style={{
            width: size * 0.9,
            height: size * 0.9,
            backgroundColor: '#ef4444', // Bright red
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: size * 0.35,
            fontWeight: 'bold',
            border: '2px solid #f87171',
            borderRadius: '4px',
          }}
        >
          M
        </div>
      )}
    </div>
  );
};

export default HamburgerMenuIcon;
