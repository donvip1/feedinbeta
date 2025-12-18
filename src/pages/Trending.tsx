import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { BottomNav } from '@/components/navigation/BottomNav';
import { TrendingUp, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import PostCard from '@/components/feed/PostCard';
import { Skeleton } from '@/components/ui/skeleton';
import { useViewedPosts } from '@/hooks/useViewedPosts';

const TrendingContent = () => {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { viewedPostIds, markAsViewed } = useViewedPosts();

  useEffect(() => {
    loadTrending();
  }, [viewedPostIds.length]);

  const loadTrending = async () => {
    try {
      // Get active promotions
      const { data: promotions } = await supabase
        .from('post_promotions')
        .select('post_id, boost_level')
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString());

      const promotedPostIds = new Set(promotions?.map(p => p.post_id) || []);
      const promotionLevels: Record<string, string> = {};
      promotions?.forEach(p => { promotionLevels[p.post_id] = p.boost_level; });

      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles:user_id (
            username,
            display_name,
            avatar_url
          )
        `)
        .eq('status', 'active')
        .order('likes_count', { ascending: false })
        .order('views_count', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      const allPosts = data || [];
      
      // Separate unviewed and viewed
      const unviewedPosts = allPosts.filter(p => !viewedPostIds.includes(p.id));
      const viewedPosts = allPosts.filter(p => viewedPostIds.includes(p.id));

      // Sort by promotion priority, then by engagement
      const sortByPriority = (posts: typeof allPosts) => {
        return posts.sort((a, b) => {
          const aPriority = promotedPostIds.has(a.id) 
            ? (promotionLevels[a.id] === 'premium' ? 3 : promotionLevels[a.id] === 'standard' ? 2 : 1) 
            : 0;
          const bPriority = promotedPostIds.has(b.id) 
            ? (promotionLevels[b.id] === 'premium' ? 3 : promotionLevels[b.id] === 'standard' ? 2 : 1) 
            : 0;
          
          if (aPriority !== bPriority) return bPriority - aPriority;
          return (b.likes_count || 0) - (a.likes_count || 0);
        });
      };

      let finalPosts = sortByPriority(unviewedPosts);
      if (finalPosts.length < 20 && viewedPosts.length > 0) {
        finalPosts = [...finalPosts, ...sortByPriority(viewedPosts)];
      }

      setPosts(finalPosts.slice(0, 20));
    } catch (error) {
      console.error('Error loading trending:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-2xl space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-card rounded-lg p-4 border">
            <Skeleton className="h-64 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl space-y-4">
      {posts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No trending posts yet</p>
        </div>
      ) : (
        posts.map((post) => (
          <PostCard 
            key={post.id} 
            post={post} 
            onView={() => markAsViewed(post.id)}
          />
        ))
      )}
    </div>
  );
};

const Trending = () => {
  const navigate = useNavigate();

  return (
    <>
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Button
                  onClick={() => navigate('/feed')}
                  variant="ghost"
                  size="icon"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <TrendingUp className="w-6 h-6 text-primary" />
                  Trending
                </h1>
              </div>
            </div>
          </div>
        </header>

        <TrendingContent />
      </div>
      <BottomNav />
    </>
  );
};

export default Trending;
