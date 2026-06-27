-- Fix view counting to ensure each user only counts once per post

-- 1. Add unique constraint to prevent duplicate views from same user
ALTER TABLE public.post_views
DROP CONSTRAINT IF EXISTS post_views_user_post_unique;

ALTER TABLE public.post_views
ADD CONSTRAINT post_views_user_post_unique UNIQUE (post_id, user_id);

-- 2. Recalculate all post view counts based on distinct users
UPDATE public.posts
SET views_count = (
  SELECT COUNT(DISTINCT user_id)
  FROM public.post_views
  WHERE post_views.post_id = posts.id
)
WHERE EXISTS (
  SELECT 1 FROM public.post_views WHERE post_views.post_id = posts.id
);

-- 3. Update the trigger to only increment on successful insert (new unique view)
-- The trigger will now only fire on successful inserts, which are guaranteed unique
-- No changes needed to the trigger function itself since the unique constraint handles it

-- 4. Do the same for story views
ALTER TABLE public.story_views
DROP CONSTRAINT IF EXISTS story_views_user_story_unique;

ALTER TABLE public.story_views
ADD CONSTRAINT story_views_user_story_unique UNIQUE (story_id, user_id);

-- 5. Recalculate all story view counts
UPDATE public.stories
SET views_count = (
  SELECT COUNT(DISTINCT user_id)
  FROM public.story_views
  WHERE story_views.story_id = stories.id
)
WHERE EXISTS (
  SELECT 1 FROM public.story_views WHERE story_views.story_id = stories.id
);

-- 6. Fix profile total_views calculation trigger
CREATE OR REPLACE FUNCTION public.update_profile_total_views()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Update the total_views count for the post owner's profile
  -- Now using the corrected views_count which represents unique viewers
  UPDATE profiles
  SET total_views = (
    SELECT COALESCE(SUM(views_count), 0)
    FROM posts
    WHERE user_id = (SELECT user_id FROM posts WHERE id = NEW.post_id)
    AND status = 'active'
  )
  WHERE id = (SELECT user_id FROM posts WHERE id = NEW.post_id);
  
  RETURN NEW;
END;
$$;