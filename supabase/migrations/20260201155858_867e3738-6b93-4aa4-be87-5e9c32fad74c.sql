-- Create trigger function to update posts.gifts_count when gifts are added/removed
CREATE OR REPLACE FUNCTION public.update_post_gift_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Only update if this is a post gift (not live stream, etc.)
    IF NEW.source_type = 'post' AND NEW.source_id IS NOT NULL THEN
      UPDATE posts 
      SET gifts_count = COALESCE(gifts_count, 0) + 1
      WHERE id = NEW.source_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.source_type = 'post' AND OLD.source_id IS NOT NULL THEN
      UPDATE posts 
      SET gifts_count = GREATEST(COALESCE(gifts_count, 0) - 1, 0)
      WHERE id = OLD.source_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Create trigger on gift_analytics table
CREATE TRIGGER trigger_update_post_gift_count
  AFTER INSERT OR DELETE ON public.gift_analytics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_post_gift_count();

-- Sync existing gift counts for posts that already received gifts
UPDATE posts p
SET gifts_count = (
  SELECT COUNT(*) 
  FROM gift_analytics ga 
  WHERE ga.source_id = p.id 
  AND ga.source_type = 'post'
)
WHERE EXISTS (
  SELECT 1 FROM gift_analytics ga 
  WHERE ga.source_id = p.id 
  AND ga.source_type = 'post'
);