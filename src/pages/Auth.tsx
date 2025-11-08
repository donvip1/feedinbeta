import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SignInForm } from '@/components/auth/SignInForm';
import { SignUpForm } from '@/components/auth/SignUpForm';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';
import feedinLogo from '@/assets/feedin-logo.png';

const Auth = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  if (showForgotPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center mb-8 animate-fade-in">
            <img src={feedinLogo} alt="FEEDIN" className="w-20 h-20 mb-4" />
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Reset Password
            </h1>
            <p className="text-muted-foreground mt-2 text-center">
              Enter your email or phone to receive a reset link
            </p>
          </div>
          <ForgotPasswordForm onBack={() => setShowForgotPassword(false)} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8 animate-fade-in">
          <img src={feedinLogo} alt="FEEDIN" className="w-20 h-20 mb-4" />
          <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Welcome to FEEDIN
          </h1>
          <p className="text-muted-foreground mt-2">
            AI-Powered Social Media Intelligence
          </p>
        </div>

        <Tabs defaultValue="signin" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
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
      </div>
    </div>
  );
};

export default Auth;