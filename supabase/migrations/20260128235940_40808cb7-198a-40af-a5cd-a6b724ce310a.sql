-- Fix get_feed_with_rotation (6-param version) to INCLUDE user's own posts with high priority
CREATE OR REPLACE FUNCTION public.get_feed_with_rotation(
  p_user_id uuid, 
  p_limit integer DEFAULT 50, 
  p_offset integer DEFAULT 0, 
  p_feed_type text DEFAULT 'forYou'::text, 
  p_media_filter text DEFAULT 'all'::text, 
  p_session_seed text DEFAULT NULL::text
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
  is_promoted boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_session_key TEXT;
BEGIN
  -- Generate a unique session key for randomization
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
  viewed_today AS (
    SELECT DISTINCT pvh.post_id 
    FROM post_view_history pvh 
    WHERE pvh.user_id = p_user_id 
      AND pvh.view_date = CURRENT_DATE
  ),
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
      -- Is new post (last 24 hours)
      (p.created_at > NOW() - INTERVAL '24 hours') AS sp_is_new_post,
      -- Is promoted
      EXISTS (SELECT 1 FROM active_promos ap WHERE ap.post_id = p.id) AS sp_is_promoted,
      -- Is user's own post - give highest priority
      (p.user_id = p_user_id) AS sp_is_own_post,
      -- Promo boost level
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
      -- Random score based on session key
      (('x' || substr(md5(p.id::text || v_session_key), 1, 8))::bit(32)::int % 1000)::REAL / 1000.0 AS sp_random_score
    FROM posts p
    WHERE p.status = 'active'
      -- REMOVED: AND p.user_id != p_user_id (now includes user's own posts)
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
    -- Final relevance score - OWN POSTS GET HIGHEST PRIORITY (2000)
    (
      CASE WHEN sp.sp_is_own_post THEN 2000 ELSE 0 END +  -- User's own posts first!
      CASE WHEN sp.sp_is_new_post THEN 1000 ELSE 0 END +  -- New posts second
      sp.sp_promo_boost +
      sp.sp_engagement_score +
      CASE WHEN NOT sp.sp_viewed_today THEN 100 ELSE 0 END +
      sp.sp_random_score * 50
    )::REAL AS relevance_score,
    sp.sp_is_new_post,
    sp.sp_is_promoted OR sp.sp_is_own_post  -- Mark own posts as "promoted" for UI highlighting
  FROM scored_posts sp
  ORDER BY 
    sp.sp_is_own_post DESC,  -- Own posts always first
    sp.sp_is_new_post DESC,
    sp.sp_is_promoted DESC,
    (
      CASE WHEN sp.sp_is_own_post THEN 2000 ELSE 0 END +
      CASE WHEN sp.sp_is_new_post THEN 1000 ELSE 0 END +
      sp.sp_promo_boost +
      sp.sp_engagement_score +
      CASE WHEN NOT sp.sp_viewed_today THEN 100 ELSE 0 END +
      sp.sp_random_score * 50
    ) DESC,
    sp.sp_created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$function$;