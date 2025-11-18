import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, Plus, DollarSign, Coins } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/navigation/BottomNav';

const P2PMarketplace = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [creditsAmount, setCreditsAmount] = useState('');
  const [priceUsd, setPriceUsd] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const { data: listings, refetch } = useQuery({
    queryKey: ['p2p-listings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('p2p_listings')
        .select('*, profiles(display_name, username)')
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
  });

  const handleCreateListing = async () => {
    if (!creditsAmount || !priceUsd) {
      toast.error('Please fill in all fields');
      return;
    }

    const credits = parseInt(creditsAmount);
    const price = parseFloat(priceUsd);

    if (credits <= 0 || price <= 0) {
      toast.error('Invalid amounts');
      return;
    }

    if (myCredits && credits > myCredits.balance) {
      toast.error('Insufficient credits');
      return;
    }

    const { error } = await supabase.from('p2p_listings').insert({
      seller_id: user?.id,
      credits_amount: credits,
      price_usd: price,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success('Listing created successfully');
    setCreditsAmount('');
    setPriceUsd('');
    setIsCreateModalOpen(false);
    refetch();
  };

  const handleBuyCredits = async (listingId: string, sellerId: string, creditsAmount: number, priceUsd: number) => {
    const { data, error } = await supabase.from('p2p_transactions').insert({
      listing_id: listingId,
      buyer_id: user?.id,
      seller_id: sellerId,
      credits_amount: creditsAmount,
      price_usd: priceUsd,
    }).select().single();

    if (error) {
      toast.error(error.message);
      return;
    }

    // Create escrow
    const { error: escrowError } = await supabase.functions.invoke('p2p-escrow', {
      body: {
        action: 'create_transaction',
        transactionId: data.id,
        userId: user?.id,
      },
    });

    if (escrowError) {
      toast.error(escrowError.message);
      return;
    }

    toast.success('Transaction created! Please proceed with payment.');
    navigate(`/p2p-transaction/${data.id}`);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-sm border-b border-border/50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(-1)}
                className="text-gray-400 hover:text-white"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold">P2P Credit Marketplace</h1>
                <p className="text-sm text-muted-foreground">
                  Trade credits securely
                </p>
              </div>
            </div>
            <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Sell Credits
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Listing</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Credits Amount</Label>
                    <Input
                      type="number"
                      placeholder="100"
                      value={creditsAmount}
                      onChange={(e) => setCreditsAmount(e.target.value)}
                    />
                    {myCredits && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Available: {myCredits.balance} credits
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Price (USD)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="1.00"
                      value={priceUsd}
                      onChange={(e) => setPriceUsd(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Rate: ~85 credits per $1
                    </p>
                  </div>
                  <Button onClick={handleCreateListing} className="w-full">
                    Create Listing
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {myCredits && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="w-5 h-5" />
                Your Credits
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{myCredits.balance}</p>
            </CardContent>
          </Card>
        )}

        <h2 className="text-xl font-semibold mb-4">Active Listings</h2>
        <div className="grid gap-4">
          {listings?.map((listing) => (
            <Card key={listing.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Coins className="w-5 h-5" />
                      {listing.credits_amount} Credits
                    </CardTitle>
                    <CardDescription>
                      Seller: @{listing.profiles?.username || 'Unknown'}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary">
                    <DollarSign className="w-3 h-3 mr-1" />
                    ${listing.price_usd}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  Rate: ~{Math.round(listing.credits_amount / listing.price_usd)} credits per $1
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  onClick={() =>
                    handleBuyCredits(
                      listing.id,
                      listing.seller_id,
                      listing.credits_amount,
                      listing.price_usd
                    )
                  }
                  disabled={listing.seller_id === user?.id}
                >
                  {listing.seller_id === user?.id ? 'Your Listing' : 'Buy Credits'}
                </Button>
              </CardFooter>
            </Card>
          ))}
          {listings?.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No active listings available
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  );
};

export default P2PMarketplace;
