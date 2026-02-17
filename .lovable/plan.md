

# Fix: Payment Redirect 404 and Subscription Not Activating

## Problem Summary

Two issues are causing the payment failure:

1. **404 Page After Payment**: After Paystack processes the payment, it redirects the user to `https://feedinn.com/credits` or `https://feedinn.com/subscription` -- a domain that doesn't match your app. The correct routes are `/wallet/credits` and `/wallet/subscription` on your actual app domain.

2. **No Credits or Badge Granted**: The Paystack webhook (server-side confirmation) is crashing every time. The error: `"there is no unique or exclusion constraint matching the ON CONFLICT specification"`. The code tries to upsert a subscription using `user_id` as the conflict key, but the database only has a unique constraint on `stripe_subscription_id`, not on `user_id`. So the insert fails and no subscription or credits are ever granted.

---

## Fix Plan

### Step 1: Database Migration -- Add Unique Constraint on `user_id`

Add a unique constraint on the `user_subscriptions.user_id` column so the upsert logic works correctly (one active subscription per user).

```sql
ALTER TABLE public.user_subscriptions
  ADD CONSTRAINT user_subscriptions_user_id_unique UNIQUE (user_id);
```

### Step 2: Fix the Callback URL in `paystack-checkout` Edge Function

Update `supabase/functions/paystack-checkout/index.ts` line 187:

**Before:**
```
callback_url: `https://feedinn.com/${type === 'credits' ? 'credits' : 'subscription'}?reference=`,
```

**After:**
```
callback_url: `${Deno.env.get('SITE_URL') || req.headers.get('origin') || 'https://feedinbeta.lovable.app'}/wallet/${type === 'credits' ? 'credits' : 'subscription'}`,
```

This dynamically uses the correct app origin and the correct `/wallet/...` routes. Paystack automatically appends `?trxref=...&reference=...` to the callback URL.

### Step 3: Retry Failed Payments

After deploying these fixes, the webhook will work for new payments. For the user who already paid but didn't receive their subscription/credits, we have two options:
- The user can contact support to manually activate via the Admin Panel
- Or re-trigger the webhook verification from the client by navigating to the credits/subscription page with the `?reference=` query param (the `usePaystack` hook already handles this)

---

## Technical Details

| Component | File | Change |
|-----------|------|--------|
| Database | Migration SQL | Add `UNIQUE (user_id)` constraint to `user_subscriptions` |
| Edge Function | `supabase/functions/paystack-checkout/index.ts` | Fix `callback_url` to use correct domain and route paths |
| Edge Function | `supabase/functions/paystack-webhook/index.ts` | No change needed -- it already uses `onConflict: 'user_id'` which will work once the constraint exists |

