import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BottomNav } from '@/components/navigation/BottomNav';
import { HandCoins, ShoppingCart, Wallet as WalletIcon } from 'lucide-react';
import { BackButton } from '@/components/navigation/BackButton';
import { GiftsTab } from '@/components/wallet/GiftsTab';
import { WalletTabs } from '@/components/wallet/WalletTabs';
import { BalanceCard } from '@/components/wallet/BalanceCard';
import { PackageCard } from '@/components/wallet/PackageCard';
import { TransactionList } from '@/components/wallet/TransactionList';
import { usePageRefresh } from '@/context/RefreshContext';
import { useCachedQuery } from '@/hooks/useCachedQuery';
import { useCurrency } from '@/context/CurrencyContext';

const Wallet = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentCurrency, currencySymbol, exchangeRate } = useCurrency();
  const [activeTab, setActiveTab] = useState('overview');
  const [sendAmount, setSendAmount] = useState('');
  const [recipientUsername, setRecipientUsername] = useState('');
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [loadingPackage, setLoadingPackage] = useState<string | null>(null);
  const [buybackCredits, setBuybackCredits] = useState('');
  const [buybackBusy, setBuybackBusy] = useState(false);

  // Subscribe to silent refresh from navigation
  usePageRefresh('wallet', useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['user-credits'] });
    queryClient.invalidateQueries({ queryKey: ['credit-transactions'] });
  }, [queryClient]));

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Real-time subscription for credit updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('wallet-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_credits',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['user-credits', user.id] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'credit_transactions',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['credit-transactions', user.id] });
          queryClient.invalidateQueries({ queryKey: ['user-credits', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  // Credits with offline-first caching
  const { data: credits, isStale: creditsStale } = useCachedQuery({
    cacheKey: `credits:${user?.id}`,
    queryKey: ['user-credits', user?.id],
    queryFn: async () => {
      const { data: baseData, error: baseError } = await supabase
        .from('user_credits')
        .select('*')
        .eq('user_id', user?.id)
        .single();
      
      if (baseError && baseError.code !== 'PGRST116') throw baseError;
      
      const { data: secureCredits } = await supabase.rpc('get_user_credits', { 
        p_user_id: user?.id 
      });
      
      return {
        balance: secureCredits ?? baseData?.balance ?? 0,
        total_earned: baseData?.total_earned ?? 0,
        total_spent: baseData?.total_spent ?? 0,
      };
    },
    enabled: !!user,
    ttl: 5 * 60 * 1000, // 5 minutes
  });

  // Transactions with caching
  const { data: transactions } = useCachedQuery({
    cacheKey: `transactions:${user?.id}`,
    queryKey: ['credit-transactions', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('credit_transactions')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(50);
        
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    ttl: 5 * 60 * 1000, // 5 minutes
  });

  const { data: buybackRequests } = useCachedQuery({
    cacheKey: `finance-buybacks:${user?.id}`,
    queryKey: ['finance-buybacks', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('finance_credit_buyback_requests' as any)
        .select(
          'id, credits_amount, usd_amount_cents, status, submitted_at, settled_at',
        )
        .eq('user_id', user?.id)
        .order('submitted_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!user,
    ttl: 60 * 1000,
  });

  // Packages with caching
  const { data: packages } = useCachedQuery({
    cacheKey: 'credit_packages',
    queryKey: ['credit-packages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('credit_packages')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    ttl: 60 * 60 * 1000, // 1 hour
  });

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const handleSendCredits = async () => {
    if (!sendAmount || !recipientUsername) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all fields',
        variant: 'destructive',
      });
      return;
    }

    const amount = parseInt(sendAmount);
    if (amount <= 0) {
      toast({
        title: 'Invalid Amount',
        description: 'Please enter a valid amount',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { data, error } = await supabase.rpc('transfer_credits', {
        p_recipient_username: recipientUsername,
        p_amount: amount,
      });

      if (error) {
        if (error.message.includes('Insufficient credits')) {
          toast({
            title: 'Insufficient Credits',
            description: 'You do not have enough credits for this transfer',
            variant: 'destructive',
          });
        } else if (error.message.includes('User not found')) {
          toast({
            title: 'User Not Found',
            description: 'Could not find a user with that username',
            variant: 'destructive',
          });
        } else if (error.message.includes('Cannot transfer credits to yourself')) {
          toast({
            title: 'Invalid Transfer',
            description: 'You cannot send credits to yourself',
            variant: 'destructive',
          });
        } else {
          throw error;
        }
        return;
      }

      toast({
        title: 'Credits Sent',
        description: `Successfully sent ${amount} credits to @${recipientUsername}`,
      });

      // Invalidate all wallet queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['user-credits'] });
      queryClient.invalidateQueries({ queryKey: ['credit-transactions'] });

      setSendAmount('');
      setRecipientUsername('');
      setIsSendModalOpen(false);
    } catch (error: any) {
      toast({
        title: 'Transfer Failed',
        description: error.message || 'Failed to transfer credits',
        variant: 'destructive',
      });
    }
  };

  const handlePurchasePackage = async (packageId: string, _priceId: string) => {
    try {
      setLoadingPackage(packageId);
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (!currentUser) {
        navigate('/auth');
        return;
      }

      const { data, error } = await supabase.functions.invoke('paystack-checkout', {
        body: {
          type: 'credits',
          itemId: packageId,
        },
      });

      if (error) throw error;

      if (data?.authorization_url) {
        window.location.href = data.authorization_url;
      }
    } catch (error: any) {
      toast({
        title: 'Purchase Failed',
        description: error.message || 'Failed to process purchase',
        variant: 'destructive',
      });
    } finally {
      setLoadingPackage(null);
    }
  };

  const handleBuybackRequest = async () => {
    const amount = Number.parseInt(buybackCredits, 10);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      toast({
        title: 'Invalid amount',
        description: 'Enter the number of credits you want Feedin to buy back.',
        variant: 'destructive',
      });
      return;
    }
    if (amount > (credits?.balance ?? 0)) {
      toast({
        title: 'Insufficient credits',
        description: 'The request cannot exceed your available credit balance.',
        variant: 'destructive',
      });
      return;
    }

    setBuybackBusy(true);
    try {
      const { error } = await (supabase as any).rpc(
        'request_finance_buyback',
        {
          p_credits_amount: amount,
          p_idempotency_key: `web-buyback-${crypto.randomUUID()}`,
        },
      );
      if (error) throw error;
      setBuybackCredits('');
      queryClient.invalidateQueries({ queryKey: ['finance-buybacks'] });
      queryClient.invalidateQueries({ queryKey: ['user-credits'] });
      queryClient.invalidateQueries({ queryKey: ['credit-transactions'] });
      toast({
        title: 'Buyback requested',
        description: 'Feedin finance will record the USD settlement after review.',
      });
    } catch (error: any) {
      toast({
        title: 'Request failed',
        description: error.message || 'Could not submit the finance buyback request.',
        variant: 'destructive',
      });
    } finally {
      setBuybackBusy(false);
    }
  };

  const cancelBuyback = async (requestId: string) => {
    setBuybackBusy(true);
    try {
      const { error } = await (supabase as any).rpc(
        'cancel_finance_buyback',
        { p_request_id: requestId },
      );
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['finance-buybacks'] });
      queryClient.invalidateQueries({ queryKey: ['user-credits'] });
      queryClient.invalidateQueries({ queryKey: ['credit-transactions'] });
      toast({ title: 'Buyback request cancelled' });
    } catch (error: any) {
      toast({
        title: 'Cancellation failed',
        description: error.message || 'Could not cancel this request.',
        variant: 'destructive',
      });
    } finally {
      setBuybackBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      {/* Compact Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BackButton fallback="/feed" className="h-9 w-9" />
              <WalletIcon className="w-5 h-5 text-primary" />
              <h1 className="text-lg font-bold">Wallet</h1>
            </div>
            {credits && (
              <div className="flex items-center gap-2 bg-secondary/50 px-3 py-1.5 rounded-full">
                <span className="text-sm font-semibold text-primary">{credits.balance}</span>
                <span className="text-xs text-muted-foreground">credits</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="px-4 py-4 space-y-5">
        {/* Scrollable Tabs */}
        <WalletTabs activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-5">
            {/* Balance Card */}
            <BalanceCard
              balance={credits?.balance || 0}
              totalEarned={credits?.total_earned || 0}
              totalSpent={credits?.total_spent || 0}
              currencySymbol={currencySymbol}
              exchangeRate={exchangeRate}
              currencyCode={currentCurrency}
              onSendClick={() => setIsSendModalOpen(true)}
              onBuyClick={() => setActiveTab('buy')}
            />
          </div>
        )}

        {/* Gifts Tab */}
        {activeTab === 'gifts' && <GiftsTab />}

        {/* Buy Credits Tab */}
        {activeTab === 'buy' && (
          <div className="space-y-5">
            <div className="text-center">
              <h2 className="text-xl font-bold mb-1">Buy Credits</h2>
              <p className="text-sm text-muted-foreground">Choose a credit package</p>
            </div>

            {/* Horizontal scrollable packages on mobile */}
            <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
              <div className="flex gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-3 min-w-max sm:min-w-0">
                {packages?.map((pkg) => (
                  <PackageCard
                    key={pkg.id}
                    id={pkg.id}
                    name={pkg.name}
                    credits={pkg.credits}
                    bonusCredits={pkg.bonus_credits || 0}
                    price={pkg.price}
                    isPopular={pkg.name.toLowerCase().includes('popular')}
                    isLoading={loadingPackage === pkg.id}
                    currencySymbol={currencySymbol}
                    exchangeRate={exchangeRate}
                    currencyCode={currentCurrency}
                    onPurchase={() => handlePurchasePackage(pkg.id, pkg.stripe_price_id)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Marketplace Tab */}
        {activeTab === 'marketplace' && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5" />
                  P2P Marketplace
                </CardTitle>
                <CardDescription>
                  Buy and sell credits directly with other users
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => navigate('/wallet/p2p')}
                  className="w-full"
                  size="lg"
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Visit Marketplace
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HandCoins className="w-5 h-5" />
                  Feedin finance buyback
                </CardTitle>
                <CardDescription>
                  Hold credits for review and receive the approved value in USD
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="finance-buyback-credits">Credits to sell</Label>
                  <div className="flex gap-2">
                    <Input
                      id="finance-buyback-credits"
                      inputMode="numeric"
                      value={buybackCredits}
                      onChange={(event) => setBuybackCredits(event.target.value)}
                      placeholder="1000"
                    />
                    <Button onClick={handleBuybackRequest} disabled={buybackBusy}>
                      Request
                    </Button>
                  </div>
                </div>

                {(buybackRequests?.length ?? 0) > 0 && (
                  <div className="divide-y divide-border">
                    {buybackRequests?.map((request) => (
                      <div
                        key={request.id}
                        className="flex items-center justify-between gap-3 py-3"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {Number(request.credits_amount).toLocaleString()} credits
                          </p>
                          <p className="text-xs capitalize text-muted-foreground">
                            {String(request.status).replaceAll('_', ' ')}
                            {request.usd_amount_cents
                              ? ` · $${(Number(request.usd_amount_cents) / 100).toFixed(2)}`
                              : ''}
                          </p>
                        </div>
                        {request.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={buybackBusy}
                            onClick={() => cancelBuyback(request.id)}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Transaction History</CardTitle>
              <CardDescription>Your recent credit activity</CardDescription>
            </CardHeader>
            <CardContent>
              <TransactionList transactions={transactions || []} />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Send Credits Modal */}
      <Dialog open={isSendModalOpen} onOpenChange={setIsSendModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send Credits</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Username</Label>
              <Input
                placeholder="@username"
                value={recipientUsername}
                onChange={(e) => setRecipientUsername(e.target.value.replace('@', ''))}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                placeholder="100"
                value={sendAmount}
                onChange={(e) => setSendAmount(e.target.value)}
                className="mt-1.5"
              />
              {credits && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  Available: {credits.balance} credits
                </p>
              )}
            </div>
            <Button onClick={handleSendCredits} className="w-full">
              Send Credits
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <BottomNav transparent={false} />
    </div>
  );
};

export default Wallet;
