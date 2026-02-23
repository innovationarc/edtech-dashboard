// src/components/layout/DashboardLayout.tsx
// Updated to use combined Navigation component - FIXED VERSION
import { Outlet } from 'react-router-dom';
import Navigation from './Navigation';
import MobileNavigation from './MobileNavigation';
import { useDashboard } from '../../contexts/DashboardContext';
import { useEffect, useState } from 'react';
import ChatbotWidget from '../ChatbotWidget';
import AuthenticationModal from '../auth/AuthenticationModal';

const DashboardLayout = () => {
  const { sidebarOpen, isAuthenticated } = useDashboard();
  const [isMobile, setIsMobile] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Show authentication modal when user is not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      // Small delay for smoother UX
      const timer = setTimeout(() => {
        setShowAuthModal(true);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setShowAuthModal(false);
    }
  }, [isAuthenticated]);

  return (
    <div className="flex h-screen bg-background-950 overflow-hidden">
      {/* Inject global scrollbar-hide rule for the main scroll area */}
      <style>{`
        .dl-main::-webkit-scrollbar { display: none !important; }
        .dl-main { scrollbar-width: none !important; -ms-overflow-style: none !important; }
      `}</style>

      {/* Navigation Component (Combined Sidebar + Header) - Both are now fixed positioned */}
      <Navigation />
      
      {/* Main content wrapper - Add margin for sidebar and padding for header */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ease-in-out ${
        !isMobile && sidebarOpen ? 'ml-64' : !isMobile ? 'ml-20' : 'ml-0'
      }`}>
        {/* Main content area - overflow-auto kept for scroll, scrollbar visually hidden */}
        <main className="dl-main flex-1 overflow-auto pt-16 sm:pt-[68px] lg:pt-[72px]">
          <div className="p-2 xs:p-3 sm:p-4 lg:p-6 pb-20 lg:pb-6">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile Navigation - Only show when authenticated */}
      {isMobile && isAuthenticated && <MobileNavigation />}

      {/* Chatbot Widget - Only show when authenticated */}
      {isAuthenticated && <ChatbotWidget />}

      {/* Authentication Modal - Show when not authenticated */}
      {showAuthModal && !isAuthenticated && (
        <AuthenticationModal onClose={() => setShowAuthModal(false)} />
      )}
    </div>
  );
};

export default DashboardLayout;
