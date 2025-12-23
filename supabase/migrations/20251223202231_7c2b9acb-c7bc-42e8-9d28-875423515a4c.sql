-- Add host mute control columns to live_space_speakers
ALTER TABLE public.live_space_speakers 
ADD COLUMN IF NOT EXISTS host_muted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS mic_allowed BOOLEAN DEFAULT true;

-- Add global mic control to live_spaces
ALTER TABLE public.live_spaces 
ADD COLUMN IF NOT EXISTS allow_mic_for_all BOOLEAN DEFAULT true;

-- Add comments for documentation
COMMENT ON COLUMN public.live_space_speakers.host_muted IS 'True if host has muted this user - user cannot unmute themselves';
COMMENT ON COLUMN public.live_space_speakers.mic_allowed IS 'True if user has permission to use mic';
COMMENT ON COLUMN public.live_spaces.allow_mic_for_all IS 'True if all users can use mic, false if host must grant permission';