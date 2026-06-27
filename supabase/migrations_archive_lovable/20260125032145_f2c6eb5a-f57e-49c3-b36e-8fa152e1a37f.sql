-- Feature 2: Group Calls with LiveKit
CREATE TABLE public.group_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  initiated_by UUID NOT NULL,
  call_type TEXT NOT NULL DEFAULT 'voice' CHECK (call_type IN ('voice', 'video')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  livekit_room_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.group_call_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID REFERENCES public.group_calls(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  is_muted BOOLEAN DEFAULT false,
  is_video_off BOOLEAN DEFAULT false,
  is_speaking BOOLEAN DEFAULT false,
  UNIQUE(call_id, user_id)
);

-- Enable RLS
ALTER TABLE public.group_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_call_participants ENABLE ROW LEVEL SECURITY;

-- RLS policies for group_calls
CREATE POLICY "Group members can view group calls"
  ON public.group_calls FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.group_members 
    WHERE group_members.group_id = group_calls.group_id 
    AND group_members.user_id = auth.uid()
  ));

CREATE POLICY "Group members can create calls"
  ON public.group_calls FOR INSERT
  WITH CHECK (
    auth.uid() = initiated_by AND
    EXISTS (
      SELECT 1 FROM public.group_members 
      WHERE group_members.group_id = group_calls.group_id 
      AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Call initiator can update calls"
  ON public.group_calls FOR UPDATE
  USING (auth.uid() = initiated_by);

-- RLS policies for group_call_participants
CREATE POLICY "Group members can view participants"
  ON public.group_call_participants FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.group_calls gc
    JOIN public.group_members gm ON gm.group_id = gc.group_id
    WHERE gc.id = group_call_participants.call_id
    AND gm.user_id = auth.uid()
  ));

CREATE POLICY "Users can join calls"
  ON public.group_call_participants FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.group_calls gc
      JOIN public.group_members gm ON gm.group_id = gc.group_id
      WHERE gc.id = call_id
      AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their participation"
  ON public.group_call_participants FOR UPDATE
  USING (auth.uid() = user_id);

-- Feature 3: Starred Messages
CREATE TABLE public.starred_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  message_id UUID,
  group_message_id UUID,
  message_type TEXT NOT NULL CHECK (message_type IN ('dm', 'group')),
  conversation_id UUID,
  group_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CHECK (
    (message_id IS NOT NULL AND group_message_id IS NULL) OR
    (message_id IS NULL AND group_message_id IS NOT NULL)
  ),
  
  UNIQUE(user_id, message_id),
  UNIQUE(user_id, group_message_id)
);

ALTER TABLE public.starred_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their starred messages"
  ON public.starred_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can star messages"
  ON public.starred_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unstar messages"
  ON public.starred_messages FOR DELETE
  USING (auth.uid() = user_id);

-- Feature 4: Message Forwarding - Add forwarded_from column
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS forwarded_from JSONB;
ALTER TABLE public.group_messages ADD COLUMN IF NOT EXISTS forwarded_from JSONB;

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_calls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_call_participants;

-- Create indexes for performance
CREATE INDEX idx_group_calls_group_id ON public.group_calls(group_id);
CREATE INDEX idx_group_calls_status ON public.group_calls(status);
CREATE INDEX idx_group_call_participants_call_id ON public.group_call_participants(call_id);
CREATE INDEX idx_starred_messages_user_id ON public.starred_messages(user_id);
CREATE INDEX idx_starred_messages_message_id ON public.starred_messages(message_id);
CREATE INDEX idx_starred_messages_group_message_id ON public.starred_messages(group_message_id);