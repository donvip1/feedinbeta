import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Crown } from "lucide-react";
import { BottomNav } from "@/components/navigation/BottomNav";
import { SubscriptionCard } from "@/components/wallet/SubscriptionCard";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { usePaystack } from "@/hooks/usePaystack";

const Subscription = () => {
  const { loading, initializePayment } = usePaystack({ type: 'subscription' });

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

        <div className="grid md:grid-cols-3 gap-6 pt-8 mt-4">
          {tiers?.map((tier) => {
            const features = tier.features as string[];
            const isCurrentPlan = currentSubscription?.tier_id === tier.id;

            return (
              <SubscriptionCard
                key={tier.id}
                id={tier.id}
                name={tier.name}
                price={tier.price}
                interval={tier.interval}
                features={features}
                isPopular={tier.name === 'Pro'}
                isCurrentPlan={isCurrentPlan}
                isLoading={loading === tier.id}
                onSubscribe={() => initializePayment(tier.id)}
              />
            );
          })}
        </div>
      </div>
      <BottomNav />
    </div>
  );
};

export default Subscription;
