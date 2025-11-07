-- Replace the function with corrected parameter names
CREATE OR REPLACE FUNCTION public.is_group_member_simple(p_user_id uuid, p_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM group_members
    WHERE group_members.user_id = p_user_id
      AND group_members.group_id = p_group_id
  );
$$;

-- Drop and recreate the problematic groups policy with the fixed function
DROP POLICY IF EXISTS "Anyone can view public groups" ON public.groups;

CREATE POLICY "Anyone can view public groups" 
ON public.groups 
FOR SELECT 
USING (
  (is_private = false) 
  OR 
  is_group_member_simple(auth.uid(), id)
);