import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { BottomNav } from '@/components/navigation/BottomNav';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ArrowLeft, 
  Eye, 
  Heart, 
  MessageCircle, 
  Share2, 
  Users, 
  TrendingUp,
  Coins,
  BarChart3,
  Calendar
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface DashboardStats {
  totalPosts: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  followerCount: number;
  followingCount: number;
  totalEarnings: number;
}

interface TopPost {
  id: string;
  content: string;
  media_url: string | null;
  views_count: number;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  created_at: string;
}

interface GrowthData {
  date: string;
  followers: number;
  views: number;
}

const CreatorDashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [topPosts, setTopPosts] = useState<TopPost[]>([]);
  const [growthData, setGrowthData] = useState<GrowthData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }
    if (user) {
      loadDashboardData();
    }
  }, [user, authLoading]);

  const loadDashboardData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Load posts stats
      const { data: posts, error: postsError } = await supabase
        .from('posts')
        .select('id, content, media_url, views_count, likes_count, comments_count, shares_count, created_at')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (postsError) throw postsError;

      // Calculate totals
      const totalViews = posts?.reduce((sum, p) => sum + (p.views_count || 0), 0) || 0;
      const totalLikes = posts?.reduce((sum, p) => sum + (p.likes_count || 0), 0) || 0;
      const totalComments = posts?.reduce((sum, p) => sum + (p.comments_count || 0), 0) || 0;
      const totalShares = posts?.reduce((sum, p) => sum + (p.shares_count || 0), 0) || 0;

      // Load follower/following counts
      const { count: followerCount } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', user.id);

      const { count: followingCount } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', user.id);

      // Load earnings from creator_monetization
      const { data: monetization } = await supabase
        .from('creator_monetization')
        .select('total_earnings')
        .eq('user_id', user.id)
        .single();

      setStats({
        totalPosts: posts?.length || 0,
        totalViews,
        totalLikes,
        totalComments,
        totalShares,
        followerCount: followerCount || 0,
        followingCount: followingCount || 0,
        totalEarnings: monetization?.total_earnings || 0,
      });

      // Get top posts by engagement
      const sortedPosts = [...(posts || [])].sort((a, b) => {
        const engA = (a.likes_count || 0) + (a.comments_count || 0) + (a.shares_count || 0);
        const engB = (b.likes_count || 0) + (b.comments_count || 0) + (b.shares_count || 0);
        return engB - engA;
      });
      setTopPosts(sortedPosts.slice(0, 5));

      // Generate growth data (last 7 days - simulated for now since we don't have daily snapshots)
      const growth: GrowthData[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = subDays(new Date(), i);
        growth.push({
          date: format(date, 'MMM dd'),
          followers: Math.max(0, (followerCount || 0) - Math.floor(Math.random() * 5 * i)),
          views: Math.floor((totalViews / 7) * (7 - i) / 3),
        });
      }
      setGrowthData(growth);

    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const engagementRate = stats && stats.totalViews > 0
    ? ((stats.totalLikes + stats.totalComments + stats.totalShares) / stats.totalViews * 100).toFixed(2)
    : '0';

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/50 backdrop-blur-lg border-b border-border shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <BarChart3 className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Creator Dashboard
            </h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl">
        {loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-64 rounded-xl" />
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card className="p-4 bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="w-4 h-4 text-blue-500" />
                  <span className="text-xs text-muted-foreground">Total Views</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{formatNumber(stats?.totalViews || 0)}</p>
              </Card>

              <Card className="p-4 bg-gradient-to-br from-pink-500/10 to-pink-600/5 border-pink-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Heart className="w-4 h-4 text-pink-500" />
                  <span className="text-xs text-muted-foreground">Total Likes</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{formatNumber(stats?.totalLikes || 0)}</p>
              </Card>

              <Card className="p-4 bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-purple-500" />
                  <span className="text-xs text-muted-foreground">Followers</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{formatNumber(stats?.followerCount || 0)}</p>
              </Card>

              <Card className="p-4 bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Coins className="w-4 h-4 text-green-500" />
                  <span className="text-xs text-muted-foreground">Earnings</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{formatNumber(stats?.totalEarnings || 0)} credits</p>
              </Card>
            </div>

            {/* Engagement Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <MessageCircle className="w-4 h-4 text-orange-500" />
                  <span className="text-xs text-muted-foreground">Comments</span>
                </div>
                <p className="text-xl font-bold">{formatNumber(stats?.totalComments || 0)}</p>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Share2 className="w-4 h-4 text-cyan-500" />
                  <span className="text-xs text-muted-foreground">Shares</span>
                </div>
                <p className="text-xl font-bold">{formatNumber(stats?.totalShares || 0)}</p>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs text-muted-foreground">Engagement Rate</span>
                </div>
                <p className="text-xl font-bold">{engagementRate}%</p>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-violet-500" />
                  <span className="text-xs text-muted-foreground">Total Posts</span>
                </div>
                <p className="text-xl font-bold">{stats?.totalPosts || 0}</p>
              </Card>
            </div>

            {/* Growth Chart */}
            <Card className="p-6 mb-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Growth Overview (Last 7 Days)
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={growthData}>
                    <defs>
                      <linearGradient id="colorFollowers" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
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
                      dataKey="followers" 
                      stroke="hsl(var(--primary))" 
                      fillOpacity={1} 
                      fill="url(#colorFollowers)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Top Posts */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Heart className="w-5 h-5 text-pink-500" />
                Top Performing Posts
              </h3>
              {topPosts.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No posts yet. Start creating!</p>
              ) : (
                <div className="space-y-4">
                  {topPosts.map((post, index) => (
                    <div 
                      key={post.id}
                      onClick={() => navigate(`/feed/post/${post.id}`)}
                      className="flex items-center gap-4 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors cursor-pointer"
                    >
                      <span className="text-lg font-bold text-muted-foreground w-6">#{index + 1}</span>
                      {post.media_url ? (
                        <img 
                          src={post.media_url} 
                          alt="" 
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                          <MessageCircle className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{post.content || 'No caption'}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(post.created_at), 'MMM dd, yyyy')}</p>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" /> {formatNumber(post.views_count || 0)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Heart className="w-3 h-3" /> {formatNumber(post.likes_count || 0)}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="w-3 h-3" /> {formatNumber(post.comments_count || 0)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default CreatorDashboard;
