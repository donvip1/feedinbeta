-- Add signup tracking and anti-fraud columns to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS registration_ip inet DEFAULT NULL,
ADD COLUMN IF NOT EXISTS signup_fingerprint text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_duplicate_flagged boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS account_status text DEFAULT 'active';

-- Create indexes for efficient fraud detection lookups
CREATE INDEX IF NOT EXISTS idx_profiles_signup_fingerprint ON profiles(signup_fingerprint);
CREATE INDEX IF NOT EXISTS idx_profiles_registration_ip ON profiles(registration_ip);
CREATE INDEX IF NOT EXISTS idx_profiles_account_status ON profiles(account_status);

-- Ensure unique constraint on username for referral links (case insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_lower ON profiles(LOWER(username)) WHERE username IS NOT NULL;

-- Ensure phone number uniqueness for anti-fraud
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_phone_unique ON profiles(phone_number) WHERE phone_number IS NOT NULL AND phone_number != '';