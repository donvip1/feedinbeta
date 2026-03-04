import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Mail, User, Loader2, Eye, EyeOff, Lock } from 'lucide-react';
import { z } from 'zod';

const loginSchema = z.object({
  identifier: z.string().trim().min(3, 'Please enter your email or username'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128, 'Password too long'),
});

// Rate limiting state (in-memory for client-side)
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(identifier: string): { allowed: boolean; waitTime: number } {
  const now = Date.now();
  const attempts = loginAttempts.get(identifier);

  if (!attempts) {
    return { allowed: true, waitTime: 0 };
  }

  if (now - attempts.lastAttempt > LOCKOUT_DURATION) {
    loginAttempts.delete(identifier);
    return { allowed: true, waitTime: 0 };
  }

  if (attempts.count >= MAX_ATTEMPTS) {
    const waitTime = LOCKOUT_DURATION - (now - attempts.lastAttempt);
    return { allowed: false, waitTime };
  }

  return { allowed: true, waitTime: 0 };
}

function recordLoginAttempt(identifier: string, success: boolean): void {
  const now = Date.now();

  if (success) {
    loginAttempts.delete(identifier);
    return;
  }

  const attempts = loginAttempts.get(identifier);
  if (attempts) {
    loginAttempts.set(identifier, { count: attempts.count + 1, lastAttempt: now });
  } else {
    loginAttempts.set(identifier, { count: 1, lastAttempt: now });
  }
}

interface SignInFormProps {
  onForgotPassword: () => void;
  prefillEmail?: string;
}

export const SignInForm = ({ onForgotPassword, prefillEmail }: SignInFormProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [identifier, setIdentifier] = useState(prefillEmail || '');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // Update identifier when prefillEmail changes
  useEffect(() => {
    if (prefillEmail) {
      setIdentifier(prefillEmail);
    }
  }, [prefillEmail]);

  const isEmail = (value: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  };

  const handleSignIn = async () => {
    const { allowed, waitTime } = checkRateLimit(identifier);
    if (!allowed) {
      toast({
        title: "Too many attempts",
        description: `Please wait ${Math.ceil(waitTime / 60000)} minutes before trying again`,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const validated = loginSchema.parse({ identifier, password });
      let email = validated.identifier;

      // If not an email, look up the email by username
      if (!isEmail(validated.identifier)) {
        const { data: userEmail, error: lookupError } = await supabase
          .rpc('get_user_email_by_username', { p_username: validated.identifier });

        if (lookupError || !userEmail) {
          recordLoginAttempt(identifier, false);
          throw new Error('Invalid username or password');
        }
        email = userEmail;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: validated.password,
      });

      if (error) {
        recordLoginAttempt(identifier, false);
        throw new Error('Invalid credentials');
      }

      recordLoginAttempt(identifier, true);
      
      // Store last login method for convenience
      if (rememberMe) {
        localStorage.setItem('lastLoginMethod', isEmail(identifier) ? 'email' : 'username');
        localStorage.setItem('lastLoginIdentifier', identifier);
      }
      
      setPassword('');

      toast({
        title: "Welcome back!",
        description: "Successfully signed in",
      });
      navigate('/');
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Sign in failed",
          description: error.message || 'Invalid credentials',
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });

      if (error) {
        throw error;
      }
    } catch (error: any) {
      toast({
        title: "Google sign in failed",
        description: error.message || 'Could not sign in with Google',
        variant: "destructive",
      });
      setGoogleLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      e.preventDefault();
      handleSignIn();
    }
  };

  return (
    <form method="post" action="#" onSubmit={(e) => { e.preventDefault(); if (!loading) handleSignIn(); }} className="space-y-5">
      {/* Google Sign In Button */}
      <Button
        onClick={handleGoogleSignIn}
        disabled={googleLoading || loading}
        variant="outline"
        className="w-full h-12 text-base font-medium border-2 hover:bg-accent transition-all duration-200"
      >
        {googleLoading ? (
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        ) : (
          <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
        )}
        Continue with Google
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <Separator className="w-full" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-3 text-muted-foreground">
            Or continue with
          </span>
        </div>
      </div>

      {/* Email/Username Sign In */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="identifier" className="text-sm font-medium">Email or Username</Label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {isEmail(identifier) ? (
                <Mail className="h-4 w-4" />
              ) : (
                <User className="h-4 w-4" />
              )}
            </div>
            <Input
              id="identifier"
              type="text"
              placeholder="Enter email or username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value.trim())}
              onKeyDown={handleKeyDown}
              disabled={loading}
              autoComplete="username"
              className="pl-10 h-11"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm font-medium">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              autoComplete="current-password"
              className="pl-10 pr-10 h-11"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Remember Me & Forgot Password Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="remember" 
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked === true)}
            />
            <label
              htmlFor="remember"
              className="text-sm text-muted-foreground cursor-pointer select-none"
            >
              Remember me
            </label>
          </div>
          <Button
            variant="link"
            onClick={onForgotPassword}
            className="px-0 text-sm text-muted-foreground hover:text-primary"
          >
            Forgot password?
          </Button>
        </div>

        <Button
          type="submit"
          disabled={loading || !identifier || !password}
          className="w-full h-12 text-base font-semibold bg-gradient-primary hover:shadow-glow transition-all duration-200"
        >
          {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
          Sign In
        </Button>
      </div>
    </form>
  );
};
