-- Drop existing functions with all signatures
DROP FUNCTION IF EXISTS public.get_feed_with_rotation(uuid, integer, integer, text, text);
DROP FUNCTION IF EXISTS public.get_feed_with_rotation(uuid, integer, integer, text, text, text);

-- Recreate the feed function to properly prioritize promoted posts
CREATE OR REPLACE FUNCTION public.get_feed_with_rotation(
  p_user_id uuid, 
  p_limit integer DEFAULT 20, 
  p_offset integer DEFAULT 0, 
  p_feed_type text DEFAULT 'forYou'::text, 
  p_media_filter text DEFAULT 'all'::text,
  p_session_seed text DEFAULT NULL
)
RETURNS TABLE(
  id uuid, 
  user_id uuid, 
  content text, 
  media_url text, 
  media_type text, 
  media_urls text[], 
  media_types text[], 
  created_at timestamp with time zone, 
  likes_count integer, 
  comments_count integer, 
  views_count integer, 
  refeeds_count integer, 
  location text, 
  post_type text, 
  original_post_id uuid, 
  relevance_score real, 
  is_new_post boolean, 
  is_promoted boolean,
  boost_level text,
  promoter_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH 
  blocked AS (
    SELECT bu.blocked_id AS bid FROM blocked_users bu WHERE bu.blocker_id = p_user_id
    UNION
    SELECT bu2.blocker_id AS bid FROM blocked_users bu2 WHERE bu2.blocked_id = p_user_id
  ),
  following_ids AS (
    SELECT f.following_id AS fid FROM follows f WHERE f.follower_id = p_user_id
  ),
  -- Get active promotions - these get ULTIMATE priority
  active_promotions AS (
    SELECT 
      pp.post_id,
      pp.user_id AS promoter_user_id,
      pp.boost_level AS promotion_boost_level,
      pp.created_at AS promotion_created_at,
      -- Higher priority for higher boost levels
      CASE 
        WHEN pp.boost_level ILIKE '%elite%' THEN 5
        WHEN pp.boost_level ILIKE '%premium%' THEN 4
        WHEN pp.boost_level ILIKE '%pro%' THEN 3
        WHEN pp.boost_level ILIKE '%basic%' THEN 2
        ELSE 1
      END AS boost_priority
    FROM post_promotions pp
    WHERE pp.is_active = true 
      AND pp.expires_at > NOW()
  ),
  scored_posts AS (
    SELECT 
      p.id AS sp_id,
      p.user_id AS sp_user_id,
      p.content AS sp_content,
      p.media_url AS sp_media_url,
      p.media_type AS sp_media_type,
      p.media_urls AS sp_media_urls,
      p.media_types AS sp_media_types,
      p.created_at AS sp_created_at,
      p.likes_count AS sp_likes_count,
      p.comments_count AS sp_comments_count,
      p.views_count AS sp_views_count,
      p.refeeds_count AS sp_refeeds_count,
      p.location AS sp_location,
      p.post_type AS sp_post_type,
      p.original_post_id AS sp_original_post_id,
      -- Relevance scoring with promotion priority
      (
        -- ULTIMATE PRIORITY: Active promoted posts get massive boost (10000+)
        CASE WHEN ap.post_id IS NOT NULL THEN 10000 + (ap.boost_priority * 1000) ELSE 0 END +
        -- User's own posts get moderate boost
        CASE WHEN p.user_id = p_user_id THEN 500 ELSE 0 END +
        -- Engagement signals
        COALESCE(p.likes_count, 0) * 0.3 +
        COALESCE(p.comments_count, 0) * 0.5 +
        COALESCE(p.views_count, 0) * 0.01 +
        -- New posts bonus
        CASE WHEN p.created_at > NOW() - INTERVAL '24 hours' THEN 50 ELSE 0 END
      )::REAL AS sp_relevance_score,
      (p.created_at > NOW() - INTERVAL '24 hours') AS sp_is_new_post,
      -- TRUE if this post has an active promotion
      (ap.post_id IS NOT NULL) AS sp_is_promoted,
      ap.promotion_boost_level AS sp_boost_level,
      ap.promoter_user_id AS sp_promoter_id
    FROM posts p
    LEFT JOIN active_promotions ap ON ap.post_id = p.id
    WHERE p.status = 'active'
      AND p.user_id NOT IN (SELECT blocked.bid FROM blocked)
      AND (
        p_media_filter = 'all'
        OR (p_media_filter = 'video' AND p.media_type = 'video')
        OR (p_media_filter = 'photo' AND p.media_type IN ('image', 'photo', 'styled_text'))
        OR (p_media_filter = 'photo' AND p.media_type IS NULL)
      )
      AND (
        p_feed_type = 'forYou'
        OR (p_feed_type = 'following' AND (p.user_id IN (SELECT following_ids.fid FROM following_ids) OR p.user_id = p_user_id))
      )
  )
  SELECT 
    sp.sp_id, sp.sp_user_id, sp.sp_content, sp.sp_media_url, sp.sp_media_type, 
    sp.sp_media_urls, sp.sp_media_types, sp.sp_created_at, sp.sp_likes_count, 
    sp.sp_comments_count, sp.sp_views_count, sp.sp_refeeds_count,
    sp.sp_location, sp.sp_post_type, sp.sp_original_post_id, 
    sp.sp_relevance_score, sp.sp_is_new_post, sp.sp_is_promoted,
    sp.sp_boost_level, sp.sp_promoter_id
  FROM scored_posts sp
  -- ORDER: Promoted posts FIRST (by boost level), then new posts, then by relevance/recency
  ORDER BY 
    sp.sp_is_promoted DESC,
    sp.sp_relevance_score DESC, 
    sp.sp_is_new_post DESC, 
    sp.sp_created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;