-- 1. Add conversion tracking columns to gift_analytics
ALTER TABLE gift_analytics 
ADD COLUMN IF NOT EXISTS is_converted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ;

-- 2. Fix send_gift function with correct column names
CREATE OR REPLACE FUNCTION public.send_gift(p_post_id uuid, p_gift_type text, p_credit_value integer)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_sender_id UUID;
  v_receiver_id UUID;
  v_platform_fee INTEGER;
  v_sender_balance INTEGER;
  v_gift_id UUID;
BEGIN
  v_sender_id := auth.uid();
  
  IF v_sender_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Get post owner
  SELECT user_id INTO v_receiver_id FROM posts WHERE id = p_post_id;
  
  IF v_receiver_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Post not found');
  END IF;
  
  IF v_sender_id = v_receiver_id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot gift yourself');
  END IF;
  
  -- Check sender balance
  SELECT COALESCE(SUM(amount), 0) INTO v_sender_balance 
  FROM credit_transactions WHERE user_id = v_sender_id;
  
  IF v_sender_balance < p_credit_value THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient credits');
  END IF;
  
  -- Calculate platform fee (10%)
  v_platform_fee := GREATEST(1, FLOOR(p_credit_value * 0.10));
  
  -- Deduct from sender
  INSERT INTO credit_transactions (user_id, amount, type, description, related_id)
  VALUES (v_sender_id, -p_credit_value, 'gift_sent', 'Gift sent: ' || p_gift_type, p_post_id);
  
  -- DO NOT credit receiver immediately - gift stays unconverted
  -- Receiver will need to convert the gift to get credits
  
  -- Record gift analytics with CORRECT column names
  INSERT INTO gift_analytics (sender_id, receiver_id, gift_type, credit_value, platform_fee, source_type, source_id, is_converted)
  VALUES (v_sender_id, v_receiver_id, p_gift_type, p_credit_value, v_platform_fee, 'post', p_post_id, false)
  RETURNING id INTO v_gift_id;
  
  -- Increment gifts_count on post
  UPDATE posts SET gifts_count = COALESCE(gifts_count, 0) + 1 WHERE id = p_post_id;
  
  -- Create notification with CORRECT column name (from_user_id not actor_id)
  INSERT INTO notifications (user_id, type, title, message, related_id, related_type, from_user_id)
  VALUES (
    v_receiver_id, 
    'gift_received', 
    'New Gift!', 
    'You received a ' || p_gift_type || ' gift worth ' || (p_credit_value - v_platform_fee) || ' credits',
    p_post_id,
    'post',
    v_sender_id
  );
  
  RETURN json_build_object(
    'success', true, 
    'gift_id', v_gift_id,
    'net_amount', p_credit_value - v_platform_fee
  );
END;
$$;

-- 3. Fix send_direct_gift function 
CREATE OR REPLACE FUNCTION public.send_direct_gift(p_credit_value integer, p_gift_type text, p_recipient_identifier text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_sender_id UUID;
  v_receiver_id UUID;
  v_platform_fee INTEGER;
  v_sender_balance INTEGER;
  v_gift_id UUID;
BEGIN
  v_sender_id := auth.uid();
  
  IF v_sender_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Try to find recipient by UUID first, then by username
  BEGIN
    v_receiver_id := p_recipient_identifier::uuid;
    -- Verify user exists
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_receiver_id) THEN
      v_receiver_id := NULL;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Not a UUID, try username
    SELECT id INTO v_receiver_id FROM profiles WHERE username = p_recipient_identifier;
  END;
  
  IF v_receiver_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Recipient not found');
  END IF;
  
  IF v_sender_id = v_receiver_id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot gift yourself');
  END IF;
  
  -- Check sender balance
  SELECT COALESCE(SUM(amount), 0) INTO v_sender_balance 
  FROM credit_transactions WHERE user_id = v_sender_id;
  
  IF v_sender_balance < p_credit_value THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient credits');
  END IF;
  
  -- Calculate platform fee (10%)
  v_platform_fee := GREATEST(1, FLOOR(p_credit_value * 0.10));
  
  -- Deduct from sender
  INSERT INTO credit_transactions (user_id, amount, type, description, related_id)
  VALUES (v_sender_id, -p_credit_value, 'gift_sent', 'Direct gift sent: ' || p_gift_type, v_receiver_id);
  
  -- DO NOT credit receiver immediately - gift stays unconverted
  
  -- Record gift analytics with correct source_type
  INSERT INTO gift_analytics (sender_id, receiver_id, gift_type, credit_value, platform_fee, source_type, source_id, is_converted)
  VALUES (v_sender_id, v_receiver_id, p_gift_type, p_credit_value, v_platform_fee, 'direct', NULL, false)
  RETURNING id INTO v_gift_id;
  
  -- Create notification with correct column name
  INSERT INTO notifications (user_id, type, title, message, related_id, related_type, from_user_id)
  VALUES (
    v_receiver_id, 
    'gift_received', 
    'New Gift!', 
    'You received a direct ' || p_gift_type || ' gift worth ' || (p_credit_value - v_platform_fee) || ' credits',
    v_gift_id,
    'gift',
    v_sender_id
  );
  
  RETURN json_build_object(
    'success', true, 
    'gift_id', v_gift_id,
    'net_amount', p_credit_value - v_platform_fee
  );
END;
$$;

-- 4. Create convert_gift function
CREATE OR REPLACE FUNCTION public.convert_gift(p_gift_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_gift RECORD;
  v_net_amount INTEGER;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Get gift and verify ownership
  SELECT * INTO v_gift FROM gift_analytics 
  WHERE id = p_gift_id AND receiver_id = v_user_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Gift not found');
  END IF;
  
  IF v_gift.is_converted THEN
    RETURN json_build_object('success', false, 'error', 'Gift already converted');
  END IF;
  
  v_net_amount := v_gift.credit_value - COALESCE(v_gift.platform_fee, 0);
  
  -- Credit user
  INSERT INTO credit_transactions (user_id, amount, type, description, related_id)
  VALUES (v_user_id, v_net_amount, 'gift_converted', 'Converted gift: ' || v_gift.gift_type, p_gift_id);
  
  -- Mark as converted
  UPDATE gift_analytics SET is_converted = true, converted_at = now()
  WHERE id = p_gift_id;
  
  RETURN json_build_object('success', true, 'credits_added', v_net_amount);
END;
$$;

-- 5. Create convert_all_gifts function
CREATE OR REPLACE FUNCTION public.convert_all_gifts()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_total_credits INTEGER := 0;
  v_gift_count INTEGER := 0;
  v_gift RECORD;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  FOR v_gift IN 
    SELECT * FROM gift_analytics 
    WHERE receiver_id = v_user_id AND (is_converted = false OR is_converted IS NULL)
  LOOP
    v_total_credits := v_total_credits + (v_gift.credit_value - COALESCE(v_gift.platform_fee, 0));
    v_gift_count := v_gift_count + 1;
  END LOOP;
  
  IF v_gift_count = 0 THEN
    RETURN json_build_object('success', false, 'error', 'No gifts to convert');
  END IF;
  
  -- Credit all at once
  INSERT INTO credit_transactions (user_id, amount, type, description)
  VALUES (v_user_id, v_total_credits, 'gift_converted', 'Converted ' || v_gift_count || ' gifts');
  
  -- Mark all as converted
  UPDATE gift_analytics SET is_converted = true, converted_at = now()
  WHERE receiver_id = v_user_id AND (is_converted = false OR is_converted IS NULL);
  
  RETURN json_build_object('success', true, 'gifts_converted', v_gift_count, 'credits_added', v_total_credits);
END;
$$;

-- 6. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.convert_gift(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.convert_all_gifts() TO authenticated;