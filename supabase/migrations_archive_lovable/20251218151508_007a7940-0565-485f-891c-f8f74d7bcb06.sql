-- Add gifts_count column to posts table
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS gifts_count integer DEFAULT 0;

-- Create function to update post gifts_count when gifts are sent
CREATE OR REPLACE FUNCTION public.update_post_gifts_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type = 'gift_sent' AND NEW.related_id IS NOT NULL THEN
    -- Check if related_id is a post
    UPDATE public.posts 
    SET gifts_count = COALESCE(gifts_count, 0) + ABS(NEW.amount)
    WHERE id = NEW.related_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for gift tracking on posts
DROP TRIGGER IF EXISTS on_gift_sent_update_post ON public.credit_transactions;
CREATE TRIGGER on_gift_sent_update_post
  AFTER INSERT ON public.credit_transactions
  FOR EACH ROW
  WHEN (NEW.type = 'gift_sent')
  EXECUTE FUNCTION public.update_post_gifts_count();

-- Create gift_analytics table for comprehensive tracking
CREATE TABLE IF NOT EXISTS public.gift_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid REFERENCES public.profiles(id),
  receiver_id uuid NOT NULL,
  gift_type text NOT NULL,
  credit_value integer NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('post', 'live_stream', 'story', 'profile')),
  source_id uuid,
  platform_fee integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on gift_analytics
ALTER TABLE public.gift_analytics ENABLE ROW LEVEL SECURITY;

-- Admin/Moderator can view all gift analytics
CREATE POLICY "admins_view_gift_analytics" ON public.gift_analytics
  FOR SELECT USING (public.can_view_admin_wallet());

-- Create function to log gift analytics
CREATE OR REPLACE FUNCTION public.log_gift_analytics(
  p_sender_id uuid,
  p_receiver_id uuid,
  p_gift_type text,
  p_credit_value integer,
  p_source_type text,
  p_source_id uuid,
  p_platform_fee integer DEFAULT 0
)
RETURNS uuid AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.gift_analytics (sender_id, receiver_id, gift_type, credit_value, source_type, source_id, platform_fee)
  VALUES (p_sender_id, p_receiver_id, p_gift_type, p_credit_value, p_source_type, p_source_id, p_platform_fee)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create comprehensive gift statistics function
CREATE OR REPLACE FUNCTION public.get_gift_statistics()
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  -- Only allow admins/moderators to view
  IF NOT public.can_view_admin_wallet() THEN
    RETURN NULL;
  END IF;

  SELECT json_build_object(
    'total_gifts_sent', COALESCE((SELECT COUNT(*) FROM credit_transactions WHERE type = 'gift_sent'), 0),
    'total_gift_credits', COALESCE((SELECT SUM(ABS(amount)) FROM credit_transactions WHERE type = 'gift_sent'), 0),
    'total_platform_fees', COALESCE((SELECT SUM(platform_fee) FROM gift_analytics), 0),
    'gifts_today', COALESCE((SELECT COUNT(*) FROM credit_transactions WHERE type = 'gift_sent' AND created_at >= CURRENT_DATE), 0),
    'gifts_this_week', COALESCE((SELECT COUNT(*) FROM credit_transactions WHERE type = 'gift_sent' AND created_at >= CURRENT_DATE - INTERVAL '7 days'), 0),
    'gifts_this_month', COALESCE((SELECT COUNT(*) FROM credit_transactions WHERE type = 'gift_sent' AND created_at >= DATE_TRUNC('month', CURRENT_DATE)), 0),
    'credits_today', COALESCE((SELECT SUM(ABS(amount)) FROM credit_transactions WHERE type = 'gift_sent' AND created_at >= CURRENT_DATE), 0),
    'credits_this_week', COALESCE((SELECT SUM(ABS(amount)) FROM credit_transactions WHERE type = 'gift_sent' AND created_at >= CURRENT_DATE - INTERVAL '7 days'), 0),
    'credits_this_month', COALESCE((SELECT SUM(ABS(amount)) FROM credit_transactions WHERE type = 'gift_sent' AND created_at >= DATE_TRUNC('month', CURRENT_DATE)), 0),
    'unique_senders', COALESCE((SELECT COUNT(DISTINCT user_id) FROM credit_transactions WHERE type = 'gift_sent'), 0),
    'unique_receivers', COALESCE((SELECT COUNT(DISTINCT receiver_id) FROM gift_analytics), 0),
    'top_gift_types', (SELECT json_agg(t) FROM (
      SELECT gift_type, COUNT(*) as count, SUM(credit_value) as total_value 
      FROM gift_analytics 
      GROUP BY gift_type 
      ORDER BY count DESC 
      LIMIT 5
    ) t),
    'gifts_by_source', (SELECT json_agg(s) FROM (
      SELECT source_type, COUNT(*) as count, SUM(credit_value) as total_value 
      FROM gift_analytics 
      GROUP BY source_type 
      ORDER BY count DESC
    ) s)
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create live stream statistics function
CREATE OR REPLACE FUNCTION public.get_live_stream_statistics()
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  -- Only allow admins/moderators to view
  IF NOT public.can_view_admin_wallet() THEN
    RETURN NULL;
  END IF;

  SELECT json_build_object(
    'total_streams', COALESCE((SELECT COUNT(*) FROM live_streams), 0),
    'active_streams', COALESCE((SELECT COUNT(*) FROM live_streams WHERE status = 'live'), 0),
    'ended_streams', COALESCE((SELECT COUNT(*) FROM live_streams WHERE status = 'ended'), 0),
    'total_viewers', COALESCE((SELECT COUNT(*) FROM live_stream_viewers), 0),
    'total_gifts_sent', COALESCE((SELECT COUNT(*) FROM live_stream_gifts), 0),
    'total_gift_credits', COALESCE((SELECT SUM(credit_value) FROM live_stream_gifts), 0),
    'gifts_today', COALESCE((SELECT COUNT(*) FROM live_stream_gifts WHERE created_at >= CURRENT_DATE), 0),
    'credits_today', COALESCE((SELECT SUM(credit_value) FROM live_stream_gifts WHERE created_at >= CURRENT_DATE), 0),
    'gifts_this_week', COALESCE((SELECT COUNT(*) FROM live_stream_gifts WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'), 0),
    'credits_this_week', COALESCE((SELECT SUM(credit_value) FROM live_stream_gifts WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'), 0),
    'unique_gifters', COALESCE((SELECT COUNT(DISTINCT sender_id) FROM live_stream_gifts), 0),
    'unique_receivers', COALESCE((SELECT COUNT(DISTINCT receiver_id) FROM live_stream_gifts), 0),
    'peak_concurrent_viewers', COALESCE((SELECT MAX(peak_viewers) FROM live_streams), 0),
    'avg_stream_duration', COALESCE((SELECT AVG(duration) FROM live_streams WHERE duration IS NOT NULL), 0),
    'top_streamers', (SELECT json_agg(t) FROM (
      SELECT receiver_id, COUNT(*) as gift_count, SUM(credit_value) as total_credits
      FROM live_stream_gifts
      GROUP BY receiver_id
      ORDER BY total_credits DESC
      LIMIT 5
    ) t),
    'gift_types', (SELECT json_agg(g) FROM (
      SELECT gift_type, COUNT(*) as count, SUM(credit_value) as total_value
      FROM live_stream_gifts
      GROUP BY gift_type
      ORDER BY count DESC
    ) g)
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Get recent gift transactions for tracking
CREATE OR REPLACE FUNCTION public.get_recent_gift_transactions(p_limit integer DEFAULT 50)
RETURNS TABLE (
  id uuid,
  sender_id uuid,
  sender_username text,
  receiver_id uuid,
  receiver_username text,
  gift_type text,
  credit_value integer,
  source_type text,
  source_id uuid,
  platform_fee integer,
  created_at timestamptz
) AS $$
BEGIN
  -- Only allow admins/moderators to view
  IF NOT public.can_view_admin_wallet() THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    ga.id,
    ga.sender_id,
    sp.username as sender_username,
    ga.receiver_id,
    rp.username as receiver_username,
    ga.gift_type,
    ga.credit_value,
    ga.source_type,
    ga.source_id,
    ga.platform_fee,
    ga.created_at
  FROM gift_analytics ga
  LEFT JOIN profiles sp ON ga.sender_id = sp.id
  LEFT JOIN profiles rp ON ga.receiver_id = rp.id
  ORDER BY ga.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Get recent live stream gift transactions
CREATE OR REPLACE FUNCTION public.get_recent_live_gifts(p_limit integer DEFAULT 50)
RETURNS TABLE (
  id uuid,
  stream_id uuid,
  stream_title text,
  sender_id uuid,
  sender_username text,
  receiver_id uuid,
  receiver_username text,
  gift_type text,
  credit_value integer,
  created_at timestamptz
) AS $$
BEGIN
  -- Only allow admins/moderators to view
  IF NOT public.can_view_admin_wallet() THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    lsg.id,
    lsg.stream_id,
    ls.title as stream_title,
    lsg.sender_id,
    sp.username as sender_username,
    lsg.receiver_id,
    rp.username as receiver_username,
    lsg.gift_type,
    lsg.credit_value,
    lsg.created_at
  FROM live_stream_gifts lsg
  LEFT JOIN live_streams ls ON lsg.stream_id = ls.id
  LEFT JOIN profiles sp ON lsg.sender_id = sp.id
  LEFT JOIN profiles rp ON lsg.receiver_id = rp.id
  ORDER BY lsg.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;