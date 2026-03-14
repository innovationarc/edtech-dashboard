// Card.tsx — Premium frosted silver-glass card + staggered entrance animation
import { ReactNode, useRef, useEffect } from 'react';
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
  enterDelay?: number; // ms — stagger entrance animation
}

const PADDING = { none: '0', sm: '14px 18px', md: '22px 26px', lg: '30px 36px' };
const NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

// Inject global keyframes once
let _stylesInjected = false;
const injectCardStyles = () => {
  if (_stylesInjected || typeof document === 'undefined') return;
  _stylesInjected = true;
  const el = document.createElement('style');
  el.textContent = `
    @keyframes cardEnter {
      0%   { opacity:0; transform:translateY(24px) scale(0.965); filter:blur(2px); }
      60%  { filter:blur(0); }
      100% { opacity:1; transform:translateY(0) scale(1); filter:blur(0); }
    }
    @keyframes shimmerSweep {
      0%   { transform:translateX(-120%) skewX(-12deg); }
      100% { transform:translateX(220%) skewX(-12deg); }
    }
    @keyframes pulse {
      0%,100% { opacity:1; transform:scale(1); }
      50%     { opacity:0.55; transform:scale(1.18); }
    }
  `;
  document.head.appendChild(el);
};

const hexRgb = (hex: string) => {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
};

const Card = ({
  children, className, title, subtitle, icon, footer,
  onClick, hover = false, tilt = true, variant = 'default', padding = 'md',
  enterDelay = 0,
}: CardProps) => {
  const { theme, primaryColor = '#6366f1' } = useDashboard();
  const isLight = theme === 'light';
  const cardRef  = useRef<HTMLDivElement>(null);
  const glowRef  = useRef<HTMLDivElement>(null);
  const shimRef  = useRef<HTMLDivElement>(null);
  const pRgb = hexRgb(primaryColor);

  useEffect(() => { injectCardStyles(); }, []);

  // ── Glass base ────────────────────────────────────────────────────────────
  const bg = isLight
    ? 'rgba(255,255,255,0.78)'
    : 'rgba(12,16,30,0.72)';

  const glassOverlay = isLight
    ? 'linear-gradient(135deg,rgba(255,255,255,0.60) 0%,rgba(255,255,255,0.12) 50%,rgba(220,230,255,0.05) 100%)'
    : 'linear-gradient(135deg,rgba(255,255,255,0.095) 0%,rgba(190,200,255,0.028) 42%,rgba(99,102,241,0.025) 100%)';

  const border = isLight
    ? '1px solid rgba(255,255,255,0.97)'
    : '1px solid rgba(255,255,255,0.12)';

  const baseShadow = isLight
    ? '0 6px 32px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,1)'
    : [
        '0 12px 48px rgba(0,0,0,0.58)',
        '0 5px 16px rgba(0,0,0,0.38)',
        '0 1px 4px rgba(0,0,0,0.28)',
        'inset 0 1px 0 rgba(255,255,255,0.12)',
        'inset 0 0 0 1px rgba(255,255,255,0.048)',
      ].join(', ');

  const hoverShadow = isLight
    ? '0 22px 56px rgba(0,0,0,0.15), 0 6px 14px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,1)'
    : [
        '0 28px 72px rgba(0,0,0,0.68)',
        '0 12px 32px rgba(0,0,0,0.48)',
        '0 3px 8px rgba(0,0,0,0.32)',
        `0 0 0 1px rgba(${pRgb},0.24)`,
        'inset 0 1px 0 rgba(255,255,255,0.16)',
        `inset 0 0 40px rgba(${pRgb},0.04)`,
      ].join(', ');

  const titleColor    = isLight ? '#0f172a' : 'rgba(241,245,249,0.97)';
  const subtitleColor = isLight ? '#64748b' : 'rgba(148,163,184,0.60)';
  const dividerColor  = isLight ? 'rgba(0,0,0,0.058)' : 'rgba(255,255,255,0.065)';
  const footerBg      = isLight ? 'rgba(0,0,0,0.025)' : 'rgba(0,0,0,0.24)';
  const iconPillBg    = isLight ? 'rgba(0,0,0,0.048)' : 'rgba(255,255,255,0.075)';
  const iconPillBord  = isLight ? 'rgba(0,0,0,0.058)' : 'rgba(255,255,255,0.095)';

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!tilt) return;
    const el  = cardRef.current;
    const glow = glowRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const rotX = ((y - cy) / cy) * -7;
    const rotY = ((x - cx) / cx) *  7;
    el.style.transform = `perspective(1000px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateZ(8px) scale(1.018)`;
    el.style.boxShadow = hoverShadow;
    if (glow) {
      glow.style.left    = `${x}px`;
      glow.style.top     = `${y}px`;
      glow.style.opacity = isLight ? '0.50' : '0.40';
    }
  };

  const handleMouseEnter = () => {
    // One-shot shimmer sweep on hover
    if (shimRef.current) {
      shimRef.current.style.animation = 'none';
      // Trigger reflow
      void shimRef.current.offsetWidth;
      shimRef.current.style.animation = 'shimmerSweep 520ms cubic-bezier(0.4,0,0.2,1) forwards';
    }
  };

  const handleMouseLeave = () => {
    if (!tilt) return;
    const el   = cardRef.current;
    const glow = glowRef.current;
    if (el) {
      el.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0px) scale(1)';
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
        backdropFilter: 'blur(48px) saturate(220%) brightness(1.04)',
        WebkitBackdropFilter: 'blur(48px) saturate(220%) brightness(1.04)',
        border,
        borderRadius: 24,
        boxShadow: baseShadow,
        fontFamily: "'Outfit', sans-serif",
        transition: 'transform 0.22s cubic-bezier(0.23,1,0.32,1), box-shadow 0.22s ease',
        cursor: onClick ? 'pointer' : 'default',
        isolation: 'isolate',
        transformStyle: tilt ? 'preserve-3d' : 'flat',
        animation: `cardEnter 600ms cubic-bezier(0.22,1,0.36,1) ${enterDelay}ms both`,
      }}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* ① Diagonal silver-glass gradient sheen */}
      <div style={{
        position:'absolute', inset:0, borderRadius:24, pointerEvents:'none', zIndex:1,
        background: glassOverlay,
      }}/>

      {/* ② Noise sparkle micro-texture */}
      <div style={{
        position:'absolute', inset:0, borderRadius:24, pointerEvents:'none', zIndex:1,
        background: NOISE,
        opacity: isLight ? 0.024 : 0.040,
        mixBlendMode:'overlay',
      }}/>

      {/* ③ Top-edge glass rim highlight */}
      <div style={{
        position:'absolute', top:0, left:0, right:0, height:1,
        borderRadius:'24px 24px 0 0', pointerEvents:'none', zIndex:6,
        background: isLight
          ? 'linear-gradient(90deg,transparent 3%,rgba(255,255,255,0.92) 25%,rgba(255,255,255,1) 50%,rgba(255,255,255,0.92) 75%,transparent 97%)'
          : 'linear-gradient(90deg,transparent 3%,rgba(255,255,255,0.22) 25%,rgba(255,255,255,0.44) 50%,rgba(255,255,255,0.22) 75%,transparent 97%)',
      }}/>

      {/* ④ Left-edge partial shimmer */}
      <div style={{
        position:'absolute', top:0, left:0, bottom:0, width:1,
        borderRadius:'24px 0 0 24px', pointerEvents:'none', zIndex:6,
        background: isLight
          ? 'linear-gradient(180deg,rgba(255,255,255,0.90) 0%,rgba(255,255,255,0.30) 50%,transparent 100%)'
          : 'linear-gradient(180deg,rgba(255,255,255,0.20) 0%,rgba(255,255,255,0.07) 45%,transparent 100%)',
      }}/>

      {/* ⑤ Bottom-right subtle gradient fade */}
      <div style={{
        position:'absolute', bottom:0, right:0, width:'55%', height:'45%',
        borderRadius:'0 0 24px 0', pointerEvents:'none', zIndex:0,
        background: isLight
          ? 'radial-gradient(ellipse at bottom right,rgba(220,220,255,0.08) 0%,transparent 70%)'
          : `radial-gradient(ellipse at bottom right,rgba(${pRgb},0.055) 0%,transparent 70%)`,
      }}/>

      {/* ⑥ Hover shimmer sweep */}
      <div ref={shimRef} style={{
        position:'absolute', top:0, bottom:0, left:0, width:'40%',
        pointerEvents:'none', zIndex:5,
        background: isLight
          ? 'linear-gradient(105deg,transparent 20%,rgba(255,255,255,0.40) 50%,transparent 80%)'
          : 'linear-gradient(105deg,transparent 20%,rgba(255,255,255,0.07) 50%,transparent 80%)',
        opacity:1,
        transform:'translateX(-120%) skewX(-12deg)',
      }}/>

      {/* ⑦ Cursor glow */}
      <div ref={glowRef} style={{
        position:'absolute', pointerEvents:'none', zIndex:2,
        width:300, height:300, borderRadius:'50%',
        transform:'translate(-50%,-50%)',
        background:`radial-gradient(circle,rgba(${pRgb},${isLight?0.13:0.19}) 0%,transparent 65%)`,
        opacity:0,
        transition:'opacity 0.28s ease',
        left:'50%', top:'50%',
      }}/>

      {/* ⑧ Corner accent tint */}
      <div style={{
        position:'absolute', top:-60, right:-60, width:190, height:190,
        borderRadius:'50%', pointerEvents:'none', zIndex:0,
        background:`radial-gradient(circle,rgba(${pRgb},${isLight?0.06:0.085}) 0%,transparent 70%)`,
        filter:'blur(26px)',
      }}/>

      {/* ⑨ Content */}
      <div style={{position:'relative', zIndex:7}}>
        {(title || subtitle || icon) && (
          <div style={{
            padding: '18px 26px 15px',
            borderBottom:`1px solid ${dividerColor}`,
            display:'flex', justifyContent:'space-between', alignItems:'center',
          }}>
            <div className="min-w-0 flex-1">
              {title && (
                <h3 style={{
                  fontSize:'0.96rem', fontWeight:700, color:titleColor,
                  letterSpacing:'-0.015em', lineHeight:1.3, margin:0,
                }}>
                  {title}
                </h3>
              )}
              {subtitle && (
                <p style={{fontSize:'0.73rem',color:subtitleColor,margin:'3px 0 0',lineHeight:1.4}}>
                  {subtitle}
                </p>
              )}
            </div>
            {icon && (
              <div style={{
                marginLeft:14, flexShrink:0,
                width:32, height:32, borderRadius:10,
                display:'flex', alignItems:'center', justifyContent:'center',
                background:iconPillBg, border:`1px solid ${iconPillBord}`,
                backdropFilter:'blur(8px)',
              }}>
                {icon}
              </div>
            )}
          </div>
        )}
        <div style={{padding:PADDING[padding]}}>{children}</div>
        {footer && (
          <div style={{padding:'14px 26px',borderTop:`1px solid ${dividerColor}`,background:footerBg}}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Card;
