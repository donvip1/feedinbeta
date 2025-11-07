-- Add message edit history tracking
CREATE TABLE IF NOT EXISTS public.message_edit_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  old_content TEXT NOT NULL,
  edited_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add edited_at column to messages table
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP WITH TIME ZONE;

-- Enable RLS
ALTER TABLE public.message_edit_history ENABLE ROW LEVEL SECURITY;

-- Policies for message_edit_history
CREATE POLICY "Users can view edit history of their conversation messages"
  ON public.message_edit_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN conversation_participants cp ON m.conversation_id = cp.conversation_id
      WHERE m.id = message_edit_history.message_id
      AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert edit history"
  ON public.message_edit_history FOR INSERT
  WITH CHECK (true);

-- Add realtime for message_edit_history
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_edit_history;