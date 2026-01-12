import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfileCompletion } from '@/hooks/useProfileCompletion';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Check, X, User, AtSign, Sparkles } from 'lucide-react';
import feedinLogo from '@/assets/feedin-logo.png';

interface ProfileCompletionModalProps {
  onComplete?: () => void;
}

export const ProfileCompletionModal = ({ onComplete }: ProfileCompletionModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { 
    isComplete, 
    needsUsername, 
    needsDisplayName, 
    currentUsername,
    currentDisplayName,
    isLoading: statusLoading,
    markProfileComplete,
    refreshStatus
  } = useProfileCompletion();

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);

  // Initialize with current values or from user metadata
  useEffect(() => {
    if (user) {
      const metadata = user.user_metadata;
      if (needsDisplayName) {
        setDisplayName(
          metadata?.full_name || 
          metadata?.name || 
          currentDisplayName || 
          ''
        );
      }
      if (needsUsername) {
        // Don't pre-fill auto-generated usernames
        setUsername('');
      }
    }
  }, [user, needsDisplayName, needsUsername, currentDisplayName]);

  // Check username availability with debounce
  useEffect(() => {
    if (!username || username.length < 3) {
      setUsernameAvailable(null);
      return;
    }

    // Validate format first
    const usernameRegex = /^[a-zA-Z][a-zA-Z0-9_]{2,29}$/;
    if (!usernameRegex.test(username)) {
      setUsernameAvailable(null);
      return;
    }

    const checkAvailability = async () => {
      setCheckingUsername(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id')
          .ilike('username', username)
          .neq('id', user?.id || '')
          .limit(1)
          .maybeSingle();

        setUsernameAvailable(!data);
      } catch (error) {
        console.error('Error checking username:', error);
        setUsernameAvailable(null);
      } finally {
        setCheckingUsername(false);
      }
    };

    const timeoutId = setTimeout(checkAvailability, 500);
    return () => clearTimeout(timeoutId);
  }, [username, user?.id]);

  const handleSubmit = async () => {
    if (!user) return;

    // Validation
    if (needsDisplayName && (!displayName || displayName.trim().length < 2)) {
      toast({
        title: 'Invalid display name',
        description: 'Display name must be at least 2 characters',
        variant: 'destructive',
      });
      return;
    }

    if (needsUsername) {
      const usernameRegex = /^[a-zA-Z][a-zA-Z0-9_]{2,29}$/;
      if (!usernameRegex.test(username)) {
        toast({
          title: 'Invalid username',
          description: 'Username must start with a letter and be 3-30 characters',
          variant: 'destructive',
        });
        return;
      }

      if (!usernameAvailable) {
        toast({
          title: 'Username unavailable',
          description: 'Please choose a different username',
          variant: 'destructive',
        });
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const updates: Record<string, any> = {
        updated_at: new Date().toISOString(),
        profile_completed: true,
      };

      if (needsDisplayName) {
        updates.display_name = displayName.trim();
      }

      if (needsUsername) {
        updates.username = username.toLowerCase();
      }

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: 'Profile completed!',
        description: 'Welcome to FEEDIN! You can now explore the app.',
      });

      refreshStatus();
      onComplete?.();
    } catch (error: any) {
      console.error('Error completing profile:', error);
      
      if (error.message?.includes('duplicate') || error.code === '23505') {
        toast({
          title: 'Username taken',
          description: 'This username is already in use. Please choose another.',
          variant: 'destructive',
        });
        setUsernameAvailable(false);
      } else {
        toast({
          title: 'Error completing profile',
          description: error.message || 'Please try again',
          variant: 'destructive',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Don't show if loading or profile is complete
  if (statusLoading || isComplete) {
    return null;
  }

  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const isFormValid = 
    (!needsDisplayName || displayName.trim().length >= 2) &&
    (!needsUsername || (usernameAvailable === true && username.length >= 3));

  return (
    <Dialog open={!isComplete && !statusLoading}>
      <DialogContent 
        className="sm:max-w-md border-border bg-card"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src={feedinLogo} alt="FEEDIN" className="h-16 w-16" />
          </div>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Complete Your Profile
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Let's set up your profile so you can start connecting with others
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Avatar Preview */}
          {avatarUrl && (
            <div className="flex justify-center">
              <Avatar className="h-20 w-20 ring-4 ring-primary/20">
                <AvatarImage src={avatarUrl} alt="Profile" />
                <AvatarFallback className="bg-primary/10">
                  <User className="h-10 w-10 text-primary" />
                </AvatarFallback>
              </Avatar>
            </div>
          )}

          {/* Display Name Input */}
          {needsDisplayName && (
            <div className="space-y-2">
              <Label htmlFor="displayName" className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Display Name
              </Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="How should we call you?"
                className="bg-background border-border"
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground">
                This is how others will see you (can be changed later)
              </p>
            </div>
          )}

          {/* Username Input */}
          {needsUsername && (
            <div className="space-y-2">
              <Label htmlFor="username" className="flex items-center gap-2">
                <AtSign className="h-4 w-4 text-primary" />
                Username
              </Label>
              <div className="relative">
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                  placeholder="Choose a unique username"
                  className="bg-background border-border pr-10"
                  maxLength={30}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {checkingUsername && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {!checkingUsername && usernameAvailable === true && (
                    <Check className="h-4 w-4 text-green-500" />
                  )}
                  {!checkingUsername && usernameAvailable === false && (
                    <X className="h-4 w-4 text-destructive" />
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Must start with a letter, 3-30 characters, only letters, numbers, and underscores
              </p>
              {usernameAvailable === false && (
                <p className="text-xs text-destructive">
                  This username is already taken
                </p>
              )}
            </div>
          )}
        </div>

        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || !isFormValid}
          className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Setting up...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Get Started
            </>
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
};