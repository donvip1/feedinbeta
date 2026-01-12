import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LogIn, UserPlus, Lock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import feedinLogo from '@/assets/feedin-logo.png';

interface AuthRequiredOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  action?: string;
  message?: string;
}

export const AuthRequiredOverlay = ({ 
  isOpen, 
  onClose, 
  action = 'interact',
  message
}: AuthRequiredOverlayProps) => {
  const navigate = useNavigate();

  const handleSignUp = () => {
    onClose();
    navigate('/auth');
  };

  const handleSignIn = () => {
    onClose();
    navigate('/auth');
  };

  const actionMessages: Record<string, string> = {
    like: 'like this post',
    comment: 'comment on this post',
    follow: 'follow this user',
    message: 'send messages',
    save: 'save this post',
    share: 'share this post',
    gift: 'send gifts',
    view_profile: 'view profiles',
    interact: 'interact with content',
  };

  const actionText = actionMessages[action] || actionMessages.interact;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md border-border bg-card">
        <DialogHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <img src={feedinLogo} alt="FEEDIN" className="h-16 w-16" />
              <div className="absolute -bottom-1 -right-1 bg-primary rounded-full p-1">
                <Lock className="h-4 w-4 text-primary-foreground" />
              </div>
            </div>
          </div>
          <DialogTitle className="text-xl font-bold">
            Sign in to {actionText}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {message || `Create an account or sign in to ${actionText} and unlock all features of FEEDIN.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground text-center">
              Join millions of users sharing and connecting on FEEDIN
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Button
              onClick={handleSignUp}
              className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Create Account
            </Button>
            
            <Button
              onClick={handleSignIn}
              variant="outline"
              className="w-full border-border"
            >
              <LogIn className="mr-2 h-4 w-4" />
              Sign In
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Hook to use auth requirement with any action
export const useAuthRequired = () => {
  const navigate = useNavigate();

  const requireAuth = (user: any, action?: string): boolean => {
    if (!user) {
      // Store intended action
      sessionStorage.setItem('authRequiredAction', action || 'interact');
      return false;
    }
    return true;
  };

  return { requireAuth };
};