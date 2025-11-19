-- First check and modify purpose column to be an array if it's currently text
-- Drop existing column if it's the wrong type and recreate
DO $$
BEGIN
  -- Check if purpose column exists and is text type
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'purpose'
    AND data_type = 'text'
  ) THEN
    -- Alter the column type to text array
    ALTER TABLE profiles ALTER COLUMN purpose TYPE TEXT[] USING 
      CASE 
        WHEN purpose IS NOT NULL AND purpose != '' THEN ARRAY[purpose]
        ELSE NULL
      END;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'purpose'
  ) THEN
    -- Add purpose column if it doesn't exist
    ALTER TABLE profiles ADD COLUMN purpose TEXT[];
  END IF;
END $$;

-- Ensure other columns exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'status') THEN
    ALTER TABLE profiles ADD COLUMN status TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'status_visibility') THEN
    ALTER TABLE profiles ADD COLUMN status_visibility TEXT DEFAULT 'public';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'purpose_updated_at') THEN
    ALTER TABLE profiles ADD COLUMN purpose_updated_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Add constraint for status_visibility values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'status_visibility_check'
  ) THEN
    ALTER TABLE profiles 
    ADD CONSTRAINT status_visibility_check 
    CHECK (status_visibility IN ('public', 'friends', 'followers'));
  END IF;
END $$;

-- Add check constraint for purpose array length (max 3)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'purpose_max_3'
  ) THEN
    ALTER TABLE profiles 
    ADD CONSTRAINT purpose_max_3 
    CHECK (purpose IS NULL OR array_length(purpose, 1) IS NULL OR array_length(purpose, 1) <= 3);
  END IF;
END $$;

-- Create a function to check if user can update purpose
CREATE OR REPLACE FUNCTION can_update_purpose(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  last_update TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT purpose_updated_at INTO last_update
  FROM profiles
  WHERE id = user_id;
  
  -- Allow update if never set or more than 2 weeks ago
  RETURN (last_update IS NULL OR last_update < NOW() - INTERVAL '2 weeks');
END;
$$;