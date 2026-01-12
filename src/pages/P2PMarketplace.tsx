import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, Coins, Shield, History, TrendingUp, Globe, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/navigation/BottomNav';
import { P2PListingCard } from '@/components/p2p/P2PListingCard';
import { CreateListingModal } from '@/components/p2p/CreateListingModal';
import { EligibilityBanner } from '@/components/p2p/EligibilityBanner';
import { useCurrency } from '@/context/CurrencyContext';
import { useP2PEligibility } from '@/hooks/useP2PEligibility';
import { P2P_CONFIG } from '@/lib/p2p-config';

const P2PMarketplace = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { formatCreditsValue, userLocation } = useCurrency();
  const { eligibility } = useP2PEligibility();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showRegionOnly, setShowRegionOnly] = useState(true);

  const userCountry = eligibility.userCountry || (typeof userLocation === 'string' ? userLocation : userLocation?.countryCode) || 'NG';

  const { data: listings, isLoading: listingsLoading } = useQuery({
    queryKey: ['p2p-listings', showRegionOnly, userCountry],
    queryFn: async () => {
      let query = supabase
        .from('p2p_listings')
        .select('*, profiles(display_name, username, avatar_url)')
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      
      // Filter by region if enabled
      if (showRegionOnly && userCountry) {
        query = query.eq('country_code', userCountry);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data;
    },
  });

  const { data: myCredits } = useQuery({
    queryKey: ['user-credits', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('user_credits')
        .select('balance')
        .eq('user_id', user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: myTransactions } = useQuery({
    queryKey: ['my-p2p-transactions', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('p2p_transactions')
        .select('*')
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const handleBuyCredits = async (listingId: string, sellerId: string, creditsAmount: number, priceUsd: number) => {
    if (!user) {
      toast.error('Please sign in to buy credits');
      return;
    }

    if (!eligibility.canTrade) {
      toast.error('Please complete your P2P setup first');
      return;
    }

    if (creditsAmount < eligibility.minTradeAmount) {
      toast.error(`Minimum trade amount is ${eligibility.minTradeAmount} credits`);
      return;
    }

    setProcessingId(listingId);
    try {
      const { data, error } = await supabase.from('p2p_transactions').insert({
        listing_id: listingId,
        buyer_id: user.id,
        seller_id: sellerId,
        credits_amount: creditsAmount,
        price_usd: priceUsd,
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      }).select().single();

      if (error) throw error;

      const { error: escrowError } = await supabase.functions.invoke('p2p-escrow', {
        body: { action: 'create_transaction', transactionId: data.id },
      });

      if (escrowError) throw escrowError;

      toast.success('Transaction created! Proceed with payment.');
      navigate(`/wallet/p2p/${data.id}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create transaction');
    } finally {
      setProcessingId(null);
    }
  };

  const activeCount = myTransactions?.filter(t => !['completed', 'cancelled'].includes(t.status)).length || 0;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-sm border-b border-border/50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold">P2P Marketplace</h1>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Shield className="w-3 h-3" /> Escrow Protected Trading
                </p>
              </div>
            </div>
            {myCredits && <CreateListingModal userCredits={myCredits.balance} />}
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Eligibility Banner */}
        <EligibilityBanner />

        {/* P2P Rate Info */}
        <Card className="bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">P2P Rate</span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">
                  Buy: <span className="font-medium text-foreground">{P2P_CONFIG.BUY_RATE} credits/$1</span>
                </span>
                <span className="text-muted-foreground">
                  Sell: <span className="font-medium text-primary">{P2P_CONFIG.SELL_RATE} credits/$1</span>
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Balance Card */}
        {myCredits && (
          <Card className="bg-gradient-to-r from-primary/10 to-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Your Balance</p>
                  <p className="text-3xl font-bold flex items-center gap-2">
                    <Coins className="w-6 h-6 text-primary" />
                    {myCredits.balance.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    ≈ {formatCreditsValue(myCredits.balance)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {activeCount > 0 && (
                    <Badge variant="secondary" className="gap-1">
                      <History className="w-3 h-3" />
                      {activeCount} Active
                    </Badge>
                  )}
                  {eligibility.userCountry && (
                    <Badge variant="outline" className="gap-1">
                      <Globe className="w-3 h-3" />
                      {eligibility.userCountry}
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="listings">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="listings">Available Listings</TabsTrigger>
            <TabsTrigger value="my-orders">My Orders</TabsTrigger>
          </TabsList>

          <TabsContent value="listings" className="mt-4 space-y-4">
            {/* Region Filter */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Filter</span>
              </div>
              <Button
                variant={showRegionOnly ? "default" : "outline"}
                size="sm"
                onClick={() => setShowRegionOnly(!showRegionOnly)}
                className="gap-1"
              >
                <Globe className="h-3 w-3" />
                {showRegionOnly ? `${userCountry} Only` : 'All Regions'}
              </Button>
            </div>

            {listingsLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : listings?.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No active listings in {showRegionOnly ? userCountry : 'any region'}</p>
                  <p className="text-sm">Be the first to sell your credits!</p>
                  {showRegionOnly && (
                    <Button 
                      variant="link" 
                      onClick={() => setShowRegionOnly(false)}
                      className="mt-2"
                    >
                      View all regions
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {listings?.map((listing) => (
                  <P2PListingCard
                    key={listing.id}
                    listing={listing}
                    onBuy={handleBuyCredits}
                    isProcessing={processingId === listing.id}
                  />
                ))}
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="my-orders" className="mt-4 space-y-4">
            {myTransactions?.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <p>No transactions yet</p>
                </CardContent>
              </Card>
            ) : (
              myTransactions?.map((tx) => (
                <Card 
                  key={tx.id} 
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(`/wallet/p2p/${tx.id}`)}
                >
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{tx.credits_amount} Credits</p>
                        <p className="text-sm text-muted-foreground">
                          {tx.buyer_id === user?.id ? 'Buying' : 'Selling'} • ${tx.price_usd}
                        </p>
                      </div>
                      <Badge variant={tx.status === 'completed' ? 'default' : 'secondary'}>
                        {tx.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
      <BottomNav />
    </div>
  );
};

export default P2PMarketplace;
