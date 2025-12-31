-- Add Cloudflare Stream columns to live_streams table
ALTER TABLE public.live_streams 
ADD COLUMN IF NOT EXISTS cf_live_input_id text,
ADD COLUMN IF NOT EXISTS cf_webrtc_url text,
ADD COLUMN IF NOT EXISTS cf_hls_url text,
ADD COLUMN IF NOT EXISTS cf_recording_uid text;

-- Add index for faster lookups by Cloudflare Live Input ID
CREATE INDEX IF NOT EXISTS idx_live_streams_cf_live_input_id ON public.live_streams(cf_live_input_id);