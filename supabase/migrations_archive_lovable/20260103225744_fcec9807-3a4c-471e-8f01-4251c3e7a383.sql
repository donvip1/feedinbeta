-- Add stream health tracking columns to live_streams table
ALTER TABLE public.live_streams 
ADD COLUMN IF NOT EXISTS stream_ready boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS last_health_check timestamp with time zone,
ADD COLUMN IF NOT EXISTS connection_state text DEFAULT 'idle' CHECK (connection_state IN ('idle', 'initializing', 'publishing', 'live', 'reconnecting', 'ended'));

-- Create index for faster queries on stream state
CREATE INDEX IF NOT EXISTS idx_live_streams_connection_state ON public.live_streams(connection_state);
CREATE INDEX IF NOT EXISTS idx_live_streams_stream_ready ON public.live_streams(stream_ready) WHERE stream_ready = true;

-- Update the view to include new columns
DROP VIEW IF EXISTS live_streams_public;
CREATE VIEW live_streams_public AS
SELECT 
  id,
  user_id,
  title,
  description,
  status,
  category,
  viewer_count,
  peak_viewers,
  created_at,
  started_at,
  ended_at,
  scheduled_start,
  thumbnail_url,
  cf_hls_url,
  cf_webrtc_url,
  is_premium,
  tags,
  stream_ready,
  connection_state
FROM live_streams;

-- Grant access to the view
GRANT SELECT ON live_streams_public TO anon, authenticated;

-- Add comment for documentation
COMMENT ON COLUMN live_streams.stream_ready IS 'True when the HLS manifest is accessible and viewers can connect';
COMMENT ON COLUMN live_streams.connection_state IS 'Current connection state of the broadcast: idle, initializing, publishing, live, reconnecting, ended';
COMMENT ON COLUMN live_streams.last_health_check IS 'Last time the stream health was verified';