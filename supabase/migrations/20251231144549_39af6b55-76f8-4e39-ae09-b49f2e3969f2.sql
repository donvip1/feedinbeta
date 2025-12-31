-- Enable realtime for remaining tables (individually to handle duplicates)
DO $$
BEGIN
  -- profiles
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  -- post_likes
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.post_likes;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  -- hashtags
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.hashtags;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  -- comment_likes
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comment_likes;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  -- comment_emoji_reactions
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comment_emoji_reactions;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  -- conversation_participants
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  -- conversations
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  -- blocked_users
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.blocked_users;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  -- saved_posts
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.saved_posts;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  -- live_space_gifts
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_space_gifts;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  -- live_space_invitations
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_space_invitations;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  -- content_reports
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.content_reports;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  -- creator_monetization
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.creator_monetization;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  -- daily_earnings
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_earnings;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;