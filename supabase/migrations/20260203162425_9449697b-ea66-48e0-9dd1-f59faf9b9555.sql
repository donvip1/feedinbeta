-- Create PK Battles table for competitive live streaming
CREATE TABLE public.pk_battles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID REFERENCES live_streams(id) ON DELETE CASCADE,
  host_id UUID NOT NULL,
  challenger_id UUID,
  host_score INTEGER DEFAULT 0,
  challenger_score INTEGER DEFAULT 0,
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'completed', 'cancelled')),
  duration_seconds INTEGER DEFAULT 300,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  winner_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add room_type column to live_streams
ALTER TABLE public.live_streams 
ADD COLUMN IF NOT EXISTS room_type TEXT DEFAULT 'video_broadcast';

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_pk_battles_stream_id ON public.pk_battles(stream_id);
CREATE INDEX IF NOT EXISTS idx_pk_battles_status ON public.pk_battles(status);
CREATE INDEX IF NOT EXISTS idx_pk_battles_host_id ON public.pk_battles(host_id);
CREATE INDEX IF NOT EXISTS idx_live_streams_room_type ON public.live_streams(room_type);

-- Enable Row Level Security
ALTER TABLE public.pk_battles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pk_battles
CREATE POLICY "Anyone can view active pk_battles" 
ON public.pk_battles 
FOR SELECT 
USING (true);

CREATE POLICY "Hosts can create pk_battles" 
ON public.pk_battles 
FOR INSERT 
WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Participants can update their pk_battles" 
ON public.pk_battles 
FOR UPDATE 
USING (auth.uid() = host_id OR auth.uid() = challenger_id);

CREATE POLICY "Hosts can delete their pk_battles" 
ON public.pk_battles 
FOR DELETE 
USING (auth.uid() = host_id);

-- Function to update pk_battles updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_pk_battles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger for automatic timestamp updates
CREATE TRIGGER update_pk_battles_updated_at
BEFORE UPDATE ON public.pk_battles
FOR EACH ROW
EXECUTE FUNCTION public.update_pk_battles_updated_at();

-- Enable realtime for pk_battles
ALTER PUBLICATION supabase_realtime ADD TABLE public.pk_battles;