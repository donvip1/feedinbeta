import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Gift, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PackageCardProps {
  id: string;
  name: string;
  credits: number;
  bonusCredits: number;
  price: number;
  isPopular?: boolean;
  isLoading?: boolean;
  onPurchase: () => void;
}

export const PackageCard: React.FC<PackageCardProps> = ({
  name,
  credits,
  bonusCredits,
  price,
  isPopular,
  isLoading,
  onPurchase,
}) => {
  const totalCredits = credits + bonusCredits;
  const savingsPercent = bonusCredits ? Math.round((bonusCredits / credits) * 100) : 0;
  const pricePerCredit = (price / totalCredits).toFixed(3);

  return (
    <div 
      className={cn(
        "relative flex-shrink-0 w-[280px] sm:w-auto rounded-2xl border p-4 pt-6 transition-all duration-200 overflow-visible",
        isPopular 
          ? "border-primary bg-primary/5 shadow-lg shadow-primary/20" 
          : "border-border bg-card hover:border-primary/50"
      )}
    >
      {/* Popular badge */}
      {isPopular && (
        <Badge className="absolute -top-3 left-4 bg-gradient-to-r from-primary to-accent text-primary-foreground z-10">
          <Sparkles className="w-3 h-3 mr-1" />
          Popular
        </Badge>
      )}

      {/* Bonus badge */}
      {savingsPercent > 0 && (
        <Badge className="absolute -top-3 right-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white z-10">
          +{savingsPercent}% Bonus
        </Badge>
      )}

      <div className="pt-2">
        {/* Package name */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-foreground">{name}</h3>
          {bonusCredits > 0 && <Gift className="w-4 h-4 text-green-500" />}
        </div>

        {/* Credits amount */}
        <div className="mb-3">
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-foreground">{totalCredits.toLocaleString()}</span>
            <span className="text-sm text-muted-foreground">credits</span>
          </div>
          <div className="flex gap-3 text-xs text-muted-foreground mt-1">
            <span>Base: {credits.toLocaleString()}</span>
            {bonusCredits > 0 && (
              <span className="text-green-500">+{bonusCredits.toLocaleString()} bonus</span>
            )}
          </div>
        </div>

        {/* Price */}
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <span className="text-2xl font-bold text-primary">${price}</span>
          </div>
          <span className="text-xs text-muted-foreground">${pricePerCredit}/credit</span>
        </div>

        {/* Buy button */}
        <Button 
          onClick={onPurchase}
          disabled={isLoading}
          className="w-full"
          variant={isPopular ? "default" : "outline"}
        >
          {isLoading ? 'Processing...' : 'Buy Now'}
        </Button>
      </div>
    </div>
  );
};
