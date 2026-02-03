-- 1. Add viewer count sync functions
CREATE OR REPLACE FUNCTION public.increment_viewer_count(p_stream_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.live_streams 
  SET viewer_count = COALESCE(viewer_count, 0) + 1 
  WHERE id = p_stream_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.decrement_viewer_count(p_stream_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.live_streams 
  SET viewer_count = GREATEST(COALESCE(viewer_count, 0) - 1, 0) 
  WHERE id = p_stream_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create chat reactions table
CREATE TABLE IF NOT EXISTS public.live_stream_chat_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID REFERENCES public.live_stream_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  reaction_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(comment_id, user_id)
);

ALTER TABLE public.live_stream_chat_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view chat reactions" ON public.live_stream_chat_reactions
  FOR SELECT USING (true);

CREATE POLICY "Users can add reactions" ON public.live_stream_chat_reactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own reactions" ON public.live_stream_chat_reactions
  FOR DELETE USING (auth.uid() = user_id);

-- Enable realtime for chat reactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_stream_chat_reactions;