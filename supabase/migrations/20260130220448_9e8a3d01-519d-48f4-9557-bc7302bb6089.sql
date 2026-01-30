-- Drop and recreate send_gift function with admin bypass
DROP FUNCTION IF EXISTS public.send_gift(UUID, TEXT, INTEGER, UUID);

CREATE OR REPLACE FUNCTION public.send_gift(
  p_recipient_id UUID,
  p_gift_type TEXT,
  p_credit_value INTEGER,
  p_conversation_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sender_id UUID;
  v_sender_balance INTEGER;
  v_is_admin BOOLEAN := false;
  v_gift_id UUID;
  v_platform_fee INTEGER;
  v_recipient_amount INTEGER;
  v_last_gift_at TIMESTAMPTZ;
BEGIN
  -- Get sender ID
  v_sender_id := auth.uid();
  IF v_sender_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Cannot send to self
  IF v_sender_id = p_recipient_id THEN
    RAISE EXCEPTION 'Cannot send gift to yourself';
  END IF;

  -- Check if sender is admin with unlimited credits
  SELECT COALESCE(balance, 0), COALESCE(is_admin_minted, false), last_gift_sent_at
  INTO v_sender_balance, v_is_admin, v_last_gift_at
  FROM user_credits
  WHERE user_id = v_sender_id;

  -- ADMIN BYPASS: Skip all validation for admin accounts
  IF NOT v_is_admin THEN
    -- Check balance for non-admin users
    IF v_sender_balance < p_credit_value THEN
      RAISE EXCEPTION 'Insufficient credits. Balance: %, Required: %', v_sender_balance, p_credit_value;
    END IF;

    -- Rate limiting for non-admins (5 second cooldown)
    IF v_last_gift_at IS NOT NULL AND v_last_gift_at > now() - interval '5 seconds' THEN
      RAISE EXCEPTION 'Please wait before sending another gift';
    END IF;
  END IF;

  -- Calculate fees (70% to recipient, 30% platform fee)
  v_platform_fee := FLOOR(p_credit_value * 0.30);
  v_recipient_amount := p_credit_value - v_platform_fee;

  -- Create gift record
  INSERT INTO gift_analytics (
    sender_id,
    recipient_id,
    gift_type,
    credit_value,
    platform_fee,
    conversation_id,
    is_converted
  ) VALUES (
    v_sender_id,
    p_recipient_id,
    p_gift_type,
    p_credit_value,
    v_platform_fee,
    p_conversation_id,
    false
  ) RETURNING id INTO v_gift_id;

  -- Deduct from sender (admin accounts won't have balance changed by trigger)
  INSERT INTO credit_transactions (user_id, amount, transaction_type, description, reference_id)
  VALUES (v_sender_id, -p_credit_value, 'gift_sent', 'Gift sent: ' || p_gift_type, v_gift_id);

  -- Update last gift timestamp
  UPDATE user_credits SET last_gift_sent_at = now() WHERE user_id = v_sender_id;

  -- Create notification for recipient
  INSERT INTO notifications (user_id, type, title, message, reference_id, reference_type)
  VALUES (
    p_recipient_id,
    'gift_received',
    'Gift Received!',
    'You received a ' || p_gift_type || ' gift worth ' || p_credit_value || ' credits!',
    v_gift_id,
    'gift'
  );

  RETURN v_gift_id;
END;
$function$;

-- Drop and recreate send_direct_gift function with admin bypass
DROP FUNCTION IF EXISTS public.send_direct_gift(TEXT, TEXT, INTEGER);

CREATE OR REPLACE FUNCTION public.send_direct_gift(
  p_recipient_identifier TEXT,
  p_gift_type TEXT,
  p_credit_value INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sender_id UUID;
  v_recipient_id UUID;
  v_sender_balance INTEGER;
  v_is_admin BOOLEAN := false;
  v_gift_id UUID;
  v_platform_fee INTEGER;
  v_recipient_amount INTEGER;
  v_last_gift_at TIMESTAMPTZ;
BEGIN
  -- Get sender ID
  v_sender_id := auth.uid();
  IF v_sender_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Find recipient by username or email
  SELECT id INTO v_recipient_id
  FROM profiles
  WHERE LOWER(username) = LOWER(p_recipient_identifier)
     OR LOWER(email) = LOWER(p_recipient_identifier)
  LIMIT 1;

  IF v_recipient_id IS NULL THEN
    RAISE EXCEPTION 'User not found with identifier: %', p_recipient_identifier;
  END IF;

  -- Cannot send to self
  IF v_sender_id = v_recipient_id THEN
    RAISE EXCEPTION 'Cannot send gift to yourself';
  END IF;

  -- Check if sender is admin with unlimited credits
  SELECT COALESCE(balance, 0), COALESCE(is_admin_minted, false), last_gift_sent_at
  INTO v_sender_balance, v_is_admin, v_last_gift_at
  FROM user_credits
  WHERE user_id = v_sender_id;

  -- ADMIN BYPASS: Skip all validation for admin accounts
  IF NOT v_is_admin THEN
    -- Check balance for non-admin users
    IF v_sender_balance < p_credit_value THEN
      RAISE EXCEPTION 'Insufficient credits. Balance: %, Required: %', v_sender_balance, p_credit_value;
    END IF;

    -- Rate limiting for non-admins (5 second cooldown)
    IF v_last_gift_at IS NOT NULL AND v_last_gift_at > now() - interval '5 seconds' THEN
      RAISE EXCEPTION 'Please wait before sending another gift';
    END IF;
  END IF;

  -- Calculate fees (70% to recipient, 30% platform fee)
  v_platform_fee := FLOOR(p_credit_value * 0.30);
  v_recipient_amount := p_credit_value - v_platform_fee;

  -- Create gift record
  INSERT INTO gift_analytics (
    sender_id,
    recipient_id,
    gift_type,
    credit_value,
    platform_fee,
    is_converted
  ) VALUES (
    v_sender_id,
    v_recipient_id,
    p_gift_type,
    p_credit_value,
    v_platform_fee,
    false
  ) RETURNING id INTO v_gift_id;

  -- Deduct from sender (admin accounts won't have balance changed by trigger)
  INSERT INTO credit_transactions (user_id, amount, transaction_type, description, reference_id)
  VALUES (v_sender_id, -p_credit_value, 'gift_sent', 'Gift sent: ' || p_gift_type, v_gift_id);

  -- Update last gift timestamp
  UPDATE user_credits SET last_gift_sent_at = now() WHERE user_id = v_sender_id;

  -- Create notification for recipient
  INSERT INTO notifications (user_id, type, title, message, reference_id, reference_type)
  VALUES (
    v_recipient_id,
    'gift_received',
    'Gift Received!',
    'You received a ' || p_gift_type || ' gift worth ' || p_credit_value || ' credits!',
    v_gift_id,
    'gift'
  );

  RETURN v_gift_id;
END;
$function$;