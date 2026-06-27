-- Add cover_url column to profiles if it doesn't exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_url TEXT;

-- Create function to count user's posts
CREATE OR REPLACE FUNCTION get_user_post_count(user_uuid UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER 
    FROM posts 
    WHERE user_id = user_uuid AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_user_post_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_post_count(UUID) TO anon;