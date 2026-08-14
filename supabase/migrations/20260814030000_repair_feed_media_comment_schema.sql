-- Repair schema drift on projects where the recorded media-filter migration
-- exists but one or both columns were not actually applied.
alter table public.posts
  add column if not exists media_filter_id text,
  add column if not exists media_filter_ids text[] not null default '{}';

alter table public.posts
  drop constraint if exists posts_media_filter_id_check,
  drop constraint if exists posts_media_filter_ids_check;

alter table public.posts
  add constraint posts_media_filter_id_check
  check (
    media_filter_id is null
    or media_filter_id in (
      'original',
      'noir',
      'vintage',
      'golden',
      'cyber',
      'cool',
      'punch',
      'glitch'
    )
  ),
  add constraint posts_media_filter_ids_check
  check (
    media_filter_ids <@ array[
      'original',
      'noir',
      'vintage',
      'golden',
      'cyber',
      'cool',
      'punch',
      'glitch'
    ]::text[]
  );

comment on column public.posts.media_filter_id is
  'Optional Camera Studio color-matrix preset reapplied by Feed clients.';
comment on column public.posts.media_filter_ids is
  'Ordered Camera Studio presets paired with posts.media_urls.';

-- Count all comments, including replies, and repair totals for existing posts.
create or replace function public.sync_post_comments_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts
    set comments_count = comments_count + 1
    where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.posts
    set comments_count = greatest(comments_count - 1, 0)
    where id = old.post_id;
  end if;
  return null;
end;
$$;

update public.posts as post
set comments_count = (
  select count(*)::integer
  from public.post_comments as comment
  where comment.post_id = post.id
);
