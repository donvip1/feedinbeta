-- Fix the trigger function to use 'permanent' instead of 'default' which isn't a valid link_type
CREATE OR REPLACE FUNCTION public.handle_new_group()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invite_code_chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  generated_code TEXT := '';
  i INTEGER;
BEGIN
  -- Generate a random 8-character invite code
  FOR i IN 1..8 LOOP
    generated_code := generated_code || substr(invite_code_chars, floor(random() * length(invite_code_chars) + 1)::integer, 1);
  END LOOP;

  -- Add creator as owner of the group
  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner');

  -- Create default permanent invite link (use 'permanent' as the link_type)
  INSERT INTO public.group_invite_links (
    group_id, 
    invite_code, 
    created_by, 
    link_type, 
    expires_at,
    is_revoked
  )
  VALUES (
    NEW.id, 
    generated_code, 
    NEW.created_by, 
    'permanent',
    NULL,
    false
  );

  -- Update member count
  UPDATE public.groups SET member_count = 1 WHERE id = NEW.id;

  RETURN NEW;
END;
$$;