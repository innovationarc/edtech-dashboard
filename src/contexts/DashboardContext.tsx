// /src/contexts/DashboardContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { authService, UserProfile, AccountStatusError } from '../services/authService';
import { userService } from '../services/userService';
import { gamificationService } from '../services/gamificationService';
import { getDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { getUserSettings, getGlobalSettings } from '../services/settingsService';

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
  dashboardLayout: string;
  setDashboardLayout: (layout: string) => void;
  glitterTheme: string;
  setGlitterTheme: (glitter: string) => void;
  // NEW: forced logout message for single-device enforcement
  forcedLogoutMessage: string | null;
  setForcedLogoutMessage: (msg: string | null) => void;
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

// RELIABLE auth check:
// - auth_firebase_session: set after real Firebase sign-in, cleared on signOut or null user
// - For remember-me sessions: also validates expiry so stale data never causes a false positive
// - For non-remember-me sessions: just checks the flag (session-scoped, clears on signOut)
const hasAuthTokens = (): boolean => {
  try {
    if (localStorage.getItem('auth_firebase_session') !== 'true') return false;
    // If this was a remember-me session, validate the rolling expiry
    if (localStorage.getItem('auth_remember_me') === 'true') {
      const expiry = parseInt(localStorage.getItem('auth_remember_me_expiry') || '0', 10);
      if (expiry && Date.now() > expiry) {
        // Expired: clean up stale keys so we don't loop
        localStorage.removeItem('auth_firebase_session');
        localStorage.removeItem('auth_remember_me');
        localStorage.removeItem('auth_remember_me_expiry');
        localStorage.removeItem('auth_session_token');
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
};

export const DashboardProvider = ({ children }: DashboardProviderProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // CRITICAL FIX: Initialize based on localStorage for instant rendering
  // This eliminates the blank screen while Firebase is checking
  const [isAuthenticated, setIsAuthenticated] = useState(() => hasAuthTokens());
  const [user, setUser] = useState<UserProfile | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  
  // CRITICAL FIX: Start with loading = false if we have tokens
  // This allows instant rendering while Firebase validates in background
  const [loading, setLoading] = useState(() => !hasAuthTokens());
  
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [primaryColor, setPrimaryColor] = useState(() => localStorage.getItem('primaryColor') || '#6366f1');
  const [accentColor, setAccentColor] = useState(() => localStorage.getItem('accentColor') || '#10b981');
  const [fontFamily, setFontFamily] = useState(() => localStorage.getItem('fontFamily') || 'Inter');
  const [dashboardLayout, setDashboardLayout] = useState(() => localStorage.getItem('dashboardLayout') || 'default');
  const [glitterTheme, setGlitterTheme] = useState(() => localStorage.getItem('glitterTheme') || 'none');
  const [siteName, setSiteName] = useState('Learning Management Portal');
  const [siteTagline, setSiteTagline] = useState('Empowering educators, inspiring students');
  const [contactEmail, setContactEmail] = useState('admin@example.com');
  const [siteLogoUrl, setSiteLogoUrl] = useState('');
  const [timezone, setTimezone] = useState('utc');
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
  const isDesktopRef = React.useRef(window.innerWidth >= 1024);

  // NEW: Forced logout message state (persists across sign-out so SignInModal can display it)
  const [forcedLogoutMessage, setForcedLogoutMessage] = useState<string | null>(null);

  // NEW: Ref to hold the Firestore session listener unsubscribe function
  const sessionListenerRef = React.useRef<(() => void) | null>(null);

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
      isDesktopRef.current = desktop;
      
      // Close sidebar on mobile when switching from desktop to mobile
      if (!desktop && sidebarOpen) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [sidebarOpen]);

  useEffect(() => {
    // Re-assert browserLocalPersistence for remember-me sessions on every page load.
    // Firebase normally remembers this, but re-asserting it on startup guarantees it
    // survives across days, browser updates, and edge-case SDK resets.
    const rememberMeActive = (() => {
      try { return localStorage.getItem('auth_remember_me') === 'true'; } catch { return false; }
    })();
    if (rememberMeActive) {
      authService.assertLocalPersistence().catch(() => {});
    }

    // Timeout: give Firebase more time to restore a remember-me session from disk.
    // Non-remember sessions are ephemeral — 1.5s is fine.
    // Remember-me sessions restore from localStorage → needs up to 8s on slow mobile/cold start.
    const timeoutMs = rememberMeActive ? 8000 : 1500;
    const authCheckTimeout = setTimeout(() => {
      setLoading(false);
      if (!user) {
        setIsAuthenticated(false);
      }
    }, timeoutMs);

    const unsubscribe = authService.onAuthStateChanged(async (firebaseUser: User | null) => {
      // Clear timeout since Firebase responded
      clearTimeout(authCheckTimeout);
      
      if (firebaseUser) {
        try {
          // Get user profile from Firestore using the user's ID
          const userProfile = await userService.getUserById(firebaseUser.uid);
          if (userProfile) {
            // FIXED: Device verification now PASSIVE - only logs, never blocks
            const currentDeviceId = generateDeviceId();
            const storedDeviceId = userProfile.deviceId;
            
            if (storedDeviceId && storedDeviceId !== currentDeviceId) {
              // Informational only - useful for admins monitoring sessions
            }
            
            // CRITICAL FIX: Set ALL auth states BEFORE clearing loading
            setUser(userProfile);
            setIsAuthenticated(true);
            // Confirm Firebase session is valid — used by hasAuthTokens() on next page load
            try {
              localStorage.setItem('auth_firebase_session', 'true');
              // Renew rolling expiry on every confirmed visit so active users never get cut off
              if (localStorage.getItem('auth_remember_me') === 'true') {
                localStorage.setItem('auth_remember_me_expiry',
                  String(Date.now() + 365 * 24 * 60 * 60 * 1000));
              }
            } catch {}
            
            // Only auto-open sidebar on desktop
            if (isDesktopRef.current) {
              setSidebarOpen(true);
            }

            // FIX: Clear loading immediately so dashboard renders without waiting for streak
            setLoading(false);

            // NEW: Start single-device session listener
            // Clean up any previous listener first
            if (sessionListenerRef.current) {
              sessionListenerRef.current();
              sessionListenerRef.current = null;
            }

            // Only watch for forced logout if this device has a session token
            const localSessionToken = (() => {
              try { return localStorage.getItem('auth_session_token'); } catch { return null; }
            })();

            if (localSessionToken) {
              sessionListenerRef.current = onSnapshot(
                doc(db, 'users', firebaseUser.uid),
                (snap) => {
                  if (!snap.exists()) return;
                  const data = snap.data();
                  const firestoreToken = data.activeSessionToken;
                  const currentLocalToken = (() => {
                    try { return localStorage.getItem('auth_session_token'); } catch { return null; }
                  })();

                  // If Firestore token differs from our local token → another device logged in
                  if (
                    firestoreToken &&
                    currentLocalToken &&
                    firestoreToken !== currentLocalToken
                  ) {
                    const newIp = data.lastLoginIp || 'unknown';

                    // Clean up snapshot listener immediately to prevent re-trigger
                    if (sessionListenerRef.current) {
                      sessionListenerRef.current();
                      sessionListenerRef.current = null;
                    }

                    // Clear local session token
                    try { localStorage.removeItem('auth_session_token'); } catch {}

                    // Force sign out - preserve remember-me so user can re-login immediately
                    authService.signOut(true).catch(() => {});

                    // Update UI state
                    setUser(null);
                    setIsAuthenticated(false);
                    setSidebarOpen(false);

                    // Set the forced logout message shown on SignInModal
                    setForcedLogoutMessage(
                      `You have been logged out because another login was detected. [IP: ${newIp}]`
                    );
                  }
                },
                () => {
                  // onSnapshot error - fail silently, don't disrupt user
                }
              );
            }

            // Update user data in context when profile is updated
            const refreshUserProfile = async () => {
              try {
                const updatedProfile = await userService.getUserById(firebaseUser.uid);
                if (updatedProfile) {
                  setUser(updatedProfile);
                }
              } catch (error) {
                // Silent fail - don't expose errors in production
              }
            };

            // Expose refresh function globally for profile updates
            (window as any).refreshUserProfile = refreshUserProfile;

            // Load persisted settings from Firestore (fire-and-forget, never blocks render)
            (async () => {
              try {
                const [userSettings, globalSettings] = await Promise.all([
                  getUserSettings(firebaseUser.uid),
                  getGlobalSettings(),
                ]);
                if (userSettings.appearance) {
                  const a = userSettings.appearance;
                  if (a.theme)        { setTheme(a.theme);               localStorage.setItem('theme', a.theme); }
                  if (a.primaryColor) { setPrimaryColor(a.primaryColor); localStorage.setItem('primaryColor', a.primaryColor); }
                  if (a.accentColor)  { setAccentColor(a.accentColor);   localStorage.setItem('accentColor', a.accentColor); }
                  if (a.fontFamily)   { setFontFamily(a.fontFamily);     localStorage.setItem('fontFamily', a.fontFamily); }
                  if (a.glitterTheme) { setGlitterTheme(a.glitterTheme); localStorage.setItem('glitterTheme', a.glitterTheme); }
                }
                if (globalSettings.general) {
                  const g = globalSettings.general;
                  if (g.siteName)      setSiteName(g.siteName);
                  if (g.siteTagline)   setSiteTagline(g.siteTagline);
                  if (g.contactEmail)  setContactEmail(g.contactEmail);
                  if (g.timezone)      setTimezone(g.timezone);
                }
              } catch {
                // Silent fail — defaults remain in place
              }
            })();

            // Streak logic: fire-and-forget so it never blocks dashboard load
            // ONLY for student role - skip for admin, teacher, coordinator, etc.
            if (userProfile.role === 'student') {
              (async () => {
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
                  }
                } catch (streakError: any) {
                  // Silent fail for permission errors or missing gamification data
                }
              })();
            }
          } else {
            // User exists in Firebase Auth but not in Firestore, sign them out
            if (sessionListenerRef.current) {
              sessionListenerRef.current();
              sessionListenerRef.current = null;
            }
            await authService.signOut();
            setUser(null);
            setIsAuthenticated(false);
            setSidebarOpen(false);
            setLoading(false);
          }
        } catch (error) {
          // Silent fail in production - don't expose errors
          if (sessionListenerRef.current) {
            sessionListenerRef.current();
            sessionListenerRef.current = null;
          }
          setUser(null);
          setIsAuthenticated(false);
          setSidebarOpen(false);
          setLoading(false);
        }
      } else {
        // No authenticated user - clean up session listener
        // Clear auth_firebase_session so hasAuthTokens()=false on next page load
        // This prevents the optimistic-render flash loop when session expires naturally
        try {
          localStorage.removeItem('auth_firebase_session');
          localStorage.removeItem('auth_session_token');
        } catch {}
        if (sessionListenerRef.current) {
          sessionListenerRef.current();
          sessionListenerRef.current = null;
        }
        setUser(null);
        setIsAuthenticated(false);
        setSidebarOpen(false);
        setLoading(false);
      }
    });

    return () => {
      clearTimeout(authCheckTimeout);
      unsubscribe();
      // Clean up session listener on unmount
      if (sessionListenerRef.current) {
        sessionListenerRef.current();
        sessionListenerRef.current = null;
      }
    };
  }, []);

  // Apply theme changes to document
  useEffect(() => {
    const root = document.documentElement;

    // Persist ALL appearance prefs so they survive page refresh
    localStorage.setItem('theme',        theme);
    localStorage.setItem('primaryColor', primaryColor);
    localStorage.setItem('accentColor',  accentColor);
    localStorage.setItem('fontFamily',   fontFamily);
    localStorage.setItem('glitterTheme', glitterTheme);

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
        bg: '#ebe8e1',
        card: 'rgba(255,255,255,0.82)',
        cardLight: '#f5f2ec'
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
      },
      ocean: {
        bg: '#0c1a2e',
        card: '#0f2744',
        cardLight: '#1e3a5f'
      },
      forest: {
        bg: '#0a1f14',
        card: '#0f2d1e',
        cardLight: '#14532d'
      },
      sunset: {
        bg: '#1c0a00',
        card: '#431407',
        cardLight: '#7c2d12'
      },
      slate: {
        bg: '#0f172a',
        card: '#1e293b',
        cardLight: '#334155'
      }
    };
    
    const colors = themeColors[theme as keyof typeof themeColors] || themeColors.dark;
    root.style.setProperty('--color-background', colors.bg);
    root.style.setProperty('--color-card', colors.card);
    root.style.setProperty('--color-card-light', colors.cardLight);
    
    // Update BOTH html and body so no dark bleed shows behind content
    document.documentElement.style.backgroundColor = colors.bg;
    document.body.style.backgroundColor = colors.bg;
  }, [theme, primaryColor, accentColor, fontFamily, dashboardLayout, glitterTheme, siteName, siteTagline, contactEmail, siteLogoUrl, timezone]);

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
    
    const timeout = setTimeout(() => {
      setSidebarOpen(false);
      setHoverTimeout(null);
    }, 350);
    setHoverTimeout(timeout);
  };

  const handleSearch = (query: string) => {
    // Implement search functionality here
  };

  const handleSignIn = async (userId: string, password: string, rememberMe: boolean = false) => {
    try {
      setLoading(true);
      // NEW: Clear any previous forced logout message on new sign-in attempt
      setForcedLogoutMessage(null);
      
      const userProfile = await authService.signIn(userId, password, rememberMe);
      
      // Set user state immediately after successful sign-in
      setUser(userProfile);
      setIsAuthenticated(true);
      
      // Only auto-open sidebar on desktop
      if (isDesktop) {
        setSidebarOpen(true);
      }

      // Welcome dynamic island — fires only here (real login), never on refresh
      const surname = userProfile.surname?.trim();
      const name = surname || 'there';

      const firstLoginMessage = `Welcome, ${name}! Your learning journey begins today.`;

      const returningMessages = [
        `Welcome back, ${name}! Glad you're here.`,
        `Hey ${name}, good to see you again.`,
        `You're back, ${name}. Right where you left off.`,
        `Welcome back, ${name}. We kept your spot.`,
        `${name}, great to have you back!`,
        `Hey ${name}, ready to pick up where you left off?`,
        `Welcome back, ${name}. Your progress is waiting.`,
        `Good to see you again, ${name}.`,
        `${name}, you showed up. That's what matters.`,
        `${name}, welcome back. Good to have you here.`,
      ];

      const message = userProfile.isFirstLogin
        ? firstLoginMessage
        : returningMessages[Math.floor(Math.random() * returningMessages.length)];
      setTimeout(() => (window as any).addNotification?.(message, userProfile.isFirstLogin ? 'success' : 'info'), 1200);
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
      // Clean up session listener before signing out
      if (sessionListenerRef.current) {
        sessionListenerRef.current();
        sessionListenerRef.current = null;
      }
      // This now clears both Firebase persistence AND localStorage remember me data
      await authService.signOut();
      setUser(null);
      setIsAuthenticated(false);
      setSidebarOpen(false);
    } catch (error: any) {
      // Silent fail in production
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

  const handleSetGlitterTheme = (glitter: string) => {
    setGlitterTheme(glitter);
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
        canAccessUserManagement,
        dashboardLayout,
        setDashboardLayout,
        glitterTheme,
        setGlitterTheme: handleSetGlitterTheme,
        forcedLogoutMessage,
        setForcedLogoutMessage,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
};
