-- Add missing columns to posts table
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS privacy text DEFAULT 'public',
ADD COLUMN IF NOT EXISTS location text,
ADD COLUMN IF NOT EXISTS allow_comments boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS allow_refeed boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS scheduled_at timestamp with time zone;