// LoginAnimation.tsx
// Fix 1: overlay starts opacity:1 so dashboard is NEVER visible behind it
// Fix 2: slower, breathable timing — logo holds 1s, ring expands gracefully, total ~3s
// Fix 3: iOS spring easing throughout, GPU-only (transform + opacity)
import { useEffect, useRef, useState } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';

const LoginAnimation = () => {
  const {
    showLoginAnimation, setShowLoginAnimation,
    primaryColor, siteName, siteLogoUrl, user,
  } = useDashboard();

  const [mounted, setMounted] = useState(false);

  const overlayRef  = useRef<HTMLDivElement>(null);
  const ringRef     = useRef<HTMLDivElement>(null);
  const ring2Ref    = useRef<HTMLDivElement>(null);
  const logoRef     = useRef<HTMLDivElement>(null);
  const textRef     = useRef<HTMLDivElement>(null);
  const dotsRef     = useRef<(HTMLDivElement | null)[]>([]);
  const timers      = useRef<ReturnType<typeof setTimeout>[]>([]);

  const pc = primaryColor || '#6366f1';
  const hexToRgb = (h: string) => {
    const c = h.replace('#', '');
    const r = parseInt(c.slice(0,2),16);
    const g = parseInt(c.slice(2,4),16);
    const b = parseInt(c.slice(4,6),16);
    return `${r},${g},${b}`;
  };
  const pRgb = hexToRgb(pc);

  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const after = (fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    timers.current.push(t);
    return t;
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

    // ─────────────────────────────────────────────────────────────
    // PHASE 0 (0ms): Overlay is already opacity:1 (set in JSX)
    // Just animate the background from solid → radial so it feels
    // like it "opens" rather than snapping on
    // ─────────────────────────────────────────────────────────────

    // ─────────────────────────────────────────────────────────────
    // PHASE 1 (120ms): Logo pops in with spring bounce
    // ─────────────────────────────────────────────────────────────
    after(() => {
      // Logo springs in
      logo.style.transition = 'transform 0.6s cubic-bezier(0.34,1.56,0.64,1), opacity 0.35s ease';
      logo.style.transform  = 'translate(-50%,-50%) scale(1.08)';
      logo.style.opacity    = '1';

      // Outer ring expands with slight spring overshoot
      ring.style.transition = 'transform 0.6s cubic-bezier(0.34,1.4,0.64,1), opacity 0.35s ease';
      ring.style.transform  = 'translate(-50%,-50%) scale(1.1)';
      ring.style.opacity    = '1';

      // Inner ring fades in
      if (ring2) {
        ring2.style.transition = 'transform 0.55s cubic-bezier(0.34,1.4,0.64,1) 0.05s, opacity 0.35s ease 0.05s';
        ring2.style.transform  = 'translate(-50%,-50%) scale(1)';
        ring2.style.opacity    = '0.5';
      }

      // Dots orbit outward with stagger
      dots.forEach((d, i) => {
        if (!d) return;
        const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
        const x = Math.cos(angle) * 90;
        const y = Math.sin(angle) * 90;
        d.style.transition = `transform 0.55s cubic-bezier(0.34,1.15,0.64,1) ${i * 0.03}s, opacity 0.4s ease ${i * 0.03}s`;
        d.style.transform  = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
        d.style.opacity    = '0.9';
      });
    }, 120);

    // ─────────────────────────────────────────────────────────────
    // PHASE 2 (420ms): Everything settles to resting scale
    // ─────────────────────────────────────────────────────────────
    after(() => {
      ring.style.transition = 'transform 0.45s cubic-bezier(0.25,0.46,0.45,0.94)';
      ring.style.transform  = 'translate(-50%,-50%) scale(1)';
      logo.style.transition = 'transform 0.45s cubic-bezier(0.25,0.46,0.45,0.94)';
      logo.style.transform  = 'translate(-50%,-50%) scale(1)';
    }, 420);

    // ─────────────────────────────────────────────────────────────
    // PHASE 3 (680ms): Greeting text slides up gently
    // ─────────────────────────────────────────────────────────────
    after(() => {
      if (text) {
        text.style.transition = 'opacity 0.5s cubic-bezier(0.25,0.46,0.45,0.94), transform 0.5s cubic-bezier(0.25,0.46,0.45,0.94)';
        text.style.opacity    = '1';
        text.style.transform  = 'translateX(-50%) translateY(0)';
      }
    }, 680);

    // ─────────────────────────────────────────────────────────────
    // PHASE 4 (1600ms): Hold — user reads the greeting
    // Then everything collapses inward before the ring expands
    // ─────────────────────────────────────────────────────────────
    after(() => {
      // Logo pulses up slightly before exploding
      logo.style.transition = 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease';
      logo.style.transform  = 'translate(-50%,-50%) scale(1.15)';
    }, 1600);

    // ─────────────────────────────────────────────────────────────
    // PHASE 5 (1900ms): Ring EXPLODES to fill screen
    // iOS-style: fast acceleration, smooth deceleration
    // ─────────────────────────────────────────────────────────────
    after(() => {
      // Instantly set ring color (zero cost, no transition)
      ring.style.backgroundColor = pc;
      ring.style.borderColor     = 'transparent';

      // Scale 30x — covers any screen size, pure GPU transform
      ring.style.transition = 'transform 0.65s cubic-bezier(0.4,0,0.15,1)';
      ring.style.transform  = 'translate(-50%,-50%) scale(30)';

      // Everything else exits
      logo.style.transition = 'transform 0.2s ease, opacity 0.25s ease';
      logo.style.transform  = 'translate(-50%,-50%) scale(0.5)';
      logo.style.opacity    = '0';

      if (ring2) { ring2.style.transition = 'opacity 0.2s ease'; ring2.style.opacity = '0'; }
      if (text)  { text.style.transition  = 'opacity 0.2s ease'; text.style.opacity  = '0'; }

      dots.forEach((d, i) => {
        if (!d) return;
        const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
        const x = Math.cos(angle) * 220;
        const y = Math.sin(angle) * 220;
        d.style.transition = 'transform 0.35s ease, opacity 0.2s ease';
        d.style.transform  = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
        d.style.opacity    = '0';
      });
    }, 1900);

    // ─────────────────────────────────────────────────────────────
    // PHASE 6 (2600ms): Overlay fades out — dashboard revealed
    // Long enough fade so it never feels like a hard cut
    // ─────────────────────────────────────────────────────────────
    after(() => {
      overlay.style.transition    = 'opacity 0.65s cubic-bezier(0.25,0.46,0.45,0.94)';
      overlay.style.opacity       = '0';
      overlay.style.pointerEvents = 'none';
    }, 2600);

    // ─────────────────────────────────────────────────────────────
    // PHASE 7 (3300ms): Unmount
    // ─────────────────────────────────────────────────────────────
    after(() => {
      setMounted(false);
      setShowLoginAnimation(false);
    }, 3300);

    return clear;
  }, [mounted]);

  if (!mounted) return null;

  const hour      = new Date().getHours();
  const greeting  = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.name?.split(' ')[0] || user?.surname?.split(' ')[0] || 'there';
  const RING      = 110;

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0d1117',
        // ← KEY FIX: start fully opaque — dashboard NEVER bleeds through
        opacity: 1,
        pointerEvents: 'all',
        willChange: 'opacity',
        isolation: 'isolate',
      }}
    >
      {/* Radial glow — static, zero animation cost */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `radial-gradient(ellipse at center, rgba(${pRgb},0.14) 0%, transparent 58%)`,
      }} />

      {/* Inner ring */}
      <div ref={ring2Ref} style={{
        position: 'absolute',
        top: '50%', left: '50%',
        width: 84, height: 84,
        marginLeft: -42, marginTop: -42,
        borderRadius: '50%',
        border: `1px solid rgba(${pRgb},0.3)`,
        transform: 'translate(-50%,-50%) scale(0.3)',
        opacity: 0,
        willChange: 'transform, opacity',
        pointerEvents: 'none',
      }} />

      {/* Outer ring → becomes fullscreen fill */}
      <div ref={ringRef} style={{
        position: 'absolute',
        top: '50%', left: '50%',
        width: RING, height: RING,
        marginLeft: -(RING / 2), marginTop: -(RING / 2),
        borderRadius: '50%',
        border: `2px solid rgba(${pRgb},0.75)`,
        backgroundColor: 'transparent',
        transform: 'translate(-50%,-50%) scale(0.3)',
        opacity: 0,
        willChange: 'transform, opacity',
      }} />

      {/* Logo */}
      <div ref={logoRef} style={{
        position: 'absolute',
        top: '50%', left: '50%',
        width: 64, height: 64,
        marginLeft: -32, marginTop: -32,
        borderRadius: '50%',
        background: `linear-gradient(135deg, ${pc}, ${pc}bb)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transform: 'translate(-50%,-50%) scale(0.3)',
        opacity: 0,
        willChange: 'transform, opacity',
        zIndex: 2,
      }}>
        {siteLogoUrl ? (
          <img src={siteLogoUrl} alt="logo"
            style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 4 }} />
        ) : (
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path d="M5 14L11 20L23 9" stroke="white" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      {/* Greeting text */}
      <div ref={textRef} style={{
        position: 'absolute',
        top: '58%', left: '50%',
        transform: 'translateX(-50%) translateY(16px)',
        width: 'max-content', maxWidth: '88vw',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
        opacity: 0,
        willChange: 'transform, opacity',
        pointerEvents: 'none',
        zIndex: 2,
      }}>
        <p style={{
          fontSize: '1.2rem', fontWeight: 700, color: '#ffffff',
          fontFamily: "'Outfit', sans-serif", letterSpacing: '-0.02em', margin: 0,
        }}>
          {siteName || 'EduSpace'}
        </p>
        <p style={{
          fontSize: '0.75rem', color: `rgba(${pRgb},1)`,
          fontFamily: "'Outfit', sans-serif",
          letterSpacing: '0.12em', textTransform: 'uppercase', margin: 0,
        }}>
          {greeting}, {firstName}
        </p>
      </div>

      {/* Particle dots */}
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
              background: `rgba(${pRgb}, ${i % 2 === 0 ? 0.9 : 0.5})`,
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
