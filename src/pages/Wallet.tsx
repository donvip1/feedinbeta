import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { BottomNav } from '@/components/navigation/BottomNav';
import { ArrowLeft, Wallet as WalletIcon, Send, ArrowUpRight, ArrowDownLeft, Crown } from 'lucide-react';
import { format } from 'date-fns';

const Wallet = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [sendAmount, setSendAmount] = useState('');
  const [recipientUsername, setRecipientUsername] = useState('');
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user]);

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
  });

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
                <h1 className="text-xl font-bold">Wallet</h1>
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
                {credits?.balance || 0}
                <span className="text-lg text-muted-foreground ml-2">credits</span>
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
              <div className="flex gap-2">
                <Button
                  onClick={() => navigate('/credits')}
                  className="flex-1"
                  variant="outline"
                >
                  Buy Credits
                </Button>
                <Button
                  onClick={() => navigate('/p2p-marketplace')}
                  className="flex-1"
                  variant="outline"
                >
                  P2P Trade
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Subscription Card */}
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
                <Button
                  onClick={() => navigate('/subscription')}
                  variant="outline"
                  className="w-full mt-4"
                >
                  Manage Subscription
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Transactions */}
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
      </div>

      <BottomNav onQuickActionClick={() => {}} />
    </div>
  );
};

export default Wallet;
