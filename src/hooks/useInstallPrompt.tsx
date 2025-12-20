import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface UseInstallPromptReturn {
  isInstallable: boolean;
  isInstalled: boolean;
  isMobile: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  deferredPrompt: BeforeInstallPromptEvent | null;
  promptInstall: () => Promise<boolean>;
  dismissForSession: () => void;
  dismissForWeek: () => void;
  shouldShowPrompt: boolean;
  engagementScore: number;
}

const DISMISS_SESSION_KEY = 'pwa_dismiss_session';
const DISMISS_WEEK_KEY = 'pwa_dismiss_week';
const PAGE_VIEWS_KEY = 'pwa_page_views';
const TIME_SPENT_KEY = 'pwa_time_spent';

export const useInstallPrompt = (): UseInstallPromptReturn => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [engagementScore, setEngagementScore] = useState(0);
  const [dismissedForSession, setDismissedForSession] = useState(false);

  // Check if dismissed for week
  const isDismissedForWeek = useCallback(() => {
    const dismissedAt = localStorage.getItem(DISMISS_WEEK_KEY);
    if (!dismissedAt) return false;
    const dismissedTime = parseInt(dismissedAt, 10);
    return Date.now() - dismissedTime < 7 * 24 * 60 * 60 * 1000;
  }, []);

  useEffect(() => {
    // Check standalone mode
    const standalone = window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone === true;
    setIsInstalled(standalone);

    // Check session dismissal
    const sessionDismissed = sessionStorage.getItem(DISMISS_SESSION_KEY) === 'true';
    setDismissedForSession(sessionDismissed);

    // Detect platform
    const userAgent = navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent) && !(window as any).MSStream;
    const isAndroidDevice = /android/.test(userAgent);
    const isMobileDevice = isIOSDevice || isAndroidDevice || /mobile|tablet/.test(userAgent);
    
    setIsIOS(isIOSDevice);
    setIsAndroid(isAndroidDevice);
    setIsMobile(isMobileDevice);

    // Track engagement
    let pageViews = parseInt(localStorage.getItem(PAGE_VIEWS_KEY) || '0', 10);
    pageViews++;
    localStorage.setItem(PAGE_VIEWS_KEY, pageViews.toString());

    // Calculate engagement score (0-100)
    const timeSpent = parseInt(localStorage.getItem(TIME_SPENT_KEY) || '0', 10);
    const score = Math.min(100, pageViews * 10 + Math.floor(timeSpent / 60) * 5);
    setEngagementScore(score);

    // Listen for install prompt (Android/Desktop)
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // Listen for successful install
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      localStorage.removeItem(PAGE_VIEWS_KEY);
      localStorage.removeItem(TIME_SPENT_KEY);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Track time spent
    const startTime = Date.now();
    const updateTimeSpent = () => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const total = parseInt(localStorage.getItem(TIME_SPENT_KEY) || '0', 10) + elapsed;
      localStorage.setItem(TIME_SPENT_KEY, total.toString());
    };

    window.addEventListener('beforeunload', updateTimeSpent);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('beforeunload', updateTimeSpent);
      updateTimeSpent();
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setIsInstalled(true);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Install prompt failed:', error);
      return false;
    } finally {
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  const dismissForSession = useCallback(() => {
    setDismissedForSession(true);
    sessionStorage.setItem(DISMISS_SESSION_KEY, 'true');
  }, []);

  const dismissForWeek = useCallback(() => {
    setDismissedForSession(true);
    localStorage.setItem(DISMISS_WEEK_KEY, Date.now().toString());
  }, []);

  // Calculate if prompt should be shown
  const shouldShowPrompt = 
    isMobile && 
    !isInstalled && 
    !dismissedForSession && 
    !isDismissedForWeek() &&
    (isIOS || deferredPrompt !== null);

  return {
    isInstallable: deferredPrompt !== null || isIOS,
    isInstalled,
    isMobile,
    isIOS,
    isAndroid,
    deferredPrompt,
    promptInstall,
    dismissForSession,
    dismissForWeek,
    shouldShowPrompt,
    engagementScore,
  };
};
