// src/components/ui/StatsCard.tsx — iDraft Design System
import { ReactNode } from 'react';
import clsx from 'clsx';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  change?: { value: string | number; positive?: boolean; };
  colorScheme?: 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error';
  onClick?: () => void;
  /** 'dark' = near-black card (default), 'white' = floating white card */
  variant?: 'dark' | 'white';
}

const SCHEMES = {
  primary:   { blob: 'rgba(139,92,246,0.18)',  iconBg: '#ede9fe', iconColor: '#7c3aed', pillBg: 'rgba(139,92,246,0.15)', pillColor: '#a78bfa' },
  secondary: { blob: 'rgba(14,165,233,0.18)',   iconBg: '#e0f2fe', iconColor: '#0284c7', pillBg: 'rgba(14,165,233,0.15)', pillColor: '#38bdf8' },
  accent:    { blob: 'rgba(16,185,129,0.18)',   iconBg: '#d1fae5', iconColor: '#059669', pillBg: 'rgba(16,185,129,0.15)', pillColor: '#34d399' },
  success:   { blob: 'rgba(132,204,22,0.18)',   iconBg: '#ecfccb', iconColor: '#65a30d', pillBg: 'rgba(132,204,22,0.15)', pillColor: '#a3e635' },
  warning:   { blob: 'rgba(245,158,11,0.18)',   iconBg: '#fef3c7', iconColor: '#d97706', pillBg: 'rgba(245,158,11,0.15)', pillColor: '#fbbf24' },
  error:     { blob: 'rgba(244,63,94,0.18)',    iconBg: '#ffe4e6', iconColor: '#e11d48', pillBg: 'rgba(244,63,94,0.15)', pillColor: '#fb7185' },
};

const StatsCard = ({ title, value, icon, change, colorScheme = 'primary', onClick, variant = 'dark' }: StatsCardProps) => {
  const s = SCHEMES[colorScheme];
  const isWhite = variant === 'white';

  const cardStyle: React.CSSProperties = {
    position: 'relative',
    borderRadius: 'var(--radius-card)',
    overflow: 'hidden',
    padding: 'clamp(14px, 2vw, 22px)',
    fontFamily: "'DM Sans', sans-serif",
    cursor: onClick ? 'pointer' : undefined,
    transition: 'box-shadow 0.35s var(--ease-smooth), transform 0.35s var(--ease-spring)',
    ...(isWhite
      ? {
          background: '#FFFFFF',
          boxShadow: 'var(--shadow-float)',
          border: '1px solid rgba(0,0,0,0.04)',
          color: '#111827',
        }
      : {
          background: '#1A1A1E',
          boxShadow: 'var(--shadow-dark-card)',
          border: '1px solid rgba(255,255,255,0.06)',
          color: '#ffffff',
        }),
  };

  const valueColor = isWhite ? '#111827' : '#ffffff';
  const subColor   = isWhite ? '#6b7280' : 'rgba(156,163,175,1)';

  return (
    <div
      className={clsx(onClick && 'idraft-scale-hover')}
      style={cardStyle}
      onClick={onClick}
    >
      {/* Glow blob */}
      <div
        style={{
          position: 'absolute',
          top: '-12px', right: '-12px',
          width: '80px', height: '80px',
          borderRadius: '50%',
          filter: 'blur(24px)',
          background: s.blob,
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
        {/* Icon */}
        <div
          style={{
            flexShrink: 0,
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: s.iconBg,
            color: s.iconColor,
            width: 'clamp(38px, 4.5vw, 46px)',
            height: 'clamp(38px, 4.5vw, 46px)',
            minWidth: '38px',
            boxShadow: `0 4px 12px ${s.blob}`,
          }}
        >
          {icon}
        </div>

        {/* Text */}
        <div style={{ minWidth: 0, flex: 1 }}>
          <p
            style={{
              fontSize: 'clamp(0.65rem, 1.1vw, 0.75rem)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              color: subColor,
              marginBottom: '5px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {title}
          </p>
          <p
            style={{
              fontSize: 'clamp(1.4rem, 3vw, 2rem)',
              fontWeight: 800,
              letterSpacing: '-0.04em',
              color: valueColor,
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {value}
          </p>
          {change && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                marginTop: '7px',
                padding: '3px 9px',
                borderRadius: '999px',
                fontSize: 'clamp(0.6rem, 0.9vw, 0.7rem)',
                fontWeight: 700,
                background: s.pillBg,
                color: s.pillColor,
                letterSpacing: '0.01em',
              }}
            >
              {change.positive !== false ? '↑ ' : '↓ '}{change.value}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default StatsCard;
