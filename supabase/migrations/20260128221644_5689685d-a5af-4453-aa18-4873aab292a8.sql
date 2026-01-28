-- Update the get_feed_with_rotation function to use session-based randomization
-- This creates a TikTok/YouTube style random feed that changes each time user returns
CREATE OR REPLACE FUNCTION public.get_feed_with_rotation(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  p_feed_type TEXT DEFAULT 'forYou',
  p_media_filter TEXT DEFAULT 'all',
  p_session_seed TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  content TEXT,
  media_url TEXT,
  media_type TEXT,
  media_urls TEXT[],
  media_types TEXT[],
  created_at TIMESTAMPTZ,
  likes_count INTEGER,
  comments_count INTEGER,
  views_count INTEGER,
  refeeds_count INTEGER,
  location TEXT,
  post_type TEXT,
  original_post_id UUID,
  relevance_score REAL,
  is_new_post BOOLEAN,
  is_promoted BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session_key TEXT;
BEGIN
  -- Generate a unique session key for randomization
  -- If no seed provided, use current timestamp to ensure different order each visit
  v_session_key := COALESCE(p_session_seed, EXTRACT(EPOCH FROM NOW())::TEXT);
  
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
  -- Get today's viewed posts for this user (for de-prioritization, not exclusion)
  viewed_today AS (
    SELECT DISTINCT pvh.post_id 
    FROM post_view_history pvh 
    WHERE pvh.user_id = p_user_id 
      AND pvh.view_date = CURRENT_DATE
  ),
  -- Active promotions
  active_promos AS (
    SELECT pp.post_id, pp.boost_level
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
      -- Whether viewed today (for sorting, not exclusion)
      EXISTS (SELECT 1 FROM viewed_today vt WHERE vt.post_id = p.id) AS sp_viewed_today,
      -- Is new post (last 24 hours) - these get priority
      (p.created_at > NOW() - INTERVAL '24 hours') AS sp_is_new_post,
      -- Is promoted
      EXISTS (SELECT 1 FROM active_promos ap WHERE ap.post_id = p.id) AS sp_is_promoted,
      -- Promo boost level for priority
      COALESCE((SELECT CASE ap.boost_level 
        WHEN 'premium' THEN 100 
        WHEN 'standard' THEN 50 
        ELSE 10 END 
        FROM active_promos ap WHERE ap.post_id = p.id), 0) AS sp_promo_boost,
      -- Engagement score
      (
        COALESCE(p.likes_count, 0) * 0.3 +
        COALESCE(p.comments_count, 0) * 0.5 +
        COALESCE(p.views_count, 0) * 0.01
      )::REAL AS sp_engagement_score,
      -- Random score based on session key - THIS MAKES EACH VISIT DIFFERENT
      (('x' || substr(md5(p.id::text || v_session_key), 1, 8))::bit(32)::int % 1000)::REAL / 1000.0 AS sp_random_score
    FROM posts p
    WHERE p.status = 'active'
      AND p.user_id != p_user_id  -- Exclude user's own posts
      AND p.user_id NOT IN (SELECT blocked.bid FROM blocked)
      AND (
        p_media_filter = 'all'
        OR (p_media_filter = 'video' AND p.media_type = 'video')
        OR (p_media_filter = 'photo' AND p.media_type IN ('image', 'photo', 'styled_text'))
        OR (p_media_filter = 'photo' AND p.media_type IS NULL)
      )
      AND (
        p_feed_type = 'forYou'
        OR (p_feed_type = 'following' AND p.user_id IN (SELECT following_ids.fid FROM following_ids))
      )
  )
  SELECT 
    sp.sp_id,
    sp.sp_user_id,
    sp.sp_content,
    sp.sp_media_url,
    sp.sp_media_type,
    sp.sp_media_urls,
    sp.sp_media_types,
    sp.sp_created_at,
    sp.sp_likes_count,
    sp.sp_comments_count,
    sp.sp_views_count,
    sp.sp_refeeds_count,
    sp.sp_location,
    sp.sp_post_type,
    sp.sp_original_post_id,
    -- Final relevance score combining all factors
    (
      CASE WHEN sp.sp_is_new_post THEN 1000 ELSE 0 END +  -- New posts first
      sp.sp_promo_boost +                                   -- Promoted posts boosted
      CASE WHEN sp.sp_viewed_today THEN -500 ELSE 0 END + -- Viewed posts to bottom
      sp.sp_engagement_score * 0.5 +                        -- Some engagement weight
      sp.sp_random_score * 300                              -- Random shuffle within tiers
    )::REAL AS relevance_score,
    sp.sp_is_new_post,
    sp.sp_is_promoted
  FROM scored_posts sp
  ORDER BY 
    -- Tier 1: Non-viewed new posts (randomized within)
    -- Tier 2: Non-viewed old posts (randomized within)
    -- Tier 3: Viewed posts (randomized within)
    sp.sp_viewed_today ASC,           -- Unviewed first
    sp.sp_is_new_post DESC,           -- New posts first within unviewed
    sp.sp_promo_boost DESC,           -- Promoted higher
    sp.sp_random_score DESC           -- Random order within each tier
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;