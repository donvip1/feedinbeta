-- Create live stream gifts table for tracking gifts sent during streams
CREATE TABLE public.live_stream_gifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stream_id UUID NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  gift_type TEXT NOT NULL,
  credit_value INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create live stream co-host invites table
CREATE TABLE public.live_stream_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stream_id UUID NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
  host_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invited_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  responded_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(stream_id, invited_user_id)
);

-- Enable RLS
ALTER TABLE public.live_stream_gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_stream_invites ENABLE ROW LEVEL SECURITY;

-- RLS Policies for gifts
CREATE POLICY "Anyone can view stream gifts"
ON public.live_stream_gifts FOR SELECT USING (true);

CREATE POLICY "Authenticated users can send gifts"
ON public.live_stream_gifts FOR INSERT
WITH CHECK (auth.uid() = sender_id);

-- RLS Policies for invites
CREATE POLICY "Users can view their invites"
ON public.live_stream_invites FOR SELECT
USING (auth.uid() = host_id OR auth.uid() = invited_user_id);

CREATE POLICY "Hosts can create invites"
ON public.live_stream_invites FOR INSERT
WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Invited users can update invite status"
ON public.live_stream_invites FOR UPDATE
USING (auth.uid() = invited_user_id);

-- Function to send live stream gift with credit transfer
CREATE OR REPLACE FUNCTION public.send_live_gift(
  p_stream_id UUID,
  p_receiver_id UUID,
  p_gift_type TEXT,
  p_credit_value INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  sender_id UUID;
  sender_balance INTEGER;
  result JSON;
BEGIN
  sender_id := auth.uid();
  IF sender_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check sender balance
  SELECT balance INTO sender_balance
  FROM user_credits
  WHERE user_id = sender_id;

  IF sender_balance IS NULL OR sender_balance < p_credit_value THEN
    RAISE EXCEPTION 'Insufficient credits';
  END IF;

  -- Record the gift
  INSERT INTO live_stream_gifts (stream_id, sender_id, receiver_id, gift_type, credit_value)
  VALUES (p_stream_id, sender_id, p_receiver_id, p_gift_type, p_credit_value);

  -- Deduct from sender
  INSERT INTO credit_transactions (user_id, type, amount, description, related_id)
  VALUES (sender_id, 'live_gift_sent', -p_credit_value, 'Sent ' || p_gift_type || ' in live stream', p_stream_id);

  -- Add to receiver
  INSERT INTO credit_transactions (user_id, type, amount, description, related_id)
  VALUES (p_receiver_id, 'live_gift_received', p_credit_value, 'Received ' || p_gift_type || ' in live stream', p_stream_id);

  SELECT json_build_object(
    'success', true,
    'message', 'Gift sent successfully',
    'credit_value', p_credit_value
  ) INTO result;

  RETURN result;
END;
$$;

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_stream_gifts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_stream_invites;