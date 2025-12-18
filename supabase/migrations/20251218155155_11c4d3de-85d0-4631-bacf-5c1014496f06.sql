
-- Creator monetization status table
CREATE TABLE public.creator_monetization (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  is_monetized BOOLEAN DEFAULT false,
  monetized_at TIMESTAMP WITH TIME ZONE,
  minimum_balance_threshold INTEGER DEFAULT 1000,
  total_earnings INTEGER DEFAULT 0,
  total_withdrawn INTEGER DEFAULT 0,
  last_payout_at TIMESTAMP WITH TIME ZONE,
  next_eligible_payout TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Creator payout requests table
CREATE TABLE public.creator_payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  amount INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  processed_by UUID,
  rejection_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.creator_monetization ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_payout_requests ENABLE ROW LEVEL SECURITY;

-- RLS for creator_monetization - users can view their own, admins can view all
CREATE POLICY "Users can view own monetization status"
ON public.creator_monetization FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.can_view_admin_wallet());

CREATE POLICY "Admins can manage monetization"
ON public.creator_monetization FOR ALL
TO authenticated
USING (public.can_view_admin_wallet())
WITH CHECK (public.can_view_admin_wallet());

-- RLS for payout requests - users can view their own, admins can view all
CREATE POLICY "Users can view own payout requests"
ON public.creator_payout_requests FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.can_view_admin_wallet());

CREATE POLICY "Users can create own payout requests"
ON public.creator_payout_requests FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage payout requests"
ON public.creator_payout_requests FOR UPDATE
TO authenticated
USING (public.can_view_admin_wallet())
WITH CHECK (public.can_view_admin_wallet());

-- Function to check if user can request payout based on subscription
CREATE OR REPLACE FUNCTION public.can_request_payout(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_monetization RECORD;
  v_subscription RECORD;
  v_is_premium BOOLEAN := false;
  v_last_payout TIMESTAMP WITH TIME ZONE;
  v_days_since_payout INTEGER;
  v_current_day INTEGER;
  v_current_month INTEGER;
  v_can_request BOOLEAN := false;
  v_reason TEXT := '';
  v_next_eligible TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get monetization status
  SELECT * INTO v_monetization FROM creator_monetization WHERE user_id = p_user_id;
  
  IF v_monetization IS NULL OR NOT v_monetization.is_monetized THEN
    RETURN jsonb_build_object('can_request', false, 'reason', 'Profile not monetized');
  END IF;

  -- Check if user has premium subscription
  SELECT us.*, st.name as tier_name INTO v_subscription
  FROM user_subscriptions us
  JOIN subscription_tiers st ON us.tier_id = st.id
  WHERE us.user_id = p_user_id AND us.status = 'active';
  
  IF v_subscription IS NOT NULL AND v_subscription.tier_name IN ('Pro', 'Premium') THEN
    v_is_premium := true;
  END IF;

  v_last_payout := v_monetization.last_payout_at;
  v_current_day := EXTRACT(DAY FROM CURRENT_DATE);
  v_current_month := EXTRACT(MONTH FROM CURRENT_DATE);

  IF v_is_premium THEN
    -- Premium users: every 10 days
    IF v_last_payout IS NULL THEN
      v_can_request := true;
    ELSE
      v_days_since_payout := EXTRACT(DAY FROM (CURRENT_TIMESTAMP - v_last_payout));
      IF v_days_since_payout >= 10 THEN
        v_can_request := true;
      ELSE
        v_next_eligible := v_last_payout + INTERVAL '10 days';
        v_reason := 'Next payout available on ' || to_char(v_next_eligible, 'Mon DD, YYYY');
      END IF;
    END IF;
  ELSE
    -- Regular users: 30th of month (28th for February)
    IF v_current_month = 2 THEN
      -- February: 28th
      IF v_current_day >= 28 THEN
        IF v_last_payout IS NULL OR EXTRACT(MONTH FROM v_last_payout) < v_current_month THEN
          v_can_request := true;
        ELSE
          v_reason := 'Already requested payout this month';
        END IF;
      ELSE
        v_reason := 'Payout available on February 28th';
      END IF;
    ELSE
      -- Other months: 30th
      IF v_current_day >= 30 THEN
        IF v_last_payout IS NULL OR EXTRACT(MONTH FROM v_last_payout) < v_current_month THEN
          v_can_request := true;
        ELSE
          v_reason := 'Already requested payout this month';
        END IF;
      ELSE
        v_reason := 'Payout available on the 30th of this month';
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'can_request', v_can_request,
    'reason', v_reason,
    'is_premium', v_is_premium,
    'available_balance', COALESCE(v_monetization.total_earnings - v_monetization.total_withdrawn, 0),
    'last_payout', v_last_payout
  );
END;
$$;

-- Function to request payout
CREATE OR REPLACE FUNCTION public.request_creator_payout(p_amount INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_can_request JSONB;
  v_available INTEGER;
BEGIN
  v_can_request := can_request_payout(v_user_id);
  
  IF NOT (v_can_request->>'can_request')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', v_can_request->>'reason');
  END IF;

  v_available := (v_can_request->>'available_balance')::integer;
  
  IF p_amount > v_available THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance. Available: ' || v_available);
  END IF;

  IF p_amount < 100 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Minimum payout is 100 credits');
  END IF;

  -- Create payout request
  INSERT INTO creator_payout_requests (user_id, amount, status)
  VALUES (v_user_id, p_amount, 'pending');

  RETURN jsonb_build_object('success', true, 'message', 'Payout request submitted');
END;
$$;

-- Function to process payout (admin only)
CREATE OR REPLACE FUNCTION public.process_payout_request(
  p_request_id UUID,
  p_action TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_request RECORD;
BEGIN
  -- Check admin access
  IF NOT can_view_admin_wallet() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT * INTO v_request FROM creator_payout_requests WHERE id = p_request_id;
  
  IF v_request IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found');
  END IF;

  IF v_request.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request already processed');
  END IF;

  IF p_action = 'approve' THEN
    -- Update request status
    UPDATE creator_payout_requests 
    SET status = 'completed', processed_at = now(), processed_by = v_admin_id, notes = p_notes
    WHERE id = p_request_id;

    -- Add credits to user
    INSERT INTO user_credits (user_id, balance)
    VALUES (v_request.user_id, v_request.amount)
    ON CONFLICT (user_id) DO UPDATE SET balance = user_credits.balance + v_request.amount;

    -- Record transaction
    INSERT INTO credit_transactions (user_id, amount, type, description)
    VALUES (v_request.user_id, v_request.amount, 'payout', 'Creator payout');

    -- Update monetization record
    UPDATE creator_monetization 
    SET total_withdrawn = total_withdrawn + v_request.amount,
        last_payout_at = now(),
        updated_at = now()
    WHERE user_id = v_request.user_id;

    RETURN jsonb_build_object('success', true, 'message', 'Payout approved and processed');

  ELSIF p_action = 'reject' THEN
    UPDATE creator_payout_requests 
    SET status = 'rejected', processed_at = now(), processed_by = v_admin_id, rejection_reason = p_notes
    WHERE id = p_request_id;

    RETURN jsonb_build_object('success', true, 'message', 'Payout rejected');
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid action');
  END IF;
END;
$$;

-- Function to get payout statistics for admins
CREATE OR REPLACE FUNCTION public.get_payout_statistics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stats JSONB;
BEGIN
  IF NOT can_view_admin_wallet() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  SELECT jsonb_build_object(
    'total_monetized_creators', (SELECT COUNT(*) FROM creator_monetization WHERE is_monetized = true),
    'pending_requests', (SELECT COUNT(*) FROM creator_payout_requests WHERE status = 'pending'),
    'total_paid_out', (SELECT COALESCE(SUM(amount), 0) FROM creator_payout_requests WHERE status = 'completed'),
    'total_pending_amount', (SELECT COALESCE(SUM(amount), 0) FROM creator_payout_requests WHERE status = 'pending'),
    'this_month_payouts', (
      SELECT COALESCE(SUM(amount), 0) FROM creator_payout_requests 
      WHERE status = 'completed' 
      AND EXTRACT(MONTH FROM processed_at) = EXTRACT(MONTH FROM CURRENT_DATE)
      AND EXTRACT(YEAR FROM processed_at) = EXTRACT(YEAR FROM CURRENT_DATE)
    )
  ) INTO v_stats;

  RETURN v_stats;
END;
$$;

-- Function to toggle monetization status (admin only)
CREATE OR REPLACE FUNCTION public.toggle_creator_monetization(p_user_id UUID, p_monetize BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT can_view_admin_wallet() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  INSERT INTO creator_monetization (user_id, is_monetized, monetized_at)
  VALUES (p_user_id, p_monetize, CASE WHEN p_monetize THEN now() ELSE NULL END)
  ON CONFLICT (user_id) DO UPDATE 
  SET is_monetized = p_monetize, 
      monetized_at = CASE WHEN p_monetize THEN now() ELSE creator_monetization.monetized_at END,
      updated_at = now();

  RETURN jsonb_build_object('success', true);
END;
$$;
