-- Drop old send_gift function versions (keep only the one with p_post_id, p_gift_type, p_credit_value)
DROP FUNCTION IF EXISTS public.send_gift(uuid, uuid, uuid, text, integer);
DROP FUNCTION IF EXISTS public.send_gift(uuid, text, integer, text, uuid);

-- Drop old send_live_gift function versions (keep only the one with p_stream_id, p_gift_type, p_credit_value)
DROP FUNCTION IF EXISTS public.send_live_gift(uuid, uuid, uuid, text, integer);
DROP FUNCTION IF EXISTS public.send_live_gift(uuid, uuid, text, integer);