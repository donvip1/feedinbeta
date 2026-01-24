-- Create function to auto-generate default invite link and set creator as owner
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

  -- Create default permanent invite link
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
    'default',
    NULL,
    false
  );

  -- Update member count
  UPDATE public.groups SET member_count = 1 WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS on_group_created ON public.groups;

-- Create trigger to run on new group creation
CREATE TRIGGER on_group_created
  AFTER INSERT ON public.groups
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_group();

-- Add function to check group role permissions
CREATE OR REPLACE FUNCTION public.get_group_role(p_group_id UUID, p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.group_members 
  WHERE group_id = p_group_id AND user_id = p_user_id
  LIMIT 1;
$$;

-- Create function to check if user can manage group (owner/admin/moderator)
CREATE OR REPLACE FUNCTION public.can_manage_group(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members 
    WHERE group_id = p_group_id 
    AND user_id = p_user_id 
    AND role IN ('owner', 'admin', 'moderator')
  );
$$;

-- Create function to check if user is owner/admin (can appoint roles)
CREATE OR REPLACE FUNCTION public.can_appoint_roles(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members 
    WHERE group_id = p_group_id 
    AND user_id = p_user_id 
    AND role IN ('owner', 'admin')
  );
$$;