-- Add post_type and original_post_id to posts if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'posts' 
                 AND column_name = 'post_type') THEN
    ALTER TABLE public.posts ADD COLUMN post_type text DEFAULT 'regular';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'posts' 
                 AND column_name = 'original_post_id') THEN
    ALTER TABLE public.posts ADD COLUMN original_post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_posts_original_post_id ON public.posts(original_post_id);
CREATE INDEX IF NOT EXISTS idx_posts_post_type ON public.posts(post_type);