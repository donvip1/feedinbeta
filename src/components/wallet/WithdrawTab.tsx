import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Banknote, Plus, Loader2, Trash2, AlertCircle, RefreshCw } from 'lucide-react';
import { BankAccountForm } from './BankAccountForm';
import { format } from 'date-fns';
import { useCurrency } from '@/context/CurrencyContext';

const CREDITS_PER_USD = 100;
const PLATFORM_FEE_PERCENT = 30;
const MIN_WITHDRAWAL_CREDITS = 1000;

export const WithdrawTab: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { exchangeRate: userExchangeRate, currencySymbol } = useCurrency();
  const [showAddBank, setShowAddBank] = useState(false);
  const [creditAmount, setCreditAmount] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);

  const { data: bankAccounts, refetch: refetchBanks } = useQuery({
    queryKey: ['bank-accounts', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_bank_accounts')
        .select('*')
        .eq('user_id', user?.id)
        .order('is_default', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Auto-select default bank account
  useEffect(() => {
    if (bankAccounts && bankAccounts.length > 0 && !selectedAccountId) {
      const defaultAcc = bankAccounts.find((a: any) => a.is_default) || bankAccounts[0];
      setSelectedAccountId(defaultAcc.id);
    }
  }, [bankAccounts, selectedAccountId]);

  // Realtime subscription for withdrawal status changes
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('withdrawal-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'withdrawal_requests',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const updated = payload.new as any;
          if (updated.status === 'completed') {
            toast.success(`Withdrawal of ${updated.credit_amount} credits completed!`);
          } else if (updated.status === 'failed') {
            toast.error(`Withdrawal failed: ${updated.failure_reason || 'Unknown error'}. Credits refunded.`);
          }
          queryClient.invalidateQueries({ queryKey: ['withdrawals'] });
          queryClient.invalidateQueries({ queryKey: ['user-credits'] });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  const { data: withdrawals } = useQuery({
    queryKey: ['withdrawals', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('withdrawal_requests' as any)
        .select('*, user_bank_accounts(bank_name, account_number)')
        .eq('user_id', user?.id)
        .order('requested_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  const { data: ngnRate } = useQuery({
    queryKey: ['ngn-rate'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exchange_rates' as any)
        .select('rate')
        .eq('currency_code', 'NGN')
        .single();
      if (error) return 1500;
      return (data as any)?.rate || 1500;
    },
  });

  const { data: credits } = useQuery({
    queryKey: ['user-credits', user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_user_credits', { p_user_id: user?.id });
      return data ?? 0;
    },
    enabled: !!user,
  });

  const amount = parseInt(creditAmount) || 0;
  const feeCredits = Math.floor(amount * PLATFORM_FEE_PERCENT / 100);
  const netCredits = amount - feeCredits;
  const netUsd = netCredits / CREDITS_PER_USD;
  const netNgn = netUsd * (ngnRate || 1500);
  const hasEnoughCredits = (credits || 0) >= amount || (credits || 0) > 999999999; // Admin unlimited bypass
  const isValid = amount >= MIN_WITHDRAWAL_CREDITS && !!selectedAccountId && hasEnoughCredits && !withdrawing;

  const handleWithdraw = async () => {
    if (!isValid) return;
    setWithdrawing(true);
    try {
      const { data, error } = await supabase.functions.invoke('paystack-withdrawal', {
        body: {
          action: 'request-withdrawal',
          credit_amount: amount,
          bank_account_id: selectedAccountId,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('Withdrawal initiated! You\'ll receive your funds shortly.');
      setCreditAmount('');
      queryClient.invalidateQueries({ queryKey: ['user-credits'] });
      queryClient.invalidateQueries({ queryKey: ['withdrawals'] });
      queryClient.invalidateQueries({ queryKey: ['credit-transactions'] });
    } catch (err: any) {
      // Show friendly error - edge function already returns user-friendly messages
      const rawMsg = err.message || '';
      let friendlyMsg = 'Something went wrong. Please try again.';
      if (rawMsg.includes('non-2xx')) {
        friendlyMsg = 'We couldn\'t process your withdrawal right now. Please try again in a moment.';
      } else if (rawMsg.includes('Failed to fetch') || rawMsg.includes('network')) {
        friendlyMsg = 'Connection issue. Please check your internet and try again.';
      } else if (rawMsg) {
        friendlyMsg = rawMsg;
      }
      toast.error(friendlyMsg);
    } finally {
      setWithdrawing(false);
    }
  };

  const deleteAccount = async (id: string) => {
    const { error } = await supabase.from('user_bank_accounts').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete account');
    } else {
      refetchBanks();
      if (selectedAccountId === id) setSelectedAccountId(null);
    }
  };

  const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (s) {
      case 'completed': return 'default';
      case 'processing': return 'secondary';
      case 'failed': case 'refunded': return 'destructive';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-5">
      {/* Bank Accounts */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Banknote className="w-4 h-4" /> Bank Accounts
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => setShowAddBank(true)}>
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {showAddBank ? (
            <BankAccountForm
              onSaved={() => { setShowAddBank(false); refetchBanks(); }}
              onCancel={() => setShowAddBank(false)}
            />
          ) : bankAccounts && bankAccounts.length > 0 ? (
            <div className="space-y-2">
              {bankAccounts.map((acc: any) => (
                <button
                  key={acc.id}
                  onClick={() => setSelectedAccountId(acc.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors text-left ${
                    selectedAccountId === acc.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-secondary/30'
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium">{acc.account_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {acc.bank_name} · ****{acc.account_number.slice(-4)}
                    </p>
                  </div>
                  <Trash2
                    className="w-4 h-4 text-muted-foreground hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); deleteAccount(acc.id); }}
                  />
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No bank accounts added yet. Add one to start withdrawing.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Withdrawal Form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Withdraw Credits</CardTitle>
          <CardDescription>Convert credits to cash (NGN)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Credits to withdraw</Label>
            <Input
              type="number"
              placeholder={`Min ${MIN_WITHDRAWAL_CREDITS}`}
              value={creditAmount}
              onChange={(e) => setCreditAmount(e.target.value)}
              className="mt-1.5"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Available: {credits?.toLocaleString() || 0} credits
            </p>
          </div>

          {amount > 0 && (
            <div className="p-3 rounded-lg bg-secondary/30 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Gross</span>
                <span>{amount.toLocaleString()} credits (${(amount / CREDITS_PER_USD).toFixed(2)})</span>
              </div>
              <div className="flex justify-between text-destructive">
                <span>Platform fee (30%)</span>
                <span>−{feeCredits.toLocaleString()} credits (−${(feeCredits / CREDITS_PER_USD).toFixed(2)})</span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between font-medium">
                <span>You receive</span>
                <span>≈ ₦{netNgn.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
            </div>
          )}

          {amount > 0 && amount < MIN_WITHDRAWAL_CREDITS && (
            <div className="flex items-center gap-2 text-xs text-destructive">
              <AlertCircle className="w-3.5 h-3.5" />
              Minimum withdrawal is {MIN_WITHDRAWAL_CREDITS} credits
            </div>
          )}

          <Button
            onClick={handleWithdraw}
            disabled={!isValid || withdrawing}
            className="w-full"
          >
            {withdrawing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Banknote className="w-4 h-4 mr-2" />}
            Withdraw
          </Button>
        </CardContent>
      </Card>

      {/* Withdrawal History */}
      {withdrawals && withdrawals.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Withdrawal History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {withdrawals.map((wd: any) => (
                <div key={wd.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium">{wd.credit_amount.toLocaleString()} credits</p>
                    <p className="text-xs text-muted-foreground">
                      ₦{wd.amount_ngn?.toLocaleString()} · {format(new Date(wd.requested_at), 'MMM d, yyyy')}
                    </p>
                    {wd.failure_reason && (
                      <p className="text-xs text-destructive mt-0.5">{wd.failure_reason}</p>
                    )}
                  </div>
                  <Badge variant={statusVariant(wd.status)}>{wd.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
