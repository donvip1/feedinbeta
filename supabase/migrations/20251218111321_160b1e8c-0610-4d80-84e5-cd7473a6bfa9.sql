-- Fix all posts with incorrect refeed counts (set to actual count from post_shares)
UPDATE posts 
SET refeeds_count = (
  SELECT COUNT(*) 
  FROM post_shares 
  WHERE post_shares.post_id = posts.id
)
WHERE id IN (
  SELECT DISTINCT p.id 
  FROM posts p 
  LEFT JOIN post_shares ps ON ps.post_id = p.id
  GROUP BY p.id
  HAVING p.refeeds_count != COUNT(ps.id)
);

-- Ensure the correct single trigger exists for refeed count updates
DROP TRIGGER IF EXISTS on_post_share_change ON public.post_shares;

CREATE OR REPLACE FUNCTION public.update_post_refeeds_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET refeeds_count = COALESCE(refeeds_count, 0) + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET refeeds_count = GREATEST(COALESCE(refeeds_count, 0) - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER on_post_share_change
AFTER INSERT OR DELETE ON public.post_shares
FOR EACH ROW EXECUTE FUNCTION public.update_post_refeeds_count();