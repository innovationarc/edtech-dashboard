// Card.tsx — "Aurora" brand card system
// Signature: coloured top stripe + tinted shadow per card identity
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

let _injected = false;
const inject = () => {
  if (_injected || typeof document==='undefined') return;
  _injected = true;
  const s = document.createElement('style');
  s.textContent = `
    @keyframes cardReveal {
      0%   { opacity:0; transform:translateY(36px) scale(0.93); filter:blur(5px); }
      55%  { filter:blur(0); }
      100% { opacity:1; transform:translateY(0) scale(1); filter:blur(0); }
    }
    @keyframes shimPass {
      0%   { transform:translateX(-130%) skewX(-18deg); }
      100% { transform:translateX(240%)  skewX(-18deg); }
    }
    @keyframes stripeGlow {
      0%,100% { opacity:0.85; }
      50%     { opacity:1; filter:brightness(1.25); }
    }
    @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(1.22)} }
  `;
  document.head.appendChild(s);
};

const rgb = (hex:string) => {
  const h = hex.replace('#','');
  return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)].join(',');
};

const Card = ({
  children, className, title, subtitle, icon, footer,
  onClick, tilt=true, padding='md', enterDelay=0, accent,
  hover=false, variant='default',
}: CardProps) => {
  const { theme, primaryColor='#6366f1' } = useDashboard();
  const isLight = theme==='light';
  const cardRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const shimRef = useRef<HTMLDivElement>(null);

  const a    = accent || primaryColor;
  const aRgb = rgb(a);

  useEffect(()=>{ inject(); },[]);

  const bg     = isLight ? 'rgba(255,255,255,0.86)' : 'rgba(10,14,28,0.84)';
  const border = isLight
    ? `1px solid rgba(${aRgb},0.16)`
    : `1px solid rgba(255,255,255,0.088)`;

  const baseShadow = isLight
    ? [ `0 6px 36px rgba(0,0,0,0.10)`,`0 2px 6px rgba(0,0,0,0.06)`,
        `0 0 0 1px rgba(${aRgb},0.11)`,`inset 0 1px 0 rgba(255,255,255,1)` ].join(',')
    : [ `0 14px 52px rgba(0,0,0,0.62)`,`0 5px 16px rgba(0,0,0,0.42)`,
        `0 1px 3px rgba(0,0,0,0.32)`,  `0 0 0 1px rgba(${aRgb},0.15)`,
        `inset 0 1px 0 rgba(255,255,255,0.08)` ].join(',');

  const hoverShadow = isLight
    ? [ `0 22px 64px rgba(0,0,0,0.14)`,`0 6px 20px rgba(${aRgb},0.20)`,
        `0 0 0 1.5px rgba(${aRgb},0.32)`,`inset 0 1px 0 rgba(255,255,255,1)` ].join(',')
    : [ `0 28px 80px rgba(0,0,0,0.72)`,`0 10px 28px rgba(${aRgb},0.24)`,
        `0 0 0 1.5px rgba(${aRgb},0.36)`,`inset 0 1px 0 rgba(255,255,255,0.13)`,
        `inset 0 0 40px rgba(${aRgb},0.04)` ].join(',');

  const titleColor    = isLight ? '#0f172a'             : 'rgba(241,245,249,0.97)';
  const subtitleColor = isLight ? '#64748b'             : 'rgba(148,163,184,0.55)';
  const divColor      = isLight ? `rgba(${aRgb},0.10)` : `rgba(${aRgb},0.13)`;
  const footerBg      = isLight ? 'rgba(0,0,0,0.025)'  : 'rgba(0,0,0,0.26)';

  const onMove = (e:React.MouseEvent<HTMLDivElement>) => {
    if (!tilt) return;
    const el=cardRef.current, gl=glowRef.current; if (!el) return;
    const r=el.getBoundingClientRect();
    const x=e.clientX-r.left, y=e.clientY-r.top;
    el.style.transform=`perspective(1000px) rotateX(${((y-r.height/2)/(r.height/2))*-5.5}deg) rotateY(${((x-r.width/2)/(r.width/2))*5.5}deg) translateZ(8px) scale(1.016)`;
    el.style.boxShadow=hoverShadow;
    if (gl){ gl.style.left=`${x}px`; gl.style.top=`${y}px`; gl.style.opacity=isLight?'0.42':'0.36'; }
  };

  const onEnter = () => {
    const sh=shimRef.current; if (!sh) return;
    sh.style.animation='none'; void sh.offsetWidth;
    sh.style.animation='shimPass 650ms cubic-bezier(0.4,0,0.2,1) forwards';
  };

  const onLeave = () => {
    const el=cardRef.current, gl=glowRef.current;
    if (el){ el.style.transform='perspective(1000px) rotateX(0) rotateY(0) translateZ(0) scale(1)'; el.style.boxShadow=baseShadow; }
    if (gl) gl.style.opacity='0';
  };

  return (
    <div
      ref={cardRef}
      className={clsx('relative overflow-hidden',className)}
      style={{
        background:bg,
        backdropFilter:'blur(44px) saturate(215%)',
        WebkitBackdropFilter:'blur(44px) saturate(215%)',
        border, borderRadius:22, boxShadow:baseShadow,
        fontFamily:"'Outfit',sans-serif",
        cursor:onClick?'pointer':'default',
        isolation:'isolate',
        transformStyle:tilt?'preserve-3d':'flat',
        transition:'transform 0.22s cubic-bezier(0.23,1,0.32,1), box-shadow 0.22s ease',
        animation:`cardReveal 620ms cubic-bezier(0.22,1,0.36,1) ${enterDelay}ms both`,
      }}
      onClick={onClick}
      onMouseMove={onMove}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {/* ① Signature accent stripe */}
      <div style={{
        position:'absolute',top:0,left:0,right:0,height:3,
        borderRadius:'22px 22px 0 0',pointerEvents:'none',zIndex:9,
        background:`linear-gradient(90deg, ${a} 0%, rgba(${aRgb},0.48) 58%, transparent 100%)`,
        boxShadow:`0 0 16px rgba(${aRgb},0.55), 0 0 4px rgba(${aRgb},0.8)`,
        animation:'stripeGlow 3s ease-in-out infinite',
      }}/>

      {/* ② Accent top wash */}
      <div style={{
        position:'absolute',top:0,left:0,right:0,height:100,
        pointerEvents:'none',zIndex:1,
        background:`linear-gradient(180deg,rgba(${aRgb},${isLight?0.042:0.082}) 0%,transparent 100%)`,
      }}/>

      {/* ③ Bottom-right ambient blob */}
      <div style={{
        position:'absolute',bottom:-55,right:-55,width:200,height:200,
        borderRadius:'50%',pointerEvents:'none',zIndex:0,
        background:`radial-gradient(circle,rgba(${aRgb},${isLight?0.05:0.075}) 0%,transparent 70%)`,
        filter:'blur(28px)',
      }}/>

      {/* ④ Shimmer sweep */}
      <div ref={shimRef} style={{
        position:'absolute',inset:0,pointerEvents:'none',zIndex:5,overflow:'hidden',
        background:`linear-gradient(108deg,transparent 20%,rgba(255,255,255,${isLight?0.28:0.052}) 50%,transparent 80%)`,
        transform:'translateX(-130%) skewX(-18deg)',
      }}/>

      {/* ⑤ Cursor glow */}
      <div ref={glowRef} style={{
        position:'absolute',pointerEvents:'none',zIndex:3,
        width:320,height:320,borderRadius:'50%',
        transform:'translate(-50%,-50%)',
        background:`radial-gradient(circle,rgba(${aRgb},${isLight?0.11:0.16}) 0%,transparent 65%)`,
        opacity:0,transition:'opacity 0.28s ease',
        left:'50%',top:'50%',
      }}/>

      {/* ⑥ Left-edge glass catch */}
      <div style={{
        position:'absolute',top:0,left:0,bottom:0,width:1,
        borderRadius:'22px 0 0 22px',pointerEvents:'none',zIndex:7,
        background:isLight
          ? 'linear-gradient(180deg,rgba(255,255,255,0.85) 0%,rgba(255,255,255,0.2) 50%,transparent 100%)'
          : 'linear-gradient(180deg,rgba(255,255,255,0.16) 0%,rgba(255,255,255,0.05) 50%,transparent 100%)',
      }}/>

      {/* ⑦ Content */}
      <div style={{position:'relative',zIndex:6}}>
        {(title||subtitle||icon)&&(
          <div style={{
            padding:'18px 24px 15px',
            borderBottom:`1px solid ${divColor}`,
            display:'flex',justifyContent:'space-between',alignItems:'center',
          }}>
            <div style={{minWidth:0,flex:1}}>
              {title&&(
                <h3 style={{
                  fontSize:'0.95rem',fontWeight:700,color:titleColor,
                  letterSpacing:'-0.016em',lineHeight:1.3,margin:0,
                }}>{title}</h3>
              )}
              {subtitle&&(
                <p style={{fontSize:'0.72rem',color:subtitleColor,margin:'3px 0 0',lineHeight:1.4}}>
                  {subtitle}
                </p>
              )}
            </div>
            {icon&&(
              <div style={{
                marginLeft:12,flexShrink:0,
                width:33,height:33,borderRadius:10,
                display:'flex',alignItems:'center',justifyContent:'center',
                background:`rgba(${aRgb},${isLight?0.10:0.16})`,
                border:`1px solid rgba(${aRgb},${isLight?0.18:0.26})`,
                boxShadow:`0 0 10px rgba(${aRgb},${isLight?0.10:0.20})`,
              }}>{icon}</div>
            )}
          </div>
        )}
        <div style={{padding:PAD[padding]}}>{children}</div>
        {footer&&(
          <div style={{padding:'13px 24px',borderTop:`1px solid ${divColor}`,background:footerBg}}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Card;
