import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Coins, Gift, TrendingUp, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { BottomNav } from "@/components/navigation/BottomNav";

const Credits = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);

  const { data: packages } = useQuery({
    queryKey: ["credit-packages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_packages")
        .select("*")
        .eq("is_active", true)
        .order("price", { ascending: true });

      if (error) throw error;
      
      // Filter and mark active promotions
      const now = new Date();
      return data?.map(pkg => {
        const isPromotionActive = pkg.promotion_active && 
          (!pkg.promotion_start || new Date(pkg.promotion_start) <= now) &&
          (!pkg.promotion_end || new Date(pkg.promotion_end) >= now);
        
        return {
          ...pkg,
          isPromotionActive,
          finalPrice: isPromotionActive && pkg.discount_percentage 
            ? pkg.price * (1 - pkg.discount_percentage / 100)
            : pkg.price,
          totalCredits: pkg.credits + (isPromotionActive ? (pkg.bonus_credits || 0) : 0)
        };
      });
    },
  });

  const { data: userCredits } = useQuery({
    queryKey: ["user-credits"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("user_credits")
        .select("*")
        .eq("user_id", user.id)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
  });

  const handlePurchase = async (packageId: string, priceId: string, credits: number) => {
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted pb-20">
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-sm border-b border-border/50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="text-gray-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold">Credits Store</h1>
          </div>
        </div>
      </header>
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Buy Credits
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-4">
            Use credits for AI generations, premium features, and more
          </p>
          <Button
            variant="outline"
            onClick={() => navigate('/p2p-marketplace')}
            className="gap-2"
          >
            <TrendingUp className="w-4 h-4" />
            Trade Credits on P2P Marketplace
          </Button>
        </div>

        {userCredits && (
          <Card className="mb-8 border-primary/50 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-primary" />
                Your Credits
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Balance</p>
                  <p className="text-2xl font-bold text-primary">{userCredits.balance}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Earned</p>
                  <p className="text-2xl font-bold">{userCredits.total_earned}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Spent</p>
                  <p className="text-2xl font-bold">{userCredits.total_spent}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {packages?.map((pkg) => (
            <Card 
              key={pkg.id} 
              className={`relative ${pkg.name.includes('Popular') ? 'border-primary shadow-lg' : ''}`}
            >
              {pkg.isPromotionActive && pkg.promotion_label && (
                <Badge className="absolute -top-3 right-4 bg-gradient-to-r from-primary to-accent">
                  {pkg.promotion_label}
                </Badge>
              )}
              {(pkg.bonus_credits || 0) > 0 && !pkg.isPromotionActive && (
                <Badge className="absolute -top-3 right-4 bg-gradient-to-r from-green-500 to-emerald-500">
                  +{Math.round(((pkg.bonus_credits || 0) / pkg.credits) * 100)}% Bonus
                </Badge>
              )}
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{pkg.name}</span>
                  {(pkg.bonus_credits || 0) > 0 && <Gift className="w-5 h-5 text-green-500" />}
                </CardTitle>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{pkg.totalCredits}</span>
                  <span className="text-muted-foreground text-sm">credits</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Base Credits:</span>
                    <span className="font-semibold">{pkg.credits}</span>
                  </div>
                  {(pkg.bonus_credits || 0) > 0 && (
                    <div className="flex justify-between text-sm text-green-500">
                      <span>Bonus:</span>
                      <span className="font-semibold">+{pkg.bonus_credits}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t">
                    {pkg.isPromotionActive && (pkg.discount_percentage || 0) > 0 ? (
                      <div className="space-y-1">
                        <div className="text-lg line-through text-muted-foreground">
                          ${pkg.price.toFixed(2)}
                        </div>
                        <div className="text-2xl font-bold text-primary">
                          ${pkg.finalPrice.toFixed(2)}
                        </div>
                        <div className="text-xs text-green-500">
                          Save {pkg.discount_percentage}%!
                        </div>
                      </div>
                    ) : (
                      <div className="text-2xl font-bold text-primary">${pkg.price}</div>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">
                      ${((pkg.finalPrice || pkg.price) / pkg.totalCredits).toFixed(3)} per credit
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  variant={pkg.name.includes('Popular') ? 'default' : 'outline'}
                  onClick={() => handlePurchase(pkg.id, pkg.stripe_price_id, pkg.totalCredits)}
                  disabled={loading === pkg.id}
                >
                  {loading === pkg.id ? 'Processing...' : 'Buy Now'}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
      <BottomNav onQuickActionClick={() => {}} />
    </div>
  );
};

export default Credits;