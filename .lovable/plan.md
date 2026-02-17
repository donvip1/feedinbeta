

# Rebuild: FeedIn Wallet System

## Overview

Rename "Admin Wallet" to "FeedIn Wallet" and restructure the entire credit flow so all credits distributed to users (subscriptions, transfers, gifts from admins) are deducted from the FeedIn Wallet (platform_wallet). Only the CEO/Super Admin can fund the FeedIn Wallet from the unlimited supply (minting). Admins with granted permissions can transfer but not withdraw. Moderators get view-only access. A new Subscribers section will track all subscription activity.

## Current Issues Found

- **tester1 (super_admin)** has ~1 billion credits in personal balance -- these were not deducted from platform_wallet
- Platform wallet balance is 0 with only 10,000 ever minted
- Admin grants (10,000 credits across 20 transactions) went directly to users without deducting from platform_wallet
- No tracking of subscriber activity in the admin dashboard

## Changes

### 1. Database: New Permission Function for Super Admin Only Minting

Create `can_mint_credits()` that restricts minting to `super_admin` role only, separate from `can_manage_credits()` which allows both `super_admin` and `admin` (with granted permissions).

### 2. Database: Fix `admin_mint_credits` -- Super Admin Only

Restrict to `super_admin` role exclusively. This is the "Fund FeedIn Wallet" action.

### 3. Database: Fix `admin_transfer_to_user` -- Deduct from Platform Wallet

Already deducts from platform wallet (confirmed in code). No change needed, but will ensure admin role with `can_manage_credits` flag can use it.

### 4. Database: Update Permission Functions

```text
can_mint_credits()     -> super_admin ONLY
can_manage_credits()   -> super_admin OR admin (unchanged)
can_view_admin_wallet() -> super_admin, admin, moderator (unchanged)
can_withdraw()         -> super_admin ONLY (new)
```

### 5. Database: Create Subscriber Tracking View

A new SQL function `get_subscription_statistics()` that returns:
- Total subscribers per tier (Basic, Pro, Premium)
- Revenue from subscriptions
- Recent subscription activations
- Active vs expired subscriptions

### 6. Database: Recalculate/Deduct Previously Distributed Credits

The 10,000 credits that were admin_granted to users were never deducted from the platform wallet. We need to either:
- Deduct 10,000 from platform_wallet (but it's already at 0)
- Or mint enough to cover the deficit first

Since the super_admin has ~1B credits personally, those need to be corrected too. We'll sync the platform wallet to reflect reality.

### 7. Frontend: Rename and Restructure `AdminWallet.tsx`

Rename all references from "Admin Wallet" to "FeedIn Wallet" throughout:
- Page title, settings menu, route descriptions
- Header text: "FeedIn Wallet" with FeedIn branding

### 8. Frontend: Role-Based UI Sections

```text
Super Admin/CEO sees:
  - Fund FeedIn Wallet (mint from unlimited supply)
  - Transfer to users
  - Withdraw to team wallet / profits
  - All statistics + subscriber tracking
  - Full transaction history

Admin (with granted permissions) sees:
  - Transfer to users (from FeedIn Wallet balance)
  - All statistics + subscriber tracking
  - Transaction history
  - NO minting, NO withdrawing

Moderator sees:
  - View-only statistics
  - View subscriber list
  - View transaction history
  - NO actions at all
```

### 9. Frontend: New "Subscribers" Tab/Section

Add a subscribers section showing:
- Cards per tier with subscriber counts
- List of active subscribers with username, plan, start date, expiry
- Subscription revenue totals
- Recent subscription activity

### 10. Webhook: Ensure Subscription Credits Come from Platform Wallet

Update `paystack-webhook` so that when subscription credits are granted, they are deducted from the platform wallet balance (not created from nothing).

---

## Technical Implementation Details

### Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/new.sql` | Create | New permission functions, subscriber stats function, wallet adjustments |
| `src/pages/AdminWallet.tsx` | Major rewrite | Rename to FeedIn Wallet, add role-based sections, subscriber tracking |
| `src/pages/Settings.tsx` | Edit | Rename "Admin Wallet" to "FeedIn Wallet" |
| `supabase/functions/paystack-webhook/index.ts` | Edit | Deduct subscription credits from platform_wallet |

### New SQL Functions

1. **`can_mint_credits()`** - Returns true only for super_admin
2. **`can_withdraw_from_wallet()`** - Returns true only for super_admin
3. **`get_subscription_statistics()`** - Returns subscriber counts, revenue, active list
4. **`get_active_subscribers(p_limit int)`** - Returns detailed subscriber list with profiles

### Database Migration Steps

1. Create new permission functions
2. Create subscriber statistics functions
3. Update `admin_mint_credits` to check `super_admin` only
4. Add platform_wallet deduction to `add_credits_from_purchase` for subscription credits
5. Sync credit_supply with actual distributed amounts

### Paystack Webhook Update

When granting subscription credits, also deduct from platform_wallet:
```text
-- After adding credits to user via add_credits_from_purchase
UPDATE platform_wallet 
SET balance = balance - subscription_credits
WHERE id = '00000000-0000-0000-0000-000000000001';
```

This ensures the FeedIn Wallet is the single source of truth for all credit distribution.

