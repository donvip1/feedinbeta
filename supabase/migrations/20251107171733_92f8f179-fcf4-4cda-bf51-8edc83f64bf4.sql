-- Add music metadata columns to posts table
ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS music_title TEXT,
ADD COLUMN IF NOT EXISTS music_artist TEXT,
ADD COLUMN IF NOT EXISTS music_url TEXT,
ADD COLUMN IF NOT EXISTS is_original_audio BOOLEAN DEFAULT true;

-- Create music storage bucket for trending songs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'music',
  'music',
  true,
  10485760, -- 10MB limit
  ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for music bucket
CREATE POLICY "Music files are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'music');

CREATE POLICY "Authenticated users can upload music"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'music' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can update their own music"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'music' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own music"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'music' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);