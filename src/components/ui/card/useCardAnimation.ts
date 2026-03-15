// src/components/ui/card/useCardAnimation.ts
// Shared animation hook — mouse + touch support for all 6 animation types.
import { useRef, useCallback, useEffect } from 'react';

export type CardAnimationType = 'tilt' | 'lift' | 'glow' | 'spring' | 'magnetic' | 'none';

interface UseCardAnimationOptions {
  animation: CardAnimationType;
  baseShadow: string;
  hoverShadow: string;
  primaryRgb?: string;
}

export function useCardAnimation({
  animation,
  baseShadow,
  hoverShadow,
  primaryRgb = '99,102,241',
}: UseCardAnimationOptions) {
  const cardRef = useRef<HTMLDivElement>(null);

  const transition = animation === 'spring'
    ? 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.26s ease'
    : 'transform 0.26s cubic-bezier(0.23,1,0.32,1), box-shadow 0.26s ease';

  const transformStyle: 'preserve-3d' | 'flat' =
    animation === 'tilt' || animation === 'magnetic' ? 'preserve-3d' : 'flat';

  // ── shared position-based transform (tilt + magnetic) ────────────────────
  const applyPositional = useCallback((clientX: number, clientY: number) => {
    const el = cardRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.width / 2, cy = r.height / 2;
    const x = clientX - r.left, y = clientY - r.top;
    if (animation === 'tilt') {
      el.style.transform = `perspective(1200px) rotateX(${((y-cy)/cy)*-7}deg) rotateY(${((x-cx)/cx)*7}deg) translateZ(6px) scale(1.012)`;
    } else if (animation === 'magnetic') {
      el.style.transform = `perspective(1200px) translate(${((x-cx)/cx)*8}px,${((y-cy)/cy)*8}px) scale(1.012)`;
    }
    el.style.boxShadow = hoverShadow;
  }, [animation, hoverShadow]);

  // ── shared "activate" for enter-based animations ──────────────────────────
  const activate = useCallback(() => {
    const el = cardRef.current; if (!el) return;
    switch (animation) {
      case 'tilt':
      case 'magnetic': el.style.boxShadow = hoverShadow; break;
      case 'lift':     el.style.transform = 'translateY(-8px) scale(1.01)'; el.style.boxShadow = hoverShadow; break;
      case 'spring':   el.style.transform = 'scale(1.04)';                  el.style.boxShadow = hoverShadow; break;
      case 'glow':     el.style.transform = 'translateY(-2px)';             el.style.boxShadow = `${hoverShadow}, 0 0 28px 6px rgba(${primaryRgb},0.30)`; break;
    }
  }, [animation, hoverShadow, primaryRgb]);

  // ── shared reset ──────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    const el = cardRef.current; if (!el) return;
    el.style.transform = 'none';
    el.style.boxShadow = baseShadow;
  }, [baseShadow]);

  // ── touch event listeners (passive-safe, no React synthetic needed) ───────
  useEffect(() => {
    const el = cardRef.current;
    if (!el || animation === 'none') return;

    const onTouchStart = () => activate();

    const onTouchMove = (e: TouchEvent) => {
      if (animation === 'tilt' || animation === 'magnetic') {
        const t = e.touches[0];
        applyPositional(t.clientX, t.clientY);
      }
    };

    const onTouchEnd = () => {
      // Brief delay so the animation is visible before resetting
      setTimeout(reset, 350);
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove',  onTouchMove,  { passive: true });
    el.addEventListener('touchend',   onTouchEnd);
    el.addEventListener('touchcancel',onTouchEnd);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove',  onTouchMove);
      el.removeEventListener('touchend',   onTouchEnd);
      el.removeEventListener('touchcancel',onTouchEnd);
    };
  }, [animation, activate, applyPositional, reset]);

  // ── mouse handlers ────────────────────────────────────────────────────────
  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    applyPositional(e.clientX, e.clientY);
  }, [applyPositional]);

  if (animation === 'none') {
    return {
      cardRef,
      transition: 'box-shadow 0.26s ease',
      transformStyle: 'flat' as const,
      onMouseMove:  undefined,
      onMouseEnter: undefined,
      onMouseLeave: undefined,
    };
  }

  return {
    cardRef,
    transition,
    transformStyle,
    onMouseMove:  (animation === 'tilt' || animation === 'magnetic') ? onMouseMove : undefined,
    onMouseEnter: activate,
    onMouseLeave: reset,
  };
}
