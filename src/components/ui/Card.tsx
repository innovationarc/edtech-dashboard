// src/components/ui/Card.tsx — iDraft Design System
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
  variant?: 'dark' | 'white' | 'default';
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
  variant = 'default',
}: CardProps) => {
  const isWhite = variant === 'white';
  const isDark  = variant === 'dark';

  const base: React.CSSProperties = {
    fontFamily: "'DM Sans', sans-serif",
    borderRadius: 'var(--radius-card)',
    overflow: 'hidden',
    transition: 'box-shadow 0.35s var(--ease-smooth), transform 0.35s var(--ease-spring)',
    cursor: onClick ? 'pointer' : undefined,
    ...(isWhite
      ? {
          background: '#FFFFFF',
          boxShadow: 'var(--shadow-float)',
          border: '1px solid rgba(0,0,0,0.04)',
          color: '#111827',
        }
      : isDark
      ? {
          background: '#1A1A1E',
          boxShadow: 'var(--shadow-dark-card)',
          border: '1px solid rgba(255,255,255,0.06)',
          color: '#ffffff',
        }
      : {
          background: 'var(--color-card, #1f2937)',
          boxShadow: 'var(--shadow-dark-card)',
          border: '1px solid rgba(255,255,255,0.05)',
          color: '#ffffff',
        }),
  };

  const hoverStyle =
    hover || onClick
      ? ({
          ':hover': {
            transform: 'translateY(-2px)',
            boxShadow: isWhite ? 'var(--shadow-float-hover)' : '0 12px 40px -8px rgba(0,0,0,0.7)',
          },
        } as React.CSSProperties)
      : {};

  const headerBorder = isWhite
    ? '1px solid rgba(0,0,0,0.06)'
    : '1px solid rgba(255,255,255,0.06)';

  const titleColor  = isWhite ? '#111827' : '#ffffff';
  const subColor    = isWhite ? '#6b7280' : 'rgba(156,163,175,1)';
  const footerBg    = isWhite ? 'rgba(0,0,0,0.03)' : 'rgba(0,0,0,0.2)';

  return (
    <div
      className={clsx(
        (hover || onClick) && (isWhite ? 'idraft-card-white' : 'idraft-card-dark'),
        !hover && !onClick && 'responsive-card',
        className
      )}
      style={base}
      onClick={onClick}
    >
      {(title || subtitle || icon) && (
        <div
          style={{
            padding: 'clamp(12px,2vw,18px) clamp(14px,2.5vw,20px)',
            borderBottom: headerBorder,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            {title && (
              <h3
                style={{
                  fontSize: 'clamp(0.875rem, 1.5vw, 1rem)',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  color: titleColor,
                  lineHeight: 1.3,
                }}
              >
                {title}
              </h3>
            )}
            {subtitle && (
              <p
                style={{
                  fontSize: 'clamp(0.7rem, 1.1vw, 0.8rem)',
                  color: subColor,
                  marginTop: '3px',
                  fontWeight: 400,
                }}
              >
                {subtitle}
              </p>
            )}
          </div>
          {icon && <div style={{ marginLeft: '12px', flexShrink: 0 }}>{icon}</div>}
        </div>
      )}

      <div style={{ padding: 'clamp(12px,2vw,20px) clamp(14px,2.5vw,20px)' }}>
        {children}
      </div>

      {footer && (
        <div
          style={{
            padding: '12px clamp(14px,2.5vw,20px)',
            borderTop: headerBorder,
            background: footerBg,
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
};

export default Card;
