
-- Create recordings storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('recordings', 'recordings', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload recordings
CREATE POLICY "Authenticated users can upload recordings"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'recordings');

-- Allow public read access to recordings
CREATE POLICY "Public can view recordings"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'recordings');

-- Allow owners to delete their recordings
CREATE POLICY "Users can delete own recordings"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'recordings' AND auth.uid()::text = (storage.foldername(name))[1]);
