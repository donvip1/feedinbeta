import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Loader2, Eye, EyeOff, Check, X, AtSign, User, Mail, Lock, Gift } from 'lucide-react';
import { z } from 'zod';
import { getOrCreateFingerprint } from '@/lib/device-fingerprint';

// Strong password requirements
const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password too long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

const signupSchema = z.object({
  email: z.string().trim().email('Invalid email address').max(255, 'Email too long'),
  password: passwordSchema,
  displayName: z.string().trim().min(2, 'Display name must be at least 2 characters').max(50, 'Display name too long'),
  username: z.string().trim()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username too long')
    .regex(/^[a-z0-9_]+$/, 'Username can only contain lowercase letters, numbers, and underscores')
    .transform(val => val.toLowerCase()),
});

interface SignUpFormProps {
  onEmailAlreadyExists?: (email: string) => void;
  referrerUsername?: string | null;
}

export const SignUpForm = ({ onEmailAlreadyExists, referrerUsername }: SignUpFormProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [fraudCheckLoading, setFraudCheckLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    displayName: '',
    username: '',
    password: '',
    confirmPassword: '',
  });

  // Real-time validation states
  const [touched, setTouched] = useState({
    email: false,
    displayName: false,
    username: false,
    password: false,
    confirmPassword: false,
  });

  // Validation checks
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);
  const displayNameValid = formData.displayName.length >= 2 && formData.displayName.length <= 50;
  const usernameValid = /^[a-z0-9_]{3,30}$/.test(formData.username.toLowerCase());
  const passwordsMatch = formData.password === formData.confirmPassword && formData.confirmPassword.length > 0;

  // Password strength indicators
  const passwordChecks = {
    length: formData.password.length >= 8,
    uppercase: /[A-Z]/.test(formData.password),
    lowercase: /[a-z]/.test(formData.password),
    number: /[0-9]/.test(formData.password),
    special: /[^A-Za-z0-9]/.test(formData.password),
  };

  const passwordStrength = Object.values(passwordChecks).filter(Boolean).length;
  const passwordValid = passwordStrength === 5;

  // Debounced username availability check
  const checkUsernameAvailability = useCallback(async (username: string) => {
    if (username.length < 3 || !/^[a-z0-9_]+$/.test(username)) {
      setUsernameAvailable(null);
      return;
    }

    setCheckingUsername(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username.toLowerCase())
        .maybeSingle();

      if (error) {
        console.warn('Username check error:', error.message);
        setUsernameAvailable(null);
      } else {
        setUsernameAvailable(!data);
      }
    } catch (err) {
      console.warn('Username check failed:', err);
      setUsernameAvailable(null);
    } finally {
      setCheckingUsername(false);
    }
  }, []);

  // Debounce username check
  useEffect(() => {
    if (!formData.username || formData.username.length < 3) {
      setUsernameAvailable(null);
      return;
    }

    const timer = setTimeout(() => {
      checkUsernameAvailability(formData.username);
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.username, checkUsernameAvailability]);

  const handleGoogleSignUp = async () => {
    setGoogleLoading(true);
    try {
      const redirectUrl = `${window.location.origin}/`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) throw error;
    } catch (error: any) {
      toast({
        title: "Google sign up failed",
        description: error.message || 'Could not sign up with Google',
        variant: "destructive",
      });
      setGoogleLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are identical",
        variant: "destructive",
      });
      return;
    }

    if (usernameAvailable === false) {
      toast({
        title: "Username taken",
        description: "Please choose a different username",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setFraudCheckLoading(true);
    
    try {
      const redirectUrl = `${window.location.origin}/`;

      const validated = signupSchema.parse({
        email: formData.email,
        password: formData.password,
        displayName: formData.displayName,
        username: formData.username,
      });

      // Get device fingerprint for fraud detection
      const fingerprint = await getOrCreateFingerprint();
      
      // Check for fraud/duplicate accounts
      const { data: fraudCheck, error: fraudError } = await supabase.functions.invoke('fraud-detection', {
        body: {
          action: 'check_signup',
          email: validated.email,
          fingerprint,
        },
      });

      setFraudCheckLoading(false);

      if (fraudError) {
        console.warn('Fraud check failed:', fraudError);
        // Continue with signup even if fraud check fails
      } else if (fraudCheck && !fraudCheck.allowed) {
        toast({
          title: "Account creation blocked",
          description: fraudCheck.reasons?.join('. ') || 'Unable to create account at this time.',
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Get referrer ID if there's a referrer username
      let referrerId: string | null = null;
      const storedReferrer = sessionStorage.getItem('referrer_username') || referrerUsername;
      
      if (storedReferrer) {
        const { data: referrerData } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', storedReferrer.toLowerCase())
          .maybeSingle();
        
        if (referrerData) {
          referrerId = referrerData.id;
        }
      }

      const { data, error } = await supabase.auth.signUp({
        email: validated.email,
        password: validated.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            display_name: validated.displayName,
            username: validated.username,
            referred_by: referrerId,
            signup_fingerprint: fingerprint,
          },
        },
      });

      if (error) {
        if (error.message.includes('already registered')) {
          if (onEmailAlreadyExists) {
            onEmailAlreadyExists(formData.email);
          }
          throw new Error('An account with this email already exists. Please sign in instead.');
        }
        throw error;
      }

      // If signup successful, increment referrer's count
      if (data.user && referrerId) {
        try {
          await supabase.rpc('increment_referral_count' as any, { referrer_id: referrerId });
        } catch (e) {
          console.warn('Failed to increment referral count:', e);
        }
        sessionStorage.removeItem('referrer_username');
      }

      if (data.user && !data.session) {
        toast({
          title: "Check your email",
          description: "We've sent you a confirmation link to complete signup",
        });
        return;
      }

      toast({
        title: "Account created!",
        description: referrerId ? "Welcome to feedin! Thanks for using a referral." : "Welcome to feedin",
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
          title: "Sign up failed",
          description: error.message || 'Unable to create account',
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
      setFraudCheckLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading && canSubmit) {
      e.preventDefault();
      handleSignUp();
    }
  };

  const canSubmit = emailValid && displayNameValid && usernameValid && passwordValid && passwordsMatch && usernameAvailable !== false;

  const ValidationIcon = ({ valid, show }: { valid: boolean; show: boolean }) => {
    if (!show) return null;
    return valid ? (
      <Check className="w-4 h-4 text-green-500" />
    ) : (
      <X className="w-4 h-4 text-destructive" />
    );
  };

  return (
    <div className="space-y-5">
      {/* Google Sign Up Button */}
      <Button
        onClick={handleGoogleSignUp}
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
            Or create account with email
          </span>
        </div>
      </div>

      {/* Email Input */}
      <div className="space-y-2">
        <Label htmlFor="signup-email" className="text-sm font-medium">Email</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="signup-email"
            type="email"
            placeholder="you@example.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            onBlur={() => setTouched({ ...touched, email: true })}
            onKeyDown={handleKeyDown}
            disabled={loading}
            autoComplete="email"
            className="pl-10 pr-10 h-11"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <ValidationIcon valid={emailValid} show={touched.email && formData.email.length > 0} />
          </div>
        </div>
      </div>

      {/* Display Name & Username Row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="display-name" className="text-sm font-medium">Display Name</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="display-name"
              type="text"
              placeholder="John Doe"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              onBlur={() => setTouched({ ...touched, displayName: true })}
              onKeyDown={handleKeyDown}
              disabled={loading}
              autoComplete="name"
              className="pl-10 pr-8 h-11"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <ValidationIcon valid={displayNameValid} show={touched.displayName && formData.displayName.length > 0} />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="signup-username" className="text-sm font-medium">Username</Label>
          <div className="relative">
            <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="signup-username"
              type="text"
              placeholder="johndoe"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
              onBlur={() => setTouched({ ...touched, username: true })}
              onKeyDown={handleKeyDown}
              disabled={loading}
              autoComplete="username"
              className="pl-10 pr-8 h-11"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              {checkingUsername ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : usernameAvailable === true ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : usernameAvailable === false ? (
                <X className="w-4 h-4 text-destructive" />
              ) : touched.username && usernameValid ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : touched.username && formData.username.length > 0 ? (
                <X className="w-4 h-4 text-destructive" />
              ) : null}
            </div>
          </div>
          {usernameAvailable === false && (
            <p className="text-xs text-destructive">Username is taken</p>
          )}
        </div>
      </div>

      {/* Password Input */}
      <div className="space-y-2">
        <Label htmlFor="signup-password" className="text-sm font-medium">Password</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="signup-password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Create a strong password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            onBlur={() => setTouched({ ...touched, password: true })}
            onKeyDown={handleKeyDown}
            disabled={loading}
            autoComplete="new-password"
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

        {/* Password Strength Bar */}
        {formData.password && (
          <div className="space-y-2 animate-fade-in">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((level) => (
                <div
                  key={level}
                  className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                    passwordStrength >= level
                      ? passwordStrength <= 2
                        ? 'bg-destructive'
                        : passwordStrength <= 3
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                      : 'bg-muted'
                  }`}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
              {Object.entries(passwordChecks).map(([key, valid]) => (
                <span 
                  key={key} 
                  className={`flex items-center gap-1 transition-colors ${valid ? 'text-green-500' : 'text-muted-foreground'}`}
                >
                  {valid ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                  {key === 'length' ? '8+ chars' : key === 'uppercase' ? 'A-Z' : key === 'lowercase' ? 'a-z' : key === 'number' ? '0-9' : 'Symbol'}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Confirm Password Input */}
      <div className="space-y-2">
        <Label htmlFor="confirm-password" className="text-sm font-medium">Confirm Password</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="confirm-password"
            type={showConfirmPassword ? 'text' : 'password'}
            placeholder="Confirm your password"
            value={formData.confirmPassword}
            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
            onBlur={() => setTouched({ ...touched, confirmPassword: true })}
            onKeyDown={handleKeyDown}
            disabled={loading}
            autoComplete="new-password"
            className="pl-10 pr-10 h-11"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            tabIndex={-1}
          >
            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {touched.confirmPassword && formData.confirmPassword && !passwordsMatch && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <X className="w-3 h-3" /> Passwords don't match
          </p>
        )}
        {passwordsMatch && formData.confirmPassword && (
          <p className="text-xs text-green-500 flex items-center gap-1">
            <Check className="w-3 h-3" /> Passwords match
          </p>
        )}
      </div>

      {/* Submit Button */}
      <Button
        onClick={handleSignUp}
        disabled={loading || !canSubmit}
        className="w-full h-12 text-base font-semibold bg-gradient-primary hover:shadow-glow transition-all duration-200"
      >
        {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
        Create Account
      </Button>

      {/* Terms */}
      <p className="text-xs text-center text-muted-foreground">
        By signing up, you agree to our{' '}
        <a href="/terms" className="text-primary hover:underline">Terms of Service</a>
        {' '}and{' '}
        <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>
      </p>
    </div>
  );
};
