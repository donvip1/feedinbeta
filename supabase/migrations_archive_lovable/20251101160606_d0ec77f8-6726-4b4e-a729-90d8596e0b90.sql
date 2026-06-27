-- Create content reports table
CREATE TABLE IF NOT EXISTS public.content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('post', 'comment', 'message', 'story', 'live_stream', 'profile')),
  content_id UUID NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'harassment', 'hate_speech', 'violence', 'nudity', 'misinformation', 'copyright', 'other')),
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create blocked users table
CREATE TABLE IF NOT EXISTS public.blocked_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);

-- Create muted users table
CREATE TABLE IF NOT EXISTS public.muted_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  muter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  muted_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  duration INTEGER,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(muter_id, muted_id)
);

-- Create saved posts table
CREATE TABLE IF NOT EXISTS public.saved_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  collection_name TEXT DEFAULT 'default',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, post_id)
);

-- Create post shares table
CREATE TABLE IF NOT EXISTS public.post_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_type TEXT NOT NULL CHECK (share_type IN ('direct', 'story', 'external')),
  shared_to_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create moderation actions table
CREATE TABLE IF NOT EXISTS public.moderation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  moderator_id UUID NOT NULL REFERENCES auth.users(id),
  action_type TEXT NOT NULL CHECK (action_type IN ('warn', 'timeout', 'ban', 'content_removal', 'account_restriction')),
  target_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  target_content_type TEXT,
  target_content_id UUID,
  reason TEXT NOT NULL,
  duration INTEGER,
  expires_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create content flags table (auto-moderation)
CREATE TABLE IF NOT EXISTS public.content_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL,
  content_id UUID NOT NULL,
  flag_type TEXT NOT NULL CHECK (flag_type IN ('spam_detected', 'profanity_detected', 'ai_flagged', 'multiple_reports')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  auto_action_taken TEXT,
  metadata JSONB,
  reviewed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.muted_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_flags ENABLE ROW LEVEL SECURITY;

-- RLS Policies for content_reports
CREATE POLICY "Users can create reports"
  ON public.content_reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view their own reports"
  ON public.content_reports FOR SELECT
  USING (auth.uid() = reporter_id);

CREATE POLICY "Moderators can view all reports"
  ON public.content_reports FOR SELECT
  USING (has_role(auth.uid(), 'moderator') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Moderators can update reports"
  ON public.content_reports FOR UPDATE
  USING (has_role(auth.uid(), 'moderator') OR has_role(auth.uid(), 'admin'));

-- RLS Policies for blocked_users
CREATE POLICY "Users can block others"
  ON public.blocked_users FOR INSERT
  WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Users can view their blocks"
  ON public.blocked_users FOR SELECT
  USING (auth.uid() = blocker_id);

CREATE POLICY "Users can unblock others"
  ON public.blocked_users FOR DELETE
  USING (auth.uid() = blocker_id);

-- RLS Policies for muted_users
CREATE POLICY "Users can mute others"
  ON public.muted_users FOR INSERT
  WITH CHECK (auth.uid() = muter_id);

CREATE POLICY "Users can view their mutes"
  ON public.muted_users FOR SELECT
  USING (auth.uid() = muter_id);

CREATE POLICY "Users can unmute others"
  ON public.muted_users FOR DELETE
  USING (auth.uid() = muter_id);

-- RLS Policies for saved_posts
CREATE POLICY "Users can save posts"
  ON public.saved_posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their saved posts"
  ON public.saved_posts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can unsave posts"
  ON public.saved_posts FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for post_shares
CREATE POLICY "Users can share posts"
  ON public.post_shares FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view shares"
  ON public.post_shares FOR SELECT
  USING (true);

-- RLS Policies for moderation_actions
CREATE POLICY "Moderators can create actions"
  ON public.moderation_actions FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'moderator') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Moderators can view actions"
  ON public.moderation_actions FOR SELECT
  USING (has_role(auth.uid(), 'moderator') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view actions against them"
  ON public.moderation_actions FOR SELECT
  USING (auth.uid() = target_user_id);

-- RLS Policies for content_flags
CREATE POLICY "Moderators can view flags"
  ON public.content_flags FOR SELECT
  USING (has_role(auth.uid(), 'moderator') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Moderators can update flags"
  ON public.content_flags FOR UPDATE
  USING (has_role(auth.uid(), 'moderator') OR has_role(auth.uid(), 'admin'));

-- Create indexes
CREATE INDEX idx_content_reports_status ON public.content_reports(status);
CREATE INDEX idx_content_reports_reporter ON public.content_reports(reporter_id);
CREATE INDEX idx_blocked_users_blocker ON public.blocked_users(blocker_id);
CREATE INDEX idx_blocked_users_blocked ON public.blocked_users(blocked_id);
CREATE INDEX idx_muted_users_muter ON public.muted_users(muter_id);
CREATE INDEX idx_saved_posts_user ON public.saved_posts(user_id);
CREATE INDEX idx_saved_posts_post ON public.saved_posts(post_id);
CREATE INDEX idx_post_shares_post ON public.post_shares(post_id);
CREATE INDEX idx_content_flags_reviewed ON public.content_flags(reviewed);

-- Function to update post shares count
CREATE OR REPLACE FUNCTION public.update_post_shares_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.posts 
  SET shares_count = shares_count + 1 
  WHERE id = NEW.post_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for shares count
CREATE TRIGGER on_post_share_update_count
  AFTER INSERT ON public.post_shares
  FOR EACH ROW
  EXECUTE FUNCTION public.update_post_shares_count();

-- Function to check if user is blocked
CREATE OR REPLACE FUNCTION public.is_user_blocked(user_a UUID, user_b UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.blocked_users
    WHERE (blocker_id = user_a AND blocked_id = user_b)
       OR (blocker_id = user_b AND blocked_id = user_a)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to check if user is muted
CREATE OR REPLACE FUNCTION public.is_user_muted(muter UUID, muted UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.muted_users
    WHERE muter_id = muter 
      AND muted_id = muted
      AND (expires_at IS NULL OR expires_at > now())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to auto-flag content with multiple reports
CREATE OR REPLACE FUNCTION public.check_report_threshold()
RETURNS TRIGGER AS $$
DECLARE
  report_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO report_count
  FROM public.content_reports
  WHERE content_type = NEW.content_type
    AND content_id = NEW.content_id
    AND status = 'pending';

  IF report_count >= 5 THEN
    INSERT INTO public.content_flags (
      content_type,
      content_id,
      flag_type,
      severity,
      metadata
    ) VALUES (
      NEW.content_type,
      NEW.content_id,
      'multiple_reports',
      'high',
      jsonb_build_object('report_count', report_count)
    ) ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for auto-flagging
CREATE TRIGGER on_report_check_threshold
  AFTER INSERT ON public.content_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.check_report_threshold();