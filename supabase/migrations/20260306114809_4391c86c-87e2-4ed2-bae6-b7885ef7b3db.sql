CREATE OR REPLACE FUNCTION public.can_manage_credits()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_role TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  SELECT role INTO v_role FROM user_roles WHERE user_id = v_user_id;
  
  RETURN v_role IN ('super_admin', 'admin', 'developer');
END;
$$;