import { createContext, useContext, useCallback, useRef, useEffect } from 'react';
import type { FC, ReactNode } from 'react';

export type RefreshPage = 'feed' | 'chats' | 'wallet' | 'profile' | 'learn' | 'ai';

export interface RefreshContextType {
  triggerRefresh: (page: RefreshPage) => void;
  subscribeToRefresh: (page: RefreshPage, callback: () => void) => () => void;
}

export const RefreshContext = createContext<RefreshContextType | null>(null);

export const RefreshProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const subscribersRef = useRef<Map<RefreshPage, Set<() => void>>>(new Map());

  const triggerRefresh = useCallback((page: RefreshPage) => {
    const subscribers = subscribersRef.current.get(page);
    if (subscribers) {
      subscribers.forEach(callback => {
        // Execute callbacks in next tick to avoid blocking UI
        setTimeout(callback, 0);
      });
    }
  }, []);

  const subscribeToRefresh = useCallback((page: RefreshPage, callback: () => void) => {
    if (!subscribersRef.current.has(page)) {
      subscribersRef.current.set(page, new Set());
    }
    subscribersRef.current.get(page)!.add(callback);

    // Return unsubscribe function
    return () => {
      const subscribers = subscribersRef.current.get(page);
      if (subscribers) {
        subscribers.delete(callback);
      }
    };
  }, []);

  return (
    <RefreshContext.Provider value={{ triggerRefresh, subscribeToRefresh }}>
      {children}
    </RefreshContext.Provider>
  );
};

export const useRefresh = () => {
  const context = useContext(RefreshContext);
  if (!context) {
    throw new Error('useRefresh must be used within a RefreshProvider');
  }
  return context;
};

// Hook for pages to subscribe to refresh events
export const usePageRefresh = (page: RefreshPage, onRefresh: () => void) => {
  const { subscribeToRefresh } = useRefresh();
  
  useEffect(() => {
    const unsubscribe = subscribeToRefresh(page, onRefresh);
    return unsubscribe;
  }, [page, onRefresh, subscribeToRefresh]);
};
