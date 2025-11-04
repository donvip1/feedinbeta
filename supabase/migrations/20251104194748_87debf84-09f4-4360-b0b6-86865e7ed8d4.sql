-- Create call_signals table for WebRTC signaling
CREATE TABLE IF NOT EXISTS public.call_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES public.call_logs(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signal_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.call_signals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for call_signals
CREATE POLICY "Users can send signals"
  ON public.call_signals FOR INSERT
  WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Users can receive signals"
  ON public.call_signals FOR SELECT
  USING (auth.uid() = to_user_id);

-- Create index
CREATE INDEX idx_call_signals_to_user ON public.call_signals(to_user_id, created_at);

-- Add realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_signals;