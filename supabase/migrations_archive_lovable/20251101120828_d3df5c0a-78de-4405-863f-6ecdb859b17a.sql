-- Create stories table
CREATE TABLE public.stories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  views_count INTEGER DEFAULT 0,
  CONSTRAINT stories_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- Create story_views table
CREATE TABLE public.story_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(story_id, user_id),
  CONSTRAINT story_views_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- Create story_reactions table
CREATE TABLE public.story_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  reaction_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(story_id, user_id),
  CONSTRAINT story_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_reactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stories
CREATE POLICY "Users can view all active stories"
  ON public.stories FOR SELECT
  USING (expires_at > now());

CREATE POLICY "Users can create their own stories"
  ON public.stories FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own stories"
  ON public.stories FOR DELETE
  USING (user_id = auth.uid());

-- RLS Policies for story_views
CREATE POLICY "Users can view story views for their own stories"
  ON public.story_views FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.stories
      WHERE id = story_views.story_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add story views"
  ON public.story_views FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for story_reactions
CREATE POLICY "Users can view reactions on stories"
  ON public.story_reactions FOR SELECT
  USING (true);

CREATE POLICY "Users can add reactions to stories"
  ON public.story_reactions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can remove their own reactions"
  ON public.story_reactions FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own reactions"
  ON public.story_reactions FOR UPDATE
  USING (user_id = auth.uid());

-- Indexes for performance
CREATE INDEX idx_stories_user ON public.stories(user_id);
CREATE INDEX idx_stories_expires ON public.stories(expires_at);
CREATE INDEX idx_story_views_story ON public.story_views(story_id);
CREATE INDEX idx_story_views_user ON public.story_views(user_id);
CREATE INDEX idx_story_reactions_story ON public.story_reactions(story_id);

-- Function to update story views count
CREATE OR REPLACE FUNCTION update_story_views_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.stories SET views_count = views_count + 1 WHERE id = NEW.story_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_story_views_on_insert
AFTER INSERT ON public.story_views
FOR EACH ROW
EXECUTE FUNCTION update_story_views_count();

-- Function to auto-delete expired stories
CREATE OR REPLACE FUNCTION delete_expired_stories()
RETURNS void AS $$
BEGIN
  DELETE FROM public.stories WHERE expires_at <= now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Enable realtime for stories
ALTER PUBLICATION supabase_realtime ADD TABLE public.stories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.story_views;