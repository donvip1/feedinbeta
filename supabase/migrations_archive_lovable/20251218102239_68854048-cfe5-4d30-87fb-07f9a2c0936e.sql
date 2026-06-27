-- Create a trigger to automatically update refeeds_count when shares are added/removed
CREATE OR REPLACE FUNCTION update_post_refeeds_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment count on insert
    UPDATE posts 
    SET refeeds_count = COALESCE(refeeds_count, 0) + 1
    WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement count on delete
    UPDATE posts 
    SET refeeds_count = GREATEST(COALESCE(refeeds_count, 0) - 1, 0)
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_post_share_change ON post_shares;

-- Create the trigger
CREATE TRIGGER on_post_share_change
AFTER INSERT OR DELETE ON post_shares
FOR EACH ROW
EXECUTE FUNCTION update_post_refeeds_count();

-- Fix existing data: sync refeeds_count with actual count from post_shares
UPDATE posts p
SET refeeds_count = (
  SELECT COUNT(*) 
  FROM post_shares ps 
  WHERE ps.post_id = p.id
)
WHERE EXISTS (
  SELECT 1 FROM post_shares ps WHERE ps.post_id = p.id
);