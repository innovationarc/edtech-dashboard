// Card.tsx — Professional SaaS card with soft shadows + hover lift (no glow)
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
  variant?: 'default' | 'dark' | 'light' | 'accent';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const VARIANTS = {
  default: { bg: '#1f2937', border: 'rgba(255,255,255,0.06)' },
  dark:    { bg: '#111827', border: 'rgba(255,255,255,0.05)' },
  light:   { bg: '#374151', border: 'rgba(255,255,255,0.08)' },
  accent:  { bg: 'linear-gradient(135deg,#1e1b4b 0%,#1f2937 100%)', border: 'rgba(99,102,241,0.2)' },
};

const PADDING = {
  none: '0',
  sm: '12px 16px',
  md: '20px 24px',
  lg: '28px 32px',
};

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
  padding = 'md',
}: CardProps) => {
  const v = VARIANTS[variant];
  const isInteractive = onClick || hover;

  return (
    <div
      className={clsx(
        'relative rounded-2xl overflow-hidden',
        isInteractive && 'cursor-pointer saas-card-hover',
        className
      )}
      style={{
        background: v.bg,
        border: `1px solid ${v.border}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.2), 0 2px 8px rgba(0,0,0,0.12)',
        fontFamily: "'Outfit', sans-serif",
        backdropFilter: 'blur(8px)',
      }}
      onClick={onClick}
    >
      {(title || subtitle || icon) && (
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div className="min-w-0 flex-1">
            {title && (
              <h3 style={{
                fontSize: '1rem',
                fontWeight: 600,
                color: 'white',
                letterSpacing: '-0.01em',
                lineHeight: 1.3,
              }}>
                {title}
              </h3>
            )}
            {subtitle && (
              <p style={{
                fontSize: '0.75rem',
                color: 'rgba(156,163,175,0.85)',
                marginTop: '2px',
                lineHeight: 1.4,
              }}>
                {subtitle}
              </p>
            )}
          </div>
          {icon && <div className="ml-3 flex-shrink-0">{icon}</div>}
        </div>
      )}

      <div style={{ padding: PADDING[padding] }}>{children}</div>

      {footer && (
        <div style={{
          padding: '12px 24px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(0,0,0,0.15)',
        }}>
          {footer}
        </div>
      )}

      <style>{`
        .saas-card-hover {
          transition: transform 0.2s cubic-bezier(0.34,1.25,0.64,1), box-shadow 0.2s ease, border-color 0.2s ease;
        }
        .saas-card-hover:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.2);
          border-color: rgba(255,255,255,0.1) !important;
        }
        .saas-card-hover:active {
          transform: translateY(-1px);
        }
      `}</style>
    </div>
  );
};

export default Card;
