// src/components/layout/DashboardLayout.tsx
import { Outlet } from 'react-router-dom';
import Navigation from './Navigation';
import MobileNavigation from './MobileNavigation';
import { useDashboard } from '../../contexts/DashboardContext';
import { useEffect, useState, useRef, useCallback } from 'react';
import ChatbotWidget from '../ChatbotWidget';
import AuthenticationModal from '../auth/AuthenticationModal';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { onAuthStateChanged } from 'firebase/auth';

const CLAMP = (v: number, max: number) => Math.max(-max, Math.min(max, v));

const DashboardLayout = () => {
  const { sidebarOpen, isAuthenticated } = useDashboard();
  const [isMobile, setIsMobile] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 });

  const dragging = useRef(false);
  const hasMoved = useRef(false);
  const dragStart = useRef<{ mouseX: number; mouseY: number; posX: number; posY: number } | null>(null);
  const positionRef = useRef({ x: 0, y: 0 });
  const prevDragPos = useRef({ x: 0, y: 0 });
  const widgetRef = useRef<HTMLDivElement>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eyeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flyRafId = useRef(0);
  const isFlying = useRef(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => { setShowAuthModal(!isAuthenticated); }, [isAuthenticated]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => setUid(user?.uid ?? null));
    return unsub;
  }, []);

  useEffect(() => {
    if (!uid) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', uid));
        if (snap.exists()) {
          const saved = snap.data()?.preferences?.chatbotWidgetPosition;
          if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') {
            positionRef.current = saved;
            setPosition(saved);
          }
        }
      } catch { /* fail silently */ }
    })();
  }, [uid]);

  const savePosition = useCallback((pos: { x: number; y: number }) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      const currentUid = auth.currentUser?.uid;
      if (!currentUid) return;
      try {
        await updateDoc(doc(db, 'users', currentUid), {
          'preferences.chatbotWidgetPosition': { x: pos.x, y: pos.y },
        });
      } catch { /* fail silently */ }
    }, 500);
  }, []);

  // Separated from useCallback so setEyeOffset always has fresh closure
  const applyEyeOffset = (dx: number, dy: number) => {
    setEyeOffset({
      x: CLAMP(dx * 0.3, 4),
      y: CLAMP(dy * 0.3, 3),
    });
    if (eyeTimeout.current) clearTimeout(eyeTimeout.current);
    eyeTimeout.current = setTimeout(() => setEyeOffset({ x: 0, y: 0 }), 150);
  };

  const resetEyes = () => {
    if (eyeTimeout.current) clearTimeout(eyeTimeout.current);
    setEyeOffset({ x: 0, y: 0 });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStart.current) return;
      const dx = e.clientX - dragStart.current.mouseX;
      const dy = e.clientY - dragStart.current.mouseY;
      if (!dragging.current && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
      dragging.current = true;
      hasMoved.current = true;

      const newX = dragStart.current.posX + dx;
      const newY = dragStart.current.posY + dy;

      // Eye offset from frame delta
      const fdx = newX - prevDragPos.current.x;
      const fdy = newY - prevDragPos.current.y;
      prevDragPos.current = { x: newX, y: newY };
      applyEyeOffset(fdx, fdy);

      positionRef.current = { x: newX, y: newY };
      if (widgetRef.current) {
        widgetRef.current.style.transform = `translate(${newX}px, ${newY}px)`;
      }
    };
    const handleMouseUp = () => {
      if (!dragStart.current) return;
      dragStart.current = null;
      setTimeout(() => { dragging.current = false; }, 0);
      const finalPos = { ...positionRef.current };
      setPosition(finalPos);
      savePosition(finalPos);
      resetEyes();
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [savePosition]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON' || target.isContentEditable) return;
    prevDragPos.current = { ...positionRef.current };
    dragStart.current = { mouseX: e.clientX, mouseY: e.clientY, posX: positionRef.current.x, posY: positionRef.current.y };
    dragging.current = false;
    hasMoved.current = false;
  }, []);

  useEffect(() => {
    const handleTouchMove = (e: TouchEvent) => {
      if (!dragStart.current) return;
      const t = e.touches[0];
      const dx = t.clientX - dragStart.current.mouseX;
      const dy = t.clientY - dragStart.current.mouseY;
      if (!dragging.current && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
      dragging.current = true;
      hasMoved.current = true;
      e.preventDefault();

      const newX = dragStart.current.posX + dx;
      const newY = dragStart.current.posY + dy;

      const fdx = newX - prevDragPos.current.x;
      const fdy = newY - prevDragPos.current.y;
      prevDragPos.current = { x: newX, y: newY };
      applyEyeOffset(fdx, fdy);

      positionRef.current = { x: newX, y: newY };
      if (widgetRef.current) {
        widgetRef.current.style.transform = `translate(${newX}px, ${newY}px)`;
      }
    };
    const handleTouchEnd = () => {
      if (!dragStart.current) return;
      dragStart.current = null;
      setTimeout(() => { dragging.current = false; }, 0);
      const finalPos = { ...positionRef.current };
      setPosition(finalPos);
      savePosition(finalPos);
      resetEyes();
    };
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [savePosition]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON' || target.isContentEditable) return;
    const t = e.touches[0];
    prevDragPos.current = { ...positionRef.current };
    dragStart.current = { mouseX: t.clientX, mouseY: t.clientY, posX: positionRef.current.x, posY: positionRef.current.y };
    dragging.current = false;
    hasMoved.current = false;
  }, []);


  // Ghost fly animation — pure rAF, zero React state updates during flight
  useEffect(() => {
    const handleFly = () => {
      if (isFlying.current || !widgetRef.current) return;
      // Close chatbot if open before flying
      window.dispatchEvent(new CustomEvent('ghost-close-chat'));
      isFlying.current = true;

      const startX = positionRef.current.x;
      const startY = positionRef.current.y;
      const W = window.innerWidth;
      const H = window.innerHeight;
      const duration = 3800;

      // Path waypoints — offsets relative to startX/startY
      // Widget is anchored bottom-right, so negative y = up, negative x = left
      const path = [
        { x: startX,            y: startY           },
        { x: startX - 80,       y: startY - 280     },
        { x: startX - W * 0.55, y: startY - H * 0.55},
        { x: startX - W * 0.8,  y: startY - H * 0.3 },
        { x: startX - W * 0.75, y: startY + H * 0.15},
        { x: startX - W * 0.35, y: startY + H * 0.1 },
        { x: startX - 100,      y: startY - 120     },
        { x: startX,            y: startY           },
      ];

      // Catmull-Rom interpolation for smooth looping path
      const getPoint = (t: number) => {
        const segments = path.length - 1;
        const seg = Math.min(Math.floor(t * segments), segments - 1);
        const lt = (t * segments) - seg;
        const p0 = path[Math.max(seg - 1, 0)];
        const p1 = path[seg];
        const p2 = path[Math.min(seg + 1, segments)];
        const p3 = path[Math.min(seg + 2, segments)];
        const cx = 0.5 * (2*p1.x + (-p0.x + p2.x)*lt + (2*p0.x - 5*p1.x + 4*p2.x - p3.x)*lt*lt + (-p0.x + 3*p1.x - 3*p2.x + p3.x)*lt*lt*lt);
        const cy = 0.5 * (2*p1.y + (-p0.y + p2.y)*lt + (2*p0.y - 5*p1.y + 4*p2.y - p3.y)*lt*lt + (-p0.y + 3*p1.y - 3*p2.y + p3.y)*lt*lt*lt);
        return { x: cx, y: cy };
      };

      const start = performance.now();
      const prevPt = { x: startX, y: startY };
      const tick = (now: number) => {
        const t = Math.min((now - start) / duration, 1);
        // Ease in-out
        const ease = t < 0.5 ? 2*t*t : -1+(4-2*t)*t;
        const pt = getPoint(ease);
        if (widgetRef.current) {
          widgetRef.current.style.transform = `translate(${pt.x}px, ${pt.y}px)`;
        }
        // Tell GhostIcon to tilt/move eyes in flight direction
        window.dispatchEvent(new CustomEvent('ghost-move', { detail: { dx: pt.x - prevPt.x, dy: pt.y - prevPt.y } }));
        prevPt.x = pt.x; prevPt.y = pt.y;
        if (t < 1) {
          flyRafId.current = requestAnimationFrame(tick);
        } else {
          positionRef.current = { x: startX, y: startY };
          if (widgetRef.current) {
            widgetRef.current.style.transform = `translate(${startX}px, ${startY}px)`;
          }
          isFlying.current = false;
          window.dispatchEvent(new CustomEvent('ghost-land'));
        }
      };
      flyRafId.current = requestAnimationFrame(tick);
    };

    window.addEventListener('ghost-fly', handleFly);
    return () => {
      window.removeEventListener('ghost-fly', handleFly);
      cancelAnimationFrame(flyRafId.current);
    };
  }, []);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--color-background, #0d1117)' }}>
      <style>{`
        .dl-main::-webkit-scrollbar { display: none !important; }
        .dl-main { scrollbar-width: none !important; -ms-overflow-style: none !important; }
      `}</style>

      <Navigation />

      {/* 
        Desktop: ml-[64px] matches the collapsed sidebar (64px icon strip).
        The sidebar expands to 220px on hover but uses position:fixed + overflow:hidden
        so it overlays content — no layout shift needed.
        Mobile: ml-0, pt-[60px] for the fixed mobile header.
      */}
      <div className={`flex-1 flex flex-col ${!isMobile ? 'ml-[64px]' : 'ml-0'}`}>
        <main className="dl-main flex-1 overflow-auto" style={{ paddingTop: isMobile ? 60 : 64 }}>
          <div className="p-3 sm:p-4 lg:p-6 pb-24 lg:pb-8">
            <Outlet />
          </div>
        </main>
      </div>

      {isMobile && isAuthenticated && <MobileNavigation />}

      {isAuthenticated && (
        <div
          ref={widgetRef}
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
          style={{
            position: 'fixed',
            transform: `translate(${position.x}px, ${position.y}px)`,
            zIndex: 1000,
            bottom: 0,
            right: 0,
            userSelect: 'none',
            touchAction: 'none',
            cursor: 'grab',
          }}
        >
          <ChatbotWidget eyeOffset={eyeOffset} />
        </div>
      )}

      {showAuthModal && !isAuthenticated && (
        <AuthenticationModal onClose={() => setShowAuthModal(false)} />
      )}
    </div>
  );
};

export default DashboardLayout;
