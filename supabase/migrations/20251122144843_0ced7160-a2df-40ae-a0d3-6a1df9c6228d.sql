-- Add music columns to stories table for image stories with background music
ALTER TABLE public.stories 
ADD COLUMN music_url TEXT,
ADD COLUMN music_title TEXT,
ADD COLUMN music_artist TEXT;