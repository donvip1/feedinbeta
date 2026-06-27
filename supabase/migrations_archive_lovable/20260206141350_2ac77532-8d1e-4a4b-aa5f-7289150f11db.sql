-- Create user-content storage bucket for cover images and general user uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-content', 'user-content', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to user-content bucket
CREATE POLICY "Authenticated users can upload to user-content"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'user-content' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow public read access to user-content bucket
CREATE POLICY "Public can view user-content"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'user-content');

-- Allow users to update their own uploads in user-content
CREATE POLICY "Users can update own user-content"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'user-content' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to delete their own uploads in user-content
CREATE POLICY "Users can delete own user-content"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'user-content' AND auth.uid()::text = (storage.foldername(name))[1]);