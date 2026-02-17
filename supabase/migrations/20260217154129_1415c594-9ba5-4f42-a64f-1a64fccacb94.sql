
-- Fix sync_credit_supply to exclude super_admin
CREATE OR REPLACE FUNCTION public.sync_credit_supply()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE credit_supply
  SET circulating_supply = (
    SELECT COALESCE(SUM(uc.balance), 0) 
    FROM user_credits uc
    WHERE NOT EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = uc.user_id AND ur.role = 'super_admin'
    )
  ),
  updated_at = now()
  WHERE id = '00000000-0000-0000-0000-000000000002';
END;
$$;
