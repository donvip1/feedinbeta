
# Plan: Fix Missing `gifts` Table - Allow Admin to Send Gifts

## Problem Identified

The error message **"relation 'gifts' does not exist"** is causing gift sending to fail for **everyone**, including the admin.

The `send_gift` RPC function is trying to insert into a table called `gifts`:

```sql
INSERT INTO gifts (sender_id, receiver_id, post_id, gift_type, credit_value, platform_fee, creator_amount)
VALUES (v_sender_id, v_receiver_id, p_post_id, p_gift_type, p_credit_value, v_platform_fee, v_creator_amount)
RETURNING id INTO v_gift_id;
```

**But this table does not exist!** The existing gift-related tables are:
- `gift_analytics` (the correct table to use)
- `live_stream_gifts`
- `live_space_gifts`
- `gift_appreciation_options`

## Solution

Update the `send_gift` function to:
1. **Use `gift_analytics` table** instead of the non-existent `gifts` table
2. **Include `source_type`** column which is required (NOT NULL) in `gift_analytics`
3. **Map columns correctly** to match the `gift_analytics` schema

### Current `gift_analytics` Schema
| Column | Type | Required |
|--------|------|----------|
| id | uuid | YES |
| sender_id | uuid | NO |
| receiver_id | uuid | YES |
| gift_type | text | YES |
| credit_value | integer | YES |
| source_type | text | YES |
| source_id | uuid | NO |
| platform_fee | integer | NO |
| created_at | timestamptz | NO |
| is_converted | boolean | NO |

## Database Changes

### Fix the `send_gift` Function

Replace the INSERT statement to use the correct table:

```sql
-- Change FROM:
INSERT INTO gifts (sender_id, receiver_id, post_id, gift_type, credit_value, platform_fee, creator_amount)
VALUES (...)

-- Change TO:
INSERT INTO gift_analytics (sender_id, receiver_id, gift_type, credit_value, source_type, source_id, platform_fee, is_converted)
VALUES (v_sender_id, v_receiver_id, p_gift_type, p_credit_value, 'post', p_post_id, v_platform_fee, false)
RETURNING id INTO v_gift_id;
```

## Files to Modify

| Change | Description |
|--------|-------------|
| Database Migration | Update `send_gift` function to use `gift_analytics` table instead of non-existent `gifts` table |

## Summary

The issue is NOT about admin restrictions - it's that the `gifts` table referenced in the function doesn't exist at all. Once we fix this to use `gift_analytics`, both admin and regular users will be able to send gifts (with admin bypassing balance/rate-limit checks as already implemented).
