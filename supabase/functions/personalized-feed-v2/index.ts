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
}

interface Ad {
  ad_id: string;
  title: string;
  description: string | null;
  media_url: string;
  media_type: string;
  click_url: string | null;
  relevance_score: number;
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
    };

    // Check cycle reset
    const { data: cycleStatus } = await supabase.rpc('reset_viewed_posts_cycle', { p_user_id: user.id });
    const cycleReset = Array.isArray(cycleStatus) && cycleStatus[0]?.was_reset;

    // Fetch posts based on feed type
    let posts: Post[] = [];
    
    if (config.feedType === 'forYou') {
      const { data } = await supabase.rpc('get_personalized_for_you_feed', {
        p_user_id: user.id,
        p_limit: config.limit,
        p_offset: config.offset,
      });
      posts = (data as any[] || []).map((p: any) => ({
        id: p.post_id || p.id,
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
      }));
    } else if (config.feedType === 'following') {
      const { data: following } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);
      
      const followingIds = (following as any[] || []).map((f: any) => f.following_id);
      
      if (followingIds.length > 0) {
        const { data: postsData } = await supabase
          .from('posts')
          .select('*')
          .in('user_id', followingIds)
          .order('created_at', { ascending: false })
          .range(config.offset, config.offset + config.limit - 1);
        
        posts = (postsData as any[] || []).map((p: any) => ({ ...p, is_promoted: false }));
      }
    } else if (config.feedType === 'explore') {
      const { data } = await supabase.rpc('get_explore_feed', {
        p_user_id: user.id,
        p_limit: config.limit,
        p_offset: config.offset,
      });
      posts = (data as any[] || []).map((p: any) => ({
        id: p.post_id,
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
        discovery_score: p.discovery_score,
      }));
    }

    // Apply media filter
    if (config.mediaFilter === 'video') {
      posts = posts.filter(p => 
        p.media_type?.startsWith('video') || 
        p.media_types?.some(t => t?.startsWith('video'))
      );
    } else if (config.mediaFilter === 'photo') {
      posts = posts.filter(p => 
        (p.media_type?.startsWith('image') || p.post_type === 'text') ||
        p.media_types?.some(t => t?.startsWith('image'))
      );
    }

    // Insert ads if enabled
    let finalFeed: (Post | Ad)[] = [...posts];
    
    if (config.includeAds && posts.length >= config.adFrequency) {
      const adCount = Math.floor(posts.length / config.adFrequency);
      const { data: ads } = await supabase.rpc('get_targeted_ads', {
        p_user_id: user.id,
        p_limit: adCount,
      });

      if (ads && Array.isArray(ads) && ads.length > 0) {
        const result: (Post | Ad)[] = [];
        let adIndex = 0;

        for (let i = 0; i < posts.length; i++) {
          result.push(posts[i]);
          if ((i + 1) % config.adFrequency === 0 && adIndex < ads.length) {
            const ad = ads[adIndex] as any;
            result.push({ ...ad, is_ad: true });
            adIndex++;
          }
        }
        finalFeed = result;
      }
    }

    // Fetch profiles
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

    return new Response(
      JSON.stringify({
        posts: postsWithProfiles,
        feedType: config.feedType,
        mediaFilter: config.mediaFilter,
        hasMore: posts.length === config.limit,
        cycleReset,
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
