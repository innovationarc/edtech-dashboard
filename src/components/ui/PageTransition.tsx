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
    pendingRef.current = children;
    if (timerRef.current) clearTimeout(timerRef.current);

    setPhase('exit');

    timerRef.current = setTimeout(() => {
      setDisplayChildren(pendingRef.current);
      setPhase('enter');

      timerRef.current = setTimeout(() => {
        setPhase('idle');
      }, 420);
    }, 160);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [location.pathname]);

  const style: React.CSSProperties = {
    // willChange + transform only during animation, never at idle.
    // At idle: no transform, no willChange → no containing block
    // → position:fixed modals escape correctly, backdrop-filter works on cards.
    ...(phase === 'exit' ? {
      willChange: 'transform, opacity',
      opacity: 0,
      transform: 'translateY(-6px)',
      transition: 'opacity 0.16s cubic-bezier(0.25,0.46,0.45,0.94), transform 0.16s cubic-bezier(0.25,0.46,0.45,0.94)',
    } : phase === 'enter' ? {
      willChange: 'transform, opacity',
      opacity: 0,
      transform: 'translateY(10px)',
    } : {
      // idle — clean slate, no transform, no willChange
      opacity: 1,
    }),
  };

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
