-- RPC to end live sessions (single or all), restricted to admin/developer/super_admin
CREATE OR REPLACE FUNCTION public.admin_end_live_sessions(
  p_target_type text DEFAULT 'all',
  p_target_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role text;
  spaces_ended integer := 0;
  streams_ended integer := 0;
BEGIN
  -- Check caller is admin/developer/super_admin
  SELECT role INTO caller_role
  FROM public.user_roles
  WHERE user_id = auth.uid()
  AND role IN ('super_admin', 'developer', 'admin')
  LIMIT 1;

  IF caller_role IS NULL THEN
    RAISE EXCEPTION 'Access denied: Only admins can end live sessions';
  END IF;

  IF p_target_type = 'space' AND p_target_id IS NOT NULL THEN
    UPDATE public.live_spaces SET status = 'ended', ended_at = now() WHERE id = p_target_id AND status = 'live';
    GET DIAGNOSTICS spaces_ended = ROW_COUNT;
  ELSIF p_target_type = 'stream' AND p_target_id IS NOT NULL THEN
    UPDATE public.live_streams SET status = 'ended', ended_at = now() WHERE id = p_target_id AND status = 'live';
    GET DIAGNOSTICS streams_ended = ROW_COUNT;
  ELSIF p_target_type = 'all' THEN
    UPDATE public.live_spaces SET status = 'ended', ended_at = now() WHERE status = 'live';
    GET DIAGNOSTICS spaces_ended = ROW_COUNT;
    UPDATE public.live_streams SET status = 'ended', ended_at = now() WHERE status = 'live';
    GET DIAGNOSTICS streams_ended = ROW_COUNT;
  ELSE
    RAISE EXCEPTION 'Invalid target_type. Use "all", "space", or "stream"';
  END IF;

  RETURN json_build_object(
    'success', true,
    'spaces_ended', spaces_ended,
    'streams_ended', streams_ended
  );
END;
$$;