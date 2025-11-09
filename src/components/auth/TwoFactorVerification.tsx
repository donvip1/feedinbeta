import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Loader2, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface TwoFactorVerificationProps {
  onCancel?: () => void;
}

export const TwoFactorVerification = ({ onCancel }: TwoFactorVerificationProps) => {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (!code || code.length !== 6) {
      toast.error('Invalid code', {
        description: 'Please enter a 6-digit code',
      });
      return;
    }

    try {
      setLoading(true);

      // Get all factors
      const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;

      const totpFactor = factorsData.totp[0];
      if (!totpFactor) {
        throw new Error('No TOTP factor found');
      }

      // Create challenge
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: totpFactor.id,
      });
      if (challengeError) throw challengeError;

      // Verify the code
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challengeData.id,
        code,
      });

      if (verifyError) throw verifyError;

      toast.success('Authentication successful', {
        description: 'Welcome back!',
      });

      navigate('/');
    } catch (error) {
      toast.error('Verification failed', {
        description: error instanceof Error ? error.message : 'Invalid code',
      });
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-full bg-primary/10">
          <Shield className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h3 className="font-bold text-lg">Two-Factor Authentication</h3>
          <p className="text-sm text-muted-foreground">
            Enter the code from your authenticator app
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="2fa-code">Authentication Code</Label>
        <Input
          id="2fa-code"
          type="text"
          maxLength={6}
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          onKeyPress={(e) => e.key === 'Enter' && handleVerify()}
          className="text-center text-2xl tracking-widest font-mono"
          autoFocus
        />
        <p className="text-xs text-muted-foreground">
          Open your authenticator app and enter the 6-digit code
        </p>
      </div>

      <div className="space-y-2">
        <Button
          onClick={handleVerify}
          disabled={loading || code.length !== 6}
          className="w-full bg-gradient-primary"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Verifying...
            </>
          ) : (
            'Verify Code'
          )}
        </Button>

        {onCancel && (
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={loading}
            className="w-full"
          >
            Cancel
          </Button>
        )}
      </div>

      <p className="text-xs text-center text-muted-foreground">
        Having trouble? Contact support for assistance
      </p>
    </Card>
  );
};
