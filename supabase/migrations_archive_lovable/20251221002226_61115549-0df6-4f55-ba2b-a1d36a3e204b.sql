-- Add columns to music_tracks for original audio tracking
ALTER TABLE public.music_tracks 
ADD COLUMN IF NOT EXISTS original_post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS original_creator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS trim_start REAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS trim_end REAL;

-- Add column to posts for tracking if audio was saved as reusable sound
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS original_audio_track_id UUID REFERENCES public.music_tracks(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS music_trim_start REAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS music_trim_end REAL;

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_music_tracks_original_post ON public.music_tracks(original_post_id);
CREATE INDEX IF NOT EXISTS idx_music_tracks_original_creator ON public.music_tracks(original_creator_id);
CREATE INDEX IF NOT EXISTS idx_music_tracks_source ON public.music_tracks(source);
CREATE INDEX IF NOT EXISTS idx_music_tracks_genre ON public.music_tracks(genre);
CREATE INDEX IF NOT EXISTS idx_music_tracks_trending ON public.music_tracks(is_trending) WHERE is_trending = true;

-- Drop existing policies if they exist before recreating
DROP POLICY IF EXISTS "Users can create original audio tracks" ON public.music_tracks;
DROP POLICY IF EXISTS "Users can increment usage count" ON public.music_tracks;

-- Allow users to create original audio tracks
CREATE POLICY "Users can create original audio tracks"
ON public.music_tracks
FOR INSERT
WITH CHECK (auth.uid() = uploader_id OR uploader_id IS NULL);

-- Allow users to update usage_count
CREATE POLICY "Users can increment usage count"
ON public.music_tracks
FOR UPDATE
USING (true)
WITH CHECK (true);