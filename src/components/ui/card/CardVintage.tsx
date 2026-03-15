// CardVintage.tsx — Warm aged paper with grain texture
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
const NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

let _inj = false;
const injectStyles = () => {
  if (_inj || typeof document==='undefined') return; _inj = true;
  const s = document.createElement('style');
  s.textContent = `@keyframes cardReveal{0%{opacity:0;transform:translateY(28px) scale(0.96)}100%{opacity:1;transform:translateY(0) scale(1)}}`;
  document.head.appendChild(s);
};

const CardVintage = ({
  children, className, title, subtitle, icon, footer,
  onClick, tilt=true, padding='md', enterDelay=0,
}: CardProps) => {
  const { theme } = useDashboard();
  const dark = theme !== 'light';
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => { injectStyles(); }, []);

  const bg          = dark
    ? 'color-mix(in srgb, var(--color-card) 88%, rgba(45,35,20,1))'
    : 'linear-gradient(145deg,rgba(253,246,227,0.97),rgba(245,232,196,0.95))';
  const border      = dark ? '1px solid rgba(180,140,60,0.22)' : '1px solid rgba(180,140,60,0.35)';
  const baseShadow  = dark ? '0 4px 20px rgba(0,0,0,0.5),inset 0 1px 0 rgba(180,140,60,0.15)' : '0 4px 20px rgba(100,70,20,0.15),inset 0 1px 0 rgba(255,255,255,0.8)';
  const hoverShadow = dark ? '0 8px 32px rgba(0,0,0,0.6),inset 0 1px 0 rgba(180,140,60,0.2)' : '0 8px 32px rgba(100,70,20,0.22),inset 0 1px 0 rgba(255,255,255,0.9)';
  const titleClr    = dark ? 'rgba(230,210,160,0.95)' : '#3d2b00';
  const subtitleClr = dark ? 'rgba(180,155,100,0.70)' : '#7a5c20';
  const footBg      = dark ? 'rgba(0,0,0,0.3)' : 'rgba(100,70,20,0.06)';
  const iconBg      = dark ? 'rgba(180,140,60,0.12)' : 'rgba(180,140,60,0.10)';
  const iconBd      = dark ? 'rgba(180,140,60,0.22)' : 'rgba(180,140,60,0.28)';

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!tilt) return;
    const el = cardRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.transform = `perspective(1200px) rotateX(${((e.clientY-r.top-r.height/2)/r.height)*-5}deg) rotateY(${((e.clientX-r.left-r.width/2)/r.width)*5}deg) translateZ(4px) scale(1.008)`;
    el.style.boxShadow = hoverShadow;
  };
  const onLeave = () => { const el=cardRef.current; if(el){el.style.transform='none';el.style.boxShadow=baseShadow;} };

  return (
    <div ref={cardRef} className={clsx('relative overflow-hidden', className)}
      style={{ background:bg, backdropFilter:'blur(4px)', WebkitBackdropFilter:'blur(4px)', border, borderRadius:12, boxShadow:baseShadow, fontFamily:"'Outfit',sans-serif", cursor:onClick?'pointer':'default', isolation:'isolate', transformStyle:tilt?'preserve-3d':'flat', transition:'transform 0.26s cubic-bezier(0.23,1,0.32,1),box-shadow 0.26s ease', animation:`cardReveal 500ms cubic-bezier(0.22,1,0.36,1) ${enterDelay}ms both` }}
      onClick={onClick} onMouseMove={onMove} onMouseLeave={onLeave}>
      {/* Paper grain */}
      <div style={{position:'absolute',inset:0,borderRadius:12,pointerEvents:'none',zIndex:1,background:NOISE,opacity:0.06,mixBlendMode:'multiply'}}/>
      <div style={{position:'relative',zIndex:6}}>
        {(title||subtitle||icon)&&(
          <div style={{padding:'17px 22px 14px',borderBottom:`1px solid ${dark?'rgba(180,140,60,0.15)':'rgba(180,140,60,0.2)'}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
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

export default CardVintage;
