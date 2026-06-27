-- Create refeeds table for Twitter-style retweet functionality
CREATE TABLE IF NOT EXISTS public.refeeds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  original_post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  refed_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(original_post_id, refed_by_user_id)
);

-- Enable RLS
ALTER TABLE public.refeeds ENABLE ROW LEVEL SECURITY;

-- Create policies for refeeds
CREATE POLICY "Anyone can view refeeds"
ON public.refeeds
FOR SELECT
USING (true);

CREATE POLICY "Users can create their own refeeds"
ON public.refeeds
FOR INSERT
WITH CHECK (auth.uid() = refed_by_user_id);

CREATE POLICY "Users can delete their own refeeds"
ON public.refeeds
FOR DELETE
USING (auth.uid() = refed_by_user_id);

-- Create index for performance
CREATE INDEX idx_refeeds_user ON public.refeeds(refed_by_user_id);
CREATE INDEX idx_refeeds_post ON public.refeeds(original_post_id);

-- Add refeeds_count to posts table
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS refeeds_count INTEGER DEFAULT 0;