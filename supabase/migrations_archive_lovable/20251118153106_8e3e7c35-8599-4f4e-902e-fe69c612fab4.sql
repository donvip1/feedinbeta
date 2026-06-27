-- Fix RLS policies for cover image uploads to posts bucket

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload their own covers" ON storage.objects;
DROP POLICY IF EXISTS "Cover images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own covers" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own covers" ON storage.objects;

-- Allow users to upload cover images to their own folder
CREATE POLICY "Users can upload their own covers"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'posts' 
  AND (storage.foldername(name))[1] = 'covers'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Allow public read access to cover images
CREATE POLICY "Cover images are publicly accessible"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'posts' 
  AND (storage.foldername(name))[1] = 'covers'
);

-- Allow users to update their own cover images
CREATE POLICY "Users can update their own covers"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'posts' 
  AND (storage.foldername(name))[1] = 'covers'
  AND (storage.foldername(name))[2] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'posts' 
  AND (storage.foldername(name))[1] = 'covers'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Allow users to delete their own cover images
CREATE POLICY "Users can delete their own covers"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'posts' 
  AND (storage.foldername(name))[1] = 'covers'
  AND (storage.foldername(name))[2] = auth.uid()::text
);