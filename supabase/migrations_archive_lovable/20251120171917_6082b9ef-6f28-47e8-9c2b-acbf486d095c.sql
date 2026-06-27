-- Drop the existing media_type check constraint
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_media_type_check;

-- Create a new check constraint that includes all valid media types
ALTER TABLE public.posts 
ADD CONSTRAINT posts_media_type_check 
CHECK (media_type IN ('text', 'image', 'video', 'text_styled') OR media_type IS NULL);