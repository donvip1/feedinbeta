-- Add foreign key to profiles in message_reactions if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'message_reactions_user_id_fkey' 
        AND table_name = 'message_reactions'
    ) THEN
        ALTER TABLE public.message_reactions
        ADD CONSTRAINT message_reactions_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;
END $$;