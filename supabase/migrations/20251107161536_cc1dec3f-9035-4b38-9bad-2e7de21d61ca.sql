-- Fix infinite recursion in group_members RLS policy
-- Drop the problematic policy
DROP POLICY IF EXISTS "Members can view group members" ON public.group_members;

-- Create a non-recursive policy using a helper function
CREATE OR REPLACE FUNCTION is_group_member_simple(p_user_id UUID, p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM group_members 
    WHERE user_id = p_user_id 
    AND group_id = p_group_id
  );
END;
$$;

-- Create new policy without recursion
CREATE POLICY "Members can view group members"
ON public.group_members
FOR SELECT
USING (
  -- User is a member of the group
  is_group_member_simple(auth.uid(), group_id)
  OR
  -- Group is public
  EXISTS (
    SELECT 1
    FROM groups
    WHERE groups.id = group_members.group_id
    AND groups.is_private = false
  )
);