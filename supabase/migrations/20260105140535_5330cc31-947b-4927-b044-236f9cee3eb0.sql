-- Drop and recreate the handle_new_user function to match actual profiles schema
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_username TEXT;
  v_display_name TEXT;
BEGIN
  -- Get display name from metadata or generate default
  v_display_name := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );
  
  -- Get username from metadata or generate unique one
  v_username := COALESCE(
    NULLIF(LOWER(TRIM(NEW.raw_user_meta_data->>'username')), ''),
    LOWER(REPLACE(REPLACE(split_part(NEW.email, '@', 1), '.', '_'), '-', '_')) || '_' || substr(NEW.id::text, 1, 8)
  );
  
  -- Ensure username is unique by appending random suffix if needed
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = v_username) LOOP
    v_username := v_username || '_' || substr(gen_random_uuid()::text, 1, 4);
  END LOOP;
  
  -- Insert into profiles with only the columns that exist
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
    v_username,
    v_display_name,
    NEW.raw_user_meta_data->>'avatar_url',
    NOW(),
    NOW()
  );
  
  -- Create user_roles entry if table exists
  BEGIN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
  EXCEPTION WHEN undefined_table THEN
    -- user_roles table doesn't exist, skip
    NULL;
  END;
  
  -- Initialize user credits if table exists
  BEGIN
    INSERT INTO public.user_credits (user_id, balance)
    VALUES (NEW.id, 50);
  EXCEPTION WHEN undefined_table THEN
    -- user_credits table doesn't exist, skip
    NULL;
  END;
  
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- Handle duplicate username by adding more randomness
    v_username := v_username || '_' || substr(gen_random_uuid()::text, 1, 8);
    
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
      v_username,
      v_display_name,
      NEW.raw_user_meta_data->>'avatar_url',
      NOW(),
      NOW()
    );
    
    RETURN NEW;
  WHEN OTHERS THEN
    -- Log the error but don't block user creation
    RAISE WARNING 'handle_new_user error: % - %', SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$;