// src/components/layout/DashboardLayout.tsx
import { Outlet, useNavigate } from 'react-router-dom';
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
  const { sidebarOpen, isAuthenticated, theme, glitterTheme } = useDashboard();
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

  // Nova navigation — ChatbotWidget dispatches 'nova-navigate' with { path }
  const navigate = useNavigate();
  useEffect(() => {
    const handleNovaNavigate = (e: Event) => {
      const path = (e as CustomEvent<{ path: string }>).detail?.path;
      if (path && typeof path === 'string' && path.startsWith('/')) {
        navigate(path);
      }
    };
    window.addEventListener('nova-navigate', handleNovaNavigate);
    return () => {
      window.removeEventListener('nova-navigate', handleNovaNavigate);
    };
  }, [navigate]);

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

  const isLight = theme === 'light';

  // ── Glitter background definitions ──────────────────────────────────────────
  // Each glitter option has a dark variant and a light variant so they always
  // harmonise with the active dark / light mode.
  const glitterStyles: Record<string, React.CSSProperties> = {
    none: {},
    silver: {
      backgroundImage: isLight
        ? `
          radial-gradient(ellipse at 20% 20%, rgba(0,0,0,0.03) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 80%, rgba(0,0,0,0.02) 0%, transparent 50%),
          radial-gradient(circle at 30% 40%, rgba(80,80,100,0.35) 0.5px, transparent 0.5px),
          radial-gradient(circle at 70% 20%, rgba(80,80,100,0.28) 0.5px, transparent 0.5px),
          radial-gradient(circle at 50% 70%, rgba(80,80,100,0.32) 0.5px, transparent 0.5px),
          radial-gradient(circle at 15% 80%, rgba(80,80,100,0.25) 0.5px, transparent 0.5px),
          radial-gradient(circle at 85% 60%, rgba(80,80,100,0.35) 0.5px, transparent 0.5px),
          radial-gradient(circle at 60% 45%, rgba(80,80,100,0.28) 0.5px, transparent 0.5px),
          radial-gradient(circle at 40% 15%, rgba(80,80,100,0.30) 0.5px, transparent 0.5px),
          radial-gradient(circle at 90% 35%, rgba(80,80,100,0.25) 0.5px, transparent 0.5px)
        `
        : `
          radial-gradient(ellipse at 20% 20%, rgba(255,255,255,0.05) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 80%, rgba(255,255,255,0.03) 0%, transparent 50%),
          radial-gradient(circle at 30% 40%, rgba(220,220,240,0.55) 0.5px, transparent 0.5px),
          radial-gradient(circle at 70% 20%, rgba(200,200,220,0.45) 0.5px, transparent 0.5px),
          radial-gradient(circle at 50% 70%, rgba(220,220,240,0.50) 0.5px, transparent 0.5px),
          radial-gradient(circle at 15% 80%, rgba(200,200,220,0.40) 0.5px, transparent 0.5px),
          radial-gradient(circle at 85% 60%, rgba(220,220,240,0.55) 0.5px, transparent 0.5px),
          radial-gradient(circle at 60% 45%, rgba(200,200,220,0.45) 0.5px, transparent 0.5px),
          radial-gradient(circle at 40% 15%, rgba(220,220,240,0.50) 0.5px, transparent 0.5px),
          radial-gradient(circle at 90% 35%, rgba(200,200,220,0.40) 0.5px, transparent 0.5px)
        `,
      backgroundSize: isLight
        ? 'auto, auto, 80px 80px, 120px 120px, 90px 90px, 110px 110px, 70px 70px, 100px 100px, 85px 85px, 95px 95px'
        : 'auto, auto, 80px 80px, 120px 120px, 90px 90px, 110px 110px, 70px 70px, 100px 100px, 85px 85px, 95px 95px',
    },
    gold: {
      backgroundImage: isLight
        ? `
          radial-gradient(ellipse at 15% 15%, rgba(180,130,0,0.07) 0%, transparent 45%),
          radial-gradient(ellipse at 85% 85%, rgba(150,110,0,0.05) 0%, transparent 45%),
          radial-gradient(circle at 25% 35%, rgba(160,120,0,0.55) 0.5px, transparent 0.5px),
          radial-gradient(circle at 75% 25%, rgba(180,140,0,0.50) 0.5px, transparent 0.5px),
          radial-gradient(circle at 45% 65%, rgba(160,120,0,0.52) 0.5px, transparent 0.5px),
          radial-gradient(circle at 80% 70%, rgba(180,140,0,0.45) 0.5px, transparent 0.5px),
          radial-gradient(circle at 10% 55%, rgba(160,120,0,0.48) 0.5px, transparent 0.5px),
          radial-gradient(circle at 60% 15%, rgba(180,140,0,0.55) 0.5px, transparent 0.5px),
          radial-gradient(circle at 35% 85%, rgba(160,120,0,0.42) 0.5px, transparent 0.5px)
        `
        : `
          radial-gradient(ellipse at 15% 15%, rgba(212,175,55,0.12) 0%, transparent 45%),
          radial-gradient(ellipse at 85% 85%, rgba(180,140,30,0.08) 0%, transparent 45%),
          radial-gradient(circle at 25% 35%, rgba(212,175,55,0.60) 0.5px, transparent 0.5px),
          radial-gradient(circle at 75% 25%, rgba(255,215,0,0.55) 0.5px, transparent 0.5px),
          radial-gradient(circle at 45% 65%, rgba(212,175,55,0.58) 0.5px, transparent 0.5px),
          radial-gradient(circle at 80% 70%, rgba(255,215,0,0.48) 0.5px, transparent 0.5px),
          radial-gradient(circle at 10% 55%, rgba(212,175,55,0.52) 0.5px, transparent 0.5px),
          radial-gradient(circle at 60% 15%, rgba(255,215,0,0.62) 0.5px, transparent 0.5px),
          radial-gradient(circle at 35% 85%, rgba(212,175,55,0.42) 0.5px, transparent 0.5px)
        `,
      backgroundSize: 'auto, auto, 60px 60px, 90px 90px, 75px 75px, 110px 110px, 50px 50px, 80px 80px, 95px 95px',
    },
    purple: {
      backgroundImage: isLight
        ? `
          radial-gradient(ellipse at 20% 30%, rgba(99,102,241,0.08) 0%, transparent 45%),
          radial-gradient(ellipse at 80% 70%, rgba(79,70,229,0.06) 0%, transparent 45%),
          radial-gradient(circle at 30% 40%, rgba(99,102,241,0.50) 0.5px, transparent 0.5px),
          radial-gradient(circle at 70% 20%, rgba(79,70,229,0.45) 0.5px, transparent 0.5px),
          radial-gradient(circle at 55% 70%, rgba(99,102,241,0.48) 0.5px, transparent 0.5px),
          radial-gradient(circle at 15% 60%, rgba(79,70,229,0.42) 0.5px, transparent 0.5px),
          radial-gradient(circle at 88% 50%, rgba(99,102,241,0.47) 0.5px, transparent 0.5px),
          radial-gradient(circle at 45% 15%, rgba(79,70,229,0.52) 0.5px, transparent 0.5px),
          radial-gradient(circle at 75% 85%, rgba(99,102,241,0.38) 0.5px, transparent 0.5px)
        `
        : `
          radial-gradient(ellipse at 20% 30%, rgba(139,92,246,0.12) 0%, transparent 45%),
          radial-gradient(ellipse at 80% 70%, rgba(99,102,241,0.10) 0%, transparent 45%),
          radial-gradient(circle at 30% 40%, rgba(200,180,255,0.70) 0.5px, transparent 0.5px),
          radial-gradient(circle at 70% 20%, rgba(180,160,240,0.62) 0.5px, transparent 0.5px),
          radial-gradient(circle at 55% 70%, rgba(220,200,255,0.68) 0.5px, transparent 0.5px),
          radial-gradient(circle at 15% 60%, rgba(200,180,255,0.58) 0.5px, transparent 0.5px),
          radial-gradient(circle at 88% 50%, rgba(180,160,240,0.64) 0.5px, transparent 0.5px),
          radial-gradient(circle at 45% 15%, rgba(220,200,255,0.72) 0.5px, transparent 0.5px),
          radial-gradient(circle at 75% 85%, rgba(200,180,255,0.50) 0.5px, transparent 0.5px)
        `,
      backgroundSize: 'auto, auto, 55px 55px, 85px 85px, 70px 70px, 100px 100px, 65px 65px, 90px 90px, 78px 78px',
    },
  };

  const activeGlitter = glitterStyles[glitterTheme] ?? {};

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{
        backgroundColor: 'var(--color-background, #0d1117)',
        ...activeGlitter,
      }}
    >
      <style>{`
        .dl-main::-webkit-scrollbar { display: none !important; }
        .dl-main { scrollbar-width: none !important; -ms-overflow-style: none !important; }
      `}</style>

      {isAuthenticated && <Navigation />}

      {/* 
        Desktop: ml-[64px] matches the collapsed sidebar (64px icon strip).
        The sidebar expands to 220px on hover but uses position:fixed + overflow:hidden
        so it overlays content — no layout shift needed.
        Mobile: ml-0, pt-[60px] for the fixed mobile header.
      */}
      <div className={`flex-1 flex flex-col ${isAuthenticated && !isMobile ? 'ml-[64px]' : 'ml-0'}`} style={{ background: 'transparent' }}>
        <main className="dl-main flex-1 overflow-auto" style={{ paddingTop: isMobile ? 60 : 64, background: 'transparent' }}>
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
            // On mobile, lift above the bottom nav (~64px). On desktop, sit at edge.
            bottom: isMobile ? 76 : 20,
            right: isMobile ? 16 : 20,
            userSelect: 'none',
            touchAction: 'none',
            cursor: 'grab',
            // Must be visible so the chat panel (position:fixed inside a transformed
            // parent would break, but modals use portal — ghost btn is relative here)
            overflow: 'visible',
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
