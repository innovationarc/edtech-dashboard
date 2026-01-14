// src/components/layout/DashboardLayout.tsx
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import MobileNavigation from './MobileNavigation';
import { useDashboard } from '../../contexts/DashboardContext';
import { useEffect, useState } from 'react';
import ChatbotWidget from '../ChatbotWidget'; // Import the ChatbotWidget

const DashboardLayout = () => {
  const { sidebarOpen } = useDashboard();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <div className="flex h-screen bg-background-950 overflow-hidden">
      {/* Desktop Sidebar */}
      {!isMobile && <Sidebar />}
      
      <div className={`flex-1 flex flex-col transition-all duration-300 ${
        !isMobile && sidebarOpen ? 'ml-64' : !isMobile ? 'ml-20' : 'ml-0'
      }`}>
        <Header />
        <main className="flex-1 overflow-auto">
          <div className="p-4 lg:p-6 pb-20 lg:pb-6">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile Navigation */}
      {isMobile && <MobileNavigation />}

      {/* Chatbot Widget */}
      <ChatbotWidget />
    </div>
  );
};

export default DashboardLayout;
