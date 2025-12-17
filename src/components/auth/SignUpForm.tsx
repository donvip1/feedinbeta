import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mail, Phone, Loader2, Eye, EyeOff, Check, X } from 'lucide-react';
import { z } from 'zod';

// Strong password requirements
const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password too long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

const emailSignupSchema = z.object({
  email: z.string().trim().email('Invalid email address').max(255, 'Email too long'),
  password: passwordSchema,
  displayName: z.string().trim().min(2, 'Display name must be at least 2 characters').max(50, 'Display name too long'),
  username: z.string().trim()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username too long')
    .regex(/^[a-z0-9_]+$/, 'Username can only contain lowercase letters, numbers, and underscores')
    .transform(val => val.toLowerCase()),
});

const phoneSignupSchema = z.object({
  phone: z.string().trim().min(10, 'Invalid phone number').max(20, 'Phone number too long'),
  password: passwordSchema,
  displayName: z.string().trim().min(2, 'Display name must be at least 2 characters').max(50, 'Display name too long'),
  username: z.string().trim()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username too long')
    .regex(/^[a-z0-9_]+$/, 'Username can only contain lowercase letters, numbers, and underscores')
    .transform(val => val.toLowerCase()),
});

export const SignUpForm = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    displayName: '',
    username: '',
    password: '',
    confirmPassword: '',
  });

  // Password strength indicators
  const passwordChecks = {
    length: formData.password.length >= 8,
    uppercase: /[A-Z]/.test(formData.password),
    lowercase: /[a-z]/.test(formData.password),
    number: /[0-9]/.test(formData.password),
    special: /[^A-Za-z0-9]/.test(formData.password),
  };

  const passwordStrength = Object.values(passwordChecks).filter(Boolean).length;

  const checkUsernameAvailability = async (username: string): Promise<boolean> => {
    if (username.length < 3) return true;
    
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username.toLowerCase())
      .maybeSingle();
    
    return !data && !error;
  };

  const handleSignUp = async (method: 'email' | 'phone') => {
    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are identical",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const redirectUrl = `${window.location.origin}/`;

      // Check username availability first
      const usernameAvailable = await checkUsernameAvailability(formData.username);
      if (!usernameAvailable) {
        throw new Error('Username is already taken. Please choose another.');
      }

      if (method === 'email') {
        const validated = emailSignupSchema.parse({
          email: formData.email,
          password: formData.password,
          displayName: formData.displayName,
          username: formData.username,
        });

        const { data, error } = await supabase.auth.signUp({
          email: validated.email,
          password: validated.password,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              display_name: validated.displayName,
              username: validated.username,
            },
          },
        });

        if (error) {
          if (error.message.includes('already registered')) {
            throw new Error('An account with this email already exists');
          }
          throw error;
        }

        // Check if email confirmation is required
        if (data.user && !data.session) {
          toast({
            title: "Check your email",
            description: "We've sent you a confirmation link to complete signup",
          });
          return;
        }
      } else {
        const validated = phoneSignupSchema.parse({
          phone: formData.phone,
          password: formData.password,
          displayName: formData.displayName,
          username: formData.username,
        });

        const { data, error } = await supabase.auth.signUp({
          phone: validated.phone,
          password: validated.password,
          options: {
            data: {
              display_name: validated.displayName,
              username: validated.username,
              phone_number: validated.phone,
            },
          },
        });

        if (error) {
          if (error.message.includes('already registered')) {
            throw new Error('An account with this phone number already exists');
          }
          throw error;
        }

        if (data.user && !data.session) {
          toast({
            title: "Verify your phone",
            description: "Please check your phone for a verification code",
          });
          return;
        }
      }

      toast({
        title: "Account created!",
        description: "Welcome to FEEDIN",
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
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, method: 'email' | 'phone') => {
    if (e.key === 'Enter' && !loading) {
      e.preventDefault();
      handleSignUp(method);
    }
  };

  const PasswordStrengthIndicator = () => (
    <div className="space-y-2 mt-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((level) => (
          <div
            key={level}
            className={`h-1 flex-1 rounded-full transition-colors ${
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
      <div className="grid grid-cols-2 gap-1 text-xs">
        <div className={`flex items-center gap-1 ${passwordChecks.length ? 'text-green-500' : 'text-muted-foreground'}`}>
          {passwordChecks.length ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
          8+ characters
        </div>
        <div className={`flex items-center gap-1 ${passwordChecks.uppercase ? 'text-green-500' : 'text-muted-foreground'}`}>
          {passwordChecks.uppercase ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
          Uppercase
        </div>
        <div className={`flex items-center gap-1 ${passwordChecks.lowercase ? 'text-green-500' : 'text-muted-foreground'}`}>
          {passwordChecks.lowercase ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
          Lowercase
        </div>
        <div className={`flex items-center gap-1 ${passwordChecks.number ? 'text-green-500' : 'text-muted-foreground'}`}>
          {passwordChecks.number ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
          Number
        </div>
        <div className={`flex items-center gap-1 ${passwordChecks.special ? 'text-green-500' : 'text-muted-foreground'}`}>
          {passwordChecks.special ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
          Special char
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <Tabs defaultValue="email" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="email">
            <Mail className="w-4 h-4 mr-2" />
            Email
          </TabsTrigger>
          <TabsTrigger value="phone">
            <Phone className="w-4 h-4 mr-2" />
            Phone
          </TabsTrigger>
        </TabsList>

        <TabsContent value="email" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="signup-email">Email</Label>
            <Input
              id="signup-email"
              type="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              onKeyDown={(e) => handleKeyDown(e, 'email')}
              disabled={loading}
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="display-name">Display Name</Label>
            <Input
              id="display-name"
              type="text"
              placeholder="John Doe"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              onKeyDown={(e) => handleKeyDown(e, 'email')}
              disabled={loading}
              autoComplete="name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signup-username">Username</Label>
            <Input
              id="signup-username"
              type="text"
              placeholder="johndoe123"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
              onKeyDown={(e) => handleKeyDown(e, 'email')}
              disabled={loading}
              autoComplete="username"
            />
            <p className="text-xs text-muted-foreground">Lowercase letters, numbers, and underscores only</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="signup-password">Password</Label>
            <div className="relative">
              <Input
                id="signup-password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                onKeyDown={(e) => handleKeyDown(e, 'email')}
                disabled={loading}
                autoComplete="new-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {formData.password && <PasswordStrengthIndicator />}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm Password</Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                onKeyDown={(e) => handleKeyDown(e, 'email')}
                disabled={loading}
                autoComplete="new-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {formData.confirmPassword && formData.password !== formData.confirmPassword && (
              <p className="text-xs text-destructive">Passwords don't match</p>
            )}
          </div>
          <Button
            onClick={() => handleSignUp('email')}
            disabled={loading || passwordStrength < 5 || formData.password !== formData.confirmPassword}
            className="w-full bg-gradient-primary hover:shadow-glow"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Account
          </Button>
        </TabsContent>

        <TabsContent value="phone" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="signup-phone">Phone Number</Label>
            <Input
              id="signup-phone"
              type="tel"
              placeholder="+1234567890"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              onKeyDown={(e) => handleKeyDown(e, 'phone')}
              disabled={loading}
              autoComplete="tel"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone-display-name">Display Name</Label>
            <Input
              id="phone-display-name"
              type="text"
              placeholder="John Doe"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              onKeyDown={(e) => handleKeyDown(e, 'phone')}
              disabled={loading}
              autoComplete="name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone-username">Username</Label>
            <Input
              id="phone-username"
              type="text"
              placeholder="johndoe123"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
              onKeyDown={(e) => handleKeyDown(e, 'phone')}
              disabled={loading}
              autoComplete="username"
            />
            <p className="text-xs text-muted-foreground">Lowercase letters, numbers, and underscores only</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone-password">Password</Label>
            <div className="relative">
              <Input
                id="phone-password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                onKeyDown={(e) => handleKeyDown(e, 'phone')}
                disabled={loading}
                autoComplete="new-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {formData.password && <PasswordStrengthIndicator />}
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone-confirm-password">Confirm Password</Label>
            <div className="relative">
              <Input
                id="phone-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                onKeyDown={(e) => handleKeyDown(e, 'phone')}
                disabled={loading}
                autoComplete="new-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {formData.confirmPassword && formData.password !== formData.confirmPassword && (
              <p className="text-xs text-destructive">Passwords don't match</p>
            )}
          </div>
          <Button
            onClick={() => handleSignUp('phone')}
            disabled={loading || passwordStrength < 5 || formData.password !== formData.confirmPassword}
            className="w-full bg-gradient-primary hover:shadow-glow"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Account
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
};
