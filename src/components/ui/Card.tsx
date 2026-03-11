// Card.tsx — Matte crystal card: frosted warm white, oval corners, soft shadow
import { ReactNode } from 'react';
import clsx from 'clsx';
import { useDashboard } from '../../contexts/DashboardContext';

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
  const { theme } = useDashboard();
  const isLight = theme === 'light';
  const isInteractive = onClick || hover;

  /* ── Matte Crystal ──
     Light: warm white frosted glass, very soft warm shadow
     Dark:  slightly elevated surface with subtle glow border
  */
  const bg = isLight
    ? 'rgba(255,255,255,0.82)'
    : 'rgba(255,255,255,0.04)';
  const border = isLight
    ? '1px solid rgba(255,255,255,0.92)'
    : '1px solid rgba(255,255,255,0.08)';
  const shadow = isLight
    ? '0 2px 16px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.95)'
    : '0 2px 12px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.06)';
  const titleColor = isLight ? '#111827' : 'rgba(255,255,255,0.92)';
  const subtitleColor = isLight ? '#6b7280' : 'rgba(148,163,184,0.75)';
  const dividerColor = isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.06)';
  const footerBg = isLight ? 'rgba(0,0,0,0.03)' : 'rgba(0,0,0,0.12)';

  return (
    <div
      className={clsx('relative overflow-hidden', isInteractive && 'cursor-pointer', className)}
      style={{
        background: bg,
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        border,
        borderRadius: 20,
        boxShadow: shadow,
        fontFamily: "'Outfit', sans-serif",
        transition: 'transform 0.22s cubic-bezier(0.34,1.25,0.64,1), box-shadow 0.22s ease, border-color 0.22s ease',
      }}
      onClick={onClick}
      onMouseEnter={isInteractive ? e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = 'translateY(-3px)';
        el.style.boxShadow = isLight
          ? '0 12px 32px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,1)'
          : '0 12px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.10)';
        el.style.borderColor = isLight ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.14)';
      } : undefined}
      onMouseLeave={isInteractive ? e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.transform = 'translateY(0)';
        el.style.boxShadow = shadow;
        el.style.borderColor = isLight ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.08)';
      } : undefined}
    >
      {(title || subtitle || icon) && (
        <div style={{
          padding: '16px 24px',
          borderBottom: `1px solid ${dividerColor}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div className="min-w-0 flex-1">
            {title && (
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: titleColor, letterSpacing: '-0.01em', lineHeight: 1.3, margin: 0 }}>
                {title}
              </h3>
            )}
            {subtitle && (
              <p style={{ fontSize: '0.75rem', color: subtitleColor, marginTop: 2, lineHeight: 1.4, margin: subtitle ? '2px 0 0' : 0 }}>
                {subtitle}
              </p>
            )}
          </div>
          {icon && <div className="ml-3 flex-shrink-0">{icon}</div>}
        </div>
      )}
      <div style={{ padding: PADDING[padding] }}>{children}</div>
      {footer && (
        <div style={{ padding: '12px 24px', borderTop: `1px solid ${dividerColor}`, background: footerBg }}>
          {footer}
        </div>
      )}
    </div>
  );
};

export default Card;
