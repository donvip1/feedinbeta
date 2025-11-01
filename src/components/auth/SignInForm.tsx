import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mail, Phone, User, Loader2 } from 'lucide-react';
import { z } from 'zod';

const emailSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const phoneSchema = z.object({
  phone: z.string().min(10, 'Invalid phone number'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const usernameSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

interface SignInFormProps {
  onForgotPassword: () => void;
}

export const SignInForm = ({ onForgotPassword }: SignInFormProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    username: '',
    password: '',
  });

  const handleSignIn = async (method: 'email' | 'phone' | 'username') => {
    setLoading(true);
    try {
      // Validate input
      if (method === 'email') {
        emailSchema.parse({ email: formData.email, password: formData.password });
        const { error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });
        if (error) throw error;
      } else if (method === 'phone') {
        phoneSchema.parse({ phone: formData.phone, password: formData.password });
        const { error } = await supabase.auth.signInWithPassword({
          phone: formData.phone,
          password: formData.password,
        });
        if (error) throw error;
      } else if (method === 'username') {
        usernameSchema.parse({ username: formData.username, password: formData.password });
        // Query profiles to find user with this username - note: this requires email to be stored
        // For now, we'll show a helpful message
        toast({
          title: "Username sign-in coming soon",
          description: "Please use your email or phone number to sign in",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      toast({
        title: "Welcome back!",
        description: "Successfully signed in",
      });
      navigate('/');
    } catch (error: any) {
      toast({
        title: "Sign in failed",
        description: error.message || 'Invalid credentials',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email-password">Password</Label>
            <Input
              id="email-password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              disabled={loading}
            />
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
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="username-password">Password</Label>
            <Input
              id="username-password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              disabled={loading}
            />
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