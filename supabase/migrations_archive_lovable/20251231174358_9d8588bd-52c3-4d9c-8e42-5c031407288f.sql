-- Add Cloudflare SFU session columns for live streaming
ALTER TABLE public.live_streams 
ADD COLUMN IF NOT EXISTS cloudflare_session_id TEXT,
ADD COLUMN IF NOT EXISTS sfu_track_name TEXT;