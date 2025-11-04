-- Add user strikes tracking table
CREATE TABLE IF NOT EXISTS public.user_strikes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  strike_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'low',
  issued_by UUID NOT NULL,
  issued_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  related_content_id UUID,
  related_content_type TEXT,
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.user_strikes ENABLE ROW LEVEL SECURITY;

-- Policies for user_strikes
CREATE POLICY "Moderators can view all strikes"
  ON public.user_strikes FOR SELECT
  USING (has_role(auth.uid(), 'moderator'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Moderators can issue strikes"
  ON public.user_strikes FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'moderator'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Moderators can update strikes"
  ON public.user_strikes FOR UPDATE
  USING (has_role(auth.uid(), 'moderator'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own strikes"
  ON public.user_strikes FOR SELECT
  USING (auth.uid() = user_id);

-- Add index for performance
CREATE INDEX idx_user_strikes_user_id ON public.user_strikes(user_id);
CREATE INDEX idx_user_strikes_issued_at ON public.user_strikes(issued_at DESC);
CREATE INDEX idx_user_strikes_active ON public.user_strikes(is_active) WHERE is_active = true;

-- Create view for active user warnings
CREATE OR REPLACE VIEW public.user_strike_summary AS
SELECT 
  user_id,
  COUNT(*) FILTER (WHERE is_active = true) as active_strikes,
  COUNT(*) FILTER (WHERE severity = 'high' AND is_active = true) as high_severity_strikes,
  COUNT(*) as total_strikes,
  MAX(issued_at) as last_strike_date
FROM public.user_strikes
GROUP BY user_id;