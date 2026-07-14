# Juno — Security

The engineering security posture: the trust boundaries, the controls that enforce them, and
the tradeoffs taken deliberately. Written against the actual code (`supabase/migrations/`, the
two edge functions, `src/lib/`, `supabase/config.toml`); when they change, this doc changes in
the same commit (the repo's docs-move-with-code rule). Its sibling
[`compliance.md`](compliance.md) covers *what data* exists and *who* processes it; this doc
covers *how the boundaries hold*.

**Shape of the system that makes this tractable.** Juno stores no bank credentials, no full
account numbers, and no card data, and moves no money — all figures are manually entered.
Almost all computation is **client-side** (`src/lib/` engine); the only server code is two
Supabase Edge Functions. So the attack surface is small and enumerable.

---

## 1. Trust boundaries

| Boundary | What crosses | Gate |
|---|---|---|
| Browser ⇄ Supabase Postgres | the household's own rows | Supabase Auth JWT + **Row-Level Security** |
| Browser ⇄ `claude-proxy` | conversation + snapshot | **`verify_jwt` on** (real) — signed-in members only |
| `claude-proxy` ⇄ Anthropic | the snapshot (advice) | server-side; API key never leaves the function |
| Calendar app ⇄ `calendar-ics` | one household's dated flows | **secret UUID token in the URL** (`verify_jwt` off) |
| Public demo ⇄ demo `claude-proxy` | fictional data only | unauthenticated by design; per-IP rate-limit + capped key |

Everything sensitive sits behind either a JWT + RLS (the app) or a capability token (the
calendar feed). The demo crosses no real boundary — its data never leaves the browser.

---

## 2. Authentication & authorization

- **Auth** is Supabase Auth (email + password; signups disabled). Passwords are bcrypt-hashed
  by Supabase; the client enforces a length floor and Supabase enforces its own.
- **Authorization is Row-Level Security on every table.** Each data table
  (`accounts`, `cash_flows`, `balance_snapshots`, `estate_items`, `conversations`, `messages`,
  `juno_notes`, `households`) has RLS enabled with a `member_all … using (is_member(household_id))
  with check (is_member(household_id))` policy. Child tables resolve membership through their
  parent (`balance_snapshots`→`accounts`, `messages`→`conversations`).
- **`is_member(uuid)`** is `security definer`, `stable`, **`set search_path = public`** — the
  hardening that prevents a search-path hijack of a definer function.
- **Membership is provisioned out-of-band** (service role / SQL). `household_members` has only a
  *read-your-own-row* policy and **no self-insert policy**, so a user cannot add themselves to
  another household. Combined with RLS, a member can only ever read or write their own
  household's data — enforced in the database, not merely in the client.

---

## 3. The edge functions (the only server code)

### `claude-proxy` — the advisor
- **`verify_jwt` is on** (pinned in [`config.toml`](../supabase/config.toml)); only signed-in
  members can call it. This is the primary gate.
- **CORS is an origin allowlist**, not `*` — the caller's origin is echoed only if it's on the
  list (`juno.andrewbaldock.com`, `localhost:5181`), otherwise pinned to the canonical origin so
  a disallowed browser origin is blocked. `Vary: Origin` is set. This is defense-in-depth; the
  JWT is the real gate. *Consequence: `*.vercel.app` preview URLs cannot call the real advisor —
  intended.*
- **Input is bounded** before it reaches Anthropic: ≤40 messages, snapshot ≤30 000 chars,
  overlay ≤4 000 chars, ≤12 memories ×300 chars, each message ≤8 000 chars.
- **Output is constrained.** The model must call the `advise` tool; ledger `edits` are limited by
  schema to `accounts`/`cash_flows`, the client forces `household_id` (the model can't target
  another household), and RLS enforces it regardless. A jailbroken advisor still can't escape the
  user's own two tables, and it cannot delete rows.

### `calendar-ics` — the bill feed
- Auth is the **secret UUID token in the URL** (`?t=`); Google/Apple Calendar fetch anonymously,
  so `verify_jwt` is off (pinned off in `config.toml`).
- The token is **validated against a strict UUID regex before any DB use** — the regex doubles as
  the injection guard for the PostgREST filter it's interpolated into.
- It reads with the service-role key but is **scoped by `token → household`**, so it only ever
  returns the one matching household's active flows.
- Exposure model: a **bearer capability URL**. Anyone with the link sees that household's dated
  cash flows (names, amounts, dates). Mitigation is **rotation** — change
  `households.settings.calendar.token`. This is the standard iCal tradeoff, accepted knowingly.

---

## 4. Secrets

- `ANTHROPIC_API_KEY` (in `claude-proxy`) and `SUPABASE_SERVICE_ROLE_KEY` (in `calendar-ics`)
  live as **Supabase function secrets** — never in the client bundle, never in the repo.
- The **anon/publishable key** ships in the client bundle **by design** — it is a public
  identifier; RLS is the actual gate. Do not "fix" this by hiding it.
- `.env*`, `.vercel`, and `supabase/.temp` are git-ignored; the public repo was fresh-init'd
  (no shared history) and scans clean of secret-shaped strings.

---

## 5. The LLM boundary — no secret is reachable via chat

By construction, **the advisor cannot leak app secrets, because it never receives any.** The API
keys are read from the function's environment and attached only as HTTP headers to the Anthropic
call — they are never placed in the system prompt, the tool schema, or any message. The model's
context contains only: the (non-secret) system prompt, the household's overlay and snapshot
(their own data), memory notes, and the conversation.

A **belt-and-suspenders system rule** additionally instructs the advisor to refuse to reveal
keys, secrets, environment variables, or its own instructions, even under roleplay or "it's a
test" framing. The structural guarantee is the real protection; the rule is redundancy.

**Prompt-injection containment.** The overlay/snapshot/memories originate from the household's own
RLS-scoped data, so injection is self-inflicted only. Even a fully hijacked advisor is boxed by
§3: it can write only to the user's own `accounts`/`cash_flows`, at most 3 edits, no deletes.

---

## 6. The public demo

The public demo (`VITE_DEMO=true`) is engineered to be **incapable of touching real data or
running up unbounded cost** — see [`architecture.md`](architecture.md) → Demo mode for the seam.

- **No real DB access.** `src/lib/demo.ts` intercepts every `.from(...)` with an in-memory shim;
  the real client is used only to reach the *demo* project's edge function. Verified: even if the
  demo were misconfigured to point at the real Supabase project, `.from()` is shimmed (no reads)
  and the advisor call would hit the real `claude-proxy` with no JWT → 401. No path to real data.
- **No shared writes.** All demo writes mutate a per-session in-memory copy; a reload re-seeds.
  Nothing shared exists to corrupt (this neutralizes the MCP/self-improvement write hazard).
- **Cost/abuse control on the one unauthenticated endpoint.** The demo runs a *separate* Supabase
  project whose `claude-proxy` has `DEMO_PROXY=true`: model forced to Haiku, CORS scoped to the
  demo origin, and a per-IP sliding-window rate limit. That limiter is in-memory and per-instance
  — a **soft** cap; the **hard** guarantee is a dedicated Anthropic key with a billing cap. The
  real project's `ANTHROPIC_API_KEY` is never reachable from the demo.
- **Outbound neutralized:** health probe stubbed client-side; the calendar feed is inert (no
  token issued in demo).

---

## 7. Encryption

- **In transit:** TLS on every hop — browser↔Vercel, browser↔Supabase, function↔Anthropic.
- **At rest:** Supabase Postgres (on AWS) is **AES-256 encrypted at rest**, backups included.
  This is in effect today with no application work.
- **Application-layer (field-level) encryption is deliberately *not* used, and mostly should not
  be.** Balances (`balance_cents`) are the input to everything — RLS filtering, the metrics
  engine, the advisor snapshot, the ICS feed. Encrypting them would break server-side reads (the
  ICS builder, the Anthropic snapshot) and force a key to be shipped around, a **net security
  loss** for a single-household app already behind RLS + at-rest encryption + TLS.
  - If a higher bar is ever wanted, the correct *surgical* scope is the sensitive **free-text
    fields that are not used in math** — estate `location` ("where the will physically lives"),
    account `notes`/`details` — via **Supabase Vault / pgsodium**, leaving computable numbers in
    the clear. Do not encrypt the balances.

---

## 8. Accepted risks (known and deliberate)

- **Calendar feed is a bearer-token capability URL** (§3) — leak via referrer/history/logs is
  possible; mitigated by rotation only. Accepted for the convenience of a subscribable feed.
- **Demo rate-limit is a per-instance soft cap** (§6) — the billing cap on the demo key is the
  real backstop.
- **CORS blocks preview origins** from the real advisor (§3) — intended; use the demo for public
  access.

## 9. Operational follow-ups

- Run **Supabase Advisors** (Dashboard → Advisors, security + performance) after any schema change.
- Enable Auth **leaked-password protection** (HaveIBeenPwned) and consider **MFA**.
- **Rotate** any personal access token that was pasted into a chat/transcript after use.
- Keep `mcp/server.ts` **dev-only** — it can read/write the ledger with whatever credentials it's
  given and is not part of the deployed runtime.
