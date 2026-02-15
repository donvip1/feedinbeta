
-- Create increment_platform_wallet RPC for atomic revenue tracking
CREATE OR REPLACE FUNCTION public.increment_platform_wallet(column_name TEXT, amount NUMERIC)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF column_name = 'withdrawal_revenue' THEN
    UPDATE platform_wallet SET withdrawal_revenue = COALESCE(withdrawal_revenue, 0) + amount WHERE id = '00000000-0000-0000-0000-000000000001';
  ELSIF column_name = 'platform_profit' THEN
    UPDATE platform_wallet SET platform_profit = COALESCE(platform_profit, 0) + amount WHERE id = '00000000-0000-0000-0000-000000000001';
  ELSIF column_name = 'gift_revenue' THEN
    UPDATE platform_wallet SET gift_revenue = COALESCE(gift_revenue, 0) + amount WHERE id = '00000000-0000-0000-0000-000000000001';
  ELSE
    RAISE EXCEPTION 'Invalid column: %', column_name;
  END IF;
END;
$$;

-- Add index for faster withdrawal lookups
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_id ON public.withdrawal_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_reference ON public.withdrawal_requests(paystack_reference);
CREATE INDEX IF NOT EXISTS idx_user_bank_accounts_user_id ON public.user_bank_accounts(user_id);
