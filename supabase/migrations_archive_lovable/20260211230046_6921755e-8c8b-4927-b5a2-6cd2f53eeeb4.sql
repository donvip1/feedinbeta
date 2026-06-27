
-- Add is_private column to live_streams table
ALTER TABLE public.live_streams ADD COLUMN IF NOT EXISTS is_private boolean DEFAULT false;

-- Add share_link column to live_streams for private link sharing
ALTER TABLE public.live_streams ADD COLUMN IF NOT EXISTS share_link text;
