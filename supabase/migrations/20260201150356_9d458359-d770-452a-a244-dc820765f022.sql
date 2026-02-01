-- Add columns for native device tokens (FCM/APNs)
ALTER TABLE push_subscriptions 
ADD COLUMN IF NOT EXISTS device_token TEXT,
ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'web';

-- Create index for faster lookups by platform
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_platform 
ON push_subscriptions(platform) WHERE platform IN ('android', 'ios');

-- Create index for device token lookups
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_device_token 
ON push_subscriptions(device_token) WHERE device_token IS NOT NULL;