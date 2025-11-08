import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Shield, Loader2, AlertCircle } from 'lucide-react';
import { TwoFactorSetup } from '@/components/auth/TwoFactorSetup';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const TwoFactorSettings = () => {
  const [loading, setLoading] = useState(true);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [disabling, setDisabling] = useState(false);

  useEffect(() => {
    checkMfaStatus();
  }, []);

  const checkMfaStatus = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: mfaSettings } = await supabase
        .from('user_mfa_settings')
        .select('mfa_enabled, mfa_required')
        .eq('user_id', user.id)
        .single();

      if (mfaSettings) {
        setMfaEnabled(mfaSettings.mfa_enabled);
        setMfaRequired(mfaSettings.mfa_required);
      }

      // Check actual MFA factors
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      if (factorsData?.totp && factorsData.totp.length > 0) {
        setMfaEnabled(true);
      }
    } catch (error) {
      console.error('Error checking MFA status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDisableMfa = async () => {
    try {
      setDisabling(true);

      // Unenroll all TOTP factors
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      if (factorsData?.totp) {
        for (const factor of factorsData.totp) {
          await supabase.auth.mfa.unenroll({ factorId: factor.id });
        }
      }

      // Update database
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('user_mfa_settings')
          .update({ mfa_enabled: false })
          .eq('user_id', user.id);
      }

      setMfaEnabled(false);
      toast.success('2FA disabled', {
        description: 'Two-factor authentication has been turned off',
      });
    } catch (error) {
      toast.error('Failed to disable 2FA', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setDisabling(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </Card>
    );
  }

  if (showSetup) {
    return (
      <TwoFactorSetup
        onComplete={() => {
          setShowSetup(false);
          checkMfaStatus();
        }}
      />
    );
  }

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-full bg-primary/10">
          <Shield className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h3 className="font-bold text-lg">Two-Factor Authentication</h3>
          <p className="text-sm text-muted-foreground">
            Add an extra layer of security to your account
          </p>
        </div>
      </div>

      {mfaRequired && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Two-factor authentication is required for your account role (Admin/Moderator).
            You must keep 2FA enabled.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="mfa-toggle">Two-Factor Authentication Status</Label>
          <p className="text-sm text-muted-foreground">
            {mfaEnabled ? 'Currently enabled' : 'Currently disabled'}
          </p>
        </div>
        <Switch
          id="mfa-toggle"
          checked={mfaEnabled}
          disabled={mfaRequired || disabling}
          onCheckedChange={(checked) => {
            if (checked) {
              setShowSetup(true);
            }
          }}
        />
      </div>

      {mfaEnabled && !mfaRequired && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={disabling} className="w-full">
              {disabling ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Disabling...
                </>
              ) : (
                'Disable Two-Factor Authentication'
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Disable 2FA?</AlertDialogTitle>
              <AlertDialogDescription>
                This will make your account less secure. Are you sure you want to
                disable two-factor authentication?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDisableMfa}
                className="bg-destructive hover:bg-destructive/90"
              >
                Yes, disable 2FA
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      <div className="text-xs text-muted-foreground space-y-1">
        <p>• Use any TOTP-compatible authenticator app</p>
        <p>• Recommended: Google Authenticator, Authy, 1Password</p>
        <p>• You'll need to enter a code each time you sign in</p>
      </div>
    </Card>
  );
};
