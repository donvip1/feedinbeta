-- Create a trigger function to automatically delete expired stories
CREATE OR REPLACE FUNCTION public.cleanup_expired_stories()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete stories that have expired
  DELETE FROM public.stories
  WHERE expires_at <= NOW();
  
  RAISE NOTICE 'Expired stories cleaned up';
END;
$$;

-- Note: Since Lovable Cloud doesn't support pg_cron directly, 
-- we'll handle cleanup via application logic and manual triggers
-- The function above can be called from edge functions or client-side periodically

-- Create a view to easily see active stories
CREATE OR REPLACE VIEW public.active_stories AS
SELECT 
  s.*,
  p.display_name,
  p.username,
  p.avatar_url,
  (SELECT COUNT(*) FROM story_views WHERE story_id = s.id) as view_count
FROM stories s
JOIN profiles p ON s.user_id = p.id
WHERE s.expires_at > NOW()
ORDER BY s.created_at DESC;