-- Update promote_post function to support promotion by refeeders with original author attribution
DROP FUNCTION IF EXISTS public.promote_post(UUID, TEXT, INTEGER);

CREATE OR REPLACE FUNCTION public.promote_post(
  p_post_id UUID,
  p_plan_name TEXT,
  p_cost INTEGER,
  p_original_author_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_balance INTEGER;
  v_user_id UUID;
  v_post_owner_id UUID;
  v_original_post_id UUID;
  v_actual_original_author UUID;
  author_credit_amount INTEGER;
  result JSON;
BEGIN
  -- Get current user (the promoter)
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check user balance
  SELECT balance INTO user_balance
  FROM user_credits
  WHERE user_id = v_user_id;

  IF user_balance IS NULL OR user_balance < p_cost THEN
    RAISE EXCEPTION 'Insufficient credits. Current balance: %, required: %', COALESCE(user_balance, 0), p_cost;
  END IF;

  -- Verify post exists and get its owner
  SELECT user_id, original_post_id INTO v_post_owner_id, v_original_post_id
  FROM posts 
  WHERE id = p_post_id;

  IF v_post_owner_id IS NULL THEN
    RAISE EXCEPTION 'Post not found';
  END IF;

  -- Determine the actual original author
  -- If this is a refeed/quote, use the provided original_author_id or look it up
  IF v_original_post_id IS NOT NULL THEN
    -- This is a refeed/quote - get original author
    IF p_original_author_id IS NOT NULL THEN
      v_actual_original_author := p_original_author_id;
    ELSE
      SELECT user_id INTO v_actual_original_author
      FROM posts
      WHERE id = v_original_post_id;
    END IF;
  ELSE
    -- This is an original post - author is the post owner
    v_actual_original_author := v_post_owner_id;
  END IF;

  -- Deduct credits from promoter
  INSERT INTO credit_transactions (user_id, type, amount, description, related_id)
  VALUES (v_user_id, 'spent', -p_cost, p_plan_name || ' - Post promotion', p_post_id);

  -- If the promoter is NOT the original author, give 20% to original author as attribution credit
  IF v_user_id != v_actual_original_author THEN
    author_credit_amount := FLOOR(p_cost * 0.2);
    
    INSERT INTO credit_transactions (user_id, type, amount, description, related_id)
    VALUES (v_actual_original_author, 'promotion_attribution', author_credit_amount, 
            'Content promoted by another user', p_post_id);

    -- Create notification for original author
    INSERT INTO notifications (user_id, from_user_id, type, title, message, related_id, related_type)
    VALUES (
      v_actual_original_author,
      v_user_id,
      'promotion',
      'Your content was promoted!',
      'Someone promoted your content using ' || p_plan_name || '. You earned ' || author_credit_amount || ' credits!',
      p_post_id,
      'post'
    );
  END IF;

  -- Return success
  SELECT json_build_object(
    'success', true,
    'message', 'Post promoted successfully',
    'plan', p_plan_name,
    'cost', p_cost,
    'new_balance', user_balance - p_cost,
    'original_author_credited', v_user_id != v_actual_original_author,
    'author_credit', CASE WHEN v_user_id != v_actual_original_author THEN FLOOR(p_cost * 0.2) ELSE 0 END
  ) INTO result;

  RETURN result;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.promote_post(UUID, TEXT, INTEGER, UUID) TO authenticated;