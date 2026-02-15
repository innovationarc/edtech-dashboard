// src/components/layout/DashboardLayout.tsx
// READY TO COPY-PASTE - No changes needed from original
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
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
      {/* Sidebar - Always render, visibility controlled inside Sidebar component */}
      <Sidebar />
      
      <div className={`flex-1 flex flex-col transition-all duration-300 ease-in-out ${
        !isMobile && sidebarOpen ? 'ml-64' : !isMobile ? 'ml-20' : 'ml-0'
      }`}>
        <Header />
        <main className="flex-1 overflow-auto">
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
