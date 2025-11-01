-- Create live streams table
CREATE TABLE IF NOT EXISTS public.live_streams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  stream_key TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'ended', 'cancelled')),
  viewer_count INTEGER DEFAULT 0,
  peak_viewers INTEGER DEFAULT 0,
  scheduled_start TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration INTEGER DEFAULT 0,
  is_premium BOOLEAN DEFAULT false,
  category TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create live stream viewers table
CREATE TABLE IF NOT EXISTS public.live_stream_viewers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT now(),
  left_at TIMESTAMPTZ,
  watch_duration INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

-- Create live stream comments table
CREATE TABLE IF NOT EXISTS public.live_stream_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create live stream reactions table
CREATE TABLE IF NOT EXISTS public.live_stream_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create live stream analytics table
CREATE TABLE IF NOT EXISTS public.live_stream_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
  total_views INTEGER DEFAULT 0,
  unique_viewers INTEGER DEFAULT 0,
  average_watch_time INTEGER DEFAULT 0,
  peak_concurrent_viewers INTEGER DEFAULT 0,
  total_comments INTEGER DEFAULT 0,
  total_reactions INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.live_streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_stream_viewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_stream_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_stream_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_stream_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for live_streams
CREATE POLICY "Users can view active live streams"
  ON public.live_streams FOR SELECT
  USING (status = 'live' OR (is_premium = false AND status IN ('scheduled', 'ended')));

CREATE POLICY "Users can view their own streams"
  ON public.live_streams FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own streams"
  ON public.live_streams FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own streams"
  ON public.live_streams FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own streams"
  ON public.live_streams FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for live_stream_viewers
CREATE POLICY "Users can view viewers of public streams"
  ON public.live_stream_viewers FOR SELECT
  USING (stream_id IN (SELECT id FROM public.live_streams WHERE status = 'live'));

CREATE POLICY "Users can join streams as viewers"
  ON public.live_stream_viewers FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update their viewer status"
  ON public.live_stream_viewers FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for live_stream_comments
CREATE POLICY "Users can view comments on live streams"
  ON public.live_stream_comments FOR SELECT
  USING (stream_id IN (SELECT id FROM public.live_streams WHERE status = 'live'));

CREATE POLICY "Authenticated users can comment on live streams"
  ON public.live_stream_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
  ON public.live_stream_comments FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for live_stream_reactions
CREATE POLICY "Users can view reactions on live streams"
  ON public.live_stream_reactions FOR SELECT
  USING (stream_id IN (SELECT id FROM public.live_streams WHERE status = 'live'));

CREATE POLICY "Users can add reactions"
  ON public.live_stream_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their reactions"
  ON public.live_stream_reactions FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for live_stream_analytics
CREATE POLICY "Stream owners can view analytics"
  ON public.live_stream_analytics FOR SELECT
  USING (stream_id IN (SELECT id FROM public.live_streams WHERE user_id = auth.uid()));

-- Create indexes
CREATE INDEX idx_live_streams_user_id ON public.live_streams(user_id);
CREATE INDEX idx_live_streams_status ON public.live_streams(status);
CREATE INDEX idx_live_streams_scheduled_start ON public.live_streams(scheduled_start);
CREATE INDEX idx_live_stream_viewers_stream_id ON public.live_stream_viewers(stream_id);
CREATE INDEX idx_live_stream_comments_stream_id ON public.live_stream_comments(stream_id);
CREATE INDEX idx_live_stream_reactions_stream_id ON public.live_stream_reactions(stream_id);

-- Function to update viewer count
CREATE OR REPLACE FUNCTION public.update_live_stream_viewer_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.is_active = true THEN
    UPDATE public.live_streams
    SET 
      viewer_count = viewer_count + 1,
      peak_viewers = GREATEST(peak_viewers, viewer_count + 1),
      updated_at = now()
    WHERE id = NEW.stream_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.is_active = true AND NEW.is_active = false THEN
    UPDATE public.live_streams
    SET 
      viewer_count = GREATEST(0, viewer_count - 1),
      updated_at = now()
    WHERE id = NEW.stream_id;
    
    UPDATE public.live_stream_viewers
    SET 
      left_at = now(),
      watch_duration = EXTRACT(EPOCH FROM (now() - joined_at))::INTEGER
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for viewer count
CREATE TRIGGER on_viewer_change_update_count
  AFTER INSERT OR UPDATE ON public.live_stream_viewers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_live_stream_viewer_count();

-- Function to generate stream key
CREATE OR REPLACE FUNCTION public.generate_stream_key()
RETURNS TEXT AS $$
BEGIN
  RETURN 'stream_' || encode(gen_random_bytes(16), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Function to update stream analytics
CREATE OR REPLACE FUNCTION public.update_stream_analytics()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'ended' AND OLD.status = 'live' THEN
    INSERT INTO public.live_stream_analytics (
      stream_id,
      total_views,
      unique_viewers,
      average_watch_time,
      peak_concurrent_viewers,
      total_comments,
      total_reactions
    )
    SELECT
      NEW.id,
      COUNT(v.id),
      COUNT(DISTINCT v.user_id),
      AVG(v.watch_duration)::INTEGER,
      NEW.peak_viewers,
      (SELECT COUNT(*) FROM public.live_stream_comments WHERE stream_id = NEW.id),
      (SELECT COUNT(*) FROM public.live_stream_reactions WHERE stream_id = NEW.id)
    FROM public.live_stream_viewers v
    WHERE v.stream_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for analytics
CREATE TRIGGER on_stream_ended_create_analytics
  AFTER UPDATE ON public.live_streams
  FOR EACH ROW
  WHEN (NEW.status = 'ended' AND OLD.status != 'ended')
  EXECUTE FUNCTION public.update_stream_analytics();

-- Enable realtime for live streams
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_streams;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_stream_viewers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_stream_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_stream_reactions;