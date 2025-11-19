-- Add missing fields for about and purpose visibility/timestamps
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS about_updated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS about_visibility TEXT DEFAULT 'public' CHECK (about_visibility IN ('public', 'friends', 'followers'));