-- Add permission columns to user_roles for granular access control
ALTER TABLE public.user_roles
ADD COLUMN IF NOT EXISTS can_manage_p2p boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS can_manage_disputes boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS can_manage_users boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS can_manage_content boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS can_view_analytics boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS can_manage_roles boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS assigned_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS notes text;

-- Set default permissions based on role
UPDATE public.user_roles SET
  can_manage_p2p = true,
  can_manage_disputes = true,
  can_manage_users = true,
  can_manage_content = true,
  can_view_analytics = true,
  can_manage_roles = true
WHERE role = 'admin';

UPDATE public.user_roles SET
  can_manage_disputes = true,
  can_manage_content = true,
  can_view_analytics = true
WHERE role = 'moderator';

-- Create admin action log for audit trail
CREATE TABLE IF NOT EXISTS public.admin_action_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id uuid NOT NULL REFERENCES auth.users(id),
  action_type text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  target_username text,
  details jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on admin action logs
ALTER TABLE public.admin_action_logs ENABLE ROW LEVEL SECURITY;

-- Only admins/moderators can view logs
CREATE POLICY "Admins can view action logs"
ON public.admin_action_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'moderator', 'developer')
  )
);

-- Only admins can insert logs (done via service role)
CREATE POLICY "Service role can insert logs"
ON public.admin_action_logs
FOR INSERT
WITH CHECK (true);