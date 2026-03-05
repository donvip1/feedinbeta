-- Drop existing DELETE policies and recreate with admin/moderator access

-- live_spaces: allow owner + admin/moderator
DROP POLICY IF EXISTS "Users can delete their own spaces" ON public.live_spaces;
CREATE POLICY "Users can delete their own spaces or admins"
ON public.live_spaces FOR DELETE TO authenticated
USING (
  auth.uid() = user_id 
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'moderator')
);

-- live_space_messages: allow space owner + admin/moderator
DROP POLICY IF EXISTS "Space owners can delete messages" ON public.live_space_messages;
CREATE POLICY "Space owners or admins can delete messages"
ON public.live_space_messages FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM live_spaces WHERE live_spaces.id = live_space_messages.space_id AND live_spaces.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'moderator')
);

-- live_space_reactions: allow space owner + admin/moderator
DROP POLICY IF EXISTS "Space owners can delete reactions" ON public.live_space_reactions;
CREATE POLICY "Space owners or admins can delete reactions"
ON public.live_space_reactions FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM live_spaces WHERE live_spaces.id = live_space_reactions.space_id AND live_spaces.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'moderator')
);

-- live_space_gifts: allow space owner + admin/moderator
DROP POLICY IF EXISTS "Space owners can delete gifts" ON public.live_space_gifts;
CREATE POLICY "Space owners or admins can delete gifts"
ON public.live_space_gifts FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM live_spaces WHERE live_spaces.id = live_space_gifts.space_id AND live_spaces.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'moderator')
);

-- live_space_speakers: allow space owner + admin/moderator + self
DROP POLICY IF EXISTS "Users can leave spaces" ON public.live_space_speakers;
CREATE POLICY "Users can leave or admins can delete speakers"
ON public.live_space_speakers FOR DELETE TO authenticated
USING (
  auth.uid() = user_id 
  OR EXISTS (SELECT 1 FROM live_spaces WHERE live_spaces.id = live_space_speakers.space_id AND live_spaces.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'moderator')
);