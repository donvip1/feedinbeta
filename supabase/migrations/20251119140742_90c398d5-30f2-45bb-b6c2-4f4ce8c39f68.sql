-- Add field to track original post for refeeds
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS original_post_id UUID REFERENCES posts(id) ON DELETE CASCADE;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_posts_original_post_id ON posts(original_post_id) WHERE original_post_id IS NOT NULL;