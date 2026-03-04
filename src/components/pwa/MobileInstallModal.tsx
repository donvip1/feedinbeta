import { useState, useEffect } from 'react';
import { X, Download, Share, Plus, Wifi, Zap, RefreshCw, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const MobileInstallModal = () => {
  const [showModal, setShowModal] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    // Check if running in Capacitor native app
    const isCapacitor = !!(window as any).Capacitor?.isNativePlatform?.() || !!(window as any).Capacitor;
    
    // Check if already installed as PWA
    const standalone = window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone === true;
    setIsStandalone(standalone || isCapacitor);

    if (standalone || isCapacitor) return;

    // Detect platform
    const userAgent = navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent) && !(window as any).MSStream;
    const isAndroidDevice = /android/.test(userAgent);
    const isMobileDevice = isIOSDevice || isAndroidDevice || /mobile|tablet/.test(userAgent);
    
    setIsIOS(isIOSDevice);
    setIsAndroid(isAndroidDevice);
    setIsMobile(isMobileDevice);

    // Don't show on desktop
    if (!isMobileDevice) return;

    // Check if dismissed recently (7 days for modal)
    const dismissedAt = localStorage.getItem('pwa_modal_dismissed');
    if (dismissedAt) {
      const dismissedTime = parseInt(dismissedAt, 10);
      if (Date.now() - dismissedTime < 7 * 24 * 60 * 60 * 1000) {
        return;
      }
    }

    // For Android - listen for beforeinstallprompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Track engagement before showing modal
    let pageViews = parseInt(localStorage.getItem('pwa_page_views') || '0', 10);
    pageViews++;
    localStorage.setItem('pwa_page_views', pageViews.toString());

    // Show modal based on engagement
    const showTrigger = () => {
      // Show after 2+ page views immediately, or after 5 seconds for first-time visitors
      if (pageViews >= 2) {
        setShowModal(true);
      } else {
        setTimeout(() => {
          setShowModal(true);
        }, 5000);
      }
    };

    // Trigger after short delay to let page load
    const initialTimer = setTimeout(showTrigger, 2000);

    return () => {
      clearTimeout(initialTimer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      setInstalling(true);
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          setShowModal(false);
          localStorage.removeItem('pwa_page_views');
        }
      } catch (error) {
        console.error('Install failed:', error);
      } finally {
        setInstalling(false);
        setDeferredPrompt(null);
      }
    }
  };

  const handleDismiss = () => {
    setShowModal(false);
    localStorage.setItem('pwa_modal_dismissed', Date.now().toString());
  };

  const handleContinueInBrowser = () => {
    setShowModal(false);
    localStorage.setItem('pwa_modal_dismissed', Date.now().toString());
  };

  if (isStandalone || !showModal || !isMobile) return null;

  const features = [
    { icon: Wifi, text: 'Works offline' },
    { icon: Zap, text: 'Fast & secure' },
    { icon: RefreshCw, text: 'Always up to date' },
    { icon: Smartphone, text: 'Native app feel' },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] bg-background/95 backdrop-blur-sm flex flex-col"
      >
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground transition-colors z-10"
          aria-label="Close"
        >
          <X size={24} />
        </button>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex-1 flex flex-col items-center justify-center px-6 py-12"
        >
          {/* App Icon */}
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-2xl shadow-primary/30 mb-6"
          >
            <img 
              src="/favicon.png" 
              alt="FeedIn" 
              className="w-16 h-16 rounded-2xl"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </motion.div>

          {/* App Name */}
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-3xl font-bold text-foreground mb-2"
          >
            FeedIn
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="text-muted-foreground text-center mb-8"
          >
            Connect • Share • Engage
          </motion.p>

          {/* Features */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="w-full max-w-sm bg-card/50 rounded-2xl p-4 mb-8 border border-border/50"
          >
            <div className="grid grid-cols-2 gap-3">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.text}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.45 + index * 0.05 }}
                  className="flex items-center gap-2"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <feature.icon size={16} className="text-primary" />
                  </div>
                  <span className="text-sm text-foreground">{feature.text}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Platform-specific CTA */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="w-full max-w-sm space-y-4"
          >
            {isIOS ? (
              // iOS Instructions
              <div className="bg-card rounded-2xl p-5 border border-border">
                <h3 className="font-semibold text-foreground mb-4 text-center">
                  Install on iPhone
                </h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-primary">1</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Share size={18} className="text-primary" />
                        <span className="text-foreground">Tap the <strong>Share</strong> button</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        At the bottom of your Safari browser
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-primary">2</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Plus size={18} className="text-primary" />
                        <span className="text-foreground">Select <strong>"Add to Home Screen"</strong></span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Scroll down in the share menu if needed
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // Android Install Button
              <Button 
                onClick={handleInstall}
                disabled={!deferredPrompt || installing}
                size="lg"
                className="w-full h-14 text-lg font-semibold rounded-xl"
              >
                {installing ? (
                  <RefreshCw size={20} className="mr-2 animate-spin" />
                ) : (
                  <Download size={20} className="mr-2" />
                )}
                {installing ? 'Installing...' : 'Install App'}
              </Button>
            )}

            {/* Continue in Browser */}
            <button
              onClick={handleContinueInBrowser}
              className="w-full py-3 text-center text-muted-foreground hover:text-foreground transition-colors"
            >
              Continue in browser
            </button>
          </motion.div>
        </motion.div>

        {/* Bottom note */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="text-center pb-8 px-6"
        >
          <p className="text-xs text-muted-foreground">
            No app store required • Installs instantly
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
