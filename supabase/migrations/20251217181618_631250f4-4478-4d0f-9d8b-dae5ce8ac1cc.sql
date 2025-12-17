-- Recreate user_strike_summary view with security_invoker to inherit RLS from user_strikes
DROP VIEW IF EXISTS public.user_strike_summary;

CREATE VIEW public.user_strike_summary
WITH (security_invoker = true)
AS
SELECT 
  user_id,
  count(*) FILTER (WHERE is_active = true) AS active_strikes,
  count(*) FILTER (WHERE severity = 'high' AND is_active = true) AS high_severity_strikes,
  count(*) AS total_strikes,
  max(issued_at) AS last_strike_date
FROM public.user_strikes
GROUP BY user_id;

-- Restrict access
REVOKE ALL ON public.user_strike_summary FROM anon;
GRANT SELECT ON public.user_strike_summary TO authenticated;

COMMENT ON VIEW public.user_strike_summary IS 
'Aggregated strike data per user. Uses security_invoker to inherit RLS from user_strikes table. 
Users can only see their own strikes; moderators/admins can see all.';