import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Zap, Star } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { BottomNav } from "@/components/navigation/BottomNav";

const Subscription = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);

  const { data: tiers } = useQuery({
    queryKey: ["subscription-tiers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_tiers")
        .select("*")
        .eq("is_active", true)
        .order("price", { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  const { data: currentSubscription } = useQuery({
    queryKey: ["current-subscription"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("user_subscriptions")
        .select("*, subscription_tiers(*)")
        .eq("user_id", user.id)
        .eq("status", "active")
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
  });

  const handleSubscribe = async (tierId: string, priceId: string) => {
    try {
      setLoading(tierId);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase.functions.invoke("stripe-checkout", {
        body: {
          type: "subscription",
          priceId: priceId,
          successUrl: `${window.location.origin}/subscription?success=true`,
          cancelUrl: `${window.location.origin}/subscription?canceled=true`,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error("Error:", error);
      toast.error(error.message || "Failed to start subscription");
    } finally {
      setLoading(null);
    }
  };

  const tierIcons = {
    "Basic": Zap,
    "Pro": Crown,
    "Premium": Star,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted pb-20">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Choose Your Plan
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Unlock premium features and take your FEEDIN experience to the next level
          </p>
        </div>

        {currentSubscription && (
          <Card className="mb-8 border-primary/50 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-primary" />
                Current Plan: {currentSubscription.subscription_tiers?.name}
              </CardTitle>
              <CardDescription>
                Active until {new Date(currentSubscription.current_period_end).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          {tiers?.map((tier) => {
            const features = tier.features as string[];
            const Icon = tierIcons[tier.name as keyof typeof tierIcons] || Zap;
            const isCurrentPlan = currentSubscription?.tier_id === tier.id;

            return (
              <Card 
                key={tier.id} 
                className={`relative ${tier.name === 'Pro' ? 'border-primary shadow-lg scale-105' : ''}`}
              >
                {tier.name === 'Pro' && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary to-accent">
                    Most Popular
                  </Badge>
                )}
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <CardTitle className="flex items-center gap-2">
                      <Icon className="w-5 h-5" />
                      {tier.name}
                    </CardTitle>
                    {isCurrentPlan && (
                      <Badge variant="secondary">Current</Badge>
                    )}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold">${tier.price}</span>
                    <span className="text-muted-foreground">/{tier.interval}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    variant={tier.name === 'Pro' ? 'default' : 'outline'}
                    onClick={() => handleSubscribe(tier.id, tier.stripe_price_id)}
                    disabled={loading === tier.id || isCurrentPlan}
                  >
                    {loading === tier.id ? 'Processing...' : isCurrentPlan ? 'Current Plan' : 'Subscribe Now'}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>
      <BottomNav />
    </div>
  );
};

export default Subscription;