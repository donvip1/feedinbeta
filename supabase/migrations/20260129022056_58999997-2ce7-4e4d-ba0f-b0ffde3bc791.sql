-- Update get_feed_with_rotation to only boost own posts if they're new and unseen by the poster
-- After the user views their own post once, it should shuffle randomly like all other posts

CREATE OR REPLACE FUNCTION get_feed_with_rotation(
  p_user_id UUID,
  p_feed_type TEXT,
  p_media_filter TEXT,
  p_limit INT,
  p_offset INT,
  p_session_id TEXT
)
RETURNS TABLE (
  post_id UUID,
  user_id UUID,
  content TEXT,
  media_url TEXT,
  media_type TEXT,
  media_urls TEXT[],
  media_types TEXT[],
  created_at TIMESTAMPTZ,
  likes_count INT,
  comments_count INT,
  views_count INT,
  refeeds_count INT,
  location TEXT,
  post_type TEXT,
  original_post_id UUID,
  is_promoted BOOLEAN,
  is_own_post BOOLEAN,
  is_new_post BOOLEAN,
  relevance_score FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_following_ids UUID[];
BEGIN
  -- Get following IDs if needed for following feed
  IF p_feed_type = 'following' THEN
    SELECT ARRAY_AGG(following_id) INTO v_following_ids
    FROM follows
    WHERE follower_id = p_user_id;
  END IF;

  RETURN QUERY
  WITH scored_posts AS (
    SELECT 
      p.id AS sp_post_id,
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
      COALESCE(p.is_promoted, FALSE) AS sp_is_promoted,
      (p.user_id = p_user_id) AS sp_is_own_post,
      (p.created_at > NOW() - INTERVAL '24 hours') AS sp_is_new_post,
      -- Check if this is the user's own post AND they haven't viewed it yet
      -- Only boost if it's their post, it's new (within 24h), and they haven't viewed it
      (p.user_id = p_user_id AND 
       p.created_at > NOW() - INTERVAL '24 hours' AND 
       NOT EXISTS (
         SELECT 1 FROM post_views pv 
         WHERE pv.post_id = p.id 
         AND pv.user_id = p_user_id
       )
      ) AS sp_is_unseen_own_post
    FROM posts p
    WHERE p.status = 'active'
      -- Media filter
      AND (
        p_media_filter = 'all'
        OR (p_media_filter = 'video' AND (
          p.media_type LIKE 'video%' 
          OR EXISTS (SELECT 1 FROM unnest(p.media_types) mt WHERE mt LIKE 'video%')
        ))
        OR (p_media_filter = 'photo' AND (
          p.media_type LIKE 'image%' 
          OR p.post_type = 'text'
          OR EXISTS (SELECT 1 FROM unnest(p.media_types) mt WHERE mt LIKE 'image%')
        ))
      )
      -- Feed type filter
      AND (
        p_feed_type = 'forYou'
        OR p_feed_type = 'explore'
        OR (p_feed_type = 'following' AND (
          p.user_id = ANY(v_following_ids) OR p.user_id = p_user_id
        ))
      )
  )
  SELECT 
    sp.sp_post_id,
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
    sp.sp_is_promoted,
    sp.sp_is_own_post,
    sp.sp_is_new_post,
    -- Relevance score calculation:
    -- Only boost own posts if they're unseen (first time after posting)
    -- After viewing, own posts get random treatment like all others
    (
      -- Unseen own posts get highest priority (only once after posting)
      CASE WHEN sp.sp_is_unseen_own_post THEN 2000 ELSE 0 END +
      -- Promoted content bonus
      CASE WHEN sp.sp_is_promoted THEN 500 ELSE 0 END +
      -- New posts bonus (within 24 hours)
      CASE WHEN sp.sp_is_new_post THEN 100 ELSE 0 END +
      -- Engagement score
      (sp.sp_likes_count * 0.5 + sp.sp_comments_count * 2 + sp.sp_refeeds_count * 3) +
      -- Session-based randomization for variety
      (RANDOM() * 50)
    )::FLOAT AS relevance_score
  FROM scored_posts sp
  -- Order: unseen own posts first, then by relevance score (which includes randomization)
  ORDER BY 
    sp.sp_is_unseen_own_post DESC,
    relevance_score DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;