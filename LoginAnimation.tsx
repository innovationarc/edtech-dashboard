// LoginAnimation.tsx — Option C (ring morph) + Option B (card stagger) combined
import { useEffect, useRef, useState } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';

const LoginAnimation = () => {
  const { showLoginAnimation, setShowLoginAnimation, primaryColor, siteName, siteLogoUrl, user } = useDashboard();

  // Internal mounted flag — stays true through entire animation, unmounts AFTER fade completes
  const [mounted, setMounted] = useState(false);

  const overlayRef = useRef<HTMLDivElement>(null);
  const outerRingRef = useRef<HTMLDivElement>(null);
  const innerRingRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const dotsRef = useRef<(HTMLDivElement | null)[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const pc = primaryColor || '#6366f1';
  const hexToRgb = (hex: string) => {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return `${r},${g},${b}`;
  };
  const pRgb = hexToRgb(pc);

  const getDotPos = (i: number, dist: number) => {
    const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
    return {
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
    };
  };

  const clearTimers = () => timers.current.forEach(clearTimeout);

  useEffect(() => {
    if (!showLoginAnimation) return;
    setMounted(true);
    return clearTimers;
  }, [showLoginAnimation]);

  useEffect(() => {
    if (!mounted) return;
    clearTimers();

    const add = (fn: () => void, ms: number) => {
      const t = setTimeout(fn, ms);
      timers.current.push(t);
    };

    const overlay = overlayRef.current;
    const outer = outerRingRef.current;
    const inner = innerRingRef.current;
    const logo = logoRef.current;
    const text = textRef.current;
    const dots = dotsRef.current;

    if (!overlay) return;

    // Fade in overlay
    requestAnimationFrame(() => requestAnimationFrame(() => {
      overlay.style.opacity = '1';
    }));

    // 80ms: elements pulse in
    add(() => {
      if (outer) { outer.style.transform = 'scale(1.1)'; outer.style.opacity = '1'; }
      if (inner) { inner.style.opacity = '0.6'; }
      if (logo)  { logo.style.transform = 'scale(1.08)'; logo.style.opacity = '1'; }
      if (text)  { text.style.opacity = '1'; text.style.transform = 'translateY(0)'; }
      dots.forEach((d, i) => {
        if (!d) return;
        const { x, y } = getDotPos(i, 88);
        d.style.opacity = '0.8';
        d.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
      });
    }, 80);

    // 300ms: settle bounce
    add(() => {
      if (outer) outer.style.transform = 'scale(1)';
      if (logo)  logo.style.transform = 'scale(1)';
    }, 300);

    // 750ms: ring expands to fill screen
    add(() => {
      if (outer) {
        outer.style.transition = 'width 0.55s cubic-bezier(0.4,0,0.2,1), height 0.55s cubic-bezier(0.4,0,0.2,1), opacity 0.3s ease, background 0.2s ease, border-color 0.15s ease';
        outer.style.width = '320vmax';
        outer.style.height = '320vmax';
        outer.style.background = pc;
        outer.style.borderColor = 'transparent';
      }
      if (inner) { inner.style.opacity = '0'; }
      if (logo)  { logo.style.opacity = '0'; logo.style.transform = 'scale(0.5)'; }
      if (text)  { text.style.opacity = '0'; text.style.transform = 'translateY(-10px)'; }
      dots.forEach((d, i) => {
        if (!d) return;
        const { x, y } = getDotPos(i, 200);
        d.style.opacity = '0';
        d.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
      });
    }, 750);

    // 1180ms: dissolve
    add(() => {
      if (overlay) {
        overlay.style.transition = 'opacity 0.5s ease';
        overlay.style.opacity = '0';
        overlay.style.pointerEvents = 'none';
      }
    }, 1180);

    // 1720ms: unmount
    add(() => {
      setMounted(false);
      setShowLoginAnimation(false);
    }, 1720);

    return clearTimers;
  }, [mounted]);

  if (!mounted) return null;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.name?.split(' ')[0] || user?.surname?.split(' ')[0] || 'there';

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0d1117',
        opacity: 0, pointerEvents: 'all',
        transition: 'opacity 0.25s ease',
      }}
    >
      {/* Radial bloom */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `radial-gradient(ellipse at center, rgba(${pRgb},0.18) 0%, transparent 65%)`,
      }} />

      {/* Outer ring → fullscreen fill */}
      <div ref={outerRingRef} style={{
        position: 'absolute',
        width: 110, height: 110, borderRadius: '50%',
        border: `2px solid rgba(${pRgb},0.65)`,
        background: 'transparent',
        transform: 'scale(0.4)', opacity: 0,
        transition: 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease',
      }} />

      {/* Inner ring */}
      <div ref={innerRingRef} style={{
        position: 'absolute',
        width: 80, height: 80, borderRadius: '50%',
        border: `1px solid rgba(${pRgb},0.3)`,
        opacity: 0, transition: 'opacity 0.3s ease 0.06s', pointerEvents: 'none',
      }} />

      {/* Logo */}
      <div ref={logoRef} style={{
        position: 'relative', zIndex: 2,
        width: 60, height: 60, borderRadius: '50%',
        background: `linear-gradient(135deg, ${pc}, ${pc}cc)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 0 44px rgba(${pRgb},0.5)`,
        transform: 'scale(0.4)', opacity: 0,
        transition: 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease',
      }}>
        {siteLogoUrl ? (
          <img src={siteLogoUrl} alt="logo" style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 4 }} />
        ) : (
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path d="M6 14L11 19L22 9" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      {/* Site name + greeting */}
      <div ref={textRef} style={{
        position: 'absolute', top: '58%', left: 0, right: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        opacity: 0, transform: 'translateY(14px)',
        transition: 'opacity 0.4s ease 0.15s, transform 0.4s ease 0.15s',
        pointerEvents: 'none',
      }}>
        <p style={{ fontSize: '1.15rem', fontWeight: 700, color: '#ffffff', fontFamily: "'Outfit',sans-serif", letterSpacing: '-0.02em', margin: 0 }}>
          {siteName || 'EduSpace'}
        </p>
        <p style={{ fontSize: '0.72rem', color: `rgba(${pRgb},1)`, fontFamily: "'Outfit',sans-serif", letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>
          {greeting}, {firstName}
        </p>
      </div>

      {/* Orbiting dots */}
      {[...Array(8)].map((_, i) => {
        const { x, y } = getDotPos(i, 52);
        return (
          <div
            key={i}
            ref={el => { dotsRef.current[i] = el; }}
            style={{
              position: 'absolute',
              width: i % 3 === 0 ? 5 : 3.5, height: i % 3 === 0 ? 5 : 3.5,
              borderRadius: '50%',
              background: `rgba(${pRgb}, ${i % 2 === 0 ? 0.9 : 0.6})`,
              top: '50%', left: '50%',
              opacity: 0,
              transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
              transition: `transform 0.5s cubic-bezier(0.34,1.15,0.64,1) ${i * 0.028}s, opacity 0.35s ease ${i * 0.028}s`,
            }}
          />
        );
      })}
    </div>
  );
};

export default LoginAnimation;
