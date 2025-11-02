-- Create storage buckets for posts, stories, and avatars
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('post-images', 'post-images', true),
  ('story-images', 'story-images', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist and recreate
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Anyone can view post images" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can upload post images" ON storage.objects;
  DROP POLICY IF EXISTS "Users can update their own post images" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete their own post images" ON storage.objects;
  DROP POLICY IF EXISTS "Anyone can view story images" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can upload story images" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete their own story images" ON storage.objects;
END $$;

-- Create storage policies for post-images bucket
CREATE POLICY "Anyone can view post images"
ON storage.objects FOR SELECT
USING (bucket_id = 'post-images');

CREATE POLICY "Authenticated users can upload post images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'post-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own post images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'post-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own post images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'post-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Create storage policies for story-images bucket
CREATE POLICY "Anyone can view story images"
ON storage.objects FOR SELECT
USING (bucket_id = 'story-images');

CREATE POLICY "Authenticated users can upload story images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'story-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own story images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'story-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Add last_free_enhancement column to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS last_free_enhancement timestamptz;

-- Add daily enhancement count for free users with credits
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS daily_enhancement_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_enhancement_reset timestamptz;

-- Update all existing user credits to 30
UPDATE user_credits SET balance = 30 WHERE balance > 30;