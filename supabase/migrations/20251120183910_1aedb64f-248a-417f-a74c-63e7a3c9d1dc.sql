-- Enable RLS on saved_posts if not already enabled
ALTER TABLE saved_posts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can save posts" ON saved_posts;
DROP POLICY IF EXISTS "Users can unsave posts" ON saved_posts;
DROP POLICY IF EXISTS "Users can view their saved posts" ON saved_posts;

-- Create policies for saved_posts
CREATE POLICY "Users can save posts"
ON saved_posts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unsave posts"
ON saved_posts
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can view their saved posts"
ON saved_posts
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);