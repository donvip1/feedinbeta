
# Fix Developer/Admin Unlimited Credits System

## Problem Identified
The developer/admin accounts do not have the 999,999,999 credit balance mentioned. All accounts, including admins (`tester1` - super_admin, `vtechniqs`, `softech`), only have **500 credits**. When attempting to promote posts with costs exceeding the balance, the `user_credits_balance_check` constraint fails.

## Solution Overview
We'll create a proper "admin bypass" system that:
1. Grants admin accounts a very high credit balance that's effectively unlimited
2. Makes admin credits invisible/untraceable in public queries
3. Marks admin credits differently so they're not counted in platform analytics

---

## Technical Implementation

### 1. Database Migration: Add Admin Credit System

**Create a new migration** that:
- Adds an `is_admin_minted` column to `user_credits` to mark credits that shouldn't be tracked
- Updates admin users to have very high balances (999,999,999 credits)
- Creates a function to identify admin users and exclude their balances from queries

```sql
-- Add admin credit marking
ALTER TABLE user_credits ADD COLUMN IF NOT EXISTS is_admin_minted BOOLEAN DEFAULT false;

-- Update admin balances to effectively unlimited
UPDATE user_credits 
SET balance = 999999999, 
    is_admin_minted = true
WHERE user_id IN (
  SELECT user_id FROM user_roles WHERE role IN ('admin', 'super_admin')
);

-- For any admin without a user_credits row, create one
INSERT INTO user_credits (user_id, balance, total_earned, is_admin_minted)
SELECT ur.user_id, 999999999, 0, true
FROM user_roles ur
LEFT JOIN user_credits uc ON uc.user_id = ur.user_id
WHERE ur.role IN ('admin', 'super_admin')
AND uc.id IS NULL;
```

### 2. Update `promote_post` Function

Modify the function to:
- **Skip balance check for admin users** - admins can always promote
- **Don't deduct credits from admin accounts** - their balance stays at 999,999,999
- Still record the transaction for audit purposes (but mark it as admin action)

```sql
-- In promote_post function, add admin bypass
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  -- Check if user is admin
  SELECT EXISTS(
    SELECT 1 FROM user_roles 
    WHERE user_id = v_user_id AND role IN ('admin', 'super_admin')
  ) INTO v_is_admin;

  -- If admin, skip balance check and deduction
  IF v_is_admin THEN
    -- Still create promotion record but don't deduct
    -- Record transaction with type 'admin_promotion'
  ELSE
    -- Normal balance check and deduction
  END IF;
```

### 3. Hide Admin Balances from Public Queries

Update the frontend queries to exclude admin-minted credits from:
- Leaderboards
- Analytics dashboards
- Credit statistics

This is done by adding `WHERE is_admin_minted = false` or `WHERE NOT EXISTS (admin role check)` to relevant queries.

---

## Implementation Details

### Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| Migration SQL | Create | Add `is_admin_minted` column, update admin balances |
| Migration SQL | Create | Update `promote_post` function with admin bypass |
| `src/hooks/useUserAds.tsx` | Modify | Add admin check before balance validation |

### Migration 1: Admin Credit System Setup

```sql
-- Add column to mark admin-minted credits
ALTER TABLE user_credits 
ADD COLUMN IF NOT EXISTS is_admin_minted BOOLEAN DEFAULT false;

-- Set all existing admin/super_admin users to have unlimited credits
UPDATE user_credits uc
SET 
  balance = 999999999,
  is_admin_minted = true,
  updated_at = now()
FROM user_roles ur
WHERE ur.user_id = uc.user_id 
AND ur.role IN ('admin', 'super_admin');

-- Create credits for admins who don't have a row yet
INSERT INTO user_credits (user_id, balance, total_earned, total_spent, is_admin_minted)
SELECT ur.user_id, 999999999, 0, 0, true
FROM user_roles ur
LEFT JOIN user_credits uc ON uc.user_id = ur.user_id
WHERE ur.role IN ('admin', 'super_admin')
AND uc.id IS NULL;
```

### Migration 2: Update promote_post Function

The function will be updated to:
1. Check if the user has an admin role
2. If admin: skip balance validation, skip credit deduction, record as `admin_promotion`
3. If not admin: continue with normal flow

```text
IF v_is_admin THEN
  -- Admin bypass: Don't check balance, don't deduct
  v_new_balance := 999999999;
  
  -- Record transaction but mark as admin action
  INSERT INTO credit_transactions (user_id, amount, type, description)
  VALUES (v_user_id, 0, 'admin_promotion', 'Admin promotion: ' || p_plan_name);
ELSE
  -- Normal user flow with balance check and deduction
  ...
END IF;
```

### Update useUserAds.tsx

Add similar admin check for the ad builder's credit deduction:

```typescript
// Check if user is admin (skip credit deduction if so)
const { data: roleData } = await supabase
  .from('user_roles')
  .select('role')
  .eq('user_id', user.id)
  .in('role', ['admin', 'super_admin'])
  .maybeSingle();

const isAdmin = !!roleData;

// Skip balance check for admins
if (!isAdmin && currentBalance < params.budgetCredits) {
  toast({ title: 'Insufficient credits', ... });
  return false;
}

// Skip deduction for admins
if (!isAdmin) {
  // Deduct credits via transaction
}
```

---

## Privacy & Security

### Admin Credits Are:
- Marked with `is_admin_minted = true`
- Excluded from leaderboards and public analytics
- Not deducted when used (balance stays at 999,999,999)
- Tracked in transactions but with `admin_promotion` type

### Query Filter Example
```sql
-- For leaderboards/public displays
SELECT * FROM user_credits 
WHERE is_admin_minted = false
ORDER BY balance DESC;
```

---

## Summary

1. **Add `is_admin_minted` column** to `user_credits` table
2. **Set admin balances to 999,999,999** with the admin flag
3. **Update `promote_post` function** to bypass checks for admins
4. **Update `useUserAds.tsx`** to handle admin ad creation
5. **Exclude admin credits from public queries** using the flag
