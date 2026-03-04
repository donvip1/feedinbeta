import { useState, useEffect } from 'react';
import { X, Download, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const BrowserInstallBanner = () => {
  const [showBanner, setShowBanner] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if running in Capacitor native app
    const isCapacitor = !!(window as any).Capacitor?.isNativePlatform?.() || !!(window as any).Capacitor;
    
    // Check if already installed (standalone mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone === true;
    
    if (isStandalone || isCapacitor) {
      return; // Already installed or native app, don't show banner
    }

    // Check if dismissed this session
    const dismissedThisSession = sessionStorage.getItem('install-banner-dismissed');
    if (dismissedThisSession) {
      return;
    }

    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(iOS);

    // For iOS, show banner after a short delay
    if (iOS) {
      const timer = setTimeout(() => setShowBanner(true), 2000);
      return () => clearTimeout(timer);
    }

    // For Android/Desktop, listen for beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShowBanner(true), 2000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Fallback: if beforeinstallprompt doesn't fire within 4 seconds,
    // show banner with manual instructions for ALL browsers (mobile & desktop)
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    fallbackTimer = setTimeout(() => {
      setShowBanner(true);
    }, 4000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowBanner(false);
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      // For iOS, we can't trigger install programmatically
      // The banner already shows instructions
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    sessionStorage.setItem('install-banner-dismissed', 'true');
  };

  if (!showBanner) return null;

  return (
    <div className={cn(
      'fixed bottom-20 left-4 right-4 z-[100] md:left-auto md:right-4 md:max-w-sm',
      'bg-card border border-border rounded-xl shadow-xl',
      'animate-in slide-in-from-bottom-4 duration-300'
    )}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Smartphone className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm text-foreground">Install FeedIn App</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isIOS 
                ? 'Tap Share then "Add to Home Screen"' 
                : deferredPrompt
                  ? 'Install for a better experience'
                  : 'Tap ⋮ menu then "Add to Home Screen"'}
            </p>
          </div>
          <button 
            onClick={handleDismiss}
            className="p-1 hover:bg-muted rounded-md transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        
        {!isIOS && deferredPrompt && (
          <Button 
            onClick={handleInstall}
            size="sm"
            className="w-full mt-3 gap-2"
          >
            <Download className="w-4 h-4" />
            Install Now
          </Button>
        )}
      </div>
    </div>
  );
};