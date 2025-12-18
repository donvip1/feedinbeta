import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft, Coins, TrendingUp, Wallet, Send, Plus, History, 
  Shield, Eye, Users, Lock, Gift, Megaphone, DollarSign, 
  Award, Target, RefreshCw, PiggyBank
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

interface CreditStatistics {
  user_credits_total: number;
  user_count: number;
  p2p_escrow_locked: number;
  p2p_active_listings: number;
  platform_balance: number;
  team_wallets_total: number;
  gift_revenue: number;
  promotion_revenue: number;
  total_minted: number;
  circulating_supply: number;
}

interface IncentiveTier {
  id: string;
  tier_name: string;
  min_earnings: number;
  max_earnings: number | null;
  bonus_percentage: number;
  period_type: string;
  is_active: boolean;
}

const AdminWallet = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mintAmount, setMintAmount] = useState("");
  const [mintReason, setMintReason] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferUserId, setTransferUserId] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawReason, setWithdrawReason] = useState("");

  // Server-side permission check - can view admin wallet (admin OR moderator)
  const { data: canViewWallet, isLoading: loadingViewPermission } = useQuery({
    queryKey: ["can-view-admin-wallet"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("can_view_admin_wallet");
      if (error) throw error;
      return data as boolean;
    },
  });

  // Server-side permission check - can manage credits (admin ONLY)
  const { data: canManageCredits, isLoading: loadingManagePermission } = useQuery({
    queryKey: ["can-manage-credits"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("can_manage_credits");
      if (error) throw error;
      return data as boolean;
    },
  });

  // Redirect if no access
  useEffect(() => {
    if (!loadingViewPermission && canViewWallet === false) {
      toast.error("Access denied: Admin privileges required");
      navigate("/feed");
    }
  }, [canViewWallet, loadingViewPermission, navigate]);

  // Fetch comprehensive credit statistics
  const { data: creditStats, refetch: refetchStats } = useQuery({
    queryKey: ["credit-statistics"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_credit_statistics");
      if (error) throw error;
      return data as unknown as CreditStatistics;
    },
    enabled: canViewWallet === true,
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  // Fetch platform wallet
  const { data: platformWallet } = useQuery({
    queryKey: ["platform-wallet"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_wallet")
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    enabled: canViewWallet === true,
  });

  // Fetch credit supply
  const { data: creditSupply } = useQuery({
    queryKey: ["credit-supply"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_supply")
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    enabled: canViewWallet === true,
  });

  // Fetch team wallet
  const { data: teamWallet } = useQuery({
    queryKey: ["team-wallet"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data, error } = await supabase
        .from("team_wallets")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: canViewWallet === true,
  });

  // Fetch incentive tiers
  const { data: incentiveTiers } = useQuery({
    queryKey: ["incentive-tiers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creator_incentive_tiers")
        .select("*")
        .eq("is_active", true)
        .order("min_earnings", { ascending: true });
      if (error) throw error;
      return data as IncentiveTier[];
    },
    enabled: canViewWallet === true,
  });

  // Fetch platform transactions
  const { data: transactions } = useQuery({
    queryKey: ["platform-transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: canViewWallet === true,
  });

  // Sync credit supply mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("sync_credit_supply");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Credit supply synced successfully");
      queryClient.invalidateQueries({ queryKey: ["credit-statistics"] });
      queryClient.invalidateQueries({ queryKey: ["credit-supply"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to sync credit supply");
    },
  });

  // Mint credits mutation
  const mintMutation = useMutation({
    mutationFn: async ({ amount, reason }: { amount: number; reason: string }) => {
      const { data, error } = await supabase.rpc("admin_mint_credits", {
        p_amount: amount,
        p_reason: reason || "Admin mint",
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Credits minted successfully");
      queryClient.invalidateQueries({ queryKey: ["platform-wallet"] });
      queryClient.invalidateQueries({ queryKey: ["credit-supply"] });
      queryClient.invalidateQueries({ queryKey: ["credit-statistics"] });
      queryClient.invalidateQueries({ queryKey: ["platform-transactions"] });
      setMintAmount("");
      setMintReason("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to mint credits");
    },
  });

  // Transfer to user mutation
  const transferMutation = useMutation({
    mutationFn: async ({ userId, amount, reason }: { userId: string; amount: number; reason: string }) => {
      const { data, error } = await supabase.rpc("admin_transfer_to_user", {
        p_user_id: userId,
        p_amount: amount,
        p_reason: reason || "Admin transfer",
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Credits transferred successfully");
      queryClient.invalidateQueries({ queryKey: ["platform-wallet"] });
      queryClient.invalidateQueries({ queryKey: ["credit-statistics"] });
      queryClient.invalidateQueries({ queryKey: ["platform-transactions"] });
      setTransferAmount("");
      setTransferUserId("");
      setTransferReason("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to transfer credits");
    },
  });

  // Withdraw to team wallet mutation
  const withdrawMutation = useMutation({
    mutationFn: async ({ amount, reason }: { amount: number; reason: string }) => {
      const { data, error } = await supabase.rpc("admin_withdraw_to_team_wallet", {
        p_amount: amount,
        p_reason: reason || "Withdrawal to team wallet",
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Withdrawn to team wallet successfully");
      queryClient.invalidateQueries({ queryKey: ["platform-wallet"] });
      queryClient.invalidateQueries({ queryKey: ["team-wallet"] });
      queryClient.invalidateQueries({ queryKey: ["credit-statistics"] });
      queryClient.invalidateQueries({ queryKey: ["platform-transactions"] });
      setWithdrawAmount("");
      setWithdrawReason("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to withdraw");
    },
  });

  // Loading state
  if (loadingViewPermission || loadingManagePermission) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // No access
  if (!canViewWallet) {
    return null;
  }

  const maxSupply = Number(creditSupply?.total_supply || 100000000);
  const circulatingSupply = creditStats?.circulating_supply || 0;
  const circulatingPercent = ((circulatingSupply / maxSupply) * 100).toFixed(4);

  const totalRevenue = (creditStats?.gift_revenue || 0) + 
                       (creditStats?.promotion_revenue || 0) + 
                       (platformWallet?.subscription_revenue || 0) +
                       (platformWallet?.p2p_fee_revenue || 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted pb-20">
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-sm border-b border-border/50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              <h1 className="text-xl font-bold">Admin Wallet</h1>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  refetchStats();
                  syncMutation.mutate();
                }}
                disabled={syncMutation.isPending}
              >
                <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
              </Button>
              {canManageCredits ? (
                <Badge variant="default" className="bg-primary">Super Admin</Badge>
              ) : (
                <Badge variant="secondary">
                  <Eye className="w-3 h-3 mr-1" />
                  View Only
                </Badge>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Credit Circulation Overview */}
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="w-5 h-5 text-primary" />
              Credit Circulation Overview
            </CardTitle>
            <CardDescription>Real-time credit distribution across the platform</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Circulating Supply</span>
              <span className="text-2xl font-bold text-primary">
                {circulatingSupply.toLocaleString()} / {maxSupply.toLocaleString()}
              </span>
            </div>
            <Progress value={parseFloat(circulatingPercent)} className="h-3" />
            <p className="text-xs text-muted-foreground text-right">{circulatingPercent}% of max supply</p>
          </CardContent>
        </Card>

        {/* Distribution Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-blue-500/30 bg-blue-500/5">
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="flex items-center gap-1.5 text-xs">
                <Users className="w-3.5 h-3.5 text-blue-500" />
                User Wallets
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <p className="text-xl font-bold text-blue-500">
                {(creditStats?.user_credits_total || 0).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">
                {creditStats?.user_count || 0} users
              </p>
            </CardContent>
          </Card>

          <Card className="border-orange-500/30 bg-orange-500/5">
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="flex items-center gap-1.5 text-xs">
                <Lock className="w-3.5 h-3.5 text-orange-500" />
                P2P Escrow
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <p className="text-xl font-bold text-orange-500">
                {(creditStats?.p2p_escrow_locked || 0).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">
                {(creditStats?.p2p_active_listings || 0).toLocaleString()} in listings
              </p>
            </CardContent>
          </Card>

          <Card className="border-green-500/30 bg-green-500/5">
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="flex items-center gap-1.5 text-xs">
                <Wallet className="w-3.5 h-3.5 text-green-500" />
                Platform Wallet
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <p className="text-xl font-bold text-green-500">
                {(creditStats?.platform_balance || 0).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">
                Earned: {platformWallet?.total_earned?.toLocaleString() || 0}
              </p>
            </CardContent>
          </Card>

          <Card className="border-purple-500/30 bg-purple-500/5">
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="flex items-center gap-1.5 text-xs">
                <PiggyBank className="w-3.5 h-3.5 text-purple-500" />
                Team Wallets
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <p className="text-xl font-bold text-purple-500">
                {(creditStats?.team_wallets_total || 0).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">
                Your wallet: {teamWallet?.balance?.toLocaleString() || 0}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Revenue Breakdown */}
        <Card className="border-accent/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <DollarSign className="w-5 h-5 text-accent" />
              Platform Revenue
            </CardTitle>
            <CardDescription>Income from platform fees and commissions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 rounded-lg bg-pink-500/10 border border-pink-500/20">
                <Gift className="w-5 h-5 text-pink-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-pink-500">
                  {(creditStats?.gift_revenue || 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Gift Fees (5%)</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <Megaphone className="w-5 h-5 text-yellow-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-yellow-500">
                  {(creditStats?.promotion_revenue || 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Promotions</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                <Award className="w-5 h-5 text-cyan-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-cyan-500">
                  {(platformWallet?.subscription_revenue || 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Subscriptions</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <Coins className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-emerald-500">
                  {(platformWallet?.p2p_fee_revenue || 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">P2P Fees</p>
              </div>
            </div>
            <div className="mt-4 p-3 rounded-lg bg-accent/10 border border-accent/20 text-center">
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              <p className="text-2xl font-bold text-accent">{totalRevenue.toLocaleString()} Credits</p>
            </div>
          </CardContent>
        </Card>

        {/* Creator Incentive Tiers */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="w-5 h-5 text-primary" />
              Creator Incentive Tiers
            </CardTitle>
            <CardDescription>Bonus payouts for top performing creators</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {incentiveTiers?.filter(t => t.period_type === 'monthly').map((tier) => (
                <div 
                  key={tier.id} 
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border"
                >
                  <div>
                    <p className="font-medium text-sm">{tier.tier_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {tier.min_earnings.toLocaleString()} - {tier.max_earnings?.toLocaleString() || '∞'} credits/month
                    </p>
                  </div>
                  <Badge variant="secondary" className="bg-primary/20 text-primary">
                    +{tier.bonus_percentage}%
                  </Badge>
                </div>
              ))}
            </div>
            {incentiveTiers?.filter(t => t.period_type === 'weekly').length ? (
              <>
                <p className="text-sm font-medium mt-4 mb-2">Weekly Bonuses</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {incentiveTiers?.filter(t => t.period_type === 'weekly').map((tier) => (
                    <div 
                      key={tier.id} 
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border"
                    >
                      <div>
                        <p className="font-medium text-sm">{tier.tier_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {tier.min_earnings.toLocaleString()} - {tier.max_earnings?.toLocaleString() || '∞'} credits/week
                        </p>
                      </div>
                      <Badge variant="secondary" className="bg-accent/20 text-accent">
                        +{tier.bonus_percentage}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>

        {/* Action Tabs */}
        <Tabs defaultValue={canManageCredits ? "mint" : "history"} className="w-full">
          <TabsList className={`grid w-full ${canManageCredits ? 'grid-cols-4' : 'grid-cols-1'}`}>
            {canManageCredits && (
              <>
                <TabsTrigger value="mint" className="gap-1 text-xs">
                  <Plus className="w-3 h-3" /> Mint
                </TabsTrigger>
                <TabsTrigger value="transfer" className="gap-1 text-xs">
                  <Send className="w-3 h-3" /> Transfer
                </TabsTrigger>
                <TabsTrigger value="withdraw" className="gap-1 text-xs">
                  <Wallet className="w-3 h-3" /> Withdraw
                </TabsTrigger>
              </>
            )}
            <TabsTrigger value="history" className="gap-1 text-xs">
              <History className="w-3 h-3" /> History
            </TabsTrigger>
          </TabsList>

          {canManageCredits && (
            <>
              <TabsContent value="mint" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Mint Credits</CardTitle>
                    <CardDescription>
                      Create new credits and add to platform wallet. Max supply: {maxSupply.toLocaleString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="mint-amount">Amount to Mint</Label>
                      <Input
                        id="mint-amount"
                        type="number"
                        placeholder="Enter amount"
                        value={mintAmount}
                        onChange={(e) => setMintAmount(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mint-reason">Reason (optional)</Label>
                      <Input
                        id="mint-reason"
                        placeholder="Enter reason for minting"
                        value={mintReason}
                        onChange={(e) => setMintReason(e.target.value)}
                      />
                    </div>
                    <Button 
                      onClick={() => mintMutation.mutate({ amount: parseInt(mintAmount), reason: mintReason })}
                      disabled={!mintAmount || mintMutation.isPending}
                      className="w-full"
                    >
                      {mintMutation.isPending ? "Minting..." : "Mint Credits"}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="transfer" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Transfer to User</CardTitle>
                    <CardDescription>
                      Transfer credits from platform wallet to a user
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="transfer-user">User ID</Label>
                      <Input
                        id="transfer-user"
                        placeholder="Enter user UUID"
                        value={transferUserId}
                        onChange={(e) => setTransferUserId(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="transfer-amount">Amount</Label>
                      <Input
                        id="transfer-amount"
                        type="number"
                        placeholder="Enter amount"
                        value={transferAmount}
                        onChange={(e) => setTransferAmount(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="transfer-reason">Reason (optional)</Label>
                      <Input
                        id="transfer-reason"
                        placeholder="Enter reason for transfer"
                        value={transferReason}
                        onChange={(e) => setTransferReason(e.target.value)}
                      />
                    </div>
                    <Button 
                      onClick={() => transferMutation.mutate({ 
                        userId: transferUserId, 
                        amount: parseInt(transferAmount), 
                        reason: transferReason 
                      })}
                      disabled={!transferAmount || !transferUserId || transferMutation.isPending}
                      className="w-full"
                    >
                      {transferMutation.isPending ? "Transferring..." : "Transfer Credits"}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="withdraw" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Withdraw to Team Wallet</CardTitle>
                    <CardDescription>
                      Move credits from platform wallet to your team wallet
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="withdraw-amount">Amount</Label>
                      <Input
                        id="withdraw-amount"
                        type="number"
                        placeholder="Enter amount"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="withdraw-reason">Reason (optional)</Label>
                      <Input
                        id="withdraw-reason"
                        placeholder="Enter reason for withdrawal"
                        value={withdrawReason}
                        onChange={(e) => setWithdrawReason(e.target.value)}
                      />
                    </div>
                    <Button 
                      onClick={() => withdrawMutation.mutate({ 
                        amount: parseInt(withdrawAmount), 
                        reason: withdrawReason 
                      })}
                      disabled={!withdrawAmount || withdrawMutation.isPending}
                      className="w-full"
                    >
                      {withdrawMutation.isPending ? "Withdrawing..." : "Withdraw to Team Wallet"}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </>
          )}

          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Transaction History</CardTitle>
                <CardDescription>
                  Recent platform transactions and credit movements
                </CardDescription>
              </CardHeader>
              <CardContent>
                {transactions && transactions.length > 0 ? (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {transactions.map((tx: any) => (
                      <div 
                        key={tx.id} 
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-full ${
                            tx.transaction_type === 'mint' ? 'bg-green-500/20' :
                            tx.transaction_type === 'transfer' ? 'bg-blue-500/20' :
                            tx.transaction_type === 'withdraw' ? 'bg-orange-500/20' :
                            tx.transaction_type === 'gift_fee' ? 'bg-pink-500/20' :
                            tx.transaction_type === 'promotion_fee' ? 'bg-yellow-500/20' :
                            'bg-muted'
                          }`}>
                            {tx.transaction_type === 'mint' && <Plus className="w-4 h-4 text-green-500" />}
                            {tx.transaction_type === 'transfer' && <Send className="w-4 h-4 text-blue-500" />}
                            {tx.transaction_type === 'withdraw' && <Wallet className="w-4 h-4 text-orange-500" />}
                            {tx.transaction_type === 'gift_fee' && <Gift className="w-4 h-4 text-pink-500" />}
                            {tx.transaction_type === 'promotion_fee' && <Megaphone className="w-4 h-4 text-yellow-500" />}
                          </div>
                          <div>
                            <p className="font-medium text-sm capitalize">{tx.transaction_type.replace('_', ' ')}</p>
                            <p className="text-xs text-muted-foreground">
                              {tx.description || 'No description'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${
                            ['mint', 'gift_fee', 'promotion_fee', 'subscription_fee', 'p2p_fee'].includes(tx.transaction_type) 
                              ? 'text-green-500' 
                              : 'text-red-500'
                          }`}>
                            {['mint', 'gift_fee', 'promotion_fee', 'subscription_fee', 'p2p_fee'].includes(tx.transaction_type) ? '+' : '-'}
                            {tx.amount?.toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {tx.created_at ? format(new Date(tx.created_at), 'MMM d, HH:mm') : '-'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No transactions yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* View-only notice for moderators */}
        {!canManageCredits && (
          <Card className="border-muted">
            <CardContent className="py-4">
              <p className="text-sm text-muted-foreground text-center">
                You have view-only access. Contact a super admin to manage credits.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AdminWallet;
