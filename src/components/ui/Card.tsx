// Card.tsx — Premium frosted silver-glass card
import { ReactNode, useRef } from 'react';
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
  tilt?: boolean;
  variant?: 'default' | 'dark' | 'glass';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const PADDING = { none: '0', sm: '12px 16px', md: '20px 24px', lg: '28px 32px' };
const NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

const hexRgb = (hex: string) => {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
};

const Card = ({
  children, className, title, subtitle, icon, footer,
  onClick, hover = false, tilt = true, variant = 'default', padding = 'md',
}: CardProps) => {
  const { theme, primaryColor = '#6366f1', accentColor = '#8b5cf6' } = useDashboard();
  const isLight = theme === 'light';
  const cardRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const pRgb = hexRgb(primaryColor);

  // ── Glass base ──────────────────────────────────────────────────────────
  const bg = isLight
    ? 'rgba(255,255,255,0.80)'
    : 'rgba(14,18,32,0.70)';   // deep navy — lets backdrop-blur shine

  // Diagonal silver sheen overlaid on the base
  const glassOverlay = isLight
    ? 'linear-gradient(135deg,rgba(255,255,255,0.55) 0%,rgba(255,255,255,0.10) 55%,rgba(235,240,255,0.06) 100%)'
    : 'linear-gradient(135deg,rgba(255,255,255,0.085) 0%,rgba(200,210,255,0.030) 45%,rgba(99,102,241,0.030) 100%)';

  const border = isLight
    ? '1px solid rgba(255,255,255,0.96)'
    : '1px solid rgba(255,255,255,0.115)';

  const baseShadow = isLight
    ? '0 4px 28px rgba(0,0,0,0.09), 0 1px 3px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,1)'
    : [
        '0 10px 40px rgba(0,0,0,0.55)',    // deep ambient
        '0 4px 12px rgba(0,0,0,0.36)',      // mid lift
        '0 1px 3px rgba(0,0,0,0.26)',       // tight crisp
        'inset 0 1px 0 rgba(255,255,255,0.11)',  // top inner highlight
        'inset 0 0 0 1px rgba(255,255,255,0.045)',// inner rim
      ].join(', ');

  const hoverShadow = isLight
    ? '0 20px 50px rgba(0,0,0,0.14), 0 4px 10px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,1)'
    : [
        '0 24px 64px rgba(0,0,0,0.65)',
        '0 10px 28px rgba(0,0,0,0.45)',
        '0 2px 6px rgba(0,0,0,0.30)',
        `0 0 0 1px rgba(${pRgb},0.22)`,    // accent rim on hover
        'inset 0 1px 0 rgba(255,255,255,0.14)',
      ].join(', ');

  const titleColor    = isLight ? '#111827' : 'rgba(241,245,249,0.96)';
  const subtitleColor = isLight ? '#6b7280' : 'rgba(148,163,184,0.62)';
  const dividerColor  = isLight ? 'rgba(0,0,0,0.055)' : 'rgba(255,255,255,0.062)';
  const footerBg      = isLight ? 'rgba(0,0,0,0.025)' : 'rgba(0,0,0,0.22)';
  const iconPillBg    = isLight ? 'rgba(0,0,0,0.05)'  : 'rgba(255,255,255,0.07)';
  const iconPillBord  = isLight ? 'rgba(0,0,0,0.055)' : 'rgba(255,255,255,0.09)';

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!tilt) return;
    const el = cardRef.current;
    const glow = glowRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const rotX = ((y - cy) / cy) * -8;
    const rotY = ((x - cx) / cx) * 8;
    el.style.transform = `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateZ(6px) scale(1.016)`;
    el.style.boxShadow = hoverShadow;
    if (glow) {
      glow.style.left = `${x}px`;
      glow.style.top  = `${y}px`;
      glow.style.opacity = isLight ? '0.55' : '0.42';
    }
  };

  const handleMouseLeave = () => {
    if (!tilt) return;
    const el = cardRef.current;
    const glow = glowRef.current;
    if (el) {
      el.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg) translateZ(0px) scale(1)';
      el.style.boxShadow = baseShadow;
    }
    if (glow) glow.style.opacity = '0';
  };

  return (
    <div
      ref={cardRef}
      className={clsx('relative overflow-hidden', className)}
      style={{
        background: bg,
        backdropFilter: 'blur(42px) saturate(210%) brightness(1.04)',
        WebkitBackdropFilter: 'blur(42px) saturate(210%) brightness(1.04)',
        border,
        borderRadius: 22,
        boxShadow: baseShadow,
        fontFamily: "'Outfit', sans-serif",
        transition: 'transform 0.20s cubic-bezier(0.23,1,0.32,1), box-shadow 0.20s ease',
        cursor: onClick ? 'pointer' : 'default',
        isolation: 'isolate',
        transformStyle: tilt ? 'preserve-3d' : 'flat',
      }}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* ① Diagonal silver-glass gradient sheen */}
      <div style={{
        position:'absolute', inset:0, borderRadius:22, pointerEvents:'none', zIndex:1,
        background: glassOverlay,
      }}/>

      {/* ② Noise sparkle micro-texture */}
      <div style={{
        position:'absolute', inset:0, borderRadius:22, pointerEvents:'none', zIndex:1,
        background: NOISE,
        opacity: isLight ? 0.025 : 0.042,
        mixBlendMode:'overlay',
      }}/>

      {/* ③ Top-edge glass rim highlight (brightest at center) */}
      <div style={{
        position:'absolute', top:0, left:0, right:0, height:1,
        borderRadius:'22px 22px 0 0', pointerEvents:'none', zIndex:4,
        background: isLight
          ? 'linear-gradient(90deg,transparent 4%,rgba(255,255,255,0.92) 28%,rgba(255,255,255,1) 50%,rgba(255,255,255,0.92) 72%,transparent 96%)'
          : 'linear-gradient(90deg,transparent 4%,rgba(255,255,255,0.24) 28%,rgba(255,255,255,0.42) 50%,rgba(255,255,255,0.24) 72%,transparent 96%)',
      }}/>

      {/* ④ Left-edge partial shimmer (light source from top-left) */}
      <div style={{
        position:'absolute', top:0, left:0, bottom:0, width:1,
        borderRadius:'22px 0 0 22px', pointerEvents:'none', zIndex:4,
        background: isLight
          ? 'linear-gradient(180deg,rgba(255,255,255,0.88) 0%,rgba(255,255,255,0.28) 50%,transparent 100%)'
          : 'linear-gradient(180deg,rgba(255,255,255,0.18) 0%,rgba(255,255,255,0.06) 45%,transparent 100%)',
      }}/>

      {/* ⑤ Cursor glow */}
      <div ref={glowRef} style={{
        position:'absolute', pointerEvents:'none', zIndex:2,
        width:280, height:280, borderRadius:'50%',
        transform:'translate(-50%,-50%)',
        background:`radial-gradient(circle,rgba(${pRgb},${isLight?0.14:0.20}) 0%,transparent 65%)`,
        opacity:0,
        transition:'opacity 0.25s ease',
        left:'50%', top:'50%',
      }}/>

      {/* ⑥ Corner accent tint */}
      <div style={{
        position:'absolute', top:-55, right:-55, width:170, height:170,
        borderRadius:'50%', pointerEvents:'none', zIndex:0,
        background:`radial-gradient(circle,rgba(${pRgb},${isLight?0.06:0.09}) 0%,transparent 70%)`,
        filter:'blur(22px)',
      }}/>

      {/* ⑦ Content */}
      <div style={{position:'relative', zIndex:5}}>
        {(title || subtitle || icon) && (
          <div style={{
            padding:'15px 22px 13px',
            borderBottom:`1px solid ${dividerColor}`,
            display:'flex', justifyContent:'space-between', alignItems:'center',
          }}>
            <div className="min-w-0 flex-1">
              {title && (
                <h3 style={{fontSize:'0.93rem',fontWeight:700,color:titleColor,letterSpacing:'-0.01em',lineHeight:1.3,margin:0}}>
                  {title}
                </h3>
              )}
              {subtitle && (
                <p style={{fontSize:'0.72rem',color:subtitleColor,margin:'2px 0 0',lineHeight:1.4}}>
                  {subtitle}
                </p>
              )}
            </div>
            {icon && (
              <div style={{
                marginLeft:12, flexShrink:0,
                width:30, height:30, borderRadius:9,
                display:'flex', alignItems:'center', justifyContent:'center',
                background:iconPillBg, border:`1px solid ${iconPillBord}`,
              }}>
                {icon}
              </div>
            )}
          </div>
        )}
        <div style={{padding:PADDING[padding]}}>{children}</div>
        {footer && (
          <div style={{padding:'12px 22px',borderTop:`1px solid ${dividerColor}`,background:footerBg}}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Card;
