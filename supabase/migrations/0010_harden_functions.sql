-- Supabase security-advisor remediation (2026-07-14).
--
-- Two hardening moves flagged by the linter:
--  1. Pin search_path on the updated-at trigger function (prevents search-path hijack of a
--     function that runs on every write).
--  2. Close the public PostgREST RPC surface on the SECURITY DEFINER trigger functions.
--     Triggers fire with the table owner's rights and never need a direct EXECUTE grant, so
--     revoking it removes the /rest/v1/rpc/... exposure without affecting the triggers.
--
-- Deliberately NOT touched: is_member() keeps EXECUTE for `authenticated` — the RLS policies
-- invoke it, and it only ever reveals the caller's own household membership. Revoking it would
-- break row-level security. (The advisor still lists it; that exposure is required and benign.)

alter function public.touch_updated_at() set search_path = public;

revoke execute on function public.touch_updated_at() from anon, authenticated;
revoke execute on function public.snapshot_balance() from anon, authenticated;
