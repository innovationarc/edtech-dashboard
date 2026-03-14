// Card.tsx — "Aurora" brand system — clean, no harsh borders
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

let _inj = false;
const injectStyles = () => {
  if (_inj || typeof document==='undefined') return;
  _inj = true;
  const s = document.createElement('style');
  s.textContent = `
    @keyframes cardReveal {
      0%   { opacity:0; transform:translateY(32px) scale(0.94); filter:blur(4px); }
      60%  { filter:blur(0); }
      100% { opacity:1; transform:translateY(0) scale(1); }
    }
    @keyframes shimPass {
      0%   { transform:translateX(-130%) skewX(-15deg); opacity:0; }
      15%  { opacity:1; }
      85%  { opacity:1; }
      100% { transform:translateX(230%) skewX(-15deg); opacity:0; }
    }
    @keyframes stripePulse {
      0%,100% { opacity:0.7; }
      50%     { opacity:1; }
    }
    @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.45} }
  `;
  document.head.appendChild(s);
};

const toRgb = (hex:string) => {
  const h = hex.replace('#','');
  return `${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)}`;
};

const Card = ({
  children, className, title, subtitle, icon, footer,
  onClick, tilt=true, padding='md', enterDelay=0, accent,
}: CardProps) => {
  const { theme, primaryColor='#6366f1' } = useDashboard();
  const dark = theme!=='light';
  const cardRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const shimRef = useRef<HTMLDivElement>(null);
  const a = accent || primaryColor;
  const ar = toRgb(a);

  useEffect(()=>{ injectStyles(); },[]);

  // ── Colours ──────────────────────────────────────────────────────────────
  const bg          = dark ? 'rgba(11,15,30,0.88)' : 'rgba(255,255,255,0.88)';
  const border      = dark ? `rgba(255,255,255,0.07)` : `rgba(${ar},0.14)`;
  const titleClr    = dark ? 'rgba(241,245,249,0.97)' : '#0f172a';
  const subtitleClr = dark ? 'rgba(148,163,184,0.52)' : '#64748b';
  const divClr      = dark ? `rgba(${ar},0.11)` : `rgba(${ar},0.09)`;
  const footBg      = dark ? 'rgba(0,0,0,0.28)' : 'rgba(0,0,0,0.025)';
  const iconBg      = dark ? `rgba(${ar},0.16)` : `rgba(${ar},0.10)`;
  const iconBd      = dark ? `rgba(${ar},0.28)` : `rgba(${ar},0.20)`;

  const baseShadow = dark
    ? `0 1px 1px rgba(0,0,0,0.3),0 4px 12px rgba(0,0,0,0.4),0 12px 40px rgba(0,0,0,0.55),0 0 0 1px rgba(${ar},0.13),inset 0 1px 0 rgba(255,255,255,0.07)`
    : `0 1px 2px rgba(0,0,0,0.04),0 4px 16px rgba(0,0,0,0.08),0 0 0 1px rgba(${ar},0.12),inset 0 1px 0 #fff`;

  const hoverShadow = dark
    ? `0 2px 4px rgba(0,0,0,0.3),0 8px 24px rgba(0,0,0,0.5),0 24px 64px rgba(0,0,0,0.65),0 0 0 1.5px rgba(${ar},0.38),0 0 32px rgba(${ar},0.12),inset 0 1px 0 rgba(255,255,255,0.10)`
    : `0 2px 8px rgba(0,0,0,0.08),0 8px 32px rgba(${ar},0.16),0 0 0 1.5px rgba(${ar},0.30),inset 0 1px 0 #fff`;

  // ── Mouse ─────────────────────────────────────────────────────────────────
  const onMove = (e:React.MouseEvent<HTMLDivElement>) => {
    if (!tilt) return;
    const el=cardRef.current; if (!el) return;
    const r=el.getBoundingClientRect();
    const x=e.clientX-r.left, y=e.clientY-r.top;
    el.style.transform=`perspective(1100px) rotateX(${((y-r.height/2)/r.height)*-9}deg) rotateY(${((x-r.width/2)/r.width)*9}deg) translateZ(6px) scale(1.014)`;
    el.style.boxShadow=hoverShadow;
    const g=glowRef.current;
    if (g){ g.style.left=`${x}px`; g.style.top=`${y}px`; g.style.opacity=dark?'0.35':'0.40'; }
  };
  const onEnter = () => {
    const sh=shimRef.current; if (!sh) return;
    sh.style.animation='none'; void sh.offsetWidth;
    sh.style.animation='shimPass 700ms cubic-bezier(0.4,0,0.2,1) forwards';
  };
  const onLeave = () => {
    const el=cardRef.current;
    if (el){ el.style.transform='none'; el.style.boxShadow=baseShadow; }
    const g=glowRef.current; if (g) g.style.opacity='0';
  };

  return (
    <div
      ref={cardRef}
      className={clsx('relative overflow-hidden',className)}
      style={{
        background:bg,
        backdropFilter:'blur(52px) saturate(200%)',
        WebkitBackdropFilter:'blur(52px) saturate(200%)',
        border:`1px solid ${border}`,
        borderRadius:20,
        boxShadow:baseShadow,
        fontFamily:"'Outfit',sans-serif",
        cursor:onClick?'pointer':'default',
        isolation:'isolate',
        transformStyle:tilt?'preserve-3d':'flat',
        transition:'transform 0.24s cubic-bezier(0.23,1,0.32,1),box-shadow 0.24s ease',
        animation:`cardReveal 560ms cubic-bezier(0.22,1,0.36,1) ${enterDelay}ms both`,
      }}
      onClick={onClick}
      onMouseMove={onMove}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {/* ① 2px brand stripe — tapers to invisible */}
      <div style={{
        position:'absolute',top:0,left:'5%',right:'25%',height:2,
        background:`linear-gradient(90deg,${a},rgba(${ar},0.3) 70%,transparent)`,
        borderRadius:'0 0 4px 4px',
        boxShadow:`0 0 12px rgba(${ar},0.7),0 0 24px rgba(${ar},0.3)`,
        pointerEvents:'none',zIndex:10,
        animation:'stripePulse 4s ease-in-out infinite',
      }}/>

      {/* ② Soft tinted wash under header */}
      <div style={{
        position:'absolute',top:0,left:0,right:0,height:90,
        background:`linear-gradient(180deg,rgba(${ar},${dark?0.07:0.04}) 0%,transparent 100%)`,
        pointerEvents:'none',zIndex:1,
      }}/>

      {/* ③ Shimmer on hover */}
      <div ref={shimRef} style={{
        position:'absolute',top:0,left:0,width:'45%',bottom:0,
        background:`linear-gradient(110deg,transparent 15%,rgba(255,255,255,${dark?0.04:0.22}) 50%,transparent 85%)`,
        pointerEvents:'none',zIndex:5,
        transform:'translateX(-130%) skewX(-15deg)',
      }}/>

      {/* ④ Cursor glow */}
      <div ref={glowRef} style={{
        position:'absolute',width:300,height:300,borderRadius:'50%',
        background:`radial-gradient(circle,rgba(${ar},${dark?0.14:0.10}) 0%,transparent 65%)`,
        transform:'translate(-50%,-50%)',
        pointerEvents:'none',zIndex:3,opacity:0,
        transition:'opacity 0.3s ease',left:'50%',top:'50%',
      }}/>

      {/* ⑤ Bottom-right depth bloom */}
      <div style={{
        position:'absolute',bottom:-70,right:-70,width:220,height:220,
        borderRadius:'50%',
        background:`radial-gradient(circle,rgba(${ar},${dark?0.065:0.042}) 0%,transparent 70%)`,
        filter:'blur(32px)',pointerEvents:'none',zIndex:0,
      }}/>

      {/* ⑥ Top-left edge catch */}
      <div style={{
        position:'absolute',top:0,left:0,width:1,height:'60%',
        background:dark
          ?'linear-gradient(180deg,rgba(255,255,255,0.14) 0%,transparent 100%)'
          :'linear-gradient(180deg,rgba(255,255,255,0.9) 0%,transparent 100%)',
        pointerEvents:'none',zIndex:8,
      }}/>

      {/* ⑦ Content */}
      <div style={{position:'relative',zIndex:6}}>
        {(title||subtitle||icon)&&(
          <div style={{
            padding:'17px 22px 14px',
            borderBottom:`1px solid ${divClr}`,
            display:'flex',justifyContent:'space-between',alignItems:'center',
          }}>
            <div style={{minWidth:0,flex:1}}>
              {title&&<h3 style={{fontSize:'0.94rem',fontWeight:700,color:titleClr,letterSpacing:'-0.015em',lineHeight:1.3,margin:0}}>{title}</h3>}
              {subtitle&&<p style={{fontSize:'0.71rem',color:subtitleClr,margin:'3px 0 0',lineHeight:1.4}}>{subtitle}</p>}
            </div>
            {icon&&(
              <div style={{
                marginLeft:12,flexShrink:0,width:32,height:32,borderRadius:10,
                display:'flex',alignItems:'center',justifyContent:'center',
                background:iconBg,border:`1px solid ${iconBd}`,
                boxShadow:`0 0 12px rgba(${ar},${dark?0.18:0.12})`,
              }}>{icon}</div>
            )}
          </div>
        )}
        <div style={{padding:PAD[padding]}}>{children}</div>
        {footer&&<div style={{padding:'12px 22px',borderTop:`1px solid ${divClr}`,background:footBg}}>{footer}</div>}
      </div>
    </div>
  );
};

export default Card;
