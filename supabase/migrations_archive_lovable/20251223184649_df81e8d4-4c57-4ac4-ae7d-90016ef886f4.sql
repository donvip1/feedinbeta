-- Live Spaces table for audio-only rooms (like Twitter Spaces)
CREATE TABLE public.live_spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'ended')),
  is_private BOOLEAN DEFAULT false,
  share_link TEXT UNIQUE DEFAULT gen_random_uuid()::text,
  topic_category TEXT,
  viewer_count INTEGER DEFAULT 0,
  peak_viewers INTEGER DEFAULT 0,
  scheduled_start TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  recording_url TEXT,
  is_recording_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Space speakers/co-hosts
CREATE TABLE public.live_space_speakers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID REFERENCES public.live_spaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT DEFAULT 'listener' CHECK (role IN ('host', 'co_host', 'speaker', 'listener')),
  is_muted BOOLEAN DEFAULT true,
  has_raised_hand BOOLEAN DEFAULT false,
  hand_raised_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  UNIQUE(space_id, user_id)
);

-- Space chat messages
CREATE TABLE public.live_space_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID REFERENCES public.live_spaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Space reactions (floating emojis)
CREATE TABLE public.live_space_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID REFERENCES public.live_spaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  reaction_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Space invitations
CREATE TABLE public.live_space_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID REFERENCES public.live_spaces(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL,
  invitee_id UUID NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  UNIQUE(space_id, invitee_id)
);

-- Space gifts (for monetization)
CREATE TABLE public.live_space_gifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID REFERENCES public.live_spaces(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  gift_type TEXT NOT NULL,
  credit_value INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.live_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_space_speakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_space_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_space_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_space_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_space_gifts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for live_spaces
CREATE POLICY "Public spaces are viewable by everyone" ON public.live_spaces
  FOR SELECT USING (is_private = false OR user_id = auth.uid());

CREATE POLICY "Users can create their own spaces" ON public.live_spaces
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own spaces" ON public.live_spaces
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own spaces" ON public.live_spaces
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for speakers
CREATE POLICY "Anyone can view speakers in public spaces" ON public.live_space_speakers
  FOR SELECT USING (true);

CREATE POLICY "Users can join as speaker" ON public.live_space_speakers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own speaker status" ON public.live_space_speakers
  FOR UPDATE USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.live_spaces WHERE id = space_id AND user_id = auth.uid()
  ));

CREATE POLICY "Users can leave spaces" ON public.live_space_speakers
  FOR DELETE USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.live_spaces WHERE id = space_id AND user_id = auth.uid()
  ));

-- RLS Policies for messages
CREATE POLICY "Anyone can view messages in spaces" ON public.live_space_messages
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can send messages" ON public.live_space_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for reactions
CREATE POLICY "Anyone can view reactions" ON public.live_space_reactions
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can add reactions" ON public.live_space_reactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for invitations
CREATE POLICY "Users can see their invitations" ON public.live_space_invitations
  FOR SELECT USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);

CREATE POLICY "Users can create invitations for their spaces" ON public.live_space_invitations
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.live_spaces WHERE id = space_id AND user_id = auth.uid()
  ) OR auth.uid() = inviter_id);

CREATE POLICY "Users can respond to their invitations" ON public.live_space_invitations
  FOR UPDATE USING (auth.uid() = invitee_id);

-- RLS Policies for gifts
CREATE POLICY "Anyone can view gifts in spaces" ON public.live_space_gifts
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can send gifts" ON public.live_space_gifts
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Enable realtime for live spaces
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_spaces;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_space_speakers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_space_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_space_reactions;

-- Create indexes for performance
CREATE INDEX idx_live_spaces_status ON public.live_spaces(status);
CREATE INDEX idx_live_spaces_user_id ON public.live_spaces(user_id);
CREATE INDEX idx_live_spaces_share_link ON public.live_spaces(share_link);
CREATE INDEX idx_live_space_speakers_space_id ON public.live_space_speakers(space_id);
CREATE INDEX idx_live_space_messages_space_id ON public.live_space_messages(space_id);

-- Trigger for updated_at
CREATE TRIGGER update_live_spaces_updated_at
  BEFORE UPDATE ON public.live_spaces
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();