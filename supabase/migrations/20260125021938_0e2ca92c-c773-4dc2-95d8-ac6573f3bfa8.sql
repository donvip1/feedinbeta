-- Create group polls table
CREATE TABLE public.group_polls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.group_messages(id) ON DELETE SET NULL,
  creator_id UUID NOT NULL,
  question TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_multiple_choice BOOLEAN DEFAULT false,
  is_anonymous BOOLEAN DEFAULT false,
  ends_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create poll votes table
CREATE TABLE public.group_poll_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id UUID NOT NULL REFERENCES public.group_polls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  option_index INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(poll_id, user_id, option_index)
);

-- Enable RLS
ALTER TABLE public.group_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_poll_votes ENABLE ROW LEVEL SECURITY;

-- RLS policies for group_polls
CREATE POLICY "Group members can view polls" 
  ON public.group_polls FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members 
      WHERE group_members.group_id = group_polls.group_id 
      AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Group members can create polls" 
  ON public.group_polls FOR INSERT 
  WITH CHECK (
    auth.uid() = creator_id AND
    EXISTS (
      SELECT 1 FROM public.group_members 
      WHERE group_members.group_id = group_polls.group_id 
      AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Poll creators and admins can delete" 
  ON public.group_polls FOR DELETE 
  USING (
    auth.uid() = creator_id OR
    EXISTS (
      SELECT 1 FROM public.group_members 
      WHERE group_members.group_id = group_polls.group_id 
      AND group_members.user_id = auth.uid()
      AND group_members.role IN ('owner', 'admin')
    )
  );

-- RLS policies for poll votes
CREATE POLICY "Group members can view votes" 
  ON public.group_poll_votes FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.group_polls p
      JOIN public.group_members gm ON gm.group_id = p.group_id
      WHERE p.id = group_poll_votes.poll_id
      AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Group members can vote" 
  ON public.group_poll_votes FOR INSERT 
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.group_polls p
      JOIN public.group_members gm ON gm.group_id = p.group_id
      WHERE p.id = group_poll_votes.poll_id
      AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can remove their votes" 
  ON public.group_poll_votes FOR DELETE 
  USING (auth.uid() = user_id);

-- Add realtime for polls
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_polls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_poll_votes;

-- Create indexes
CREATE INDEX idx_group_polls_group_id ON public.group_polls(group_id);
CREATE INDEX idx_group_poll_votes_poll_id ON public.group_poll_votes(poll_id);
CREATE INDEX idx_group_poll_votes_user_id ON public.group_poll_votes(user_id);