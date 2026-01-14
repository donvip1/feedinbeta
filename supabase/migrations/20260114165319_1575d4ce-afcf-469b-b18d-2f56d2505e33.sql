-- Create function to increment referral count
CREATE OR REPLACE FUNCTION public.increment_referral_count(referrer_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE profiles 
  SET referral_count = COALESCE(referral_count, 0) + 1
  WHERE id = referrer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;