-- Drop duplicate comment count triggers (keeping only one)
DROP TRIGGER IF EXISTS update_post_comments_count_trigger ON post_comments;

-- Drop duplicate notification badge triggers
DROP TRIGGER IF EXISTS trg_notifications_insert_badge ON notifications;
DROP TRIGGER IF EXISTS trg_notifications_update_read_badge ON notifications;
DROP TRIGGER IF EXISTS trg_notifications_delete_badge ON notifications;

-- Drop duplicate credit transaction trigger (keep apply_credit_transaction)
DROP TRIGGER IF EXISTS on_credit_transaction_update_balance ON credit_transactions;

-- Drop duplicate user credits initialization trigger on profiles
DROP TRIGGER IF EXISTS trg_initialize_user_credits ON profiles;

-- Fix RLS policy for credit_transactions to allow users to insert their own transactions
DROP POLICY IF EXISTS "Users can insert their own credit transactions" ON credit_transactions;
CREATE POLICY "Users can insert their own credit transactions"
ON credit_transactions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Ensure users can view their own credit transactions
DROP POLICY IF EXISTS "Users can view their own credit transactions" ON credit_transactions;
CREATE POLICY "Users can view their own credit transactions"
ON credit_transactions
FOR SELECT
USING (auth.uid() = user_id);