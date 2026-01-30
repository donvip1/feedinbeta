-- First drop the existing function, then recreate with correct table reference
DROP FUNCTION IF EXISTS public.send_gift(uuid, text, integer);

-- Recreate send_gift function using gift_analytics table
CREATE OR REPLACE FUNCTION public.send_gift(
  p_post_id uuid,
  p_gift_type text,
  p_credit_value integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_id uuid;
  v_receiver_id uuid;
  v_sender_balance integer;
  v_platform_fee integer;
  v_creator_amount integer;
  v_gift_id uuid;
  v_is_admin boolean := false;
BEGIN
  -- Get sender ID
  v_sender_id := auth.uid();
  IF v_sender_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if sender is admin/developer (bypass balance check)
  SELECT EXISTS (
    SELECT 1 FROM admin_roles 
    WHERE user_id = v_sender_id 
    AND role IN ('super_admin', 'developer')
  ) INTO v_is_admin;

  -- Get receiver (post author)
  SELECT user_id INTO v_receiver_id
  FROM posts
  WHERE id = p_post_id;

  IF v_receiver_id IS NULL THEN
    RAISE EXCEPTION 'Post not found';
  END IF;

  IF v_receiver_id = v_sender_id THEN
    RAISE EXCEPTION 'Cannot send gift to yourself';
  END IF;

  -- Only check balance for non-admin users
  IF NOT v_is_admin THEN
    -- Get sender balance
    SELECT balance INTO v_sender_balance
    FROM user_credits
    WHERE user_id = v_sender_id;

    IF v_sender_balance IS NULL OR v_sender_balance < p_credit_value THEN
      RAISE EXCEPTION 'Insufficient credits';
    END IF;

    -- Deduct from sender
    UPDATE user_credits
    SET balance = balance - p_credit_value,
        updated_at = now()
    WHERE user_id = v_sender_id;
  END IF;

  -- Calculate platform fee (20%) and creator amount (80%)
  v_platform_fee := (p_credit_value * 20) / 100;
  v_creator_amount := p_credit_value - v_platform_fee;

  -- Record gift in gift_analytics table (fixed from non-existent 'gifts' table)
  INSERT INTO gift_analytics (sender_id, receiver_id, gift_type, credit_value, source_type, source_id, platform_fee, is_converted)
  VALUES (v_sender_id, v_receiver_id, p_gift_type, p_credit_value, 'post', p_post_id, v_platform_fee, false)
  RETURNING id INTO v_gift_id;

  -- Record platform earnings
  INSERT INTO daily_earnings (date, gift_fees, total)
  VALUES (CURRENT_DATE, v_platform_fee, v_platform_fee)
  ON CONFLICT (date)
  DO UPDATE SET
    gift_fees = COALESCE(daily_earnings.gift_fees, 0) + v_platform_fee,
    total = COALESCE(daily_earnings.total, 0) + v_platform_fee;

  RETURN jsonb_build_object(
    'success', true,
    'gift_id', v_gift_id,
    'creator_amount', v_creator_amount,
    'platform_fee', v_platform_fee,
    'admin_bypass', v_is_admin
  );
END;
$$;