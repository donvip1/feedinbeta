-- Add hashtags column to live_streams table
ALTER TABLE public.live_streams 
ADD COLUMN IF NOT EXISTS hashtags TEXT[] DEFAULT NULL;

-- Add hashtags column to live_spaces table
ALTER TABLE public.live_spaces 
ADD COLUMN IF NOT EXISTS hashtags TEXT[] DEFAULT NULL;

-- Create index for hashtag searches on both tables
CREATE INDEX IF NOT EXISTS idx_live_streams_hashtags ON public.live_streams USING GIN(hashtags);
CREATE INDEX IF NOT EXISTS idx_live_spaces_hashtags ON public.live_spaces USING GIN(hashtags);