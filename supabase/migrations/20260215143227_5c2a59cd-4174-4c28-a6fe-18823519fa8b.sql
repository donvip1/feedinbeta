
-- Create the add_credits_from_purchase function that the edge function calls
CREATE OR REPLACE FUNCTION public.add_credits_from_purchase(
  p_user_id UUID,
  p_amount INTEGER,
  p_description TEXT DEFAULT 'Credit purchase',
  p_reference TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert the credit transaction
  INSERT INTO public.credit_transactions (user_id, amount, type, description, stripe_payment_intent_id)
  VALUES (p_user_id, p_amount, 'purchase', p_description, p_reference);

  -- Update user_credits balance
  UPDATE public.user_credits
  SET balance = balance + p_amount,
      total_earned = total_earned + p_amount,
      updated_at = now()
  WHERE user_id = p_user_id;

  -- If no row was updated, insert a new one
  IF NOT FOUND THEN
    INSERT INTO public.user_credits (user_id, balance, total_earned)
    VALUES (p_user_id, p_amount, p_amount);
  END IF;
END;
$$;
