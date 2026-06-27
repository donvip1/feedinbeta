-- Create posts table
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_id TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT,
  media_url TEXT,
  media_type TEXT CHECK (media_type IN ('text', 'image', 'video')),
  post_type TEXT DEFAULT 'public' CHECK (post_type IN ('public', 'friends', 'private')),
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'deleted', 'flagged', 'hidden')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for posts
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_feed_id ON posts(feed_id);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_posts_status ON posts(status);

-- Create post_likes table
CREATE TABLE public.post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- Create indexes for post_likes
CREATE INDEX idx_post_likes_post_id ON post_likes(post_id);
CREATE INDEX idx_post_likes_user_id ON post_likes(user_id);

-- Create post_views table
CREATE TABLE public.post_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for post_views
CREATE INDEX idx_post_views_post_id ON post_views(post_id);

-- Enable RLS
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_views ENABLE ROW LEVEL SECURITY;

-- RLS Policies for posts
CREATE POLICY "Users can view active public posts"
  ON public.posts FOR SELECT
  TO authenticated
  USING (status = 'active' AND post_type = 'public');

CREATE POLICY "Users can view their own posts"
  ON public.posts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own posts"
  ON public.posts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own posts"
  ON public.posts FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own posts"
  ON public.posts FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for post_likes
CREATE POLICY "Users can view all post likes"
  ON public.post_likes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can like posts"
  ON public.post_likes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can unlike their own likes"
  ON public.post_likes FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for post_views
CREATE POLICY "Users can create post views"
  ON public.post_views FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Function to generate unique feed IDs
CREATE OR REPLACE FUNCTION public.generate_feed_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id TEXT;
  counter INTEGER;
BEGIN
  -- Get the count of posts
  SELECT COUNT(*) + 1 INTO counter FROM posts;
  
  -- Generate feed ID (feedin001, feedin002, etc.)
  new_id := 'feedin' || LPAD(counter::TEXT, 3, '0');
  
  -- Check if it exists (rare collision case)
  WHILE EXISTS (SELECT 1 FROM posts WHERE feed_id = new_id) LOOP
    counter := counter + 1;
    new_id := 'feedin' || LPAD(counter::TEXT, 3, '0');
  END LOOP;
  
  RETURN new_id;
END;
$$;

-- Trigger to auto-generate feed_id
CREATE OR REPLACE FUNCTION public.set_post_feed_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.feed_id IS NULL OR NEW.feed_id = '' THEN
    NEW.feed_id := public.generate_feed_id();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_post_feed_id_trigger
  BEFORE INSERT ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_post_feed_id();

-- Trigger for posts updated_at
CREATE TRIGGER update_posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to update likes_count
CREATE OR REPLACE FUNCTION public.update_post_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET likes_count = likes_count - 1 WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER update_post_likes_count_trigger
  AFTER INSERT OR DELETE ON public.post_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_post_likes_count();

-- Function to update views_count
CREATE OR REPLACE FUNCTION public.update_post_views_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE posts SET views_count = views_count + 1 WHERE id = NEW.post_id;
  RETURN NULL;
END;
$$;

CREATE TRIGGER update_post_views_count_trigger
  AFTER INSERT ON public.post_views
  FOR EACH ROW
  EXECUTE FUNCTION public.update_post_views_count();