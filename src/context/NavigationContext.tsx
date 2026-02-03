import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';

interface NavigationContextType {
  isSubPage: boolean;
  hideBottomNav: boolean;
  setHideBottomNav: (hide: boolean) => void;
  isLiveStreamPage: boolean;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

// Main pages where BottomNav should always show
const MAIN_ROUTES = [
  '/feed',
  '/messages',
  '/wallet',
  '/ai/copilot',
  '/ai/learn',
  '/live',
  '/settings'
];

// Routes where BottomNav should be completely hidden
const HIDDEN_NAV_ROUTES = [
  '/live/stream/',
  '/live/space/',
  '/space/'
];

export const NavigationProvider = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const [hideBottomNav, setHideBottomNav] = useState(false);

// Check if current page is a livestream/space detail page OR the main /live dashboard
  const isLiveStreamPage = useMemo(() => {
    const pathname = location.pathname;
    // Hide on exact /live dashboard AND on live stream/space detail pages
    const isLiveDashboard = pathname === '/live';
    const isLiveDetail = HIDDEN_NAV_ROUTES.some(route => pathname.startsWith(route));
    return isLiveDashboard || isLiveDetail;
  }, [location.pathname]);

  const isSubPage = useMemo(() => {
    const pathname = location.pathname;
    
    // Check if it's an exact match to main routes
    const isMainRoute = MAIN_ROUTES.includes(pathname);
    
    // Profile page (without /edit) is also a main route
    const isProfilePage = /^\/profile\/[^\/]+$/.test(pathname) && !pathname.endsWith('/edit');
    
    // Root, welcome, auth, and install are not sub-pages
    const isRootPage = ['/', '/welcome', '/auth', '/install'].includes(pathname);
    
    return !isMainRoute && !isProfilePage && !isRootPage;
  }, [location.pathname]);

  // Reset manual hide when navigating
  useEffect(() => {
    setHideBottomNav(false);
  }, [location.pathname]);

  const value = useMemo(() => ({
    isSubPage,
    hideBottomNav,
    setHideBottomNav,
    isLiveStreamPage
  }), [isSubPage, hideBottomNav, isLiveStreamPage]);

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    // Return safe defaults if used outside provider
    return {
      isSubPage: false,
      hideBottomNav: false,
      setHideBottomNav: () => {},
      isLiveStreamPage: false
    };
  }
  return context;
};

export { NavigationContext };
