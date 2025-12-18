
-- Make username UNIQUE and NOT NULL for referral and profile URL features
-- First, update any NULL usernames with a generated one
UPDATE profiles 
SET username = 'user_' || SUBSTRING(id::text, 1, 8)
WHERE username IS NULL OR username = '';

-- Add UNIQUE constraint to username
ALTER TABLE profiles 
ALTER COLUMN username SET NOT NULL;

-- Create unique index for fast username lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_unique 
ON profiles (LOWER(username));

-- Create function to get user by username
CREATE OR REPLACE FUNCTION get_user_by_username(p_username TEXT)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_id UUID;
BEGIN
  SELECT id INTO user_id
  FROM profiles
  WHERE LOWER(username) = LOWER(p_username);
  
  RETURN user_id;
END;
$$;

-- Create function to check username availability
CREATE OR REPLACE FUNCTION is_username_available(p_username TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if username is valid (alphanumeric, underscore, 3-30 chars)
  IF p_username !~ '^[a-zA-Z0-9_]{3,30}$' THEN
    RETURN FALSE;
  END IF;
  
  -- Check if username is not taken
  RETURN NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE LOWER(username) = LOWER(p_username)
  );
END;
$$;

-- Add referral_code column for future referral features
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES profiles(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_count INTEGER DEFAULT 0;

-- Generate unique referral codes for existing users
UPDATE profiles 
SET referral_code = UPPER(SUBSTRING(MD5(id::text || created_at::text), 1, 8))
WHERE referral_code IS NULL;

-- Create index for referral lookups
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON profiles(referral_code);
