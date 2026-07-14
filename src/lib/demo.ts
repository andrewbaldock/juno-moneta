// Demo mode: the public, fully-fictional Rivera household anyone can poke.
// Enabled by VITE_DEMO=true. All reads/writes hit an in-memory store seeded
// from a fixture below — nothing touches Supabase, so a visitor can add,
// edit, and delete freely and never corrupt shared data. A reload (or the
// banner's Reset) restores the seed. See docs/architecture.md §demo.
//
// The advisor stays LIVE: functions.invoke('claude-proxy') passes through to
// the ambient project (the separate, rate-limited demo Supabase project in
// the deployed demo). Only the DB layer is faked.
import type { Session } from '@supabase/supabase-js'
import type { HouseholdSettings } from '../copy/juno'

export const DEMO = import.meta.env.VITE_DEMO === 'true'

// A synthetic signed-in user so App can skip the login gate (no real auth in demo).
export const DEMO_SESSION = {
  user: { id: 'demo-user', email: 'maya@rivera.demo' },
} as unknown as Session

const HID = 'demo-household'

// ── The Rivera household fixture ─────────────────────────────────────────────
// Obviously fictional, internally consistent: net worth, monthly in/out, and
// runway all reconcile. Two working parents (Maya, Daniel), two kids (Sofia,
// Leo), a dog (Pepper). Money in cents.
const iso = () => new Date().toISOString()
const monthAgo = (k: number) => {
  const d = new Date()
  d.setMonth(d.getMonth() - k)
  return d.toISOString().slice(0, 10)
}

const acct = (o: Record<string, unknown>): Record<string, unknown> => ({
  household_id: HID, interest_rate: null, last4: null, titled_to: 'unknown',
  details: {}, notes: null, updated_at: iso(), ...o,
})
const flow = (o: Record<string, unknown>): Record<string, unknown> => ({
  household_id: HID, amount_cents: null, cadence: 'monthly', start_date: null, end_date: null,
  active: true, essential: false, tax_setaside_pct: null, committed: true, account_id: null,
  due_day: null, late_after_days: null, autopay: false, notes: null, updated_at: iso(), ...o,
})

function fixture(): Record<string, Record<string, unknown>[]> {
  const accounts = [
    acct({ id: 'a-checking', name: 'Everyday checking', kind: 'asset', category: 'checking', balance_cents: 8_400_00, titled_to: 'joint', details: { institution: 'Meridian Bank', joint_owner: 'Daniel' } }),
    acct({ id: 'a-savings', name: 'Emergency savings', kind: 'asset', category: 'savings', balance_cents: 22_000_00, titled_to: 'joint', details: { institution: 'Meridian Bank' } }),
    acct({ id: 'a-401k-maya', name: 'Maya · 401(k)', kind: 'asset', category: 'retirement', balance_cents: 148_000_00, titled_to: 'beneficiary', details: { institution: 'Fidelity', plan_type: '401k', employer: 'Northwind Labs', beneficiary: 'Daniel' } }),
    acct({ id: 'a-401k-dan', name: 'Daniel · 401(k)', kind: 'asset', category: 'retirement', balance_cents: 96_000_00, titled_to: 'beneficiary', details: { institution: 'Vanguard', plan_type: '401k', employer: 'Cedar & Co', beneficiary: 'Maya' } }),
    acct({ id: 'a-brokerage', name: 'Joint brokerage', kind: 'asset', category: 'brokerage', balance_cents: 34_000_00, titled_to: 'joint', details: { institution: 'Vanguard', beneficiary: 'the kids' } }),
    acct({ id: 'a-529', name: "Kids' 529", kind: 'asset', category: 'brokerage', balance_cents: 18_000_00, titled_to: 'joint', details: { institution: 'ScholarShare' } }),
    acct({ id: 'a-home', name: 'The house', kind: 'asset', category: 'home_value', balance_cents: 610_000_00, titled_to: 'joint', details: { purchase_year: '2019', purchase_price: '465000' } }),
    acct({ id: 'a-car', name: '2021 Highlander', kind: 'asset', category: 'vehicle', balance_cents: 19_500_00, titled_to: 'joint', details: { make_model: 'Toyota Highlander', year: '2021' } }),
    acct({ id: 'l-mortgage', name: 'Mortgage', kind: 'liability', category: 'mortgage', balance_cents: 398_000_00, interest_rate: 6.1, titled_to: 'joint', details: { lender: 'Meridian Home', term_years: '30', matures: '2049' } }),
    acct({ id: 'l-auto', name: 'Auto loan', kind: 'liability', category: 'auto_loan', balance_cents: 17_400_00, interest_rate: 6.9, details: { lender: 'Meridian Auto', matures: '2028' } }),
    acct({ id: 'l-student', name: 'Maya · student loan', kind: 'liability', category: 'student_loan', balance_cents: 21_300_00, interest_rate: 5.2, titled_to: 'individual', details: { servicer: 'FedLoan', loan_type: 'Federal' } }),
    acct({ id: 'l-card', name: 'Rewards card', kind: 'liability', category: 'credit_card', balance_cents: 4_600_00, interest_rate: 22.9, titled_to: 'joint', details: { issuer: 'Meridian Visa', credit_limit: '15000' } }),
  ]

  const cash_flows = [
    flow({ id: 'f-maya-pay', name: 'Maya · salary', direction: 'income', category: 'salary', amount_cents: 6_200_00 }),
    flow({ id: 'f-dan-pay', name: 'Daniel · salary', direction: 'income', category: 'salary', amount_cents: 1_900_00, cadence: 'biweekly' }),
    flow({ id: 'f-dan-gig', name: 'Daniel · design side gig', direction: 'income', category: 'contract', amount_cents: 600_00, tax_setaside_pct: 25 }),
    flow({ id: 'f-mortgage', name: 'Mortgage payment', direction: 'expense', category: 'housing', amount_cents: 2_750_00, essential: true, account_id: 'l-mortgage', due_day: 1, autopay: true }),
    flow({ id: 'f-proptax', name: 'Property tax', direction: 'expense', category: 'property_tax', amount_cents: 7_200_00, cadence: 'annual', essential: true }),
    flow({ id: 'f-utils', name: 'Utilities', direction: 'expense', category: 'utilities', amount_cents: 260_00, essential: true, due_day: 15 }),
    flow({ id: 'f-groceries', name: 'Groceries', direction: 'expense', category: 'groceries', amount_cents: 1_100_00, essential: true, committed: false }),
    flow({ id: 'f-dining', name: 'Dining out', direction: 'expense', category: 'dining', amount_cents: 520_00, committed: false }),
    flow({ id: 'f-auto-pay', name: 'Auto loan payment', direction: 'expense', category: 'debt_payment', amount_cents: 430_00, essential: true, account_id: 'l-auto', due_day: 12, autopay: true }),
    flow({ id: 'f-student-pay', name: 'Student loan payment', direction: 'expense', category: 'debt_payment', amount_cents: 290_00, essential: true, account_id: 'l-student', due_day: 20, autopay: true }),
    flow({ id: 'f-card-pay', name: 'Credit card payment', direction: 'expense', category: 'debt_payment', amount_cents: 250_00, account_id: 'l-card', due_day: 8 }),
    flow({ id: 'f-insurance', name: 'Home & auto insurance', direction: 'expense', category: 'insurance', amount_cents: 340_00, essential: true }),
    flow({ id: 'f-phone', name: 'Phone', direction: 'expense', category: 'phone', amount_cents: 120_00, due_day: 22, autopay: true }),
    flow({ id: 'f-internet', name: 'Internet', direction: 'expense', category: 'internet', amount_cents: 75_00, due_day: 5, autopay: true }),
    flow({ id: 'f-medical', name: 'Health & dental', direction: 'expense', category: 'medical', amount_cents: 180_00, essential: true }),
    flow({ id: 'f-fuel', name: 'Fuel & transit', direction: 'expense', category: 'fuel', amount_cents: 220_00, committed: false }),
    flow({ id: 'f-pets', name: 'Pepper (dog)', direction: 'expense', category: 'pets', amount_cents: 90_00, committed: false }),
    flow({ id: 'f-sub-stream', name: 'Streaming bundle', direction: 'expense', category: 'subscription', amount_cents: 38_00, autopay: true }),
    flow({ id: 'f-sub-music', name: 'Music', direction: 'expense', category: 'subscription', amount_cents: 17_00, autopay: true }),
    flow({ id: 'f-sub-cloud', name: 'Cloud storage', direction: 'expense', category: 'subscription', amount_cents: 10_00, autopay: true }),
    flow({ id: 'f-sub-gym', name: 'Gym', direction: 'expense', category: 'subscription', amount_cents: 75_00, autopay: true }),
    flow({ id: 'f-misc', name: 'Household & misc', direction: 'expense', category: 'misc', amount_cents: 300_00, committed: false }),
  ]

  // Six months of snapshots for the balances that move — a gently rising net-worth line.
  const trended = ['a-checking', 'a-savings', 'a-401k-maya', 'a-401k-dan', 'a-brokerage', 'a-529'] as const
  const balance_snapshots = trended.flatMap((id) => {
    const now = accounts.find((a) => a.id === id)!.balance_cents as number
    return [5, 4, 3, 2, 1, 0].map((k) => ({
      id: `s-${id}-${k}`, account_id: id,
      balance_cents: Math.round(now * (1 - 0.011 * k)),
      as_of_date: monthAgo(k), source: 'manual', created_at: iso(),
    }))
  })

  const settings: HouseholdSettings = {
    people: { 'maya@rivera.demo': 'Maya', 'daniel@rivera.demo': 'Daniel' },
    // Generic household context only — no reassurance-tuning specifics.
    advisor_overlay:
      "You're speaking with the Rivera household — Maya and Daniel, two working parents with two kids (Sofia and Leo) and a dog named Pepper. They're organized and want clear, practical guidance on cash flow, debt payoff, and saving for the kids and retirement. Speak to whoever is here by name; keep it warm, concrete, and honest.",
  }

  return {
    households: [{ id: HID, name: 'The Rivera household', shelf_cents: 0, settings, created_at: iso() }],
    accounts,
    cash_flows,
    balance_snapshots,
    estate_items: [], // Estate screen auto-seeds a starter set on first open
    conversations: [],
    messages: [],
    juno_notes: [
      { id: 'n-gap-1', household_id: HID, note: 'structural gap: no HELOC or line of credit recorded — worth knowing what cushion exists beyond the emergency savings.', created_at: iso() },
    ],
  }
}

// ── In-memory store ──────────────────────────────────────────────────────────
let store = fixture()
export function resetDemo() {
  store = fixture()
  location.reload()
}

const clone = (v: unknown) => JSON.parse(JSON.stringify(v))
const uuid = () => (crypto.randomUUID?.() ?? `id-${Date.now()}-${Math.round(Math.random() * 1e9)}`)

type Order = { col: string; asc: boolean; nullsFirst: boolean }

/** The subset of the supabase-js query builder the app actually uses, over the
 *  in-memory store. Thenable + chainable; mutations auto-run so fire-and-forget
 *  writes (never awaited) still take effect.
 *  ponytail: only the methods in real use — extend when a screen needs more. */
class QB {
  private op: 'select' | 'insert' | 'update' | 'delete' = 'select'
  private payload: Record<string, unknown>[] = []
  private filters: ((r: Record<string, unknown>) => boolean)[] = []
  private orders: Order[] = []
  private one = false
  private ran = false
  private cache: { data: unknown; error: null } = { data: null, error: null }
  private table: string

  constructor(table: string) { this.table = table }

  select() { return this }               // column projection ignored — extra keys are harmless
  order(col: string, o: { ascending?: boolean; nullsFirst?: boolean } = {}) {
    this.orders.push({ col, asc: o.ascending !== false, nullsFirst: !!o.nullsFirst }); return this
  }
  limit(n: number) { this.limitN = n; return this }
  eq(col: string, v: unknown) { this.filters.push((r) => r[col] === v); return this }
  not(col: string, _op: string, _v: unknown) { this.filters.push((r) => r[col] != null); return this } // only 'is null' is used
  ilike(col: string, pat: string) {
    const re = new RegExp('^' + pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$', 'i')
    this.filters.push((r) => typeof r[col] === 'string' && re.test(r[col] as string)); return this
  }
  single() { this.one = true; return this }

  insert(rows: Record<string, unknown> | Record<string, unknown>[]) {
    this.op = 'insert'; this.payload = Array.isArray(rows) ? rows : [rows]
    queueMicrotask(() => this.run()); return this
  }
  update(rec: Record<string, unknown>) {
    this.op = 'update'; this.payload = [rec]
    queueMicrotask(() => this.run()); return this
  }
  delete() { this.op = 'delete'; queueMicrotask(() => this.run()); return this }

  private limitN?: number

  private rowsOf() { return (store[this.table] ??= []) }
  private match(r: Record<string, unknown>) { return this.filters.every((f) => f(r)) }

  private run() {
    if (this.ran) return this.cache
    this.ran = true
    const rows = this.rowsOf()
    let out: Record<string, unknown>[] = []

    if (this.op === 'insert') {
      const now = iso()
      out = this.payload.map((r) => ({ id: uuid(), created_at: now, updated_at: now, ...r }))
      rows.push(...out)
    } else if (this.op === 'update') {
      out = rows.filter((r) => this.match(r))
      for (const r of out) Object.assign(r, this.payload[0], { updated_at: iso() })
    } else if (this.op === 'delete') {
      out = rows.filter((r) => this.match(r))
      store[this.table] = rows.filter((r) => !this.match(r))
    } else {
      out = rows.filter((r) => this.match(r))
      if (this.orders.length) out = [...out].sort((a, b) => this.cmp(a, b))
      if (this.limitN != null) out = out.slice(0, this.limitN)
    }

    const data = this.one ? (out[0] ?? null) : (this.op === 'select' ? out : null)
    this.cache = { data: clone(data), error: null }
    return this.cache
  }

  private cmp(a: Record<string, unknown>, b: Record<string, unknown>) {
    for (const o of this.orders) {
      const av = a[o.col] as never, bv = b[o.col] as never
      if (av == null && bv == null) continue
      if (av == null) return o.nullsFirst ? -1 : 1
      if (bv == null) return o.nullsFirst ? 1 : -1
      if (av < bv) return o.asc ? -1 : 1
      if (av > bv) return o.asc ? 1 : -1
    }
    return 0
  }

  then<T>(resolve: (v: { data: unknown; error: null }) => T, reject?: (e: unknown) => T) {
    try { return Promise.resolve(this.run()).then(resolve, reject) }
    catch (e) { return reject ? Promise.resolve(reject(e)) : Promise.reject(e) }
  }
}

/** Wrap the real client: DB → in-memory shim; health probe → stub; advisor →
 *  passes through to the ambient project's edge function. auth is untouched
 *  (App bypasses it in demo). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function makeDemoClient(real: any) {
  return new Proxy(real, {
    get(target, prop, receiver) {
      if (prop === 'from') return (table: string) => new QB(table)
      if (prop === 'functions') return {
        invoke: (name: string, opts: { body?: { health?: boolean } }) => {
          if (opts?.body?.health) return Promise.resolve({ data: { ok: true }, error: null })
          return target.functions.invoke(name, opts)
        },
      }
      return Reflect.get(target, prop, receiver)
    },
  })
}
