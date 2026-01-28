-- Update get_randomized_feed_cycle to prioritize user's own posts at the top
CREATE OR REPLACE FUNCTION public.get_randomized_feed_cycle(
  p_user_id uuid, 
  p_limit integer DEFAULT 20, 
  p_media_filter text DEFAULT 'all'::text
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
  is_promoted boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH 
  blocked AS (
    SELECT bu.blocked_id FROM blocked_users bu WHERE bu.blocker_id = p_user_id
    UNION
    SELECT bu2.blocker_id FROM blocked_users bu2 WHERE bu2.blocked_id = p_user_id
  ),
  promoted_posts AS (
    SELECT pp.post_id FROM post_promotions pp
    WHERE pp.is_active = true AND pp.expires_at > NOW()
  )
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
    (EXISTS (SELECT 1 FROM promoted_posts promo WHERE promo.post_id = p.id)) AS is_promoted
  FROM posts p
  WHERE p.status = 'active'
    AND p.user_id NOT IN (SELECT blocked.blocked_id FROM blocked)
    AND (
      p_media_filter = 'all'
      OR (p_media_filter = 'video' AND p.media_type = 'video')
      OR (p_media_filter = 'photo' AND p.media_type IN ('image', 'photo', 'styled_text'))
    )
  ORDER BY 
    -- User's own posts always come first
    (p.user_id = p_user_id) DESC,
    -- Then randomize the rest
    md5(p.id::text || p_user_id::text || CURRENT_DATE::text)
  LIMIT p_limit;
END;
$function$;