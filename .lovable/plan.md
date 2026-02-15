

## Credit-to-Cash Withdrawal via Paystack Transfers (Updated)

### Conversion and Fee Structure

- **Minimum withdrawal:** 1,000 credits (~$9.99 USD)
- **Platform fee:** 30% deducted from withdrawal amount (does NOT apply to P2P trades)
- **Conversion rate:** 100 credits = $1 USD, then converted to NGN using system exchange rates
- **Example:** User withdraws 1,000 credits ($9.99) -> platform takes 30% (300 credits / ~$3.00) -> user receives 700 credits worth (~$6.99) in NGN

---

### Step 1: Database Migration

Create two new tables:

**`user_bank_accounts`**
- `id` (uuid, PK), `user_id` (uuid, NOT NULL), `bank_code` (text), `bank_name` (text), `account_number` (text), `account_name` (text), `recipient_code` (text, from Paystack), `is_verified` (boolean), `is_default` (boolean), `created_at` (timestamptz)
- RLS: users can SELECT/INSERT/UPDATE/DELETE only their own rows

**`withdrawal_requests`**
- `id` (uuid, PK), `user_id` (uuid), `credit_amount` (integer, total credits requested), `platform_fee_credits` (integer, 30% of credit_amount), `net_credits` (integer, 70% sent to user), `amount_ngn` (numeric, NGN equivalent of net_credits), `exchange_rate_used` (numeric), `status` (text: pending/processing/completed/failed/refunded), `bank_account_id` (uuid, FK), `paystack_transfer_code` (text), `paystack_reference` (text), `failure_reason` (text), `requested_at` (timestamptz), `processed_at` (timestamptz)
- RLS: users can SELECT/INSERT their own rows; only service role can UPDATE

**Database functions (SECURITY DEFINER):**
- `deduct_credits_for_withdrawal(p_user_id, p_amount)` - atomically checks balance, deducts full amount, records a credit_transaction of type `withdrawal`
- `refund_failed_withdrawal(p_user_id, p_amount, p_withdrawal_id)` - refunds credits on transfer failure, records a credit_transaction of type `withdrawal_refund`

---

### Step 2: Edge Function - `paystack-withdrawal`

New file: `supabase/functions/paystack-withdrawal/index.ts`

Handles three actions via POST body `{ action: "..." }`:

1. **`list-banks`** - Calls Paystack `GET /bank?country=nigeria` and returns the list for the UI dropdown
2. **`verify-account`** - Calls Paystack `GET /bank/resolve?account_number=...&bank_code=...` to confirm account name before saving
3. **`request-withdrawal`** - Main withdrawal flow:
   - Validates minimum 1,000 credits
   - Calculates 30% platform fee (e.g., 1,000 credits -> 300 fee, 700 net)
   - Converts net credits to NGN using exchange_rates table
   - Calls `deduct_credits_for_withdrawal` RPC for the full amount (1,000)
   - Records 30% as platform revenue in `platform_wallet`
   - Creates Paystack transfer recipient via `POST /transferrecipient` (or reuses saved `recipient_code`)
   - Initiates Paystack transfer via `POST /transfer` for the NGN amount
   - Creates withdrawal_request record with status `processing`

Config addition in `supabase/config.toml`:
```
[functions.paystack-withdrawal]
verify_jwt = true
```

---

### Step 3: Webhook Updates - `paystack-webhook`

Modify existing `supabase/functions/paystack-webhook/index.ts` to handle:

- **`transfer.success`** - Update withdrawal_requests status to `completed`, set `processed_at`
- **`transfer.failed`** / **`transfer.reversed`** - Update status to `failed`, set `failure_reason`, call `refund_failed_withdrawal` RPC to return credits to user

---

### Step 4: UI Changes

**Modified: `src/components/wallet/WalletTabs.tsx`**
- Add a "Withdraw" tab with a `Banknote` icon

**New: `src/components/wallet/BankAccountForm.tsx`**
- Bank selector dropdown (fetched from `list-banks`)
- Account number input
- "Verify" button that calls `verify-account` and shows the resolved account name
- Save button to store verified bank details

**New: `src/components/wallet/WithdrawTab.tsx`**
- Shows saved bank accounts with option to add new
- Credit amount input with live preview showing:
  - Credits entered (e.g., 1,000)
  - Platform fee: 30% (e.g., 300 credits / ~$3.00)
  - You receive: 70% (e.g., 700 credits / ~$6.99 / ~NGN equivalent)
- Minimum enforcement: 1,000 credits ($9.99)
- "Withdraw" confirmation button
- Withdrawal history list with status badges (pending/processing/completed/failed)

**Modified: `src/components/wallet/BalanceCard.tsx`**
- Add a "Withdraw" button alongside "Send" and "Buy"

**Modified: `src/pages/Wallet.tsx`**
- Import and render `WithdrawTab` when `activeTab === 'withdraw'`

---

### Summary of Files

| Action | File |
|--------|------|
| Create | `supabase/functions/paystack-withdrawal/index.ts` |
| Create | `src/components/wallet/WithdrawTab.tsx` |
| Create | `src/components/wallet/BankAccountForm.tsx` |
| Modify | `supabase/functions/paystack-webhook/index.ts` |
| Modify | `src/components/wallet/WalletTabs.tsx` |
| Modify | `src/components/wallet/BalanceCard.tsx` |
| Modify | `src/pages/Wallet.tsx` |
| Migration | 2 tables, 2 RPC functions, RLS policies |

