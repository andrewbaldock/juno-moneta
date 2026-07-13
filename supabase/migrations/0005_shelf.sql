-- Phase 5: the do-not-touch shelf — liquid savings the household refuses to draw below.
-- One number on the household row; runway and every projection bend around it.

alter table households add column shelf_cents bigint not null default 0;

-- Members may now write the household row (shelf is the only thing the app edits there).
create policy "members update household" on households
  for update using (
    id in (select household_id from household_members where user_id = auth.uid())
  );
