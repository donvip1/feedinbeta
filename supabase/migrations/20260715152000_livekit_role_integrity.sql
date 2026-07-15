-- Keep participant identity and invitation state transitions server-owned.

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

  if old.status <> 'pending'
    or new.status not in ('accepted', 'declined')
    or new.responded_at is null then
    raise exception 'Space invitation has already been answered';
  end if;

  return new;
end;
$$;

create or replace function public.prevent_live_space_speaker_reassignment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.space_id is distinct from old.space_id
    or new.user_id is distinct from old.user_id then
    raise exception 'Space participant identity cannot be changed';
  end if;

  if new.role is distinct from old.role
    and not exists (
      select 1 from public.live_spaces space
      where space.id = old.space_id
        and space.user_id = auth.uid()
    )
    and new.role <> 'listener'
    and not (
      new.role = 'speaker'
      and exists (
        select 1
        from public.live_space_invitations invitation
        join public.live_spaces space on space.id = invitation.space_id
        where invitation.space_id = old.space_id
          and invitation.invited_user_id = auth.uid()
          and invitation.status = 'accepted'
          and invitation.inviter_id = space.user_id
      )
    ) then
    raise exception 'Only the space host can change participant roles';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_live_space_speaker_reassignment
  on public.live_space_speakers;
create trigger prevent_live_space_speaker_reassignment
before update on public.live_space_speakers
for each row execute function public.prevent_live_space_speaker_reassignment();

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
    and role in ('listener', 'speaker', 'co_host')
    and (
      role in ('listener', 'co_host')
      or exists (
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
);
