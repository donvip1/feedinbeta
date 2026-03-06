import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  ArrowLeft, Coins, TrendingUp, Wallet, Send, Plus, History, 
  Shield, Eye, Users, Lock, Gift, Megaphone, DollarSign, 
  Award, Target, RefreshCw, PiggyBank, Radio, Activity, 
  ArrowUpRight, ArrowDownRight, Clock, Calendar, Search,
  CheckCircle2, AlertTriangle, Zap, UserCheck, X, Sparkles
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { BackButton } from '@/components/navigation/BackButton';
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

interface CreditStatistics {
  user_credits_total: number;
  user_count: number;
  p2p_escrow_locked: number;
  p2p_active_listings: number;
  platform_balance: number;
  team_wallets_total: number;
  gift_revenue: number;
  promotion_revenue: number;
  subscription_revenue: number;
  p2p_fee_revenue: number;
  ai_feature_revenue: number;
  platform_profit: number;
  creator_payouts_total: number;
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

interface GiftStatistics {
  total_gifts_sent: number;
  total_gift_credits: number;
  total_platform_fees: number;
  gifts_today: number;
  gifts_this_week: number;
  gifts_this_month: number;
  credits_today: number;
  credits_this_week: number;
  credits_this_month: number;
  unique_senders: number;
  unique_receivers: number;
  top_gift_types: { gift_type: string; count: number; total_value: number }[] | null;
  gifts_by_source: { source_type: string; count: number; total_value: number }[] | null;
}

interface LiveStreamStatistics {
  total_streams: number;
  active_streams: number;
  ended_streams: number;
  total_viewers: number;
  total_gifts_sent: number;
  total_gift_credits: number;
  gifts_today: number;
  credits_today: number;
  gifts_this_week: number;
  credits_this_week: number;
  unique_gifters: number;
  unique_receivers: number;
  peak_concurrent_viewers: number;
  avg_stream_duration: number;
  top_streamers: { receiver_id: string; gift_count: number; total_credits: number }[] | null;
  gift_types: { gift_type: string; count: number; total_value: number }[] | null;
}

interface DailyEarnings {
  date: string;
  gift_earnings: number;
  promotion_earnings: number;
  subscription_earnings: number;
  p2p_fee_earnings: number;
  ai_feature_earnings: number;
  live_gift_earnings: number;
  total_earnings: number;
  platform_profit: number;
  creator_payouts: number;
  gifts_count: number;
  live_gifts_count: number;
  promotions_count: number;
  transactions_count: number;
}

interface ProfitsWalletSummary {
  balance: number;
  total_deposited: number;
  total_withdrawn: number;
  gift_fees_collected: number;
  live_gift_fees_collected: number;
  promotion_fees_collected: number;
  p2p_fees_collected: number;
  subscription_fees_collected: number;
  last_deposit_at: string | null;
  last_withdrawal_at: string | null;
  today_earnings: number;
  week_earnings: number;
  month_earnings: number;
}

interface ProfitsTransaction {
  id: string;
  transaction_type: string;
  amount: number;
  source_type: string | null;
  description: string | null;
  balance_after: number;
  created_at: string;
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
  const [withdrawProfitsAmount, setWithdrawProfitsAmount] = useState("");
  const [withdrawProfitsReason, setWithdrawProfitsReason] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [transferSuccess, setTransferSuccess] = useState(false);

  // Server-side permission check - can view admin wallet (admin OR moderator)
  const { data: canViewWallet, isLoading: loadingViewPermission } = useQuery({
    queryKey: ["can-view-admin-wallet"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("can_view_admin_wallet");
      if (error) throw error;
      return data as boolean;
    },
  });

  // Server-side permission check - can manage credits (admin + super_admin)
  const { data: canManageCredits, isLoading: loadingManagePermission } = useQuery({
    queryKey: ["can-manage-credits"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("can_manage_credits");
      if (error) throw error;
      return data as boolean;
    },
  });

  // Server-side permission check - can mint credits (super_admin ONLY)
  const { data: canMintCredits } = useQuery({
    queryKey: ["can-mint-credits"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("can_mint_credits");
      if (error) throw error;
      return data as boolean;
    },
  });

  // Server-side permission check - can withdraw (super_admin ONLY)
  const { data: canWithdraw } = useQuery({
    queryKey: ["can-withdraw"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("can_withdraw_from_wallet");
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

  // Fetch gift statistics
  const { data: giftStats } = useQuery({
    queryKey: ["gift-statistics"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_gift_statistics");
      if (error) throw error;
      return data as unknown as GiftStatistics;
    },
    enabled: canViewWallet === true,
    refetchInterval: 30000,
  });

  // Fetch live stream statistics
  const { data: liveStats } = useQuery({
    queryKey: ["live-stream-statistics"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_live_stream_statistics");
      if (error) throw error;
      return data as unknown as LiveStreamStatistics;
    },
    enabled: canViewWallet === true,
    refetchInterval: 30000,
  });

  // Fetch recent gift transactions
  const { data: recentGifts } = useQuery({
    queryKey: ["recent-gift-transactions"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_recent_gift_transactions", { p_limit: 30 });
      if (error) throw error;
      return data;
    },
    enabled: canViewWallet === true,
  });

  // Fetch recent live stream gifts
  const { data: recentLiveGifts } = useQuery({
    queryKey: ["recent-live-gifts"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_recent_live_gifts", { p_limit: 30 });
      if (error) throw error;
      return data;
    },
    enabled: canViewWallet === true,
  });

  // Fetch daily earnings statistics
  const { data: dailyEarnings } = useQuery({
    queryKey: ["daily-earnings-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_daily_earnings_stats" as any, { p_days: 30 });
      if (error) throw error;
      return data as unknown as DailyEarnings[];
    },
    enabled: canViewWallet === true,
    refetchInterval: 30000,
  });

  // Fetch profits wallet summary
  const { data: profitsWallet, refetch: refetchProfits } = useQuery({
    queryKey: ["profits-wallet-summary"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_profits_wallet_summary" as any);
      if (error) throw error;
      return data as unknown as ProfitsWalletSummary;
    },
    enabled: canViewWallet === true,
    refetchInterval: 30000,
  });

  // Fetch recent profits transactions
  const { data: profitsTransactions } = useQuery({
    queryKey: ["recent-profits-transactions"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_recent_profits_transactions" as any, { p_limit: 50 });
      if (error) throw error;
      return data as unknown as ProfitsTransaction[];
    },
    enabled: canViewWallet === true,
  });

   // Fetch subscription statistics
  const { data: subscriptionStats } = useQuery({
    queryKey: ["subscription-statistics"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_subscription_statistics" as any);
      if (error) throw error;
      return data as any;
    },
    enabled: canViewWallet === true,
    refetchInterval: 30000,
  });

  // User search for transfer
  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ["user-search-transfer", searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      const cleanQuery = searchQuery.replace(/^@/, '').toLowerCase();
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .or(`username.ilike.%${cleanQuery}%,full_name.ilike.%${cleanQuery}%`)
        .limit(6);
      if (error) throw error;
      return data || [];
    },
    enabled: searchQuery.length >= 2 && !selectedUser,
    staleTime: 10000,
  });

  // Recent transfers for history
  const { data: recentTransfers } = useQuery({
    queryKey: ["recent-admin-transfers"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('platform_transactions') as any)
        .select('id, type, amount, to_user_id, description, performed_by, created_at')
        .eq('type', 'transfer')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: canManageCredits === true,
  });

  // Withdraw from profits wallet mutation
  const withdrawProfitsMutation = useMutation({
    mutationFn: async ({ amount, reason }: { amount: number; reason: string }) => {
      const { data, error } = await supabase.rpc("admin_withdraw_from_profits", {
        p_amount: amount,
        p_reason: reason || "Withdrawal from profits",
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Withdrawn from profits wallet successfully");
      queryClient.invalidateQueries({ queryKey: ["profits-wallet-summary"] });
      queryClient.invalidateQueries({ queryKey: ["recent-profits-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["platform-transactions"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to withdraw from profits");
    },
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
      setTransferSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["platform-wallet"] });
      queryClient.invalidateQueries({ queryKey: ["credit-statistics"] });
      queryClient.invalidateQueries({ queryKey: ["platform-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["recent-admin-transfers"] });
      setTimeout(() => {
        setTransferSuccess(false);
        setShowConfirmation(false);
        setTransferAmount("");
        setTransferUserId("");
        setTransferReason("");
        setSelectedUser(null);
        setSearchQuery("");
      }, 2500);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to transfer credits");
      setShowConfirmation(false);
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
                       (creditStats?.subscription_revenue || 0) +
                       (creditStats?.p2p_fee_revenue || 0) +
                       (creditStats?.ai_feature_revenue || 0);
  
  const platformProfit = creditStats?.platform_profit || (totalRevenue * 0.70);
  const creatorPayouts = creditStats?.creator_payouts_total || (totalRevenue * 0.30);
  const profitMargin = totalRevenue > 0 ? ((platformProfit / totalRevenue) * 100).toFixed(1) : "70.0";

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted pb-20">
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-sm border-b border-border/50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-4">
            <BackButton fallback="/settings" className="text-muted-foreground hover:text-foreground" size="sm" />
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              <h1 className="text-xl font-bold">FeedIn Wallet</h1>
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
              {canMintCredits ? (
                <Badge variant="default" className="bg-primary">CEO Access</Badge>
              ) : canManageCredits ? (
                <Badge variant="default" className="bg-primary">Admin Access</Badge>
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
        {/* How FeedIn Credits Work - Educational Banner */}
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-background to-accent/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="w-5 h-5 text-primary" />
              How FeedIn Credits Work
            </CardTitle>
            <CardDescription>Understanding the credit supply model</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Flow Diagram */}
            <div className="flex flex-col md:flex-row items-stretch gap-3">
              {/* CEO Reserve */}
              <div className="flex-1 p-3 rounded-lg bg-muted/50 border border-dashed border-muted-foreground/30 text-center">
                <Lock className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
                <p className="text-xs font-medium text-muted-foreground">CEO Reserve</p>
                <p className="text-sm font-bold text-muted-foreground">Unlimited</p>
                <p className="text-[10px] text-muted-foreground/70 mt-1">Minting source · Hidden from supply</p>
              </div>
              
              {/* Arrow */}
              <div className="flex items-center justify-center md:py-0 py-1">
                <ArrowDownRight className="w-5 h-5 text-primary md:rotate-0 rotate-90" />
              </div>
              
              {/* FeedIn Wallet */}
              <div className="flex-[2] p-3 rounded-lg bg-primary/10 border border-primary/30 text-center">
                <Wallet className="w-5 h-5 text-primary mx-auto mb-1" />
                <p className="text-xs font-medium text-primary">FeedIn Wallet (Total Supply)</p>
                <p className="text-xl font-bold text-primary">{maxSupply.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground mt-1">Available to distribute: {(creditStats?.platform_balance || 0).toLocaleString()}</p>
              </div>
              
              {/* Arrow */}
              <div className="flex items-center justify-center md:py-0 py-1">
                <ArrowDownRight className="w-5 h-5 text-primary md:rotate-0 rotate-90" />
              </div>
              
              {/* User Wallets */}
              <div className="flex-[2] p-3 rounded-lg bg-accent/10 border border-accent/30 text-center">
                <Users className="w-5 h-5 text-accent mx-auto mb-1" />
                <p className="text-xs font-medium text-accent">User Wallets (Circulating)</p>
                <p className="text-xl font-bold text-accent">{circulatingSupply.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{creditStats?.user_count || 0} users · Subscriptions, gifts, transfers</p>
              </div>
            </div>
            
            {/* Circulation Progress */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Credits in circulation vs Total Supply</span>
                <span className="font-medium text-foreground">{circulatingPercent}%</span>
              </div>
              <Progress value={parseFloat(circulatingPercent)} className="h-2" />
            </div>
            
            {/* Key Info */}
            <div className="p-2 rounded-lg bg-muted/30 border border-muted-foreground/10">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                <strong>How it works:</strong> The CEO mints credits from the reserve into the FeedIn Wallet. 
                When users subscribe via Paystack, purchase credits, or receive admin transfers — credits are sent 
                directly from the FeedIn Wallet to their personal wallet. All movements are audited.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Live Balances Dashboard */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="flex items-center gap-1.5 text-xs">
                <Wallet className="w-3.5 h-3.5 text-primary" />
                FeedIn Wallet
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <p className="text-xl font-bold text-primary">
                {(creditStats?.platform_balance || 0).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">
                of {maxSupply.toLocaleString()} total
              </p>
            </CardContent>
          </Card>

          <Card className="border-accent/30 bg-accent/5">
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="flex items-center gap-1.5 text-xs">
                <Users className="w-3.5 h-3.5 text-accent" />
                User Wallets
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <p className="text-xl font-bold text-accent">
                {(creditStats?.user_credits_total || 0).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">
                {creditStats?.user_count || 0} users
              </p>
            </CardContent>
          </Card>

          <Card className="border-destructive/30 bg-destructive/5">
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="flex items-center gap-1.5 text-xs">
                <Lock className="w-3.5 h-3.5 text-destructive" />
                P2P Escrow
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <p className="text-xl font-bold text-destructive">
                {(creditStats?.p2p_escrow_locked || 0).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">
                {(creditStats?.p2p_active_listings || 0).toLocaleString()} listings
              </p>
            </CardContent>
          </Card>

          <Card className="border-secondary/30 bg-secondary/5">
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="flex items-center gap-1.5 text-xs">
                <PiggyBank className="w-3.5 h-3.5 text-secondary-foreground" />
                Team Wallets
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <p className="text-xl font-bold text-secondary-foreground">
                {(creditStats?.team_wallets_total || 0).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">
                Your wallet: {teamWallet?.balance?.toLocaleString() || 0}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 70/30 Profit Split Overview */}
        <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-accent/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="w-5 h-5 text-primary" />
              Profit Model (70/30 Split)
            </CardTitle>
            <CardDescription>FeedIn retains 70% • Creators receive 30%</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Visual Split Bar */}
            <div className="relative h-8 rounded-full overflow-hidden bg-muted">
              <div 
                className="absolute left-0 top-0 h-full bg-gradient-to-r from-green-500 to-green-600 flex items-center justify-center"
                style={{ width: '70%' }}
              >
                <span className="text-xs font-bold text-white">Platform 70%</span>
              </div>
              <div 
                className="absolute right-0 top-0 h-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center"
                style={{ width: '30%' }}
              >
                <span className="text-xs font-bold text-white">Creators 30%</span>
              </div>
            </div>
            
            {/* Profit Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-lg bg-muted/50 border">
                <p className="text-xs text-muted-foreground">Total Revenue</p>
                <p className="text-xl font-bold text-foreground">{totalRevenue.toLocaleString()}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                <p className="text-xs text-muted-foreground">Platform Profit</p>
                <p className="text-xl font-bold text-green-500">{platformProfit.toLocaleString()}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                <p className="text-xs text-muted-foreground">Creator Payouts</p>
                <p className="text-xl font-bold text-blue-500">{creatorPayouts.toLocaleString()}</p>
              </div>
            </div>
            
            <div className="flex items-center justify-center gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/20">
              <Shield className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium text-green-500">
                Current Profit Margin: {profitMargin}%
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Revenue Breakdown */}
        <Card className="border-accent/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <DollarSign className="w-5 h-5 text-accent" />
              Revenue Sources
            </CardTitle>
            <CardDescription>Breakdown of income streams</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="text-center p-3 rounded-lg bg-pink-500/10 border border-pink-500/20">
                <Gift className="w-4 h-4 text-pink-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-pink-500">
                  {(creditStats?.gift_revenue || 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Gifts (70%)</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <Megaphone className="w-4 h-4 text-yellow-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-yellow-500">
                  {(creditStats?.promotion_revenue || 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Promotions</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                <Award className="w-4 h-4 text-cyan-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-cyan-500">
                  {(creditStats?.subscription_revenue || 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Subscriptions</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <Coins className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-emerald-500">
                  {(creditStats?.p2p_fee_revenue || 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">P2P Fees</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                <Target className="w-4 h-4 text-purple-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-purple-500">
                  {(creditStats?.ai_feature_revenue || 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">AI Features</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profits Wallet - Team Earnings Tracker */}
        <Card className="border-emerald-500/20 bg-gradient-to-r from-emerald-500/5 to-green-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <PiggyBank className="w-5 h-5 text-emerald-500" />
              Profits Wallet (Fee Collection)
            </CardTitle>
            <CardDescription>
              Automatic fee collection from all transactions - 5% platform fee on gifts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Profits Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="text-center p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                <p className="text-2xl font-bold text-emerald-500">
                  {(profitsWallet?.balance || 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Current Balance</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <p className="text-2xl font-bold text-green-500">
                  {(profitsWallet?.total_deposited || 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Total Collected</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <p className="text-2xl font-bold text-orange-500">
                  {(profitsWallet?.total_withdrawn || 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Total Withdrawn</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <p className="text-2xl font-bold text-blue-500">
                  {(profitsWallet?.today_earnings || 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Today's Earnings</p>
              </div>
            </div>

            {/* Fee Collection Breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <div className="p-2 rounded-lg bg-pink-500/10 border border-pink-500/20 text-center">
                <Gift className="w-4 h-4 text-pink-500 mx-auto mb-1" />
                <p className="text-sm font-bold text-pink-500">
                  {(profitsWallet?.gift_fees_collected || 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Gift Fees</p>
              </div>
              <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
                <Radio className="w-4 h-4 text-red-500 mx-auto mb-1" />
                <p className="text-sm font-bold text-red-500">
                  {(profitsWallet?.live_gift_fees_collected || 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Live Gift Fees</p>
              </div>
              <div className="p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-center">
                <Megaphone className="w-4 h-4 text-yellow-500 mx-auto mb-1" />
                <p className="text-sm font-bold text-yellow-500">
                  {(profitsWallet?.promotion_fees_collected || 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Promo Fees</p>
              </div>
              <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-center">
                <Coins className="w-4 h-4 text-cyan-500 mx-auto mb-1" />
                <p className="text-sm font-bold text-cyan-500">
                  {(profitsWallet?.p2p_fees_collected || 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">P2P Fees</p>
              </div>
              <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-center">
                <Award className="w-4 h-4 text-purple-500 mx-auto mb-1" />
                <p className="text-sm font-bold text-purple-500">
                  {(profitsWallet?.subscription_fees_collected || 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Sub Fees</p>
              </div>
            </div>

            {/* Recent Profits Transactions */}
            {profitsTransactions && profitsTransactions.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Recent Profit Transactions</p>
                <div className="max-h-48 overflow-y-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Type</TableHead>
                        <TableHead className="text-xs">Amount</TableHead>
                        <TableHead className="text-xs">Source</TableHead>
                        <TableHead className="text-xs">Balance</TableHead>
                        <TableHead className="text-xs">Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {profitsTransactions.slice(0, 10).map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell className="text-xs capitalize">
                            <Badge variant="outline" className={`text-xs ${
                              tx.transaction_type.includes('gift') ? 'border-pink-500/30 text-pink-500' :
                              tx.transaction_type.includes('promotion') ? 'border-yellow-500/30 text-yellow-500' :
                              tx.transaction_type === 'withdrawal' ? 'border-orange-500/30 text-orange-500' :
                              'border-emerald-500/30 text-emerald-500'
                            }`}>
                              {tx.transaction_type.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className={`text-xs font-medium ${(tx.amount ?? 0) > 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {(tx.amount ?? 0) > 0 ? '+' : ''}{(tx.amount ?? 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground capitalize">{tx.source_type || '-'}</TableCell>
                          <TableCell className="text-xs">{(tx.balance_after ?? 0).toLocaleString()}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {tx.created_at ? format(new Date(tx.created_at), 'MMM d, HH:mm') : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Daily Earnings Statistics */}
        <Card className="border-indigo-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="w-5 h-5 text-indigo-500" />
              Daily Earnings Statistics
            </CardTitle>
            <CardDescription>
              Track daily revenue and performance metrics
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Time Period Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-indigo-500" />
                  <span className="text-xs text-muted-foreground">Today</span>
                </div>
                <p className="text-xl font-bold text-indigo-500">{(profitsWallet?.today_earnings || 0).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">credits earned</p>
              </div>
              <div className="p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4 text-violet-500" />
                  <span className="text-xs text-muted-foreground">This Week</span>
                </div>
                <p className="text-xl font-bold text-violet-500">{(profitsWallet?.week_earnings || 0).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">credits earned</p>
              </div>
              <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="w-4 h-4 text-purple-500" />
                  <span className="text-xs text-muted-foreground">This Month</span>
                </div>
                <p className="text-xl font-bold text-purple-500">{(profitsWallet?.month_earnings || 0).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">credits earned</p>
              </div>
            </div>

            {/* Daily Breakdown Table */}
            {dailyEarnings && dailyEarnings.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Daily Breakdown (Last 30 Days)</p>
                <div className="max-h-64 overflow-y-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Date</TableHead>
                        <TableHead className="text-xs">Gifts</TableHead>
                        <TableHead className="text-xs">Live</TableHead>
                        <TableHead className="text-xs">Promos</TableHead>
                        <TableHead className="text-xs">Total</TableHead>
                        <TableHead className="text-xs">Profit</TableHead>
                        <TableHead className="text-xs">Txns</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dailyEarnings.map((day) => (
                        <TableRow key={day.date}>
                          <TableCell className="text-xs font-medium">
                            {format(new Date(day.date), 'MMM d')}
                          </TableCell>
                          <TableCell className="text-xs text-pink-500">
                            {(day.gift_earnings ?? 0).toLocaleString()}
                            <span className="text-muted-foreground ml-1">({day.gifts_count ?? 0})</span>
                          </TableCell>
                          <TableCell className="text-xs text-red-500">
                            {(day.live_gift_earnings ?? 0).toLocaleString()}
                            <span className="text-muted-foreground ml-1">({day.live_gifts_count ?? 0})</span>
                          </TableCell>
                          <TableCell className="text-xs text-yellow-500">
                            {(day.promotion_earnings ?? 0).toLocaleString()}
                            <span className="text-muted-foreground ml-1">({day.promotions_count ?? 0})</span>
                          </TableCell>
                          <TableCell className="text-xs font-bold text-foreground">
                            {(day.total_earnings ?? 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-xs text-green-500 font-medium">
                            {(day.platform_profit ?? 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {day.transactions_count ?? 0}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Creator Incentive Tiers (30% Pool) */}
        <Card className="border-blue-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Award className="w-5 h-5 text-blue-500" />
              Creator Incentive Tiers
            </CardTitle>
            <CardDescription>
              Bonus payouts from the 30% creator pool based on performance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Creator Pool (30% of revenue)</span>
                <span className="text-lg font-bold text-blue-500">{creatorPayouts.toLocaleString()} Credits</span>
              </div>
            </div>
            
            <p className="text-sm font-medium mb-2">Monthly Tiers</p>
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
                  <Badge variant="secondary" className="bg-blue-500/20 text-blue-500">
                    +{tier.bonus_percentage}%
                  </Badge>
                </div>
              ))}
            </div>
            {incentiveTiers?.filter(t => t.period_type === 'weekly').length ? (
              <>
                <p className="text-sm font-medium mt-4 mb-2">Weekly Tiers</p>
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
            
            <p className="text-xs text-muted-foreground mt-4 text-center">
              * All creator incentives are paid from the 30% creator pool, ensuring platform maintains 70% profit margin
            </p>
          </CardContent>
        </Card>

        {/* Gift Analytics Section */}
        <Card className="border-pink-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Gift className="w-5 h-5 text-pink-500" />
              Gift Analytics & Tracking
            </CardTitle>
            <CardDescription>
              Comprehensive gift activity across posts, stories, and profiles
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Gift Overview Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="text-center p-3 rounded-lg bg-pink-500/10 border border-pink-500/20">
                <p className="text-2xl font-bold text-pink-500">
                  {(giftStats?.total_gifts_sent || 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Total Gifts</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                <p className="text-2xl font-bold text-purple-500">
                  {(giftStats?.total_gift_credits || 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Total Credits</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <p className="text-2xl font-bold text-green-500">
                  {(giftStats?.unique_senders || 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Unique Senders</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <p className="text-2xl font-bold text-blue-500">
                  {(giftStats?.unique_receivers || 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Unique Receivers</p>
              </div>
            </div>

            {/* Time-based Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-muted/50 border">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Today</span>
                </div>
                <p className="text-lg font-bold">{(giftStats?.gifts_today || 0).toLocaleString()} gifts</p>
                <p className="text-sm text-pink-500">+{(giftStats?.credits_today || 0).toLocaleString()} credits</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 border">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">This Week</span>
                </div>
                <p className="text-lg font-bold">{(giftStats?.gifts_this_week || 0).toLocaleString()} gifts</p>
                <p className="text-sm text-pink-500">+{(giftStats?.credits_this_week || 0).toLocaleString()} credits</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 border">
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">This Month</span>
                </div>
                <p className="text-lg font-bold">{(giftStats?.gifts_this_month || 0).toLocaleString()} gifts</p>
                <p className="text-sm text-pink-500">+{(giftStats?.credits_this_month || 0).toLocaleString()} credits</p>
              </div>
            </div>

            {/* Gift by Source Breakdown */}
            {giftStats?.gifts_by_source && giftStats.gifts_by_source.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Gifts by Source</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {giftStats.gifts_by_source.map((source) => (
                    <div key={source.source_type} className="p-2 rounded-lg bg-muted/30 border text-center">
                      <p className="text-xs text-muted-foreground capitalize">{source.source_type}</p>
                      <p className="font-bold">{source.count}</p>
                      <p className="text-xs text-pink-500">{source.total_value} credits</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Gift Transactions */}
            {recentGifts && recentGifts.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Recent Gift Transactions</p>
                <div className="max-h-64 overflow-y-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Sender</TableHead>
                        <TableHead className="text-xs">Receiver</TableHead>
                        <TableHead className="text-xs">Gift</TableHead>
                        <TableHead className="text-xs">Credits</TableHead>
                        <TableHead className="text-xs">Source</TableHead>
                        <TableHead className="text-xs">Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentGifts.slice(0, 10).map((gift: any) => (
                        <TableRow key={gift.id}>
                          <TableCell className="text-xs">@{gift.sender_username || 'Unknown'}</TableCell>
                          <TableCell className="text-xs">@{gift.receiver_username || 'Unknown'}</TableCell>
                          <TableCell className="text-xs">{gift.gift_type}</TableCell>
                          <TableCell className="text-xs text-pink-500 font-medium">{gift.credit_value}</TableCell>
                          <TableCell className="text-xs capitalize">{gift.source_type}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {gift.created_at ? format(new Date(gift.created_at), 'MMM d, HH:mm') : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Live Stream Analytics Section */}
        <Card className="border-red-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Radio className="w-5 h-5 text-red-500" />
              Live Stream Analytics
            </CardTitle>
            <CardDescription>
              Live streaming activity and gift revenue tracking
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Live Stream Overview Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="text-center p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-2xl font-bold text-red-500">
                  {(liveStats?.active_streams || 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Live Now</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <p className="text-2xl font-bold text-orange-500">
                  {(liveStats?.total_streams || 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Total Streams</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-2xl font-bold text-yellow-500">
                  {(liveStats?.total_gift_credits || 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Gifted Credits</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                <p className="text-2xl font-bold text-cyan-500">
                  {(liveStats?.peak_concurrent_viewers || 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Peak Viewers</p>
              </div>
            </div>

            {/* Live Gift Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-muted/50 border">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Today</span>
                </div>
                <p className="text-lg font-bold">{(liveStats?.gifts_today || 0).toLocaleString()} gifts</p>
                <p className="text-sm text-red-500">+{(liveStats?.credits_today || 0).toLocaleString()} credits</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 border">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">This Week</span>
                </div>
                <p className="text-lg font-bold">{(liveStats?.gifts_this_week || 0).toLocaleString()} gifts</p>
                <p className="text-sm text-red-500">+{(liveStats?.credits_this_week || 0).toLocaleString()} credits</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 border">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Participants</span>
                </div>
                <p className="text-lg font-bold">{(liveStats?.unique_gifters || 0).toLocaleString()} gifters</p>
                <p className="text-sm text-muted-foreground">{(liveStats?.unique_receivers || 0).toLocaleString()} streamers</p>
              </div>
            </div>

            {/* Gift Type Breakdown */}
            {liveStats?.gift_types && liveStats.gift_types.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Gift Types Distribution</p>
                <div className="flex flex-wrap gap-2">
                  {liveStats.gift_types.map((giftType) => (
                    <Badge key={giftType.gift_type} variant="outline" className="px-3 py-1">
                      {giftType.gift_type}: {giftType.count} ({giftType.total_value} credits)
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Live Stream Gifts */}
            {recentLiveGifts && recentLiveGifts.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Recent Live Stream Gifts</p>
                <div className="max-h-64 overflow-y-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Stream</TableHead>
                        <TableHead className="text-xs">Sender</TableHead>
                        <TableHead className="text-xs">Streamer</TableHead>
                        <TableHead className="text-xs">Gift</TableHead>
                        <TableHead className="text-xs">Credits</TableHead>
                        <TableHead className="text-xs">Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentLiveGifts.slice(0, 10).map((gift: any) => (
                        <TableRow key={gift.id}>
                          <TableCell className="text-xs max-w-[100px] truncate">{gift.stream_title || 'Stream'}</TableCell>
                          <TableCell className="text-xs">@{gift.sender_username || 'Unknown'}</TableCell>
                          <TableCell className="text-xs">@{gift.receiver_username || 'Unknown'}</TableCell>
                          <TableCell className="text-xs">{gift.gift_type}</TableCell>
                          <TableCell className="text-xs text-red-500 font-medium">{gift.credit_value}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {gift.created_at ? format(new Date(gift.created_at), 'MMM d, HH:mm') : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Tabs */}
        <Tabs defaultValue={canManageCredits ? "mint" : "history"} className="w-full">
          <TabsList className={`grid w-full ${canManageCredits ? 'grid-cols-5' : 'grid-cols-1'}`}>
            {canManageCredits && (
              <>
                <TabsTrigger value="mint" className="gap-1 text-xs">
                  <Plus className="w-3 h-3" /> Mint
                </TabsTrigger>
                <TabsTrigger value="transfer" className="gap-1 text-xs">
                  <Send className="w-3 h-3" /> Transfer
                </TabsTrigger>
                <TabsTrigger value="withdraw" className="gap-1 text-xs">
                  <Wallet className="w-3 h-3" /> Team
                </TabsTrigger>
                <TabsTrigger value="profits" className="gap-1 text-xs">
                  <PiggyBank className="w-3 h-3" /> Profits
                </TabsTrigger>
              </>
            )}
            <TabsTrigger value="history" className="gap-1 text-xs">
              <History className="w-3 h-3" /> History
            </TabsTrigger>
          </TabsList>

          {canMintCredits && (
            <TabsContent value="mint" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Fund FeedIn Wallet</CardTitle>
                  <CardDescription>
                    Mint credits from CEO reserve into the FeedIn Wallet. FeedIn allocation: {maxSupply.toLocaleString()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="mint-amount">Amount to Fund</Label>
                    <Input id="mint-amount" type="number" placeholder="Enter amount"
                      value={mintAmount} onChange={(e) => setMintAmount(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mint-reason">Reason (optional)</Label>
                    <Input id="mint-reason" placeholder="Enter reason for funding"
                      value={mintReason} onChange={(e) => setMintReason(e.target.value)} />
                  </div>
                  <Button onClick={() => mintMutation.mutate({ amount: parseInt(mintAmount), reason: mintReason })}
                    disabled={!mintAmount || mintMutation.isPending} className="w-full">
                    {mintMutation.isPending ? "Funding..." : "Fund FeedIn Wallet"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {canManageCredits && (
            <TabsContent value="transfer" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Transfer to User</CardTitle>
                  <CardDescription>Transfer credits from FeedIn Wallet to a user</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="transfer-user">Username or User ID</Label>
                    <Input id="transfer-user" placeholder="Enter username or UUID (e.g. tester1)"
                      value={transferUserId} onChange={(e) => setTransferUserId(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="transfer-amount">Amount</Label>
                    <Input id="transfer-amount" type="number" placeholder="Enter amount"
                      value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="transfer-reason">Reason (optional)</Label>
                    <Input id="transfer-reason" placeholder="Enter reason for transfer"
                      value={transferReason} onChange={(e) => setTransferReason(e.target.value)} />
                  </div>
                  <Button onClick={() => transferMutation.mutate({ userId: transferUserId, amount: parseInt(transferAmount), reason: transferReason })}
                    disabled={!transferAmount || !transferUserId || transferMutation.isPending} className="w-full">
                    {transferMutation.isPending ? "Transferring..." : "Transfer Credits"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {canWithdraw && (
            <>
              <TabsContent value="withdraw" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Withdraw to Team Wallet</CardTitle>
                    <CardDescription>Move credits from FeedIn Wallet to your team wallet</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="withdraw-amount">Amount</Label>
                      <Input id="withdraw-amount" type="number" placeholder="Enter amount"
                        value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="withdraw-reason">Reason (optional)</Label>
                      <Input id="withdraw-reason" placeholder="Enter reason for withdrawal"
                        value={withdrawReason} onChange={(e) => setWithdrawReason(e.target.value)} />
                    </div>
                    <Button onClick={() => withdrawMutation.mutate({ amount: parseInt(withdrawAmount), reason: withdrawReason })}
                      disabled={!withdrawAmount || withdrawMutation.isPending} className="w-full">
                      {withdrawMutation.isPending ? "Withdrawing..." : "Withdraw to Team Wallet"}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="profits" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Withdraw from Profits Wallet</CardTitle>
                    <CardDescription>
                      Withdraw collected fees. Balance: {(profitsWallet?.balance || 0).toLocaleString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="profits-withdraw-amount">Amount</Label>
                      <Input id="profits-withdraw-amount" type="number" placeholder="Enter amount"
                        value={withdrawProfitsAmount} onChange={(e) => setWithdrawProfitsAmount(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="profits-withdraw-reason">Reason (optional)</Label>
                      <Input id="profits-withdraw-reason" placeholder="Enter reason for withdrawal"
                        value={withdrawProfitsReason} onChange={(e) => setWithdrawProfitsReason(e.target.value)} />
                    </div>
                    <Button onClick={() => {
                      withdrawProfitsMutation.mutate({ amount: parseInt(withdrawProfitsAmount), reason: withdrawProfitsReason });
                      setWithdrawProfitsAmount(""); setWithdrawProfitsReason("");
                    }}
                      disabled={!withdrawProfitsAmount || withdrawProfitsMutation.isPending} className="w-full">
                      {withdrawProfitsMutation.isPending ? "Withdrawing..." : "Withdraw from Profits"}
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
                            {(tx.amount ?? 0).toLocaleString()}
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
                You have view-only access. Contact platform management for elevated permissions.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AdminWallet;
