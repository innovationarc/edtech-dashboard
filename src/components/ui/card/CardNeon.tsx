// CardNeon.tsx — Dark base with glowing primary-color border
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
  s.textContent = `@keyframes cardReveal{0%{opacity:0;transform:translateY(28px) scale(0.96)}100%{opacity:1;transform:translateY(0) scale(1)}}@keyframes shimPass{0%{transform:translateX(-120%) skewX(-12deg)}100%{transform:translateX(220%) skewX(-12deg)}}`;
  document.head.appendChild(s);
};

const hexRgb = (hex: string) => `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`;

const CardNeon = ({
  children, className, title, subtitle, icon, footer,
  onClick, tilt=true, padding='md', enterDelay=0,
}: CardProps) => {
  const { theme, primaryColor = '#6366f1' } = useDashboard();
  const dark = theme !== 'light';
  const cardRef = useRef<HTMLDivElement>(null);
  const shimRef = useRef<HTMLDivElement>(null);
  useEffect(() => { injectStyles(); }, []);

  const pRgb        = primaryColor.startsWith('#') ? hexRgb(primaryColor) : '99,102,241';
  const bg          = dark ? 'color-mix(in srgb, var(--color-card) 88%, rgba(0,0,0,1))' : 'rgba(240,240,255,0.92)';
  const border      = `1px solid rgba(${pRgb},${dark?0.7:0.5})`;
  const baseShadow  = `0 0 0 1px rgba(${pRgb},0.15),0 4px 24px rgba(${pRgb},0.25),inset 0 0 20px rgba(${pRgb},0.04)`;
  const hoverShadow = `0 0 0 1px rgba(${pRgb},0.4),0 8px 40px rgba(${pRgb},0.45),inset 0 0 30px rgba(${pRgb},0.08)`;
  const titleClr    = dark ? 'rgba(241,245,249,0.97)' : '#0f172a';
  const subtitleClr = dark ? 'rgba(148,163,184,0.50)' : '#64748b';
  const footBg      = dark ? 'rgba(0,0,0,0.3)' : `rgba(${pRgb},0.04)`;
  const iconBg      = dark ? `rgba(${pRgb},0.12)` : `rgba(${pRgb},0.08)`;
  const iconBd      = `rgba(${pRgb},${dark?0.3:0.2})`;

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!tilt) return;
    const el = cardRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.transform = `perspective(1200px) rotateX(${((e.clientY-r.top-r.height/2)/r.height)*-7}deg) rotateY(${((e.clientX-r.left-r.width/2)/r.width)*7}deg) translateZ(6px) scale(1.012)`;
    el.style.boxShadow = hoverShadow;
  };
  const onEnter = () => { const sh=shimRef.current; if(!sh)return; sh.style.animation='none'; void sh.offsetWidth; sh.style.animation='shimPass 600ms ease forwards'; };
  const onLeave = () => { const el=cardRef.current; if(el){el.style.transform='none';el.style.boxShadow=baseShadow;} };

  return (
    <div ref={cardRef} className={clsx('relative overflow-hidden', className)}
      style={{ background:bg, backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)', border, borderRadius:18, boxShadow:baseShadow, fontFamily:"'Outfit',sans-serif", cursor:onClick?'pointer':'default', isolation:'isolate', transformStyle:tilt?'preserve-3d':'flat', transition:'transform 0.26s cubic-bezier(0.23,1,0.32,1),box-shadow 0.26s ease', animation:`cardReveal 500ms cubic-bezier(0.22,1,0.36,1) ${enterDelay}ms both` }}
      onClick={onClick} onMouseMove={onMove} onMouseEnter={onEnter} onMouseLeave={onLeave}>
      {/* Shimmer */}
      <div ref={shimRef} style={{position:'absolute',inset:0,pointerEvents:'none',zIndex:5,background:`linear-gradient(108deg,transparent 15%,rgba(${pRgb},${dark?0.08:0.12}) 50%,transparent 85%)`,transform:'translateX(-120%) skewX(-12deg)'}}/>
      {/* Inner top glow */}
      <div style={{position:'absolute',inset:0,borderRadius:18,pointerEvents:'none',zIndex:1,background:`radial-gradient(ellipse at 50% 0%,rgba(${pRgb},0.10) 0%,transparent 60%)`}}/>
      <div style={{position:'relative',zIndex:6}}>
        {(title||subtitle||icon)&&(
          <div style={{padding:'17px 22px 14px',borderBottom:`1px solid rgba(${pRgb},${dark?0.15:0.1})`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div style={{minWidth:0,flex:1}}>
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

export default CardNeon;
