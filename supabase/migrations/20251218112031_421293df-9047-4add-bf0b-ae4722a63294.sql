-- Drop legacy/unused tables
DROP TABLE IF EXISTS public.refeeds CASCADE;
DROP TABLE IF EXISTS public.trending_posts CASCADE;
DROP TABLE IF EXISTS public.post_analytics CASCADE;

-- Drop comment_reactions if superseded by comment_emoji_reactions
DROP TABLE IF EXISTS public.comment_reactions CASCADE;