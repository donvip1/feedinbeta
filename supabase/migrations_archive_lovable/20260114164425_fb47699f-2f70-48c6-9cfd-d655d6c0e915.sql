-- Create user_identifiers table for anti-fraud tracking
CREATE TABLE IF NOT EXISTS user_identifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  identifier_type text NOT NULL,
  identifier_value text NOT NULL,
  first_seen_at timestamptz DEFAULT now(),
  last_seen_at timestamptz DEFAULT now(),
  is_flagged boolean DEFAULT false,
  flag_reason text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(identifier_type, identifier_value, user_id)
);

-- Create indexes for efficient fraud detection lookups
CREATE INDEX IF NOT EXISTS idx_user_identifiers_type_value ON user_identifiers(identifier_type, identifier_value);
CREATE INDEX IF NOT EXISTS idx_user_identifiers_user_id ON user_identifiers(user_id);

-- Enable RLS on user_identifiers
ALTER TABLE user_identifiers ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_identifiers
CREATE POLICY "Users can view own identifiers" ON user_identifiers 
FOR SELECT USING (auth.uid() = user_id);

-- Update public_profiles view to include account_status
DROP VIEW IF EXISTS public_profiles;
CREATE VIEW public_profiles WITH (security_invoker = true) AS
SELECT 
  id,
  username,
  display_name,
  bio,
  avatar_url,
  cover_url,
  is_premium,
  created_at,
  followers_count,
  following_count,
  country,
  city,
  detected_country_code,
  occupation,
  account_status
FROM profiles
WHERE account_status = 'active' OR account_status IS NULL;