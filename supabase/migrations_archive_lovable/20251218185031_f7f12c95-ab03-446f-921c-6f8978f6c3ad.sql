-- Enable REPLICA IDENTITY FULL for proper real-time updates
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.typing_indicators REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Add message_read_receipts to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_read_receipts;
ALTER TABLE public.message_read_receipts REPLICA IDENTITY FULL;