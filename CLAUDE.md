# Juno

Read `README.md` first — the invariants there are law. The ones that bite hardest:

- Money is integer cents; NULL means unknown, never zero.
- The advisor never does arithmetic the app can verify; dollars at the API boundary.
- Every date an LLM sees must be unambiguous (YYYY-MM or "Aug 21, 2026" — never "Jul 26").
- **Migrations are additive, always:** deployed frontends must keep working against a newer
  DB — new tables or nullable/defaulted columns only. New per-feature data goes in the jsonb
  bags (`accounts.details`, `households.settings`) when the engine doesn't compute on it.
- **Docs move with the code, in the same commit:** any meaningful change updates BOTH
  `README.md` and the in-app Help screen (`src/screens/Help.tsx`) before the work is done.
- **Nothing household-specific in code.** Member names and the advisor's tone tuning live in
  the database (`households.settings.people` / `.advisor_overlay`) and are injected at
  runtime. Never hardcode a real person, balance, or institution.

Workflow: Bun only (no npm/node). `bun test` gates every deploy. Frontend is a static SPA;
the two edge functions (`claude-proxy`, `calendar-ics`) deploy via the Supabase CLI with a
personal access token and your own project ref.
