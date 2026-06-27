-- Create groups table
CREATE TABLE IF NOT EXISTS public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  cover_url TEXT,
  created_by UUID NOT NULL,
  is_private BOOLEAN DEFAULT false,
  member_count INTEGER DEFAULT 0,
  post_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create group_members table
CREATE TABLE IF NOT EXISTS public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member', -- admin, moderator, member
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Create group_posts table
CREATE TABLE IF NOT EXISTS public.group_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT,
  media_url TEXT,
  media_type TEXT,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create group_join_requests table
CREATE TABLE IF NOT EXISTS public.group_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, approved, rejected
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Enable RLS
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_join_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for groups
CREATE POLICY "Anyone can view public groups"
  ON public.groups FOR SELECT
  USING (is_private = false OR id IN (
    SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Authenticated users can create groups"
  ON public.groups FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Group admins can update groups"
  ON public.groups FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.group_members 
    WHERE group_id = groups.id 
    AND user_id = auth.uid() 
    AND role = 'admin'
  ));

CREATE POLICY "Group creators can delete groups"
  ON public.groups FOR DELETE
  USING (auth.uid() = created_by);

-- RLS Policies for group_members
CREATE POLICY "Members can view group members"
  ON public.group_members FOR SELECT
  USING (group_id IN (
    SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
  ) OR group_id IN (
    SELECT id FROM public.groups WHERE is_private = false
  ));

CREATE POLICY "Users can join groups"
  ON public.group_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage members"
  ON public.group_members FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = group_members.group_id 
    AND gm.user_id = auth.uid() 
    AND gm.role = 'admin'
  ));

CREATE POLICY "Admins can update member roles"
  ON public.group_members FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = group_members.group_id 
    AND gm.user_id = auth.uid() 
    AND gm.role = 'admin'
  ));

-- RLS Policies for group_posts
CREATE POLICY "Members can view group posts"
  ON public.group_posts FOR SELECT
  USING (group_id IN (
    SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
  ) OR group_id IN (
    SELECT id FROM public.groups WHERE is_private = false
  ));

CREATE POLICY "Members can create posts"
  ON public.group_posts FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    group_id IN (SELECT group_id FROM public.group_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update their own posts"
  ON public.group_posts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own posts"
  ON public.group_posts FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for group_join_requests
CREATE POLICY "Users can view their own requests"
  ON public.group_join_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view group requests"
  ON public.group_join_requests FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.group_members 
    WHERE group_id = group_join_requests.group_id 
    AND user_id = auth.uid() 
    AND role IN ('admin', 'moderator')
  ));

CREATE POLICY "Users can create join requests"
  ON public.group_join_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update requests"
  ON public.group_join_requests FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.group_members 
    WHERE group_id = group_join_requests.group_id 
    AND user_id = auth.uid() 
    AND role IN ('admin', 'moderator')
  ));

-- Triggers to update member counts
CREATE OR REPLACE FUNCTION update_group_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.groups SET member_count = member_count + 1 WHERE id = NEW.group_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.groups SET member_count = member_count - 1 WHERE id = OLD.group_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_groups_member_count
AFTER INSERT OR DELETE ON public.group_members
FOR EACH ROW EXECUTE FUNCTION update_group_member_count();

-- Trigger to auto-add creator as admin
CREATE OR REPLACE FUNCTION add_group_creator_as_admin()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'admin');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER add_creator_as_admin
AFTER INSERT ON public.groups
FOR EACH ROW EXECUTE FUNCTION add_group_creator_as_admin();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.groups;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_posts;