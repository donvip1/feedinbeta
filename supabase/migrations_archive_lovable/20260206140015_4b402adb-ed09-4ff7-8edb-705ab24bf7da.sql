-- Add cover image URL column to live_streams and live_spaces
ALTER TABLE public.live_streams 
ADD COLUMN IF NOT EXISTS cover_image_url TEXT DEFAULT NULL;

ALTER TABLE public.live_spaces 
ADD COLUMN IF NOT EXISTS cover_image_url TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.live_streams.cover_image_url IS 'Optional cover image for the live stream event';
COMMENT ON COLUMN public.live_spaces.cover_image_url IS 'Optional cover image for the live space event';