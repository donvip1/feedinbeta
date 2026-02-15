import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useCurrency } from '@/context/CurrencyContext';
import { Button } from '@/components/ui/button';
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
    country_code?: string;
    currency_code?: string;
    is_international?: boolean;
    profiles?: {
      display_name: string | null;
      username: string | null;
      avatar_url: string | null;
    };
  };
  userCountry?: string;
  onBuy: (listingId: string, sellerId: string, credits: number, price: number) => void;
  isProcessing?: boolean;
}

export const P2PListingCard = ({ listing, userCountry, onBuy, isProcessing }: P2PListingCardProps) => {
  const { user } = useAuth();
  const { convertFromUSD, currencySymbol } = useCurrency();
  const [showTerms, setShowTerms] = useState(false);

  const isOwnListing = user?.id === listing.seller_id;
  const creditsPerDollar = Math.round(listing.credits_amount / listing.price_usd);
  const localPrice = convertFromUSD(listing.price_usd);
  const isSameCountry = !userCountry || listing.country_code === userCountry;
  const sellerName = listing.profiles?.display_name || listing.profiles?.username || 'Seller';

  return (
    <div className="py-3.5 px-1">
      {/* Top row: seller + price */}
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{sellerName}</p>
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(listing.created_at), { addSuffix: true })}
            {listing.country_code && <span className="ml-1.5">· {listing.country_code}</span>}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold">{listing.credits_amount.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">
            {currencySymbol}{localPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2.5">
        <span>{creditsPerDollar}/$ rate</span>
        {listing.payment_window_minutes && <span>{listing.payment_window_minutes}m window</span>}
        {(listing.min_amount || listing.max_amount) && (
          <span>
            {listing.min_amount && `${listing.min_amount}`}
            {listing.min_amount && listing.max_amount && '–'}
            {listing.max_amount && `${listing.max_amount}`}
          </span>
        )}
        <span>Escrow</span>
      </div>

      {/* Terms toggle */}
      {listing.terms && (
        <div className="mb-2.5">
          <button onClick={() => setShowTerms(!showTerms)} className="text-xs text-primary hover:underline">
            {showTerms ? 'Hide terms' : 'Terms'}
          </button>
          {showTerms && (
            <p className="mt-1 text-xs text-muted-foreground">{listing.terms}</p>
          )}
        </div>
      )}

      {/* Action */}
      {!isSameCountry ? (
        <p className="text-xs text-muted-foreground">Region locked</p>
      ) : (
        <Button
          size="sm"
          variant={isOwnListing ? "outline" : "default"}
          className="h-8 text-xs"
          onClick={() => onBuy(listing.id, listing.seller_id, listing.credits_amount, listing.price_usd)}
          disabled={isOwnListing || isProcessing || !isSameCountry}
        >
          {isOwnListing ? 'Your listing' : isProcessing ? 'Processing…' : 'Buy'}
        </Button>
      )}
    </div>
  );
};
