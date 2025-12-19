-- Make chat-media bucket public for media URLs to work
UPDATE storage.buckets SET public = true WHERE id = 'chat-media';

-- Ensure proper RLS policies for chat-media bucket
-- Allow public read access (needed for media to display)
DROP POLICY IF EXISTS "Public read access for chat-media" ON storage.objects;
CREATE POLICY "Public read access for chat-media"
ON storage.objects
FOR SELECT
USING (bucket_id = 'chat-media');

-- Keep write restricted to authenticated users
DROP POLICY IF EXISTS "Authenticated users can upload chat media" ON storage.objects;
CREATE POLICY "Authenticated users can upload chat media"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'chat-media' AND auth.role() = 'authenticated');

-- Allow users to delete their own uploads
DROP POLICY IF EXISTS "Users can delete own chat media" ON storage.objects;
CREATE POLICY "Users can delete own chat media"
ON storage.objects
FOR DELETE
USING (bucket_id = 'chat-media' AND auth.uid()::text = (storage.foldername(name))[1]);