-- Drop existing function to recreate with new signature
DROP FUNCTION IF EXISTS public.get_personalized_feed(UUID, INTEGER, INTEGER);

-- Function to get AI-ranked feed posts
CREATE OR REPLACE FUNCTION public.get_personalized_feed(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
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
  relevance_score FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH user_interest_hashtags AS (
    SELECT ui.hashtag_id, ui.interest_score
    FROM user_interests ui
    WHERE ui.user_id = p_user_id
  ),
  post_scores AS (
    SELECT 
      p.id,
      p.user_id,
      p.content,
      p.media_url,
      p.media_type,
      p.media_urls,
      p.media_types,
      p.created_at,
      COALESCE(p.likes_count, 0) as likes_count,
      COALESCE(p.comments_count, 0) as comments_count,
      COALESCE(p.views_count, 0) as views_count,
      COALESCE(p.refeeds_count, 0) as refeeds_count,
      p.location,
      p.post_type,
      p.original_post_id,
      (
        COALESCE(p.likes_count, 0) * 1.0 +
        COALESCE(p.comments_count, 0) * 2.0 +
        COALESCE(p.views_count, 0) * 0.1 +
        COALESCE((
          SELECT SUM(uih.interest_score * 5)
          FROM post_hashtags ph
          JOIN user_interest_hashtags uih ON uih.hashtag_id = ph.hashtag_id
          WHERE ph.post_id = p.id
        ), 0) +
        CASE 
          WHEN p.created_at > now() - interval '24 hours' THEN 50
          WHEN p.created_at > now() - interval '7 days' THEN 20
          ELSE 0
        END +
        random() * 10
      ) as relevance_score
    FROM posts p
    WHERE p.user_id != p_user_id
      AND NOT EXISTS (
        SELECT 1 FROM blocked_users bu 
        WHERE (bu.blocker_id = p_user_id AND bu.blocked_id = p.user_id)
           OR (bu.blocked_id = p_user_id AND bu.blocker_id = p.user_id)
      )
  )
  SELECT 
    ps.id,
    ps.user_id,
    ps.content,
    ps.media_url,
    ps.media_type,
    ps.media_urls,
    ps.media_types,
    ps.created_at,
    ps.likes_count::INTEGER,
    ps.comments_count::INTEGER,
    ps.views_count::INTEGER,
    ps.refeeds_count::INTEGER,
    ps.location,
    ps.post_type,
    ps.original_post_id,
    ps.relevance_score
  FROM post_scores ps
  ORDER BY ps.relevance_score DESC, ps.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;