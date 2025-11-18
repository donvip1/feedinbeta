import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { BottomNav } from '@/components/navigation/BottomNav';
import { ArrowLeft, Wallet as WalletIcon, Send, ArrowUpRight, ArrowDownLeft, Crown, Check, Zap, Star, ShoppingCart } from 'lucide-react';
import { format } from 'date-fns';

const Wallet = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [sendAmount, setSendAmount] = useState('');
  const [recipientUsername, setRecipientUsername] = useState('');
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [loadingPackage, setLoadingPackage] = useState<string | null>(null);
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/auth');
    } else if (user.email) {
      checkAdminStatus(user.email);
    }
  }, [user, authLoading, navigate]);

  const checkAdminStatus = (email: string) => {
    const adminEmails = ['viplearn4free@gmail.com', 'cryptosvip@gmail.com', 'myconnectmate@gmail.com'];
    setIsAdmin(adminEmails.includes(email.toLowerCase()));
  };

  const { data: credits } = useQuery({
    queryKey: ['user-credits', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_credits')
        .select('*')
        .eq('user_id', user?.id)
        .single();
        
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: transactions } = useQuery({
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
  });

  const { data: subscription } = useQuery({
    queryKey: ['user-subscription', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('*, subscription_tiers(*)')
        .eq('user_id', user?.id)
        .eq('status', 'active')
        .single();
        
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: packages } = useQuery({
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
  });

  const { data: tiers } = useQuery({
    queryKey: ['subscription-tiers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_tiers')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
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
    if (amount <= 0 || !credits || amount > credits.balance) {
      toast({
        title: 'Invalid Amount',
        description: 'Please enter a valid amount',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Find recipient
      const { data: recipient, error: recipientError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', recipientUsername)
        .single();

      if (recipientError || !recipient) {
        toast({
          title: 'User Not Found',
          description: 'Could not find a user with that username',
          variant: 'destructive',
        });
        return;
      }

      // Deduct from sender
      const { error: deductError } = await supabase
        .from('credit_transactions')
        .insert({
          user_id: user?.id,
          amount: -amount,
          type: 'transfer_sent',
          description: `Sent to @${recipientUsername}`,
        });

      if (deductError) throw deductError;

      // Add to recipient
      const { error: addError } = await supabase
        .from('credit_transactions')
        .insert({
          user_id: recipient.id,
          amount: amount,
          type: 'transfer_received',
          description: `Received from @${user?.user_metadata?.username || 'user'}`,
        });

      if (addError) throw addError;

      toast({
        title: 'Credits Sent',
        description: `Successfully sent ${amount} credits to @${recipientUsername}`,
      });

      setSendAmount('');
      setRecipientUsername('');
      setIsSendModalOpen(false);
    } catch (error: any) {
      toast({
        title: 'Transfer Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getTierInfo = () => {
    const tier = Array.isArray(subscription?.subscription_tiers)
      ? subscription.subscription_tiers[0]
      : subscription?.subscription_tiers;
    
    return tier || null;
  };

  const tierInfo = getTierInfo();

  const handlePurchasePackage = async (packageId: string, priceId: string) => {
    try {
      setLoadingPackage(packageId);
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (!currentUser) {
        navigate('/auth');
        return;
      }

      const { data, error } = await supabase.functions.invoke('stripe-checkout', {
        body: {
          type: 'one_time',
          priceId: priceId,
          successUrl: `${window.location.origin}/wallet?success=true`,
          cancelUrl: `${window.location.origin}/wallet?canceled=true`,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
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

  const handleSubscribe = async (tierId: string, priceId: string) => {
    try {
      setLoadingTier(tierId);
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (!currentUser) {
        navigate('/auth');
        return;
      }

      const { data, error } = await supabase.functions.invoke('stripe-checkout', {
        body: {
          type: 'subscription',
          priceId: priceId,
          successUrl: `${window.location.origin}/wallet?success=true`,
          cancelUrl: `${window.location.origin}/wallet?canceled=true`,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      toast({
        title: 'Subscription Failed',
        description: error.message || 'Failed to start subscription',
        variant: 'destructive',
      });
    } finally {
      setLoadingTier(null);
    }
  };

  const tierIcons = {
    'Basic': Zap,
    'Pro': Crown,
    'Premium': Star,
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button
                onClick={() => navigate(-1)}
                variant="ghost"
                size="icon"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center space-x-2">
                <WalletIcon className="w-6 h-6 text-primary" />
                <h1 className="text-xl font-bold">Wallet & Credit</h1>
              </div>
            </div>
            <Dialog open={isSendModalOpen} onOpenChange={setIsSendModalOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Send className="w-4 h-4 mr-2" />
                  Send
                </Button>
              </DialogTrigger>
              <DialogContent>
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
                    />
                  </div>
                  <div>
                    <Label>Amount</Label>
                    <Input
                      type="number"
                      placeholder="100"
                      value={sendAmount}
                      onChange={(e) => setSendAmount(e.target.value)}
                    />
                    {credits && (
                      <p className="text-xs text-muted-foreground mt-1">
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
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 space-y-6">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="buy">Buy Credits</TabsTrigger>
            <TabsTrigger value="subscribe">Subscribe</TabsTrigger>
            <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6 mt-6">
            {/* Balance Card */}
            <Card className="bg-gradient-to-br from-primary/20 to-accent/20 border-primary/50">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Current Balance</span>
                  {tierInfo && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Crown className="w-3 h-3" />
                      {tierInfo.name}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>Your available credits</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-4xl font-bold text-primary">
                    {isAdmin ? '∞' : (credits?.balance || 0)}
                    <span className="text-lg text-muted-foreground ml-2">
                      {isAdmin ? 'Unlimited' : 'credits'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Total Earned</p>
                      <p className="font-semibold">{credits?.total_earned || 0}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Spent</p>
                      <p className="font-semibold">{credits?.total_spent || 0}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Active Subscription Card */}
            {subscription && tierInfo && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Crown className="w-5 h-5 text-primary" />
                    Active Subscription
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Plan</span>
                      <span className="font-semibold">{tierInfo.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Price</span>
                      <span className="font-semibold">${tierInfo.price}/month</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <Badge variant="secondary">{subscription.status}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Renews</span>
                      <span className="text-sm">{format(new Date(subscription.current_period_end), 'MMM d, yyyy')}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Buy Credits Tab */}
          <TabsContent value="buy" className="space-y-6 mt-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold mb-2">Buy Credits</h2>
              <p className="text-muted-foreground">Choose a credit package that fits your needs</p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {packages?.map((pkg) => (
                <Card key={pkg.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShoppingCart className="w-5 h-5" />
                      {pkg.name}
                    </CardTitle>
                    <CardDescription>
                      {pkg.credits} credits + {pkg.bonus_credits} bonus
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-primary mb-4">
                      ${pkg.price}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Total: {(pkg.credits || 0) + (pkg.bonus_credits || 0)} credits
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button
                      className="w-full"
                      onClick={() => handlePurchasePackage(pkg.id, pkg.stripe_price_id)}
                      disabled={loadingPackage === pkg.id}
                    >
                      {loadingPackage === pkg.id ? 'Processing...' : 'Buy Now'}
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Subscribe Tab */}
          <TabsContent value="subscribe" className="space-y-6 mt-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold mb-2">Subscription Plans</h2>
              <p className="text-muted-foreground">Unlock premium features and benefits</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {tiers?.map((tier) => {
                const features = tier.features as string[];
                const Icon = tierIcons[tier.name as keyof typeof tierIcons] || Zap;
                const isCurrentPlan = subscription?.tier_id === tier.id;

                return (
                  <Card 
                    key={tier.id} 
                    className={`relative ${tier.name === 'Pro' ? 'border-primary shadow-lg scale-105' : ''}`}
                  >
                    {tier.name === 'Pro' && (
                      <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary to-accent">
                        Most Popular
                      </Badge>
                    )}
                    <CardHeader>
                      <div className="flex items-center justify-between mb-2">
                        <CardTitle className="flex items-center gap-2">
                          <Icon className="w-5 h-5" />
                          {tier.name}
                        </CardTitle>
                        {isCurrentPlan && (
                          <Badge variant="secondary">Current</Badge>
                        )}
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold">${tier.price}</span>
                        <span className="text-muted-foreground">/{tier.interval}</span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-3">
                        {features.map((feature, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                            <span className="text-sm">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                    <CardFooter>
                      <Button
                        className="w-full"
                        variant={tier.name === 'Pro' ? 'default' : 'outline'}
                        onClick={() => handleSubscribe(tier.id, tier.stripe_price_id)}
                        disabled={loadingTier === tier.id || isCurrentPlan}
                      >
                        {loadingTier === tier.id ? 'Processing...' : isCurrentPlan ? 'Current Plan' : 'Subscribe Now'}
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Marketplace Tab */}
          <TabsContent value="marketplace" className="space-y-6 mt-6">
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
                  onClick={() => navigate('/p2p-marketplace')}
                  className="w-full"
                  size="lg"
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Visit Marketplace
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Transaction History</CardTitle>
                <CardDescription>Your recent credit activity</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="all">
                  <TabsList className="w-full">
                    <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
                    <TabsTrigger value="earned" className="flex-1">Earned</TabsTrigger>
                    <TabsTrigger value="spent" className="flex-1">Spent</TabsTrigger>
                  </TabsList>
                  <TabsContent value="all" className="mt-4 space-y-3">
                    {transactions && transactions.length > 0 ? (
                      transactions.map((tx) => (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-accent/50"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${tx.amount > 0 ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                              {tx.amount > 0 ? (
                                <ArrowDownLeft className="w-4 h-4 text-green-500" />
                              ) : (
                                <ArrowUpRight className="w-4 h-4 text-red-500" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium">{tx.description || tx.type}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(tx.created_at), 'MMM d, yyyy h:mm a')}
                              </p>
                            </div>
                          </div>
                          <div className={`font-bold ${tx.amount > 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {tx.amount > 0 ? '+' : ''}{tx.amount}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-muted-foreground py-8">No transactions yet</p>
                    )}
                  </TabsContent>
                  <TabsContent value="earned" className="mt-4 space-y-3">
                    {transactions?.filter(tx => tx.amount > 0).map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-accent/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-green-500/20">
                            <ArrowDownLeft className="w-4 h-4 text-green-500" />
                          </div>
                          <div>
                            <p className="font-medium">{tx.description || tx.type}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(tx.created_at), 'MMM d, yyyy h:mm a')}
                            </p>
                          </div>
                        </div>
                        <div className="font-bold text-green-500">+{tx.amount}</div>
                      </div>
                    ))}
                  </TabsContent>
                  <TabsContent value="spent" className="mt-4 space-y-3">
                    {transactions?.filter(tx => tx.amount < 0).map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-accent/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-red-500/20">
                            <ArrowUpRight className="w-4 h-4 text-red-500" />
                          </div>
                          <div>
                            <p className="font-medium">{tx.description || tx.type}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(tx.created_at), 'MMM d, yyyy h:mm a')}
                            </p>
                          </div>
                        </div>
                        <div className="font-bold text-red-500">{tx.amount}</div>
                      </div>
                    ))}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <BottomNav onQuickActionClick={() => {}} />
    </div>
  );
};

export default Wallet;
