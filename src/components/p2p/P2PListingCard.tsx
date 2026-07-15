import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';

interface P2PListingCardProps {
  listing: {
    id: string;
    seller_id: string;
    credits_amount: number;
    price_cents: number;
    currency: string;
    created_at: string;
    seller?: {
      display_name: string | null;
      username: string | null;
      avatar_url: string | null;
    };
  };
  onBuy: (listingId: string) => void;
  isProcessing?: boolean;
}

export const P2PListingCard = ({ listing, onBuy, isProcessing }: P2PListingCardProps) => {
  const { user } = useAuth();
  const isOwnListing = user?.id === listing.seller_id;
  const price = listing.price_cents / 100;
  const creditsPerUnit = price > 0
    ? Math.round(listing.credits_amount / price)
    : listing.credits_amount;
  const sellerName =
    listing.seller?.display_name || listing.seller?.username || 'Seller';

  return (
    <div className="py-3.5 px-1">
      {/* Top row: seller + price */}
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{sellerName}</p>
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(listing.created_at), { addSuffix: true })}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold">{listing.credits_amount.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">
            {listing.currency} {price.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2.5">
        <span>{creditsPerUnit}/{listing.currency} rate</span>
        <span>30m payment window</span>
        <span>Escrow</span>
      </div>

      {/* Action */}
      <Button
        size="sm"
        variant={isOwnListing ? "outline" : "default"}
        className="h-8 text-xs"
        onClick={() => onBuy(listing.id)}
        disabled={isOwnListing || isProcessing}
      >
        {isOwnListing ? 'Your listing' : isProcessing ? 'Processing…' : 'Buy'}
      </Button>
    </div>
  );
};
