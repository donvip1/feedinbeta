-- Public `story-audio` bucket for audio-note + music stories (plan.md §C).
--
-- Story audio (a recorded note or an attached ≤4-min track) is stored here and
-- its public URL written to `stories.music_url`. The story cover image already
-- goes to the public `post-media` bucket. The existing `message-media` bucket
-- allows audio but is PRIVATE (messaging-scoped), so stories — which are
-- publicly viewable — need their own public audio bucket.
--
-- Upload path convention (features/create/story_publisher.dart):
--   <userId>/stories/audio_<ts>_<uuid>.<ext>
-- so folder[1] is the owner id, matching the owner-write policies below.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'story-audio',
  'story-audio',
  true,
  52428800,
  array[
    'audio/aac',
    'audio/mpeg',
    'audio/mp4',
    'audio/ogg',
    'audio/wav',
    'audio/x-m4a'
  ]::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Publicly readable (stories are public).
drop policy if exists "Public can read story audio" on storage.objects;
create policy "Public can read story audio"
on storage.objects for select
using (bucket_id = 'story-audio');

-- Owners upload under their own <userId>/ prefix.
drop policy if exists "Users can upload own story audio" on storage.objects;
create policy "Users can upload own story audio"
on storage.objects for insert
with check (
  bucket_id = 'story-audio'
  and auth.role() = 'authenticated'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can update own story audio" on storage.objects;
create policy "Users can update own story audio"
on storage.objects for update
using (
  bucket_id = 'story-audio'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'story-audio'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can delete own story audio" on storage.objects;
create policy "Users can delete own story audio"
on storage.objects for delete
using (
  bucket_id = 'story-audio'
  and auth.uid()::text = (storage.foldername(name))[1]
);
