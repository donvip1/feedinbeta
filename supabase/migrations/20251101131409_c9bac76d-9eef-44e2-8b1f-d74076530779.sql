-- Create call_logs table for tracking call history
CREATE TABLE public.call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  call_type TEXT NOT NULL CHECK (call_type IN ('video', 'voice')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'missed', 'rejected', 'ended')),
  duration INTEGER DEFAULT 0, -- Duration in seconds
  room_url TEXT, -- Daily.co room URL or call identifier
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_call_logs_caller_id ON public.call_logs(caller_id);
CREATE INDEX idx_call_logs_receiver_id ON public.call_logs(receiver_id);
CREATE INDEX idx_call_logs_status ON public.call_logs(status);
CREATE INDEX idx_call_logs_created_at ON public.call_logs(created_at DESC);

-- Create call_participants table for group calls (future use)
CREATE TABLE public.call_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES call_logs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  UNIQUE(call_id, user_id)
);

CREATE INDEX idx_call_participants_call_id ON public.call_participants(call_id);
CREATE INDEX idx_call_participants_user_id ON public.call_participants(user_id);

-- Enable Row Level Security
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_participants ENABLE ROW LEVEL SECURITY;

-- RLS Policies for call_logs
CREATE POLICY "Users can view their own call logs"
ON public.call_logs FOR SELECT
USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can create call logs as caller"
ON public.call_logs FOR INSERT
WITH CHECK (auth.uid() = caller_id);

CREATE POLICY "Users can update their call logs"
ON public.call_logs FOR UPDATE
USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

-- RLS Policies for call_participants
CREATE POLICY "Users can view participants in their calls"
ON public.call_participants FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM call_logs
    WHERE call_logs.id = call_participants.call_id
    AND (call_logs.caller_id = auth.uid() OR call_logs.receiver_id = auth.uid())
  )
);

CREATE POLICY "Users can join calls they're part of"
ON public.call_participants FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM call_logs
    WHERE call_logs.id = call_participants.call_id
    AND (call_logs.caller_id = auth.uid() OR call_logs.receiver_id = auth.uid())
  )
  AND auth.uid() = user_id
);

-- Enable realtime for call updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_logs;