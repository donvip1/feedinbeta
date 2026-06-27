-- Add posts.privacy and make reads privacy-aware without enabling social graph access yet.

alter table public.posts
add column if not exists privacy text;

update public.posts
set privacy = case
  when privacy is null or btrim(privacy) = '' then 'everyone'
  when privacy in ('everyone', 'public') then 'everyone'
  when privacy in ('friends', 'followers') then privacy
  when privacy in ('only_me', 'private') then 'only_me'
  else 'only_me'
end;

alter table public.posts
alter column privacy set default 'everyone';

alter table public.posts
alter column privacy set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.posts'::regclass
      and conname = 'posts_privacy_check'
  ) then
    alter table public.posts
    add constraint posts_privacy_check
    check (privacy in ('everyone', 'friends', 'followers', 'only_me'));
  end if;
end $$;

drop policy if exists "Active posts are publicly readable" on public.posts;
drop policy if exists "Privacy-aware active posts are readable" on public.posts;

create policy "Privacy-aware active posts are readable"
on public.posts for select
using (
  auth.uid() = user_id
  or (
    status = 'active'
    and coalesce(privacy, 'everyone') = 'everyone'
  )
);
