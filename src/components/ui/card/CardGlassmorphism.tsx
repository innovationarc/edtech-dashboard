// CardGlassmorphism.tsx — Primary-color frosted glass with colored border
import { ReactNode, useRef, useEffect } from 'react';
import clsx from 'clsx';
import { useCardAnim } from './useCardAnim';
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

const CardGlassmorphism = ({
  children, className, title, subtitle, icon, footer,
  onClick, tilt=true, padding='md', enterDelay=0,
}: CardProps) => {
  const { theme, primaryColor = '#6366f1' } = useDashboard();
  const dark = theme !== 'light';
  const shimRef = useRef<HTMLDivElement>(null);
  useEffect(() => { injectStyles(); }, []);

  const pRgb        = primaryColor.startsWith('#') ? hexRgb(primaryColor) : '99,102,241';
  const bg          = dark ? `rgba(${pRgb},0.08)` : 'rgba(255,255,255,0.55)';
  const border      = dark ? `1px solid rgba(${pRgb},0.22)` : '1px solid rgba(255,255,255,0.7)';
  const baseShadow  = dark ? `0 8px 32px rgba(${pRgb},0.15),0 2px 8px rgba(0,0,0,0.3),inset 0 1px 0 rgba(${pRgb},0.12)` : '0 8px 32px rgba(0,0,0,0.08),inset 0 1px 0 rgba(255,255,255,0.9)';
  const hoverShadow = dark ? `0 16px 48px rgba(${pRgb},0.25),0 4px 16px rgba(0,0,0,0.4),inset 0 1px 0 rgba(${pRgb},0.18)` : '0 16px 48px rgba(0,0,0,0.14),inset 0 1px 0 rgba(255,255,255,1)';
  const titleClr    = dark ? 'rgba(241,245,249,0.97)' : '#0f172a';
  const subtitleClr = dark ? 'rgba(148,163,184,0.50)' : '#64748b';
  const footBg      = dark ? 'rgba(0,0,0,0.22)' : 'rgba(0,0,0,0.022)';
  const iconBg      = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.045)';
  const iconBd      = dark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)';



  const anim = useCardAnim({ cardAnimation, hoverShadow, baseShadow, primaryRgb: pRgb, isLight: !dark });
  return (
    <div ref={anim.cardRef} className={clsx('relative overflow-hidden', className)}
      style={{ background:bg, backdropFilter:'blur(20px) saturate(180%)', WebkitBackdropFilter:'blur(20px) saturate(180%)', border, borderRadius:20, boxShadow:baseShadow, fontFamily:"'Outfit',sans-serif", cursor:onClick?'pointer':'default', isolation:'isolate', animation:`cardReveal 500ms cubic-bezier(0.22,1,0.36,1) ${enterDelay}ms both` }}
      onClick={onClick} onMouseMove={anim.onMouseMove} onMouseEnter={anim.onMouseEnter} onMouseLeave={anim.onMouseLeave} onTouchStart={anim.onTouchStart} onTouchMove={anim.onTouchMove} onTouchEnd={anim.onTouchEnd} onTouchCancel={anim.onTouchCancel}>
      <div ref={shimRef} style={{position:'absolute',inset:0,pointerEvents:'none',zIndex:5,background:`linear-gradient(108deg,transparent 15%,rgba(255,255,255,${dark?0.06:0.2}) 50%,transparent 85%)`,transform:'translateX(-120%) skewX(-12deg)'}}/>
      <div style={{position:'relative',zIndex:6}}>
        {(title||subtitle||icon)&&(
          <div style={{padding:'17px 22px 14px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
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

export default CardGlassmorphism;
