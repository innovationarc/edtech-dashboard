// LoginAnimation.tsx — GPU-only animation (transform + opacity only, zero layout reflow)
import { useEffect, useRef, useState } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';

const LoginAnimation = () => {
  const {
    showLoginAnimation, setShowLoginAnimation,
    primaryColor, siteName, siteLogoUrl, user,
  } = useDashboard();

  const [mounted, setMounted] = useState(false);

  // All animated elements — driven by direct style mutations, never React re-renders
  const overlayRef   = useRef<HTMLDivElement>(null);
  const ringRef      = useRef<HTMLDivElement>(null);   // the ring that fills the screen
  const ring2Ref     = useRef<HTMLDivElement>(null);   // inner decorative ring
  const logoRef      = useRef<HTMLDivElement>(null);
  const textRef      = useRef<HTMLDivElement>(null);
  const dotsRef      = useRef<(HTMLDivElement | null)[]>([]);
  const timers       = useRef<ReturnType<typeof setTimeout>[]>([]);

  const pc   = primaryColor || '#6366f1';
  const hex  = (h: string) => {
    const c = h.replace('#', '');
    return [parseInt(c.slice(0,2),16), parseInt(c.slice(2,4),16), parseInt(c.slice(4,6),16)];
  };
  const [r,g,b] = hex(pc);
  const pRgb = `${r},${g},${b}`;

  const clear = () => timers.current.forEach(clearTimeout);
  const after = (fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    timers.current.push(t);
  };

  useEffect(() => {
    if (!showLoginAnimation) return;
    setMounted(true);
    return clear;
  }, [showLoginAnimation]);

  useEffect(() => {
    if (!mounted) return;
    clear();

    const overlay = overlayRef.current;
    const ring    = ringRef.current;
    const ring2   = ring2Ref.current;
    const logo    = logoRef.current;
    const text    = textRef.current;
    const dots    = dotsRef.current;
    if (!overlay || !ring || !logo) return;

    // ── Phase 0: Overlay fades in (two rAFs = after first paint) ──
    requestAnimationFrame(() => requestAnimationFrame(() => {
      overlay.style.opacity = '1';
    }));

    // ── Phase 1 (100ms): Logo + rings pop in, dots scatter out ──
    after(() => {
      ring.style.transition  = 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease';
      ring.style.transform   = 'translate(-50%,-50%) scale(1.08)';
      ring.style.opacity     = '1';

      if (ring2) {
        ring2.style.transition = 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.04s, opacity 0.3s ease 0.04s';
        ring2.style.transform  = 'translate(-50%,-50%) scale(1)';
        ring2.style.opacity    = '0.5';
      }

      logo.style.transition  = 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease';
      logo.style.transform   = 'translate(-50%,-50%) scale(1.06)';
      logo.style.opacity     = '1';

      if (text) {
        text.style.transition = 'opacity 0.4s ease 0.18s, transform 0.4s ease 0.18s';
        text.style.opacity    = '1';
        text.style.transform  = 'translateX(-50%) translateY(0)';
      }

      dots.forEach((d, i) => {
        if (!d) return;
        const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
        const dist  = 88;
        const x = Math.cos(angle) * dist;
        const y = Math.sin(angle) * dist;
        d.style.transition = `transform 0.5s cubic-bezier(0.34,1.15,0.64,1) ${i*0.025}s, opacity 0.35s ease ${i*0.025}s`;
        d.style.transform  = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
        d.style.opacity    = '0.85';
      });
    }, 100);

    // ── Phase 2 (320ms): Settle — bounce back to scale(1) ──
    after(() => {
      ring.style.transition = 'transform 0.35s cubic-bezier(0.23,1,0.32,1)';
      ring.style.transform  = 'translate(-50%,-50%) scale(1)';
      logo.style.transition = 'transform 0.35s cubic-bezier(0.23,1,0.32,1)';
      logo.style.transform  = 'translate(-50%,-50%) scale(1)';
    }, 320);

    // ── Phase 3 (780ms): Ring SCALES up to fill screen (GPU only!) ──
    // Scale factor: to cover full screen from center, need ~max(vw,vh)*sqrt(2)/ringDiameter
    // Ring is 110px diameter. On a 1920x1080 screen, diagonal = 2203px → scale = 2203/110 ≈ 20
    // We use 30 to be safe on all screen sizes.
    after(() => {
      // Swap ring color to solid primary instantly (no color transition = no repaint cost)
      ring.style.backgroundColor = pc;
      ring.style.borderColor     = 'transparent';

      // Now scale — this is pure transform, compositor-only
      ring.style.transition = 'transform 0.55s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease';
      ring.style.transform  = 'translate(-50%,-50%) scale(30)';

      // Fade everything else out simultaneously
      if (ring2) { ring2.style.transition = 'opacity 0.2s ease'; ring2.style.opacity = '0'; }

      logo.style.transition  = 'transform 0.25s ease, opacity 0.2s ease';
      logo.style.transform   = 'translate(-50%,-50%) scale(0.6)';
      logo.style.opacity     = '0';

      if (text) { text.style.transition = 'opacity 0.2s ease'; text.style.opacity = '0'; }

      dots.forEach((d, i) => {
        if (!d) return;
        const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
        const dist  = 200;
        d.style.transition = `transform 0.3s ease, opacity 0.2s ease`;
        d.style.transform  = `translate(calc(-50% + ${Math.cos(angle)*dist}px), calc(-50% + ${Math.sin(angle)*dist}px))`;
        d.style.opacity    = '0';
      });
    }, 780);

    // ── Phase 4 (1200ms): Dissolve overlay — only opacity change ──
    after(() => {
      overlay.style.transition    = 'opacity 0.48s ease';
      overlay.style.opacity       = '0';
      overlay.style.pointerEvents = 'none';
    }, 1200);

    // ── Phase 5 (1700ms): Unmount ──
    after(() => {
      setMounted(false);
      setShowLoginAnimation(false);
    }, 1700);

    return clear;
  }, [mounted]);

  if (!mounted) return null;

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.name?.split(' ')[0] || user?.surname?.split(' ')[0] || 'there';

  // Ring base size — scale(30) will cover any screen
  const RING = 110;

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#0d1117',
        opacity: 0,
        pointerEvents: 'all',
        transition: 'opacity 0.25s ease',
        // Promote to own layer immediately so overlay fade is compositor-only
        willChange: 'opacity',
        isolation: 'isolate',
      }}
    >
      {/* Static radial bloom — not animated, zero cost */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `radial-gradient(ellipse at center, rgba(${pRgb},0.15) 0%, transparent 60%)`,
      }} />

      {/* Inner decorative ring */}
      <div ref={ring2Ref} style={{
        position: 'absolute',
        top: '50%', left: '50%',
        width: 82, height: 82,
        marginLeft: -41, marginTop: -41,
        borderRadius: '50%',
        border: `1px solid rgba(${pRgb},0.35)`,
        transform: 'translate(-50%,-50%) scale(0.4)',
        opacity: 0,
        willChange: 'transform, opacity',
        pointerEvents: 'none',
      }} />

      {/* Outer ring — becomes the full-screen fill via scale(30) */}
      <div ref={ringRef} style={{
        position: 'absolute',
        top: '50%', left: '50%',
        width: RING, height: RING,
        marginLeft: -(RING/2), marginTop: -(RING/2),
        borderRadius: '50%',
        border: `2px solid rgba(${pRgb},0.7)`,
        backgroundColor: 'transparent',
        transform: 'translate(-50%,-50%) scale(0.35)',
        opacity: 0,
        // GPU-promoted — will only ever animate transform, opacity, bg-color (instant swap)
        willChange: 'transform, opacity',
      }} />

      {/* Logo circle */}
      <div ref={logoRef} style={{
        position: 'absolute',
        top: '50%', left: '50%',
        width: 60, height: 60,
        marginLeft: -30, marginTop: -30,
        borderRadius: '50%',
        background: `linear-gradient(135deg, ${pc}, ${pc}bb)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transform: 'translate(-50%,-50%) scale(0.35)',
        opacity: 0,
        willChange: 'transform, opacity',
        zIndex: 2,
      }}>
        {siteLogoUrl ? (
          <img src={siteLogoUrl} alt="logo"
            style={{ width: 30, height: 30, objectFit: 'contain', borderRadius: 4 }} />
        ) : (
          <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
            <path d="M5 13L10 18L21 8" stroke="white" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      {/* Site name + greeting text */}
      <div ref={textRef} style={{
        position: 'absolute',
        top: '58%', left: '50%',
        transform: 'translateX(-50%) translateY(14px)',
        width: 'max-content', maxWidth: '90vw',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        opacity: 0,
        willChange: 'transform, opacity',
        pointerEvents: 'none',
        zIndex: 2,
      }}>
        <p style={{
          fontSize: '1.15rem', fontWeight: 700, color: '#ffffff',
          fontFamily: "'Outfit', sans-serif", letterSpacing: '-0.02em', margin: 0,
        }}>
          {siteName || 'EduSpace'}
        </p>
        <p style={{
          fontSize: '0.72rem', color: `rgba(${pRgb},1)`,
          fontFamily: "'Outfit', sans-serif",
          letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0,
        }}>
          {greeting}, {firstName}
        </p>
      </div>

      {/* Orbiting particle dots — 8 dots, GPU-only movement */}
      {[...Array(8)].map((_, i) => {
        const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
        const dist  = 52;
        const x = Math.cos(angle) * dist;
        const y = Math.sin(angle) * dist;
        const size = i % 3 === 0 ? 5 : 3.5;
        return (
          <div
            key={i}
            ref={el => { dotsRef.current[i] = el; }}
            style={{
              position: 'absolute',
              top: '50%', left: '50%',
              width: size, height: size,
              borderRadius: '50%',
              background: `rgba(${pRgb},${i % 2 === 0 ? 0.9 : 0.55})`,
              transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
              opacity: 0,
              willChange: 'transform, opacity',
            }}
          />
        );
      })}
    </div>
  );
};

export default LoginAnimation;
