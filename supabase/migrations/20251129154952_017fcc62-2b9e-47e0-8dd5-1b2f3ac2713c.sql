-- Drop duplicate notification triggers (causing double notifications)
DROP TRIGGER IF EXISTS notify_on_comment ON post_comments;
DROP TRIGGER IF EXISTS notify_on_like ON post_likes;

-- Enable real-time for posts table so counters sync across all users
ALTER PUBLICATION supabase_realtime ADD TABLE posts;