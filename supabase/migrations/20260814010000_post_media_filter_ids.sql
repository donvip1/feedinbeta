alter table public.posts
  add column if not exists media_filter_ids text[] not null default '{}';

alter table public.posts
  drop constraint if exists posts_media_filter_ids_check;

alter table public.posts
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

comment on column public.posts.media_filter_ids is
  'Ordered Camera Studio presets paired with posts.media_urls.';
