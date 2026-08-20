import { Outlet, useNavigate } from 'react-router-dom';
import Navigation from './Navigation';
import MobileNavigation from './MobileNavigation';
import { useDashboard } from '../../contexts/DashboardContext';
import { useEffect, useState, useRef, useCallback } from 'react';
import ChatbotWidget from '../ChatbotWidget';
import FirestoreDebugPanel from '../admin/FirestoreDebugPanel';
import AuthenticationModal from '../auth/AuthenticationModal';

import PageTransition from '../ui/PageTransition';
import TopProgressBar from '../ui/TopProgressBar';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { dashboardStatsService } from '../../services/dashboardStatsService';
import { firestoreMonitorPersistService, DashboardKey } from '../../services/firestoreMonitorPersistService';
import SyncStatusBadge from '../shared/SyncStatusBadge';
import { useSyncService } from '../../hooks/useSyncService';

const CLAMP = (v: number, max: number) => Math.max(-max, Math.min(max, v));

const clampPosition = (
  pos: { x: number; y: number },
  widgetEl: HTMLDivElement | null,
  isMobile: boolean,
): { x: number; y: number } => {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const R = isMobile ? 16 : 20;
  const B = isMobile ? 76 : 20;
  const ghostW = widgetEl ? widgetEl.offsetWidth  : 56;
  const ghostH = widgetEl ? widgetEl.offsetHeight : 56;
  return {
    x: Math.max(ghostW - W + R, Math.min(R, pos.x)),
    y: Math.max(ghostH - H + B, Math.min(B, pos.y)),
  };
};

// Map user role to DashboardKey for the persist service
function roleToDashboardKey(role?: string): DashboardKey {
  switch (role) {
    case 'admin':          return 'admin';
    case 'student':        return 'student';
    case 'teacher':        return 'teacher';
    case 'manager':
    case 'coordinator':    return 'manager';
    case 'course_manager': return 'course_manager';
    default:               return '_global';
  }
}

const DashboardLayout = () => {
  const { sidebarOpen, isAuthenticated, theme, glitterTheme, user } = useDashboard();
  const { status: syncStatus, pendingCount } = useSyncService();
  const [isMobile, setIsMobile] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 });
  const [staggerActive, setStaggerActive] = useState(false);

  const dragging = useRef(false);
  const hasMoved = useRef(false);
  const dragStart = useRef<{ mouseX: number; mouseY: number; posX: number; posY: number } | null>(null);
  const positionRef = useRef({ x: 0, y: 0 });
  const prevDragPos = useRef({ x: 0, y: 0 });
  const widgetRef = useRef<HTMLDivElement>(null);
  const isMobileRef = useRef(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eyeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flyRafId = useRef(0);
  const isFlying = useRef(false);
  const chatOpen = useRef(false);

  // ── Firestore Monitor persist service init ───────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    const dk = roleToDashboardKey(user.role);
    firestoreMonitorPersistService.init(dk);
    return () => {
      // Don't destroy on every user change — only on full unmount
    };
  }, [user?.uid, user?.role]);

  // ── App usage session tracking ───────────────────────────────────────────
  const sessionStartRef = useRef<number>(Date.now());
  const savedUpToRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!user?.uid || user?.role !== 'student') return;
    sessionStartRef.current = Date.now();
    savedUpToRef.current = Date.now();

    const bufferKey = `appUsageBuffer_${user.uid}`;
    const buffered = localStorage.getItem(bufferKey);
    if (buffered) {
      try {
        const { date, seconds } = JSON.parse(buffered);
        if (seconds > 0) {
          dashboardStatsService.logAppUsageSession(user.uid, seconds, date).catch(() => {});
        }
      } catch {}
      localStorage.removeItem(bufferKey);
    }

    const getUnsavedSeconds = () =>
      Math.round((Date.now() - savedUpToRef.current) / 1000);

    const save = async () => {
      const seconds = getUnsavedSeconds();
      if (seconds < 1) return;
      savedUpToRef.current = Date.now();
      await dashboardStatsService.logAppUsageSession(user.uid, seconds).catch(() => {});
    };

    const bufferToLocalStorage = () => {
      const seconds = getUnsavedSeconds();
      if (seconds < 1) return;
      const dateKey = new Date().toISOString().slice(0, 10);
      localStorage.setItem(bufferKey, JSON.stringify({ date: dateKey, seconds }));
    };

    const iv = setInterval(save, 60 * 1000);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        bufferToLocalStorage();
        save();
      } else {
        localStorage.removeItem(bufferKey);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    const onBeforeUnload = () => bufferToLocalStorage();
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      clearInterval(iv);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('beforeunload', onBeforeUnload);
      save();
    };
  }, [user?.uid, user?.role]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { isMobileRef.current = isMobile; }, [isMobile]);

  useEffect(() => {
    const onOpen  = () => { chatOpen.current = true; };
    const onClose = () => { chatOpen.current = false; };
    window.addEventListener('nova-chat-open',  onOpen);
    window.addEventListener('nova-chat-close', onClose);
    return () => {
      window.removeEventListener('nova-chat-open',  onOpen);
      window.removeEventListener('nova-chat-close', onClose);
    };
  }, []);

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
            const clamped = clampPosition(saved, widgetRef.current, isMobileRef.current);
            positionRef.current = clamped;
            setPosition(clamped);
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

      const raw = { x: dragStart.current.posX + dx, y: dragStart.current.posY + dy };
      const { x: newX, y: newY } = clampPosition(raw, widgetRef.current, isMobileRef.current);

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
      const finalPos = clampPosition({ ...positionRef.current }, widgetRef.current, isMobileRef.current);
      positionRef.current = finalPos;
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
    if (isFlying.current || chatOpen.current) return;
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

      const raw = { x: dragStart.current.posX + dx, y: dragStart.current.posY + dy };
      const { x: newX, y: newY } = clampPosition(raw, widgetRef.current, isMobileRef.current);

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
      const finalPos = clampPosition({ ...positionRef.current }, widgetRef.current, isMobileRef.current);
      positionRef.current = finalPos;
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
    if (isFlying.current || chatOpen.current) return;
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON' || target.isContentEditable) return;
    const t = e.touches[0];
    prevDragPos.current = { ...positionRef.current };
    dragStart.current = { mouseX: t.clientX, mouseY: t.clientY, posX: positionRef.current.x, posY: positionRef.current.y };
    dragging.current = false;
    hasMoved.current = false;
  }, []);

  useEffect(() => {
    const handleFly = () => {
      if (isFlying.current || !widgetRef.current) return;
      window.dispatchEvent(new CustomEvent('ghost-close-chat'));
      isFlying.current = true;

      const startX = positionRef.current.x;
      const startY = positionRef.current.y;
      const W = window.innerWidth;
      const H = window.innerHeight;
      const duration = 3800;

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
        const ease = t < 0.5 ? 2*t*t : -1+(4-2*t)*t;
        const pt = getPoint(ease);
        if (widgetRef.current) {
          widgetRef.current.style.transform = `translate(${pt.x}px, ${pt.y}px)`;
        }
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
      if (isFlying.current) {
        cancelAnimationFrame(flyRafId.current);
        isFlying.current = false;
        if (widgetRef.current) {
          widgetRef.current.style.transform = `translate(${positionRef.current.x}px, ${positionRef.current.y}px)`;
        }
        window.dispatchEvent(new CustomEvent('ghost-land'));
      } else {
        cancelAnimationFrame(flyRafId.current);
      }
    };
  }, []);

  const isLight = theme === 'light';

  const glitterStyles: Record<string, React.CSSProperties> = {
    none: {},
    silver: {
      backgroundImage: isLight
        ? `
          radial-gradient(ellipse at 20% 20%, rgba(0,0,0,0.04) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 80%, rgba(0,0,0,0.03) 0%, transparent 50%),
          radial-gradient(circle at 30% 40%, rgba(80,80,100,0.60) 1px, transparent 1px),
          radial-gradient(circle at 70% 20%, rgba(80,80,100,0.52) 1px, transparent 1px),
          radial-gradient(circle at 50% 70%, rgba(80,80,100,0.56) 1px, transparent 1px),
          radial-gradient(circle at 15% 80%, rgba(80,80,100,0.48) 1px, transparent 1px),
          radial-gradient(circle at 85% 60%, rgba(80,80,100,0.60) 1px, transparent 1px),
          radial-gradient(circle at 60% 45%, rgba(80,80,100,0.52) 1px, transparent 1px),
          radial-gradient(circle at 40% 15%, rgba(80,80,100,0.55) 1px, transparent 1px),
          radial-gradient(circle at 90% 35%, rgba(80,80,100,0.48) 1px, transparent 1px)
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
          radial-gradient(ellipse at 15% 15%, rgba(180,130,0,0.09) 0%, transparent 45%),
          radial-gradient(ellipse at 85% 85%, rgba(150,110,0,0.07) 0%, transparent 45%),
          radial-gradient(circle at 25% 35%, rgba(160,120,0,0.72) 1px, transparent 1px),
          radial-gradient(circle at 75% 25%, rgba(180,140,0,0.68) 1px, transparent 1px),
          radial-gradient(circle at 45% 65%, rgba(160,120,0,0.70) 1px, transparent 1px),
          radial-gradient(circle at 80% 70%, rgba(180,140,0,0.62) 1px, transparent 1px),
          radial-gradient(circle at 10% 55%, rgba(160,120,0,0.65) 1px, transparent 1px),
          radial-gradient(circle at 60% 15%, rgba(180,140,0,0.72) 1px, transparent 1px),
          radial-gradient(circle at 35% 85%, rgba(160,120,0,0.58) 1px, transparent 1px)
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
          radial-gradient(ellipse at 20% 30%, rgba(99,102,241,0.10) 0%, transparent 45%),
          radial-gradient(ellipse at 80% 70%, rgba(79,70,229,0.08) 0%, transparent 45%),
          radial-gradient(circle at 30% 40%, rgba(99,102,241,0.65) 1px, transparent 1px),
          radial-gradient(circle at 70% 20%, rgba(79,70,229,0.60) 1px, transparent 1px),
          radial-gradient(circle at 55% 70%, rgba(99,102,241,0.62) 1px, transparent 1px),
          radial-gradient(circle at 15% 60%, rgba(79,70,229,0.55) 1px, transparent 1px),
          radial-gradient(circle at 88% 50%, rgba(99,102,241,0.60) 1px, transparent 1px),
          radial-gradient(circle at 45% 15%, rgba(79,70,229,0.65) 1px, transparent 1px),
          radial-gradient(circle at 75% 85%, rgba(99,102,241,0.50) 1px, transparent 1px)
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

  const isImageBg = glitterTheme.startsWith('data:');
  const activeGlitter: React.CSSProperties = isImageBg
    ? {
        backgroundImage: `url(${glitterTheme})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat',
      }
    : (glitterStyles[glitterTheme] ?? {});

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{
        backgroundColor: isImageBg ? 'transparent' : 'var(--color-background, #0d1117)',
        ...activeGlitter,
      }}
    >
      <style>{`
        .dl-main::-webkit-scrollbar { display: none !important; }
        .dl-main { scrollbar-width: none !important; -ms-overflow-style: none !important; }
        .dl-inner::-webkit-scrollbar { display: none !important; }
        .dl-inner { scrollbar-width: none !important; -ms-overflow-style: none !important; }

        @keyframes loginFadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes loginSidebarIn {
          from { opacity: 0; transform: translateX(-18px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .login-stagger > * {
          animation: loginFadeUp 0.55s cubic-bezier(0.25,0.46,0.45,0.94) both;
          will-change: transform, opacity;
        }
        .login-stagger > *:nth-child(1)   { animation-delay: 0.00s; }
        .login-stagger > *:nth-child(2)   { animation-delay: 0.08s; }
        .login-stagger > *:nth-child(3)   { animation-delay: 0.16s; }
        .login-stagger > *:nth-child(4)   { animation-delay: 0.24s; }
        .login-stagger > *:nth-child(5)   { animation-delay: 0.32s; }
        .login-stagger > *:nth-child(6)   { animation-delay: 0.40s; }
        .login-stagger > *:nth-child(n+7) { animation-delay: 0.46s; }
        body.login-stagger-active aside,
        body.login-stagger-active header {
          animation: loginSidebarIn 0.55s cubic-bezier(0.25,0.46,0.45,0.94) both;
          will-change: transform, opacity;
        }
      `}</style>

      {isAuthenticated && <Navigation />}

      <div className={`flex-1 flex flex-col ${isAuthenticated && !isMobile ? 'ml-[64px]' : 'ml-0'}`} style={{ background: 'transparent' }}>
        <main className="dl-main flex-1 overflow-y-hidden overflow-x-hidden" style={{ paddingTop: isMobile ? 0 : 64, background: 'transparent' }}>
          <div id="dl-scroll" className={`dl-inner h-full overflow-y-auto overflow-x-hidden p-3 sm:p-4 lg:p-6 pb-24 lg:pb-8${staggerActive ? ' login-stagger' : ''}`} style={{ paddingTop: isMobile ? '72px' : undefined }}>
            <PageTransition>
              <Outlet />
            </PageTransition>
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
            bottom: isMobile ? 76 : 20,
            right: isMobile ? 16 : 20,
            userSelect: 'none',
            touchAction: 'none',
            cursor: 'grab',
            overflow: 'visible',
          }}
        >
          <ChatbotWidget eyeOffset={eyeOffset} />
        </div>
      )}

      {/* Sync status badge — bottom-left corner, unobtrusive */}
      {isAuthenticated && (
        <div className="fixed bottom-2 left-3 z-50">
          <SyncStatusBadge status={syncStatus} pendingCount={pendingCount} />
        </div>
      )}

      {showAuthModal && !isAuthenticated && (
        <AuthenticationModal onClose={() => setShowAuthModal(false)} />
      )}

      <TopProgressBar />

      {/* Firestore monitor modal — config-driven, admin controls visibility per dashboard */}
      <FirestoreDebugPanel />

    </div>
  );
};

export default DashboardLayout;
