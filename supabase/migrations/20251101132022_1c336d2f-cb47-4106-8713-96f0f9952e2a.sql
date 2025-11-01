-- Drop the problematic SECURITY DEFINER view
DROP VIEW IF EXISTS public.active_stories;

-- Recreate the view without SECURITY DEFINER (it defaults to SECURITY INVOKER which is safe)
CREATE VIEW public.active_stories WITH (security_invoker = true) AS
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