-- Fix get_feed_with_rotation function to use correct user_interests schema
CREATE OR REPLACE FUNCTION public.get_feed_with_rotation(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_feed_type TEXT DEFAULT 'forYou',
  p_media_filter TEXT DEFAULT 'all'
) RETURNS TABLE(
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
SET search_path = public
AS $$
DECLARE
  v_session_offset INTEGER := 0;
  v_media_pref TEXT := 'all';
BEGIN
  -- Get user's session offset for rotation (different starting point on return)
  SELECT COALESCE(ufs.last_position, 0) INTO v_session_offset
  FROM user_feed_sessions ufs
  WHERE ufs.user_id = p_user_id AND ufs.feed_type = p_feed_type;

  -- Get user's media preference for boosting
  SELECT COALESCE(ump.preferred_media_type, 'all') INTO v_media_pref
  FROM user_media_preferences ump
  WHERE ump.user_id = p_user_id;

  RETURN QUERY
  WITH 
  -- Posts viewed today - exclude these
  viewed_today AS (
    SELECT pvh.post_id 
    FROM post_view_history pvh
    WHERE pvh.user_id = p_user_id 
      AND pvh.viewed_at >= CURRENT_DATE
  ),
  -- User's interests for scoring (using correct schema: interest_type, interest_value, weight)
  user_interest_tags AS (
    SELECT ui.interest_value AS name, ui.weight AS interest_score
    FROM user_interests ui
    WHERE ui.user_id = p_user_id
      AND ui.interest_type = 'hashtag'
  ),
  -- Blocked users to exclude
  blocked AS (
    SELECT bu.blocked_id FROM blocked_users bu WHERE bu.blocker_id = p_user_id
    UNION
    SELECT bu2.blocker_id FROM blocked_users bu2 WHERE bu2.blocked_id = p_user_id
  ),
  -- Following list for Following feed
  following_ids AS (
    SELECT f.following_id FROM follows f WHERE f.follower_id = p_user_id
  ),
  -- All eligible posts with scoring
  scored_posts AS (
    SELECT 
      p.id,
      p.user_id,
      p.content,
      p.media_url,
      p.media_type,
      p.media_urls,
      p.media_types,
      p.created_at,
      p.likes_count,
      p.comments_count,
      p.views_count,
      p.refeeds_count,
      p.location,
      p.post_type,
      p.original_post_id,
      -- Calculate relevance score
      (
        -- Base engagement score
        COALESCE(p.likes_count, 0) * 0.3 +
        COALESCE(p.comments_count, 0) * 0.5 +
        COALESCE(p.views_count, 0) * 0.01 +
        -- Recency boost (posts from last 24h get bonus)
        CASE WHEN p.created_at > NOW() - INTERVAL '24 hours' THEN 50 ELSE 0 END +
        -- Interest matching boost
        COALESCE((
          SELECT SUM(uit.interest_score * 10)
          FROM user_interest_tags uit
          WHERE p.content ILIKE '%' || uit.name || '%'
        ), 0) +
        -- Media preference boost
        CASE 
          WHEN v_media_pref = 'video' AND p.media_type = 'video' THEN 20
          WHEN v_media_pref = 'photo' AND p.media_type IN ('image', 'photo') THEN 20
          ELSE 0
        END +
        -- Promoted content boost
        CASE WHEN p.is_promoted = true THEN 30 ELSE 0 END
      )::REAL AS relevance_score,
      -- Flag if this is a new post (within 24 hours)
      (p.created_at > NOW() - INTERVAL '24 hours') AS is_new_post,
      COALESCE(p.is_promoted, false) AS is_promoted
    FROM posts p
    WHERE p.status = 'active'
      AND p.user_id NOT IN (SELECT blocked.blocked_id FROM blocked)
      AND p.id NOT IN (SELECT viewed_today.post_id FROM viewed_today)
      -- Media filter
      AND (
        p_media_filter = 'all'
        OR (p_media_filter = 'video' AND p.media_type = 'video')
        OR (p_media_filter = 'photo' AND p.media_type IN ('image', 'photo', 'styled_text'))
      )
      -- Feed type filter
      AND (
        p_feed_type = 'forYou'
        OR (p_feed_type = 'following' AND p.user_id IN (SELECT following_ids.following_id FROM following_ids))
        OR (p_feed_type = 'explore' AND p.user_id NOT IN (SELECT following_ids.following_id FROM following_ids) AND p.user_id != p_user_id)
      )
  )
  -- Return new posts first (sorted by relevance), then old posts
  SELECT 
    sp.id,
    sp.user_id,
    sp.content,
    sp.media_url,
    sp.media_type,
    sp.media_urls,
    sp.media_types,
    sp.created_at,
    sp.likes_count,
    sp.comments_count,
    sp.views_count,
    sp.refeeds_count,
    sp.location,
    sp.post_type,
    sp.original_post_id,
    sp.relevance_score,
    sp.is_new_post,
    sp.is_promoted
  FROM scored_posts sp
  ORDER BY 
    sp.is_new_post DESC,  -- New posts first
    sp.relevance_score DESC,
    sp.created_at DESC
  LIMIT p_limit
  OFFSET p_offset + COALESCE(v_session_offset, 0);
END;
$$;

-- Also fix get_targeted_ads_v2 which may have similar issues
CREATE OR REPLACE FUNCTION public.get_targeted_ads_v2(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 3,
  p_user_interests TEXT[] DEFAULT NULL
) RETURNS TABLE(
  ad_id UUID,
  title TEXT,
  description TEXT,
  media_url TEXT,
  media_type TEXT,
  click_url TEXT,
  advertiser_name TEXT,
  priority INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_location TEXT;
  v_user_gender TEXT;
  v_user_age INTEGER;
  v_media_pref TEXT := 'all';
BEGIN
  -- Get user profile data for targeting
  SELECT pr.location, pr.gender, 
    EXTRACT(YEAR FROM AGE(COALESCE(pr.date_of_birth, '1990-01-01'::date)))::INTEGER
  INTO v_user_location, v_user_gender, v_user_age
  FROM profiles pr
  WHERE pr.id = p_user_id;

  -- Get media preference
  SELECT COALESCE(ump.preferred_media_type, 'all') INTO v_media_pref
  FROM user_media_preferences ump
  WHERE ump.user_id = p_user_id;

  RETURN QUERY
  WITH 
  -- Ads already shown today - exclude these
  shown_today AS (
    SELECT ai.ad_id 
    FROM ad_impressions ai
    WHERE ai.user_id = p_user_id 
      AND ai.impression_date = CURRENT_DATE
  ),
  -- Score and filter ads
  scored_ads AS (
    SELECT 
      fa.id AS ad_id,
      fa.title,
      fa.description,
      fa.media_url,
      fa.media_type,
      fa.click_url,
      fa.advertiser_name,
      fa.priority,
      -- Targeting score
      (
        -- Location match
        CASE WHEN fa.target_locations IS NULL OR v_user_location = ANY(fa.target_locations) THEN 20 ELSE 0 END +
        -- Gender match  
        CASE WHEN fa.target_genders IS NULL OR v_user_gender = ANY(fa.target_genders) THEN 10 ELSE 0 END +
        -- Age match
        CASE WHEN fa.target_age_min IS NULL OR v_user_age >= fa.target_age_min THEN 5 ELSE 0 END +
        CASE WHEN fa.target_age_max IS NULL OR v_user_age <= fa.target_age_max THEN 5 ELSE 0 END +
        -- Interest match
        CASE 
          WHEN fa.target_interests IS NOT NULL AND p_user_interests IS NOT NULL 
            AND fa.target_interests && p_user_interests THEN 30 
          ELSE 0 
        END +
        -- Media type preference match
        CASE 
          WHEN v_media_pref = 'video' AND fa.media_type = 'video' THEN 15
          WHEN v_media_pref = 'photo' AND fa.media_type = 'image' THEN 15
          ELSE 0
        END +
        -- Priority boost
        COALESCE(fa.priority, 1) * 5
      ) AS targeting_score
    FROM feed_ads fa
    WHERE fa.is_active = true
      AND fa.id NOT IN (SELECT shown_today.ad_id FROM shown_today)
      AND (fa.start_date IS NULL OR fa.start_date <= NOW())
      AND (fa.end_date IS NULL OR fa.end_date >= NOW())
  )
  SELECT 
    sa.ad_id,
    sa.title,
    sa.description,
    sa.media_url,
    sa.media_type,
    sa.click_url,
    sa.advertiser_name,
    sa.priority
  FROM scored_ads sa
  ORDER BY sa.targeting_score DESC, RANDOM()
  LIMIT p_limit;
END;
$$;