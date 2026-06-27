
CREATE TABLE public.live_stream_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stream_id UUID NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.live_stream_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read stream messages"
  ON public.live_stream_messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert stream messages"
  ON public.live_stream_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_live_stream_messages_stream_id ON public.live_stream_messages(stream_id);
CREATE INDEX idx_live_stream_messages_created_at ON public.live_stream_messages(stream_id, created_at DESC);
