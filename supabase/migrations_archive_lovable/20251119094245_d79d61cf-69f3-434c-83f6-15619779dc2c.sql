-- Create post-videos storage bucket for video uploads if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('post-videos', 'post-videos', true)
ON CONFLICT (id) DO NOTHING;