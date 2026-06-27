-- Update the initialize_user_credits function to give new users 30 credits instead of 100
CREATE OR REPLACE FUNCTION public.initialize_user_credits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_credits (user_id, balance, total_earned, total_spent)
  VALUES (NEW.id, 30, 30, 0)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;