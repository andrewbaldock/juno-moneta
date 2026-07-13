-- One extensible settings bag on the household, so new features stop needing a
-- migration per knob. Keys are namespaced objects, e.g.
--   settings.calendar = { embed_url, ics_url }   (the Juno Google Calendar links)
-- Additive and old-frontend-safe: existing code never touches the column.
alter table households add column settings jsonb not null default '{}'::jsonb;
