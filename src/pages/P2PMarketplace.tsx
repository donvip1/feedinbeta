import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, Globe } from 'lucide-react';
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
    if (!user) { toast.error('Please sign in to buy credits'); return; }
    if (!eligibility.canBuy) {
      if (eligibility.isBuyerBanned) {
        toast.error(`You are banned from buying until ${new Date(eligibility.buyerBanUntil!).toLocaleDateString()}`);
      } else { toast.error('Please complete your P2P setup first'); }
      return;
    }
    if (creditsAmount < eligibility.minTradeAmount) {
      toast.error(`Minimum trade amount is ${eligibility.minTradeAmount} credits`);
      return;
    }
    setProcessingId(listingId);
    try {
      const { data, error } = await supabase.from('p2p_transactions').insert({
        listing_id: listingId, buyer_id: user.id, seller_id: sellerId,
        credits_amount: creditsAmount, price_usd: priceUsd,
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
    } finally { setProcessingId(null); }
  };

  const activeCount = myTransactions?.filter(t => !['completed', 'cancelled'].includes(t.status)).length || 0;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border/50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/wallet')} className="h-8 w-8">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-lg font-semibold">Market</h1>
          </div>
          {myCredits && <CreateListingModal userCredits={myCredits.balance} />}
        </div>
      </header>

      <div className="container mx-auto px-4 py-4 space-y-4">
        {/* Eligibility */}
        <EligibilityBanner />

        {/* Balance + Rate row */}
        <div className="flex items-center justify-between py-3">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Balance</p>
            <p className="text-2xl font-bold text-foreground">{myCredits?.balance?.toLocaleString() || '0'}</p>
            <p className="text-xs text-muted-foreground">{myCredits ? formatCreditsValue(myCredits.balance) : ''}</p>
          </div>
          <div className="text-right text-sm">
            <p className="text-muted-foreground">
              Buy <span className="font-medium text-foreground">{P2P_CONFIG.BUY_RATE}/$</span>
            </p>
            <p className="text-muted-foreground">
              Sell <span className="font-medium text-foreground">{P2P_CONFIG.SELL_RATE}/$</span>
            </p>
            {activeCount > 0 && (
              <p className="text-xs text-primary mt-1">{activeCount} active</p>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="listings">
          <TabsList className="w-full h-9 bg-muted/50">
            <TabsTrigger value="listings" className="flex-1 text-xs">Listings</TabsTrigger>
            <TabsTrigger value="my-orders" className="flex-1 text-xs">My Orders</TabsTrigger>
          </TabsList>

          <TabsContent value="listings" className="mt-3 space-y-3">
            {/* Region toggle */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {listings?.length || 0} available
              </span>
              <button
                onClick={() => setShowRegionOnly(!showRegionOnly)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Globe className="w-3 h-3" />
                {showRegionOnly ? userCountry : 'All'}
              </button>
            </div>

            {listingsLoading ? (
              <div className="space-y-px">
                {[1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse h-16 bg-muted/30 rounded" />
                ))}
              </div>
            ) : listings?.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-sm">No listings{showRegionOnly ? ` in ${userCountry}` : ''}</p>
                {showRegionOnly && (
                  <button onClick={() => setShowRegionOnly(false)} className="text-xs text-primary mt-1 hover:underline">
                    View all regions
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {listings?.map((listing) => (
                  <P2PListingCard
                    key={listing.id}
                    listing={listing}
                    userCountry={userCountry}
                    onBuy={handleBuyCredits}
                    isProcessing={processingId === listing.id}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="my-orders" className="mt-3">
            {myTransactions?.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                No transactions yet
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {myTransactions?.map((tx) => (
                  <div
                    key={tx.id}
                    onClick={() => navigate(`/wallet/p2p/${tx.id}`)}
                    className="flex items-center justify-between py-3 px-1 cursor-pointer hover:bg-muted/20 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium">{tx.credits_amount.toLocaleString()} credits</p>
                      <p className="text-xs text-muted-foreground">
                        {tx.buyer_id === user?.id ? 'Buying' : 'Selling'} · ${tx.price_usd}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground capitalize">
                      {tx.status.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
      <BottomNav />
    </div>
  );
};

export default P2PMarketplace;
