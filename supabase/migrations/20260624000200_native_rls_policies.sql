-- feedIn native baseline: row-level security for signed-in mobile users.

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.saved_posts enable row level security;
alter table public.post_comments enable row level security;
alter table public.post_shares enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.live_streams enable row level security;
alter table public.live_spaces enable row level security;

create or replace function public.is_conversation_participant(p_conversation_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = p_conversation_id
      and cp.user_id = auth.uid()
  );
$$;

create policy "Profiles are publicly readable"
on public.profiles for select
using (true);

create policy "Users can insert own profile"
on public.profiles for insert
with check (auth.uid() = id);

create policy "Users can update own profile"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Active posts are publicly readable"
on public.posts for select
using (status = 'active' or auth.uid() = user_id);

create policy "Users can create own posts"
on public.posts for insert
with check (auth.uid() = user_id);

create policy "Users can update own posts"
on public.posts for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own posts"
on public.posts for delete
using (auth.uid() = user_id);

create policy "Likes are readable"
on public.post_likes for select
using (true);

create policy "Users can like as self"
on public.post_likes for insert
with check (auth.uid() = user_id);

create policy "Users can remove own likes"
on public.post_likes for delete
using (auth.uid() = user_id);

create policy "Users can read own saved posts"
on public.saved_posts for select
using (auth.uid() = user_id);

create policy "Users can save as self"
on public.saved_posts for insert
with check (auth.uid() = user_id);

create policy "Users can remove own saves"
on public.saved_posts for delete
using (auth.uid() = user_id);

create policy "Comments are readable"
on public.post_comments for select
using (true);

create policy "Users can comment as self"
on public.post_comments for insert
with check (auth.uid() = user_id);

create policy "Users can update own comments"
on public.post_comments for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own comments"
on public.post_comments for delete
using (auth.uid() = user_id);

create policy "Post shares are readable"
on public.post_shares for select
using (true);

create policy "Users can share as self"
on public.post_shares for insert
with check (auth.uid() = user_id);

create policy "Participants can read conversations"
on public.conversations for select
using (public.is_conversation_participant(conversations.id));

create policy "Authenticated users can create conversations"
on public.conversations for insert
with check (auth.uid() is not null);

create policy "Participants can update conversations"
on public.conversations for update
using (public.is_conversation_participant(conversations.id));

create policy "Users can read own conversation participants"
on public.conversation_participants for select
using (public.is_conversation_participant(conversation_participants.conversation_id));

create policy "Users can add conversation participants"
on public.conversation_participants for insert
with check (auth.uid() is not null);

create policy "Participants can read messages"
on public.messages for select
using (public.is_conversation_participant(messages.conversation_id));

create policy "Participants can send messages"
on public.messages for insert
with check (
  auth.uid() = sender_id
  and public.is_conversation_participant(messages.conversation_id)
);

create policy "Live streams are publicly readable"
on public.live_streams for select
using (true);

create policy "Users can create own live streams"
on public.live_streams for insert
with check (auth.uid() = user_id);

create policy "Users can update own live streams"
on public.live_streams for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Live spaces are publicly readable"
on public.live_spaces for select
using (true);

create policy "Users can create own live spaces"
on public.live_spaces for insert
with check (auth.uid() = user_id);

create policy "Users can update own live spaces"
on public.live_spaces for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
