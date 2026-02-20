import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Eye, EyeOff, Check, X } from 'lucide-react';
import feedinLogo from '@/assets/feedin-logo.png';

const passwordRules = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'Uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'Number', test: (p: string) => /[0-9]/.test(p) },
  { label: 'Special character', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

const ResetPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
      }
    });

    // Also check URL hash for type=recovery (in case event already fired)
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setIsRecovery(true);
    }

    return () => subscription.unsubscribe();
  }, []);

  const allRulesPass = passwordRules.every((r) => r.test(password));
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const handleResetPassword = async () => {
    if (!allRulesPass) {
      toast({ title: 'Weak password', description: 'Please meet all password requirements', variant: 'destructive' });
      return;
    }
    if (!passwordsMatch) {
      toast({ title: 'Mismatch', description: 'Passwords do not match', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      toast({ title: 'Password updated!', description: 'You can now sign in with your new password.' });
      await supabase.auth.signOut();
      navigate('/auth');
    } catch (error: any) {
      toast({ title: 'Reset failed', description: error.message || 'Unable to update password', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (!isRecovery) {
    return (
      <div className="min-h-screen flex items-center justify-center auth-gradient p-4">
        <div className="w-full max-w-md text-center">
          <img src={feedinLogo} alt="feedin" className="w-24 h-24 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-foreground mb-2">Verifying recovery link…</h1>
          <p className="text-muted-foreground text-sm">If nothing happens, the link may have expired.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/auth')}>
            Back to Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center auth-gradient p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8 animate-fade-in">
          <img src={feedinLogo} alt="feedin" className="w-28 h-28 mb-4" />
          <h1 className="text-2xl font-bold text-foreground">Set New Password</h1>
          <p className="text-muted-foreground mt-2 text-center text-sm">Enter your new password below</p>
        </div>

        <Card className="border-border/50 shadow-xl bg-card/95 backdrop-blur-sm">
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  placeholder="Enter new password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Password rules */}
            {password.length > 0 && (
              <div className="space-y-1">
                {passwordRules.map((rule) => {
                  const passes = rule.test(password);
                  return (
                    <div key={rule.label} className="flex items-center gap-2 text-xs">
                      {passes ? <Check className="w-3 h-3 text-primary" /> : <X className="w-3 h-3 text-destructive" />}
                      <span className={passes ? 'text-primary' : 'text-muted-foreground'}>{rule.label}</span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                placeholder="Confirm new password"
              />
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="text-xs text-destructive">Passwords do not match</p>
              )}
            </div>

            <Button
              onClick={handleResetPassword}
              disabled={loading || !allRulesPass || !passwordsMatch}
              className="w-full"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Password
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ResetPassword;
