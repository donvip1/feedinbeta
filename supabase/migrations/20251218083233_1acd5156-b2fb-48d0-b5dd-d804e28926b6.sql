-- Drop existing overly permissive SELECT policies on story_comments
DROP POLICY IF EXISTS "Anyone can view story comments" ON public.story_comments;
DROP POLICY IF EXISTS "Users can view story comments" ON public.story_comments;

-- Create new policy: Only story owner can view comments on their stories
CREATE POLICY "Story owners can view comments on their stories" 
ON public.story_comments 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.stories 
    WHERE stories.id = story_comments.story_id 
    AND stories.user_id = auth.uid()
  )
  OR user_id = auth.uid() -- Users can see their own comments
);

-- Drop duplicate INSERT policy
DROP POLICY IF EXISTS "Users can add comments" ON public.story_comments;

-- Drop duplicate DELETE policy  
DROP POLICY IF EXISTS "Users can delete their own comments" ON public.story_comments;

-- Drop overly permissive SELECT policy on story_reactions
DROP POLICY IF EXISTS "Users can view reactions on stories" ON public.story_reactions;

-- Create new policy: Only story owner can view reactions
CREATE POLICY "Story owners can view reactions on their stories"
ON public.story_reactions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.stories 
    WHERE stories.id = story_reactions.story_id 
    AND stories.user_id = auth.uid()
  )
  OR user_id = auth.uid() -- Users can see their own reactions
);