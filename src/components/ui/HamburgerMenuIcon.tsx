// /src/components/ui/AnimatedMenuIcon.tsx
// COMPLETE - Ready to copy-paste
import React from 'react';

interface AnimatedMenuIconProps {
  state: 'closed' | 'opening' | 'open' | 'closing';
  size?: number;
  className?: string;
}

const AnimatedMenuIcon: React.FC<AnimatedMenuIconProps> = ({ 
  state, 
  size = 20,
  className = ''
}) => {
  const barHeight = size * 0.1;
  const barRadius = barHeight / 2;
  const barSpacing = size * 0.3;

  const getBarTransforms = () => {
    switch (state) {
      case 'closed':
        return {
          top: { translateY: 0, rotate: 0, scaleX: 1 },
          middle: { translateY: 0, rotate: 0, scaleX: 1, opacity: 1 },
          bottom: { translateY: 0, rotate: 0, scaleX: 1 }
        };
      
      case 'opening':
      case 'closing':
        return {
          top: { 
            translateY: barSpacing * 0.7,
            rotate: -42,
            scaleX: 0.6
          },
          middle: { 
            translateY: 0,
            rotate: 0,
            scaleX: 0.95,
            opacity: 1
          },
          bottom: { 
            translateY: -barSpacing * 0.7,
            rotate: 42,
            scaleX: 0.6
          }
        };
      
      case 'open':
        return {
          top: { 
            translateY: 0,
            rotate: 45,
            scaleX: 1.1
          },
          middle: { 
            translateY: 0,
            rotate: 0,
            scaleX: 0,
            opacity: 0
          },
          bottom: { 
            translateY: 0,
            rotate: -45,
            scaleX: 1.1
          }
        };
      
      default:
        return {
          top: { translateY: 0, rotate: 0, scaleX: 1 },
          middle: { translateY: 0, rotate: 0, scaleX: 1, opacity: 1 },
          bottom: { translateY: 0, rotate: 0, scaleX: 1 }
        };
    }
  };

  const transforms = getBarTransforms();
  const barStyle = {
    width: `${size}px`,
    height: `${barHeight}px`,
    borderRadius: `${barRadius}px`,
  };

  const createTransform = (t: any) => 
    `translateY(${t.translateY}px) rotate(${t.rotate}deg) scaleX(${t.scaleX})`;

  return (
    <div 
      className={`inline-flex flex-col justify-center items-center gap-0 ${className}`}
      style={{ 
        width: `${size}px`, 
        height: `${size}px`,
        position: 'relative'
      }}
    >
      <div
        className="bg-current transition-all duration-[400ms] ease-in-out"
        style={{
          ...barStyle,
          position: 'absolute',
          top: `${(size - barHeight) / 2 - barSpacing}px`,
          transformOrigin: 'center center',
          transform: createTransform(transforms.top),
          willChange: 'transform'
        }}
      />
      
      <div
        className="bg-current transition-all duration-[400ms] ease-in-out"
        style={{
          ...barStyle,
          position: 'absolute',
          top: `${(size - barHeight) / 2}px`,
          transformOrigin: 'center center',
          transform: createTransform(transforms.middle),
          opacity: transforms.middle.opacity,
          willChange: 'transform, opacity'
        }}
      />
      
      <div
        className="bg-current transition-all duration-[400ms] ease-in-out"
        style={{
          ...barStyle,
          position: 'absolute',
          top: `${(size - barHeight) / 2 + barSpacing}px`,
          transformOrigin: 'center center',
          transform: createTransform(transforms.bottom),
          willChange: 'transform'
        }}
      />
    </div>
  );
};

export default AnimatedMenuIcon;
