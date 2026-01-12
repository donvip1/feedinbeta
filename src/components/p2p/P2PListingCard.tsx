import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrency } from '@/context/CurrencyContext';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Coins, DollarSign, Clock, Shield, Star, TrendingUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface P2PListingCardProps {
  listing: {
    id: string;
    seller_id: string;
    credits_amount: number;
    price_usd: number;
    min_amount?: number;
    max_amount?: number;
    payment_window_minutes?: number;
    terms?: string;
    created_at: string;
    profiles?: {
      display_name: string | null;
      username: string | null;
      avatar_url: string | null;
    };
  };
  onBuy: (listingId: string, sellerId: string, credits: number, price: number) => void;
  isProcessing?: boolean;
}

export const P2PListingCard = ({ listing, onBuy, isProcessing }: P2PListingCardProps) => {
  const { user } = useAuth();
  const { formatPrice, convertFromUSD, currencySymbol } = useCurrency();
  const [showTerms, setShowTerms] = useState(false);

  const isOwnListing = user?.id === listing.seller_id;
  const creditsPerDollar = Math.round(listing.credits_amount / listing.price_usd);
  const localPrice = convertFromUSD(listing.price_usd);

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          {/* Seller Info */}
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src={listing.profiles?.avatar_url || undefined} />
              <AvatarFallback>
                {listing.profiles?.display_name?.charAt(0) || listing.profiles?.username?.charAt(0) || '?'}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">
                {listing.profiles?.display_name || listing.profiles?.username || 'Unknown Seller'}
              </p>
              <p className="text-sm text-muted-foreground">
                @{listing.profiles?.username}
              </p>
            </div>
          </div>

          {/* Rate Badge */}
          <Badge variant="secondary" className="gap-1">
            <TrendingUp className="w-3 h-3" />
            {creditsPerDollar}/$ 
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Amount and Price */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-muted rounded-lg text-center">
            <div className="flex items-center justify-center gap-1 text-2xl font-bold">
              <Coins className="w-5 h-5 text-primary" />
              {listing.credits_amount.toLocaleString()}
            </div>
            <p className="text-sm text-muted-foreground">Credits</p>
          </div>
          <div className="p-3 bg-muted rounded-lg text-center">
            <div className="text-2xl font-bold">
              {currencySymbol}{localPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
            <p className="text-sm text-muted-foreground">
              ~${listing.price_usd.toFixed(2)} USD
            </p>
          </div>
        </div>

        {/* Additional Info */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {listing.payment_window_minutes && (
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {listing.payment_window_minutes} min window
            </div>
          )}
          <div className="flex items-center gap-1">
            <Shield className="w-4 h-4" />
            Escrow Protected
          </div>
        </div>

        {/* Limits */}
        {(listing.min_amount || listing.max_amount) && (
          <div className="text-sm">
            <span className="text-muted-foreground">Limits: </span>
            <span>
              {listing.min_amount && `Min ${listing.min_amount}`}
              {listing.min_amount && listing.max_amount && ' - '}
              {listing.max_amount && `Max ${listing.max_amount}`}
              {' credits'}
            </span>
          </div>
        )}

        {/* Terms (collapsible) */}
        {listing.terms && (
          <div>
            <button
              onClick={() => setShowTerms(!showTerms)}
              className="text-sm text-primary hover:underline"
            >
              {showTerms ? 'Hide terms' : 'View seller terms'}
            </button>
            {showTerms && (
              <p className="mt-2 text-sm text-muted-foreground p-3 bg-muted rounded-lg">
                {listing.terms}
              </p>
            )}
          </div>
        )}

        {/* Time since listing */}
        <p className="text-xs text-muted-foreground">
          Listed {formatDistanceToNow(new Date(listing.created_at), { addSuffix: true })}
        </p>
      </CardContent>

      <CardFooter>
        <Button
          className="w-full"
          onClick={() => onBuy(listing.id, listing.seller_id, listing.credits_amount, listing.price_usd)}
          disabled={isOwnListing || isProcessing}
        >
          {isOwnListing ? 'Your Listing' : isProcessing ? 'Processing...' : 'Buy Credits'}
        </Button>
      </CardFooter>
    </Card>
  );
};
