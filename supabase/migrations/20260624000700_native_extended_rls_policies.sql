-- feedIn native baseline: RLS for credits, monetization, P2P, live, gifts, and calls.

alter table public.credit_packages enable row level security;
alter table public.user_credits enable row level security;
alter table public.credit_transactions enable row level security;
alter table public.payment_history enable row level security;
alter table public.subscription_tiers enable row level security;
alter table public.user_subscriptions enable row level security;
alter table public.creator_monetization enable row level security;
alter table public.creator_incentive_tiers enable row level security;
alter table public.creator_payout_requests enable row level security;
alter table public.creator_payouts enable row level security;
alter table public.p2p_payment_methods enable row level security;
alter table public.p2p_user_eligibility enable row level security;
alter table public.p2p_listings enable row level security;
alter table public.p2p_transactions enable row level security;
alter table public.p2p_escrow enable row level security;
alter table public.p2p_payment_proofs enable row level security;
alter table public.p2p_disputes enable row level security;
alter table public.p2p_chat_messages enable row level security;
alter table public.daily_earnings enable row level security;
alter table public.live_stream_viewers enable row level security;
alter table public.live_stream_comments enable row level security;
alter table public.live_stream_reactions enable row level security;
alter table public.live_stream_chat_reactions enable row level security;
alter table public.live_stream_gifts enable row level security;
alter table public.live_stream_invites enable row level security;
alter table public.live_stream_analytics enable row level security;
alter table public.live_space_speakers enable row level security;
alter table public.live_space_messages enable row level security;
alter table public.live_space_message_likes enable row level security;
alter table public.live_space_reactions enable row level security;
alter table public.live_space_invitations enable row level security;
alter table public.live_space_gifts enable row level security;
alter table public.call_logs enable row level security;
alter table public.call_participants enable row level security;
alter table public.call_invites enable row level security;
alter table public.call_signals enable row level security;
alter table public.group_calls enable row level security;
alter table public.group_call_participants enable row level security;
alter table public.gift_appreciation_options enable row level security;
alter table public.gift_analytics enable row level security;

create policy "Active credit packages are readable"
on public.credit_packages for select
using (is_active = true);

create policy "Active subscription tiers are readable"
on public.subscription_tiers for select
using (is_active = true);

create policy "Gift options are readable"
on public.gift_appreciation_options for select
using (is_active = true);

create policy "Users can read own credits"
on public.user_credits for select
using (auth.uid() = user_id);

create policy "Users can read own credit transactions"
on public.credit_transactions for select
using (auth.uid() = user_id);

create policy "Users can read own payment history"
on public.payment_history for select
using (auth.uid() = user_id);

create policy "Users can read own subscriptions"
on public.user_subscriptions for select
using (auth.uid() = user_id);

create policy "Users can read own monetization"
on public.creator_monetization for select
using (auth.uid() = user_id);

create policy "Users can read creator tiers"
on public.creator_incentive_tiers for select
using (is_active = true);

create policy "Users can read own payout requests"
on public.creator_payout_requests for select
using (auth.uid() = user_id);

create policy "Users can create own payout requests"
on public.creator_payout_requests for insert
with check (auth.uid() = user_id);

create policy "Users can read own creator payouts"
on public.creator_payouts for select
using (auth.uid() = user_id);

create policy "Users can manage own p2p payment methods"
on public.p2p_payment_methods for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can read own p2p eligibility"
on public.p2p_user_eligibility for select
using (auth.uid() = user_id);

create policy "Active p2p listings are readable"
on public.p2p_listings for select
using (status = 'active' or auth.uid() = seller_id);

create policy "Users can create own p2p listings"
on public.p2p_listings for insert
with check (auth.uid() = seller_id);

create policy "Users can update own p2p listings"
on public.p2p_listings for update
using (auth.uid() = seller_id)
with check (auth.uid() = seller_id);

create policy "P2P parties can read transactions"
on public.p2p_transactions for select
using (auth.uid() = buyer_id or auth.uid() = seller_id);

create policy "Buyers can create p2p transactions"
on public.p2p_transactions for insert
with check (auth.uid() = buyer_id);

create policy "P2P parties can read escrow"
on public.p2p_escrow for select
using (auth.uid() = buyer_id or auth.uid() = seller_id);

create policy "P2P parties can read proofs"
on public.p2p_payment_proofs for select
using (
  exists (
    select 1 from public.p2p_transactions t
    where t.id = p2p_payment_proofs.transaction_id
      and (t.buyer_id = auth.uid() or t.seller_id = auth.uid())
  )
);

create policy "P2P parties can upload proofs"
on public.p2p_payment_proofs for insert
with check (
  auth.uid() = uploaded_by
  and exists (
    select 1 from public.p2p_transactions t
    where t.id = p2p_payment_proofs.transaction_id
      and (t.buyer_id = auth.uid() or t.seller_id = auth.uid())
  )
);

create policy "P2P parties can read disputes"
on public.p2p_disputes for select
using (
  exists (
    select 1 from public.p2p_transactions t
    where t.id = p2p_disputes.transaction_id
      and (t.buyer_id = auth.uid() or t.seller_id = auth.uid())
  )
);

create policy "P2P parties can create disputes"
on public.p2p_disputes for insert
with check (auth.uid() = initiated_by);

create policy "P2P parties can read chat"
on public.p2p_chat_messages for select
using (
  exists (
    select 1 from public.p2p_transactions t
    where t.id = p2p_chat_messages.transaction_id
      and (t.buyer_id = auth.uid() or t.seller_id = auth.uid())
  )
);

create policy "P2P parties can send chat"
on public.p2p_chat_messages for insert
with check (auth.uid() = sender_id);

create policy "Users can read own daily earnings"
on public.daily_earnings for select
using (auth.uid() = user_id);

create policy "Live stream viewers are readable"
on public.live_stream_viewers for select
using (true);

create policy "Users can join streams as self"
on public.live_stream_viewers for insert
with check (auth.uid() = user_id);

create policy "Live stream comments are readable"
on public.live_stream_comments for select
using (true);

create policy "Users can comment in streams as self"
on public.live_stream_comments for insert
with check (auth.uid() = user_id);

create policy "Live stream reactions are readable"
on public.live_stream_reactions for select
using (true);

create policy "Users can react in streams as self"
on public.live_stream_reactions for insert
with check (auth.uid() = user_id);

create policy "Live stream gifts are readable"
on public.live_stream_gifts for select
using (true);

create policy "Users can send stream gifts as self"
on public.live_stream_gifts for insert
with check (auth.uid() = sender_id);

create policy "Users can read stream invites involving them"
on public.live_stream_invites for select
using (auth.uid() = inviter_id or auth.uid() = invited_user_id);

create policy "Users can create stream invites as self"
on public.live_stream_invites for insert
with check (auth.uid() = inviter_id);

create policy "Live stream analytics are readable"
on public.live_stream_analytics for select
using (true);

create policy "Live space speakers are readable"
on public.live_space_speakers for select
using (true);

create policy "Users can add themselves as speakers"
on public.live_space_speakers for insert
with check (auth.uid() = user_id);

create policy "Live space messages are readable"
on public.live_space_messages for select
using (true);

create policy "Users can message in spaces as self"
on public.live_space_messages for insert
with check (auth.uid() = user_id);

create policy "Live space message likes are readable"
on public.live_space_message_likes for select
using (true);

create policy "Users can like space messages as self"
on public.live_space_message_likes for insert
with check (auth.uid() = user_id);

create policy "Live space reactions are readable"
on public.live_space_reactions for select
using (true);

create policy "Users can react in spaces as self"
on public.live_space_reactions for insert
with check (auth.uid() = user_id);

create policy "Users can read space invitations involving them"
on public.live_space_invitations for select
using (auth.uid() = inviter_id or auth.uid() = invited_user_id);

create policy "Users can create space invitations as self"
on public.live_space_invitations for insert
with check (auth.uid() = inviter_id);

create policy "Live space gifts are readable"
on public.live_space_gifts for select
using (true);

create policy "Users can send space gifts as self"
on public.live_space_gifts for insert
with check (auth.uid() = sender_id);

create policy "Call participants can read call logs"
on public.call_logs for select
using (auth.uid() = caller_id or auth.uid() = receiver_id);

create policy "Users can create calls as caller"
on public.call_logs for insert
with check (auth.uid() = caller_id);

create policy "Call participants can update call logs"
on public.call_logs for update
using (auth.uid() = caller_id or auth.uid() = receiver_id);

create policy "Call participants are readable to members"
on public.call_participants for select
using (
  exists (
    select 1 from public.call_logs c
    where c.id = call_participants.call_id
      and (c.caller_id = auth.uid() or c.receiver_id = auth.uid())
  )
);

create policy "Users can add themselves to calls"
on public.call_participants for insert
with check (auth.uid() = user_id);

create policy "Users can read call invites involving them"
on public.call_invites for select
using (auth.uid() = inviter_id or auth.uid() = invited_user_id);

create policy "Users can create call invites as self"
on public.call_invites for insert
with check (auth.uid() = inviter_id);

create policy "Call signals visible to sender or recipient"
on public.call_signals for select
using (auth.uid() = sender_id or auth.uid() = recipient_id);

create policy "Users can send call signals as self"
on public.call_signals for insert
with check (auth.uid() = sender_id);

create policy "Group calls are readable"
on public.group_calls for select
using (true);

create policy "Users can host group calls"
on public.group_calls for insert
with check (auth.uid() = host_id);

create policy "Group call participants are readable"
on public.group_call_participants for select
using (true);

create policy "Users can join group calls as self"
on public.group_call_participants for insert
with check (auth.uid() = user_id);

create policy "Gift analytics are readable to involved users"
on public.gift_analytics for select
using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "Users can create gift analytics as sender"
on public.gift_analytics for insert
with check (auth.uid() = sender_id);

