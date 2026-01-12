-- First, fix the broken trigger function for sensitive data
CREATE OR REPLACE FUNCTION public.create_sensitive_data_for_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profile_sensitive_data (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix existing users without profiles (Google OAuth users who failed to get profiles created)
INSERT INTO public.profiles (id, username, display_name, avatar_url, created_at, updated_at)
SELECT 
  au.id,
  LOWER(REPLACE(REPLACE(COALESCE(split_part(au.email, '@', 1), 'user'), '.', '_'), '-', '_')) || '_' || substr(au.id::text, 1, 8),
  COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)),
  au.raw_user_meta_data->>'avatar_url',
  au.created_at,
  NOW()
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = au.id)
ON CONFLICT (id) DO NOTHING;

-- Create or replace the handle_new_user function with improved error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  generated_username TEXT;
  base_username TEXT;
  counter INT := 0;
BEGIN
  -- Generate base username from email or metadata
  base_username := LOWER(REPLACE(REPLACE(
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      NEW.raw_user_meta_data->>'preferred_username',
      split_part(NEW.email, '@', 1),
      'user'
    ), '.', '_'), '-', '_')
  );
  
  -- Start with base username + short UUID suffix
  generated_username := base_username || '_' || substr(NEW.id::text, 1, 8);
  
  -- Check for uniqueness and increment if needed
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = generated_username) LOOP
    counter := counter + 1;
    generated_username := base_username || '_' || substr(NEW.id::text, 1, 8) || '_' || counter::text;
  END LOOP;

  -- Insert profile with all available data
  INSERT INTO public.profiles (
    id, 
    username, 
    display_name, 
    avatar_url, 
    created_at, 
    updated_at
  )
  VALUES (
    NEW.id,
    generated_username,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'display_name',
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.raw_user_meta_data->>'picture'
    ),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = COALESCE(EXCLUDED.display_name, profiles.display_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    updated_at = NOW();
  
  -- Create default privacy settings
  INSERT INTO public.privacy_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Create default credit record
  INSERT INTO public.user_credits (user_id, balance)
  VALUES (NEW.id, 10)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail auth
    RAISE WARNING 'Error in handle_new_user for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add profile_completed column to profiles if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'profiles' 
                 AND column_name = 'profile_completed') THEN
    ALTER TABLE public.profiles ADD COLUMN profile_completed BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Update existing complete profiles to be marked as completed
UPDATE public.profiles
SET profile_completed = true
WHERE username IS NOT NULL 
  AND display_name IS NOT NULL 
  AND username NOT LIKE '%\_%\_%'
  AND profile_completed IS NOT true;