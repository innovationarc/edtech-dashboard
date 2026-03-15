// CardMatte.tsx — 3D tilt via CSS custom properties + !important
// Uses the same CSS class approach that WORKED, but with smooth per-pixel tilt
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
}

const PADDING = { none: '0', sm: '12px 16px', md: '20px 24px', lg: '28px 32px' };
const NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

const hexRgb = (hex: string) => {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
};

let _inj = false;
const injectStyles = () => {
  if (_inj || typeof document==='undefined') return; _inj = true;
  const s = document.createElement('style');
  s.textContent = `
    @keyframes cardReveal{0%{opacity:0;transform:translateY(28px) scale(0.96)}100%{opacity:1;transform:translateY(0) scale(1)}}

    /* cm-tilt: uses CSS vars set per-frame via JS — !important beats everything */
    .cm-tilt {
      transform: perspective(800px)
        rotateX(var(--cm-rx, 0deg))
        rotateY(var(--cm-ry, 0deg))
        translateZ(var(--cm-tz, 0px))
        scale(var(--cm-sc, 1)) !important;
      transition: transform 0.18s cubic-bezier(0.23,1,0.32,1),
                  box-shadow 0.18s ease !important;
      transform-style: preserve-3d !important;
    }
    .cm-lift {
      transform: translateY(-8px) scale(1.01) !important;
      transition: transform 0.18s cubic-bezier(0.23,1,0.32,1), box-shadow 0.18s ease !important;
    }
    .cm-spring {
      transform: scale(1.04) !important;
      transition: transform 0.4s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.26s ease !important;
    }
    .cm-glow {
      transform: translateY(-2px) !important;
      transition: transform 0.18s ease, box-shadow 0.18s ease !important;
    }
    .cm-magnetic {
      transform: translate(var(--cm-dx,0px), var(--cm-dy,0px)) scale(1.01) !important;
      transition: transform 0.18s cubic-bezier(0.23,1,0.32,1) !important;
    }
  `;
  document.head.appendChild(s);
};

const CardMatte = ({
  children, className, title, subtitle, icon, footer,
  onClick, hover = false, tilt = true, variant = 'default', padding = 'md', enterDelay = 0,
}: CardProps) => {
  const { theme, primaryColor = '#6366f1', accentColor = '#8b5cf6', cardAnimation = 'tilt' } = useDashboard();
  const isLight = theme === 'light';
  const cardRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  useEffect(() => { injectStyles(); }, []);
  const pRgb = hexRgb(primaryColor);

  const bg = isLight ? 'rgba(255,255,255,0.80)' : 'color-mix(in srgb, var(--color-card) 82%, transparent)';
  const border = isLight ? '1px solid rgba(255,255,255,0.95)' : '1px solid rgba(255,255,255,0.09)';
  const baseShadow = isLight
    ? '0 4px 24px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,1)'
    : '0 4px 24px rgba(0,0,0,0.35), 0 1px 2px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.07)';
  const hoverShadow = isLight
    ? '0 20px 48px rgba(0,0,0,0.14), 0 4px 8px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,1)'
    : '0 20px 48px rgba(0,0,0,0.5), 0 4px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.10)';
  const titleColor    = isLight ? '#111827' : 'rgba(241,245,249,0.95)';
  const subtitleColor = isLight ? '#6b7280' : 'rgba(148,163,184,0.7)';
  const dividerColor  = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';
  const footerBg      = isLight ? 'rgba(0,0,0,0.025)' : 'rgba(0,0,0,0.15)';

  const ALL_ANIM_CLASSES = ['cm-tilt','cm-lift','cm-spring','cm-glow','cm-magnetic'];

  const setVar = (el: HTMLDivElement, vars: Record<string,string>) => {
    Object.entries(vars).forEach(([k,v]) => el.style.setProperty(k, v));
  };

  const doTilt = (clientX: number, clientY: number) => {
    const el = cardRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const x = clientX - r.left, y = clientY - r.top;
    const cx = r.width / 2, cy = r.height / 2;
    const rx = ((y - cy) / cy) * -10;
    const ry = ((x - cx) / cx) * 10;
    el.classList.remove(...ALL_ANIM_CLASSES);
    el.classList.add('cm-tilt');
    setVar(el, { '--cm-rx': `${rx}deg`, '--cm-ry': `${ry}deg`, '--cm-tz': '8px', '--cm-sc': '1.02' });
    el.style.boxShadow = hoverShadow;
    const glow = glowRef.current;
    if (glow) { glow.style.left=`${x}px`; glow.style.top=`${y}px`; glow.style.opacity=isLight?'0.6':'0.45'; }
  };

  const doMagnetic = (clientX: number, clientY: number) => {
    const el = cardRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const x = clientX - r.left, y = clientY - r.top;
    const cx = r.width / 2, cy = r.height / 2;
    const dx = ((x - cx) / cx) * 10;
    const dy = ((y - cy) / cy) * 10;
    el.classList.remove(...ALL_ANIM_CLASSES);
    el.classList.add('cm-magnetic');
    setVar(el, { '--cm-dx': `${dx}px`, '--cm-dy': `${dy}px` });
    el.style.boxShadow = hoverShadow;
  };

  const doEnter = () => {
    const el = cardRef.current; if (!el) return;
    el.classList.remove(...ALL_ANIM_CLASSES);
    switch (cardAnimation) {
      case 'lift':   el.classList.add('cm-lift');   el.style.boxShadow = hoverShadow; break;
      case 'spring': el.classList.add('cm-spring'); el.style.boxShadow = hoverShadow; break;
      case 'glow':   el.classList.add('cm-glow');   el.style.boxShadow = `${hoverShadow}, 0 0 28px 6px rgba(${pRgb},0.30)`; break;
      default:       el.style.boxShadow = hoverShadow; break;
    }
  };

  const doReset = () => {
    const el = cardRef.current; if (!el) return;
    el.classList.remove(...ALL_ANIM_CLASSES);
    // Reset CSS vars
    setVar(el, { '--cm-rx':'0deg','--cm-ry':'0deg','--cm-tz':'0px','--cm-sc':'1','--cm-dx':'0px','--cm-dy':'0px' });
    el.style.boxShadow = baseShadow;
    const glow = glowRef.current;
    if (glow) glow.style.opacity = '0';
  };

  const handleMouseMove  = (e: React.MouseEvent<HTMLDivElement>) => {
    if (cardAnimation === 'tilt')     doTilt(e.clientX, e.clientY);
    if (cardAnimation === 'magnetic') doMagnetic(e.clientX, e.clientY);
  };
  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    doEnter();
    if (cardAnimation === 'tilt')     doTilt(e.clientX, e.clientY);
    if (cardAnimation === 'magnetic') doMagnetic(e.clientX, e.clientY);
  };
  const handleMouseLeave = () => doReset();

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    if (cardAnimation === 'tilt')     doTilt(t.clientX, t.clientY);
    if (cardAnimation === 'magnetic') doMagnetic(t.clientX, t.clientY);
    doEnter();
  };
  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    if (cardAnimation === 'tilt')     doTilt(t.clientX, t.clientY);
    if (cardAnimation === 'magnetic') doMagnetic(t.clientX, t.clientY);
  };
  const handleTouchEnd = () => setTimeout(doReset, 350);

  return (
    <div
      ref={cardRef}
      className={clsx('relative overflow-hidden', className)}
      style={{
        background: bg,
        backdropFilter: 'blur(28px) saturate(190%)',
        WebkitBackdropFilter: 'blur(28px) saturate(190%)',
        border,
        borderRadius: 20,
        boxShadow: baseShadow,
        fontFamily: "'Outfit', sans-serif",
        cursor: onClick ? 'pointer' : 'default',
        animation: `cardReveal 500ms cubic-bezier(0.22,1,0.36,1) ${enterDelay}ms both`,
      }}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <div style={{ position:'absolute',inset:0,borderRadius:20,pointerEvents:'none',zIndex:1,background:NOISE,opacity:isLight?0.028:0.045,mixBlendMode:'overlay' }}/>
      <div style={{ position:'absolute',top:0,left:0,right:0,height:1,borderRadius:'20px 20px 0 0',pointerEvents:'none',zIndex:2,background:isLight?'linear-gradient(90deg,transparent,rgba(255,255,255,0.9) 30%,rgba(255,255,255,1) 50%,rgba(255,255,255,0.9) 70%,transparent)':'linear-gradient(90deg,transparent,rgba(255,255,255,0.18) 30%,rgba(255,255,255,0.30) 50%,rgba(255,255,255,0.18) 70%,transparent)' }}/>
      <div ref={glowRef} style={{ position:'absolute',pointerEvents:'none',zIndex:1,width:220,height:220,borderRadius:'50%',transform:'translate(-50%,-50%)',background:`radial-gradient(circle,rgba(${pRgb},${isLight?0.18:0.22}) 0%,transparent 65%)`,opacity:0,transition:'opacity 0.2s ease',left:'50%',top:'50%' }}/>
      <div style={{ position:'absolute',top:-40,right:-40,width:130,height:130,borderRadius:'50%',pointerEvents:'none',zIndex:0,background:`radial-gradient(circle,rgba(${pRgb},${isLight?0.07:0.10}) 0%,transparent 70%)`,filter:'blur(14px)' }}/>
      <div style={{ position:'relative',zIndex:3 }}>
        {(title||subtitle||icon)&&(
          <div style={{ padding:'16px 24px',borderBottom:`1px solid ${dividerColor}`,display:'flex',justifyContent:'space-between',alignItems:'center' }}>
            <div className="min-w-0 flex-1">
              {title&&<h3 style={{ fontSize:'0.95rem',fontWeight:700,color:titleColor,letterSpacing:'-0.01em',lineHeight:1.3,margin:0 }}>{title}</h3>}
              {subtitle&&<p style={{ fontSize:'0.73rem',color:subtitleColor,margin:'2px 0 0',lineHeight:1.4 }}>{subtitle}</p>}
            </div>
            {icon&&<div className="ml-3 flex-shrink-0">{icon}</div>}
          </div>
        )}
        <div style={{ padding:PADDING[padding] }}>{children}</div>
        {footer&&<div style={{ padding:'12px 24px',borderTop:`1px solid ${dividerColor}`,background:footerBg }}>{footer}</div>}
      </div>
    </div>
  );
};

export default CardMatte;
