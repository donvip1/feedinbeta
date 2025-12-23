import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Gift, Sparkles, Zap, Image, MessageSquare, TrendingUp, Star, Crown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PackageCardProps {
  id: string;
  name: string;
  credits: number;
  bonusCredits: number;
  price: number;
  isPopular?: boolean;
  isLoading?: boolean;
  promotionLabel?: string;
  promotionActive?: boolean;
  discountPercentage?: number;
  onPurchase: () => void;
}

const CREDIT_FEATURES = [
  { icon: Image, text: 'AI Image Generation' },
  { icon: MessageSquare, text: 'AI Chat & Writing' },
  { icon: Gift, text: 'Send Gifts to Creators' },
  { icon: TrendingUp, text: 'Promote Your Posts' },
];

export const PackageCard: React.FC<PackageCardProps> = ({
  name,
  credits,
  bonusCredits,
  price,
  isPopular,
  isLoading,
  promotionLabel,
  promotionActive,
  discountPercentage,
  onPurchase,
}) => {
  const totalCredits = credits + bonusCredits;
  const bonusPercent = bonusCredits ? Math.round((bonusCredits / credits) * 100) : 0;
  const pricePerCredit = (price / totalCredits).toFixed(3);
  
  // Determine package tier for styling
  const isStarter = name.toLowerCase().includes('starter') || price <= 5;
  const isPro = name.toLowerCase().includes('pro') || name.toLowerCase().includes('popular');
  const isPremium = name.toLowerCase().includes('premium') || name.toLowerCase().includes('mega') || price >= 50;

  const getPackageIcon = () => {
    if (isPremium) return <Crown className="w-5 h-5" />;
    if (isPro || isPopular) return <Star className="w-5 h-5" />;
    return <Zap className="w-5 h-5" />;
  };

  const getGradientClass = () => {
    if (isPremium) return 'from-amber-500/20 via-yellow-500/10 to-orange-500/20';
    if (isPopular || isPro) return 'from-primary/20 via-primary/10 to-accent/20';
    return 'from-muted/50 to-muted/30';
  };

  const getBorderClass = () => {
    if (isPremium) return 'border-amber-500/50 shadow-lg shadow-amber-500/20';
    if (isPopular || isPro) return 'border-primary/50 shadow-lg shadow-primary/20';
    return 'border-border hover:border-primary/30';
  };

  return (
    <div 
      className={cn(
        "relative flex-shrink-0 w-[300px] sm:w-auto rounded-2xl border p-5 pt-8 transition-all duration-300 overflow-visible",
        `bg-gradient-to-br ${getGradientClass()}`,
        getBorderClass()
      )}
    >
      {/* Top Badges Container */}
      <div className="absolute -top-3 left-0 right-0 flex justify-between px-4 z-10">
        {/* Popular/Premium badge */}
        {(isPopular || isPremium) && (
          <Badge className={cn(
            "px-3 py-1 font-semibold",
            isPremium 
              ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white" 
              : "bg-gradient-to-r from-primary to-accent text-primary-foreground"
          )}>
            <Sparkles className="w-3 h-3 mr-1.5" />
            {isPremium ? 'Best Value' : 'Popular'}
          </Badge>
        )}
        
        {/* Spacer if no left badge */}
        {!isPopular && !isPremium && <div />}

        {/* Bonus badge */}
        {bonusPercent > 0 && (
          <Badge className="px-3 py-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold">
            <Gift className="w-3 h-3 mr-1.5" />
            +{bonusPercent}% Bonus
          </Badge>
        )}
      </div>

      {/* Promotion badge */}
      {promotionActive && promotionLabel && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-red-500 to-pink-500 text-white font-semibold z-20">
          {promotionLabel}
        </Badge>
      )}

      <div className="space-y-4">
        {/* Package Header */}
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2.5 rounded-xl",
            isPremium ? "bg-amber-500/20 text-amber-500" :
            isPopular || isPro ? "bg-primary/20 text-primary" :
            "bg-muted text-muted-foreground"
          )}>
            {getPackageIcon()}
          </div>
          <div>
            <h3 className="font-bold text-lg text-foreground">{name}</h3>
            <p className="text-xs text-muted-foreground">One-time purchase</p>
          </div>
        </div>

        {/* Credits Display */}
        <div className="bg-background/60 rounded-xl p-4 border border-border/50">
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              {totalCredits.toLocaleString()}
            </span>
            <span className="text-sm text-muted-foreground font-medium">credits</span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-muted-foreground">
              Base: <span className="text-foreground font-medium">{credits.toLocaleString()}</span>
            </span>
            {bonusCredits > 0 && (
              <span className="text-green-500 font-semibold flex items-center gap-1">
                <Gift className="w-3 h-3" />
                +{bonusCredits.toLocaleString()} bonus
              </span>
            )}
          </div>
        </div>

        {/* Price Section */}
        <div className="flex items-end justify-between">
          <div>
            {discountPercentage && discountPercentage > 0 ? (
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-primary">${price}</span>
                <span className="text-sm text-muted-foreground line-through">
                  ${(price / (1 - discountPercentage / 100)).toFixed(0)}
                </span>
              </div>
            ) : (
              <span className="text-3xl font-bold text-primary">${price}</span>
            )}
            <span className="text-xs text-muted-foreground block mt-0.5">USD</span>
          </div>
          <div className="text-right">
            <span className="text-sm font-semibold text-foreground">${pricePerCredit}</span>
            <span className="text-xs text-muted-foreground block">per credit</span>
          </div>
        </div>

        {/* Features List */}
        <div className="space-y-2 py-2 border-t border-border/50">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Use credits for:</p>
          <div className="grid grid-cols-2 gap-1.5">
            {CREDIT_FEATURES.map((feature, index) => (
              <div key={index} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Check className="w-3 h-3 text-green-500 flex-shrink-0" />
                <span className="truncate">{feature.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Buy Button */}
        <Button 
          onClick={onPurchase}
          disabled={isLoading}
          className={cn(
            "w-full h-12 text-base font-semibold transition-all duration-200",
            isPremium 
              ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-500/30" 
              : isPopular || isPro
              ? "bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground shadow-lg shadow-primary/30"
              : "bg-primary hover:bg-primary/90"
          )}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Processing...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              Buy Now
              {(isPopular || isPremium) && <Sparkles className="w-4 h-4" />}
            </span>
          )}
        </Button>
      </div>
    </div>
  );
};
