import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SignInForm } from '@/components/auth/SignInForm';
import { SignUpForm } from '@/components/auth/SignUpForm';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';
import feedinLogo from '@/assets/feedin-logo.png';
import { Card, CardContent } from '@/components/ui/card';
import { LogIn, UserPlus, Gift } from 'lucide-react';
import { AndroidAppBanner } from '@/components/native/AndroidAppBanner';

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [activeTab, setActiveTab] = useState('signin');
  const [prefillEmail, setPrefillEmail] = useState('');
  
  // Get referrer from sessionStorage (set by /ref/:username page)
  const referrerUsername = sessionStorage.getItem('referrer_username');

  // Callback when signup shows "email already exists" error
  const handleEmailAlreadyExists = useCallback((email: string) => {
    setPrefillEmail(email);
    setActiveTab('signin');
  }, []);

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
      <div className="min-h-screen flex items-center justify-center auth-gradient p-4">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center mb-8 animate-fade-in">
            <div className="relative mb-4">
              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
              <img src={feedinLogo} alt="feedin" className="w-32 h-32 relative z-10" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Reset Password</h1>
            <p className="text-muted-foreground mt-2 text-center text-sm">
              Enter your email to receive a reset link
            </p>
          </div>
          <Card className="border-border/50 shadow-xl bg-card/95 backdrop-blur-sm">
            <CardContent className="pt-6">
              <ForgotPasswordForm onBack={() => setShowForgotPassword(false)} />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col auth-gradient">
      <AndroidAppBanner variant="banner" />
      <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Referral Banner */}
        {referrerUsername && (
          <div className="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-xl flex items-center gap-3 animate-fade-in">
            <Gift className="w-5 h-5 text-primary" />
            <div>
              <p className="text-sm font-medium">Referred by @{referrerUsername}</p>
              <p className="text-xs text-muted-foreground">Create an account to get started!</p>
            </div>
          </div>
        )}
        
        {/* Logo & Header */}
        <div className="flex flex-col items-center mb-6 animate-fade-in">
          <div className="relative mb-4">
            <div className="absolute inset-0 bg-primary/30 blur-2xl rounded-full animate-pulse" />
            <img src={feedinLogo} alt="feedin" className="w-32 h-32 relative z-10 drop-shadow-lg" />
          </div>
          <p className="text-muted-foreground mt-2 text-sm">
            AI-Powered Social Media Platform
          </p>
        </div>

        {/* Auth Card */}
        <Card className="border-border/50 shadow-2xl bg-card/95 backdrop-blur-sm overflow-hidden">
          <CardContent className="pt-6 pb-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6 h-12">
                <TabsTrigger 
                  value="signin" 
                  className="text-base font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-200"
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  Sign In
                </TabsTrigger>
                <TabsTrigger 
                  value="signup"
                  className="text-base font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-200"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Sign Up
                </TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="mt-0 animate-fade-in">
                <SignInForm 
                  onForgotPassword={() => setShowForgotPassword(true)} 
                  prefillEmail={prefillEmail}
                />
              </TabsContent>

              <TabsContent value="signup" className="mt-0 animate-fade-in">
                <SignUpForm 
                  onEmailAlreadyExists={handleEmailAlreadyExists} 
                  referrerUsername={referrerUsername}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          © 2024 FEEDIN. All rights reserved.
        </p>
      </div>
      </div>
    </div>
  );
};

export default Auth;
