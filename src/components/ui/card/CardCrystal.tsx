// CardCrystal.tsx — 3D tilt + matte sparkle crystal card
import { ReactNode, useRef } from 'react';
import clsx from 'clsx';
import { useDashboard } from '../../../contexts/DashboardContext';

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  footer?: ReactNode;
  onClick?: () => void;
  hover?: boolean;
  tilt?: boolean;
  variant?: 'default' | 'dark' | 'glass';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  enterDelay?: number;
  accent?: string;
}

const PADDING = { none: '0', sm: '12px 16px', md: '20px 24px', lg: '28px 32px' };
const NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

const hexRgb = (hex: string) => {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
};

const CardCrystal = ({
  children, className, title, subtitle, icon, footer,
  onClick, tilt = true, padding = 'md', enterDelay = 0,
}: CardProps) => {
  const { theme, primaryColor = '#6366f1' } = useDashboard();
  const isLight = theme === 'light';
  const cardRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const pRgb = hexRgb(primaryColor);

  const bg           = isLight ? 'rgba(255,255,255,0.80)' : 'color-mix(in srgb, var(--color-card) 82%, transparent)';
  const border       = isLight ? '1px solid rgba(255,255,255,0.95)' : '1px solid rgba(255,255,255,0.09)';
  const baseShadow   = isLight
    ? '0 4px 24px rgba(0,0,0,0.08),0 1px 2px rgba(0,0,0,0.04),inset 0 1px 0 rgba(255,255,255,1)'
    : '0 4px 24px rgba(0,0,0,0.35),0 1px 2px rgba(0,0,0,0.2),inset 0 1px 0 rgba(255,255,255,0.07)';
  const hoverShadow  = isLight
    ? '0 20px 48px rgba(0,0,0,0.14),0 4px 8px rgba(0,0,0,0.06),inset 0 1px 0 rgba(255,255,255,1)'
    : '0 20px 48px rgba(0,0,0,0.5),0 4px 8px rgba(0,0,0,0.3),inset 0 1px 0 rgba(255,255,255,0.10)';
  const titleColor   = isLight ? '#111827' : 'rgba(241,245,249,0.95)';
  const subtitleColor= isLight ? '#6b7280' : 'rgba(148,163,184,0.7)';
  const dividerColor = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';
  const footerBg     = isLight ? 'rgba(0,0,0,0.025)' : 'rgba(0,0,0,0.15)';

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!tilt) return;
    const el = cardRef.current;
    const glow = glowRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const cx = rect.width / 2, cy = rect.height / 2;
    el.style.transform = `perspective(800px) rotateX(${((y-cy)/cy)*-10}deg) rotateY(${((x-cx)/cx)*10}deg) translateZ(8px) scale(1.02)`;
    el.style.boxShadow = hoverShadow;
    if (glow) { glow.style.left=`${x}px`; glow.style.top=`${y}px`; glow.style.opacity=isLight?'0.6':'0.45'; }
  };

  const handleMouseLeave = () => {
    const el = cardRef.current;
    const glow = glowRef.current;
    if (el) { el.style.transform='perspective(800px) rotateX(0deg) rotateY(0deg) translateZ(0px) scale(1)'; el.style.boxShadow=baseShadow; }
    if (glow) glow.style.opacity='0';
  };

  return (
    <div
      ref={cardRef}
      className={clsx('relative overflow-hidden', className)}
      style={{
        background: bg,
        backdropFilter: 'blur(28px) saturate(190%)',
        WebkitBackdropFilter: 'blur(28px) saturate(190%)',
        border, borderRadius: 20, boxShadow: baseShadow,
        fontFamily: "'Outfit', sans-serif",
        transition: 'transform 0.18s cubic-bezier(0.23,1,0.32,1), box-shadow 0.18s ease',
        cursor: onClick ? 'pointer' : 'default',
        isolation: 'isolate',
        transformStyle: tilt ? 'preserve-3d' : 'flat',
        animation: `cardReveal 500ms cubic-bezier(0.22,1,0.36,1) ${enterDelay}ms both`,
      }}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Noise sparkle texture */}
      <div style={{position:'absolute',inset:0,borderRadius:20,pointerEvents:'none',zIndex:1,background:NOISE,opacity:isLight?0.028:0.045,mixBlendMode:'overlay'}}/>
      {/* Top edge shimmer */}
      <div style={{position:'absolute',top:0,left:0,right:0,height:1,borderRadius:'20px 20px 0 0',pointerEvents:'none',zIndex:2,
        background:isLight
          ?'linear-gradient(90deg,transparent,rgba(255,255,255,0.9) 30%,rgba(255,255,255,1) 50%,rgba(255,255,255,0.9) 70%,transparent)'
          :'linear-gradient(90deg,transparent,rgba(255,255,255,0.18) 30%,rgba(255,255,255,0.30) 50%,rgba(255,255,255,0.18) 70%,transparent)',
      }}/>
      {/* Cursor glow */}
      <div ref={glowRef} style={{position:'absolute',pointerEvents:'none',zIndex:1,width:220,height:220,borderRadius:'50%',transform:'translate(-50%,-50%)',background:`radial-gradient(circle,rgba(${pRgb},${isLight?0.18:0.22}) 0%,transparent 65%)`,opacity:0,transition:'opacity 0.2s ease',left:'50%',top:'50%'}}/>
      {/* Corner accent */}
      <div style={{position:'absolute',top:-40,right:-40,width:130,height:130,borderRadius:'50%',pointerEvents:'none',zIndex:0,background:`radial-gradient(circle,rgba(${pRgb},${isLight?0.07:0.10}) 0%,transparent 70%)`,filter:'blur(14px)'}}/>
      {/* Content */}
      <div style={{position:'relative',zIndex:3}}>
        {(title||subtitle||icon)&&(
          <div style={{padding:'16px 24px',borderBottom:`1px solid ${dividerColor}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div className="min-w-0 flex-1">
              {title&&<h3 style={{fontSize:'0.95rem',fontWeight:700,color:titleColor,letterSpacing:'-0.01em',lineHeight:1.3,margin:0}}>{title}</h3>}
              {subtitle&&<p style={{fontSize:'0.73rem',color:subtitleColor,margin:'2px 0 0',lineHeight:1.4}}>{subtitle}</p>}
            </div>
            {icon&&<div className="ml-3 flex-shrink-0">{icon}</div>}
          </div>
        )}
        <div style={{padding:PADDING[padding]}}>{children}</div>
        {footer&&<div style={{padding:'12px 24px',borderTop:`1px solid ${dividerColor}`,background:footerBg}}>{footer}</div>}
      </div>
    </div>
  );
};

export default CardCrystal;
