import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SignInForm } from '@/components/auth/SignInForm';
import { SignUpForm } from '@/components/auth/SignUpForm';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';
import feedinLogo from '@/assets/feedin-logo.png';
import { Card, CardContent } from '@/components/ui/card';

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  useEffect(() => {
    if (user) {
      const redirectTo = searchParams.get('redirect') || sessionStorage.getItem('redirectAfterAuth');
      
      if (redirectTo) {
        sessionStorage.removeItem('redirectAfterAuth');
        navigate(redirectTo);
      } else {
        navigate('/');
      }
    }
  }, [user, navigate, searchParams]);

  if (showForgotPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center mb-8 animate-fade-in">
            <img src={feedinLogo} alt="FEEDIN" className="w-16 h-16 mb-4" />
            <h1 className="text-2xl font-bold text-foreground">
              Reset Password
            </h1>
            <p className="text-muted-foreground mt-2 text-center text-sm">
              Enter your email to receive a reset link
            </p>
          </div>
          <Card className="border-border/50 shadow-lg">
            <CardContent className="pt-6">
              <ForgotPasswordForm onBack={() => setShowForgotPassword(false)} />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6 animate-fade-in">
          <img src={feedinLogo} alt="FEEDIN" className="w-16 h-16 mb-3" />
          <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Welcome to FEEDIN
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            AI-Powered Social Media
          </p>
        </div>

        <Card className="border-border/50 shadow-lg">
          <CardContent className="pt-6">
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
              
              <TabsContent value="signin" className="mt-0">
                <SignInForm onForgotPassword={() => setShowForgotPassword(true)} />
              </TabsContent>
              
              <TabsContent value="signup" className="mt-0">
                <SignUpForm />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;