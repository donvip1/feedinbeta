-- Add age and country fields to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS age integer CHECK (age >= 13 AND age <= 120),
ADD COLUMN IF NOT EXISTS country text;

-- Add index for country
CREATE INDEX IF NOT EXISTS idx_profiles_country ON profiles(country);

-- Update existing profiles with null values for new fields
UPDATE profiles SET age = NULL WHERE age IS NULL;
UPDATE profiles SET country = NULL WHERE country IS NULL;