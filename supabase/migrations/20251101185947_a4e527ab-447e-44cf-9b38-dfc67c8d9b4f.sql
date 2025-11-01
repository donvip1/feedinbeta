-- Add location and interests to profiles for personalized feeds
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS country TEXT,
ADD COLUMN IF NOT EXISTS interests TEXT[];

-- Create index for better performance on interests queries
CREATE INDEX IF NOT EXISTS idx_profiles_interests ON public.profiles USING GIN(interests);
CREATE INDEX IF NOT EXISTS idx_profiles_location ON public.profiles(location);

-- Create function to get personalized feed
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
) AS $$
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
    -- Calculate relevance score
    (
      -- Base time decay score (more recent = higher score)
      (EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600)::NUMERIC * -0.1 +
      
      -- Location match bonus
      CASE 
        WHEN prof.location = up.location THEN 5
        WHEN prof.country = up.country THEN 3
        ELSE 0
      END +
      
      -- Interest overlap bonus
      CASE 
        WHEN prof.interests && up.interests THEN 
          (SELECT COUNT(*) FROM unnest(prof.interests) 
           WHERE unnest = ANY(up.interests))::NUMERIC * 2
        ELSE 0
      END +
      
      -- Engagement score
      (p.likes_count * 0.5 + p.comments_count * 1.0 + p.views_count * 0.1) +
      
      -- Previous interaction bonus
      CASE 
        WHEN EXISTS (SELECT 1 FROM user_interactions WHERE interacted_user_id = p.user_id) 
        THEN 4
        ELSE 0
      END +
      
      -- Random factor for variety
      (RANDOM() * 3)
    )::NUMERIC as relevance_score
  FROM posts p
  JOIN profiles prof ON prof.id = p.user_id
  CROSS JOIN user_profile up
  WHERE p.status = 'active'
    AND p.user_id != p_user_id  -- Don't show own posts
  ORDER BY relevance_score DESC, p.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;