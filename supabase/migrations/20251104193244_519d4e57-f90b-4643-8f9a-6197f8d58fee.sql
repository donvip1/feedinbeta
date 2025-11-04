-- Drop the security definer view and recreate without security definer
DROP VIEW IF EXISTS public.user_strike_summary;

-- Create a regular view without security definer
CREATE VIEW public.user_strike_summary 
WITH (security_invoker=true) AS
SELECT 
  user_id,
  COUNT(*) FILTER (WHERE is_active = true) as active_strikes,
  COUNT(*) FILTER (WHERE severity = 'high' AND is_active = true) as high_severity_strikes,
  COUNT(*) as total_strikes,
  MAX(issued_at) as last_strike_date
FROM public.user_strikes
GROUP BY user_id;