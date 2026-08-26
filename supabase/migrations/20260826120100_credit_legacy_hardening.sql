-- Defense-in-depth for the credit system.
--
-- The live DB is already clean (verified: no legacy balance trigger, no client
-- write policies on balance tables, none of the legacy self-credit functions
-- exist). These statements make that hardened state DETERMINISTIC regardless of
-- provisioning order — every statement below is an idempotent no-op on the
-- current database and only matters if the archived Lovable schema were ever
-- applied underneath.

-- 1) Assert at the table-privilege level that clients can never write balances
--    or the ledger directly (RLS already denies; this is belt-and-suspenders).
revoke insert, update, delete on public.user_credits from authenticated, anon;
revoke insert, update, delete on public.credit_transactions from authenticated, anon;
revoke insert, update, delete on public.platform_wallet from authenticated, anon;

-- 2) Remove known legacy self-credit vectors by name (no-ops if absent):
--    a client-writable ledger insert policy and an AFTER INSERT balance trigger
--    that together would let a user mint credits with a raw ledger insert.
drop policy if exists "Users can insert their own credit transactions" on public.credit_transactions;
drop policy if exists "Users can create their own transactions" on public.credit_transactions;
drop policy if exists "Users can update their own credits" on public.user_credits;
drop policy if exists "Users can insert their own credits" on public.user_credits;
drop trigger if exists update_credit_balance on public.credit_transactions;
drop trigger if exists apply_credit_transaction on public.credit_transactions;
drop trigger if exists trg_apply_credit_transaction on public.credit_transactions;

-- 3) supply_project_wallet is admin-gated internally (can_view_admin_wallet());
--    it never needs to be callable by ordinary clients.
revoke execute on function public.supply_project_wallet(bigint) from authenticated, anon;

notify pgrst, 'reload schema';
