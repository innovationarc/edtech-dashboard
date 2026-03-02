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

  return (
    <div className="flex h-screen bg-background-950 overflow-hidden">
      <style>{`
        .dl-main::-webkit-scrollbar { display: none !important; }
        .dl-main { scrollbar-width: none !important; -ms-overflow-style: none !important; }
      `}</style>

      <Navigation />

      <div className={`flex-1 flex flex-col transition-all duration-300 ease-in-out ${
        !isMobile && sidebarOpen ? 'ml-64' : !isMobile ? 'ml-20' : 'ml-0'
      }`}>
        <main className="dl-main flex-1 overflow-auto pt-16 sm:pt-[68px] lg:pt-[72px]">
          <div className="p-2 xs:p-3 sm:p-4 lg:p-6 pb-20 lg:pb-6">
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
