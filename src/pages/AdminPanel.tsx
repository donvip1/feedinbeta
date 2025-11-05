import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft, Users, TrendingUp, DollarSign, Gift, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function AdminPanel() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [grantAmount, setGrantAmount] = useState("");
  const [grantReason, setGrantReason] = useState("");

  // Check if user is admin
  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user?.id)
        .eq("role", "admin")
        .single();

      return !!data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) {
      navigate("/auth");
    } else if (isAdmin === false) {
      toast({
        title: "Access Denied",
        description: "You don't have admin permissions",
        variant: "destructive",
      });
      navigate("/");
    }
  }, [user, isAdmin, navigate, toast]);

  // Fetch all users with profiles
  const { data: users } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          *,
          user_credits!user_credits_user_id_fkey (balance, total_earned, total_spent),
          user_subscriptions!user_subscriptions_user_id_fkey (
            status,
            subscription_tiers (name)
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: isAdmin === true,
  });

  // Fetch analytics
  const { data: analytics } = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: async () => {
      const { count: userCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      const { data: transactions } = await supabase
        .from("credit_transactions")
        .select("amount, type")
        .eq("type", "purchase");

      const totalRevenue = transactions?.reduce((sum, t) => sum + t.amount, 0) || 0;

      const { count: activeSubscriptions } = await supabase
        .from("user_subscriptions")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");

      return {
        totalUsers: userCount || 0,
        totalRevenue,
        activeSubscriptions: activeSubscriptions || 0,
      };
    },
    enabled: isAdmin === true,
  });

  // Grant credits mutation
  const grantCreditsMutation = useMutation({
    mutationFn: async ({ userId, amount, reason }: { userId: string; amount: number; reason: string }) => {
      const { data, error } = await supabase.rpc("admin_grant_credits", {
        target_user_id: userId,
        credit_amount: amount,
        reason,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Credits Granted",
        description: "Credits have been successfully granted to the user",
      });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setSelectedUser(null);
      setGrantAmount("");
      setGrantReason("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleGrantCredits = () => {
    if (!selectedUser || !grantAmount) return;
    
    grantCreditsMutation.mutate({
      userId: selectedUser,
      amount: parseInt(grantAmount),
      reason: grantReason || "Admin bonus",
    });
  };

  const filteredUsers = users?.filter(
    (u) =>
      u.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container mx-auto p-4 max-w-7xl">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Admin Panel</h1>
            <p className="text-muted-foreground">Manage users, subscriptions, and analytics</p>
          </div>
        </div>

        {/* Analytics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics?.totalUsers || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${analytics?.totalRevenue || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics?.activeSubscriptions || 0}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="users" className="space-y-4">
          <TabsList>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="credits">Credit Management</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>All Users</CardTitle>
                <CardDescription>View and manage all registered users</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Credits</TableHead>
                        <TableHead>Subscription</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers?.map((user) => {
                        const credits = Array.isArray(user.user_credits) && user.user_credits.length > 0
                          ? user.user_credits[0]
                          : null;
                        const subscription = Array.isArray(user.user_subscriptions) && user.user_subscriptions.length > 0
                          ? user.user_subscriptions[0]
                          : null;
                        
                        return (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <img
                                src={user.avatar_url || "/placeholder.svg"}
                                alt={user.display_name || "User"}
                                className="w-8 h-8 rounded-full"
                              />
                              <div>
                                <p className="font-medium">{user.display_name}</p>
                                <p className="text-xs text-muted-foreground">@{user.username}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {credits?.balance || 0}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {subscription?.subscription_tiers && typeof subscription.subscription_tiers === 'object' && 'name' in subscription.subscription_tiers
                                ? String(subscription.subscription_tiers.name)
                                : "Free"}
                            </Badge>
                          </TableCell>
                          <TableCell>{format(new Date(user.created_at), "MMM dd, yyyy")}</TableCell>
                          <TableCell>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setSelectedUser(user.id)}
                                >
                                  <Gift className="h-4 w-4 mr-1" />
                                  Grant Credits
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Grant Credits</DialogTitle>
                                  <DialogDescription>
                                    Grant bonus credits to {user.display_name}
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div>
                                    <Label>Amount</Label>
                                    <Input
                                      type="number"
                                      placeholder="Enter credit amount"
                                      value={grantAmount}
                                      onChange={(e) => setGrantAmount(e.target.value)}
                                    />
                                  </div>
                                  <div>
                                    <Label>Reason (Optional)</Label>
                                    <Input
                                      placeholder="e.g., Loyalty bonus"
                                      value={grantReason}
                                      onChange={(e) => setGrantReason(e.target.value)}
                                    />
                                  </div>
                                  <Button
                                    onClick={handleGrantCredits}
                                    disabled={!grantAmount || grantCreditsMutation.isPending}
                                    className="w-full"
                                  >
                                    {grantCreditsMutation.isPending ? "Granting..." : "Grant Credits"}
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="credits" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Credit Package Promotions</CardTitle>
                <CardDescription>Manage credit package promotions and discounts</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Promotion management coming soon. Configure promotions directly in the credit_packages table.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
