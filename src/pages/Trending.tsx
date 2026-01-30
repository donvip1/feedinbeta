import { useState, useEffect, useCallback } from 'react';
import { TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import PostCard from '@/components/feed/PostCard';
import { Skeleton } from '@/components/ui/skeleton';
import { useViewedPosts } from '@/hooks/useViewedPosts';
import { PageHeader } from '@/components/shared/PageHeader';
import { BottomNav } from '@/components/navigation/BottomNav';
import { useFeedAds, injectAdsIntoPosts } from '@/hooks/useFeedAds';
import { useAuth } from '@/hooks/useAuth';

// Fisher-Yates shuffle with seed for consistent randomization per session
const seededShuffle = <T,>(array: T[], seed: number): T[] => {
  const result = [...array];
  let currentSeed = seed;
  
  const random = () => {
    currentSeed = (currentSeed * 9301 + 49297) % 233280;
    return currentSeed / 233280;
  };
  
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  
  return result;
};

const TrendingContent = () => {
  const [posts, setPosts] = useState<any[]>([]);
  const [displayPosts, setDisplayPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionKey] = useState(() => Date.now()); // New session = new random order
  const { viewedPostIds, markAsViewed } = useViewedPosts();
  const { user } = useAuth();
  const { data: feedAds } = useFeedAds();

  const loadTrending = useCallback(async () => {
    try {
      // Get active promotions with promoter info
      const { data: promotions } = await supabase
        .from('post_promotions')
        .select('post_id, boost_level, user_id')
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString());

      const promotedPostIds = new Set(promotions?.map(p => p.post_id) || []);
      const promotionData: Record<string, { boost_level: string; promoter_id: string }> = {};
      promotions?.forEach(p => { 
        promotionData[p.post_id] = { 
          boost_level: p.boost_level, 
          promoter_id: p.user_id 
        }; 
      });

      // Get promoter names
      const promoterIds = [...new Set(promotions?.map(p => p.user_id) || [])];
      let promoterMap = new Map<string, string>();
      if (promoterIds.length > 0) {
        const { data: promoters } = await supabase
          .from('profiles')
          .select('id, display_name, username')
          .in('id', promoterIds);
        promoterMap = new Map((promoters || []).map(p => [p.id, p.display_name || p.username || 'Unknown']));
      }

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
        .limit(100);

      if (error) throw error;
      
      const allPosts = (data || []).map(post => {
        const promoterId = promotionData[post.id]?.promoter_id || null;
        return {
          ...post,
          _isPromoted: promotedPostIds.has(post.id),
          _boostLevel: promotionData[post.id]?.boost_level || null,
          _promoterId: promoterId,
          _promoterName: promoterId 
            ? promoterMap.get(promoterId) || null 
            : null
        };
      });
      
      // Separate unviewed and viewed (for prioritization, not exclusion)
      const unviewedPosts = allPosts.filter(p => !viewedPostIds.includes(p.id));
      const viewedPosts = allPosts.filter(p => viewedPostIds.includes(p.id));

      // Get promoted posts (always first) - ULTIMATE PRIORITY
      const promotedUnviewed = unviewedPosts.filter(p => p._isPromoted);
      const promotedViewed = viewedPosts.filter(p => p._isPromoted);
      const regularUnviewed = unviewedPosts.filter(p => !p._isPromoted);
      const regularViewed = viewedPosts.filter(p => !p._isPromoted);

      // Sort promoted by boost level (higher boost = higher priority)
      const getBoostPriority = (boostLevel: string | null) => {
        if (!boostLevel) return 1;
        if (boostLevel.toLowerCase().includes('elite')) return 5;
        if (boostLevel.toLowerCase().includes('premium')) return 4;
        if (boostLevel.toLowerCase().includes('pro')) return 3;
        if (boostLevel.toLowerCase().includes('basic')) return 2;
        return 1;
      };
      
      const sortByBoost = (posts: typeof allPosts) => {
        return posts.sort((a, b) => getBoostPriority(b._boostLevel) - getBoostPriority(a._boostLevel));
      };

      // Build final list: promoted first (by boost level), then randomized unviewed, then randomized viewed
      // Each session gets a different random order (TikTok-style)
      const finalPosts = [
        ...sortByBoost(promotedUnviewed),
        ...sortByBoost(promotedViewed),
        ...seededShuffle(regularUnviewed, sessionKey),
        ...seededShuffle(regularViewed, sessionKey + 1)
      ].slice(0, 50);

      setPosts(finalPosts);
    } catch (error) {
      console.error('Error loading trending:', error);
    } finally {
      setLoading(false);
    }
  }, [sessionKey, viewedPostIds]);

  useEffect(() => {
    loadTrending();
  }, [loadTrending]);

  // Inject ads when posts or ads change
  useEffect(() => {
    if (posts.length > 0) {
      const postsWithAds = feedAds && feedAds.length > 0
        ? injectAdsIntoPosts(posts, feedAds as any, 4)
        : posts;
      setDisplayPosts(postsWithAds);
    } else {
      setDisplayPosts([]);
    }
  }, [posts, feedAds]);

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
      {displayPosts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No trending posts yet</p>
        </div>
      ) : (
        displayPosts.map((post) => (
          <PostCard 
            key={post.id} 
            post={post}
            isPromoted={post._isPromoted || post._isSponsored || false}
            promoterName={post._promoterId === user?.id ? 'me' : post._promoterName}
            boostLevel={post._boostLevel}
            onView={() => markAsViewed(post.id)}
          />
        ))
      )}
    </div>
  );
};

const Trending = () => {
  return (
    <>
      <div className="min-h-screen bg-background pb-20">
        <PageHeader 
          title="Trending" 
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <TrendingContent />
      </div>
      <BottomNav />
    </>
  );
};

export default Trending;
