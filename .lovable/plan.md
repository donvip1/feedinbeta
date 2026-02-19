
# Fix Verified Badges Not Showing in Photo+ Feed

## Root Cause

The foreign key constraint between `user_subscriptions.tier_id` and `subscription_tiers.id` was **added then immediately dropped** by two conflicting migrations:
- Migration 1: Added the FK constraint
- Migration 2: Dropped the FK constraint

Without this foreign key, the Supabase JS client cannot resolve the embedded select `subscription_tiers(name)` in the query. The entire query returns an error or null data, which means the fallback (`tierData?.tier_id`) is also null -- so **no badge renders for any user anywhere**.

The badge appears to work intermittently because:
- Sometimes a cached result from a previous session is used (2-min TTL cache)
- The auth state change clears the cache, triggering a fresh query that fails again

## Fix Plan

### Step 1: Re-add the foreign key constraint (Database)

Create a new migration to add back the foreign key:

```text
ALTER TABLE public.user_subscriptions
ADD CONSTRAINT fk_user_subscriptions_tier
FOREIGN KEY (tier_id) REFERENCES public.subscription_tiers(id);
```

### Step 2: Make VerifiedBadge query more resilient

Update `VerifiedBadge.tsx` to use a **two-step query approach** instead of relying on the embedded join:

1. First query: `user_subscriptions` to get `tier_id` only (no join -- this always works)
2. Second query: `subscription_tiers` to get the tier name by ID

This ensures badges work even if the FK is somehow missing or the join fails. The component already has a fallback, but it doesn't trigger because when the join fails, the entire `planResult.data` is null (not just the nested object).

**Changes to `src/components/profile/VerifiedBadge.tsx`:**
- Replace the single joined query with two separate sequential queries
- First: `select('tier_id').eq('user_id', userId).eq('status', 'active')`
- Then: `select('name').eq('id', tierId)` on `subscription_tiers`

This is a 1-file code change + 1 database migration.

## Technical Details

- The second migration file (`20260219134515_...`) that dropped the constraint will remain (it already ran), but the new migration re-adds it
- The two-step query approach adds minimal overhead (one extra small query) but guarantees reliability regardless of FK status
- All existing badge placements (PostCard, PhotoPostSlide, ImmersivePostCard, CommentsModal, InlineCommentsPanel, GroupMembersSheet, NewConversationModal) will automatically work once this fix is applied since they all use the same `VerifiedBadge` component
