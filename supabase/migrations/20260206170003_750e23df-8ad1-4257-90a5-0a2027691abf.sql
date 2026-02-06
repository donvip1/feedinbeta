-- Add missing columns to live_stream_viewers for video broadcast hand raise and mute support
ALTER TABLE live_stream_viewers 
ADD COLUMN IF NOT EXISTS host_muted boolean DEFAULT false;

ALTER TABLE live_stream_viewers 
ADD COLUMN IF NOT EXISTS has_raised_hand boolean DEFAULT false;

ALTER TABLE live_stream_viewers 
ADD COLUMN IF NOT EXISTS hand_raised_at timestamptz;

-- Create index for faster hand raise queries
CREATE INDEX IF NOT EXISTS idx_live_stream_viewers_raised_hand 
ON live_stream_viewers(stream_id, has_raised_hand) 
WHERE has_raised_hand = true AND is_active = true;