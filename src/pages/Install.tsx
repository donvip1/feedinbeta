import { useState, useEffect } from 'react';
import { Download, Share, Plus, Smartphone, Check, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const Install = () => {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    // Check if already installed
    const standalone = window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone === true;
    setIsInstalled(standalone);

    // Detect platform
    const userAgent = navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent) && !(window as any).MSStream);
    setIsAndroid(/android/.test(userAgent));

    // Listen for install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Listen for successful install
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    setInstalling(true);
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
    setInstalling(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 p-4 border-b border-border">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </Button>
        <h1 className="text-lg font-semibold">Install FeedIn</h1>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        {/* App Icon */}
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mb-6 shadow-xl">
          <Smartphone className="w-12 h-12 text-primary-foreground" />
        </div>

        <h2 className="text-2xl font-bold text-foreground mb-2">FeedIn App</h2>
        <p className="text-muted-foreground mb-8 max-w-sm">
          Install FeedIn on your device for the best experience with offline support and instant access.
        </p>

        {isInstalled ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
              <Check className="w-8 h-8 text-green-500" />
            </div>
            <p className="text-green-500 font-medium">App is installed!</p>
            <Button onClick={() => navigate('/feed')}>
              Open App
            </Button>
          </div>
        ) : isIOS ? (
          <div className="space-y-6 w-full max-w-sm">
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="font-semibold mb-4">Install on iOS</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary">1</span>
                  </div>
                  <div className="text-left">
                    <p className="font-medium">Tap the Share button</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      Look for <Share size={14} className="inline" /> at the bottom of Safari
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary">2</span>
                  </div>
                  <div className="text-left">
                    <p className="font-medium">Add to Home Screen</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      Scroll down and tap <Plus size={14} className="inline" /> "Add to Home Screen"
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary">3</span>
                  </div>
                  <div className="text-left">
                    <p className="font-medium">Confirm Installation</p>
                    <p className="text-sm text-muted-foreground">
                      Tap "Add" in the top right corner
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : deferredPrompt ? (
          <Button 
            size="lg" 
            onClick={handleInstall}
            disabled={installing}
            className="gap-2"
          >
            <Download size={20} />
            {installing ? 'Installing...' : 'Install App'}
          </Button>
        ) : isAndroid ? (
          <div className="space-y-4 w-full max-w-sm">
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="font-semibold mb-4">Install on Android</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary">1</span>
                  </div>
                  <div className="text-left">
                    <p className="font-medium">Open browser menu</p>
                    <p className="text-sm text-muted-foreground">
                      Tap the three dots (⋮) in Chrome
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary">2</span>
                  </div>
                  <div className="text-left">
                    <p className="font-medium">Add to Home screen</p>
                    <p className="text-sm text-muted-foreground">
                      Select "Add to Home screen" or "Install app"
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground">
            Visit this page on a mobile device to install the app.
          </p>
        )}

        {/* Features */}
        <div className="mt-10 grid grid-cols-3 gap-4 w-full max-w-sm">
          <div className="text-center">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
              <Download size={18} className="text-primary" />
            </div>
            <p className="text-xs text-muted-foreground">Offline Access</p>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
              <Smartphone size={18} className="text-primary" />
            </div>
            <p className="text-xs text-muted-foreground">Native Feel</p>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
              <Check size={18} className="text-primary" />
            </div>
            <p className="text-xs text-muted-foreground">Fast & Reliable</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Install;
