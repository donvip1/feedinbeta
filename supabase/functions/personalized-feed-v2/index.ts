import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FeedConfig {
  feedType: 'forYou' | 'following' | 'explore';
  mediaFilter: 'all' | 'video' | 'photo';
  limit: number;
  offset: number;
  includeAds: boolean;
  adFrequency: number;
  sessionId?: string;
  isNewSession?: boolean; // True when user returns to app
}

interface Post {
  id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  media_urls: string[] | null;
  media_types: string[] | null;
  created_at: string;
  likes_count: number;
  comments_count: number;
  views_count: number;
  refeeds_count: number;
  location: string | null;
  post_type: string | null;
  original_post_id: string | null;
  is_promoted?: boolean;
  discovery_score?: number;
  is_ad?: boolean;
  is_new_post?: boolean;
  relevance_score?: number;
}

interface Ad {
  ad_id: string;
  title: string;
  description: string | null;
  media_url: string;
  media_type: string;
  click_url: string | null;
  advertiser_name?: string;
  priority?: number;
  is_ad: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const config: FeedConfig = {
      feedType: body.feedType || 'forYou',
      mediaFilter: body.mediaFilter || 'all',
      limit: Math.min(body.limit || 20, 50),
      offset: body.offset || 0,
      includeAds: body.includeAds !== false,
      adFrequency: body.adFrequency || 5,
      sessionId: body.sessionId,
      isNewSession: body.isNewSession || false,
    };

    // =============================================
    // SESSION ROTATION LOGIC
    // When user returns, rotate starting position so they don't see same posts first
    // =============================================
    if (config.isNewSession && config.offset === 0) {
      await supabase.rpc('rotate_feed_session', {
        p_user_id: user.id,
        p_feed_type: config.feedType,
      });
    }

    // =============================================
    // CYCLE RESET CHECK
    // If user has viewed most posts (>90%), reset cycle with randomized order
    // =============================================
    const { data: cycleStatus } = await supabase.rpc('reset_viewed_posts_cycle', { p_user_id: user.id });
    const cycleReset = Array.isArray(cycleStatus) && cycleStatus[0]?.was_reset;

    // =============================================
    // FETCH USER INTERESTS FOR AD TARGETING
    // =============================================
    const { data: userInterests } = await supabase
      .from('user_interests')
      .select('hashtags(name)')
      .eq('user_id', user.id)
      .order('interest_score', { ascending: false })
      .limit(10);

    const interestTags = (userInterests || [])
      .map((i: any) => i.hashtags?.name)
      .filter(Boolean);

    // =============================================
    // FETCH POSTS BASED ON FEED TYPE
    // Uses new enhanced functions with rotation, new-first ordering, viewed exclusion
    // =============================================
    let posts: Post[] = [];
    
    if (cycleReset) {
      // Use randomized order when cycle resets (user has seen most posts)
      const { data } = await supabase.rpc('get_randomized_feed_cycle', {
        p_user_id: user.id,
        p_limit: config.limit,
        p_media_filter: config.mediaFilter,
      });
      posts = (data as any[] || []).map((p: any) => ({
        id: p.id,
        user_id: p.user_id,
        content: p.content,
        media_url: p.media_url,
        media_type: p.media_type,
        media_urls: p.media_urls,
        media_types: p.media_types,
        created_at: p.created_at,
        likes_count: p.likes_count || 0,
        comments_count: p.comments_count || 0,
        views_count: p.views_count || 0,
        refeeds_count: p.refeeds_count || 0,
        location: p.location,
        post_type: p.post_type,
        original_post_id: p.original_post_id,
        is_promoted: p.is_promoted || false,
        is_new_post: false, // Randomized cycle shows all as equal
      }));
    } else if (config.feedType === 'forYou') {
      // Use enhanced rotation feed with new posts first, session awareness
      const { data } = await supabase.rpc('get_feed_with_rotation', {
        p_user_id: user.id,
        p_limit: config.limit,
        p_offset: config.offset,
        p_feed_type: 'forYou',
        p_media_filter: config.mediaFilter,
      });
      posts = (data as any[] || []).map((p: any) => ({
        id: p.id,
        user_id: p.user_id,
        content: p.content,
        media_url: p.media_url,
        media_type: p.media_type,
        media_urls: p.media_urls,
        media_types: p.media_types,
        created_at: p.created_at,
        likes_count: p.likes_count || 0,
        comments_count: p.comments_count || 0,
        views_count: p.views_count || 0,
        refeeds_count: p.refeeds_count || 0,
        location: p.location,
        post_type: p.post_type,
        original_post_id: p.original_post_id,
        is_promoted: p.is_promoted || false,
        is_new_post: p.is_new_post || false,
        relevance_score: p.relevance_score,
      }));
    } else if (config.feedType === 'following') {
      // Use enhanced rotation feed for following
      const { data } = await supabase.rpc('get_feed_with_rotation', {
        p_user_id: user.id,
        p_limit: config.limit,
        p_offset: config.offset,
        p_feed_type: 'following',
        p_media_filter: config.mediaFilter,
      });
      posts = (data as any[] || []).map((p: any) => ({
        id: p.id,
        user_id: p.user_id,
        content: p.content,
        media_url: p.media_url,
        media_type: p.media_type,
        media_urls: p.media_urls,
        media_types: p.media_types,
        created_at: p.created_at,
        likes_count: p.likes_count || 0,
        comments_count: p.comments_count || 0,
        views_count: p.views_count || 0,
        refeeds_count: p.refeeds_count || 0,
        location: p.location,
        post_type: p.post_type,
        original_post_id: p.original_post_id,
        is_promoted: false,
        is_new_post: p.is_new_post || false,
      }));
    } else if (config.feedType === 'explore') {
      // Use enhanced rotation feed for explore
      const { data } = await supabase.rpc('get_feed_with_rotation', {
        p_user_id: user.id,
        p_limit: config.limit,
        p_offset: config.offset,
        p_feed_type: 'explore',
        p_media_filter: config.mediaFilter,
      });
      posts = (data as any[] || []).map((p: any) => ({
        id: p.id,
        user_id: p.user_id,
        content: p.content,
        media_url: p.media_url,
        media_type: p.media_type,
        media_urls: p.media_urls,
        media_types: p.media_types,
        created_at: p.created_at,
        likes_count: p.likes_count || 0,
        comments_count: p.comments_count || 0,
        views_count: p.views_count || 0,
        refeeds_count: p.refeeds_count || 0,
        location: p.location,
        post_type: p.post_type,
        original_post_id: p.original_post_id,
        is_promoted: p.is_promoted || false,
        is_new_post: p.is_new_post || false,
        discovery_score: p.relevance_score,
      }));
    }

    // =============================================
    // INSERT ADS AT INTERVALS
    // Uses enhanced ad targeting with daily impression limits
    // Ads won't repeat within the same day
    // =============================================
    let finalFeed: (Post | Ad)[] = [...posts];
    
    if (config.includeAds && posts.length >= config.adFrequency) {
      const adCount = Math.ceil(posts.length / config.adFrequency);
      
      // Use enhanced ad function with interest matching and daily exclusion
      const { data: ads } = await supabase.rpc('get_targeted_ads_v2', {
        p_user_id: user.id,
        p_limit: adCount,
        p_user_interests: interestTags.length > 0 ? interestTags : null,
      });

      if (ads && Array.isArray(ads) && ads.length > 0) {
        const result: (Post | Ad)[] = [];
        let adIndex = 0;

        for (let i = 0; i < posts.length; i++) {
          result.push(posts[i]);
          // Insert ad every adFrequency posts
          if ((i + 1) % config.adFrequency === 0 && adIndex < ads.length) {
            const ad = ads[adIndex] as any;
            result.push({
              ad_id: ad.ad_id,
              title: ad.title,
              description: ad.description,
              media_url: ad.media_url,
              media_type: ad.media_type,
              click_url: ad.click_url,
              advertiser_name: ad.advertiser_name,
              priority: ad.priority,
              is_ad: true,
            });
            
            // Record ad impression (fire and forget)
            supabase.from('ad_impressions').upsert({
              ad_id: ad.ad_id,
              user_id: user.id,
              impression_date: new Date().toISOString().split('T')[0],
              impressions_count: 1,
            }, {
              onConflict: 'ad_id,user_id,impression_date',
            }).then(() => {});
            
            adIndex++;
          }
        }
        finalFeed = result;
      }
    }

    // =============================================
    // FETCH PROFILES FOR POSTS
    // =============================================
    const userIds = [...new Set(posts.map(p => p.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', userIds);

    const profileMap = new Map((profiles as any[] || []).map((p: any) => [p.id, p]));

    const postsWithProfiles = finalFeed.map(item => {
      if ('is_ad' in item && item.is_ad) return item;
      return { ...item, profiles: profileMap.get((item as Post).user_id) || null };
    });

    // =============================================
    // UPDATE SESSION POSITION
    // Track where user is in the feed for rotation on return
    // =============================================
    if (posts.length > 0) {
      const lastPost = posts[posts.length - 1];
      supabase.rpc('update_feed_session', {
        p_user_id: user.id,
        p_feed_type: config.feedType,
        p_last_post_id: lastPost.id,
        p_position: config.offset + posts.length,
      }).then(() => {});
    }

    return new Response(
      JSON.stringify({
        posts: postsWithProfiles,
        feedType: config.feedType,
        mediaFilter: config.mediaFilter,
        hasMore: posts.length === config.limit,
        cycleReset,
        sessionId: config.sessionId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Personalized feed error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
