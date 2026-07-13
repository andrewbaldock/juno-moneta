-- Juno's durable memory: free-text notes she writes and recalls across sessions
-- (design/juno-design-system/05-system-notes.md §4 + §6: juno.remember / juno.recall).
create table juno_notes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now()
);

alter table juno_notes enable row level security;

create policy member_all on juno_notes for all
  using (is_member(household_id)) with check (is_member(household_id));
