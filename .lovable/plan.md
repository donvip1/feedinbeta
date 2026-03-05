

## Root Cause

The `send_space_gift` function **directly updates `user_credits.balance`** (lines 87, 90-91), but the `prevent_balance_tampering` trigger blocks all direct balance modifications unless the `app.applying_transaction` session flag is set. Since `send_space_gift` doesn't set this flag before its direct UPDATEs, **the entire function fails and rolls back** — no deduction, no gift recorded, nothing.

Additionally, the function creates a **double-update conflict**: it both directly updates `user_credits` AND inserts into `credit_transactions` (which triggers `apply_credit_transaction` that also updates `user_credits`).

## Fix

### 1. Migration: Rewrite `send_space_gift` to remove direct balance manipulation

Remove the two direct `UPDATE/INSERT INTO user_credits` statements. Instead, rely entirely on `credit_transactions` inserts, which fire the `apply_credit_transaction` trigger that properly sets `app.applying_transaction` and atomically updates balances.

The corrected flow:
1. Check sender balance (SELECT only)
2. Insert sender deduction into `credit_transactions` (trigger handles balance)
3. Insert receiver credit into `credit_transactions` (trigger handles balance)
4. Insert into `live_space_gifts`, `gift_analytics`, `profits_transactions`, update `profits_wallet`

### 2. Same fix for `convert_gift` and `convert_all_gifts`

These functions insert into `credit_transactions` correctly (no direct balance manipulation), so they should already work via the trigger. However, verify the `gift_analytics` records from space gifts have the correct `source_type = 'live_space'` so they appear in the wallet's Gifts tab for conversion.

### Files to modify:
- **New migration SQL** — `CREATE OR REPLACE FUNCTION send_space_gift(...)` without direct `user_credits` manipulation

No frontend changes needed — the UI already calls the RPC and refreshes credits. The issue is purely the backend function being blocked by the tampering trigger.

