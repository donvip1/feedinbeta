-- Music tracks table
CREATE TABLE IF NOT EXISTS public.music_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  artist TEXT,
  audio_url TEXT NOT NULL,
  duration_seconds INTEGER,
  genre TEXT,
  is_copyright_free BOOLEAN DEFAULT true,
  source TEXT DEFAULT 'system',
  uploader_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  preview_url TEXT,
  cover_image_url TEXT,
  is_trending BOOLEAN DEFAULT false,
  play_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.music_tracks ENABLE ROW LEVEL SECURITY;

-- RLS policies for music_tracks (public read, authenticated upload)
CREATE POLICY "Anyone can view music tracks" ON public.music_tracks
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can upload music" ON public.music_tracks
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own uploaded music" ON public.music_tracks
  FOR UPDATE USING (auth.uid() = uploader_id);

CREATE POLICY "Users can delete own uploaded music" ON public.music_tracks
  FOR DELETE USING (auth.uid() = uploader_id);

-- Create music storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'music-tracks',
  'music-tracks',
  true,
  52428800,
  ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/aac', 'audio/ogg']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies for music-tracks bucket
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view music files' AND tablename = 'objects') THEN
    CREATE POLICY "Anyone can view music files" ON storage.objects
      FOR SELECT USING (bucket_id = 'music-tracks');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can upload music files' AND tablename = 'objects') THEN
    CREATE POLICY "Authenticated users can upload music files" ON storage.objects
      FOR INSERT WITH CHECK (bucket_id = 'music-tracks' AND auth.uid() IS NOT NULL);
  END IF;
END $$;