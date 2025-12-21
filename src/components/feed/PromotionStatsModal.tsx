import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { Eye, Heart, MessageCircle, Clock, Sparkles, TrendingUp, BarChart3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { formatDistanceToNow, differenceInHours } from 'date-fns';

interface PromotionStatsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
}

interface PromotionStats {
  id: string;
  credits_spent: number;
  boost_level: string;
  expires_at: string;
  created_at: string;
  is_active: boolean;
  impressions: number;
  clicks: number;
  post: {
    views_count: number;
    likes_count: number;
    comments_count: number;
  };
}

export default function PromotionStatsModal({ open, onOpenChange, postId }: PromotionStatsModalProps) {
  const [stats, setStats] = useState<PromotionStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !postId) return;

    const fetchStats = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('post_promotions')
          .select(`
            id,
            credits_spent,
            boost_level,
            expires_at,
            created_at,
            is_active,
            impressions,
            clicks,
            post:posts (
              views_count,
              likes_count,
              comments_count
            )
          `)
          .eq('post_id', postId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (!error && data) {
          setStats(data as any);
        }
      } catch (error) {
        console.error('Error fetching promotion stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [open, postId]);

  const isActive = stats ? new Date(stats.expires_at) > new Date() : false;
  const hoursRemaining = stats ? Math.max(0, differenceInHours(new Date(stats.expires_at), new Date())) : 0;
  const totalHours = stats ? differenceInHours(new Date(stats.expires_at), new Date(stats.created_at)) : 1;
  const progressPercent = stats ? Math.min(100, ((totalHours - hoursRemaining) / totalHours) * 100) : 0;

  const engagementRate = stats?.post 
    ? ((stats.post.likes_count + stats.post.comments_count) / Math.max(stats.post.views_count, 1) * 100).toFixed(1)
    : '0';

  const boostLevelColors: Record<string, string> = {
    basic: 'bg-blue-500',
    standard: 'bg-purple-500',
    premium: 'bg-amber-500',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Promotion Statistics
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4 py-4">
            <div className="animate-pulse space-y-3">
              <div className="h-20 bg-muted rounded-lg" />
              <div className="h-16 bg-muted rounded-lg" />
              <div className="h-16 bg-muted rounded-lg" />
            </div>
          </div>
        ) : stats ? (
          <div className="space-y-4 py-2">
            {/* Status & Boost Level */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge 
                  variant={isActive ? "default" : "secondary"}
                  className={isActive ? 'bg-emerald-500' : ''}
                >
                  {isActive ? 'Active' : 'Ended'}
                </Badge>
                <Badge 
                  variant="outline" 
                  className={`${boostLevelColors[stats.boost_level]} text-white border-0`}
                >
                  {stats.boost_level.charAt(0).toUpperCase() + stats.boost_level.slice(1)}
                </Badge>
              </div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Sparkles className="w-4 h-4" />
                {stats.credits_spent} credits
              </div>
            </div>

            {/* Time Remaining */}
            {isActive && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    Time remaining
                  </span>
                  <span className="font-medium">{hoursRemaining}h left</span>
                </div>
                <Progress value={progressPercent} className="h-2" />
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Eye className="w-4 h-4" />
                  <span className="text-xs">Views</span>
                </div>
                <p className="text-2xl font-bold">{stats.post?.views_count || 0}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-xs">Impressions</span>
                </div>
                <p className="text-2xl font-bold">{stats.impressions || 0}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Heart className="w-4 h-4" />
                  <span className="text-xs">Likes</span>
                </div>
                <p className="text-2xl font-bold">{stats.post?.likes_count || 0}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <MessageCircle className="w-4 h-4" />
                  <span className="text-xs">Comments</span>
                </div>
                <p className="text-2xl font-bold">{stats.post?.comments_count || 0}</p>
              </div>
            </div>

            {/* Engagement Rate */}
            <div className="bg-primary/10 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Engagement Rate</span>
                <span className="text-lg font-bold text-primary">{engagementRate}%</span>
              </div>
            </div>

            {/* Duration Info */}
            <div className="text-xs text-muted-foreground text-center">
              Started {formatDistanceToNow(new Date(stats.created_at), { addSuffix: true })}
              {!isActive && ` • Ended ${formatDistanceToNow(new Date(stats.expires_at), { addSuffix: true })}`}
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No promotion data found</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
