-- Fix the promote_post function to use correct column name and check balance before deducting
CREATE OR REPLACE FUNCTION public.promote_post(p_post_id uuid, p_plan_name text, p_cost integer, p_original_author_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_current_balance INTEGER;
  v_post_user_id UUID;
  v_actual_original_author UUID;
  v_author_credit INTEGER;
  v_duration_hours INTEGER;
  v_new_balance INTEGER;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Get user's current credit balance (using correct column name 'balance')
  SELECT balance INTO v_current_balance FROM user_credits WHERE user_id = v_user_id;
  
  IF v_current_balance IS NULL OR v_current_balance < p_cost THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient credits. You have ' || COALESCE(v_current_balance, 0) || ' but need ' || p_cost);
  END IF;
  
  -- Get post author
  SELECT user_id INTO v_post_user_id FROM posts WHERE id = p_post_id;
  
  IF v_post_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Post not found');
  END IF;
  
  -- Determine the original author for attribution
  v_actual_original_author := COALESCE(p_original_author_id, v_post_user_id);
  
  -- Calculate duration based on plan
  v_duration_hours := CASE 
    WHEN p_plan_name ILIKE '%elite%' THEN 336      -- 14 days
    WHEN p_plan_name ILIKE '%premium%' THEN 168   -- 7 days
    WHEN p_plan_name ILIKE '%pro%' THEN 72        -- 3 days
    WHEN p_plan_name ILIKE '%basic%' THEN 24      -- 1 day
    ELSE 12                                        -- starter 12 hours
  END;
  
  -- Deduct credits from promoter directly to avoid constraint violation
  UPDATE user_credits 
  SET balance = balance - p_cost,
      total_spent = total_spent + p_cost,
      updated_at = now()
  WHERE user_id = v_user_id AND balance >= p_cost
  RETURNING balance INTO v_new_balance;
  
  IF v_new_balance IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Failed to deduct credits - insufficient balance');
  END IF;
  
  -- Record the transaction
  INSERT INTO credit_transactions (user_id, amount, type, description, related_id)
  VALUES (v_user_id, -p_cost, 'spent', 'Post promotion: ' || p_plan_name, p_post_id);
  
  -- If promoting someone else's content, give them 20%
  IF v_user_id != v_actual_original_author THEN
    v_author_credit := GREATEST(1, (p_cost * 20) / 100);
    
    -- Add credits to original author
    INSERT INTO user_credits (user_id, balance, total_earned)
    VALUES (v_actual_original_author, v_author_credit, v_author_credit)
    ON CONFLICT (user_id) DO UPDATE SET 
      balance = user_credits.balance + v_author_credit,
      total_earned = user_credits.total_earned + v_author_credit,
      updated_at = now();
    
    INSERT INTO credit_transactions (user_id, amount, type, description, related_id)
    VALUES (v_actual_original_author, v_author_credit, 'earned', 'Reward for promoted content', p_post_id);
    
    -- Notify original author
    INSERT INTO notifications (user_id, from_user_id, type, title, message, related_id, related_type)
    VALUES (
      v_actual_original_author, 
      v_user_id, 
      'promotion_reward', 
      'Your content was promoted!', 
      'Someone promoted your content and you earned ' || v_author_credit || ' credits!',
      p_post_id,
      'post'
    );
  END IF;
  
  -- Create or update promotion record
  INSERT INTO post_promotions (post_id, user_id, credits_spent, boost_level, expires_at, is_active)
  VALUES (p_post_id, v_user_id, p_cost, p_plan_name, now() + (v_duration_hours || ' hours')::interval, true)
  ON CONFLICT (post_id, user_id) 
  DO UPDATE SET 
    credits_spent = post_promotions.credits_spent + p_cost,
    expires_at = GREATEST(post_promotions.expires_at, now()) + (v_duration_hours || ' hours')::interval,
    is_active = true;
  
  -- Update user analytics
  INSERT INTO user_analytics (user_id, total_promotions, last_active)
  VALUES (v_user_id, 1, now())
  ON CONFLICT (user_id) DO UPDATE SET 
    total_promotions = user_analytics.total_promotions + 1,
    last_active = now();
  
  RETURN json_build_object(
    'success', true, 
    'new_balance', v_new_balance,
    'original_author_credited', v_user_id != v_actual_original_author,
    'author_credit', CASE WHEN v_user_id != v_actual_original_author THEN v_author_credit ELSE 0 END
  );
END;
$function$;