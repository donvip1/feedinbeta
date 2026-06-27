-- Fix function security by setting search_path
CREATE OR REPLACE FUNCTION get_post_view_count(post_id_param uuid)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COUNT(DISTINCT user_id)
  FROM post_views
  WHERE post_id = post_id_param;
$$;