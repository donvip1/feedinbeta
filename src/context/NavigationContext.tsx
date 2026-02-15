import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface NavigationContextType {
  isSubPage: boolean;
  hideBottomNav: boolean;
  setHideBottomNav: (hide: boolean) => void;
  isLiveStreamPage: boolean;
  goBack: (fallback?: string) => void;
  historyStack: string[];
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

// Route hierarchy for fallback derivation
const ROUTE_FALLBACKS: Record<string, string> = {
  '/wallet/p2p': '/wallet',
  '/wallet/credits': '/wallet',
  '/wallet/subscription': '/wallet',
  '/p2p/payment-methods': '/wallet/p2p',
  '/settings/account': '/settings',
  '/settings/currency': '/settings',
  '/settings/privacy': '/settings',
  '/settings/notifications': '/settings',
  '/ai/learn': '/ai/copilot',
};

function deriveFallback(pathname: string): string {
  // Check explicit map first
  if (ROUTE_FALLBACKS[pathname]) return ROUTE_FALLBACKS[pathname];
  
  // Derive parent: /a/b/c -> /a/b -> /a -> /
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length > 1) {
    return '/' + segments.slice(0, -1).join('/');
  }
  return '/feed';
}

export const NavigationProvider = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [hideBottomNav, setHideBottomNav] = useState(false);
  const historyStackRef = useRef<string[]>([]);
  const [historyStack, setHistoryStack] = useState<string[]>([]);

  // Track navigation history
  useEffect(() => {
    const currentPath = location.pathname;
    const stack = historyStackRef.current;
    
    // Don't push duplicates
    if (stack[stack.length - 1] !== currentPath) {
      stack.push(currentPath);
      // Keep stack manageable
      if (stack.length > 50) stack.shift();
      setHistoryStack([...stack]);
    }
  }, [location.pathname]);

  const goBack = useCallback((fallback?: string) => {
    const state = location.state as { returnTo?: string; preserveFeed?: boolean } | null;
    
    // 1. Explicit returnTo in state
    if (state?.returnTo) {
      navigate(state.returnTo, { state: { preserveFeed: state.preserveFeed } });
      return;
    }

    // 2. Use our tracked history stack (primary method)
    const stack = historyStackRef.current;
    if (stack.length > 1) {
      // Pop current page off the stack
      stack.pop();
      const previousPath = stack[stack.length - 1];
      if (previousPath && previousPath !== location.pathname) {
        // Use regular navigate (not replace) so browser history stays intact
        navigate(previousPath);
        return;
      }
    }

    // 3. Try browser history
    if (window.history.length > 2) {
      navigate(-1);
      return;
    }

    // 4. Fallback to derived parent route
    navigate(fallback || deriveFallback(location.pathname));
  }, [navigate, location]);

  const isLiveStreamPage = useMemo(() => {
    const pathname = location.pathname;
    const isLiveDashboard = pathname === '/live';
    const isLiveDetail = HIDDEN_NAV_ROUTES.some(route => pathname.startsWith(route));
    return isLiveDashboard || isLiveDetail;
  }, [location.pathname]);

  const isSubPage = useMemo(() => {
    const pathname = location.pathname;
    const isMainRoute = MAIN_ROUTES.includes(pathname);
    const isProfilePage = /^\/profile\/[^\/]+$/.test(pathname) && !pathname.endsWith('/edit');
    const isRootPage = ['/', '/welcome', '/auth', '/install'].includes(pathname);
    return !isMainRoute && !isProfilePage && !isRootPage;
  }, [location.pathname]);

  useEffect(() => {
    setHideBottomNav(false);
  }, [location.pathname]);

  const value = useMemo(() => ({
    isSubPage,
    hideBottomNav,
    setHideBottomNav,
    isLiveStreamPage,
    goBack,
    historyStack
  }), [isSubPage, hideBottomNav, isLiveStreamPage, goBack, historyStack]);

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    return {
      isSubPage: false,
      hideBottomNav: false,
      setHideBottomNav: () => {},
      isLiveStreamPage: false,
      goBack: () => { window.history.back(); },
      historyStack: []
    };
  }
  return context;
};

export { NavigationContext };
