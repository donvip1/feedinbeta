-- Create table to track which users require 2FA
CREATE TABLE IF NOT EXISTS public.user_mfa_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mfa_enabled BOOLEAN DEFAULT false,
  mfa_required BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_mfa_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own MFA settings
CREATE POLICY "Users can view own MFA settings"
ON public.user_mfa_settings
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Users can update their own MFA settings
CREATE POLICY "Users can update own MFA settings"
ON public.user_mfa_settings
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Policy: System can insert MFA settings
CREATE POLICY "System can insert MFA settings"
ON public.user_mfa_settings
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Function to automatically require 2FA for admins and moderators
CREATE OR REPLACE FUNCTION public.enforce_mfa_for_privileged_users()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user has admin or moderator role
  IF EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = NEW.user_id 
    AND role IN ('admin', 'moderator')
  ) THEN
    -- Ensure MFA is required
    INSERT INTO public.user_mfa_settings (user_id, mfa_required)
    VALUES (NEW.user_id, true)
    ON CONFLICT (user_id) 
    DO UPDATE SET mfa_required = true, updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger to enforce MFA when user gets admin/moderator role
CREATE TRIGGER enforce_mfa_on_role_assignment
AFTER INSERT OR UPDATE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_mfa_for_privileged_users();

-- Initialize MFA settings for existing admins and moderators
INSERT INTO public.user_mfa_settings (user_id, mfa_required)
SELECT DISTINCT user_id, true
FROM public.user_roles
WHERE role IN ('admin', 'moderator')
ON CONFLICT (user_id) DO UPDATE SET mfa_required = true;