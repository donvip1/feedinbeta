-- Fix search_path security warning for can_change_username function
CREATE OR REPLACE FUNCTION can_change_username(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
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