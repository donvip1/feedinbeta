
-- Create live_space_message_likes table for persistent likes
CREATE TABLE public.live_space_message_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.live_space_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id)
);

-- Add likes_count column to live_space_messages
ALTER TABLE public.live_space_messages ADD COLUMN IF NOT EXISTS likes_count INTEGER NOT NULL DEFAULT 0;

-- Enable RLS
ALTER TABLE public.live_space_message_likes ENABLE ROW LEVEL SECURITY;

-- RLS: Anyone authenticated can read likes
CREATE POLICY "Authenticated users can read likes"
ON public.live_space_message_likes
FOR SELECT TO authenticated
USING (true);

-- RLS: Users can insert their own likes
CREATE POLICY "Users can insert own likes"
ON public.live_space_message_likes
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- RLS: Users can delete their own likes
CREATE POLICY "Users can delete own likes"
ON public.live_space_message_likes
FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Create function to update likes_count on live_space_messages
CREATE OR REPLACE FUNCTION public.update_message_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.live_space_messages SET likes_count = likes_count + 1 WHERE id = NEW.message_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.live_space_messages SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.message_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Create trigger
CREATE TRIGGER trigger_update_message_likes_count
AFTER INSERT OR DELETE ON public.live_space_message_likes
FOR EACH ROW
EXECUTE FUNCTION public.update_message_likes_count();
