// src/components/ui/StatsCard.tsx — Fluid, adaptive, Outfit font
import { ReactNode } from 'react';
import clsx from 'clsx';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  change?: { value: string | number; positive?: boolean; };
  colorScheme?: 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error';
  onClick?: () => void;
}

const SCHEMES = {
  primary:   { blob: 'rgba(139,92,246,0.12)',  iconBg: '#ede9fe', iconColor: '#7c3aed', pill: { bg: 'rgba(139,92,246,0.15)', color: '#a78bfa' } },
  secondary: { blob: 'rgba(14,165,233,0.12)',   iconBg: '#e0f2fe', iconColor: '#0284c7', pill: { bg: 'rgba(14,165,233,0.15)', color: '#38bdf8' } },
  accent:    { blob: 'rgba(16,185,129,0.12)',   iconBg: '#d1fae5', iconColor: '#059669', pill: { bg: 'rgba(16,185,129,0.15)', color: '#34d399' } },
  success:   { blob: 'rgba(132,204,22,0.12)',   iconBg: '#ecfccb', iconColor: '#65a30d', pill: { bg: 'rgba(132,204,22,0.15)', color: '#a3e635' } },
  warning:   { blob: 'rgba(245,158,11,0.12)',   iconBg: '#fef3c7', iconColor: '#d97706', pill: { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24' } },
  error:     { blob: 'rgba(244,63,94,0.12)',    iconBg: '#ffe4e6', iconColor: '#e11d48', pill: { bg: 'rgba(244,63,94,0.15)', color: '#fb7185' } },
};

const StatsCard = ({ title, value, icon, change, colorScheme = 'primary', onClick }: StatsCardProps) => {
  const s = SCHEMES[colorScheme];

  return (
    <div
      className={clsx('relative rounded-2xl overflow-hidden transition-all duration-300', onClick && 'cursor-pointer hover:scale-[1.02]')}
      style={{
        background: 'var(--color-card, #1f2937)',
        border: '1px solid rgba(255,255,255,0.05)',
        padding: 'clamp(12px, 2vw, 20px)',
        fontFamily: "'Outfit', sans-serif",
      }}
      onClick={onClick}
    >
      {/* Glow blob */}
      <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full blur-2xl pointer-events-none" style={{ background: s.blob }} />

      <div className="relative flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 rounded-xl flex items-center justify-center shadow-sm"
          style={{
            background: s.iconBg,
            color: s.iconColor,
            width: 'clamp(36px, 4.5vw, 44px)',
            height: 'clamp(36px, 4.5vw, 44px)',
            minWidth: '36px',
          }}>
          {icon}
        </div>

        {/* Text */}
        <div className="min-w-0 flex-1">
          <p style={{
            fontSize: 'clamp(0.65rem, 1.1vw, 0.75rem)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'rgba(156,163,175,1)',
            marginBottom: '4px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {title}
          </p>
          <p style={{
            fontSize: 'clamp(1.35rem, 3vw, 2rem)',
            fontWeight: 700,
            letterSpacing: '-0.03em',
            color: 'white',
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {value}
          </p>
          {change && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              marginTop: '6px',
              padding: '2px 8px',
              borderRadius: '999px',
              fontSize: 'clamp(0.6rem, 0.9vw, 0.7rem)',
              fontWeight: 600,
              background: s.pill.bg,
              color: s.pill.color,
            }}>
              {change.positive !== false ? '↑ ' : '↓ '}{change.value}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default StatsCard;
