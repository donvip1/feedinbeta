import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Zap, Crown, Star, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SubscriptionCardProps {
  id: string;
  name: string;
  price: number;
  interval: string;
  features: string[];
  isPopular?: boolean;
  isCurrentPlan?: boolean;
  isLoading?: boolean;
  onSubscribe: () => void;
}

const tierIcons: Record<string, React.ElementType> = {
  'Basic': Zap,
  'Pro': Crown,
  'Premium': Star,
};

export const SubscriptionCard: React.FC<SubscriptionCardProps> = ({
  name,
  price,
  interval,
  features,
  isPopular,
  isCurrentPlan,
  isLoading,
  onSubscribe,
}) => {
  const Icon = tierIcons[name] || Zap;

  return (
    <div 
      className={cn(
        "relative flex-shrink-0 w-[300px] sm:w-auto rounded-2xl border p-5 pt-8 transition-all duration-200 overflow-visible",
        isPopular 
          ? "border-primary bg-primary/5 shadow-lg shadow-primary/20 sm:scale-105 mt-4" 
          : "border-border bg-card hover:border-primary/50",
        isCurrentPlan && "ring-2 ring-green-500/50"
      )}
    >
      {/* Popular badge */}
      {isPopular && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary to-accent text-primary-foreground whitespace-nowrap z-10">
          <Sparkles className="w-3 h-3 mr-1" />
          Most Popular
        </Badge>
      )}

      {/* Current plan badge */}
      {isCurrentPlan && (
        <Badge className="absolute -top-2.5 right-4 bg-green-500 text-white">
          Current
        </Badge>
      )}

      <div className="pt-2">
        {/* Plan header */}
        <div className="flex items-center gap-2 mb-4">
          <div className={cn(
            "p-2 rounded-lg",
            isPopular ? "bg-primary/20" : "bg-secondary"
          )}>
            <Icon className={cn("w-5 h-5", isPopular ? "text-primary" : "text-muted-foreground")} />
          </div>
          <h3 className="text-lg font-semibold text-foreground">{name}</h3>
        </div>

        {/* Price */}
        <div className="mb-5">
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold text-foreground">${price}</span>
            <span className="text-muted-foreground">/{interval}</span>
          </div>
        </div>

        {/* Features */}
        <ul className="space-y-2.5 mb-5">
          {features.map((feature, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <span className="text-sm text-muted-foreground">{feature}</span>
            </li>
          ))}
        </ul>

        {/* Subscribe button */}
        <Button 
          onClick={onSubscribe}
          disabled={isLoading || isCurrentPlan}
          className="w-full"
          variant={isPopular ? "default" : "outline"}
        >
          {isLoading ? 'Processing...' : isCurrentPlan ? 'Current Plan' : 'Subscribe Now'}
        </Button>
      </div>
    </div>
  );
};
