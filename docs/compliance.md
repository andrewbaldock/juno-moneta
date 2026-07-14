# Juno — Data Protection & Compliance

Juno handles sensitive household financial data. This document inventories that data, where
it lives, who can reach it, and which third parties process it — so the security and privacy
posture is explicit rather than assumed. It is written against the actual code
(`supabase/migrations/`, the two edge functions, `src/lib/`); when they change, this doc
changes with them.

**Nature of the app.** Juno is a *personal / single-household* financial planner. It stores
**no bank credentials, no full account numbers, no payment card data, and moves no money.**
All financial data is **manually entered** by the household. It is not a bank, broker, or
regulated financial institution, and it does not connect to any bank via aggregation
(Plaid etc.). It runs as one private instance for a real household plus a public source
repo carrying a fictional demo.

## 1. Data inventory & classification

| Data | Where stored | Sensitivity |
|---|---|---|
| Email + password | Supabase Auth (`auth.users`, GoTrue) — password is bcrypt-hashed, never in app tables | High (credential) |
| Account balances, interest rates | `accounts.balance_cents`, `.interest_rate`, `balance_snapshots` | High (financial) |
| Partial account identifier | `accounts.last4` (last 4 digits only — never a full number) | Medium |
| Institution / account details | `accounts.details` (jsonb): bank, lender, employer, beneficiary, address, etc. | High (financial + PII) |
| Income & expenses | `cash_flows` (names, amounts, cadence, due dates) | High (financial) |
| Estate documents | `estate_items` (will/trust/POA status, signed dates, **physical location of documents**) | High (sensitive) |
| Member identities & tone tuning | `households.settings` (jsonb): `people`, `advisor_overlay` | Medium (PII) |
| Advisor conversations | `conversations`, `messages` (free text + jsonb payloads) | High (may contain anything the user typed) |
| Advisor durable memory | `juno_notes` (free-text notes Juno keeps across sessions) | Medium |
| UI preferences | Browser `localStorage` (`juno.*`: column widths, dark mode, dismissed tasks) | Low — **no financial data, no secrets** |

**No personal or household data lives in the source repository.** Member names, balances,
and institutions are all in the database and injected at runtime; the code carries none.
This is a hard rule (see `CLAUDE.md`).

## 2. Storage & residency

- **All application data:** a single Supabase Postgres project (region **East US (Ohio),
  `us-east-2`**). Encryption at rest and in transit is provided by Supabase; all client
  traffic is HTTPS.
- **Auth data:** Supabase GoTrue (same project). Passwords are hashed; Juno never sees or
  stores plaintext passwords.
- **Client:** `localStorage` holds only UI preferences and task-dismissal flags. The
  Supabase session (JWT/refresh token) is managed by `@supabase/supabase-js` in browser
  storage per its defaults — this is a session token scoped by RLS, not financial data.

## 3. Access control

### Authentication
- Email/password via Supabase Auth. Minimum 8-character password (enforced client-side in
  the password form). Password reset by email (`resetPasswordForEmail`) and an in-app
  password-recovery flow (`updateUser`).
- Auth redirect **Site URL / Redirect URLs** are configured in Supabase to
  `https://juno.andrewbaldock.com` (+ `localhost:5181` for dev). These gate where recovery
  links may land.

### Authorization — Row-Level Security
- **RLS is enabled on every table.** No table is world-readable.
- Access is scoped to **household membership**, resolved by a `SECURITY DEFINER` helper
  `is_member(household_id)`. A signed-in user can only read/write rows belonging to a
  household they are a member of (`household_members`). Child tables
  (`balance_snapshots`, `messages`) inherit the check through their parent.
- **Key model / least privilege:**
  - The **publishable (anon) key** ships in the client. It is safe *because RLS is the
    boundary* — the key alone grants nothing without a valid member JWT.
  - The **service-role key** (bypasses RLS) exists only inside Edge Function secrets, never
    in the client or repo.
  - The **Anthropic API key** exists only inside the `claude-proxy` Edge Function secret.

## 4. Third-party processors (subprocessors)

| Processor | What it receives | Notes |
|---|---|---|
| **Supabase** | All application data + auth (the full dataset above) | Primary data processor; hosts DB, auth, and edge functions |
| **Vercel** | Static frontend assets only | Serves the JS/HTML bundle. **No user financial data passes through Vercel** — the browser talks to Supabase directly. Also the CI/CD host (builds from GitHub). |
| **Anthropic (Claude API)** | The advisor snapshot + conversation text (see §5) | Called *only* server-side by `claude-proxy`; the client never contacts Anthropic directly |
| **GitHub** | Source code only (public repo) | No secrets, no personal data — `.env` and `.vercel` are gitignored |

## 5. What crosses the Anthropic boundary (the key data-sharing surface)

The advisor is the one place household data leaves Supabase to a third party. It is
deliberately minimized:

**Sent to Claude** (via `claude-proxy`, per `buildSnapshot`):
- Account and cash-flow **names**, **amounts and rates in whole dollars**, dates, and
  gap/estate **summaries**.
- The conversation history (what the user typed).
- Recent `juno_notes` (durable memory) and the `settings.advisor_overlay` household context.

**Never sent to Claude:**
- Raw integer-cents values, `accounts.last4`, or the `accounts.details` jsonb (bank names,
  beneficiaries, addresses).
- Any auth credential or key.

Amounts are rounded to whole dollars at the boundary by design ("units at the API boundary
are dollars"). Requests use ephemeral prompt caching; under Anthropic's commercial API
terms, API inputs are not used to train models. If the advisor persona or `buildSnapshot`
changes what it includes, update this section in the same commit.

## 6. The calendar feed — a bearer-token exposure to be aware of

`calendar-ics` serves an ICS feed authenticated **only by an unguessable UUID token in the
URL** (`verify_jwt` is off so Google/Apple Calendar can fetch it anonymously). Anyone
holding that URL can read the household's **bill names, amounts, and due dates** (not
balances, not account numbers). This is an intentional capability-URL tradeoff for calendar
subscription. Controls:
- The token is a random UUID stored at `households.settings.calendar.token`.
- **Revocation = rotation:** change that value (and the `ics_url` beside it) and the old
  URL 404s.
- Treat the feed URL as a shared secret; don't post it publicly.

## 7. Data integrity & assurance controls

Financial-correctness controls that matter for a money app's trustworthiness:
- **Integer cents end to end**; floats only for display (`money.ts` is the sole parser).
- **`NULL` = unknown, never zero** — metrics exclude unknowns and surface them, never
  silently counting a gap as $0.
- **The advisor never does arithmetic the app can verify** — Claude emits deltas; the local
  engine computes every projection, so advice can't be numerically wrong in a way the app
  wouldn't catch.
- **Append-only balance history** (`balance_snapshots`, trigger-written) — an audit trail of
  every balance change.
- **Additive-only migrations** — a deployed client never breaks against a newer DB.

## 8. Retention & deletion

- Deletion cascades on `household_id` / parent FKs: removing a household removes all its
  accounts, flows, conversations, notes, and estate items. Removing an account removes its
  snapshots; removing a conversation removes its messages.
- Users delete their own rows directly (screens support delete). There is **no automated
  retention or scheduled purge** — data persists until deleted. Conversations and advisor
  memory (`juno_notes`) are retained until manually removed.

## 9. Regulatory posture

- **Out of scope:** PCI-DSS (no card data), GLBA safeguards as a financial institution (Juno
  is not one; no aggregation, no funds movement), and bank-credential handling (none stored).
  Only `last4` is kept — never a full PAN or account number.
- **The advisor is informational, not fiduciary.** It surfaces the user's own numbers and
  general framing, states it is "not a lawyer" on legal questions, and makes no trades or
  transactions.
- **Privacy law:** as a single private household it is largely personal-use. The owner is in
  California (CCPA-aware). If Juno were ever operated as a multi-tenant service for other
  people's data, it would need: documented data-subject access/erasure, processor
  agreements (DPAs) with Supabase/Vercel/Anthropic, and a public privacy policy.

## 10. Known gaps / roadmap

- **No automated erasure/retention workflow** — deletion is manual/cascade only.
- **No access audit log** beyond `balance_snapshots` (which tracks value changes, not reads).
- **ICS bearer-URL exposure** (§6) — mitigated only by token rotation.
- **Multi-state law expansion will add address/state PII.** Generalizing `law.ts` beyond
  California requires storing the household's address(es) — a new sensitive field that should
  be classified High and covered by the same RLS model. *On the roadmap;* see
  [`architecture.md`](architecture.md).
