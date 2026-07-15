-- Prevent users from escalating themselves to host/speaker roles before
-- requesting a LiveKit publishing token. Space hosts retain moderation rights.

update public.live_space_speakers speaker
set role = 'listener',
    muted = true
where speaker.role in ('host', 'co_host', 'speaker')
  and not exists (
    select 1 from public.live_spaces space
    where space.id = speaker.space_id
      and space.user_id = speaker.user_id
  )
  and not exists (
    select 1
    from public.live_space_invitations invitation
    join public.live_spaces space on space.id = invitation.space_id
    where invitation.space_id = speaker.space_id
      and invitation.invited_user_id = speaker.user_id
      and invitation.status = 'accepted'
      and invitation.inviter_id = space.user_id
  );

drop policy if exists "Users can create space invitations as self"
  on public.live_space_invitations;
create policy "Space hosts can create invitations"
on public.live_space_invitations for insert
with check (
  auth.uid() = inviter_id
  and exists (
    select 1 from public.live_spaces space
    where space.id = live_space_invitations.space_id
      and space.user_id = auth.uid()
  )
);

create or replace function public.prevent_space_invitation_reassignment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.space_id is distinct from old.space_id
    or new.inviter_id is distinct from old.inviter_id
    or new.invited_user_id is distinct from old.invited_user_id then
    raise exception 'Space invitation participants cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_space_invitation_reassignment
  on public.live_space_invitations;
create trigger prevent_space_invitation_reassignment
before update on public.live_space_invitations
for each row execute function public.prevent_space_invitation_reassignment();

drop policy if exists "Invited users can respond to space invitations"
  on public.live_space_invitations;
create policy "Invited users can respond to space invitations"
on public.live_space_invitations for update
using (auth.uid() = invited_user_id)
with check (
  auth.uid() = invited_user_id
  and status in ('accepted', 'declined')
  and responded_at is not null
);

drop policy if exists "Users can add themselves as speakers"
  on public.live_space_speakers;
create policy "Users can join spaces with eligible roles"
on public.live_space_speakers for insert
with check (
  auth.uid() = user_id
  and (
    role = 'listener'
    or (
      role = 'speaker'
      and exists (
        select 1
        from public.live_space_invitations invitation
        join public.live_spaces space on space.id = invitation.space_id
        where invitation.space_id = live_space_speakers.space_id
          and invitation.invited_user_id = auth.uid()
          and invitation.status = 'accepted'
          and invitation.inviter_id = space.user_id
      )
    )
    or (
      role = 'host'
      and exists (
        select 1 from public.live_spaces space
        where space.id = live_space_speakers.space_id
          and space.user_id = auth.uid()
      )
    )
  )
);

drop policy if exists "Space participants can update eligible speaker rows"
  on public.live_space_speakers;
create policy "Space participants can update eligible speaker rows"
on public.live_space_speakers for update
using (
  auth.uid() = user_id
  or exists (
    select 1 from public.live_spaces space
    where space.id = live_space_speakers.space_id
      and space.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.live_spaces space
    where space.id = live_space_speakers.space_id
      and space.user_id = auth.uid()
  )
  or (
    auth.uid() = user_id
    and (
      role = 'listener'
      or (
        role = 'speaker'
        and exists (
          select 1
          from public.live_space_invitations invitation
          join public.live_spaces space on space.id = invitation.space_id
          where invitation.space_id = live_space_speakers.space_id
            and invitation.invited_user_id = auth.uid()
            and invitation.status = 'accepted'
            and invitation.inviter_id = space.user_id
        )
      )
    )
  )
);

drop policy if exists "Users can join group calls as self"
  on public.group_call_participants;
create policy "Group call hosts can admit participants"
on public.group_call_participants for insert
with check (
  exists (
    select 1 from public.group_calls call
    where call.id = group_call_participants.call_id
      and call.host_id = auth.uid()
      and call.status = 'active'
  )
);
