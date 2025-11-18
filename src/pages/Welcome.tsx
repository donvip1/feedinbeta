import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Users, Video, MessageCircle } from 'lucide-react';

export default function Welcome() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-secondary/20 p-6">
      <div className="max-w-md w-full space-y-8 text-center">
        {/* Logo/Brand */}
        <div className="space-y-2">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-10 h-10 text-primary" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-foreground">Welcome to FeedIn</h1>
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
            Sign Up
          </Button>
          <Button 
            onClick={() => navigate('/auth')} 
            variant="outline"
            className="w-full h-12 text-base"
            size="lg"
          >
            Sign In
          </Button>
        </div>

        <p className="text-xs text-muted-foreground pt-4">
          Join our community and start sharing your moments today
        </p>
      </div>
    </div>
  );
}
