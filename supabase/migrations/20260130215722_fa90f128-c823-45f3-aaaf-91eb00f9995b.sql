-- Drop existing functions that need return type changes
DROP FUNCTION IF EXISTS public.send_direct_gift(TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.send_gift(UUID, TEXT, INTEGER);

-- Recreate send_gift function
CREATE OR REPLACE FUNCTION public.send_gift(
  p_post_id UUID,
  p_gift_type TEXT,
  p_credit_value INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sender_id UUID;
  v_receiver_id UUID;
  v_sender_balance INTEGER;
  v_is_admin_minted BOOLEAN;
  v_gift_id UUID;
  v_platform_fee INTEGER;
  v_creator_amount INTEGER;
  v_last_gift_at TIMESTAMPTZ;
BEGIN
  -- Get authenticated user
  v_sender_id := auth.uid();
  IF v_sender_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Authentication required');
  END IF;

  -- Check rate limit (5 second cooldown between gifts)
  SELECT last_gift_sent_at INTO v_last_gift_at
  FROM user_credits
  WHERE user_id = v_sender_id;
  
  IF v_last_gift_at IS NOT NULL AND v_last_gift_at > now() - interval '5 seconds' THEN
    RETURN json_build_object('success', false, 'error', 'Please wait before sending another gift');
  END IF;

  -- Get post owner
  SELECT user_id INTO v_receiver_id
  FROM posts
  WHERE id = p_post_id;

  IF v_receiver_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Post not found');
  END IF;

  -- Prevent self-gifting
  IF v_sender_id = v_receiver_id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot send gift to yourself');
  END IF;

  -- Check if sender is admin with unlimited credits
  SELECT is_admin_minted INTO v_is_admin_minted
  FROM user_credits
  WHERE user_id = v_sender_id;

  -- Get sender balance from user_credits (source of truth)
  SELECT COALESCE(balance, 0) INTO v_sender_balance
  FROM user_credits
  WHERE user_id = v_sender_id;

  -- Check sufficient balance (skip for admin accounts)
  IF NOT COALESCE(v_is_admin_minted, false) AND COALESCE(v_sender_balance, 0) < p_credit_value THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient credits');
  END IF;

  -- Calculate platform fee (10%)
  v_platform_fee := CEIL(p_credit_value * 0.10);
  v_creator_amount := p_credit_value - v_platform_fee;

  -- Create gift record
  INSERT INTO gifts (sender_id, receiver_id, post_id, gift_type, credit_value, platform_fee, creator_amount)
  VALUES (v_sender_id, v_receiver_id, p_post_id, p_gift_type, p_credit_value, v_platform_fee, v_creator_amount)
  RETURNING id INTO v_gift_id;

  -- Only deduct credits if not admin-minted
  IF NOT COALESCE(v_is_admin_minted, false) THEN
    -- Deduct from sender (trigger will update user_credits)
    INSERT INTO credit_transactions (user_id, amount, transaction_type, description, reference_id)
    VALUES (v_sender_id, -p_credit_value, 'gift_sent', 'Sent ' || p_gift_type || ' gift', v_gift_id);
    
    -- Update last gift timestamp
    UPDATE user_credits SET last_gift_sent_at = now() WHERE user_id = v_sender_id;
  END IF;

  -- Credit receiver (trigger will create/update user_credits)
  INSERT INTO credit_transactions (user_id, amount, transaction_type, description, reference_id)
  VALUES (v_receiver_id, v_creator_amount, 'gift_received', 'Received ' || p_gift_type || ' gift', v_gift_id);

  RETURN json_build_object(
    'success', true,
    'gift_id', v_gift_id,
    'creator_amount', v_creator_amount,
    'platform_fee', v_platform_fee
  );
END;
$function$;

-- Recreate send_direct_gift function
CREATE OR REPLACE FUNCTION public.send_direct_gift(
  p_recipient_identifier TEXT,
  p_gift_type TEXT,
  p_credit_value INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sender_id UUID;
  v_receiver_id UUID;
  v_sender_balance INTEGER;
  v_is_admin_minted BOOLEAN;
  v_gift_id UUID;
  v_platform_fee INTEGER;
  v_creator_amount INTEGER;
  v_last_gift_at TIMESTAMPTZ;
BEGIN
  -- Get authenticated user
  v_sender_id := auth.uid();
  IF v_sender_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Authentication required');
  END IF;

  -- Check rate limit (5 second cooldown between gifts)
  SELECT last_gift_sent_at INTO v_last_gift_at
  FROM user_credits
  WHERE user_id = v_sender_id;
  
  IF v_last_gift_at IS NOT NULL AND v_last_gift_at > now() - interval '5 seconds' THEN
    RETURN json_build_object('success', false, 'error', 'Please wait before sending another gift');
  END IF;

  -- Find recipient by username or email
  SELECT id INTO v_receiver_id
  FROM profiles
  WHERE LOWER(username) = LOWER(p_recipient_identifier)
     OR LOWER(email) = LOWER(p_recipient_identifier);

  IF v_receiver_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Prevent self-gifting
  IF v_sender_id = v_receiver_id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot send gift to yourself');
  END IF;

  -- Check if sender is admin with unlimited credits
  SELECT is_admin_minted INTO v_is_admin_minted
  FROM user_credits
  WHERE user_id = v_sender_id;

  -- Get sender balance from user_credits (source of truth)
  SELECT COALESCE(balance, 0) INTO v_sender_balance
  FROM user_credits
  WHERE user_id = v_sender_id;

  -- Check sufficient balance (skip for admin accounts)
  IF NOT COALESCE(v_is_admin_minted, false) AND COALESCE(v_sender_balance, 0) < p_credit_value THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient credits');
  END IF;

  -- Calculate platform fee (10%)
  v_platform_fee := CEIL(p_credit_value * 0.10);
  v_creator_amount := p_credit_value - v_platform_fee;

  -- Create gift record (without post_id for direct gifts)
  INSERT INTO gifts (sender_id, receiver_id, gift_type, credit_value, platform_fee, creator_amount)
  VALUES (v_sender_id, v_receiver_id, p_gift_type, p_credit_value, v_platform_fee, v_creator_amount)
  RETURNING id INTO v_gift_id;

  -- Only deduct credits if not admin-minted
  IF NOT COALESCE(v_is_admin_minted, false) THEN
    -- Deduct from sender (trigger will update user_credits)
    INSERT INTO credit_transactions (user_id, amount, transaction_type, description, reference_id)
    VALUES (v_sender_id, -p_credit_value, 'gift_sent', 'Sent direct ' || p_gift_type || ' gift', v_gift_id);
    
    -- Update last gift timestamp
    UPDATE user_credits SET last_gift_sent_at = now() WHERE user_id = v_sender_id;
  END IF;

  -- Credit receiver (trigger will create/update user_credits)
  INSERT INTO credit_transactions (user_id, amount, transaction_type, description, reference_id)
  VALUES (v_receiver_id, v_creator_amount, 'gift_received', 'Received direct ' || p_gift_type || ' gift', v_gift_id);

  RETURN json_build_object(
    'success', true,
    'gift_id', v_gift_id,
    'creator_amount', v_creator_amount,
    'platform_fee', v_platform_fee
  );
END;
$function$;

-- Sync existing data: update user_credits.balance to match credit_transactions sum
-- Only for non-admin users
UPDATE user_credits uc
SET balance = GREATEST(0, COALESCE((
  SELECT SUM(amount) FROM credit_transactions ct WHERE ct.user_id = uc.user_id
), 0)),
updated_at = now()
WHERE (is_admin_minted IS NULL OR is_admin_minted = false);