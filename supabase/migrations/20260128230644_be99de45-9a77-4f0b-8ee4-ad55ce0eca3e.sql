-- Fix get_personalized_feed to INCLUDE user's own posts and prioritize them
CREATE OR REPLACE FUNCTION public.get_personalized_feed(p_user_id uuid, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, user_id uuid, content text, media_url text, media_type text, media_urls text[], media_types text[], created_at timestamp with time zone, likes_count integer, comments_count integer, views_count integer, refeeds_count integer, location text, post_type text, original_post_id uuid, relevance_score double precision)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        -- Prioritize user's own posts with a huge bonus
        CASE WHEN p.user_id = p_user_id THEN 1000 ELSE 0 END +
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
    WHERE p.status = 'active'
      -- REMOVED: p.user_id != p_user_id - Users should see their own posts!
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
$function$;

-- Also update the first version of get_feed_with_rotation to include own posts with priority
CREATE OR REPLACE FUNCTION public.get_feed_with_rotation(p_user_id uuid, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0, p_feed_type text DEFAULT 'forYou'::text, p_media_filter text DEFAULT 'all'::text)
 RETURNS TABLE(id uuid, user_id uuid, content text, media_url text, media_type text, media_urls text[], media_types text[], created_at timestamp with time zone, likes_count integer, comments_count integer, views_count integer, refeeds_count integer, location text, post_type text, original_post_id uuid, relevance_score real, is_new_post boolean, is_promoted boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        -- Prioritize user's own posts first
        CASE WHEN p.user_id = p_user_id THEN 500 ELSE 0 END +
        COALESCE(p.likes_count, 0) * 0.3 +
        COALESCE(p.comments_count, 0) * 0.5 +
        COALESCE(p.views_count, 0) * 0.01 +
        CASE WHEN p.created_at > NOW() - INTERVAL '24 hours' THEN 50 ELSE 0 END
      )::REAL AS sp_relevance_score,
      (p.created_at > NOW() - INTERVAL '24 hours') AS sp_is_new_post,
      (p.user_id = p_user_id) AS sp_is_promoted -- Use is_promoted to flag own posts
    FROM posts p
    WHERE p.status = 'active'
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
$function$;