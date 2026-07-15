-- Temporary product policy: Paystack is purchase-only, while users sell
-- credits through P2P or the finance-team buyback workflow.

update public.subscription_tiers
set is_active = false
where is_active;

revoke execute on function public.request_creator_payout(numeric, text)
  from authenticated;
revoke execute on function public.request_creator_payout(numeric)
  from authenticated;

-- Remove the archived admin path that converted payout approvals back into
-- credits instead of recording a real settlement.
drop function if exists public.process_payout_request(uuid, text, text);
