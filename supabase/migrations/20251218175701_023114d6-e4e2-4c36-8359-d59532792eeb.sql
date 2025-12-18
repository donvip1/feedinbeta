-- Add activity_type column to typing_indicators for contextual status
ALTER TABLE public.typing_indicators 
ADD COLUMN IF NOT EXISTS activity_type TEXT DEFAULT 'typing';

-- Add comment for documentation
COMMENT ON COLUMN public.typing_indicators.activity_type IS 'Type of activity: typing, emoji, media_upload';