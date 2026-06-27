-- Fix the get_feed_with_rotation function to NOT mark own posts as "promoted/sponsored"
-- is_promoted should only be true for actually promoted posts from feed_ads

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
SET search_path = public
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
  -- Get promoted posts from feed_ads that are active and within budget
  promoted_post_ids AS (
    SELECT fa.post_id 
    FROM feed_ads fa
    WHERE fa.status = 'active'
      AND fa.starts_at <= NOW()
      AND fa.ends_at >= NOW()
      AND fa.budget_spent < fa.budget
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
        -- Prioritize user's own posts first
        CASE WHEN p.user_id = p_user_id THEN 500 ELSE 0 END +
        COALESCE(p.likes_count, 0) * 0.3 +
        COALESCE(p.comments_count, 0) * 0.5 +
        COALESCE(p.views_count, 0) * 0.01 +
        CASE WHEN p.created_at > NOW() - INTERVAL '24 hours' THEN 50 ELSE 0 END
      )::REAL AS sp_relevance_score,
      (p.created_at > NOW() - INTERVAL '24 hours') AS sp_is_new_post,
      -- Only mark as promoted if it's an actual promoted ad
      (p.id IN (SELECT promoted_post_ids.post_id FROM promoted_post_ids)) AS sp_is_promoted
    FROM posts p
    WHERE p.status = 'active'
      AND p.user_id NOT IN (SELECT blocked.bid FROM blocked)
      AND (
        p_media_filter = 'all'
        OR (p_media_filter = 'video' AND p.media_type = 'video')
        OR (p_media_filter = 'photo' AND p.media_type IN ('image', 'photo', 'styled_text', 'text_plain'))
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
    sp.sp_relevance_score, sp.sp_is_new_post, sp.sp_is_promoted
  FROM scored_posts sp
  ORDER BY sp.sp_is_promoted DESC, sp.sp_is_new_post DESC, sp.sp_relevance_score DESC, sp.sp_created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Make feed_id nullable to allow text-only posts without requiring a feed_id
ALTER TABLE public.posts ALTER COLUMN feed_id DROP NOT NULL;

-- Add default value for feed_id when it's not provided
ALTER TABLE public.posts ALTER COLUMN feed_id SET DEFAULT gen_random_uuid()::text;