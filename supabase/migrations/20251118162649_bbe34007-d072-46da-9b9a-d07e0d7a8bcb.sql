-- Add unique constraint to prevent duplicate views per user per post
ALTER TABLE post_views 
ADD CONSTRAINT post_views_user_post_unique UNIQUE (post_id, user_id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_post_views_post_user ON post_views(post_id, user_id);