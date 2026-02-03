// /src/contexts/DashboardContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { authService, UserProfile, AccountStatusError } from '../services/authService';
import { userService } from '../services/userService';
import { gamificationService } from '../services/gamificationService';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';

interface DashboardContextType {
  sidebarOpen: boolean;
  toggleSidebarClick: () => void;
  handleMouseEnterSidebarArea: () => void;
  handleMouseLeaveSidebarArea: () => void;
  handleSearch: (query: string) => void;
  handleSignIn: (userId: string, password: string, rememberMe?: boolean) => Promise<void>;
  handleSignOut: () => Promise<void>;
  isAuthenticated: boolean;
  user: UserProfile | null;
  showPaymentModal: boolean;
  setShowPaymentModal: (show: boolean) => void;
  loading: boolean;
  theme: string;
  setTheme: (theme: string) => void;
  primaryColor: string;
  setPrimaryColor: (color: string) => void;
  accentColor: string;
  setAccentColor: (color: string) => void;
  fontFamily: string;
  setFontFamily: (font: string) => void;
  siteName: string;
  setSiteName: (name: string) => void;
  siteTagline: string;
  setSiteTagline: (tagline: string) => void;
  contactEmail: string;
  setContactEmail: (email: string) => void;
  siteLogoUrl: string;
  setSiteLogoUrl: (url: string) => void;
  timezone: string;
  setTimezone: (timezone: string) => void;
  canAccessUserManagement: () => boolean;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
};

interface DashboardProviderProps {
  children: ReactNode;
}

// Generate device fingerprint (same as in authService)
const generateDeviceId = (): string => {
  const navigator = window.navigator;
  const screen = window.screen;
  
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.colorDepth,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 'unknown',
  ].join('|');
  
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return 'device_' + Math.abs(hash).toString(36);
};

export const DashboardProvider = ({ children }: DashboardProviderProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [primaryColor, setPrimaryColor] = useState(() => localStorage.getItem('primaryColor') || '#6366f1');
  const [accentColor, setAccentColor] = useState(() => localStorage.getItem('accentColor') || '#10b981');
  const [fontFamily, setFontFamily] = useState(() => localStorage.getItem('fontFamily') || 'Inter');
  const [siteName, setSiteName] = useState(() => localStorage.getItem('siteName') || 'Learning Management Portal');
  const [siteTagline, setSiteTagline] = useState(() => localStorage.getItem('siteTagline') || 'Empowering educators, inspiring students');
  const [contactEmail, setContactEmail] = useState(() => localStorage.getItem('contactEmail') || 'admin@example.com');
  const [siteLogoUrl, setSiteLogoUrl] = useState(() => localStorage.getItem('siteLogoUrl') || '');
  const [timezone, setTimezone] = useState(() => localStorage.getItem('timezone') || 'utc');
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

  // Function to check if user can access User Management
  const canAccessUserManagement = (): boolean => {
    if (!user) return false;
    // Teacher, Student, Parent MUST NOT have access
    return user.role === 'admin' || 
           user.role === 'manager' || 
           user.role === 'coordinator' ||
           user.role === 'student_manager' ||
           user.role === 'course_manager';
  };

  // Handle window resize to detect desktop/mobile
  useEffect(() => {
    const handleResize = () => {
      const desktop = window.innerWidth >= 1024;
      setIsDesktop(desktop);
      
      // Close sidebar on mobile when switching from desktop to mobile
      if (!desktop && sidebarOpen) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [sidebarOpen]);

  useEffect(() => {
    const unsubscribe = authService.onAuthStateChanged(async (firebaseUser: User | null) => {
      if (firebaseUser) {
        try {
          // Get user profile from Firestore using the user's ID
          const userProfile = await userService.getUserById(firebaseUser.uid);
          if (userProfile) {
            // CRITICAL: Device verification for single-device login enforcement
            const currentDeviceId = generateDeviceId();
            const storedDeviceId = userProfile.deviceId;
            
            // If stored device ID exists and doesn't match current device, log out
            if (storedDeviceId && storedDeviceId !== currentDeviceId) {
              console.log('Different device detected. Logging out from this device.');
              await authService.signOut();
              setUser(null);
              setIsAuthenticated(false);
              setSidebarOpen(false);
              setLoading(false);
              return;
            }
            
            setUser(userProfile);
            setIsAuthenticated(true);
            // Only auto-open sidebar on desktop
            if (isDesktop) {
              setSidebarOpen(true);
            }

            // Update user data in context when profile is updated
            const refreshUserProfile = async () => {
              try {
                const updatedProfile = await userService.getUserById(firebaseUser.uid);
                if (updatedProfile) {
                  setUser(updatedProfile);
                }
              } catch (error) {
                console.error('Error refreshing user profile:', error);
              }
            };

            // Expose refresh function globally for profile updates
            (window as any).refreshUserProfile = refreshUserProfile;

            // Streak logic: Check and update study streak
            // ONLY for student role - skip for admin, teacher, coordinator, etc.
            if (userProfile.role === 'student') {
              try {
                const userStats = await gamificationService.getUserStats(userProfile.uid);
                if (userStats) {
                  const today = new Date();
                  const lastActivityDate = userStats.lastActivityDate;

                  // Normalize dates to compare only day, month, year
                  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                  const lastActivityDay = new Date(lastActivityDate.getFullYear(), lastActivityDate.getMonth(), lastActivityDate.getDate());

                  const diffTime = Math.abs(todayDate.getTime() - lastActivityDay.getTime());
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                  if (diffDays === 1) { // Consecutive day
                    const newStreak = userStats.currentStreak + 1;
                    await gamificationService.recordActivity(userProfile.uid, 'streak_updated', { newStreak });
                  } else if (diffDays > 1) { // Gap in days, reset streak
                    await gamificationService.recordActivity(userProfile.uid, 'streak_updated', { newStreak: 1 });
                  }
                  // If diffDays is 0, it's the same day, no change to streak needed yet.
                  // The study_session activity will update lastActivityDate.
                }
              } catch (streakError: any) {
                // Silent fail for permission errors or missing gamification data
                // This is normal for non-student users (admin, teacher, etc.)
                if (!streakError.message?.includes('permission')) {
                  console.warn('Streak update skipped:', streakError.message);
                }
              }
            }
          } else {
            // User exists in Firebase Auth but not in Firestore, sign them out
            await authService.signOut();
            setUser(null);
            setIsAuthenticated(false);
            setSidebarOpen(false);
          }
        } catch (error) {
          console.error('Error getting user profile:', error);
          setUser(null);
          setIsAuthenticated(false);
          setSidebarOpen(false);
        }
      } else {
        setUser(null);
        setIsAuthenticated(false);
        setSidebarOpen(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isDesktop]);

  // Apply theme changes to document
  useEffect(() => {
    const root = document.documentElement;
    
    // Save to localStorage
    localStorage.setItem('theme', theme);
    localStorage.setItem('primaryColor', primaryColor);
    localStorage.setItem('accentColor', accentColor);
    localStorage.setItem('fontFamily', fontFamily);
    localStorage.setItem('siteName', siteName);
    localStorage.setItem('siteTagline', siteTagline);
    localStorage.setItem('contactEmail', contactEmail);
    localStorage.setItem('siteLogoUrl', siteLogoUrl);
    localStorage.setItem('timezone', timezone);
    
    // Apply theme classes
    root.className = root.className.replace(/theme-\w+/g, '');
    root.classList.add(`theme-${theme}`);
    
    // Apply custom colors
    root.style.setProperty('--color-primary', primaryColor);
    root.style.setProperty('--color-accent', accentColor);
    
    // Apply font family
    root.style.setProperty('--font-sans', fontFamily);
    
    // Apply theme-specific background colors
    const themeColors = {
      dark: {
        bg: '#0d1117',
        card: '#1f2937',
        cardLight: '#374151'
      },
      light: {
        bg: '#f9fafb',
        card: '#ffffff',
        cardLight: '#f3f4f6'
      },
      purple: {
        bg: '#1e1b4b',
        card: '#312e81',
        cardLight: '#4c1d95'
      },
      pink: {
        bg: '#831843',
        card: '#9d174d',
        cardLight: '#be185d'
      }
    };
    
    const colors = themeColors[theme as keyof typeof themeColors] || themeColors.dark;
    root.style.setProperty('--color-background', colors.bg);
    root.style.setProperty('--color-card', colors.card);
    root.style.setProperty('--color-card-light', colors.cardLight);
    
    // Update body background
    document.body.style.backgroundColor = colors.bg;
  }, [theme, primaryColor, accentColor, fontFamily, siteName, siteTagline, contactEmail, siteLogoUrl, timezone]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
      }
    };
  }, [hoverTimeout]);

  const toggleSidebarClick = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleMouseEnterSidebarArea = () => {
    // Only handle hover on desktop
    if (!isDesktop) return;
    
    // Clear any pending timeout
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      setHoverTimeout(null);
    }
    setSidebarOpen(true);
  };

  const handleMouseLeaveSidebarArea = () => {
    // Only handle hover on desktop
    if (!isDesktop) return;
    
    // Set a timeout to close the sidebar after a short delay
    const timeout = setTimeout(() => {
      setSidebarOpen(false);
      setHoverTimeout(null);
    }, 300);
    setHoverTimeout(timeout);
  };

  const handleSearch = (query: string) => {
    console.log('Searching for:', query);
    // Implement search functionality here
  };

  const handleSignIn = async (userId: string, password: string, rememberMe: boolean = false) => {
    try {
      setLoading(true);
      // Call authService.signIn with rememberMe parameter
      // This now throws AccountStatusError if account is not active
      const userProfile = await authService.signIn(userId, password, rememberMe);
      setUser(userProfile);
      setIsAuthenticated(true);
      // Only auto-open sidebar on desktop
      if (isDesktop) {
        setSidebarOpen(true);
      }
    } catch (error: any) {
      setLoading(false);
      // Re-throw AccountStatusError or other errors to be caught by SignInModal
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await authService.signOut();
      setUser(null);
      setIsAuthenticated(false);
      setSidebarOpen(false);
    } catch (error: any) {
      console.error('Error signing out:', error);
    }
  };

  const handleSetTheme = (newTheme: string) => {
    setTheme(newTheme);
  };

  const handleSetPrimaryColor = (color: string) => {
    setPrimaryColor(color);
  };

  const handleSetAccentColor = (color: string) => {
    setAccentColor(color);
  };

  const handleSetFontFamily = (font: string) => {
    setFontFamily(font);
  };

  const handleSetSiteName = (name: string) => {
    setSiteName(name);
  };

  const handleSetSiteTagline = (tagline: string) => {
    setSiteTagline(tagline);
  };

  const handleSetContactEmail = (email: string) => {
    setContactEmail(email);
  };

  const handleSetSiteLogoUrl = (url: string) => {
    setSiteLogoUrl(url);
  };

  const handleSetTimezone = (tz: string) => {
    setTimezone(tz);
  };

  return (
    <DashboardContext.Provider 
      value={{ 
        sidebarOpen, 
        toggleSidebarClick,
        handleMouseEnterSidebarArea,
        handleMouseLeaveSidebarArea,
        handleSearch, 
        handleSignIn,
        handleSignOut,
        isAuthenticated,
        user,
        showPaymentModal,
        setShowPaymentModal,
        loading,
        theme,
        setTheme: handleSetTheme,
        primaryColor,
        setPrimaryColor: handleSetPrimaryColor,
        accentColor,
        setAccentColor: handleSetAccentColor,
        fontFamily,
        setFontFamily: handleSetFontFamily,
        siteName,
        setSiteName: handleSetSiteName,
        siteTagline,
        setSiteTagline: handleSetSiteTagline,
        contactEmail,
        setContactEmail: handleSetContactEmail,
        siteLogoUrl,
        setSiteLogoUrl: handleSetSiteLogoUrl,
        timezone,
        setTimezone: handleSetTimezone,
        canAccessUserManagement
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
};
