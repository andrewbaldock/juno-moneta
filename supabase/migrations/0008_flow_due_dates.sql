-- Due-date mechanics on recurring flows, groundwork for the Juno Google
-- Calendar (Juno's own calendar; household members subscribe from their own
-- calendars).
--   due_day          day of month it's due (month-based cadences; weekly/biweekly
--                    and one-time flows anchor on start_date instead)
--   late_after_days  grace period: days past due before it counts as late
--   autopay          true = pays itself; calendar shows it FYI instead of alarming
alter table cash_flows add column due_day smallint
  check (due_day between 1 and 31);
alter table cash_flows add column late_after_days smallint
  check (late_after_days >= 0);
alter table cash_flows add column autopay boolean not null default false;
