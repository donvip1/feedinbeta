-- feedIn native baseline: storage and realtime setup.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-media',
  'post-media',
  true,
  104857600,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read post media" on storage.objects;
create policy "Public can read post media"
on storage.objects for select
using (bucket_id = 'post-media');

drop policy if exists "Authenticated users can upload own post media" on storage.objects;
create policy "Authenticated users can upload own post media"
on storage.objects for insert
with check (
  bucket_id = 'post-media'
  and auth.role() = 'authenticated'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can update own post media" on storage.objects;
create policy "Users can update own post media"
on storage.objects for update
using (
  bucket_id = 'post-media'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'post-media'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can delete own post media" on storage.objects;
create policy "Users can delete own post media"
on storage.objects for delete
using (
  bucket_id = 'post-media'
  and auth.uid()::text = (storage.foldername(name))[1]
);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'posts'
    ) then
      alter publication supabase_realtime add table public.posts;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'messages'
    ) then
      alter publication supabase_realtime add table public.messages;
    end if;
  end if;
end $$;
