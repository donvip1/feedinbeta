import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mail, Phone, Loader2 } from 'lucide-react';
import { z } from 'zod';
import { SocialLogin } from './SocialLogin';

const emailSignupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  displayName: z.string().min(2, 'Display name must be at least 2 characters'),
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .regex(/^[a-z0-9]+$/, 'Username must be lowercase letters and numbers only')
    .transform(val => val.toLowerCase()),
});

const phoneSignupSchema = z.object({
  phone: z.string().min(10, 'Invalid phone number'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  displayName: z.string().min(2, 'Display name must be at least 2 characters'),
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .regex(/^[a-z0-9]+$/, 'Username must be lowercase letters and numbers only')
    .transform(val => val.toLowerCase()),
});

export const SignUpForm = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    displayName: '',
    username: '',
    password: '',
    confirmPassword: '',
  });

  const handleSignUp = async (method: 'email' | 'phone') => {
    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }

    setLoading(true);
    try {
      const redirectUrl = `${window.location.origin}/`;

      if (method === 'email') {
        emailSignupSchema.parse({
          email: formData.email,
          password: formData.password,
          displayName: formData.displayName,
          username: formData.username,
        });

        const { error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              display_name: formData.displayName,
              username: formData.username,
            },
          },
        });
        if (error) throw error;
      } else {
        phoneSignupSchema.parse({
          phone: formData.phone,
          password: formData.password,
          displayName: formData.displayName,
          username: formData.username,
        });

        const { error } = await supabase.auth.signUp({
          phone: formData.phone,
          password: formData.password,
          options: {
            data: {
              display_name: formData.displayName,
              username: formData.username,
              phone_number: formData.phone,
            },
          },
        });
        if (error) throw error;
      }

      toast.success('Account created!', {
        description: 'Welcome to FEEDIN'
      });
      navigate('/');
    } catch (error) {
      toast.error('Sign up failed', {
        description: error instanceof Error ? error.message : 'Unable to create account'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <SocialLogin />
      
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
              disabled={loading}
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
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signup-username">Username (lowercase and numbers only)</Label>
            <Input
              id="signup-username"
              type="text"
              placeholder="johndoe123"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase() })}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signup-password">Password</Label>
            <Input
              id="signup-password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm Password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              disabled={loading}
            />
          </div>
          <Button
            onClick={() => handleSignUp('email')}
            disabled={loading}
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
              disabled={loading}
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
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone-username">Username (lowercase and numbers only)</Label>
            <Input
              id="phone-username"
              type="text"
              placeholder="johndoe123"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase() })}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone-password">Password</Label>
            <Input
              id="phone-password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone-confirm-password">Confirm Password</Label>
            <Input
              id="phone-confirm-password"
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              disabled={loading}
            />
          </div>
          <Button
            onClick={() => handleSignUp('phone')}
            disabled={loading}
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
