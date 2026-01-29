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