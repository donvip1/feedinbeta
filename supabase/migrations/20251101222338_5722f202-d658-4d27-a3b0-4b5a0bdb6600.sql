-- First update all existing usernames to lowercase
UPDATE profiles SET username = lower(username) WHERE username IS NOT NULL AND username != lower(username);

-- Add new fields to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS last_username_change timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS status text,
ADD COLUMN IF NOT EXISTS status_updated_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS about text,
ADD COLUMN IF NOT EXISTS purpose text,
ADD COLUMN IF NOT EXISTS marital_status text,
ADD COLUMN IF NOT EXISTS total_views integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_premium boolean DEFAULT false;

-- Add check constraint for marital status
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS marital_status_check;
ALTER TABLE profiles ADD CONSTRAINT marital_status_check CHECK (marital_status IN ('single', 'married', 'other', NULL));

-- Add constraint to enforce lowercase usernames
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS username_lowercase;
ALTER TABLE profiles ADD CONSTRAINT username_lowercase CHECK (username = lower(username));

-- Add index for username lookups
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);

-- Create function to check if user can change username (once every 2 months)
CREATE OR REPLACE FUNCTION can_change_username(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  last_change timestamp with time zone;
  is_admin boolean;
BEGIN
  -- Check if user is admin
  SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_roles.user_id = can_change_username.user_id AND role = 'admin') INTO is_admin;
  
  IF is_admin THEN
    RETURN true;
  END IF;
  
  -- Check last username change
  SELECT last_username_change INTO last_change
  FROM profiles
  WHERE id = can_change_username.user_id;
  
  -- Allow change if never changed or more than 2 months ago
  RETURN (last_change IS NULL OR last_change < now() - interval '2 months');
END;
$$;