-- Phase 4: saveable advisor conversations.
create table conversations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  title text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  payload jsonb,  -- assistant extras: actions, scenario
  created_at timestamptz not null default now()
);

alter table conversations enable row level security;
alter table messages enable row level security;

create policy member_all on conversations for all
  using (is_member(household_id)) with check (is_member(household_id));

create policy member_all on messages for all
  using (is_member((select household_id from conversations c where c.id = conversation_id)))
  with check (is_member((select household_id from conversations c where c.id = conversation_id)));

create trigger conversations_touch before update on conversations
  for each row execute function touch_updated_at();
