import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Coins, Users, TrendingUp, Wallet, Send, Plus, History, Shield } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

const AdminWallet = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [mintAmount, setMintAmount] = useState("");
  const [mintReason, setMintReason] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferUserId, setTransferUserId] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawReason, setWithdrawReason] = useState("");

  // Check if user is admin
  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const hasAdminAccess = roles?.some(r => r.role === 'admin' || r.role === 'moderator');
      setIsAdmin(hasAdminAccess || false);
      
      if (!hasAdminAccess) {
        toast.error("Access denied: Admin privileges required");
        navigate("/feed");
      }
    };
    checkAdmin();
  }, [navigate]);

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
    enabled: isAdmin === true,
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
    enabled: isAdmin === true,
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
    enabled: isAdmin === true,
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
    enabled: isAdmin === true,
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
      queryClient.invalidateQueries({ queryKey: ["platform-transactions"] });
      setWithdrawAmount("");
      setWithdrawReason("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to withdraw");
    },
  });

  if (isAdmin === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const circulatingPercent = creditSupply 
    ? ((creditSupply.circulating_supply / creditSupply.total_supply) * 100).toFixed(2) 
    : "0";

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
            <Badge variant="outline" className="ml-auto">Admin Only</Badge>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Wallet className="w-4 h-4 text-primary" />
                Platform Wallet
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-primary">
                {platformWallet?.balance?.toLocaleString() || 0}
              </p>
              <p className="text-xs text-muted-foreground">
                Total earned: {platformWallet?.total_earned?.toLocaleString() || 0}
              </p>
            </CardContent>
          </Card>

          <Card className="border-accent/30 bg-accent/5">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Coins className="w-4 h-4 text-accent" />
                Your Team Wallet
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-accent">
                {teamWallet?.balance?.toLocaleString() || 0}
              </p>
              <p className="text-xs text-muted-foreground">
                Withdrawn: {teamWallet?.total_withdrawn?.toLocaleString() || 0}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <TrendingUp className="w-4 h-4" />
                Credit Supply
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {creditSupply?.circulating_supply?.toLocaleString() || 0}
              </p>
              <p className="text-xs text-muted-foreground">
                {circulatingPercent}% of {creditSupply?.total_supply?.toLocaleString() || 0} total
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Action Tabs */}
        <Tabs defaultValue="mint" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="mint" className="gap-1">
              <Plus className="w-3 h-3" /> Mint
            </TabsTrigger>
            <TabsTrigger value="transfer" className="gap-1">
              <Send className="w-3 h-3" /> Transfer
            </TabsTrigger>
            <TabsTrigger value="withdraw" className="gap-1">
              <Wallet className="w-3 h-3" /> Withdraw
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1">
              <History className="w-3 h-3" /> History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mint" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Mint Credits</CardTitle>
                <CardDescription>
                  Create new credits and add to platform wallet. Max supply: {creditSupply?.total_supply?.toLocaleString()}
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

          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Transaction History</CardTitle>
                <CardDescription>
                  Recent platform wallet transactions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {transactions?.length === 0 && (
                    <p className="text-center text-muted-foreground py-4">No transactions yet</p>
                  )}
                  {transactions?.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div>
                        <p className="font-medium capitalize">{tx.transaction_type.replace('_', ' ')}</p>
                        <p className="text-xs text-muted-foreground">{tx.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(tx.created_at), 'MMM d, yyyy HH:mm')}
                        </p>
                      </div>
                      <Badge variant={tx.transaction_type === 'mint' ? 'default' : 'secondary'}>
                        {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminWallet;
