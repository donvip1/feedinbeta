import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Smartphone, Star, Zap, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import feedinIcon from '@/assets/feedin-icon.png';

interface AndroidAppBannerProps {
  onClose?: () => void;
  variant?: 'banner' | 'card' | 'floating';
  showAlways?: boolean;
}

export const AndroidAppBanner: React.FC<AndroidAppBannerProps> = ({
  onClose,
  variant = 'banner',
  showAlways = false,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    // Check if on Android and not already in native app
    const ua = navigator.userAgent.toLowerCase();
    const isAndroidDevice = /android/i.test(ua);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isCapacitor = !!(window as { Capacitor?: unknown }).Capacitor;

    setIsAndroid(isAndroidDevice);
    setIsInstalled(isStandalone || isCapacitor);

    // Show banner if on Android and not installed
    if ((isAndroidDevice && !isStandalone && !isCapacitor) || showAlways) {
      // Check if user dismissed recently
      const dismissed = localStorage.getItem('app_banner_dismissed');
      if (dismissed) {
        const dismissedTime = parseInt(dismissed);
        if (Date.now() - dismissedTime < 24 * 60 * 60 * 1000) {
          return; // Don't show for 24 hours after dismissal
        }
      }
      setIsVisible(true);
    }
  }, [showAlways]);

  const handleClose = () => {
    setIsVisible(false);
    localStorage.setItem('app_banner_dismissed', Date.now().toString());
    onClose?.();
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    
    // In production, this would link to your APK in Supabase Storage
    // For now, we'll show the Install page with instructions
    window.location.href = '/install';
    
    setIsDownloading(false);
  };

  if (!isVisible) return null;

  if (variant === 'floating') {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          className="fixed bottom-20 left-4 right-4 z-50"
        >
          <div className="bg-gradient-to-r from-primary to-primary/80 rounded-2xl p-4 shadow-lg">
            <button
              onClick={handleClose}
              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center"
            >
              <X className="w-4 h-4 text-white" />
            </button>
            
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center overflow-hidden">
                <img src={feedinIcon} alt="FeedIn" className="w-12 h-12" />
              </div>
              
              <div className="flex-1">
                <h3 className="font-semibold text-white">Get the FeedIn App</h3>
                <p className="text-white/80 text-sm">Faster, smoother experience</p>
              </div>
              
              <Button
                onClick={handleDownload}
                disabled={isDownloading}
                className="bg-white text-primary hover:bg-white/90"
              >
                {isDownloading ? (
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Install'
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  if (variant === 'card') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card border border-border rounded-2xl p-6 shadow-lg"
      >
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center overflow-hidden">
            <img src={feedinIcon} alt="FeedIn" className="w-14 h-14" />
          </div>
          
          <div className="flex-1">
            <h3 className="font-semibold text-lg">FeedIn for Android</h3>
            <div className="flex items-center gap-1 mt-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              ))}
              <span className="text-sm text-muted-foreground ml-2">4.9 (10K+ downloads)</span>
            </div>
            
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="px-2 py-1 bg-muted rounded-full text-xs flex items-center gap-1">
                <Zap className="w-3 h-3" /> Fast
              </span>
              <span className="px-2 py-1 bg-muted rounded-full text-xs flex items-center gap-1">
                <Shield className="w-3 h-3" /> Secure
              </span>
              <span className="px-2 py-1 bg-muted rounded-full text-xs flex items-center gap-1">
                <Smartphone className="w-3 h-3" /> Native
              </span>
            </div>
          </div>
        </div>
        
        <Button
          onClick={handleDownload}
          disabled={isDownloading}
          className="w-full mt-4"
          size="lg"
        >
          <Download className="w-5 h-5 mr-2" />
          {isDownloading ? 'Preparing Download...' : 'Download APK'}
        </Button>
        
        <p className="text-xs text-center text-muted-foreground mt-3">
          Direct download • No Play Store required
        </p>
      </motion.div>
    );
  }

  // Default banner variant
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-gradient-to-r from-primary/10 to-primary/5 border-b border-primary/20"
    >
      <div className="flex items-center gap-3 p-3">
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center overflow-hidden flex-shrink-0">
          <img src={feedinIcon} alt="FeedIn" className="w-8 h-8" />
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm truncate">Use the FeedIn App</h3>
          <p className="text-xs text-muted-foreground truncate">Better experience, faster loading</p>
        </div>
        
        <Button
          onClick={handleDownload}
          size="sm"
          className="flex-shrink-0"
        >
          Install
        </Button>
        
        <button
          onClick={handleClose}
          className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
};

// Full-screen install prompt for Welcome page
export const AndroidInstallPrompt: React.FC<{
  onClose: () => void;
}> = ({ onClose }) => {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = () => {
    setIsDownloading(true);
    window.location.href = '/install';
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-card rounded-3xl p-6 max-w-sm w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center overflow-hidden mb-4">
            <img src={feedinIcon} alt="FeedIn" className="w-16 h-16" />
          </div>
          
          <h2 className="text-xl font-bold mb-2">Get FeedIn for Android</h2>
          <p className="text-muted-foreground text-sm mb-6">
            Install our native app for the best experience with TikTok-style videos, smooth animations, and offline access.
          </p>
          
          <div className="space-y-2 text-left mb-6">
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
              <Zap className="w-5 h-5 text-primary" />
              <div>
                <p className="font-medium text-sm">Lightning Fast</p>
                <p className="text-xs text-muted-foreground">60fps smooth animations</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
              <Smartphone className="w-5 h-5 text-primary" />
              <div>
                <p className="font-medium text-sm">Native Experience</p>
                <p className="text-xs text-muted-foreground">Full camera & notifications</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
              <Shield className="w-5 h-5 text-primary" />
              <div>
                <p className="font-medium text-sm">Works Offline</p>
                <p className="text-xs text-muted-foreground">Browse saved content anywhere</p>
              </div>
            </div>
          </div>
          
          <Button
            onClick={handleDownload}
            disabled={isDownloading}
            className="w-full"
            size="lg"
          >
            <Download className="w-5 h-5 mr-2" />
            {isDownloading ? 'Opening Install Page...' : 'Download Now'}
          </Button>
          
          <button
            onClick={onClose}
            className="w-full mt-3 text-muted-foreground text-sm py-2"
          >
            Continue in browser
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default AndroidAppBanner;
