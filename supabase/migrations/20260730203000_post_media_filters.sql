alter table public.posts
  add column if not exists media_filter_id text;

alter table public.posts
  drop constraint if exists posts_media_filter_id_check;

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
  );

comment on column public.posts.media_filter_id is
  'Optional Camera Studio color-matrix preset reapplied by Feed clients.';
