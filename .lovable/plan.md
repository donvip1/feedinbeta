

# Plan: Fix Gift Sending & Implement Gift Collection System

## Problem Summary

### Issue 1: Gifts Not Sending Properly
The `send_gift` database function has **incorrect column names** causing silent failures:
- Uses `post_id` but table has `source_id` + `source_type`
- Uses `actor_id` but notifications table has `from_user_id`
- Function catches all errors and returns JSON, masking the real database errors

### Issue 2: New Gift Collection System
Currently, gifts are immediately converted to credits. User wants:
- Gifts to remain as "gifts" in a collection
- Users must manually convert/redeem gifts to get credit value
- Until converted, gifts show as unconverted gift inventory

---

## Part 1: Fix Gift Sending Function

### Database Changes

**Fix the `send_gift(p_post_id, p_gift_type, p_credit_value)` function:**

```sql
-- Correct column names:
-- gift_analytics: use source_id + source_type, not post_id
-- notifications: use from_user_id, not actor_id

INSERT INTO gift_analytics (sender_id, receiver_id, gift_type, credit_value, platform_fee, source_type, source_id)
VALUES (v_sender_id, v_receiver_id, p_gift_type, p_credit_value, v_platform_fee, 'post', p_post_id);

INSERT INTO notifications (user_id, type, title, message, related_id, related_type, from_user_id)
VALUES (v_receiver_id, 'gift_received', ...);
```

---

## Part 2: Gift Collection System

### New Behavior Flow

```
Current Flow:
┌──────────┐    ┌──────────────┐    ┌─────────────┐
│ Send Gift│ →  │ Credits Added│ →  │ Balance Up  │
└──────────┘    │ Immediately  │    └─────────────┘
                └──────────────┘

New Flow:
┌──────────┐    ┌──────────────┐    ┌─────────────────┐    ┌─────────────┐
│ Send Gift│ →  │ Gift Stored  │ →  │ User Converts   │ →  │ Balance Up  │
└──────────┘    │ (Unconverted)│    │ Gift to Credits │    └─────────────┘
                └──────────────┘    └─────────────────┘
```

### Database Schema Changes

**1. Add `is_converted` column to `gift_analytics`:**

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| is_converted | boolean | false | Whether gift value has been claimed |
| converted_at | timestamptz | null | When user converted the gift |

**2. Create `convert_gift` function:**
- Takes gift_id
- Verifies user owns the gift (receiver_id = auth.uid())
- Verifies gift not already converted
- Credits user's balance with (credit_value - platform_fee)
- Marks gift as converted

**3. Create `convert_all_gifts` function:**
- Batch converts all unconverted gifts for user
- Returns total credits added

### UI Changes

**File: `src/components/wallet/ReceivedGifts.tsx`**

Current display:
```
[Gift emoji] John sent Heart  +9 credits
```

New display with convert button:
```
[Gift emoji] John sent Heart  
Value: 9 credits  [Convert] ← Button to claim
```

Or if converted:
```
[Gift emoji] John sent Heart  
✓ Converted: +9 credits
```

**File: `src/components/wallet/GiftsTab.tsx`**

Add summary section:
```
┌─────────────────────────────────────────┐
│  🎁 Unconverted Gifts                   │
│  12 gifts worth 450 credits             │
│  [Convert All to Credits]               │
└─────────────────────────────────────────┘
```

**File: `src/components/wallet/BalanceCard.tsx`**

Add unconverted gifts indicator:
```
Current Balance: 1,000 credits
+ 450 credits in unconverted gifts
```

---

## Implementation Details

### Step 1: Database Migration

```sql
-- 1. Add conversion tracking columns
ALTER TABLE gift_analytics 
ADD COLUMN IF NOT EXISTS is_converted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ;

-- 2. Fix send_gift function
CREATE OR REPLACE FUNCTION public.send_gift(p_post_id uuid, p_gift_type text, p_credit_value integer)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  -- ... existing declarations ...
BEGIN
  -- ... existing validation ...
  
  -- Deduct from sender ONLY
  INSERT INTO credit_transactions (user_id, amount, type, description, related_id)
  VALUES (v_sender_id, -p_credit_value, 'gift_sent', 'Gift sent: ' || p_gift_type, p_post_id);
  
  -- DO NOT credit receiver immediately - gift stays unconverted
  
  -- Record gift analytics (FIXED column names)
  INSERT INTO gift_analytics (sender_id, receiver_id, gift_type, credit_value, platform_fee, source_type, source_id, is_converted)
  VALUES (v_sender_id, v_receiver_id, p_gift_type, p_credit_value, v_platform_fee, 'post', p_post_id, false);
  
  -- Notification (FIXED column name)
  INSERT INTO notifications (user_id, type, title, message, related_id, related_type, from_user_id)
  VALUES (v_receiver_id, 'gift_received', 'New Gift!', '...', p_post_id, 'post', v_sender_id);
  
  RETURN json_build_object('success', true, ...);
END;
$$;

-- 3. Create convert_gift function
CREATE OR REPLACE FUNCTION public.convert_gift(p_gift_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_gift RECORD;
  v_net_amount INTEGER;
BEGIN
  v_user_id := auth.uid();
  
  -- Get gift and verify ownership
  SELECT * INTO v_gift FROM gift_analytics 
  WHERE id = p_gift_id AND receiver_id = v_user_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Gift not found');
  END IF;
  
  IF v_gift.is_converted THEN
    RETURN json_build_object('success', false, 'error', 'Gift already converted');
  END IF;
  
  v_net_amount := v_gift.credit_value - COALESCE(v_gift.platform_fee, 0);
  
  -- Credit user
  INSERT INTO credit_transactions (user_id, amount, type, description, related_id)
  VALUES (v_user_id, v_net_amount, 'gift_converted', 'Converted gift: ' || v_gift.gift_type, p_gift_id);
  
  -- Mark as converted
  UPDATE gift_analytics SET is_converted = true, converted_at = now()
  WHERE id = p_gift_id;
  
  RETURN json_build_object('success', true, 'credits_added', v_net_amount);
END;
$$;

-- 4. Create convert_all_gifts function
CREATE OR REPLACE FUNCTION public.convert_all_gifts()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_total_credits INTEGER := 0;
  v_gift_count INTEGER := 0;
  v_gift RECORD;
BEGIN
  v_user_id := auth.uid();
  
  FOR v_gift IN 
    SELECT * FROM gift_analytics 
    WHERE receiver_id = v_user_id AND is_converted = false
  LOOP
    v_total_credits := v_total_credits + (v_gift.credit_value - COALESCE(v_gift.platform_fee, 0));
    v_gift_count := v_gift_count + 1;
  END LOOP;
  
  IF v_gift_count = 0 THEN
    RETURN json_build_object('success', false, 'error', 'No gifts to convert');
  END IF;
  
  -- Credit all at once
  INSERT INTO credit_transactions (user_id, amount, type, description)
  VALUES (v_user_id, v_total_credits, 'gift_converted', 'Converted ' || v_gift_count || ' gifts');
  
  -- Mark all as converted
  UPDATE gift_analytics SET is_converted = true, converted_at = now()
  WHERE receiver_id = v_user_id AND is_converted = false;
  
  RETURN json_build_object('success', true, 'gifts_converted', v_gift_count, 'credits_added', v_total_credits);
END;
$$;
```

### Step 2: Update Frontend Components

**File: `src/components/wallet/ReceivedGifts.tsx`**
- Add "Convert" button for unconverted gifts
- Show conversion status badge
- Call `convert_gift` RPC on click

**File: `src/components/wallet/GiftsTab.tsx`**
- Add unconverted gifts summary card at top
- Show total unconverted count and value
- Add "Convert All" button

**File: `src/components/wallet/BalanceCard.tsx`**
- Fetch unconverted gifts total
- Display "+ X credits in gifts" indicator

### Step 3: Handle Real-time Updates

- Update real-time subscriptions to refresh on gift conversion
- Invalidate wallet queries after conversion

---

## Files to Modify

| File | Changes |
|------|---------|
| Database migration | Fix send_gift, add columns, add convert functions |
| `src/components/wallet/ReceivedGifts.tsx` | Add convert button per gift |
| `src/components/wallet/GiftsTab.tsx` | Add unconverted gifts summary, Convert All button |
| `src/components/wallet/BalanceCard.tsx` | Show unconverted gifts indicator |
| `src/integrations/supabase/types.ts` | Auto-regenerates with new functions |

---

## Summary

1. **Fix bug**: Correct column names in `send_gift` function so gifts actually record
2. **New feature**: Gifts stay as "unconverted" until user manually converts them
3. **UI updates**: Show unconverted gifts, provide convert buttons, update balance display

