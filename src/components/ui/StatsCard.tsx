// src/components/ui/StatsCard.tsx — Professional SaaS card: soft shadows, hover lift, no glow
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
  primary:   { iconBg: 'rgba(139,92,246,0.12)',  iconColor: '#a78bfa', pillBg: 'rgba(139,92,246,0.12)', pillColor: '#a78bfa', borderAccent: 'rgba(139,92,246,0.2)' },
  secondary: { iconBg: 'rgba(14,165,233,0.12)',   iconColor: '#38bdf8', pillBg: 'rgba(14,165,233,0.12)',  pillColor: '#38bdf8', borderAccent: 'rgba(14,165,233,0.2)' },
  accent:    { iconBg: 'rgba(16,185,129,0.12)',   iconColor: '#34d399', pillBg: 'rgba(16,185,129,0.12)',  pillColor: '#34d399', borderAccent: 'rgba(16,185,129,0.2)' },
  success:   { iconBg: 'rgba(132,204,22,0.12)',   iconColor: '#a3e635', pillBg: 'rgba(132,204,22,0.12)',  pillColor: '#a3e635', borderAccent: 'rgba(132,204,22,0.2)' },
  warning:   { iconBg: 'rgba(245,158,11,0.12)',   iconColor: '#fbbf24', pillBg: 'rgba(245,158,11,0.12)',  pillColor: '#fbbf24', borderAccent: 'rgba(245,158,11,0.2)' },
  error:     { iconBg: 'rgba(244,63,94,0.12)',    iconColor: '#fb7185', pillBg: 'rgba(244,63,94,0.12)',   pillColor: '#fb7185', borderAccent: 'rgba(244,63,94,0.2)' },
};

const StatsCard = ({ title, value, icon, change, colorScheme = 'primary', onClick }: StatsCardProps) => {
  const s = SCHEMES[colorScheme];

  return (
    <div
      className={clsx(
        'relative rounded-2xl overflow-hidden stats-card-hover',
        onClick && 'cursor-pointer'
      )}
      style={{
        background: 'var(--color-card, #1f2937)',
        border: '1px solid rgba(255,255,255,0.06)',
        padding: '20px 24px',
        fontFamily: "'Outfit', sans-serif",
        boxShadow: '0 1px 3px rgba(0,0,0,0.2), 0 2px 8px rgba(0,0,0,0.15)',
      }}
      onClick={onClick}
    >
      <div className="relative flex items-start gap-4">
        <div
          className="flex-shrink-0 rounded-xl flex items-center justify-center"
          style={{
            background: s.iconBg,
            color: s.iconColor,
            width: 44,
            height: 44,
            border: `1px solid ${s.borderAccent}`,
          }}
        >
          {icon}
        </div>

        <div className="min-w-0 flex-1">
          <p style={{
            fontSize: '0.7rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            color: 'rgba(156,163,175,0.85)',
            marginBottom: '4px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {title}
          </p>
          <p style={{
            fontSize: 'clamp(1.4rem, 2.5vw, 2rem)',
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
              marginTop: '8px',
              padding: '3px 10px',
              borderRadius: '999px',
              fontSize: '0.7rem',
              fontWeight: 600,
              background: s.pillBg,
              color: s.pillColor,
              border: `1px solid ${s.borderAccent}`,
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
