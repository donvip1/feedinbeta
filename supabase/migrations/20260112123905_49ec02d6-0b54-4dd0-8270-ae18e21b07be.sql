-- Enhanced P2P Marketplace Database Schema
-- Create tables first, then add policies that reference each other

-- Create p2p_proofs storage bucket if not exists
INSERT INTO storage.buckets (id, name, public) 
VALUES ('p2p-proofs', 'p2p-proofs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for p2p-proofs bucket
CREATE POLICY "Users can upload their own p2p proofs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'p2p-proofs' AND 
  auth.uid() IS NOT NULL
);

CREATE POLICY "Users can view p2p proofs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'p2p-proofs' AND
  auth.uid() IS NOT NULL
);

-- P2P Disputes table (create first so it can be referenced)
CREATE TABLE IF NOT EXISTS public.p2p_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL UNIQUE,
  initiated_by UUID NOT NULL,
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'open',
  resolution TEXT,
  resolution_notes TEXT,
  moderator_id UUID,
  assigned_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  buyer_evidence_urls TEXT[] DEFAULT '{}',
  seller_evidence_urls TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.p2p_disputes ENABLE ROW LEVEL SECURITY;

-- P2P Chat Messages table
CREATE TABLE IF NOT EXISTS public.p2p_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL,
  sender_id UUID NOT NULL,
  content TEXT,
  message_type TEXT DEFAULT 'text',
  media_url TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.p2p_chat_messages ENABLE ROW LEVEL SECURITY;

-- P2P Moderators table
CREATE TABLE IF NOT EXISTS public.p2p_moderators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  total_disputes_handled INTEGER DEFAULT 0,
  avg_resolution_time_hours DECIMAL(10,2),
  rating DECIMAL(3,2) DEFAULT 5.00,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.p2p_moderators ENABLE ROW LEVEL SECURITY;

-- P2P Payment Proofs table
CREATE TABLE IF NOT EXISTS public.p2p_payment_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL,
  uploaded_by UUID NOT NULL,
  proof_type TEXT DEFAULT 'payment',
  file_url TEXT NOT NULL,
  file_type TEXT,
  description TEXT,
  verified BOOLEAN DEFAULT false,
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.p2p_payment_proofs ENABLE ROW LEVEL SECURITY;

-- P2P Seller Payment Methods table
CREATE TABLE IF NOT EXISTS public.p2p_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  method_type TEXT NOT NULL,
  method_name TEXT NOT NULL,
  account_details JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.p2p_payment_methods ENABLE ROW LEVEL SECURITY;

-- Now add RLS policies that may reference other tables

-- RLS for p2p_chat_messages
CREATE POLICY "P2P chat participants can view messages"
ON public.p2p_chat_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM p2p_transactions t
    WHERE t.id = p2p_chat_messages.transaction_id
    AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM p2p_disputes d
    WHERE d.transaction_id = p2p_chat_messages.transaction_id
    AND d.moderator_id = auth.uid()
  )
);

CREATE POLICY "P2P chat participants can send messages"
ON public.p2p_chat_messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id AND
  EXISTS (
    SELECT 1 FROM p2p_transactions t
    WHERE t.id = p2p_chat_messages.transaction_id
    AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
  )
);

CREATE POLICY "Users can update own p2p chat messages"
ON public.p2p_chat_messages FOR UPDATE
USING (auth.uid() = sender_id);

-- RLS for p2p_disputes
CREATE POLICY "P2P dispute participants can view"
ON public.p2p_disputes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM p2p_transactions t
    WHERE t.id = p2p_disputes.transaction_id
    AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
  )
  OR p2p_disputes.moderator_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'moderator'::app_role)
);

CREATE POLICY "P2P dispute participants can create"
ON public.p2p_disputes FOR INSERT
WITH CHECK (
  auth.uid() = initiated_by AND
  EXISTS (
    SELECT 1 FROM p2p_transactions t
    WHERE t.id = p2p_disputes.transaction_id
    AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
    AND t.status NOT IN ('completed', 'cancelled')
  )
);

CREATE POLICY "P2P dispute participants can update"
ON public.p2p_disputes FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM p2p_transactions t
    WHERE t.id = p2p_disputes.transaction_id
    AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
  )
  OR p2p_disputes.moderator_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'moderator'::app_role)
);

-- RLS for p2p_moderators
CREATE POLICY "Anyone can view active p2p moderators"
ON public.p2p_moderators FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage p2p moderators"
ON public.p2p_moderators FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS for p2p_payment_proofs
CREATE POLICY "P2P proof participants can view"
ON public.p2p_payment_proofs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM p2p_transactions t
    WHERE t.id = p2p_payment_proofs.transaction_id
    AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM p2p_disputes d
    WHERE d.transaction_id = p2p_payment_proofs.transaction_id
    AND d.moderator_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'moderator'::app_role)
);

CREATE POLICY "P2P proof participants can upload"
ON public.p2p_payment_proofs FOR INSERT
WITH CHECK (
  auth.uid() = uploaded_by AND
  EXISTS (
    SELECT 1 FROM p2p_transactions t
    WHERE t.id = p2p_payment_proofs.transaction_id
    AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
  )
);

-- RLS for p2p_payment_methods
CREATE POLICY "Users manage own p2p payment methods"
ON public.p2p_payment_methods FOR ALL
USING (auth.uid() = user_id);

-- Add new columns to p2p_listings
ALTER TABLE public.p2p_listings 
ADD COLUMN IF NOT EXISTS payment_method_id UUID,
ADD COLUMN IF NOT EXISTS min_amount INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS max_amount INTEGER,
ADD COLUMN IF NOT EXISTS payment_window_minutes INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS terms TEXT,
ADD COLUMN IF NOT EXISTS auto_reply TEXT;

-- Add new columns to p2p_transactions
ALTER TABLE public.p2p_transactions 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS dispute_id UUID,
ADD COLUMN IF NOT EXISTS chat_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS buyer_confirmed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS seller_confirmed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT now();

-- Add new columns to p2p_escrow
ALTER TABLE public.p2p_escrow 
ADD COLUMN IF NOT EXISTS locked_by UUID,
ADD COLUMN IF NOT EXISTS dispute_id UUID,
ADD COLUMN IF NOT EXISTS platform_fee INTEGER DEFAULT 0;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_p2p_chat_messages_transaction 
ON public.p2p_chat_messages(transaction_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_p2p_disputes_status 
ON public.p2p_disputes(status);

CREATE INDEX IF NOT EXISTS idx_p2p_disputes_moderator 
ON public.p2p_disputes(moderator_id);

CREATE INDEX IF NOT EXISTS idx_p2p_payment_proofs_transaction 
ON public.p2p_payment_proofs(transaction_id);

-- Enable realtime for P2P chat
ALTER PUBLICATION supabase_realtime ADD TABLE public.p2p_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.p2p_disputes;

-- Function to auto-assign moderator to dispute
CREATE OR REPLACE FUNCTION public.assign_dispute_moderator()
RETURNS TRIGGER AS $$
DECLARE
  available_moderator UUID;
BEGIN
  SELECT m.user_id INTO available_moderator
  FROM p2p_moderators m
  WHERE m.is_active = true
  AND m.user_id != NEW.initiated_by
  AND NOT EXISTS (
    SELECT 1 FROM p2p_transactions t
    WHERE t.id = NEW.transaction_id
    AND (t.buyer_id = m.user_id OR t.seller_id = m.user_id)
  )
  ORDER BY (
    SELECT COUNT(*) FROM p2p_disputes d 
    WHERE d.moderator_id = m.user_id 
    AND d.status IN ('open', 'under_review')
  ) ASC, m.rating DESC
  LIMIT 1;
  
  IF available_moderator IS NOT NULL THEN
    NEW.moderator_id := available_moderator;
    NEW.assigned_at := now();
    NEW.status := 'under_review';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS auto_assign_moderator ON public.p2p_disputes;
CREATE TRIGGER auto_assign_moderator
  BEFORE INSERT ON public.p2p_disputes
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_dispute_moderator();

-- Function to update transaction status when dispute is created
CREATE OR REPLACE FUNCTION public.update_transaction_on_dispute()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE p2p_transactions
  SET status = 'disputed',
      dispute_id = NEW.id,
      last_activity_at = now()
  WHERE id = NEW.transaction_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS transaction_dispute_trigger ON public.p2p_disputes;
CREATE TRIGGER transaction_dispute_trigger
  AFTER INSERT ON public.p2p_disputes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_transaction_on_dispute();