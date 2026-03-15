// CardFrost.tsx — Glassmorphism tint, no border, faded edges like liquid glass
import { ReactNode, useRef, useEffect } from 'react';
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

const PAD = { none:'0', sm:'14px 18px', md:'22px 26px', lg:'30px 36px' };

let _inj = false;
const injectStyles = () => {
  if (_inj || typeof document==='undefined') return; _inj = true;
  const s = document.createElement('style');
  s.textContent = `
    @keyframes cardReveal{0%{opacity:0;transform:translateY(28px) scale(0.96)}100%{opacity:1;transform:translateY(0) scale(1)}}
    @keyframes shimPass{0%{transform:translateX(-120%) skewX(-12deg)}100%{transform:translateX(220%) skewX(-12deg)}}
  `;
  document.head.appendChild(s);
};

const hexRgb = (hex: string) => `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`;

const CardFrost = ({
  children, className, title, subtitle, icon, footer,
  onClick, tilt=true, padding='md', enterDelay=0,
}: CardProps) => {
  const { theme, primaryColor = '#6366f1' } = useDashboard();
  const dark = theme !== 'light';
  const cardRef = useRef<HTMLDivElement>(null);
  const shimRef = useRef<HTMLDivElement>(null);
  useEffect(() => { injectStyles(); }, []);

  const pRgb = primaryColor.startsWith('#') ? hexRgb(primaryColor) : '99,102,241';

  // Glassmorphism tint using theme's primary color — no border
  const bg          = dark
    ? `color-mix(in srgb, rgba(${pRgb},1) 12%, var(--color-card) 88%)`
    : `rgba(${pRgb},0.06)`;
  const baseShadow  = dark
    ? `0 4px 20px rgba(0,0,0,0.22),0 12px 36px rgba(0,0,0,0.18)`
    : `0 1px 2px rgba(0,0,0,0.04),0 4px 12px rgba(0,0,0,0.07),0 16px 40px rgba(0,0,0,0.09),inset 0 1px 0 rgba(255,255,255,1)`;
  const hoverShadow = dark
    ? `0 6px 28px rgba(0,0,0,0.30),0 20px 52px rgba(0,0,0,0.24)`
    : `0 2px 6px rgba(0,0,0,0.06),0 8px 28px rgba(0,0,0,0.12),0 24px 60px rgba(0,0,0,0.14),inset 0 1px 0 rgba(255,255,255,1)`;
  const titleClr    = dark ? 'rgba(241,245,249,0.97)' : '#0f172a';
  const subtitleClr = dark ? 'rgba(148,163,184,0.50)' : '#64748b';
  const footBg      = dark ? 'rgba(0,0,0,0.22)' : 'rgba(0,0,0,0.022)';
  const iconBg      = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.045)';
  const iconBd      = dark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)';

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!tilt) return;
    const el = cardRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.transform = `perspective(1200px) rotateX(${((e.clientY-r.top-r.height/2)/r.height)*-7}deg) rotateY(${((e.clientX-r.left-r.width/2)/r.width)*7}deg) translateZ(6px) scale(1.012)`;
    el.style.boxShadow = hoverShadow;
  };
  const onEnter = () => {
    const sh = shimRef.current; if (!sh) return;
    sh.style.animation = 'none'; void sh.offsetWidth;
    sh.style.animation = 'shimPass 600ms ease forwards';
  };
  const onLeave = () => {
    const el = cardRef.current;
    if (el) { el.style.transform = 'none'; el.style.boxShadow = baseShadow; }
  };

  return (
    <div ref={cardRef} className={clsx('relative overflow-hidden', className)}
      style={{
        background: bg,
        backdropFilter: 'blur(28px) saturate(160%)',
        WebkitBackdropFilter: 'blur(28px) saturate(160%)',
        border: 'none',
        borderRadius: 24,
        boxShadow: baseShadow,
        fontFamily: "'Outfit', sans-serif",
        cursor: onClick ? 'pointer' : 'default',
        isolation: 'isolate',
        transformStyle: tilt ? 'preserve-3d' : 'flat',
        transition: 'transform 0.26s cubic-bezier(0.23,1,0.32,1), box-shadow 0.26s ease',
        animation: `cardReveal 500ms cubic-bezier(0.22,1,0.36,1) ${enterDelay}ms both`,
      }}
      onClick={onClick} onMouseMove={onMove} onMouseEnter={onEnter} onMouseLeave={onLeave}>

      {/* Shimmer sweep */}
      <div ref={shimRef} style={{
        position:'absolute', inset:0, pointerEvents:'none', zIndex:5,
        background:`linear-gradient(108deg,transparent 15%,rgba(255,255,255,${dark?0.05:0.20}) 50%,transparent 85%)`,
        transform:'translateX(-120%) skewX(-12deg)',
      }}/>

      {/* Subtle primary-color inner glow at top */}
      <div style={{
        position:'absolute', inset:0, borderRadius:24, pointerEvents:'none', zIndex:1,
        background:`radial-gradient(ellipse at 50% 0%, rgba(${pRgb},${dark?0.10:0.07}) 0%, transparent 60%)`,
      }}/>

      {/* Content */}
      <div style={{position:'relative', zIndex:6}}>
        {(title||subtitle||icon)&&(
          <div style={{padding:'17px 22px 14px', borderBottom:'none', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <div style={{minWidth:0, flex:1}}>
              {title&&<h3 style={{fontSize:'0.94rem',fontWeight:700,color:titleClr,letterSpacing:'-0.015em',lineHeight:1.3,margin:0}}>{title}</h3>}
              {subtitle&&<p style={{fontSize:'0.71rem',color:subtitleClr,margin:'3px 0 0',lineHeight:1.4}}>{subtitle}</p>}
            </div>
            {icon&&<div style={{marginLeft:12,flexShrink:0,width:32,height:32,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',background:iconBg,border:`1px solid ${iconBd}`}}>{icon}</div>}
          </div>
        )}
        <div style={{padding:PAD[padding]}}>{children}</div>
        {footer&&<div style={{padding:'12px 22px',background:footBg}}>{footer}</div>}
      </div>
    </div>
  );
};

export default CardFrost;
