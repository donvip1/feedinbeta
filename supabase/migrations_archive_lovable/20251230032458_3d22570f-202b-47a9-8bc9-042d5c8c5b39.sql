-- Add Cloudflare SFU session tracking columns
ALTER TABLE public.live_spaces 
ADD COLUMN IF NOT EXISTS cloudflare_session_id TEXT;

ALTER TABLE public.live_space_speakers 
ADD COLUMN IF NOT EXISTS cloudflare_session_id TEXT;

ALTER TABLE public.live_space_speakers 
ADD COLUMN IF NOT EXISTS cloudflare_track_id TEXT;

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_live_space_speakers_track ON public.live_space_speakers(cloudflare_session_id, cloudflare_track_id) WHERE cloudflare_track_id IS NOT NULL;