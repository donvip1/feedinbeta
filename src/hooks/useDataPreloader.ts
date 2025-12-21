import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { startupPreloader } from '@/lib/startup-preloader';
import { backgroundSync } from '@/lib/background-sync';

/**
 * Hook to initialize data preloading and background sync on app start
 * Should be used once in the App or main layout component
 */
export function useDataPreloader(): void {
  const { user } = useAuth();
  const initialized = useRef(false);

  useEffect(() => {
    if (user?.id && !initialized.current) {
      initialized.current = true;

      // Start aggressive preload
      startupPreloader.startPreload(user.id);

      // Initialize background sync
      backgroundSync.initialize(user.id);
    }

    // Cleanup on user change or unmount
    return () => {
      if (!user) {
        initialized.current = false;
        backgroundSync.stop();
        startupPreloader.reset();
      }
    };
  }, [user?.id]);
}

/**
 * Hook to listen for background sync updates
 */
export function useBackgroundSyncListener(callback: () => void): void {
  useEffect(() => {
    return backgroundSync.onSync(callback);
  }, [callback]);
}

export default useDataPreloader;
