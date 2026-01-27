-- Make post-media publicly viewable (not just authenticated)
DROP POLICY IF EXISTS "Authenticated users can view post media" ON storage.objects;
CREATE POLICY "Public can view post media" ON storage.objects
FOR SELECT USING (bucket_id = 'post-media');

-- Ensure story-videos bucket exists for video stories
INSERT INTO storage.buckets (id, name, public)
VALUES ('story-videos', 'story-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Create policies for story-videos bucket
CREATE POLICY "Public can view story videos" ON storage.objects
FOR SELECT USING (bucket_id = 'story-videos');

CREATE POLICY "Authenticated users can upload story videos" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'story-videos' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own story videos" ON storage.objects
FOR UPDATE USING (bucket_id = 'story-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own story videos" ON storage.objects
FOR DELETE USING (bucket_id = 'story-videos' AND auth.uid()::text = (storage.foldername(name))[1]);