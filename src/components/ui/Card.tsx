// Card.tsx — Glass blur card: frosted background + soft shadow + hover lift
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
  variant?: 'default' | 'dark' | 'glass';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const PADDING = { none: '0', sm: '12px 16px', md: '20px 24px', lg: '28px 32px' };

const Card = ({
  children, className, title, subtitle, icon, footer,
  onClick, hover = false, variant = 'default', padding = 'md',
}: CardProps) => {
  const isInteractive = onClick || hover;

  return (
    <div
      className={clsx('relative rounded-2xl overflow-hidden', isInteractive && 'cursor-pointer', className)}
      style={{
        /* Glass blur — iDraft style */
        background: 'rgba(255,255,255,0.035)',
        backdropFilter: 'blur(20px) saturate(170%)',
        WebkitBackdropFilter: 'blur(20px) saturate(170%)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.07)',
        fontFamily: "'Outfit', sans-serif",
        transition: 'transform 0.22s cubic-bezier(0.34,1.25,0.64,1), box-shadow 0.22s ease, border-color 0.22s ease',
      }}
      onClick={onClick}
      onMouseEnter={isInteractive ? e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = 'translateY(-3px)';
        el.style.boxShadow = '0 12px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.10)';
        el.style.borderColor = 'rgba(255,255,255,0.12)';
        el.style.background = 'rgba(255,255,255,0.055)';
      } : undefined}
      onMouseLeave={isInteractive ? e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = 'translateY(0)';
        el.style.boxShadow = '0 2px 12px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.07)';
        el.style.borderColor = 'rgba(255,255,255,0.08)';
        el.style.background = 'rgba(255,255,255,0.035)';
      } : undefined}
    >
      {(title || subtitle || icon) && (
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div className="min-w-0 flex-1">
            {title && (
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'rgba(255,255,255,0.92)', letterSpacing: '-0.01em', lineHeight: 1.3 }}>
                {title}
              </h3>
            )}
            {subtitle && (
              <p style={{ fontSize: '0.75rem', color: 'rgba(148,163,184,0.8)', marginTop: 2, lineHeight: 1.4 }}>
                {subtitle}
              </p>
            )}
          </div>
          {icon && <div className="ml-3 flex-shrink-0">{icon}</div>}
        </div>
      )}
      <div style={{ padding: PADDING[padding] }}>{children}</div>
      {footer && (
        <div style={{ padding: '12px 24px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.12)' }}>
          {footer}
        </div>
      )}
    </div>
  );
};

export default Card;
