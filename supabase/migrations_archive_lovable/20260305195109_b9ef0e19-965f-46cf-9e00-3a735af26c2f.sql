
-- Add co-broadcast support columns
ALTER TABLE public.live_stream_viewers 
  ADD COLUMN IF NOT EXISTS is_co_broadcaster boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS role text DEFAULT 'viewer',
  ADD COLUMN IF NOT EXISTS is_mic_on boolean DEFAULT false;
