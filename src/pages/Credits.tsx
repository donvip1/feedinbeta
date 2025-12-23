import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Coins, Gift, TrendingUp, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { BottomNav } from "@/components/navigation/BottomNav";
import { PackageCard } from "@/components/wallet/PackageCard";
import { useCachedQuery } from "@/hooks/useCachedQuery";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/shared/PageHeader";

const Credits = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);

  const { data: packages, isLoading: packagesLoading } = useCachedQuery({
    cacheKey: "credit_packages",
    queryKey: ["credit-packages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_packages")
        .select("*")
        .eq("is_active", true)
        .order("price", { ascending: true });
      
      if (error) throw error;
      return data;
    },
    ttl: 60 * 60 * 1000, // 1 hour
  });

  const { data: userCredits, isStale: creditsStale } = useCachedQuery({
    cacheKey: `credits:${user?.id}`,
    queryKey: ["user-credits", user?.id],
    queryFn: async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return null;

      const { data: baseData } = await supabase
        .from("user_credits")
        .select("*")
        .eq("user_id", currentUser.id)
        .single();

      const { data: secureCredits } = await supabase.rpc('get_user_credits', { 
        p_user_id: currentUser.id 
      });
      
      return {
        balance: secureCredits ?? baseData?.balance ?? 0,
        total_earned: baseData?.total_earned ?? 0,
        total_spent: baseData?.total_spent ?? 0,
      };
    },
    ttl: 10 * 60 * 1000, // 10 minutes
    enabled: !!user,
  });

  const handlePurchase = async (packageId: string, priceId: string) => {
    try {
      setLoading(packageId);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase.functions.invoke("stripe-checkout", {
        body: {
          type: "credits",
          priceId: priceId,
          successUrl: `${window.location.origin}/credits?success=true`,
          cancelUrl: `${window.location.origin}/credits?canceled=true`,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error("Error:", error);
      toast.error(error.message || "Failed to purchase credits");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <PageHeader 
        title="Credits Store" 
        icon={<Coins className="w-5 h-5" />}
      />

      <div className="px-4 py-5 space-y-6">
        {/* Header section */}
        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Buy Credits
          </h1>
          <p className="text-sm text-muted-foreground mb-4">
            Use credits for AI generations, premium features, and more
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/wallet/p2p')}
            className="gap-2"
          >
            <TrendingUp className="w-4 h-4" />
            Trade on P2P Marketplace
          </Button>
        </div>

        {/* User Credits Card */}
        {userCredits && (
          <div className="rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-accent/20 border border-primary/30 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Coins className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">Your Credits</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Balance</p>
                <p className="text-xl font-bold text-primary">{userCredits.balance}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="p-1 rounded-full bg-green-500/20">
                  <ArrowDownLeft className="w-3 h-3 text-green-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Earned</p>
                  <p className="text-sm font-semibold">{userCredits.total_earned}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="p-1 rounded-full bg-red-500/20">
                  <ArrowUpRight className="w-3 h-3 text-red-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Spent</p>
                  <p className="text-sm font-semibold">{userCredits.total_spent}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Credit Packages - Horizontal scroll on mobile, grid on desktop */}
        <div className="overflow-x-auto overflow-y-visible scrollbar-hide -mx-4 px-4 pt-10 mt-4">
          <div className="flex gap-5 sm:grid sm:grid-cols-2 lg:grid-cols-4 min-w-max sm:min-w-0 pb-4 pt-4">
            {packages?.map((pkg) => (
              <PackageCard
                key={pkg.id}
                id={pkg.id}
                name={pkg.name}
                credits={pkg.credits}
                bonusCredits={pkg.bonus_credits || 0}
                price={pkg.price}
                isPopular={pkg.name.toLowerCase().includes('popular') || pkg.name.toLowerCase().includes('pro')}
                isLoading={loading === pkg.id}
                promotionLabel={pkg.promotion_label}
                promotionActive={pkg.promotion_active}
                discountPercentage={pkg.discount_percentage}
                onPurchase={() => handlePurchase(pkg.id, pkg.stripe_price_id)}
              />
            ))}
          </div>
        </div>
      </div>
      
      <BottomNav />
    </div>
  );
};

export default Credits;
