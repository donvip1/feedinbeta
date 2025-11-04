-- Phase 1: Core moderation and social features

-- Moderation queue for AI flagged content
CREATE TABLE IF NOT EXISTS public.moderation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('post', 'comment', 'story', 'message', 'profile')),
  content_id UUID NOT NULL,
  auto_labels JSONB DEFAULT '[]'::jsonb,
  confidence_scores JSONB DEFAULT '{}'::jsonb,
  suggested_action TEXT CHECK (suggested_action IN ('allow', 'hold', 'remove', 'mute_audio', 'blur', 'review')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'approved', 'removed', 'escalated')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  moderator_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Appeals system
CREATE TABLE IF NOT EXISTS public.moderation_appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  moderation_event_id UUID REFERENCES public.moderation_actions(id),
  content_id UUID NOT NULL,
  content_type TEXT NOT NULL,
  appeal_text TEXT NOT NULL,
  attachments JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'accepted', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Comment reactions (emoji reactions)
CREATE TABLE IF NOT EXISTS public.comment_emoji_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(comment_id, user_id, emoji)
);

-- Message read receipts
CREATE TABLE IF NOT EXISTS public.message_read_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(message_id, user_id)
);

-- Notification badges counter
CREATE TABLE IF NOT EXISTS public.notification_badges (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  unread_count INTEGER DEFAULT 0,
  last_checked TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add aspect_ratio and background_blur to posts
ALTER TABLE public.posts 
  ADD COLUMN IF NOT EXISTS aspect_ratio TEXT DEFAULT '9:16',
  ADD COLUMN IF NOT EXISTS has_blur_background BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS moderation_status TEXT DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'approved', 'held', 'removed'));

-- Add read status to messages
ALTER TABLE public.messages 
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;

-- RLS Policies for moderation_queue
ALTER TABLE public.moderation_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Moderators can view queue"
  ON public.moderation_queue FOR SELECT
  USING (has_role(auth.uid(), 'moderator'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Moderators can update queue"
  ON public.moderation_queue FOR UPDATE
  USING (has_role(auth.uid(), 'moderator'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert to queue"
  ON public.moderation_queue FOR INSERT
  WITH CHECK (true);

-- RLS Policies for appeals
ALTER TABLE public.moderation_appeals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create appeals"
  ON public.moderation_appeals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their appeals"
  ON public.moderation_appeals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Moderators can view all appeals"
  ON public.moderation_appeals FOR SELECT
  USING (has_role(auth.uid(), 'moderator'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Moderators can update appeals"
  ON public.moderation_appeals FOR UPDATE
  USING (has_role(auth.uid(), 'moderator'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- RLS for comment emoji reactions
ALTER TABLE public.comment_emoji_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can add emoji reactions"
  ON public.comment_emoji_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view emoji reactions"
  ON public.comment_emoji_reactions FOR SELECT
  USING (true);

CREATE POLICY "Users can remove their emoji reactions"
  ON public.comment_emoji_reactions FOR DELETE
  USING (auth.uid() = user_id);

-- RLS for read receipts
ALTER TABLE public.message_read_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can mark messages as read"
  ON public.message_read_receipts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view read receipts in their conversations"
  ON public.message_read_receipts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.conversation_participants cp ON m.conversation_id = cp.conversation_id
      WHERE m.id = message_read_receipts.message_id AND cp.user_id = auth.uid()
    )
  );

-- RLS for notification badges
ALTER TABLE public.notification_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their badge count"
  ON public.notification_badges FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their badge count"
  ON public.notification_badges FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert badge counts"
  ON public.notification_badges FOR INSERT
  WITH CHECK (true);

-- Trigger to update notification badge count
CREATE OR REPLACE FUNCTION update_notification_badge()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notification_badges (user_id, unread_count, updated_at)
  VALUES (NEW.user_id, 1, now())
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    unread_count = notification_badges.unread_count + 1,
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_notification_created
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  WHEN (NEW.is_read = false)
  EXECUTE FUNCTION update_notification_badge();

-- Trigger to decrease badge count when notification read
CREATE OR REPLACE FUNCTION decrease_notification_badge()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_read = false AND NEW.is_read = true THEN
    UPDATE public.notification_badges 
    SET 
      unread_count = GREATEST(0, unread_count - 1),
      updated_at = now()
    WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_notification_read
  AFTER UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION decrease_notification_badge();

-- Initialize notification badges for existing users
INSERT INTO public.notification_badges (user_id, unread_count)
SELECT DISTINCT user_id, COUNT(*) 
FROM public.notifications 
WHERE is_read = false
GROUP BY user_id
ON CONFLICT (user_id) DO NOTHING;