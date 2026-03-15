// useCardAnim.ts — shared animation logic for all card styles
// Surgical: only handles transform/shadow. Styles stay 100% intact.
import { useRef, useEffect } from 'react';

let _animInj = false;
export const injectAnimStyles = () => {
  if (_animInj || typeof document === 'undefined') return;
  _animInj = true;
  const s = document.createElement('style');
  s.textContent = `
    /* Active tilt — NO transition so it tracks instantly */
    .cm-tilt {
      transform: perspective(800px)
        rotateX(var(--cm-rx, 0deg))
        rotateY(var(--cm-ry, 0deg))
        translateZ(var(--cm-tz, 0px))
        scale(var(--cm-sc, 1)) !important;
      transition: box-shadow 0.2s ease !important;
      transform-style: preserve-3d !important;
      will-change: transform !important;
    }
    /* Spring return to neutral */
    .cm-reset {
      transform: perspective(800px) rotateX(0deg) rotateY(0deg) translateZ(0px) scale(1) !important;
      transition: transform 0.5s cubic-bezier(0.23,1,0.32,1),
                  box-shadow 0.4s ease !important;
      transform-style: preserve-3d !important;
    }
    .cm-lift {
      transform: translateY(-10px) scale(1.02) !important;
      transition: transform 0.3s cubic-bezier(0.23,1,0.32,1), box-shadow 0.3s ease !important;
      will-change: transform !important;
    }
    .cm-spring {
      transform: scale(1.05) !important;
      transition: transform 0.5s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s ease !important;
      will-change: transform !important;
    }
    .cm-glow {
      transform: translateY(-4px) scale(1.01) !important;
      transition: transform 0.3s cubic-bezier(0.23,1,0.32,1), box-shadow 0.3s ease !important;
      will-change: transform !important;
    }
    .cm-magnetic {
      transform: translate(var(--cm-dx, 0px), var(--cm-dy, 0px)) scale(1.01) !important;
      transition: transform 0.1s linear !important;
      will-change: transform !important;
    }
  `;
  document.head.appendChild(s);
};

const ALL_CM = ['cm-tilt','cm-lift','cm-spring','cm-glow','cm-magnetic'];

const setVars = (el: HTMLElement, vars: Record<string, string>) =>
  Object.entries(vars).forEach(([k, v]) => el.style.setProperty(k, v));

export interface UseCardAnimOptions {
  cardAnimation: string;
  hoverShadow: string;
  baseShadow: string;
  primaryRgb: string;
  isLight: boolean;
}

export function useCardAnim({
  cardAnimation: cardAnimationProp, hoverShadow, baseShadow, primaryRgb, isLight,
}: UseCardAnimOptions) {
  // Guard: always have a valid string, never undefined
  const cardAnimation = cardAnimationProp || 'tilt';
  const cardRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const rafRef  = useRef<number>(0);

  useEffect(() => { injectAnimStyles(); }, []);

  const doTilt = (clientX: number, clientY: number) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const el = cardRef.current; if (!el) return;
      const r = el.getBoundingClientRect();
      const x = Math.max(0, Math.min(r.width,  clientX - r.left));
      const y = Math.max(0, Math.min(r.height, clientY - r.top));
      const rx = ((y - r.height/2) / (r.height/2)) * -10;
      const ry = ((x - r.width /2) / (r.width /2)) *  10;
      el.classList.remove(...ALL_CM, 'cm-reset');
      el.classList.add('cm-tilt');
      setVars(el, { '--cm-rx':`${rx}deg`, '--cm-ry':`${ry}deg`, '--cm-tz':'8px', '--cm-sc':'1.02' });
      el.style.boxShadow = hoverShadow;
      const glow = glowRef.current;
      if (glow) {
        glow.style.left    = `${clientX - r.left}px`;
        glow.style.top     = `${clientY - r.top}px`;
        glow.style.opacity = isLight ? '0.55' : '0.40';
      }
    });
  };

  const doMagnetic = (clientX: number, clientY: number) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const el = cardRef.current; if (!el) return;
      const r = el.getBoundingClientRect();
      const dx = ((clientX - r.left - r.width /2) / (r.width /2)) * 10;
      const dy = ((clientY - r.top  - r.height/2) / (r.height/2)) * 10;
      el.classList.remove(...ALL_CM, 'cm-reset');
      el.classList.add('cm-magnetic');
      setVars(el, { '--cm-dx':`${dx}px`, '--cm-dy':`${dy}px` });
      el.style.boxShadow = hoverShadow;
    });
  };

  const doEnter = () => {
    const el = cardRef.current; if (!el) return;
    el.classList.remove(...ALL_CM, 'cm-reset');
    switch (cardAnimation) {
      case 'lift':   el.classList.add('cm-lift');   el.style.boxShadow = hoverShadow; break;
      case 'spring': el.classList.add('cm-spring'); el.style.boxShadow = hoverShadow; break;
      case 'glow':   el.classList.add('cm-glow');   el.style.boxShadow = `${hoverShadow}, 0 0 32px 8px rgba(${primaryRgb},0.28)`; break;
      default:       el.style.boxShadow = hoverShadow; break;
    }
  };

  const doReset = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const el = cardRef.current; if (!el) return;
    el.classList.remove(...ALL_CM);
    el.classList.add('cm-reset');
    setVars(el, { '--cm-rx':'0deg','--cm-ry':'0deg','--cm-tz':'0px','--cm-sc':'1','--cm-dx':'0px','--cm-dy':'0px' });
    el.style.boxShadow = baseShadow;
    const glow = glowRef.current;
    if (glow) glow.style.opacity = '0';
    setTimeout(() => el.classList.remove('cm-reset'), 520);
  };

  // ── React synthetic handlers ─────────────────────────────────────────────
  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (cardAnimation === 'tilt')     doTilt(e.clientX, e.clientY);
    if (cardAnimation === 'magnetic') doMagnetic(e.clientX, e.clientY);
  };
  const onMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    doEnter();
    if (cardAnimation === 'tilt')     doTilt(e.clientX, e.clientY);
    if (cardAnimation === 'magnetic') doMagnetic(e.clientX, e.clientY);
  };
  const onMouseLeave = () => doReset();

  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    if (cardAnimation === 'tilt')     doTilt(t.clientX, t.clientY);
    if (cardAnimation === 'magnetic') doMagnetic(t.clientX, t.clientY);
    doEnter();
  };
  const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    if (cardAnimation === 'tilt')     doTilt(t.clientX, t.clientY);
    if (cardAnimation === 'magnetic') doMagnetic(t.clientX, t.clientY);
  };
  const onTouchEnd = () => setTimeout(doReset, 350);

  return {
    cardRef, glowRef,
    onMouseMove, onMouseEnter, onMouseLeave,
    onTouchStart, onTouchMove,
    onTouchEnd,
    onTouchCancel: onTouchEnd,
  };
}
