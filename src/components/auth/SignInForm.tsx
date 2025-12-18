import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mail, Phone, User, Loader2, Eye, EyeOff, Shield } from 'lucide-react';
import { z } from 'zod';
import { getOrCreateFingerprint, getDeviceName } from '@/lib/device-fingerprint';

const emailSchema = z.object({
  email: z.string().trim().email('Invalid email address').max(255, 'Email too long'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128, 'Password too long'),
});

const phoneSchema = z.object({
  phone: z.string().trim().min(10, 'Invalid phone number').max(20, 'Phone number too long'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128, 'Password too long'),
});

const usernameSchema = z.object({
  username: z.string().trim().min(3, 'Username must be at least 3 characters').max(30, 'Username too long'),
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
  
  // Reset if lockout has passed
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
}

export const SignInForm = ({ onForgotPassword }: SignInFormProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutTime, setLockoutTime] = useState(0);
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    username: '',
    password: '',
  });

  const handleSignIn = async (method: 'email' | 'phone' | 'username') => {
    const identifier = method === 'email' ? formData.email : method === 'phone' ? formData.phone : formData.username;
    
    // Check rate limiting
    const { allowed, waitTime } = checkRateLimit(identifier);
    if (!allowed) {
      setIsLocked(true);
      setLockoutTime(Math.ceil(waitTime / 60000));
      toast({
        title: "Too many attempts",
        description: `Please wait ${Math.ceil(waitTime / 60000)} minutes before trying again`,
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);
    try {
      // Generate device fingerprint for session tracking
      const fingerprint = await getOrCreateFingerprint();
      
      if (method === 'email') {
        const validated = emailSchema.parse({ email: formData.email, password: formData.password });
        const { error } = await supabase.auth.signInWithPassword({
          email: validated.email,
          password: validated.password,
        });
        if (error) {
          recordLoginAttempt(identifier, false);
          // Don't reveal if email exists or not
          throw new Error('Invalid email or password');
        }
        recordLoginAttempt(identifier, true);
      } else if (method === 'phone') {
        const validated = phoneSchema.parse({ phone: formData.phone, password: formData.password });
        const { error } = await supabase.auth.signInWithPassword({
          phone: validated.phone,
          password: validated.password,
        });
        if (error) {
          recordLoginAttempt(identifier, false);
          throw new Error('Invalid phone number or password');
        }
        recordLoginAttempt(identifier, true);
      } else if (method === 'username') {
        usernameSchema.parse({ username: formData.username, password: formData.password });
        
        // Username login is not directly supported by Supabase
        toast({
          title: "Use Email or Phone",
          description: "Please sign in with your email or phone number associated with your account",
          variant: "default",
        });
        setLoading(false);
        return;
      }

      // Clear password from memory
      setFormData(prev => ({ ...prev, password: '' }));
      
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

  const handleKeyDown = (e: React.KeyboardEvent, method: 'email' | 'phone' | 'username') => {
    if (e.key === 'Enter' && !loading) {
      e.preventDefault();
      handleSignIn(method);
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="email" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="email">
            <Mail className="w-4 h-4 mr-2" />
            Email
          </TabsTrigger>
          <TabsTrigger value="phone">
            <Phone className="w-4 h-4 mr-2" />
            Phone
          </TabsTrigger>
          <TabsTrigger value="username">
            <User className="w-4 h-4 mr-2" />
            Username
          </TabsTrigger>
        </TabsList>

        <TabsContent value="email" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
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
            <Label htmlFor="email-password">Password</Label>
            <div className="relative">
              <Input
                id="email-password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                onKeyDown={(e) => handleKeyDown(e, 'email')}
                disabled={loading}
                autoComplete="current-password"
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
          </div>
          <Button
            onClick={() => handleSignIn('email')}
            disabled={loading}
            className="w-full bg-gradient-primary hover:shadow-glow"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sign In with Email
          </Button>
        </TabsContent>

        <TabsContent value="phone" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
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
            <Label htmlFor="phone-password">Password</Label>
            <div className="relative">
              <Input
                id="phone-password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                onKeyDown={(e) => handleKeyDown(e, 'phone')}
                disabled={loading}
                autoComplete="current-password"
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
          </div>
          <Button
            onClick={() => handleSignIn('phone')}
            disabled={loading}
            className="w-full bg-gradient-primary hover:shadow-glow"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sign In with Phone
          </Button>
        </TabsContent>

        <TabsContent value="username" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              placeholder="yourusername"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase() })}
              onKeyDown={(e) => handleKeyDown(e, 'username')}
              disabled={loading}
              autoComplete="username"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="username-password">Password</Label>
            <div className="relative">
              <Input
                id="username-password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                onKeyDown={(e) => handleKeyDown(e, 'username')}
                disabled={loading}
                autoComplete="current-password"
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
          </div>
          <Button
            onClick={() => handleSignIn('username')}
            disabled={loading}
            className="w-full bg-gradient-primary hover:shadow-glow"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sign In with Username
          </Button>
        </TabsContent>
      </Tabs>

      <Button
        variant="link"
        onClick={onForgotPassword}
        className="w-full"
      >
        Forgot your password?
      </Button>
    </div>
  );
};
