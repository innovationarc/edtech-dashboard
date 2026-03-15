// src/components/ui/card/useCardAnimation.ts
// Shared animation hook for all card styles.
// Styles stay 100% intact — only transform/shadow/transition are touched.
import { useRef, useCallback } from 'react';

export type CardAnimationType = 'tilt' | 'lift' | 'glow' | 'spring' | 'magnetic' | 'none';

interface UseCardAnimationOptions {
  animation: CardAnimationType;
  baseShadow: string;
  hoverShadow: string;
  primaryRgb?: string; // for glow: "r,g,b"
}

export function useCardAnimation({
  animation,
  baseShadow,
  hoverShadow,
  primaryRgb = '99,102,241',
}: UseCardAnimationOptions) {
  const cardRef = useRef<HTMLDivElement>(null);

  // ── transition string per animation ──────────────────────────────────────
  const transition = animation === 'spring'
    ? 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.26s ease'
    : 'transform 0.26s cubic-bezier(0.23,1,0.32,1), box-shadow 0.26s ease';

  // ── transformStyle ────────────────────────────────────────────────────────
  const transformStyle: 'preserve-3d' | 'flat' =
    animation === 'tilt' || animation === 'magnetic' ? 'preserve-3d' : 'flat';

  // ── handlers ──────────────────────────────────────────────────────────────
  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const cx = r.width / 2;
    const cy = r.height / 2;

    switch (animation) {
      case 'tilt': {
        const rx = ((y - cy) / cy) * -7;
        const ry = ((x - cx) / cx) * 7;
        el.style.transform = `perspective(1200px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(6px) scale(1.012)`;
        el.style.boxShadow = hoverShadow;
        break;
      }
      case 'magnetic': {
        // Subtle follow — card shifts slightly toward cursor
        const dx = ((x - cx) / cx) * 8;
        const dy = ((y - cy) / cy) * 8;
        el.style.transform = `perspective(1200px) translate(${dx}px, ${dy}px) scale(1.012)`;
        el.style.boxShadow = hoverShadow;
        break;
      }
      default:
        break;
    }
  }, [animation, hoverShadow]);

  const onMouseEnter = useCallback(() => {
    const el = cardRef.current;
    if (!el) return;

    switch (animation) {
      case 'tilt':
      case 'magnetic':
        // Shadow lifts on enter; transform updates live via onMouseMove
        el.style.boxShadow = hoverShadow;
        break;
      case 'lift':
        el.style.transform = 'translateY(-8px) scale(1.01)';
        el.style.boxShadow = hoverShadow;
        break;
      case 'spring':
        el.style.transform = 'scale(1.04)';
        el.style.boxShadow = hoverShadow;
        break;
      case 'glow':
        el.style.transform = 'translateY(-2px)';
        el.style.boxShadow = `${hoverShadow}, 0 0 28px 6px rgba(${primaryRgb},0.30)`;
        break;
      default:
        break;
    }
  }, [animation, hoverShadow, primaryRgb]);

  const onMouseLeave = useCallback(() => {
    const el = cardRef.current;
    if (!el) return;
    // Always reset fully — guarantees "back to normal" regardless of animation
    el.style.transform = 'none';
    el.style.boxShadow = baseShadow;
  }, [baseShadow]);

  // For 'none' — return no-ops
  if (animation === 'none') {
    return {
      cardRef,
      transition: 'box-shadow 0.26s ease',
      transformStyle: 'flat' as const,
      onMouseMove: undefined,
      onMouseEnter: undefined,
      onMouseLeave: undefined,
    };
  }

  return {
    cardRef,
    transition,
    transformStyle,
    onMouseMove:  (animation === 'tilt' || animation === 'magnetic') ? onMouseMove : undefined,
    onMouseEnter,
    onMouseLeave,
  };
}
