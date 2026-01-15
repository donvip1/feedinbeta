-- Part 1: Reset profile_completed for users with auto-generated usernames
-- This preserves all other data (display_name, avatar_url, bio, posts, friends, etc.)
UPDATE profiles 
SET profile_completed = false, updated_at = now()
WHERE username ~ '_[a-f0-9]{8}(_\d+)?$'
AND profile_completed = true;

-- Part 2: Update the handle_new_user function to properly handle profile completion
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  username_input text;
  display_name_input text;
  final_username text;
  final_display_name text;
  is_proper_username boolean := false;
  counter int := 0;
BEGIN
  -- Get username and display_name from metadata
  username_input := COALESCE(
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'preferred_username',
    ''
  );
  
  display_name_input := COALESCE(
    new.raw_user_meta_data->>'display_name',
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    ''
  );

  -- Check if a proper username was provided (not empty, not auto-generated pattern)
  IF username_input != '' AND username_input !~ '_[a-f0-9]{8}(_\d+)?$' THEN
    is_proper_username := true;
    final_username := lower(regexp_replace(username_input, '[^a-zA-Z0-9_]', '', 'g'));
  ELSE
    -- Generate a placeholder username from email or random
    IF new.email IS NOT NULL AND new.email != '' THEN
      final_username := lower(regexp_replace(split_part(new.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g'));
    ELSE
      final_username := 'user';
    END IF;
    -- Add UUID suffix to make it unique
    final_username := final_username || '_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
    is_proper_username := false;
  END IF;

  -- Handle display name
  IF display_name_input != '' THEN
    final_display_name := display_name_input;
  ELSE
    final_display_name := NULL;
  END IF;

  -- Ensure username uniqueness
  WHILE EXISTS (SELECT 1 FROM profiles WHERE username = final_username) LOOP
    counter := counter + 1;
    IF is_proper_username THEN
      final_username := lower(regexp_replace(username_input, '[^a-zA-Z0-9_]', '', 'g')) || '_' || counter::text;
    ELSE
      IF new.email IS NOT NULL AND new.email != '' THEN
        final_username := lower(regexp_replace(split_part(new.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g'));
      ELSE
        final_username := 'user';
      END IF;
      final_username := final_username || '_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8) || '_' || counter::text;
    END IF;
  END LOOP;

  -- Insert the profile with proper profile_completed status
  INSERT INTO public.profiles (
    id, 
    username, 
    display_name, 
    avatar_url,
    profile_completed,
    created_at,
    updated_at
  )
  VALUES (
    new.id,
    final_username,
    final_display_name,
    new.raw_user_meta_data->>'avatar_url',
    is_proper_username AND final_display_name IS NOT NULL, -- Only complete if BOTH username and display_name are proper
    now(),
    now()
  );

  RETURN new;
EXCEPTION
  WHEN unique_violation THEN
    -- Handle race condition - retry with new UUID
    final_username := COALESCE(
      lower(regexp_replace(split_part(new.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g')),
      'user'
    ) || '_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
    
    INSERT INTO public.profiles (id, username, display_name, avatar_url, profile_completed, created_at, updated_at)
    VALUES (
      new.id,
      final_username,
      final_display_name,
      new.raw_user_meta_data->>'avatar_url',
      false,
      now(),
      now()
    );
    RETURN new;
END;
$function$;