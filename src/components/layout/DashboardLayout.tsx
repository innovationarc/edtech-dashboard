// src/components/layout/DashboardLayout.tsx
import { Outlet } from 'react-router-dom';
import Navigation from './Navigation';
import MobileNavigation from './MobileNavigation';
import { useDashboard } from '../../contexts/DashboardContext';
import { useEffect, useState, useRef } from 'react';
import ChatbotWidget from '../ChatbotWidget';
import AuthenticationModal from '../auth/AuthenticationModal';

const DashboardLayout = () => {
  const { sidebarOpen, isAuthenticated } = useDashboard();
  const [isMobile, setIsMobile] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ mouseX: number; mouseY: number; posX: number; posY: number } | null>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    setShowAuthModal(!isAuthenticated);
  }, [isAuthenticated]);

  const startDrag = (clientX: number, clientY: number) => {
    dragStart.current = { mouseX: clientX, mouseY: clientY, posX: position.x, posY: position.y };
    setDragging(true);
  };

  useEffect(() => {
    const onMove = (clientX: number, clientY: number) => {
      if (!dragging || !dragStart.current) return;
      setPosition({
        x: dragStart.current.posX + (clientX - dragStart.current.mouseX),
        y: dragStart.current.posY + (clientY - dragStart.current.mouseY),
      });
    };
    const onEnd = () => { setDragging(false); dragStart.current = null; };

    const handleMouseMove = (e: MouseEvent) => onMove(e.clientX, e.clientY);
    const handleTouchMove = (e: TouchEvent) => onMove(e.touches[0].clientX, e.touches[0].clientY);

    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', onEnd);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', onEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, [dragging]);

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
          onMouseDown={(e) => { startDrag(e.clientX, e.clientY); e.preventDefault(); }}
          onTouchStart={(e) => startDrag(e.touches[0].clientX, e.touches[0].clientY)}
          style={{
            position: 'fixed',
            transform: `translate(${position.x}px, ${position.y}px)`,
            zIndex: 1000,
            bottom: 0,
            right: 0,
            cursor: dragging ? 'grabbing' : 'grab',
            userSelect: 'none',
          }}
        >
          <ChatbotWidget />
        </div>
      )}

      {showAuthModal && !isAuthenticated && (
        <AuthenticationModal onClose={() => setShowAuthModal(false)} />
      )}
    </div>
  );
};

export default DashboardLayout;
  
