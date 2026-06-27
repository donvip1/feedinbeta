-- Add RLS policies to remaining tables without policies

-- credit_supply - admin only access
ALTER TABLE public.credit_supply ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin only access credit_supply" ON public.credit_supply;
CREATE POLICY "Admin only access credit_supply"
ON public.credit_supply
FOR ALL
TO authenticated
USING (public.can_view_admin_wallet())
WITH CHECK (public.can_manage_credits());

-- platform_wallet - admin only access  
ALTER TABLE public.platform_wallet ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin only access platform_wallet" ON public.platform_wallet;
CREATE POLICY "Admin only access platform_wallet"
ON public.platform_wallet
FOR ALL
TO authenticated
USING (public.can_view_admin_wallet())
WITH CHECK (public.can_manage_credits());