-- =====================================================
-- PHASE 2: GROUP CHAT SYSTEM
-- =====================================================

-- Add invite_code and settings to groups table
ALTER TABLE public.groups 
ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS invite_link_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS slow_mode_seconds INTEGER DEFAULT 0;

-- Add additional columns to group_members for moderation
ALTER TABLE public.group_members 
ADD COLUMN IF NOT EXISTS can_send_messages BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS muted_until TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS added_by UUID REFERENCES auth.users(id);

-- Create group_messages table for real-time group chat
CREATE TABLE IF NOT EXISTS public.group_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT,
  file_size INTEGER,
  reply_to_id UUID REFERENCES public.group_messages(id),
  is_pinned BOOLEAN DEFAULT false,
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_group_messages_group_id ON public.group_messages(group_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_created_at ON public.group_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_group_messages_sender_id ON public.group_messages(sender_id);

-- Create group_message_read_status table (tracks last read message per user per group)
CREATE TABLE IF NOT EXISTS public.group_message_read_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  last_read_message_id UUID REFERENCES public.group_messages(id),
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- Create group_typing_indicators table
CREATE TABLE IF NOT EXISTS public.group_typing_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  is_typing BOOLEAN DEFAULT false,
  activity_type TEXT DEFAULT 'typing',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- Create group_message_reactions table
CREATE TABLE IF NOT EXISTS public.group_message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES public.group_messages(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);

-- Enable RLS on all new tables
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_message_read_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_typing_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_message_reactions ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES FOR GROUP MESSAGES
-- =====================================================

-- Members can view messages in groups they belong to
CREATE POLICY "Members can view group messages"
ON public.group_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_members.group_id = group_messages.group_id
    AND group_members.user_id = auth.uid()
  )
);

-- Members can insert messages if they have permission
CREATE POLICY "Members can send group messages"
ON public.group_messages
FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_members.group_id = group_messages.group_id
    AND group_members.user_id = auth.uid()
    AND group_members.can_send_messages = true
    AND (group_members.muted_until IS NULL OR group_members.muted_until < NOW())
  )
);

-- Users can update their own messages (for editing)
CREATE POLICY "Users can update own group messages"
ON public.group_messages
FOR UPDATE
USING (auth.uid() = sender_id)
WITH CHECK (auth.uid() = sender_id);

-- Users can delete their own messages, admins can delete any
CREATE POLICY "Users and admins can delete group messages"
ON public.group_messages
FOR DELETE
USING (
  auth.uid() = sender_id
  OR EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_members.group_id = group_messages.group_id
    AND group_members.user_id = auth.uid()
    AND group_members.role IN ('admin', 'moderator')
  )
);

-- =====================================================
-- RLS POLICIES FOR GROUP MESSAGE READ STATUS
-- =====================================================

CREATE POLICY "Members can view read status"
ON public.group_message_read_status
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_members.group_id = group_message_read_status.group_id
    AND group_members.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert own read status"
ON public.group_message_read_status
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can upsert own read status"
ON public.group_message_read_status
FOR UPDATE
USING (auth.uid() = user_id);

-- =====================================================
-- RLS POLICIES FOR GROUP TYPING INDICATORS
-- =====================================================

CREATE POLICY "Members can view group typing"
ON public.group_typing_indicators
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_members.group_id = group_typing_indicators.group_id
    AND group_members.user_id = auth.uid()
  )
);

CREATE POLICY "Users can manage own typing status"
ON public.group_typing_indicators
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- RLS POLICIES FOR GROUP MESSAGE REACTIONS
-- =====================================================

CREATE POLICY "Members can view group reactions"
ON public.group_message_reactions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.group_messages gm
    JOIN public.group_members gme ON gme.group_id = gm.group_id
    WHERE gm.id = group_message_reactions.message_id
    AND gme.user_id = auth.uid()
  )
);

CREATE POLICY "Members can add reactions"
ON public.group_message_reactions
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.group_messages gm
    JOIN public.group_members gme ON gme.group_id = gm.group_id
    WHERE gm.id = group_message_reactions.message_id
    AND gme.user_id = auth.uid()
  )
);

CREATE POLICY "Users can remove own reactions"
ON public.group_message_reactions
FOR DELETE
USING (auth.uid() = user_id);

-- =====================================================
-- ENABLE REALTIME FOR NEW TABLES
-- =====================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_typing_indicators;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_message_reactions;

-- Enable replica identity for proper realtime updates
ALTER TABLE public.group_messages REPLICA IDENTITY FULL;
ALTER TABLE public.group_typing_indicators REPLICA IDENTITY FULL;
ALTER TABLE public.group_message_reactions REPLICA IDENTITY FULL;

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to generate unique invite code
CREATE OR REPLACE FUNCTION generate_group_invite_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invite_code IS NULL THEN
    NEW.invite_code := LOWER(SUBSTR(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT), 1, 8));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate invite code
DROP TRIGGER IF EXISTS trigger_generate_group_invite_code ON public.groups;
CREATE TRIGGER trigger_generate_group_invite_code
  BEFORE INSERT ON public.groups
  FOR EACH ROW
  EXECUTE FUNCTION generate_group_invite_code();

-- Function to get unread count for a group
CREATE OR REPLACE FUNCTION get_group_unread_count(p_group_id UUID, p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_read_id UUID;
  v_count INTEGER;
BEGIN
  -- Get last read message ID
  SELECT last_read_message_id INTO v_last_read_id
  FROM group_message_read_status
  WHERE group_id = p_group_id AND user_id = p_user_id;
  
  -- Count messages after last read
  IF v_last_read_id IS NULL THEN
    SELECT COUNT(*) INTO v_count
    FROM group_messages
    WHERE group_id = p_group_id 
    AND sender_id != p_user_id
    AND deleted_at IS NULL;
  ELSE
    SELECT COUNT(*) INTO v_count
    FROM group_messages
    WHERE group_id = p_group_id 
    AND sender_id != p_user_id
    AND deleted_at IS NULL
    AND created_at > (
      SELECT created_at FROM group_messages WHERE id = v_last_read_id
    );
  END IF;
  
  RETURN COALESCE(v_count, 0);
END;
$$;

-- Function to mark group messages as read
CREATE OR REPLACE FUNCTION mark_group_messages_read(p_group_id UUID, p_message_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO group_message_read_status (group_id, user_id, last_read_message_id, last_read_at)
  VALUES (p_group_id, auth.uid(), p_message_id, NOW())
  ON CONFLICT (group_id, user_id)
  DO UPDATE SET 
    last_read_message_id = EXCLUDED.last_read_message_id,
    last_read_at = EXCLUDED.last_read_at;
END;
$$;