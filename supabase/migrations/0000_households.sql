-- Phase 0: household + membership, RLS on from day one.
-- Members can read; no client writes yet (rows are seeded server-side).

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table household_members (
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (household_id, user_id)
);

alter table households enable row level security;
alter table household_members enable row level security;

-- ponytail: user_id = auth.uid() only — a self-join policy on household_members
-- recurses in Postgres RLS. Each member reads their own membership row; enough forever.
create policy "read own membership" on household_members
  for select using (user_id = auth.uid());

create policy "members read household" on households
  for select using (
    id in (select household_id from household_members where user_id = auth.uid())
  );
