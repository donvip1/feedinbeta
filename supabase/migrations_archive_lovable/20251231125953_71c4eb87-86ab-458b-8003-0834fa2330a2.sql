
-- Add DELETE policies for live space content tables
-- Space owners should be able to delete messages, gifts, reactions from their spaces

-- DELETE policy for live_space_messages - allow space owner to delete
CREATE POLICY "Space owners can delete messages"
ON public.live_space_messages
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM live_spaces
    WHERE live_spaces.id = live_space_messages.space_id
    AND live_spaces.user_id = auth.uid()
  )
);

-- DELETE policy for live_space_reactions - allow space owner to delete
CREATE POLICY "Space owners can delete reactions"
ON public.live_space_reactions
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM live_spaces
    WHERE live_spaces.id = live_space_reactions.space_id
    AND live_spaces.user_id = auth.uid()
  )
);

-- DELETE policy for live_space_gifts - allow space owner to delete
-- Note: This only removes the gift record, not the transaction
CREATE POLICY "Space owners can delete gifts"
ON public.live_space_gifts
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM live_spaces
    WHERE live_spaces.id = live_space_gifts.space_id
    AND live_spaces.user_id = auth.uid()
  )
);
