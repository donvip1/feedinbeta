-- Update promote_post function to include promoter's display name in notification
CREATE OR REPLACE FUNCTION public.promote_post(p_post_id uuid, p_credits integer, p_boost_type text DEFAULT 'basic'::text, p_original_author_id uuid DEFAULT NULL::uuid)
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
  v_promoter_name TEXT;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Get user's current credit balance
  SELECT credits INTO v_current_balance FROM user_credits WHERE user_id = v_user_id;
  
  IF v_current_balance IS NULL OR v_current_balance < p_credits THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient credits');
  END IF;
  
  -- Get post author
  SELECT user_id INTO v_post_user_id FROM posts WHERE id = p_post_id;
  
  IF v_post_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Post not found');
  END IF;
  
  -- Determine the original author for attribution
  v_actual_original_author := COALESCE(p_original_author_id, v_post_user_id);
  
  -- Get promoter's display name
  SELECT COALESCE(display_name, username, 'Someone') INTO v_promoter_name 
  FROM profiles WHERE id = v_user_id;
  
  -- Calculate duration based on boost type
  v_duration_hours := CASE p_boost_type
    WHEN 'premium' THEN 72
    WHEN 'standard' THEN 48
    ELSE 24
  END;
  
  -- Deduct credits from promoter
  INSERT INTO credit_transactions (user_id, amount, type, description, related_id)
  VALUES (v_user_id, -p_credits, 'promotion', 'Post promotion: ' || p_boost_type, p_post_id);
  
  -- If promoting someone else's content, give them 20%
  IF v_user_id != v_actual_original_author THEN
    v_author_credit := GREATEST(1, (p_credits * 20) / 100);
    
    INSERT INTO credit_transactions (user_id, amount, type, description, related_id)
    VALUES (v_actual_original_author, v_author_credit, 'promotion_reward', 'Reward for promoted content', p_post_id);
    
    -- Notify original author with promoter's name
    INSERT INTO notifications (user_id, from_user_id, type, title, message, related_id, related_type)
    VALUES (
      v_actual_original_author, 
      v_user_id, 
      'promotion_reward', 
      'Your content was promoted!', 
      v_promoter_name || ' promoted your post and you earned ' || v_author_credit || ' credits!',
      p_post_id,
      'post'
    );
  END IF;
  
  -- Create or update promotion record
  INSERT INTO post_promotions (post_id, user_id, credits_spent, boost_level, expires_at, is_active)
  VALUES (p_post_id, v_user_id, p_credits, p_boost_type, now() + (v_duration_hours || ' hours')::interval, true)
  ON CONFLICT (post_id, user_id) 
  DO UPDATE SET 
    credits_spent = post_promotions.credits_spent + p_credits,
    expires_at = GREATEST(post_promotions.expires_at, now()) + (v_duration_hours || ' hours')::interval,
    is_active = true;
  
  -- Update user analytics
  INSERT INTO user_analytics (user_id, total_promotions, last_active)
  VALUES (v_user_id, 1, now())
  ON CONFLICT (user_id) DO UPDATE SET 
    total_promotions = user_analytics.total_promotions + 1,
    last_active = now();
  
  RETURN json_build_object('success', true);
END;
$function$;