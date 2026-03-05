
-- Create a SECURITY DEFINER function to completely delete a space and ALL related data
-- This bypasses RLS for the internal deletes but checks permissions at the top
CREATE OR REPLACE FUNCTION public.delete_space_completely(p_space_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_space_owner uuid;
  v_caller uuid := auth.uid();
  v_is_admin boolean;
  v_is_moderator boolean;
BEGIN
  -- Get space owner
  SELECT user_id INTO v_space_owner FROM public.live_spaces WHERE id = p_space_id;
  
  -- Space doesn't exist
  IF v_space_owner IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check permissions: must be owner, admin, or moderator
  v_is_admin := EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_caller AND role IN ('admin', 'super_admin', 'developer'));
  v_is_moderator := EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_caller AND role = 'moderator');
  
  IF v_caller != v_space_owner AND NOT v_is_admin AND NOT v_is_moderator THEN
    RAISE EXCEPTION 'Permission denied: you cannot delete this space';
  END IF;
  
  -- Delete ALL related data from every table with space_id
  DELETE FROM public.live_space_messages WHERE space_id = p_space_id;
  DELETE FROM public.live_space_reactions WHERE space_id = p_space_id;
  DELETE FROM public.live_space_gifts WHERE space_id = p_space_id;
  DELETE FROM public.live_space_speakers WHERE space_id = p_space_id;
  DELETE FROM public.live_space_invitations WHERE space_id = p_space_id;
  DELETE FROM public.space_feedback WHERE space_id = p_space_id;
  
  -- Finally delete the space itself
  DELETE FROM public.live_spaces WHERE id = p_space_id;
  
  RETURN true;
END;
$$;

-- Also create a bulk delete function for efficiency
CREATE OR REPLACE FUNCTION public.delete_spaces_bulk(p_space_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_is_admin boolean;
  v_is_moderator boolean;
  v_owned_ids uuid[];
  v_allowed_ids uuid[];
  v_count integer;
BEGIN
  -- Check if caller is admin/moderator
  v_is_admin := EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_caller AND role IN ('admin', 'super_admin', 'developer'));
  v_is_moderator := EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_caller AND role = 'moderator');
  
  IF v_is_admin OR v_is_moderator THEN
    -- Admins/mods can delete any
    v_allowed_ids := p_space_ids;
  ELSE
    -- Regular users can only delete their own
    SELECT array_agg(id) INTO v_allowed_ids
    FROM public.live_spaces 
    WHERE id = ANY(p_space_ids) AND user_id = v_caller;
  END IF;
  
  IF v_allowed_ids IS NULL OR array_length(v_allowed_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Delete all related data
  DELETE FROM public.live_space_messages WHERE space_id = ANY(v_allowed_ids);
  DELETE FROM public.live_space_reactions WHERE space_id = ANY(v_allowed_ids);
  DELETE FROM public.live_space_gifts WHERE space_id = ANY(v_allowed_ids);
  DELETE FROM public.live_space_speakers WHERE space_id = ANY(v_allowed_ids);
  DELETE FROM public.live_space_invitations WHERE space_id = ANY(v_allowed_ids);
  DELETE FROM public.space_feedback WHERE space_id = ANY(v_allowed_ids);
  
  -- Delete the spaces
  DELETE FROM public.live_spaces WHERE id = ANY(v_allowed_ids);
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
