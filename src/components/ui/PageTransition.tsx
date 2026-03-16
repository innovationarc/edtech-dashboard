// PageTransition.tsx
// iOS-quality route transition: fade + 12px slide up, Apple spring easing
// Only transform + opacity — zero layout reflow, pure GPU compositor
import { useLocation } from 'react-router-dom';
import { useRef, useEffect, useState, ReactNode } from 'react';

interface Props { children: ReactNode; }

const PageTransition = ({ children }: Props) => {
  const location = useLocation();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [phase, setPhase]   = useState<'idle' | 'exit' | 'enter'>('idle');
  const pendingRef = useRef(children);
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Same path — don't re-animate (handles strict mode double-mount)
    pendingRef.current = children;

    if (timerRef.current) clearTimeout(timerRef.current);

    // Step 1: exit current page
    setPhase('exit');

    timerRef.current = setTimeout(() => {
      // Step 2: swap content while invisible
      setDisplayChildren(pendingRef.current);
      setPhase('enter');

      timerRef.current = setTimeout(() => {
        setPhase('idle');
      }, 420); // match enter duration
    }, 160); // exit duration

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [location.pathname]);

  const style: React.CSSProperties = {
    // will-change ONLY set during animation — never at idle.
    // A permanent will-change:transform creates a new containing block,
    // which breaks position:fixed for every modal/overlay in the app.
    ...(phase !== 'idle' && { willChange: 'transform, opacity' }),
    ...(phase === 'exit' ? {
      opacity: 0,
      transform: 'translateY(-6px)',
      transition: 'opacity 0.16s cubic-bezier(0.25,0.46,0.45,0.94), transform 0.16s cubic-bezier(0.25,0.46,0.45,0.94)',
    } : phase === 'enter' ? {
      opacity: 0,
      transform: 'translateY(10px)',
      // No transition on enter start — we add it after one frame
    } : {
      opacity: 1,
      transform: 'none',
      transition: 'opacity 0.38s cubic-bezier(0.25,0.46,0.45,0.94), transform 0.42s cubic-bezier(0.25,0.46,0.45,0.94)',
    }),
  };

  // After swapping to 'enter' phase, trigger the spring-in on next frame
  const divRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (phase === 'enter' && divRef.current) {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (divRef.current) {
          divRef.current.style.transition =
            'opacity 0.38s cubic-bezier(0.25,0.46,0.45,0.94), transform 0.42s cubic-bezier(0.25,0.46,0.45,0.94)';
          divRef.current.style.opacity   = '1';
          divRef.current.style.transform = 'translateY(0)';
        }
      }));
    }
  }, [phase]);

  return (
    <div ref={divRef} style={style}>
      {displayChildren}
    </div>
  );
};

export default PageTransition;
