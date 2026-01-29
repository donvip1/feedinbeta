import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface FeedAd {
  id: string;
  title: string;
  description: string | null;
  media_url: string;
  media_type: string | null;
  click_url: string | null;
  target_genders: string[] | null;
  target_age_min: number | null;
  target_age_max: number | null;
  target_interests: string[] | null;
  target_countries: string[] | null;
  target_cities: string[] | null;
  daily_budget_credits: number | null;
  spent_credits: number | null;
  impressions: number | null;
  clicks: number | null;
}

export const useFeedAds = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['feed-ads', user?.id],
    queryFn: async () => {
      // Fetch active ads with budget remaining
      const { data: ads, error } = await supabase
        .from('feed_ads')
        .select('*')
        .eq('is_active', true)
        .eq('approval_status', 'approved')
        .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
        .order('impressions', { ascending: true }) // Show less-viewed ads first
        .limit(10);

      if (error) {
        console.error('Error fetching feed ads:', error);
        return [];
      }

      // Filter ads that still have budget
      const availableAds = (ads || []).filter(ad => {
        const budget = ad.daily_budget_credits || 0;
        const spent = ad.spent_credits || 0;
        return budget > spent;
      });

      // Get ads user hasn't seen today
      if (user && availableAds.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        const { data: impressions } = await supabase
          .from('ad_impressions')
          .select('ad_id')
          .eq('user_id', user.id)
          .gte('created_at', today);

        const seenAdIds = new Set(impressions?.map(i => i.ad_id) || []);
        
        // Prioritize unseen ads
        const unseenAds = availableAds.filter(ad => !seenAdIds.has(ad.id));
        const seenAds = availableAds.filter(ad => seenAdIds.has(ad.id));
        
        return [...unseenAds, ...seenAds];
      }

      return availableAds;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });
};

// Track ad impression
export const trackAdImpression = async (userId: string, adId: string) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Check if impression exists for today
    const { data: existing } = await supabase
      .from('ad_impressions')
      .select('id, impressions_count')
      .eq('user_id', userId)
      .eq('ad_id', adId)
      .eq('impression_date', today)
      .maybeSingle();

    if (existing) {
      // Update existing impression count
      await supabase
        .from('ad_impressions')
        .update({ impressions_count: (existing.impressions_count || 0) + 1 })
        .eq('id', existing.id);
    } else {
      // Insert new impression
      await supabase.from('ad_impressions').insert({
        user_id: userId,
        ad_id: adId,
        impression_date: today,
        impressions_count: 1,
      });
    }

    // Increment ad impressions count directly
    const { data: ad } = await supabase
      .from('feed_ads')
      .select('impressions')
      .eq('id', adId)
      .single();

    if (ad) {
      await supabase
        .from('feed_ads')
        .update({ impressions: (ad.impressions || 0) + 1 })
        .eq('id', adId);
    }
  } catch (error) {
    console.error('Error tracking ad impression:', error);
  }
};

// Track ad click
export const trackAdClick = async (userId: string, adId: string) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Update clicked status
    await supabase
      .from('ad_impressions')
      .update({ clicked: true })
      .eq('user_id', userId)
      .eq('ad_id', adId)
      .eq('impression_date', today);

    // Increment ad clicks count directly
    const { data: ad } = await supabase
      .from('feed_ads')
      .select('clicks')
      .eq('id', adId)
      .single();

    if (ad) {
      await supabase
        .from('feed_ads')
        .update({ clicks: (ad.clicks || 0) + 1 })
        .eq('id', adId);
    }
  } catch (error) {
    console.error('Error tracking ad click:', error);
  }
};

// Helper to inject ads into post feed
export const injectAdsIntoPosts = (
  posts: any[],
  ads: FeedAd[],
  adInterval: number = 4 // Show ad every N posts
): any[] => {
  if (!ads || ads.length === 0) return posts;
  
  const result: any[] = [];
  let adIndex = 0;

  posts.forEach((post, index) => {
    result.push(post);
    
    // Insert ad after every N posts (excluding the first few)
    if ((index + 1) % adInterval === 0 && index >= 2 && adIndex < ads.length) {
      const ad = ads[adIndex];
      result.push({
        id: `ad-${ad.id}`,
        _isAd: true,
        _adData: {
          ad_id: ad.id,
          title: ad.title,
          description: ad.description,
          media_url: ad.media_url,
          media_type: ad.media_type || 'image',
          click_url: ad.click_url,
        },
        // Make it look like a post for consistent rendering
        user_id: 'ad',
        content: ad.description,
        media_url: ad.media_url,
        media_type: ad.media_type || 'image',
        created_at: new Date().toISOString(),
        likes_count: 0,
        comments_count: 0,
        views_count: ad.impressions || 0,
        _isPromoted: true,
        _isSponsored: true,
        profiles: {
          username: 'sponsored',
          display_name: ad.title,
          avatar_url: null,
        }
      });
      adIndex = (adIndex + 1) % ads.length; // Cycle through ads
    }
  });

  return result;
};
