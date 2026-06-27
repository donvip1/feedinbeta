-- Fix transfer_credits function by dropping and recreating
DROP FUNCTION IF EXISTS public.transfer_credits(text, integer);

CREATE OR REPLACE FUNCTION public.transfer_credits(
  p_recipient_username text,
  p_amount integer
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_id uuid;
  v_recipient_id uuid;
  v_sender_balance integer;
BEGIN
  -- Get sender ID
  v_sender_id := auth.uid();
  
  IF v_sender_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Find recipient by username
  SELECT id INTO v_recipient_id
  FROM profiles
  WHERE username = p_recipient_username;
  
  IF v_recipient_id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  IF v_sender_id = v_recipient_id THEN
    RAISE EXCEPTION 'Cannot transfer credits to yourself';
  END IF;
  
  -- Check sender balance
  SELECT balance INTO v_sender_balance
  FROM user_credits
  WHERE user_id = v_sender_id;
  
  IF v_sender_balance IS NULL OR v_sender_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient credits';
  END IF;
  
  -- Deduct from sender
  INSERT INTO credit_transactions (user_id, amount, type, description)
  VALUES (v_sender_id, -p_amount, 'transfer_out', 'Transfer to @' || p_recipient_username);
  
  -- Add to recipient
  INSERT INTO credit_transactions (user_id, amount, type, description)
  VALUES (v_recipient_id, p_amount, 'transfer_in', 'Transfer from user');
  
END;
$$;