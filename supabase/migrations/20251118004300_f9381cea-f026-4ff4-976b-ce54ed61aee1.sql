-- Add refeeds_count column to posts table
ALTER TABLE posts ADD COLUMN IF NOT EXISTS refeeds_count INTEGER DEFAULT 0;

-- Create trigger to update refeeds count
CREATE OR REPLACE FUNCTION update_post_refeeds_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.share_type = 'refeed' THEN
    UPDATE posts SET refeeds_count = refeeds_count + 1 WHERE id = NEW.post_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_update_refeeds_count
AFTER INSERT ON post_shares
FOR EACH ROW
EXECUTE FUNCTION update_post_refeeds_count();