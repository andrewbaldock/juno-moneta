-- Per-type account details: a bank row wants its bank and POD beneficiary, a
-- mortgage wants lender/term/escrow, a 401k wants employer/match/beneficiary.
-- One jsonb bag; the per-category field list lives in src/lib/types.ts
-- (ACCOUNT_DETAIL_FIELDS). Display-grade strings ONLY — the engine never does
-- arithmetic on these (invariant #1 money stays in the _cents columns).
alter table accounts add column details jsonb not null default '{}'::jsonb;
