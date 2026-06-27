-- Create a trigger to track post views and update total_views on profiles
CREATE OR REPLACE FUNCTION update_profile_total_views()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Update the total_views count for the post owner's profile
  UPDATE profiles
  SET total_views = (
    SELECT COALESCE(SUM(views_count), 0)
    FROM posts
    WHERE user_id = (SELECT user_id FROM posts WHERE id = NEW.post_id)
  )
  WHERE id = (SELECT user_id FROM posts WHERE id = NEW.post_id);
  
  RETURN NEW;
END;
$$;

-- Create trigger for post views
DROP TRIGGER IF EXISTS trigger_update_profile_total_views ON post_views;
CREATE TRIGGER trigger_update_profile_total_views
AFTER INSERT ON post_views
FOR EACH ROW
EXECUTE FUNCTION update_profile_total_views();