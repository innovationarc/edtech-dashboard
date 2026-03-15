// Card.tsx — Multi-style card driven by cardStyle setting
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
  enterDelay?: number;
  accent?: string;
}

const PAD = { none:'0', sm:'14px 18px', md:'22px 26px', lg:'30px 36px' };

const NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

const hexRgb = (hex: string) => {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
};

let _inj = false;
const injectStyles = () => {
  if (_inj || typeof document==='undefined') return;
  _inj = true;
  const s = document.createElement('style');
  s.textContent = `
    @keyframes cardReveal {
      0%   { opacity:0; transform:translateY(28px) scale(0.96); }
      100% { opacity:1; transform:translateY(0)    scale(1);    }
    }
    @keyframes shimPass {
      0%   { transform:translateX(-120%) skewX(-12deg); }
      100% { transform:translateX(220%)  skewX(-12deg); }
    }
    @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.45} }
  `;
  document.head.appendChild(s);
};

// ─── Style definitions ────────────────────────────────────────────────────────

const STYLES: Record<string, {
  bg: (dark: boolean, pRgb: string) => string;
  backdropFilter: string;
  border: (dark: boolean, pRgb: string) => string;
  borderRadius: number;
  baseShadow: (dark: boolean, pRgb: string) => string;
  hoverShadow: (dark: boolean, pRgb: string) => string;
}> = {

  // 1. Liquid Glass (default) — theme-aware, no border, soft glass
  liquid: {
    bg: (dark) => dark
      ? 'color-mix(in srgb, var(--color-card) 38%, transparent)'
      : 'rgba(255,255,255,0.44)',
    backdropFilter: 'blur(40px) saturate(180%) brightness(1.04)',
    border: () => 'none',
    borderRadius: 24,
    baseShadow: (dark) => dark
      ? '0 4px 24px rgba(0,0,0,0.28),0 12px 40px rgba(0,0,0,0.20),inset 0 1px 0 rgba(255,255,255,0.18)'
      : '0 1px 2px rgba(0,0,0,0.04),0 4px 12px rgba(0,0,0,0.07),0 16px 40px rgba(0,0,0,0.09),inset 0 1px 0 rgba(255,255,255,1)',
    hoverShadow: (dark) => dark
      ? '0 6px 32px rgba(0,0,0,0.34),0 20px 56px rgba(0,0,0,0.26),inset 0 1px 0 rgba(255,255,255,0.22)'
      : '0 2px 6px rgba(0,0,0,0.06),0 8px 28px rgba(0,0,0,0.12),0 24px 60px rgba(0,0,0,0.14),inset 0 1px 0 rgba(255,255,255,1)',
  },

  // 2. Crystal — tinted glass with noise + cursor glow
  crystal: {
    bg: (dark) => dark ? 'rgba(22,26,37,0.82)' : 'rgba(255,255,255,0.80)',
    backdropFilter: 'blur(28px) saturate(190%)',
    border: (dark) => dark ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(255,255,255,0.95)',
    borderRadius: 20,
    baseShadow: (dark) => dark
      ? '0 4px 24px rgba(0,0,0,0.35),0 1px 2px rgba(0,0,0,0.2),inset 0 1px 0 rgba(255,255,255,0.07)'
      : '0 4px 24px rgba(0,0,0,0.08),0 1px 2px rgba(0,0,0,0.04),inset 0 1px 0 rgba(255,255,255,1)',
    hoverShadow: (dark) => dark
      ? '0 20px 48px rgba(0,0,0,0.5),0 4px 8px rgba(0,0,0,0.3),inset 0 1px 0 rgba(255,255,255,0.10)'
      : '0 20px 48px rgba(0,0,0,0.14),0 4px 8px rgba(0,0,0,0.06),inset 0 1px 0 rgba(255,255,255,1)',
  },

  // 3. Solid — fully opaque, flat, no blur
  solid: {
    bg: (dark) => dark ? 'var(--color-card)' : '#ffffff',
    backdropFilter: 'none',
    border: (dark) => dark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.08)',
    borderRadius: 16,
    baseShadow: (dark) => dark
      ? '0 2px 8px rgba(0,0,0,0.4),0 8px 24px rgba(0,0,0,0.28)'
      : '0 1px 4px rgba(0,0,0,0.06),0 4px 16px rgba(0,0,0,0.08)',
    hoverShadow: (dark) => dark
      ? '0 4px 16px rgba(0,0,0,0.5),0 16px 40px rgba(0,0,0,0.36)'
      : '0 2px 8px rgba(0,0,0,0.1),0 8px 32px rgba(0,0,0,0.12)',
  },

  // 4. Glassmorphism — classic frosted glass with colored border
  glassmorphism: {
    bg: (dark, pRgb) => dark ? `rgba(${pRgb},0.08)` : 'rgba(255,255,255,0.55)',
    backdropFilter: 'blur(20px) saturate(180%)',
    border: (dark, pRgb) => dark ? `1px solid rgba(${pRgb},0.22)` : '1px solid rgba(255,255,255,0.7)',
    borderRadius: 20,
    baseShadow: (dark, pRgb) => dark
      ? `0 8px 32px rgba(${pRgb},0.15),0 2px 8px rgba(0,0,0,0.3),inset 0 1px 0 rgba(${pRgb},0.12)`
      : '0 8px 32px rgba(0,0,0,0.08),inset 0 1px 0 rgba(255,255,255,0.9)',
    hoverShadow: (dark, pRgb) => dark
      ? `0 16px 48px rgba(${pRgb},0.25),0 4px 16px rgba(0,0,0,0.4),inset 0 1px 0 rgba(${pRgb},0.18)`
      : '0 16px 48px rgba(0,0,0,0.14),inset 0 1px 0 rgba(255,255,255,1)',
  },

  // 5. Vintage — warm aged paper
  vintage: {
    bg: (dark) => dark
      ? 'linear-gradient(145deg, rgba(45,35,20,0.92), rgba(35,28,16,0.88))'
      : 'linear-gradient(145deg, rgba(253,246,227,0.97), rgba(245,232,196,0.95))',
    backdropFilter: 'blur(4px)',
    border: (dark) => dark ? '1px solid rgba(180,140,60,0.22)' : '1px solid rgba(180,140,60,0.35)',
    borderRadius: 12,
    baseShadow: (dark) => dark
      ? '0 4px 20px rgba(0,0,0,0.5),inset 0 1px 0 rgba(180,140,60,0.15),inset 0 -1px 0 rgba(0,0,0,0.3)'
      : '0 4px 20px rgba(100,70,20,0.15),inset 0 1px 0 rgba(255,255,255,0.8)',
    hoverShadow: (dark) => dark
      ? '0 8px 32px rgba(0,0,0,0.6),inset 0 1px 0 rgba(180,140,60,0.2)'
      : '0 8px 32px rgba(100,70,20,0.22),inset 0 1px 0 rgba(255,255,255,0.9)',
  },

  // 6. Neon — dark base with glowing primary-color border
  neon: {
    bg: (dark) => dark ? 'rgba(8,8,20,0.88)' : 'rgba(240,240,255,0.92)',
    backdropFilter: 'blur(16px)',
    border: (dark, pRgb) => `1px solid rgba(${pRgb},${dark ? 0.7 : 0.5})`,
    borderRadius: 18,
    baseShadow: (_dark, pRgb) =>
      `0 0 0 1px rgba(${pRgb},0.15),0 4px 24px rgba(${pRgb},0.25),inset 0 0 20px rgba(${pRgb},0.04)`,
    hoverShadow: (_dark, pRgb) =>
      `0 0 0 1px rgba(${pRgb},0.4),0 8px 40px rgba(${pRgb},0.45),inset 0 0 30px rgba(${pRgb},0.08)`,
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

const Card = ({
  children, className, title, subtitle, icon, footer,
  onClick, tilt=true, padding='md', enterDelay=0,
}: CardProps) => {
  const { theme, cardStyle = 'liquid', primaryColor = '#6366f1' } = useDashboard();
  const dark = theme !== 'light';
  const cardRef = useRef<HTMLDivElement>(null);
  const shimRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => { injectStyles(); }, []);

  const pRgb = primaryColor.startsWith('#') ? hexRgb(primaryColor) : '99,102,241';
  const S = STYLES[cardStyle] ?? STYLES.liquid;

  const bg          = S.bg(dark, pRgb);
  const border      = S.border(dark, pRgb);
  const baseShadow  = S.baseShadow(dark, pRgb);
  const hoverShadow = S.hoverShadow(dark, pRgb);
  const radius      = S.borderRadius;

  const titleClr    = dark ? 'rgba(241,245,249,0.97)' : (cardStyle === 'vintage' ? '#3d2b00' : '#0f172a');
  const subtitleClr = dark ? 'rgba(148,163,184,0.55)' : (cardStyle === 'vintage' ? '#7a5c20' : '#64748b');
  const iconBg      = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.045)';
  const iconBd      = dark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)';
  const footBg      = dark ? 'rgba(0,0,0,0.22)'       : 'rgba(0,0,0,0.022)';
  const dividerClr  = dark ? 'rgba(255,255,255,0.06)'  : 'rgba(0,0,0,0.06)';

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!tilt) return;
    const el = cardRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    el.style.transform = `perspective(1200px) rotateX(${((y - r.height/2) / r.height) * -7}deg) rotateY(${((x - r.width/2) / r.width) * 7}deg) translateZ(6px) scale(1.012)`;
    el.style.boxShadow = hoverShadow;
    if (glowRef.current) {
      glowRef.current.style.left = `${x}px`;
      glowRef.current.style.top  = `${y}px`;
      glowRef.current.style.opacity = '1';
    }
  };

  const onEnter = () => {
    const sh = shimRef.current; if (!sh) return;
    sh.style.animation = 'none';
    void sh.offsetWidth;
    sh.style.animation = 'shimPass 600ms ease forwards';
  };

  const onLeave = () => {
    const el = cardRef.current;
    if (el) { el.style.transform = 'none'; el.style.boxShadow = baseShadow; }
    if (glowRef.current) glowRef.current.style.opacity = '0';
  };

  return (
    <div
      ref={cardRef}
      className={clsx('relative overflow-hidden', className)}
      style={{
        background: bg,
        backdropFilter: S.backdropFilter,
        WebkitBackdropFilter: S.backdropFilter,
        border,
        borderRadius: radius,
        boxShadow: baseShadow,
        fontFamily: "'Outfit', sans-serif",
        cursor: onClick ? 'pointer' : 'default',
        isolation: 'isolate',
        transformStyle: tilt ? 'preserve-3d' : 'flat',
        transition: 'transform 0.26s cubic-bezier(0.23,1,0.32,1), box-shadow 0.26s ease',
        animation: `cardReveal 500ms cubic-bezier(0.22,1,0.36,1) ${enterDelay}ms both`,
      }}
      onClick={onClick}
      onMouseMove={onMove}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {/* Shimmer sweep — all styles */}
      <div ref={shimRef} style={{
        position:'absolute', inset:0, pointerEvents:'none', zIndex:5,
        background:`linear-gradient(108deg,transparent 15%,rgba(255,255,255,${dark?0.04:0.18}) 50%,transparent 85%)`,
        transform:'translateX(-120%) skewX(-12deg)',
      }}/>

      {/* Crystal: noise texture */}
      {cardStyle === 'crystal' && (
        <div style={{position:'absolute',inset:0,borderRadius:radius,pointerEvents:'none',zIndex:1,background:NOISE,opacity:dark?0.045:0.028,mixBlendMode:'overlay'}}/>
      )}
      {/* Crystal: top edge shimmer line */}
      {cardStyle === 'crystal' && (
        <div style={{position:'absolute',top:0,left:0,right:0,height:1,borderRadius:`${radius}px ${radius}px 0 0`,pointerEvents:'none',zIndex:2,
          background:dark
            ?'linear-gradient(90deg,transparent,rgba(255,255,255,0.18) 30%,rgba(255,255,255,0.30) 50%,rgba(255,255,255,0.18) 70%,transparent)'
            :'linear-gradient(90deg,transparent,rgba(255,255,255,0.9) 30%,rgba(255,255,255,1) 50%,rgba(255,255,255,0.9) 70%,transparent)',
        }}/>
      )}
      {/* Crystal: cursor glow */}
      {cardStyle === 'crystal' && (
        <div ref={glowRef} style={{position:'absolute',pointerEvents:'none',zIndex:1,width:220,height:220,borderRadius:'50%',transform:'translate(-50%,-50%)',background:`radial-gradient(circle, rgba(${pRgb},${dark?0.22:0.18}) 0%, transparent 65%)`,opacity:0,transition:'opacity 0.2s ease',left:'50%',top:'50%'}}/>
      )}

      {/* Vintage: paper grain */}
      {cardStyle === 'vintage' && (
        <div style={{position:'absolute',inset:0,borderRadius:radius,pointerEvents:'none',zIndex:1,background:NOISE,opacity:0.06,mixBlendMode:'multiply'}}/>
      )}

      {/* Neon: inner glow */}
      {cardStyle === 'neon' && (
        <div style={{position:'absolute',inset:0,borderRadius:radius,pointerEvents:'none',zIndex:1,background:`radial-gradient(ellipse at 50% 0%, rgba(${pRgb},0.08) 0%, transparent 60%)`}}/>
      )}

      {/* Content */}
      <div style={{ position:'relative', zIndex:6 }}>
        {(title || subtitle || icon) && (
          <div style={{
            padding:'17px 22px 14px',
            borderBottom: cardStyle === 'crystal' ? `1px solid ${dividerClr}` : 'none',
            display:'flex', justifyContent:'space-between', alignItems:'center',
          }}>
            <div style={{ minWidth:0, flex:1 }}>
              {title && <h3 style={{fontSize:'0.94rem',fontWeight:700,color:titleClr,letterSpacing:'-0.015em',lineHeight:1.3,margin:0}}>{title}</h3>}
              {subtitle && <p style={{fontSize:'0.71rem',color:subtitleClr,margin:'3px 0 0',lineHeight:1.4}}>{subtitle}</p>}
            </div>
            {icon && (
              <div style={{marginLeft:12,flexShrink:0,width:32,height:32,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',background:iconBg,border:`1px solid ${iconBd}`}}>
                {icon}
              </div>
            )}
          </div>
        )}
        <div style={{ padding: PAD[padding] }}>{children}</div>
        {footer && <div style={{padding:'12px 22px',background:footBg}}>{footer}</div>}
      </div>
    </div>
  );
};

export default Card;
