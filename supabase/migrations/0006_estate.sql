-- Phase 7: estate — which documents exist, and what the trust actually owns.
-- Two halves: a documents checklist (estate_items) and a per-account titling
-- column (the trust-funding tracker). A trust that owns nothing routes the
-- whole estate through probate anyway — that gap is the point of this table.

create table estate_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  item_type text not null check (item_type in
    ('will','trust','financial_poa','healthcare_directive','guardianship','other')),
  person text not null,            -- whose document; 'Household' for the shared trust
  status text not null default 'none'
    check (status in ('none','drafted','signed','needs_update')),
  signed_date date,
  location text,                   -- where the paper lives
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table estate_items enable row level security;

create policy member_all on estate_items for all
  using (is_member(household_id)) with check (is_member(household_id));

create trigger estate_items_touch before update on estate_items
  for each row execute function touch_updated_at();

-- How each account is titled. 'beneficiary' = a POD/TOD/named-beneficiary
-- designation keeps it out of probate WITHOUT retitling — the right answer for
-- retirement accounts, which should never be retitled into a living trust.
alter table accounts add column titled_to text not null default 'unknown'
  check (titled_to in ('unknown','individual','joint','trust','beneficiary'));
