-- Add promotion fields to credit_packages
ALTER TABLE public.credit_packages
ADD COLUMN IF NOT EXISTS promotion_active boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS promotion_start timestamp with time zone,
ADD COLUMN IF NOT EXISTS promotion_end timestamp with time zone,
ADD COLUMN IF NOT EXISTS discount_percentage numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS promotion_label text;

-- Create user_analytics table for admin dashboard
CREATE TABLE IF NOT EXISTS public.user_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  total_credits_purchased integer DEFAULT 0,
  total_credits_spent integer DEFAULT 0,
  total_subscriptions integer DEFAULT 0,
  last_purchase_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on user_analytics
ALTER TABLE public.user_analytics ENABLE ROW LEVEL SECURITY;

-- Admins can view all analytics
CREATE POLICY "Admins can view all user analytics"
ON public.user_analytics FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create function to update user analytics
CREATE OR REPLACE FUNCTION public.update_user_analytics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.type = 'purchase' THEN
    INSERT INTO public.user_analytics (user_id, total_credits_purchased, last_purchase_at)
    VALUES (NEW.user_id, NEW.amount, now())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      total_credits_purchased = user_analytics.total_credits_purchased + NEW.amount,
      last_purchase_at = now(),
      updated_at = now();
  ELSIF NEW.type = 'spent' THEN
    INSERT INTO public.user_analytics (user_id, total_credits_spent)
    VALUES (NEW.user_id, ABS(NEW.amount))
    ON CONFLICT (user_id)
    DO UPDATE SET 
      total_credits_spent = user_analytics.total_credits_spent + ABS(NEW.amount),
      updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for analytics
CREATE TRIGGER update_analytics_on_transaction
AFTER INSERT ON public.credit_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_user_analytics();

-- Create function to refund failed friend requests
CREATE OR REPLACE FUNCTION public.refund_failed_friend_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  refund_amount integer := 1; -- Cost of friend request
BEGIN
  -- If friend request is rejected or deleted, refund the sender
  IF (TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'rejected') OR
     (TG_OP = 'DELETE' AND OLD.status = 'pending') THEN
    
    -- Insert refund transaction
    INSERT INTO public.credit_transactions (
      user_id,
      type,
      amount,
      description,
      related_id
    ) VALUES (
      COALESCE(OLD.sender_id, NEW.sender_id),
      'refund',
      refund_amount,
      'Refund for rejected/failed friend request',
      COALESCE(OLD.id, NEW.id)
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger for friend request refunds
CREATE TRIGGER refund_on_friend_request_failure
AFTER UPDATE OR DELETE ON public.friend_requests
FOR EACH ROW
EXECUTE FUNCTION public.refund_failed_friend_request();

-- Create admin grant credits function
CREATE OR REPLACE FUNCTION public.admin_grant_credits(
  target_user_id uuid,
  credit_amount integer,
  reason text DEFAULT 'Admin bonus'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  -- Check if caller is admin
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can grant credits';
  END IF;

  -- Insert credit transaction
  INSERT INTO public.credit_transactions (
    user_id,
    type,
    amount,
    description
  ) VALUES (
    target_user_id,
    'admin_grant',
    credit_amount,
    reason
  );

  -- Return success
  SELECT json_build_object(
    'success', true,
    'user_id', target_user_id,
    'amount', credit_amount
  ) INTO result;

  RETURN result;
END;
$$;