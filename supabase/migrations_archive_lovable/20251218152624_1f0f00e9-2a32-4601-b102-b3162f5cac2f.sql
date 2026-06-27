
-- Drop existing user_roles table and recreate with TEXT
DROP TABLE IF EXISTS public.user_roles CASCADE;

-- Create secure user_roles table with TEXT role
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('super_admin', 'admin', 'moderator', 'user')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Users can only see their own role (completely hidden from others)
CREATE POLICY "Users can view own role"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Security definer function to check role (bypasses RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if current user has admin-level role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin')
  )
$$;

-- Function to check if current user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'super_admin'
  )
$$;

-- Function to get current user's highest role
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = auth.uid()
  ORDER BY 
    CASE role 
      WHEN 'super_admin' THEN 1 
      WHEN 'admin' THEN 2 
      WHEN 'moderator' THEN 3 
      ELSE 4 
    END
  LIMIT 1
$$;

-- Grant super_admin to tester1
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'
FROM public.profiles
WHERE username = 'tester1'
ON CONFLICT (user_id, role) DO NOTHING;

-- Update can_view_admin_wallet
CREATE OR REPLACE FUNCTION public.can_view_admin_wallet()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin', 'moderator')
  )
$$;

-- Update can_manage_credits
CREATE OR REPLACE FUNCTION public.can_manage_credits()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin')
  )
$$;

-- Function to check unlimited feature access
CREATE OR REPLACE FUNCTION public.has_unlimited_access()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'super_admin'
  )
$$;

-- Safe credit deduction that skips for super_admins
CREATE OR REPLACE FUNCTION public.deduct_credits_safe(
  p_user_id UUID,
  p_amount INTEGER,
  p_description TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance INTEGER;
  is_unlimited BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user_id AND role = 'super_admin'
  ) INTO is_unlimited;
  
  IF is_unlimited THEN
    RETURN TRUE;
  END IF;
  
  SELECT credits INTO current_balance
  FROM public.user_credits
  WHERE user_id = p_user_id;
  
  IF current_balance IS NULL OR current_balance < p_amount THEN
    RETURN FALSE;
  END IF;
  
  UPDATE public.user_credits
  SET credits = credits - p_amount, updated_at = now()
  WHERE user_id = p_user_id;
  
  INSERT INTO public.credit_transactions (user_id, amount, type, description)
  VALUES (p_user_id, -p_amount, 'deduction', COALESCE(p_description, 'Feature usage'));
  
  RETURN TRUE;
END;
$$;

-- Get user credits with unlimited for super_admin
CREATE OR REPLACE FUNCTION public.get_user_credits(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_unlimited BOOLEAN;
  actual_credits INTEGER;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user_id AND role = 'super_admin'
  ) INTO is_unlimited;
  
  IF is_unlimited THEN
    RETURN 999999999;
  END IF;
  
  SELECT credits INTO actual_credits
  FROM public.user_credits
  WHERE user_id = p_user_id;
  
  RETURN COALESCE(actual_credits, 0);
END;
$$;
