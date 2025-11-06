import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export default function ReferralCard() {
  const { user } = useAuth();
  const [code, setCode] = useState<string>("");
  const [claimCode, setClaimCode] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const { data } = await supabase.from('referral_codes').select('code').eq('user_id', user.id).maybeSingle();
      if (data?.code) setCode(data.code);
    };
    load();
  }, [user]);

  const generate = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const newCode = code || Math.random().toString(36).slice(2, 8).toUpperCase();
      const { error } = await supabase.from('referral_codes').upsert({ user_id: user.id, code: newCode });
      if (error) throw error;
      setCode(newCode);
      toast.success('Referral code ready', { description: newCode });
    } catch (e: any) {
      toast.error('Failed to set referral code', { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const claim = async () => {
    if (!user || !claimCode.trim()) return;
    setLoading(true);
    try {
      // Look up code owner
      const { data: owner } = await supabase.from('referral_codes').select('user_id').eq('code', claimCode.trim()).maybeSingle();
      if (!owner?.user_id) throw new Error('Invalid code');
      if (owner.user_id === user.id) throw new Error('You cannot claim your own code');
      const { error } = await supabase.from('referrals').insert({ referrer_id: owner.user_id, referred_user_id: user.id, code: claimCode.trim() });
      if (error) throw error;
      toast.success('Referral claimed', { description: 'Bonus will apply on first purchase' });
      setClaimCode('');
    } catch (e: any) {
      toast.error('Failed to claim', { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite & Earn</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input readOnly value={code || ''} placeholder="Your referral code" />
          <Button onClick={generate} disabled={loading}>{code ? 'Copy' : 'Generate'}</Button>
        </div>
        <div className="flex gap-2">
          <Input value={claimCode} onChange={(e) => setClaimCode(e.target.value)} placeholder="Enter referral code" />
          <Button onClick={claim} disabled={loading}>Claim</Button>
        </div>
      </CardContent>
    </Card>
  );
}
