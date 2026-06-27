-- =====================================================
-- GROUP INVITE LINKS WITH EXPIRY SYSTEM
-- =====================================================

-- Create table for group invite links
CREATE TABLE IF NOT EXISTS public.group_invite_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
    invite_code TEXT UNIQUE NOT NULL,
    created_by UUID NOT NULL,
    expires_at TIMESTAMPTZ,  -- NULL means never expires
    is_revoked BOOLEAN DEFAULT false,
    max_uses INTEGER,  -- NULL means unlimited uses
    use_count INTEGER DEFAULT 0,
    link_type TEXT DEFAULT 'permanent' CHECK (link_type IN ('permanent', 'temporary')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create table to track who joined via which link
CREATE TABLE IF NOT EXISTS public.group_invite_uses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invite_link_id UUID REFERENCES public.group_invite_links(id) ON DELETE CASCADE NOT NULL,
    user_id UUID NOT NULL,
    used_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.group_invite_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_invite_uses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for group_invite_links
CREATE POLICY "Members can view invite links" ON public.group_invite_links
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.group_members 
        WHERE group_id = group_invite_links.group_id 
        AND user_id = auth.uid()
    )
);

CREATE POLICY "Admins can create invite links" ON public.group_invite_links
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.group_members 
        WHERE group_id = group_invite_links.group_id 
        AND user_id = auth.uid()
        AND role IN ('admin', 'owner', 'moderator')
    )
);

CREATE POLICY "Admins can update invite links" ON public.group_invite_links
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.group_members 
        WHERE group_id = group_invite_links.group_id 
        AND user_id = auth.uid()
        AND role IN ('admin', 'owner', 'moderator')
    )
);

CREATE POLICY "Admins can delete invite links" ON public.group_invite_links
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.group_members 
        WHERE group_id = group_invite_links.group_id 
        AND user_id = auth.uid()
        AND role IN ('admin', 'owner', 'moderator')
    )
);

-- RLS for invite uses tracking
CREATE POLICY "Users can track own invite use" ON public.group_invite_uses
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view invite uses" ON public.group_invite_uses
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.group_invite_links gil
        JOIN public.group_members gm ON gil.group_id = gm.group_id
        WHERE gil.id = group_invite_uses.invite_link_id
        AND gm.user_id = auth.uid()
        AND gm.role IN ('admin', 'owner', 'moderator')
    )
);

-- Function to generate unique invite codes
CREATE OR REPLACE FUNCTION generate_unique_invite_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    result TEXT := '';
    i INT;
BEGIN
    FOR i IN 1..8 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    RETURN result;
END;
$$;

-- Function to join group via invite link
CREATE OR REPLACE FUNCTION public.join_group_via_invite(p_invite_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_invite_link RECORD;
    v_user_id UUID := auth.uid();
    v_is_member BOOLEAN;
    v_result JSONB;
BEGIN
    -- Check if user is authenticated
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    -- Find the invite link
    SELECT * INTO v_invite_link
    FROM public.group_invite_links
    WHERE invite_code = p_invite_code
    AND is_revoked = false
    AND (expires_at IS NULL OR expires_at > now())
    AND (max_uses IS NULL OR use_count < max_uses);

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invite link');
    END IF;

    -- Check if already a member
    SELECT EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_id = v_invite_link.group_id
        AND user_id = v_user_id
    ) INTO v_is_member;

    IF v_is_member THEN
        RETURN jsonb_build_object('success', true, 'group_id', v_invite_link.group_id, 'already_member', true);
    END IF;

    -- Add user to group
    INSERT INTO public.group_members (group_id, user_id, role)
    VALUES (v_invite_link.group_id, v_user_id, 'member');

    -- Track the invite use
    INSERT INTO public.group_invite_uses (invite_link_id, user_id)
    VALUES (v_invite_link.id, v_user_id);

    -- Increment use count
    UPDATE public.group_invite_links
    SET use_count = use_count + 1
    WHERE id = v_invite_link.id;

    -- Update group member count
    UPDATE public.groups
    SET member_count = COALESCE(member_count, 0) + 1
    WHERE id = v_invite_link.group_id;

    RETURN jsonb_build_object('success', true, 'group_id', v_invite_link.group_id, 'already_member', false);
END;
$$;

-- Enable realtime for group messages if not already enabled
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'group_messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
    END IF;
END $$;