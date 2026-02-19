
# Fix Badge Size and Badge Display Reliability

## Problem Summary

Two issues need fixing:

1. **Badge size is too large** - The verified badge icons next to usernames need to be reduced by 15%.
2. **Badges appear and disappear inconsistently** - Subscribed users sometimes see their badge, sometimes don't. This is caused by a **missing database foreign key**.

## Root Cause of Badge Flickering

The `VerifiedBadge` component queries `user_subscriptions` with a joined select: `subscription_tiers(name)`. However, there is **no foreign key constraint** between `user_subscriptions.tier_id` and `subscription_tiers.id` in the database.

Without this foreign key, the database cannot perform the join reliably -- the tier name comes back as `null` randomly, which makes badges appear and disappear.

## Fix Plan

### Step 1: Reduce badge sizes by 15%

**File: `src/components/profile/VerifiedBadge.tsx`**

Current sizes and new sizes (reduced by ~15%):
- sm: 22px --> 19px
- md: 27px --> 23px  
- lg: 32px --> 27px

### Step 2: Add missing foreign key constraint (Database)

Run a migration to add the foreign key:

```text
ALTER TABLE public.user_subscriptions
ADD CONSTRAINT fk_user_subscriptions_tier
FOREIGN KEY (tier_id) REFERENCES public.subscription_tiers(id);
```

This single database fix will make badges show reliably across the entire app since all badge components query `subscription_tiers(name)` through this same join.

### Step 3: Improve VerifiedBadge resilience

Update `VerifiedBadge.tsx` to add a fallback query approach -- if the join returns null, do a separate direct query to `subscription_tiers` using the `tier_id`. This ensures badges work even if caching or timing causes issues.

Also clear the badge cache on auth state changes so badges refresh properly when users log in.

## Technical Details

- The `tier_id` column already exists in `user_subscriptions` with valid data
- The database client requires foreign keys to resolve joined/embedded selects
- The 2-minute cache in `VerifiedBadge` will naturally pick up correct data after the FK fix
- The fallback query adds an extra safety net for edge cases
- Badge size reduction applies to the inline verified icon next to names (not the avatar overlay icon which is already smaller)
