-- Fix security issue: Set search_path for get_personalized_feed function
CREATE OR REPLACE FUNCTION get_personalized_feed(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  feed_id TEXT,
  user_id UUID,
  content TEXT,
  media_url TEXT,
  media_type TEXT,
  likes_count INTEGER,
  comments_count INTEGER,
  views_count INTEGER,
  created_at TIMESTAMPTZ,
  relevance_score NUMERIC
) 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH user_profile AS (
    SELECT location, country, interests
    FROM profiles
    WHERE id = p_user_id
  ),
  user_interactions AS (
    SELECT DISTINCT p.user_id as interacted_user_id
    FROM post_likes pl
    JOIN posts p ON pl.post_id = p.id
    WHERE pl.user_id = p_user_id
    UNION
    SELECT DISTINCT p.user_id
    FROM comments c
    JOIN posts p ON c.post_id = p.id
    WHERE c.user_id = p_user_id
  )
  SELECT 
    p.id,
    p.feed_id,
    p.user_id,
    p.content,
    p.media_url,
    p.media_type,
    p.likes_count,
    p.comments_count,
    p.views_count,
    p.created_at,
    (
      (EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600)::NUMERIC * -0.1 +
      CASE 
        WHEN prof.location = up.location THEN 5
        WHEN prof.country = up.country THEN 3
        ELSE 0
      END +
      CASE 
        WHEN prof.interests && up.interests THEN 
          (SELECT COUNT(*) FROM unnest(prof.interests) 
           WHERE unnest = ANY(up.interests))::NUMERIC * 2
        ELSE 0
      END +
      (p.likes_count * 0.5 + p.comments_count * 1.0 + p.views_count * 0.1) +
      CASE 
        WHEN EXISTS (SELECT 1 FROM user_interactions WHERE interacted_user_id = p.user_id) 
        THEN 4
        ELSE 0
      END +
      (RANDOM() * 3)
    )::NUMERIC as relevance_score
  FROM posts p
  JOIN profiles prof ON prof.id = p.user_id
  CROSS JOIN user_profile up
  WHERE p.status = 'active'
    AND p.user_id != p_user_id
  ORDER BY relevance_score DESC, p.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;