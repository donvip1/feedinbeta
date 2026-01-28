-- Fix get_feed_with_rotation to show ALL posts (not filter out viewed posts)
-- Users expect to see all posts in the feed, not just "unviewed" ones
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
        CASE WHEN p.created_at > NOW() - INTERVAL '24 hours' THEN 50 ELSE 0 END
      )::REAL AS sp_relevance_score,
      (p.created_at > NOW() - INTERVAL '24 hours') AS sp_is_new_post,
      false AS sp_is_promoted
    FROM posts p
    WHERE p.status = 'active'
      AND p.user_id NOT IN (SELECT blocked.bid FROM blocked)
      -- REMOVED: viewed posts filter - show ALL posts to users
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
    sp.sp_id, sp.sp_user_id, sp.sp_content, sp.sp_media_url, sp.sp_media_type, 
    sp.sp_media_urls, sp.sp_media_types, sp.sp_created_at, sp.sp_likes_count, 
    sp.sp_comments_count, sp.sp_views_count, sp.sp_refeeds_count,
    sp.sp_location, sp.sp_post_type, sp.sp_original_post_id, 
    sp.sp_relevance_score, sp.sp_is_new_post, sp.sp_is_promoted
  FROM scored_posts sp
  ORDER BY sp.sp_is_new_post DESC, sp.sp_relevance_score DESC, sp.sp_created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;