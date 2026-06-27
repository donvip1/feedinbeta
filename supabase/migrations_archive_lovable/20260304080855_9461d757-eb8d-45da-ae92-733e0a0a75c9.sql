
ALTER TABLE public.conversation_participants 
  ADD COLUMN is_archived boolean DEFAULT false,
  ADD COLUMN is_muted boolean DEFAULT false,
  ADD COLUMN muted_until timestamptz DEFAULT null;

-- Index for filtering archived conversations efficiently
CREATE INDEX idx_conversation_participants_archived ON public.conversation_participants(user_id, is_archived);
