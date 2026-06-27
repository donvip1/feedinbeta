-- Fix OPEN_ENDPOINTS: Restrict conversation participants to self-addition only
DROP POLICY IF EXISTS "Users can add participants to conversations" ON public.conversation_participants;

CREATE POLICY "Users can add themselves to conversations"
ON public.conversation_participants
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Fix MISSING_RLS: Require authentication for post views and prevent duplicate views
DROP POLICY IF EXISTS "Users can create post views" ON public.post_views;

-- Remove duplicate post views (keep the earliest view)
DELETE FROM public.post_views
WHERE id NOT IN (
  SELECT DISTINCT ON (post_id, user_id) id
  FROM public.post_views
  ORDER BY post_id, user_id, created_at ASC
);

-- Make user_id NOT NULL (first update any existing NULL values)
UPDATE public.post_views SET user_id = '00000000-0000-0000-0000-000000000000'::uuid WHERE user_id IS NULL;

ALTER TABLE public.post_views ALTER COLUMN user_id SET NOT NULL;

-- Add unique constraint to prevent duplicate views
ALTER TABLE public.post_views ADD CONSTRAINT unique_post_user_view UNIQUE (post_id, user_id);

CREATE POLICY "Authenticated users can create post views"
ON public.post_views
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Fix INPUT_VALIDATION: Add length constraints to content fields
ALTER TABLE public.posts ADD CONSTRAINT posts_content_length CHECK (length(content) <= 5000);

ALTER TABLE public.post_comments ADD CONSTRAINT comments_content_length CHECK (length(content) <= 2000);

ALTER TABLE public.messages ADD CONSTRAINT messages_content_length CHECK (length(content) <= 10000);

-- Fix STORAGE_EXPOSURE: Require authentication for viewing post media
DROP POLICY IF EXISTS "Anyone can view post media" ON storage.objects;

CREATE POLICY "Authenticated users can view post media"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'posts');