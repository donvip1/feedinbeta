-- Drop the existing check constraint that requires media_type
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_media_type_check;

-- Add a new constraint that allows null media_type for text-only posts
ALTER TABLE public.posts ADD CONSTRAINT posts_media_type_check 
CHECK (media_type IS NULL OR media_type IN ('image', 'video', 'photo_plus'));