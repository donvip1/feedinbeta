-- Fix overly permissive music_tracks UPDATE policy
-- Remove the dangerous policy that allows anyone to update any track
DROP POLICY IF EXISTS "Users can increment usage count" ON public.music_tracks;

-- Create secure policy: Only uploaders can update their own tracks
CREATE POLICY "Uploaders can update their own tracks"
ON public.music_tracks
FOR UPDATE
TO authenticated
USING (auth.uid() = uploader_id)
WITH CHECK (auth.uid() = uploader_id);

-- Create a SECURITY DEFINER function to safely increment usage count
-- This allows the system to increment counts without giving users direct update access
CREATE OR REPLACE FUNCTION public.increment_music_track_usage(track_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE music_tracks 
  SET 
    usage_count = COALESCE(usage_count, 0) + 1,
    updated_at = now()
  WHERE id = track_id;
END;
$$;

-- Create a trigger to auto-increment usage when a post uses a music track
CREATE OR REPLACE FUNCTION public.track_music_usage_on_post()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  track_record RECORD;
BEGIN
  -- On INSERT: increment usage for the new track
  IF TG_OP = 'INSERT' AND NEW.music_url IS NOT NULL THEN
    SELECT id INTO track_record FROM music_tracks WHERE audio_url = NEW.music_url LIMIT 1;
    IF FOUND THEN
      UPDATE music_tracks 
      SET usage_count = COALESCE(usage_count, 0) + 1, updated_at = now()
      WHERE id = track_record.id;
    END IF;
  END IF;
  
  -- On UPDATE: handle track changes
  IF TG_OP = 'UPDATE' THEN
    -- Decrement old track if it changed
    IF OLD.music_url IS NOT NULL AND (NEW.music_url IS NULL OR NEW.music_url != OLD.music_url) THEN
      SELECT id INTO track_record FROM music_tracks WHERE audio_url = OLD.music_url LIMIT 1;
      IF FOUND THEN
        UPDATE music_tracks 
        SET usage_count = GREATEST(COALESCE(usage_count, 0) - 1, 0), updated_at = now()
        WHERE id = track_record.id;
      END IF;
    END IF;
    
    -- Increment new track if it's different
    IF NEW.music_url IS NOT NULL AND (OLD.music_url IS NULL OR NEW.music_url != OLD.music_url) THEN
      SELECT id INTO track_record FROM music_tracks WHERE audio_url = NEW.music_url LIMIT 1;
      IF FOUND THEN
        UPDATE music_tracks 
        SET usage_count = COALESCE(usage_count, 0) + 1, updated_at = now()
        WHERE id = track_record.id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS track_music_usage_trigger ON public.posts;

-- Create the trigger on posts table
CREATE TRIGGER track_music_usage_trigger
AFTER INSERT OR UPDATE OF music_url ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.track_music_usage_on_post();

-- Also create a function to increment play count (for when users play a track)
CREATE OR REPLACE FUNCTION public.increment_music_track_play(track_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE music_tracks 
  SET 
    play_count = COALESCE(play_count, 0) + 1,
    updated_at = now()
  WHERE id = track_id;
END;
$$;