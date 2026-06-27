-- Create space_feedback table for user ratings and feedback
CREATE TABLE IF NOT EXISTS public.space_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES public.live_spaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  rating INTEGER NOT NULL,
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add constraint with trigger instead of CHECK for rating
CREATE OR REPLACE FUNCTION public.validate_space_feedback_rating()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.rating < 1 OR NEW.rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS space_feedback_rating_check ON public.space_feedback;
CREATE TRIGGER space_feedback_rating_check
BEFORE INSERT OR UPDATE ON public.space_feedback
FOR EACH ROW EXECUTE FUNCTION public.validate_space_feedback_rating();

-- Enable RLS
ALTER TABLE public.space_feedback ENABLE ROW LEVEL SECURITY;

-- RLS policies (drop if exist first to avoid conflicts)
DROP POLICY IF EXISTS "Users can insert their own feedback" ON public.space_feedback;
DROP POLICY IF EXISTS "Users can view their own feedback" ON public.space_feedback;

CREATE POLICY "Users can insert their own feedback" 
ON public.space_feedback 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own feedback" 
ON public.space_feedback 
FOR SELECT 
USING (auth.uid() = user_id);