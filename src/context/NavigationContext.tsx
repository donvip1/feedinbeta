import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';

interface NavigationContextType {
  isSubPage: boolean;
  hideBottomNav: boolean;
  setHideBottomNav: (hide: boolean) => void;
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

export const NavigationProvider = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const [hideBottomNav, setHideBottomNav] = useState(false);

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
    setHideBottomNav
  }), [isSubPage, hideBottomNav]);

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
      setHideBottomNav: () => {}
    };
  }
  return context;
};

export { NavigationContext };
