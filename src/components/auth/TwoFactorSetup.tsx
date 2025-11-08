import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Loader2, Shield, Copy, Check } from 'lucide-react';
import QRCode from 'qrcode';

interface TwoFactorSetupProps {
  onComplete?: () => void;
}

export const TwoFactorSetup = ({ onComplete }: TwoFactorSetupProps) => {
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [factorId, setFactorId] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    enrollMFA();
  }, []);

  const enrollMFA = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
      });

      if (error) throw error;

      // Generate QR code
      const qrCodeUrl = await QRCode.toDataURL(data.totp.qr_code);
      setQrCode(qrCodeUrl);
      setSecret(data.totp.secret);
      setFactorId(data.id);
    } catch (error) {
      toast.error('Failed to initialize 2FA', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  };

  const verifyAndEnable = async () => {
    if (!verifyCode || verifyCode.length !== 6) {
      toast.error('Invalid code', {
        description: 'Please enter a 6-digit code',
      });
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.auth.mfa.challenge({
        factorId,
      });

      if (error) throw error;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: data.id,
        code: verifyCode,
      });

      if (verifyError) throw verifyError;

      // Update MFA settings in database
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('user_mfa_settings')
          .upsert({
            user_id: user.id,
            mfa_enabled: true,
          });
      }

      toast.success('2FA enabled successfully', {
        description: 'Your account is now more secure',
      });

      onComplete?.();
    } catch (error) {
      toast.error('Verification failed', {
        description: error instanceof Error ? error.message : 'Invalid code',
      });
    } finally {
      setLoading(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Secret copied to clipboard');
  };

  if (loading && !qrCode) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-full bg-primary/10">
          <Shield className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h3 className="font-bold text-lg">Enable Two-Factor Authentication</h3>
          <p className="text-sm text-muted-foreground">
            Secure your account with TOTP
          </p>
        </div>
      </div>

      {qrCode && (
        <>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">
                Step 1: Scan QR code with your authenticator app
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                Use Google Authenticator, Authy, or any TOTP-compatible app
              </p>
              <div className="flex justify-center p-4 bg-white rounded-lg">
                <img src={qrCode} alt="QR Code" className="w-48 h-48" />
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">
                Or enter this secret manually:
              </p>
              <div className="flex gap-2">
                <Input
                  value={secret}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copySecret}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="verify-code">
              Step 2: Enter the 6-digit code from your app
            </Label>
            <Input
              id="verify-code"
              type="text"
              maxLength={6}
              placeholder="000000"
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
              className="text-center text-2xl tracking-widest font-mono"
            />
          </div>

          <Button
            onClick={verifyAndEnable}
            disabled={loading || verifyCode.length !== 6}
            className="w-full bg-gradient-primary"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify and Enable 2FA'
            )}
          </Button>
        </>
      )}
    </Card>
  );
};
