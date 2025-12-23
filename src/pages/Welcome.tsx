import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Users, Video, MessageCircle, Link2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import feedinLogo from '@/assets/feedin-logo.png';

export default function Welcome() {
  const navigate = useNavigate();
  const [sharedContent, setSharedContent] = useState<string | null>(null);

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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-secondary/20 p-6">
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
        <div className="space-y-2">
          <div className="flex justify-center">
            <img src={feedinLogo} alt="feedin" className="w-24 h-24 object-contain" />
          </div>
          <h1 className="text-4xl font-bold text-foreground">Welcome to feedin</h1>
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
  );
}
