# Juno

Juno is a household-finance app that models a family's whole financial picture — accounts,
debts, every recurring dollar — computes net worth, runway, and debt-payoff dates, and
embeds a Claude-powered advisor that answers what-if questions against the real numbers
with scenario timelines. It also keeps its own ledger: the advisor can add, update, and
correct rows as a conversation establishes new facts, and file "app gap" tasks when the
data model is missing something.

**Live demo:** https://juno-demo.andrewbaldock.com — a fully fictional household, no login.
**Design system:** https://juno.andrewbaldock.com/design — tokens, type, motifs, diagrams, and the live components.

> This is the public source. A private instance runs a real household; that data lives only
> in its database behind auth, never in this repo. Everything household-specific — member
> names, the advisor's tone tuning — is stored in the database (`households.settings`) and
> injected at runtime, so the code carries no personal data.

## What's interesting here

- **An advisor that never does math it can't verify.** Claude returns scenario *deltas*
  (add income, end a flow, pay down a debt early); the local engine (`src/lib/metrics.ts`,
  `src/lib/advisor.ts`) computes every projection, runway, and payoff date. Claude is
  trusted with judgment, never arithmetic — and it never sees raw account numbers, only
  names, amounts, and rates.
- **The model maintains its own data.** A stdio MCP server (`mcp/server.ts`) and the
  advisor's `edits` tool let the LLM read and write the ledger under row-level security —
  add/update rows, keep durable memory notes, and flag missing *features* back to the
  household as tasks. The app can request its own next capability.
- **A data seam for a safe public demo.** The same codebase runs on real data or on a
  fictional household via a demo flag — identical code paths, only the data source differs.
- **Honest-money discipline.** Money is integer cents end to end; `NULL` means *unknown*,
  never zero, and every metric reports what it's missing rather than quietly counting a
  gap as $0.

## Stack & topology

| Piece | What |
|---|---|
| Frontend | Vite + React 19 + TypeScript + Tailwind v4 + Recharts, deployed as a static SPA |
| DB + Auth | Supabase Postgres, email/password auth, row-level security on every table |
| Server code | Two Supabase Edge Functions (Deno): `claude-proxy` (the advisor; JWT-gated, holds the Anthropic key) and `calendar-ics` (an ICS feed) |
| LLM | Claude (Sonnet for advice, Haiku for the health probe); the API key lives only in edge-function secrets, never in the client |

The client does CRUD directly against Supabase under RLS with the publishable (anon) key —
there is no other backend. To run it, create a `.env` with your own Supabase project URL +
anon key:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — how the system fits together (frontend,
  data model, RLS, edge functions, the advisor loop, build & deploy).
- [`docs/compliance.md`](docs/compliance.md) — data inventory, access control, third-party
  processors, and what does / doesn't cross the Anthropic boundary.
- [`docs/architecture.svg`](docs/architecture.svg) — system diagram
  ([`.drawio`](docs/architecture.drawio) source).

## Commands (uses [Bun](https://bun.sh))

```
bun install          # deps
bun run dev          # local dev server
bun test             # unit tests (pure logic — money, metrics, advisor engine)
bun run build        # tsc -b && vite build
```

## Non-negotiable invariants

1. **Money is integer cents (`bigint`) everywhere.** Floats only for display. `src/lib/money.ts` is the only parser/formatter.
2. **NULL means unknown, never zero.** Every metric excludes unknowns and surfaces them as "not entered" pills. Never coerce an unknown to 0.
3. **Base numbers use committed income only.** Hypothetical income stays out of runway/projection baselines; scenarios are the only place it counts.
4. **The advisor NEVER does arithmetic the app can verify.** Claude returns scenario *deltas*; the local engine computes everything, and Claude never sees raw account numbers.
5. **Units at the API boundary are DOLLARS** (`*_usd`, whole dollars) — both the snapshot sent to Claude and scenario deltas. The DB is cents; the client converts defensively (malformed → null, never NaN).
6. **RLS on every table**, keyed through household membership (a SECURITY DEFINER helper — a self-referencing policy would recurse).
7. **Migrations are ADDITIVE.** A deployed frontend must never break against a newer DB: new tables, or nullable/defaulted columns only — never rename, drop, or retype. Per-feature data goes in jsonb bags (`accounts.details`, `households.settings`) rather than a migration per knob.
8. **Every pure module ships with tests.** UI components are verified by browser passes, not mock-heavy tests.

## Data model (see `supabase/migrations/` for the source of truth)

- `households` / `household_members` — a household and its members. `shelf_cents` is the
  *do-not-touch shelf*: a liquid-savings floor every runway figure counts down to (0 =
  plain cash-out). `settings` (jsonb) is the extensible per-household bag — namespaced keys
  like `settings.people`, `settings.advisor_overlay`, `settings.calendar`.
- `accounts` — assets & liabilities. `balance_cents` nullable; `interest_rate` is APR for
  debts / expected growth for assets. `titled_to` powers the trust-funding tracker.
  `details` (jsonb) holds per-type fields (bank/beneficiary, lender/term/escrow, employer/match).
- `balance_snapshots` — append-only history; a trigger writes one whenever a balance
  changes. Powers net-worth-over-time.
- `cash_flows` — income/expenses across cadences (monthly, biweekly, weekly, annual,
  bimonthly, one-time). Flags: `essential` (lean burn), `committed`, `tax_setaside_pct`
  (1099 netting), `account_id` (links a payment to the debt it pays down → real payoff
  dates), plus due-date mechanics (`due_day`, `late_after_days`, `autopay`).
- `conversations` / `messages` — saved advisor chats; assistant messages carry a JSON
  payload (actions, scenario) the UI re-renders on load.
- `juno_notes` — the advisor's durable cross-conversation memory.
- `estate_items` — an estate-documents checklist + trust-funding tracker (will / trust /
  POA / healthcare directive per person), auto-seeded on first visit.

## The engine (`src/lib/`)

- `project()` — month-by-month cash projection. Runway = complete months before cumulative
  cash dips to/below the shelf. Known income end-dates are *in* the projection — runway is
  never a flat extrapolation.
- `netWorthSeries()` — forward-fills latest balances and backfills first-known balances
  (filling in a long-held account is data arrival, not a windfall).
- `applyScenario()` — applies the advisor's deltas to a copy of the flows; targets flows by
  exact name, case-insensitive.
- `timelineEvents()` — income cliffs, payoffs, cash-out, scenario starts → the event
  markers on scenario charts.
- `debtOutlooks()` — amortization with monthly interest, payoff dates, underwater detection.
- LLM-facing dates are always unambiguous (`YYYY-MM` or "Aug 21, 2026"), and today's real
  date is injected into every conversation.

The in-app **Help screen** (`src/screens/Help.tsx`, the `?` in the tab bar) documents the
model for users — including a **design-system page** — and is kept in sync when engine rules
change.

## The advisor service (local MCP)

`mcp/server.ts` is a stdio MCP server that lets an agent read and edit the ledger under RLS.
Money at the tool boundary is dollars (`*_usd`), converted to integer cents internally.
Tools: `juno_state`, `juno_add_row`, `juno_update_row`, `juno_remove_row`, `juno_remember`,
`juno_recall`, `juno_project`, `juno_brief`. Register it for Claude Code with a repo-root
`.mcp.json`:

```json
{ "mcpServers": { "juno": { "command": "bun", "args": ["mcp/server.ts"] } } }
```

## Design notes

- **No hype, no doom.** The advisor is warm, direct, plain English — it leads with the
  biggest lever and lets real numbers do the settling. One design principle, never surfaced
  in the UI: beyond being rigorously truthful, the app aims to steady a household's
  financial anxiety through honest framing only — real distances to feared outcomes,
  benchmarks, next steps — and never announces that it's doing so.
- The visual language (persona, tokens, components, motifs) is documented in the in-app
  design-system page under **Help**.

---

Built by [Andrew Baldock](https://andrewbaldock.com). AI is a force multiplier here;
the architecture and engineering judgment are the point.
