-- Enable real-time for call-related tables
-- Using DO block to check before adding to avoid errors

DO $$
BEGIN
  -- Add call_signals if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'call_signals'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.call_signals;
  END IF;
  
  -- Add call_participants if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'call_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.call_participants;
  END IF;
  
  -- Add call_logs if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'call_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.call_logs;
  END IF;
END $$;