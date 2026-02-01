
# Plan: Fix Gift Count Persistence Bug

## Problem Summary

When a user sends a gift to a post, the gift count increments instantly in the UI but resets to the previous value after page refresh. This happens because:

1. The gift is recorded correctly in the database
2. The UI optimistically shows the new count
3. **But the post's gift counter is never actually updated in the database**
4. On refresh, the old (incorrect) count is loaded

## Root Cause

The database function that processes gift sending (`send_gift`) correctly:
- Deducts credits from sender
- Records the gift transaction
- Tracks platform earnings

But it **never updates the `gifts_count` on the post itself**.

## Solution

Add a database trigger that automatically increments/decrements `gifts_count` on posts whenever gifts are added or removed, following the same pattern used for comments count.

## Database Changes

### 1. Create Trigger Function

Create a function that updates `gifts_count` on the posts table whenever a record is inserted or deleted from `gift_analytics`:

```sql
CREATE OR REPLACE FUNCTION update_post_gift_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Only update if this is a post gift (not live stream, etc.)
    IF NEW.source_type = 'post' AND NEW.source_id IS NOT NULL THEN
      UPDATE posts 
      SET gifts_count = COALESCE(gifts_count, 0) + 1
      WHERE id = NEW.source_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.source_type = 'post' AND OLD.source_id IS NOT NULL THEN
      UPDATE posts 
      SET gifts_count = GREATEST(COALESCE(gifts_count, 0) - 1, 0)
      WHERE id = OLD.source_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;
```

### 2. Create Trigger

Attach the trigger to the `gift_analytics` table:

```sql
CREATE TRIGGER trigger_update_post_gift_count
  AFTER INSERT OR DELETE ON public.gift_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_post_gift_count();
```

### 3. Fix Existing Data

Sync existing gift counts for posts that already received gifts:

```sql
UPDATE posts p
SET gifts_count = (
  SELECT COUNT(*) 
  FROM gift_analytics ga 
  WHERE ga.source_id = p.id 
  AND ga.source_type = 'post'
)
WHERE EXISTS (
  SELECT 1 FROM gift_analytics ga 
  WHERE ga.source_id = p.id 
  AND ga.source_type = 'post'
);
```

## Why This Fixes the Bug

| Step | Before Fix | After Fix |
|------|------------|-----------|
| User sends gift | Recorded in gift_analytics | Same + triggers count update |
| `gifts_count` column | Never updated (stays 0) | Incremented by trigger |
| Page refresh | Shows 0 | Shows correct count |
| Real-time update | No change detected | Posts table UPDATE triggers subscription |

## No Frontend Changes Required

The existing frontend code is already correct:
- Optimistic updates work properly
- Real-time subscription listens for posts updates
- The trigger will cause the posts table to update, triggering the real-time callback

## Files to Modify

| File | Change |
|------|--------|
| New migration | Add trigger function and trigger for `gift_analytics` |
| No frontend changes | Existing code handles this correctly |

## Testing After Implementation

1. Send a gift to a post
2. Verify count increases
3. Refresh the page
4. Verify count persists
5. Check another user's view to confirm real-time sync
