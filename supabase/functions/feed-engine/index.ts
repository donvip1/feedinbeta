/**
 * ============================================================================
 * FEEDIN FEED ENGINE v2.0
 * Complete Social Media Feed System with Rotation, Personalization, and Ads
 * ============================================================================
 * 
 * This Edge Function provides a comprehensive feed system with:
 * 
 * 1. FEED ROTATION & NON-REPETITION:
 *    - Users never see the same post twice in the same day
 *    - When returning to the app, feed starts from new position
 *    - New posts (last 24h) always shown before older posts
 *    - Old posts shown only after all new posts viewed
 *    - When all posts seen, cycle restarts with randomized order
 * 
 * 2. PERSONALIZATION:
 *    - Fetches based on user interests, hashtags, categories
 *    - Prioritizes content type user engages with most (video vs image)
 *    - Includes entertainment and trending content
 * 
 * 3. ADS INTEGRATION:
 *    - Targeted ads based on user interests
 *    - No ad repeats within same day
 *    - Controlled intervals (every 5th post by default)
 * 
 * ============================================================================
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { mergePromotedPosts, rankPromotedPosts } from './promotion-ranking.ts';

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface FeedRequest {
  limit?: number;           // Number of posts to fetch (default: 20, max: 50)
  offset?: number;          // Pagination offset
  mediaFilter?: 'all' | 'video' | 'photo';  // Filter by media type
  includeAds?: boolean;     // Whether to include ads (default: true)
  adFrequency?: number;     // Insert ad every N posts (default: 5)
  sessionId?: string;       // Unique session identifier
  isNewSession?: boolean;   // True when user returns to app
}

// Raw post from RPC (uses post_user_id)
interface RawFeedPost {
  id: string;
  post_user_id: string;
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
  relevance_score: number;
  is_new_post: boolean;
  is_promoted: boolean;
  promotion_campaign_id?: string;
  promotion_disclosure?: string;
  is_trending?: boolean;
}

// Output post format (uses user_id)
interface FeedPost {
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
  relevance_score: number;
  is_new_post: boolean;
  is_promoted: boolean;
  is_trending?: boolean;
  profiles?: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    is_verified?: boolean;
    plan_tier?: string | null;
  } | null;
}

interface FeedAd {
  ad_id: string;
  title: string;
  description: string | null;
  media_url: string;
  media_type: string;
  click_url: string | null;
  advertiser_name: string | null;
  is_ad: true;
}

interface FeedResponse {
  posts: (FeedPost | FeedAd)[];
  hasMore: boolean;
  totalAvailable: number;
  viewedToday: number;
  cycleProgress: number;      // Percentage of posts viewed in current cycle
  cycleReset: boolean;        // True if cycle was just reset
  sessionId: string;
}

// ============================================================================
// MAIN REQUEST HANDLER
// ============================================================================

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ========================================
    // 1. AUTHENTICATE USER
    // ========================================
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================
    // 2. PARSE REQUEST PARAMETERS
    // ========================================
    const body: FeedRequest = await req.json();
    const config = {
      limit: Math.min(body.limit || 20, 50),
      offset: body.offset || 0,
      mediaFilter: body.mediaFilter || 'all',
      includeAds: body.includeAds !== false,
      adFrequency: body.adFrequency || 5,
      sessionId: body.sessionId || crypto.randomUUID(),
      isNewSession: body.isNewSession || false,
    };

    console.log(`[FeedEngine] User ${user.id.slice(0, 8)} requesting feed:`, {
      limit: config.limit,
      offset: config.offset,
      mediaFilter: config.mediaFilter,
      isNewSession: config.isNewSession,
    });

    // ========================================
    // 3. GET FEED STATUS (for cycle management)
    // ========================================
    const { data: feedStatus } = await supabase.rpc('get_feed_status', {
      p_user_id: user.id,
    });

    const status = feedStatus?.[0] || {
      total_posts_available: 0,
      posts_viewed_today: 0,
      viewing_progress_percent: 0,
      needs_cycle_reset: false,
    };

    console.log(`[FeedEngine] Feed status:`, {
      total: status.total_posts_available,
      viewed: status.posts_viewed_today,
      progress: `${status.viewing_progress_percent?.toFixed(1)}%`,
      needsReset: status.needs_cycle_reset,
    });

    // ========================================
    // 4. FETCH PERSONALIZED FEED
    // Uses get_feed() which handles:
    // - Excluding seen posts
    // - Prioritizing new posts
    // - Applying personalization
    // - Cycle reset when needed
    // ========================================
    const { data: feedPosts, error: feedError } = await supabase.rpc('get_feed', {
      p_user_id: user.id,
      p_limit: config.limit,
      p_offset: config.offset,
      p_media_filter: config.mediaFilter,
      p_include_trending: true,
    });

    if (feedError) {
      console.error('[FeedEngine] Feed fetch error:', feedError);
      throw feedError;
    }

    const rawPosts: RawFeedPost[] = feedPosts || [];
    console.log(`[FeedEngine] Got ${rawPosts.length} posts from rotation engine`);

    // ========================================
    // 5. FETCH PROFILE DATA FOR POSTS
    // ========================================
    const userIds = [...new Set(rawPosts.map(p => p.post_user_id).filter(Boolean))];
    
    let profileMap = new Map<string, any>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, is_verified, plan_tier')
        .in('id', userIds);
      
      profileMap = new Map((profiles || []).map(p => [p.id, p]));
    }

    // Enrich posts with profile data
    const enrichedPosts: FeedPost[] = rawPosts.map(post => ({
      id: post.id,
      user_id: post.post_user_id,
      content: post.content,
      media_url: post.media_url,
      media_type: post.media_type,
      media_urls: post.media_urls,
      media_types: post.media_types,
      created_at: post.created_at,
      likes_count: post.likes_count || 0,
      comments_count: post.comments_count || 0,
      views_count: post.views_count || 0,
      refeeds_count: post.refeeds_count || 0,
      location: post.location,
      post_type: post.post_type,
      original_post_id: post.original_post_id,
      relevance_score: post.relevance_score || 0,
      is_new_post: post.is_new_post || false,
      is_promoted: post.is_promoted || false,
      is_trending: post.is_trending || false,
      profiles: profileMap.get(post.post_user_id) || null,
    }));

    // ========================================
    // 6. MERGE ACTIVE PROMOTION CAMPAIGNS
    // ========================================
    const postIds = enrichedPosts.map((post) => post.id);
    let rankedPosts = enrichedPosts;
    if (postIds.length > 0) {
      const now = new Date().toISOString();
      const { data: campaigns, error: campaignError } = await supabase
        .from('post_promotion_campaigns')
        .select('id, post_id, plan_key, remaining_budget, estimate_max, state, starts_at, ends_at')
        .eq('state', 'active')
        .gt('remaining_budget', 0)
        .lte('starts_at', now)
        .gt('ends_at', now)
        .in('post_id', postIds);

      if (!campaignError && campaigns?.length) {
        const campaignIds = campaigns.map((campaign) => campaign.id);
        const { data: sessionDeliveries } = await supabase
          .from('post_promotion_delivery_events')
          .select('campaign_id')
          .eq('viewer_id', user.id)
          .eq('session_id', config.sessionId)
          .in('campaign_id', campaignIds);
        const sessionCampaignIds = new Set(
          (sessionDeliveries || []).map((delivery) => delivery.campaign_id),
        );
        const planWeights: Record<string, number> = {
          starter: 1,
          basic: 1.4,
          pro: 2,
          premium: 3,
          elite: 4,
        };
        const candidates = campaigns.map((campaign) => {
          const post = enrichedPosts.find((item) => item.id === campaign.post_id);
          const engagement = post
            ? Math.max(0.6, Math.min(1.4, 0.8 + (post.likes_count + post.comments_count * 2) / Math.max(50, post.views_count || 50)))
            : 0.8;
          return {
            campaignId: campaign.id,
            postId: campaign.post_id,
            planKey: campaign.plan_key,
            planWeight: planWeights[campaign.plan_key] || 1,
            active: campaign.state === 'active',
            targetMatches: true,
            frequencyCapped: sessionCampaignIds.has(campaign.id),
            pacingFactor: Math.max(0.2, Math.min(1, campaign.remaining_budget / Math.max(1, campaign.estimate_max))),
            qualityFactor: engagement,
          };
        });
        const promoted = rankPromotedPosts(candidates, Math.max(1, Math.ceil(enrichedPosts.length / 5)));
        rankedPosts = mergePromotedPosts(enrichedPosts, promoted) as FeedPost[];

        const deliveredCampaignIds = rankedPosts
          .filter((post) => post.is_promoted && post.promotion_campaign_id)
          .map((post) => post.promotion_campaign_id!);
        if (deliveredCampaignIds.length > 0) {
          const deliverySessionId = config.sessionId;
          const deliveryResults = await Promise.all(
            deliveredCampaignIds.map((campaignId) =>
              supabase.rpc('record_post_promotion_delivery', {
                p_campaign_id: campaignId,
                p_viewer_id: user.id,
                p_session_id: deliverySessionId,
              })
            ),
          );
          deliveryResults.forEach(({ error }, index) => {
            if (error) {
              console.error(
                `[FeedEngine] Promotion delivery failed for ${deliveredCampaignIds[index].slice(0, 8)}:`,
                error,
              );
            }
          });
        }
      }
    }

    // ========================================
    // 7. FETCH AND INSERT TARGETED ADS
    // Ads are inserted every adFrequency posts
    // Excludes ads already shown today
    // ========================================
    let finalFeed: (FeedPost | FeedAd)[] = [...rankedPosts];

    if (config.includeAds && rankedPosts.length >= config.adFrequency) {
      // Get user interests for ad targeting
      const { data: userInterests } = await supabase
        .from('user_interests')
        .select('interest_value')
        .eq('user_id', user.id)
        .eq('interest_type', 'hashtag')
        .order('interest_score', { ascending: false })
        .limit(20);

      const interestTags = (userInterests || []).map(i => i.interest_value).filter(Boolean);

      // Fetch targeted ads
      const adCount = Math.ceil(rankedPosts.length / config.adFrequency);
      const { data: ads } = await supabase.rpc('insert_ads', {
        p_user_id: user.id,
        p_ad_count: adCount,
        p_user_interests: interestTags.length > 0 ? interestTags : null,
      });

      // Insert ads at intervals
      if (ads && Array.isArray(ads) && ads.length > 0) {
        const result: (FeedPost | FeedAd)[] = [];
        let adIndex = 0;

        for (let i = 0; i < rankedPosts.length; i++) {
          result.push(rankedPosts[i]);

          // Insert ad every adFrequency posts
          if ((i + 1) % config.adFrequency === 0 && adIndex < ads.length) {
            const ad = ads[adIndex];
            result.push({
              ad_id: ad.ad_id,
              title: ad.title,
              description: ad.description,
              media_url: ad.media_url,
              media_type: ad.media_type,
              click_url: ad.click_url,
              advertiser_name: ad.advertiser_name,
              is_ad: true,
            });

            // Record ad impression (async, don't wait)
            supabase.rpc('record_ad_impression', {
              p_user_id: user.id,
              p_ad_id: ad.ad_id,
              p_clicked: false,
            }).then(() => {
              console.log(`[FeedEngine] Recorded impression for ad ${ad.ad_id.slice(0, 8)}`);
            });

            adIndex++;
          }
        }
        finalFeed = result;
        console.log(`[FeedEngine] Inserted ${adIndex} ads into feed`);
      }
    }

    // ========================================
    // 7. UPDATE FEED SESSION POSITION
    // Tracks where user left off for next session
    // ========================================
    if (enrichedPosts.length > 0) {
      const lastPostId = enrichedPosts[enrichedPosts.length - 1].id;
      
      await supabase
        .from('feed_cycle_status')
        .upsert({
          user_id: user.id,
          last_session_id: config.sessionId,
          last_post_position: config.offset + enrichedPosts.length,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });
    }

    // ========================================
    // 8. BUILD AND RETURN RESPONSE
    // ========================================
    const response: FeedResponse = {
      posts: finalFeed,
      hasMore: enrichedPosts.length === config.limit,
      totalAvailable: status.total_posts_available || 0,
      viewedToday: status.posts_viewed_today || 0,
      cycleProgress: status.viewing_progress_percent || 0,
      cycleReset: status.needs_cycle_reset || false,
      sessionId: config.sessionId,
    };

    console.log(`[FeedEngine] Returning ${finalFeed.length} items (${enrichedPosts.length} posts, ${finalFeed.length - enrichedPosts.length} ads)`);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[FeedEngine] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
