-- Give all existing users 100 starting credits
UPDATE user_credits
SET 
  balance = 100,
  total_earned = 100
WHERE balance = 0;

-- Update the initialize_user_credits function to give new users 100 credits
CREATE OR REPLACE FUNCTION public.initialize_user_credits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_credits (user_id, balance, total_earned, total_spent)
  VALUES (NEW.id, 100, 100, 0)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;