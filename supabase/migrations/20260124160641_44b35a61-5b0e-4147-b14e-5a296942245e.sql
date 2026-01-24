-- Drop and recreate the function with new signature
DROP FUNCTION IF EXISTS get_feed_with_rotation(uuid, integer, integer, text, text);

CREATE OR REPLACE FUNCTION get_feed_with_rotation(
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
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session_offset INTEGER := 0;
  v_media_pref TEXT := 'all';
  v_total_available INTEGER := 0;
BEGIN
  -- Get user's session offset for rotation (or create new session)
  SELECT COALESCE(ufs.last_position, 0) INTO v_session_offset
  FROM user_feed_sessions ufs
  WHERE ufs.user_id = p_user_id AND ufs.feed_type = p_feed_type;

  -- Get user's media preference
  SELECT COALESCE(ump.preferred_media_type, 'all') INTO v_media_pref
  FROM user_media_preferences ump
  WHERE ump.user_id = p_user_id;

  -- Count available posts (not viewed today)
  SELECT COUNT(*)::INTEGER INTO v_total_available
  FROM posts p
  WHERE p.status = 'active'
    AND p.id NOT IN (
      SELECT pvh.post_id 
      FROM post_view_history pvh
      WHERE pvh.user_id = p_user_id 
        AND pvh.view_date = CURRENT_DATE
    );

  -- If session offset exceeds available posts, reset it
  IF v_session_offset >= v_total_available THEN
    v_session_offset := 0;
  END IF;

  -- Update session with new position for next fetch
  INSERT INTO user_feed_sessions (user_id, feed_type, last_position, session_start)
  VALUES (p_user_id, p_feed_type, v_session_offset + p_limit, NOW())
  ON CONFLICT (user_id, feed_type) 
  DO UPDATE SET 
    last_position = EXCLUDED.last_position,
    session_start = NOW();

  RETURN QUERY
  WITH 
  viewed_today AS (
    SELECT pvh.post_id AS vid
    FROM post_view_history pvh
    WHERE pvh.user_id = p_user_id 
      AND pvh.view_date = CURRENT_DATE
  ),
  user_interest_tags AS (
    SELECT ui.interest_value AS name, ui.weight AS interest_score
    FROM user_interests ui
    WHERE ui.user_id = p_user_id AND ui.interest_type = 'hashtag'
  ),
  blocked AS (
    SELECT bu.blocked_id AS bid FROM blocked_users bu WHERE bu.blocker_id = p_user_id
    UNION
    SELECT bu2.blocker_id AS bid FROM blocked_users bu2 WHERE bu2.blocked_id = p_user_id
  ),
  following_ids AS (
    SELECT f.following_id AS fid FROM follows f WHERE f.follower_id = p_user_id
  ),
  promoted_posts AS (
    SELECT pp.post_id AS pid, pp.boost_level
    FROM post_promotions pp
    WHERE pp.is_active = true AND pp.expires_at > NOW()
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
      (
        COALESCE(p.likes_count, 0) * 0.3 +
        COALESCE(p.comments_count, 0) * 0.5 +
        COALESCE(p.views_count, 0) * 0.01 +
        CASE WHEN p.created_at > NOW() - INTERVAL '24 hours' THEN 50 ELSE 0 END +
        COALESCE((
          SELECT SUM(uit.interest_score * 10)
          FROM user_interest_tags uit
          WHERE p.content ILIKE '%' || uit.name || '%'
        ), 0) +
        CASE 
          WHEN v_media_pref = 'video' AND p.media_type = 'video' THEN 20
          WHEN v_media_pref = 'photo' AND p.media_type IN ('image', 'photo') THEN 20
          ELSE 0
        END +
        COALESCE((
          SELECT CASE 
            WHEN promo.boost_level = 'premium' THEN 50
            WHEN promo.boost_level = 'standard' THEN 30
            ELSE 20
          END
          FROM promoted_posts promo
          WHERE promo.pid = p.id
        ), 0)
      )::REAL AS sp_relevance_score,
      (p.created_at > NOW() - INTERVAL '24 hours') AS sp_is_new_post,
      (EXISTS (SELECT 1 FROM promoted_posts promo WHERE promo.pid = p.id)) AS sp_is_promoted
    FROM posts p
    WHERE p.status = 'active'
      AND p.user_id NOT IN (SELECT blocked.bid FROM blocked)
      AND p.id NOT IN (SELECT viewed_today.vid FROM viewed_today)
      AND (
        p_media_filter = 'all'
        OR (p_media_filter = 'video' AND p.media_type = 'video')
        OR (p_media_filter = 'photo' AND p.media_type IN ('image', 'photo', 'styled_text'))
      )
      AND (
        p_feed_type = 'forYou'
        OR (p_feed_type = 'following' AND p.user_id IN (SELECT following_ids.fid FROM following_ids))
        OR (p_feed_type = 'explore' AND p.user_id NOT IN (SELECT following_ids.fid FROM following_ids) AND p.user_id != p_user_id)
      )
  )
  SELECT 
    sp.sp_id AS id, 
    sp.sp_user_id AS user_id, 
    sp.sp_content AS content, 
    sp.sp_media_url AS media_url, 
    sp.sp_media_type AS media_type, 
    sp.sp_media_urls AS media_urls, 
    sp.sp_media_types AS media_types,
    sp.sp_created_at AS created_at, 
    sp.sp_likes_count AS likes_count, 
    sp.sp_comments_count AS comments_count, 
    sp.sp_views_count AS views_count, 
    sp.sp_refeeds_count AS refeeds_count,
    sp.sp_location AS location, 
    sp.sp_post_type AS post_type, 
    sp.sp_original_post_id AS original_post_id, 
    sp.sp_relevance_score AS relevance_score, 
    sp.sp_is_new_post AS is_new_post, 
    sp.sp_is_promoted AS is_promoted
  FROM scored_posts sp
  ORDER BY sp.sp_is_new_post DESC, sp.sp_relevance_score DESC, sp.sp_created_at DESC
  LIMIT p_limit
  OFFSET p_offset + v_session_offset;
END;
$$;