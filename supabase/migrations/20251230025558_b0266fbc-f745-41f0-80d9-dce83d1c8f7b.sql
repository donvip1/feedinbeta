-- Add Cloudflare SFU session ID to live_spaces table
ALTER TABLE public.live_spaces 
ADD COLUMN IF NOT EXISTS cloudflare_session_id TEXT;

-- Add Cloudflare SFU track ID to live_space_speakers table
ALTER TABLE public.live_space_speakers 
ADD COLUMN IF NOT EXISTS cloudflare_track_id TEXT;