import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Users, Video, MessageCircle, Link2, Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import feedinLogo from '@/assets/feedin-logo.png';
import { AndroidAppBanner } from '@/components/native/AndroidAppBanner';
import { useAuth } from '@/hooks/useAuth';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';

export default function Welcome() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { shouldShowPrompt, isInstalled, promptInstall, isIOS, deferredPrompt } = useInstallPrompt();
  const [sharedContent, setSharedContent] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Redirect authenticated users to feed immediately
  useEffect(() => {
    if (!loading && user) {
      setIsRedirecting(true);
      navigate('/feed', { replace: true });
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    // Check if user was redirected from a shared link
    const redirectPath = sessionStorage.getItem('redirectAfterAuth');
    if (redirectPath) {
      if (redirectPath.includes('/post/')) {
        setSharedContent('post');
      } else if (redirectPath.includes('/story/')) {
        setSharedContent('story');
      } else if (redirectPath.includes('/live/')) {
        setSharedContent('live stream');
      } else if (redirectPath.includes('/profile/')) {
        setSharedContent('profile');
      }
    }
  }, []);

  // Show loading while auth state is being determined or redirecting
  if (loading || isRedirecting || user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse">
          <img src={feedinLogo} alt="feedin" className="w-40 h-40" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-secondary/20">
      {/* Android App Banner */}
      <AndroidAppBanner variant="banner" />
      
      <div className="flex-1 flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full space-y-8 text-center">
        {/* Shared Content Notice */}
        {sharedContent && (
          <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-center gap-2 text-primary mb-2">
              <Link2 className="w-5 h-5" />
              <span className="font-semibold">Shared Content</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Sign in to view this {sharedContent}
            </p>
          </div>
        )}

        {/* Logo/Brand */}
        <div className="space-y-4">
          <div className="flex justify-center">
            <img src={feedinLogo} alt="feedin" className="w-48 h-48 object-contain" />
          </div>
          <p className="text-muted-foreground text-lg">
            Connect, share, and explore with the world
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-3 gap-4 py-6">
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <span className="text-xs text-muted-foreground">Connect</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Video className="w-6 h-6 text-primary" />
            </div>
            <span className="text-xs text-muted-foreground">Share</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-primary" />
            </div>
            <span className="text-xs text-muted-foreground">Chat</span>
          </div>
        </div>

        {/* Install App Banner - shown for non-installed users */}
        {!isInstalled && (
          <div className="bg-primary/10 border border-primary/20 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Download className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm">Install FeedIn App</h3>
                <p className="text-xs text-muted-foreground">
                  {isIOS 
                    ? 'Tap Share → "Add to Home Screen"' 
                    : 'Get the app for a better experience'}
                </p>
              </div>
              {deferredPrompt && (
                <Button size="sm" onClick={promptInstall} className="flex-shrink-0">
                  Install
                </Button>
              )}
            </div>
          </div>
        )}

        {/* CTA Buttons */}
        <div className="space-y-3 pt-4">
          <Button 
            onClick={() => navigate('/auth')} 
            className="w-full h-12 text-base"
            size="lg"
          >
            {sharedContent ? 'Sign Up to View' : 'Sign Up'}
          </Button>
          <Button 
            onClick={() => navigate('/auth')} 
            variant="outline"
            className="w-full h-12 text-base"
            size="lg"
          >
            {sharedContent ? 'Sign In to View' : 'Sign In'}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground pt-4">
          Join our community and start sharing your moments today
        </p>
      </div>
      </div>
    </div>
  );
}
