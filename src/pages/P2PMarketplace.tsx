import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { BackButton } from '@/components/navigation/BackButton';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/navigation/BottomNav';
import { P2PListingCard } from '@/components/p2p/P2PListingCard';
import { CreateListingModal } from '@/components/p2p/CreateListingModal';
import { EligibilityBanner } from '@/components/p2p/EligibilityBanner';
import { useCurrency } from '@/context/CurrencyContext';
import { useP2PEligibility } from '@/hooks/useP2PEligibility';
import { P2P_CONFIG } from '@/lib/p2p-config';
import { getErrorMessage } from '@/lib/error-messages';

const P2PMarketplace = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { formatCreditsValue } = useCurrency();
  const { eligibility } = useP2PEligibility();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const { data: listings, isLoading: listingsLoading } = useQuery({
    queryKey: ['p2p-listings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('p2p_listings')
        .select(
          'id, seller_id, credits_amount, price_cents, currency, status, created_at, seller:profiles!p2p_listings_seller_id_fkey(display_name, username, avatar_url)',
        )
        .eq('status', 'active')
        .order('created_at', { ascending: false });
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

  const handleBuyCredits = async (listingId: string) => {
    if (!user) { toast.error('Please sign in to buy credits'); return; }
    if (!eligibility.canBuy) {
      if (eligibility.isBuyerBanned) {
        toast.error(`You are banned from buying until ${new Date(eligibility.buyerBanUntil!).toLocaleDateString()}`);
      } else { toast.error('Please complete your P2P setup first'); }
      return;
    }
    setProcessingId(listingId);
    try {
      const { data, error } = await supabase.rpc(
        'p2p_start_transaction',
        {
          p_listing_id: listingId,
          p_idempotency_key: `web-p2p-${crypto.randomUUID()}`,
        },
      );
      if (error) throw error;
      const transaction = Array.isArray(data) ? data[0] : data;
      if (!transaction?.id) throw new Error('The P2P transaction was not returned.');
      toast.success('Transaction created! Proceed with payment.');
      navigate(`/wallet/p2p/${transaction.id}`);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to create transaction'));
    } finally { setProcessingId(null); }
  };

  const activeCount = myTransactions?.filter(t => !['completed', 'cancelled'].includes(t.status)).length || 0;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border/50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BackButton fallback="/wallet" className="h-8 w-8" />
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
            <p className="text-xs text-muted-foreground">
              {listings?.length || 0} available
            </p>

            {listingsLoading ? (
              <div className="space-y-px">
                {[1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse h-16 bg-muted/30 rounded" />
                ))}
              </div>
            ) : listings?.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-sm">No active listings</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {listings?.map((listing) => (
                  <P2PListingCard
                    key={listing.id}
                    listing={listing}
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
                        {tx.buyer_id === user?.id ? 'Buying' : 'Selling'} ·{' '}
                        {tx.currency} {(Number(tx.price_cents) / 100).toFixed(2)}
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
