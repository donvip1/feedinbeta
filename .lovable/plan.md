

## Fix: Double Credit Deduction on Transfers

### The Problem
The `transfer_credits` database function has a critical bug that deducts credits **twice** from the sender:

1. It manually runs `UPDATE user_credits SET balance = balance - amount`
2. It then inserts a negative transaction into `credit_transactions`, which triggers the `apply_credit_transaction` function that **also** subtracts from the balance

This means every transfer costs the sender 2x the intended amount. Your 50 + 100 credit transfers actually deducted 100 + 200 = 300 credits instead of 150.

### The Fix

**Step 1: Fix the `transfer_credits` function**
Remove the direct `UPDATE user_credits` statements for the sender. The trigger on `credit_transactions` already handles balance updates automatically. Only keep the direct update for the recipient's `ON CONFLICT` insert (since the trigger handles that too, we'll remove both direct updates and let the trigger do all the work).

**Step 2: Refund Adrian's 150 lost credits**
Insert a corrective `credit_transaction` to restore the 150 credits that were incorrectly double-deducted.

### Technical Details

The corrected `transfer_credits` function will:
- Remove the `UPDATE user_credits SET balance = balance - p_amount` line for regular users
- Remove the `INSERT INTO user_credits ... ON CONFLICT DO UPDATE` for the recipient
- Rely entirely on the `apply_credit_transaction` trigger (which already fires on every `credit_transactions` insert) to handle all balance changes
- This matches how every other credit operation in the system works (gifts, purchases, etc.)

### Refund
Adrian will receive +150 credits (type: `refund`, description: "Refund for double-deducted transfers") to correct the balance from 64 back to 214.

