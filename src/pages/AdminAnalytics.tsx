import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ArrowLeft, 
  Users, 
  FileText, 
  Coins, 
  TrendingUp,
  Calendar,
  Download,
  RefreshCw,
  Activity,
  DollarSign,
  Gift,
  Eye,
  Radio
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(142, 76%, 36%)', 'hsl(48, 96%, 53%)', 'hsl(280, 87%, 65%)'];

const AdminAnalytics = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState('30');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Check admin access
  const { data: isAdmin, isLoading: isCheckingAdmin } = useQuery({
    queryKey: ['admin-check', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('can_view_admin_wallet');
      if (error) return false;
      return data as boolean;
    },
    enabled: !!user
  });

  useEffect(() => {
    if (!isCheckingAdmin && !isAdmin && user) {
      navigate('/feed');
    }
  }, [isAdmin, isCheckingAdmin, user, navigate]);

  // Fetch total users
  const { data: totalUsers, refetch: refetchUsers } = useQuery({
    queryKey: ['admin-total-users'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      if (error) throw error;
      return count || 0;
    },
    enabled: !!isAdmin
  });

  // Fetch total posts
  const { data: totalPosts, refetch: refetchPosts } = useQuery({
    queryKey: ['admin-total-posts'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true });
      if (error) throw error;
      return count || 0;
    },
    enabled: !!isAdmin
  });

  // Fetch credit transactions summary
  const { data: creditStats, refetch: refetchCredits } = useQuery({
    queryKey: ['admin-credit-stats', dateRange],
    queryFn: async () => {
      const startDate = subDays(new Date(), parseInt(dateRange));
      const { data, error } = await supabase
        .from('credit_transactions')
        .select('amount, type, created_at')
        .gte('created_at', startDate.toISOString());
      
      if (error) throw error;
      
      const totalVolume = data?.reduce((sum, tx) => sum + Math.abs(tx.amount), 0) || 0;
      const purchases = data?.filter(tx => tx.type === 'purchase').reduce((sum, tx) => sum + tx.amount, 0) || 0;
      const gifts = data?.filter(tx => tx.type === 'gift_sent' || tx.type === 'gift_received').length || 0;
      
      return { totalVolume, purchases, gifts, transactions: data || [] };
    },
    enabled: !!isAdmin
  });

  // Fetch daily active users estimate (using profiles updated_at)
  const { data: activeUsers, refetch: refetchActive } = useQuery({
    queryKey: ['admin-active-users', dateRange],
    queryFn: async () => {
      const today = new Date();
      const yesterday = subDays(today, 1);
      const last7Days = subDays(today, 7);
      const last30Days = subDays(today, 30);

      // DAU - profiles updated today
      const { count: dau } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('updated_at', startOfDay(today).toISOString());

      // WAU - profiles updated in last 7 days
      const { count: wau } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('updated_at', last7Days.toISOString());

      // MAU - profiles updated in last 30 days
      const { count: mau } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('updated_at', last30Days.toISOString());

      return { dau: dau || 0, wau: wau || 0, mau: mau || 0 };
    },
    enabled: !!isAdmin
  });

  // Fetch live stream stats
  const { data: liveStats, refetch: refetchLive } = useQuery({
    queryKey: ['admin-live-stats'],
    queryFn: async () => {
      const { count: totalStreams } = await supabase
        .from('live_streams')
        .select('*', { count: 'exact', head: true });

      const { count: activeStreams } = await supabase
        .from('live_streams')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'live');

      const { data: viewerData } = await supabase
        .from('live_streams')
        .select('peak_viewers')
        .order('peak_viewers', { ascending: false })
        .limit(1);

      return {
        total: totalStreams || 0,
        active: activeStreams || 0,
        peakViewers: viewerData?.[0]?.peak_viewers || 0
      };
    },
    enabled: !!isAdmin
  });

  // Fetch daily transaction data for charts
  const { data: dailyData, refetch: refetchDaily } = useQuery({
    queryKey: ['admin-daily-data', dateRange],
    queryFn: async () => {
      const startDate = subDays(new Date(), parseInt(dateRange));
      const { data, error } = await supabase
        .from('credit_transactions')
        .select('amount, type, created_at')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Group by day
      const grouped: Record<string, { date: string; volume: number; count: number; purchases: number; gifts: number }> = {};
      
      data?.forEach(tx => {
        const date = format(new Date(tx.created_at), 'MMM dd');
        if (!grouped[date]) {
          grouped[date] = { date, volume: 0, count: 0, purchases: 0, gifts: 0 };
        }
        grouped[date].volume += Math.abs(tx.amount);
        grouped[date].count += 1;
        if (tx.type === 'purchase') grouped[date].purchases += tx.amount;
        if (tx.type === 'gift_sent' || tx.type === 'gift_received') grouped[date].gifts += 1;
      });

      return Object.values(grouped);
    },
    enabled: !!isAdmin
  });

  // Revenue breakdown for pie chart
  const { data: revenueBreakdown, refetch: refetchRevenue } = useQuery({
    queryKey: ['admin-revenue-breakdown'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('credit_transactions')
        .select('type, amount');

      if (error) throw error;

      const breakdown: Record<string, number> = {};
      data?.forEach(tx => {
        const type = tx.type || 'other';
        if (!breakdown[type]) breakdown[type] = 0;
        breakdown[type] += Math.abs(tx.amount);
      });

      return Object.entries(breakdown).map(([name, value]) => ({
        name: name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        value
      })).sort((a, b) => b.value - a.value).slice(0, 5);
    },
    enabled: !!isAdmin
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      refetchUsers(),
      refetchPosts(),
      refetchCredits(),
      refetchActive(),
      refetchLive(),
      refetchDaily(),
      refetchRevenue()
    ]);
    setIsRefreshing(false);
  };

  const handleExport = () => {
    const data = {
      exportDate: new Date().toISOString(),
      dateRange: `Last ${dateRange} days`,
      metrics: {
        totalUsers,
        totalPosts,
        dau: activeUsers?.dau,
        wau: activeUsers?.wau,
        mau: activeUsers?.mau,
        creditVolume: creditStats?.totalVolume,
        totalGifts: creditStats?.gifts
      },
      liveStreaming: liveStats,
      dailyTransactions: dailyData
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `feedin-analytics-${format(new Date(), 'yyyy-MM-dd')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isCheckingAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center justify-between p-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Analytics Dashboard</h1>
          </div>
          <div className="flex items-center gap-2">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-32">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 pb-24 space-y-6">
        {/* Key Metrics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Users</p>
                  <p className="text-3xl font-bold text-blue-500">{totalUsers?.toLocaleString() || 0}</p>
                </div>
                <Users className="h-10 w-10 text-blue-500/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">DAU / MAU</p>
                  <p className="text-3xl font-bold text-green-500">
                    {activeUsers?.dau?.toLocaleString() || 0} / {activeUsers?.mau?.toLocaleString() || 0}
                  </p>
                </div>
                <Activity className="h-10 w-10 text-green-500/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Posts</p>
                  <p className="text-3xl font-bold text-purple-500">{totalPosts?.toLocaleString() || 0}</p>
                </div>
                <FileText className="h-10 w-10 text-purple-500/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Credit Volume</p>
                  <p className="text-3xl font-bold text-amber-500">{creditStats?.totalVolume?.toLocaleString() || 0}</p>
                </div>
                <Coins className="h-10 w-10 text-amber-500/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">WAU</p>
                  <p className="text-xl font-bold">{activeUsers?.wau?.toLocaleString() || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-pink-500/10">
                  <Gift className="h-5 w-5 text-pink-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Gifts Sent</p>
                  <p className="text-xl font-bold">{creditStats?.gifts?.toLocaleString() || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <Radio className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Live Streams</p>
                  <p className="text-xl font-bold">{liveStats?.active || 0} / {liveStats?.total || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-500/10">
                  <Eye className="h-5 w-5 text-cyan-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Peak Viewers</p>
                  <p className="text-xl font-bold">{liveStats?.peakViewers?.toLocaleString() || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <Tabs defaultValue="transactions" className="space-y-4">
          <TabsList>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="engagement">Engagement</TabsTrigger>
          </TabsList>

          <TabsContent value="transactions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Coins className="h-5 w-5 text-primary" />
                  Credit Transaction Volume
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyData || []}>
                      <defs>
                        <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }} 
                      />
                      <Area 
                        type="monotone" 
                        dataKey="volume" 
                        stroke="hsl(var(--primary))" 
                        fill="url(#volumeGradient)" 
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Daily Transaction Count</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyData || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }} 
                      />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="revenue" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-green-500" />
                    Revenue Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={revenueBreakdown || []}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {revenueBreakdown?.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }} 
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Purchases vs Gifts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dailyData || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }} 
                        />
                        <Legend />
                        <Bar dataKey="purchases" fill="hsl(142, 76%, 36%)" name="Purchases" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="gifts" fill="hsl(var(--accent))" name="Gifts" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="engagement" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  User Engagement Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 rounded-lg bg-secondary/50">
                    <p className="text-3xl font-bold text-primary">{activeUsers?.dau || 0}</p>
                    <p className="text-sm text-muted-foreground">Daily Active</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-secondary/50">
                    <p className="text-3xl font-bold text-primary">{activeUsers?.wau || 0}</p>
                    <p className="text-sm text-muted-foreground">Weekly Active</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-secondary/50">
                    <p className="text-3xl font-bold text-primary">{activeUsers?.mau || 0}</p>
                    <p className="text-sm text-muted-foreground">Monthly Active</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-secondary/50">
                    <p className="text-3xl font-bold text-primary">
                      {totalUsers && activeUsers?.mau ? ((activeUsers.mau / totalUsers) * 100).toFixed(1) : 0}%
                    </p>
                    <p className="text-sm text-muted-foreground">MAU Rate</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Content Creation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-primary" />
                      <span>Total Posts</span>
                    </div>
                    <span className="text-xl font-bold">{totalPosts?.toLocaleString() || 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
                    <div className="flex items-center gap-3">
                      <Radio className="h-5 w-5 text-red-500" />
                      <span>Total Live Streams</span>
                    </div>
                    <span className="text-xl font-bold">{liveStats?.total || 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
                    <div className="flex items-center gap-3">
                      <Users className="h-5 w-5 text-blue-500" />
                      <span>Posts per User</span>
                    </div>
                    <span className="text-xl font-bold">
                      {totalUsers && totalPosts ? (totalPosts / totalUsers).toFixed(2) : 0}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminAnalytics;
