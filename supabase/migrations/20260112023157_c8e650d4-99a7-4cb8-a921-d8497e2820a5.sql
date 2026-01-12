-- Create call_invites table for shareable call links
CREATE TABLE public.call_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid REFERENCES public.call_logs(id) ON DELETE CASCADE,
  invite_code text UNIQUE NOT NULL,
  created_by uuid NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  used_at timestamptz,
  used_by uuid,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.call_invites ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX idx_call_invites_invite_code ON public.call_invites(invite_code);
CREATE INDEX idx_call_invites_call_id ON public.call_invites(call_id);

-- RLS policies
CREATE POLICY "Users can view invites they created or used"
ON public.call_invites FOR SELECT
USING (auth.uid() = created_by OR auth.uid() = used_by);

CREATE POLICY "Users can create invites"
ON public.call_invites FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update invite they're using"
ON public.call_invites FOR UPDATE
USING (auth.uid() IS NOT NULL AND used_at IS NULL)
WITH CHECK (auth.uid() = used_by);