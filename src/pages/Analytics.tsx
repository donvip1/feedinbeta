import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, Users, Heart, MessageCircle, Eye } from 'lucide-react';
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
  ResponsiveContainer,
} from 'recharts';

interface AnalyticsData {
  date: string;
  followers: number;
  following: number;
  posts: number;
  likes: number;
  comments: number;
  views: number;
}

interface PostPerformance {
  id: string;
  content: string;
  created_at: string;
  views: number;
  likes: number;
  comments: number;
  engagement_rate: number;
}

export default function Analytics() {
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData[]>([]);
  const [topPosts, setTopPosts] = useState<PostPerformance[]>([]);
  const [stats, setStats] = useState({
    totalFollowers: 0,
    totalPosts: 0,
    totalLikes: 0,
    avgEngagement: 0,
  });

  useEffect(() => {
    if (user) {
      loadAnalytics();
      loadTopPosts();
      loadStats();
    }
  }, [user, timeRange]);

  const loadAnalytics = async () => {
    if (!user) return;

    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .from('user_analytics')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (data) {
      setAnalyticsData(
        data.map((d) => ({
          date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          followers: d.followers_count,
          following: d.following_count,
          posts: d.posts_count,
          likes: d.total_likes,
          comments: d.total_comments,
          views: d.profile_views,
        }))
      );
    }
  };

  const loadTopPosts = async () => {
    if (!user) return;

    const { data: posts, error } = await supabase
      .from('posts')
      .select(`
        id,
        content,
        created_at,
        likes_count,
        comments_count,
        post_analytics (views, likes, comments)
      `)
      .eq('user_id', user.id)
      .order('likes_count', { ascending: false })
      .limit(10);

    if (posts) {
      setTopPosts(
        posts.map((post: any) => {
          const analytics = post.post_analytics?.[0] || { views: 0, likes: 0, comments: 0 };
          const totalEngagements = analytics.likes + analytics.comments;
          const engagementRate = analytics.views > 0 ? (totalEngagements / analytics.views) * 100 : 0;

          return {
            id: post.id,
            content: post.content?.slice(0, 100) || '',
            created_at: post.created_at,
            views: analytics.views,
            likes: post.likes_count,
            comments: post.comments_count,
            engagement_rate: engagementRate,
          };
        })
      );
    }
  };

  const loadStats = async () => {
    if (!user) return;

    // Get follower count
    const { count: followersCount } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', user.id);

    // Get posts count
    const { count: postsCount } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    // Get total likes
    const { data: posts } = await supabase
      .from('posts')
      .select('likes_count')
      .eq('user_id', user.id);

    const totalLikes = posts?.reduce((sum, post) => sum + (post.likes_count || 0), 0) || 0;
    const avgEngagement = postsCount ? totalLikes / postsCount : 0;

    setStats({
      totalFollowers: followersCount || 0,
      totalPosts: postsCount || 0,
      totalLikes,
      avgEngagement: Math.round(avgEngagement),
    });
  };

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Analytics Dashboard</h1>
        <p className="text-muted-foreground">Track your performance and audience insights</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Followers</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalFollowers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Your audience size</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPosts}</div>
            <p className="text-xs text-muted-foreground">Content created</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Likes</CardTitle>
            <Heart className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalLikes.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Total engagement</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Engagement</CardTitle>
            <MessageCircle className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgEngagement}</div>
            <p className="text-xs text-muted-foreground">Likes per post</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="growth" className="space-y-4">
        <TabsList>
          <TabsTrigger value="growth">Growth</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
          <TabsTrigger value="top-posts">Top Posts</TabsTrigger>
        </TabsList>

        <TabsContent value="growth" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Follower Growth</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={analyticsData}>
                  <defs>
                    <linearGradient id="colorFollowers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                  <Area type="monotone" dataKey="followers" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorFollowers)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="engagement" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Engagement Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analyticsData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                  <Legend />
                  <Line type="monotone" dataKey="likes" stroke="hsl(var(--primary))" strokeWidth={2} />
                  <Line type="monotone" dataKey="comments" stroke="hsl(var(--secondary))" strokeWidth={2} />
                  <Line type="monotone" dataKey="views" stroke="hsl(var(--accent))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="top-posts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Performing Posts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topPosts.map((post, index) => (
                  <div key={post.id} className="flex items-start gap-4 p-4 border border-border rounded-lg">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{post.content}</p>
                      <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" /> {post.views}
                        </span>
                        <span className="flex items-center gap-1">
                          <Heart className="w-3 h-3" /> {post.likes}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="w-3 h-3" /> {post.comments}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold">{post.engagement_rate.toFixed(1)}%</div>
                      <div className="text-xs text-muted-foreground">Engagement</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
