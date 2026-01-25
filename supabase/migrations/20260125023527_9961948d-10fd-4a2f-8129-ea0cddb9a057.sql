-- Drop old unique constraint on message_reactions (allows only one reaction per user)
ALTER TABLE public.message_reactions 
DROP CONSTRAINT IF EXISTS message_reactions_message_id_user_id_key;

-- Add new constraint allowing multiple different emoji reactions per user per message
ALTER TABLE public.message_reactions 
ADD CONSTRAINT message_reactions_message_id_user_id_emoji_key 
UNIQUE (message_id, user_id, emoji);

-- Create user_bans table for moderation
CREATE TABLE public.user_bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  banned_by UUID NOT NULL,
  reason TEXT NOT NULL,
  ban_type TEXT NOT NULL DEFAULT 'temporary',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  lifted_at TIMESTAMPTZ,
  lifted_by UUID,
  CONSTRAINT user_bans_ban_type_check CHECK (ban_type IN ('temporary', 'permanent'))
);

-- Enable RLS on user_bans
ALTER TABLE public.user_bans ENABLE ROW LEVEL SECURITY;

-- Only moderators and admins can view bans
CREATE POLICY "Moderators can view bans"
ON public.user_bans
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('moderator', 'admin')
  )
);

-- Only moderators and admins can create bans
CREATE POLICY "Moderators can create bans"
ON public.user_bans
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('moderator', 'admin')
  )
);

-- Only moderators and admins can update bans (for lifting)
CREATE POLICY "Moderators can update bans"
ON public.user_bans
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('moderator', 'admin')
  )
);

-- Create index for quick user ban lookups
CREATE INDEX idx_user_bans_user_id ON public.user_bans(user_id);
CREATE INDEX idx_user_bans_active ON public.user_bans(user_id) WHERE lifted_at IS NULL;