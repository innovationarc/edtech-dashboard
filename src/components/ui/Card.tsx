// src/components/ui/Card.tsx — Glass-transparent theme, production-grade
import { ReactNode } from 'react';
import clsx from 'clsx';

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  footer?: ReactNode;
  onClick?: () => void;
  hover?: boolean;
  accent?: string; // optional left-border accent color
  compact?: boolean;
}

const Card = ({
  children,
  className,
  title,
  subtitle,
  icon,
  footer,
  onClick,
  hover = false,
  accent,
  compact = false,
}: CardProps) => {
  return (
    <div
      className={clsx(
        'relative overflow-hidden rounded-2xl',
        onClick && 'cursor-pointer',
        (hover || onClick) && 'transition-all duration-300',
        className
      )}
      style={{
        fontFamily: "'Outfit', sans-serif",
        background: 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(20px) saturate(160%)',
        WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.06)',
        ...(accent ? { borderLeft: `3px solid ${accent}` } : {}),
      }}
      onMouseEnter={hover || onClick ? (e) => {
        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.08)';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
      } : undefined}
      onMouseLeave={hover || onClick ? (e) => {
        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 24px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.06)';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
      } : undefined}
      onClick={onClick}
    >
      {/* Top shimmer line */}
      <div style={{
        position: 'absolute', top: 0, left: '10%', right: '10%', height: 1,
        background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent)',
        pointerEvents: 'none',
      }} />

      {(title || subtitle || icon) && (
        <div style={{
          padding: compact ? '10px 14px' : 'clamp(10px,1.5vw,16px) clamp(14px,2vw,20px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            {title && (
              <h3 style={{
                fontSize: 'clamp(0.8rem,1.4vw,0.95rem)',
                fontWeight: 650,
                color: 'rgba(255,255,255,0.92)',
                margin: 0,
                letterSpacing: '-0.01em',
                lineHeight: 1.3,
              }}>
                {title}
              </h3>
            )}
            {subtitle && (
              <p style={{
                fontSize: 'clamp(0.68rem,1vw,0.76rem)',
                color: 'rgba(255,255,255,0.42)',
                margin: '2px 0 0',
                lineHeight: 1.4,
              }}>
                {subtitle}
              </p>
            )}
          </div>
          {icon && (
            <div style={{
              flexShrink: 0,
              width: 32, height: 32,
              borderRadius: 9,
              background: 'rgba(255,255,255,0.05)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {icon}
            </div>
          )}
        </div>
      )}

      <div style={{
        padding: compact
          ? '10px 14px'
          : 'clamp(12px,1.8vw,20px) clamp(14px,2vw,20px)',
      }}>
        {children}
      </div>

      {footer && (
        <div style={{
          padding: 'clamp(8px,1.2vw,12px) clamp(14px,2vw,20px)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(0,0,0,0.08)',
        }}>
          {footer}
        </div>
      )}
    </div>
  );
};

export default Card;
