-- Enable real-time updates for post_comments table
ALTER TABLE public.post_comments REPLICA IDENTITY FULL;

-- Add post_comments to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_comments;