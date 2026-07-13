-- Phase 1: the truth goes in. Money is ALWAYS integer cents (bigint), never floats.
-- Blank/unknown = NULL, never 0.

create function is_member(h uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from household_members where household_id = h and user_id = auth.uid()
  )
$$;

create table accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('asset','liability')),
  category text not null,
  balance_cents bigint,          -- null = not entered yet
  interest_rate numeric,         -- annual %, null = unknown/none
  last4 text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table balance_snapshots (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  balance_cents bigint not null,
  as_of_date date not null default current_date,
  source text not null default 'manual',
  created_at timestamptz not null default now()
);

create table cash_flows (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  direction text not null check (direction in ('income','expense')),
  category text not null,
  amount_cents bigint,           -- null = not entered yet
  cadence text not null default 'monthly'
    check (cadence in ('monthly','biweekly','weekly','annual','bimonthly','every_4_months','one_time')),
  start_date date,
  end_date date,
  active boolean not null default true,
  essential boolean not null default false,
  tax_setaside_pct numeric,
  committed boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table accounts enable row level security;
alter table balance_snapshots enable row level security;
alter table cash_flows enable row level security;

create policy member_all on accounts for all
  using (is_member(household_id)) with check (is_member(household_id));

create policy member_all on cash_flows for all
  using (is_member(household_id)) with check (is_member(household_id));

create policy member_all on balance_snapshots for all
  using (is_member((select household_id from accounts a where a.id = account_id)))
  with check (is_member((select household_id from accounts a where a.id = account_id)));

-- Append-only history for free: every balance change writes a snapshot.
create function snapshot_balance() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.balance_cents is not null
     and (tg_op = 'INSERT' or new.balance_cents is distinct from old.balance_cents) then
    insert into balance_snapshots (account_id, balance_cents) values (new.id, new.balance_cents);
  end if;
  return new;
end $$;

create trigger accounts_snapshot after insert or update on accounts
  for each row execute function snapshot_balance();

create function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger accounts_touch before update on accounts
  for each row execute function touch_updated_at();
create trigger cash_flows_touch before update on cash_flows
  for each row execute function touch_updated_at();
