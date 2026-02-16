// src/components/ui/HamburgerMenuIcon.tsx
// EXTREME TEST VERSION - Huge visual differences to verify state changes
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

  if (isActive) {
    // OPEN STATE: Giant spinning green star
    return (
      <div
        style={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'spin 2s linear infinite',
        }}
      >
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
            fill="#10b981"
            stroke="#34d399"
            strokeWidth="2"
          />
        </svg>
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // CLOSED STATE: Giant red square with "MENU" text
  return (
    <div
      style={{
        width: size,
        height: size,
        backgroundColor: '#ef4444',
        border: '3px solid #dc2626',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontWeight: 'bold',
        fontSize: size * 0.3,
        boxShadow: '0 4px 12px rgba(239, 68, 68, 0.5)',
      }}
    >
      MENU
    </div>
  );
};

export default HamburgerMenuIcon;
