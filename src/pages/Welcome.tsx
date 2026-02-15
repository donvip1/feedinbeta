import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Zap, Coins, Globe, Link2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import feedinLogo from '@/assets/feedin-logo.png';
import { AndroidAppBanner } from '@/components/native/AndroidAppBanner';
import { useAuth } from '@/hooks/useAuth';

export default function Welcome() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [sharedContent, setSharedContent] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      setIsRedirecting(true);
      navigate('/feed', { replace: true });
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    const redirectPath = sessionStorage.getItem('redirectAfterAuth');
    if (redirectPath) {
      if (redirectPath.includes('/post/')) setSharedContent('post');
      else if (redirectPath.includes('/story/')) setSharedContent('story');
      else if (redirectPath.includes('/live/')) setSharedContent('live stream');
      else if (redirectPath.includes('/profile/')) setSharedContent('profile');
    }
  }, []);

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
      <AndroidAppBanner variant="banner" />
      
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full space-y-8 text-center">
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

          {/* Logo */}
          <div className="space-y-4">
            <div className="flex justify-center">
              <img src={feedinLogo} alt="feedin" className="w-48 h-48 object-contain" />
            </div>
            <p className="text-muted-foreground text-lg font-medium">
              Go live. Get paid. No barriers.
            </p>
          </div>

          {/* Value Props */}
          <div className="grid grid-cols-3 gap-4 py-6">
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <span className="text-xs text-muted-foreground">Go Live</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Coins className="w-6 h-6 text-primary" />
              </div>
              <span className="text-xs text-muted-foreground">Get Paid</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Globe className="w-6 h-6 text-primary" />
              </div>
              <span className="text-xs text-muted-foreground">No Limits</span>
            </div>
          </div>

          {/* CTA */}
          <div className="space-y-3 pt-4">
            <Button 
              onClick={() => navigate('/auth')} 
              className="w-full h-12 text-base"
              size="lg"
            >
              {sharedContent ? 'Sign Up to View' : 'Claim Your 10 Free Credits'}
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
            🎁 10 free credits · 💰 85% on gifts · 🌍 Works everywhere
          </p>
        </div>
      </div>
    </div>
  );
}
