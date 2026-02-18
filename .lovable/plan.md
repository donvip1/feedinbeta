

# Fix Verified Badge Not Showing in Photo+ and Across the App

## Root Cause

The `VerifiedBadge` component queries `user_subscriptions` with a joined select: `subscription_tiers(name)`. However, there is **no foreign key constraint** between `user_subscriptions.tier_id` and `subscription_tiers.id`. Without this foreign key, the Supabase client cannot perform the join, so the tier name always comes back as `null` -- meaning badges never render for subscription-based users.

For users with admin/moderator roles, the badge *would* show (since the role query works independently), but the subscription-based badge is completely broken for everyone.

## Fix Plan

### Step 1: Add the missing foreign key constraint (Database Migration)

Add a foreign key from `user_subscriptions.tier_id` to `subscription_tiers.id` so the Supabase client join works correctly.

```sql
ALTER TABLE public.user_subscriptions
ADD CONSTRAINT fk_user_subscriptions_tier
FOREIGN KEY (tier_id) REFERENCES public.subscription_tiers(id);
```

### Step 2: No code changes needed

The `VerifiedBadge` component code is already correctly placed in:
- PhotoPostSlide (Photo+ fullscreen)
- PostCard (Photo+ feed cards)
- ImmersivePostCard (Video feed)
- Profile page
- Comments, Messages, Groups, Profile preview

Once the foreign key is added, the existing `subscription_tiers(name)` join will start working and badges will appear for all Pro and Premium subscribers immediately.

## Technical Details

- The `tier_id` column already exists and has valid data linking to `subscription_tiers.id`
- The Supabase JS client uses PostgREST, which requires foreign keys to resolve embedded/joined selects
- This single migration fixes badges across the entire app since all badge rendering goes through the same `VerifiedBadge` component
- The component's 2-minute cache will pick up the correct data after the fix, showing badges consistently

