
CREATE OR REPLACE FUNCTION public.admin_mint_credits(p_amount integer, p_reason text DEFAULT 'Admin mint'::text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_supply RECORD;
  result JSON;
BEGIN
  IF NOT can_mint_credits() THEN
    RAISE EXCEPTION 'Access denied: Only the CEO/Super Admin can fund the FeedIn Wallet';
  END IF;

  SELECT * INTO current_supply FROM credit_supply WHERE id = '00000000-0000-0000-0000-000000000002';

  -- Minting increases total_supply (the FeedIn allocation from CEO reserve)
  -- and adds to the platform_wallet balance
  UPDATE credit_supply
  SET total_supply = total_supply + p_amount,
      last_mint_at = now(), last_mint_by = auth.uid(),
      last_mint_amount = p_amount, updated_at = now()
  WHERE id = '00000000-0000-0000-0000-000000000002';

  UPDATE platform_wallet
  SET balance = balance + p_amount, updated_at = now()
  WHERE id = '00000000-0000-0000-0000-000000000001';

  INSERT INTO platform_transactions (transaction_type, amount, performed_by, description)
  VALUES ('mint', p_amount, auth.uid(), p_reason);

  SELECT json_build_object('success', true, 'minted', p_amount,
    'new_total_supply', current_supply.total_supply + p_amount) INTO result;
  RETURN result;
END;
$$;
