-- Add RLS policies for storage buckets to allow authenticated users to upload

-- Posts bucket policies
DROP POLICY IF EXISTS "Authenticated users can upload to posts bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update their posts uploads" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete their posts uploads" ON storage.objects;
DROP POLICY IF EXISTS "Public can view posts" ON storage.objects;

CREATE POLICY "Authenticated users can upload to posts bucket"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'posts');

CREATE POLICY "Authenticated users can update their posts uploads"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'posts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Authenticated users can delete their posts uploads"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'posts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Public can view posts"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'posts');

-- Post-images bucket policies
DROP POLICY IF EXISTS "Authenticated users can upload to post-images bucket" ON storage.objects;
DROP POLICY IF EXISTS "Public can view post-images" ON storage.objects;

CREATE POLICY "Authenticated users can upload to post-images bucket"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'post-images');

CREATE POLICY "Public can view post-images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'post-images');

-- Post-videos bucket policies
DROP POLICY IF EXISTS "Authenticated users can upload to post-videos bucket" ON storage.objects;
DROP POLICY IF EXISTS "Public can view post-videos" ON storage.objects;

CREATE POLICY "Authenticated users can upload to post-videos bucket"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'post-videos');

CREATE POLICY "Public can view post-videos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'post-videos');

-- Story-images bucket policies
DROP POLICY IF EXISTS "Authenticated users can upload to story-images bucket" ON storage.objects;
DROP POLICY IF EXISTS "Public can view story-images" ON storage.objects;

CREATE POLICY "Authenticated users can upload to story-images bucket"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'story-images');

CREATE POLICY "Public can view story-images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'story-images');

-- Remove the post_type check constraint if it exists and is too restrictive
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_post_type_check;