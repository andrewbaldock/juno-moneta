-- One occurrence of a recurring flow, overridden.
--
-- A cash_flows row is a RULE ("PG&E, ~$207, the 17th"). Real bills don't obey
-- rules — PG&E is $511 in February with the fireplace on and $194 in June. The
-- household ledger people actually keep is the rule plus a pile of per-month
-- corrections, and without somewhere to put those corrections the rule is a lie
-- and the spreadsheet stays open next to the app.
--
--   amount_cents  what it really was that day; null = amount unchanged
--   skipped       it didn't happen at all this cycle (a bill not due, a skipped paycheck)
--   note          why — this is the audit trail for "why is June different"
--
-- The rule stays the source of truth for every date with no override, so a year
-- of corrections never drifts the underlying model.
create table flow_overrides (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references cash_flows(id) on delete cascade,
  occurs_on date not null,
  amount_cents bigint check (amount_cents >= 0),
  skipped boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (flow_id, occurs_on)
);

create index flow_overrides_flow_idx on flow_overrides (flow_id, occurs_on);

alter table flow_overrides enable row level security;

-- Membership rides on the parent flow, the same way balance_snapshots rides on accounts.
create policy member_all on flow_overrides for all
  using (is_member((select household_id from cash_flows f where f.id = flow_id)))
  with check (is_member((select household_id from cash_flows f where f.id = flow_id)));
