-- Backfill user_credits balances by re-summing all historical credit_transactions
-- This fixes any legacy mismatches causing false 'insufficient credits' errors

DO $$
DECLARE
  user_record RECORD;
  total_balance INTEGER;
  total_earned INTEGER;
  total_spent INTEGER;
BEGIN
  -- Loop through all users who have credit transactions
  FOR user_record IN 
    SELECT DISTINCT user_id FROM credit_transactions
  LOOP
    -- Calculate correct balances from transactions
    SELECT 
      COALESCE(SUM(amount), 0),
      COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0)
    INTO total_balance, total_earned, total_spent
    FROM credit_transactions
    WHERE user_id = user_record.user_id;
    
    -- Update or insert the correct balance
    INSERT INTO user_credits (user_id, balance, total_earned, total_spent, updated_at)
    VALUES (user_record.user_id, total_balance, total_earned, total_spent, now())
    ON CONFLICT (user_id) DO UPDATE SET
      balance = EXCLUDED.balance,
      total_earned = EXCLUDED.total_earned,
      total_spent = EXCLUDED.total_spent,
      updated_at = now();
    
    RAISE NOTICE 'Backfilled user % - Balance: %, Earned: %, Spent: %', 
      user_record.user_id, total_balance, total_earned, total_spent;
  END LOOP;
  
  RAISE NOTICE 'Backfill completed successfully';
END $$;