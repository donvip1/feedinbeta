-- Fix post-media INSERT policy (this is the missing one causing the error!)
CREATE POLICY "Authenticated users can upload to post-media" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'post-media' AND auth.role() = 'authenticated');

-- Ensure UPDATE and DELETE policies exist for post-media
CREATE POLICY "Users can update their own post-media" ON storage.objects
FOR UPDATE USING (bucket_id = 'post-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own post-media" ON storage.objects
FOR DELETE USING (bucket_id = 'post-media' AND auth.uid()::text = (storage.foldername(name))[1]);