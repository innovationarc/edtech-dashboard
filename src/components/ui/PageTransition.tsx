// PageTransition.tsx
// iOS-quality route transition: fade + 12px slide up, Apple spring easing
// Only transform + opacity — zero layout reflow, pure GPU compositor
import { useLocation } from 'react-router-dom';
import { useRef, useEffect, useState, ReactNode } from 'react';

interface Props { children: ReactNode; }

const PageTransition = ({ children }: Props) => {
  const location = useLocation();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [phase, setPhase]       = useState<'idle' | 'exit' | 'enter'>('idle');
  const [modalOpen, setModalOpen] = useState(false);
  const pendingRef = useRef(children);
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detect any modal/overlay by watching for fixed+z-50 elements in the DOM
  useEffect(() => {
    const check = () => {
      setModalOpen(!!(
        document.querySelector('.z-50') ||
        document.querySelector('.z-40') ||
        document.querySelector('[role="dialog"]') ||
        document.querySelector('[role="alertdialog"]')
      ));
    };
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    check();
    return () => observer.disconnect();
  }, []);

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

  const style: React.CSSProperties = modalOpen
    // Modal open — no transform/willChange so position:fixed escapes correctly
    ? { opacity: 1 }
    // No modal — full animation
    : {
        willChange: 'transform, opacity',
        ...(phase === 'exit' ? {
          opacity: 0,
          transform: 'translateY(-6px)',
          transition: 'opacity 0.16s cubic-bezier(0.25,0.46,0.45,0.94), transform 0.16s cubic-bezier(0.25,0.46,0.45,0.94)',
        } : phase === 'enter' ? {
          opacity: 0,
          transform: 'translateY(10px)',
        } : {
          opacity: 1,
          transform: 'translateY(0)',
          transition: 'opacity 0.38s cubic-bezier(0.25,0.46,0.45,0.94), transform 0.42s cubic-bezier(0.25,0.46,0.45,0.94)',
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
    <div ref={divRef} style={{ ...style, width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
      {displayChildren}
    </div>
  );
};

export default PageTransition;
