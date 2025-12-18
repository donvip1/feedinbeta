
-- Create user_sessions table for device/session tracking
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  device_fingerprint TEXT,
  device_info JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  last_active_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
  is_active BOOLEAN DEFAULT true,
  is_trusted BOOLEAN DEFAULT false
);

-- Enable RLS
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own sessions
CREATE POLICY "Users can view own sessions"
ON public.user_sessions FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can update their own sessions
CREATE POLICY "Users can update own sessions"
ON public.user_sessions FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- Users can delete their own sessions (logout)
CREATE POLICY "Users can delete own sessions"
ON public.user_sessions FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Users can insert their own sessions
CREATE POLICY "Users can insert own sessions"
ON public.user_sessions FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Create login_attempts table for rate limiting
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL, -- email or phone
  ip_address TEXT,
  attempt_at TIMESTAMPTZ DEFAULT now(),
  success BOOLEAN DEFAULT false,
  failure_reason TEXT
);

-- Enable RLS (but allow inserts from authenticated and anon)
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Only admins can view login attempts
CREATE POLICY "Admins can view login attempts"
ON public.login_attempts FOR SELECT
TO authenticated
USING (public.is_admin());

-- Allow inserts for tracking (from edge function)
CREATE POLICY "Allow insert login attempts"
ON public.login_attempts FOR INSERT
TO authenticated, anon
WITH CHECK (true);

-- Create security_events table for suspicious activity
CREATE TABLE IF NOT EXISTS public.security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Users can view their own security events
CREATE POLICY "Users can view own security events"
ON public.security_events FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Allow inserts for logging
CREATE POLICY "Allow insert security events"
ON public.security_events FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Function to check if account is locked (too many failed attempts)
CREATE OR REPLACE FUNCTION public.is_account_locked(p_identifier TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  failed_count INTEGER;
  last_attempt TIMESTAMPTZ;
BEGIN
  -- Count failed attempts in last 15 minutes
  SELECT COUNT(*), MAX(attempt_at) INTO failed_count, last_attempt
  FROM public.login_attempts
  WHERE identifier = p_identifier
    AND success = false
    AND attempt_at > (now() - interval '15 minutes');
  
  -- Lock after 5 failed attempts
  IF failed_count >= 5 THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- Function to log login attempt
CREATE OR REPLACE FUNCTION public.log_login_attempt(
  p_identifier TEXT,
  p_ip_address TEXT DEFAULT NULL,
  p_success BOOLEAN DEFAULT false,
  p_failure_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.login_attempts (identifier, ip_address, success, failure_reason)
  VALUES (p_identifier, p_ip_address, p_success, p_failure_reason);
  
  -- Clean up old attempts (keep last 30 days)
  DELETE FROM public.login_attempts
  WHERE attempt_at < (now() - interval '30 days');
END;
$$;

-- Function to create/update user session
CREATE OR REPLACE FUNCTION public.upsert_user_session(
  p_device_fingerprint TEXT,
  p_device_info JSONB DEFAULT '{}',
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  session_id UUID;
BEGIN
  -- Try to find existing session for this device
  SELECT id INTO session_id
  FROM public.user_sessions
  WHERE user_id = auth.uid()
    AND device_fingerprint = p_device_fingerprint
    AND is_active = true
  LIMIT 1;
  
  IF session_id IS NOT NULL THEN
    -- Update existing session
    UPDATE public.user_sessions
    SET last_active_at = now(),
        expires_at = now() + interval '7 days',
        device_info = COALESCE(p_device_info, device_info),
        ip_address = COALESCE(p_ip_address, ip_address),
        user_agent = COALESCE(p_user_agent, user_agent)
    WHERE id = session_id;
  ELSE
    -- Create new session
    INSERT INTO public.user_sessions (user_id, device_fingerprint, device_info, ip_address, user_agent)
    VALUES (auth.uid(), p_device_fingerprint, p_device_info, p_ip_address, p_user_agent)
    RETURNING id INTO session_id;
  END IF;
  
  RETURN session_id;
END;
$$;

-- Function to invalidate all sessions (logout everywhere)
CREATE OR REPLACE FUNCTION public.invalidate_all_sessions()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_sessions
  SET is_active = false, expires_at = now()
  WHERE user_id = auth.uid();
END;
$$;

-- Function to invalidate specific session
CREATE OR REPLACE FUNCTION public.invalidate_session(p_session_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_sessions
  SET is_active = false, expires_at = now()
  WHERE id = p_session_id AND user_id = auth.uid();
  
  RETURN FOUND;
END;
$$;

-- Function to log security event
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_event_type TEXT,
  p_event_data JSONB DEFAULT '{}',
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.security_events (user_id, event_type, event_data, ip_address, user_agent)
  VALUES (auth.uid(), p_event_type, p_event_data, p_ip_address, p_user_agent);
END;
$$;

-- Function to get active sessions count
CREATE OR REPLACE FUNCTION public.get_active_sessions_count()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.user_sessions
  WHERE user_id = auth.uid()
    AND is_active = true
    AND expires_at > now();
$$;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active ON public.user_sessions(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier ON public.login_attempts(identifier, attempt_at);
CREATE INDEX IF NOT EXISTS idx_security_events_user ON public.security_events(user_id, created_at);
