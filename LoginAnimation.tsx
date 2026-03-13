// LoginAnimation.tsx
// Option C (logo morph ring → expand → dissolve) + Option B (card stagger on dashboard reveal)
import { useEffect, useRef, useState } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';

type Phase =
  | 'idle'       // not started
  | 'pulse'      // ring pulses in place (0–600ms)
  | 'expand'     // ring blows up to fill screen (600–1000ms)
  | 'dissolve'   // overlay fades out (1000–1500ms)
  | 'done';      // removed from DOM

const LoginAnimation = () => {
  const { showLoginAnimation, setShowLoginAnimation, primaryColor, siteName, siteLogoUrl, user } = useDashboard();
  const [phase, setPhase] = useState<Phase>('idle');
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  const hexToRgb = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r},${g},${b}`;
  };

  const pRgb = hexToRgb(primaryColor || '#6366f1');
  const accentColor = primaryColor || '#6366f1';

  useEffect(() => {
    if (!showLoginAnimation) return;

    setPhase('pulse');

    const t1 = setTimeout(() => setPhase('expand'),   600);
    const t2 = setTimeout(() => setPhase('dissolve'), 950);
    const t3 = setTimeout(() => {
      setPhase('done');
      setShowLoginAnimation(false);
    }, 1600);

    timerRefs.current = [t1, t2, t3];
    return () => timerRefs.current.forEach(clearTimeout);
  }, [showLoginAnimation]);

  if (phase === 'idle' || phase === 'done') return null;

  const isPulse   = phase === 'pulse';
  const isExpand  = phase === 'expand';
  const isDissolve = phase === 'dissolve';

  // Greeting based on time of day
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.name?.split(' ')[0] || 'there';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: isDissolve
          ? `rgba(${pRgb}, 0)`
          : `rgba(13, 16, 23, ${isExpand ? 1 : 1})`,
        transition: isDissolve ? 'background 0.5s ease, opacity 0.55s ease' : 'background 0.3s ease',
        opacity: isDissolve ? 0 : 1,
        pointerEvents: isDissolve ? 'none' : 'all',
      }}
    >
      {/* Background radial gradient — primary color bloom */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(ellipse at center, rgba(${pRgb}, ${isExpand ? 0.35 : 0.12}) 0%, transparent 70%)`,
        transition: 'background 0.4s ease',
      }} />

      {/* Outer pulse ring */}
      <div style={{
        position: 'absolute',
        width: isExpand ? '300vmax' : isPulse ? 110 : 100,
        height: isExpand ? '300vmax' : isPulse ? 110 : 100,
        borderRadius: '50%',
        border: isExpand ? 'none' : `2px solid rgba(${pRgb}, ${isPulse ? 0.55 : 0.3})`,
        background: isExpand ? accentColor : 'transparent',
        transition: isExpand
          ? 'width 0.55s cubic-bezier(0.4,0,0.2,1), height 0.55s cubic-bezier(0.4,0,0.2,1), border 0.15s ease, background 0.1s ease'
          : 'width 0.5s cubic-bezier(0.34,1.56,0.64,1), height 0.5s cubic-bezier(0.34,1.56,0.64,1)',
        opacity: isDissolve ? 0 : 1,
      }} />

      {/* Inner ring */}
      <div style={{
        position: 'absolute',
        width: isExpand ? '300vmax' : isPulse ? 82 : 72,
        height: isExpand ? '300vmax' : isPulse ? 82 : 72,
        borderRadius: '50%',
        border: isExpand ? 'none' : `1px solid rgba(${pRgb}, ${isPulse ? 0.35 : 0.15})`,
        transition: isExpand
          ? 'width 0.55s cubic-bezier(0.4,0,0.2,1), height 0.55s cubic-bezier(0.4,0,0.2,1), border 0.15s ease'
          : 'width 0.5s cubic-bezier(0.34,1.56,0.64,1), height 0.5s cubic-bezier(0.34,1.56,0.64,1)',
        opacity: isDissolve ? 0 : 0.6,
        transitionDelay: isExpand ? '0.03s' : '0s',
      }} />

      {/* Logo circle */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          width: 60,
          height: 60,
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 0 40px rgba(${pRgb}, 0.5)`,
          transform: isExpand ? 'scale(0.6)' : isPulse ? 'scale(1.08)' : 'scale(1)',
          opacity: isExpand ? 0 : 1,
          transition: isExpand
            ? 'transform 0.3s ease, opacity 0.25s ease'
            : 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        {siteLogoUrl ? (
          <img src={siteLogoUrl} alt="logo" style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 4 }} />
        ) : (
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path d="M6 14L11 19L22 9" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>

      {/* Site name + greeting — below the logo */}
      <div style={{
        position: 'absolute',
        textAlign: 'center',
        top: '58%',
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        opacity: isExpand ? 0 : isPulse ? 1 : 0,
        transform: isPulse ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 0.35s ease, transform 0.35s ease',
        transitionDelay: isPulse ? '0.1s' : '0s',
        pointerEvents: 'none',
      }}>
        <p style={{
          fontSize: '1.2rem',
          fontWeight: 700,
          color: 'white',
          fontFamily: "'Outfit', sans-serif",
          letterSpacing: '-0.02em',
          margin: 0,
        }}>
          {siteName || 'EduSpace'}
        </p>
        <p style={{
          fontSize: '0.8rem',
          color: `rgba(${pRgb}, 0.9)`,
          fontFamily: "'Outfit', sans-serif",
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          margin: 0,
        }}>
          {greeting}, {firstName}
        </p>
      </div>

      {/* Particle dots — decorative scatter */}
      {[...Array(8)].map((_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        const dist = isExpand ? 200 : isPulse ? 90 : 60;
        const x = Math.cos(angle) * dist;
        const y = Math.sin(angle) * dist;
        return (
          <div key={i} style={{
            position: 'absolute',
            width: 4,
            height: 4,
            borderRadius: '50%',
            background: `rgba(${pRgb}, ${isPulse ? 0.7 : 0.3})`,
            transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
            transition: `transform 0.5s cubic-bezier(0.34,1.15,0.64,1) ${i * 0.03}s, opacity 0.4s ease`,
            opacity: isExpand ? 0 : isPulse ? 1 : 0,
          }} />
        );
      })}
    </div>
  );
};

export default LoginAnimation;
