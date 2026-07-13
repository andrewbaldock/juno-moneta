// Phase 4: advisor types + snapshot builder + scenario application.
// Claude proposes scenario *deltas*; OUR engine does all math (metrics.ts).

import type { Account, CashFlow, EstateItem } from './types'
import { debtOutlooks, liquid, monthlyEquivalent, monthlyNet, netWorth, project, runwayMonths, monthKeyOf } from './metrics'
import { unfundedAssets } from './estate'

// Claude misread the UI label "Jul 26" as July 26th (then guessed the wrong year).
// Everything LLM-facing uses unambiguous YYYY-MM or "Aug 21, 2026" instead.
const isoMonth = (key: number) => `${Math.floor(key / 12)}-${String((key % 12) + 1).padStart(2, '0')}`
const fullDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export type Action = {
  title: string
  rationale: string
  impact_estimate: string
  effort: 'low' | 'medium' | 'high'
  priority: number
}

type AmountFields = { amount_usd?: number; monthly_usd?: number; amount_cents?: number }

export type ScenarioChange =
  | ({ kind: 'add_income'; name: string; cadence?: CashFlow['cadence']; tax_setaside_pct?: number; start_offset_months?: number; end_offset_months?: number | null } & AmountFields)
  | ({ kind: 'add_expense'; name: string; cadence?: CashFlow['cadence']; essential?: boolean; start_offset_months?: number; end_offset_months?: number | null } & AmountFields)
  | { kind: 'end_flow'; flow_name: string; end_offset_months: number }
  | { kind: 'remove_flow'; flow_name: string }

/** Accept dollars (preferred) or cents; anything non-finite becomes null (unknown), never NaN. */
function centsFrom(c: AmountFields): number | null {
  if (Number.isFinite(c.amount_cents)) return Math.round(c.amount_cents!)
  const usd = Number.isFinite(c.amount_usd) ? c.amount_usd! : Number.isFinite(c.monthly_usd) ? c.monthly_usd! : null
  return usd === null ? null : Math.round(usd * 100)
}

export type Scenario = { name: string; description?: string; changes: ScenarioChange[] }

export type Advice = { reply: string; actions?: Action[]; scenario?: Scenario; remember?: string[]; edits?: unknown; structural_gaps?: string[] }

function offsetToDate(nowKey: number, offset: number): string {
  const k = nowKey + offset
  return `${Math.floor(k / 12)}-${String((k % 12) + 1).padStart(2, '0')}-01`
}

/** Apply Claude's proposed deltas to a copy of the flows. Unknown flow names are ignored. */
export function applyScenario(flows: CashFlow[], changes: ScenarioChange[], nowKey: number): CashFlow[] {
  const out: CashFlow[] = flows.map((f) => ({ ...f }))
  let n = 0
  for (const c of changes) {
    if (c.kind === 'add_income' || c.kind === 'add_expense') {
      out.push({
        id: `scenario-${n++}`,
        household_id: 'scenario',
        name: c.name,
        direction: c.kind === 'add_income' ? 'income' : 'expense',
        category: c.kind === 'add_income' ? 'other_income' : 'misc',
        amount_cents: centsFrom(c),
        cadence: c.cadence ?? 'monthly',
        start_date: offsetToDate(nowKey, c.start_offset_months ?? 0),
        end_date: c.end_offset_months == null ? null : offsetToDate(nowKey, c.end_offset_months),
        active: true,
        essential: c.kind === 'add_expense' ? (c.essential ?? false) : false,
        tax_setaside_pct: c.kind === 'add_income' ? (c.tax_setaside_pct ?? null) : null,
        committed: true, // within the scenario it is the premise
        account_id: null,
        due_day: null,
        late_after_days: null,
        autopay: false,
        notes: null,
        updated_at: '',
      })
    } else {
      const target = out.find((f) => f.name.toLowerCase() === c.flow_name.toLowerCase())
      if (!target) continue
      if (c.kind === 'remove_flow') target.active = false
      // ?? 0: a model that omits the offset means "ends now" — never a NaN date that silently never ends
      else target.end_date = offsetToDate(nowKey, c.end_offset_months ?? 0)
    }
  }
  return out
}

export type TimelineEvent = { key: number; label: string; kind: 'income_end' | 'payoff' | 'cash_out' | 'scenario' }

/** Key events for the horizontal timeline: income cliffs, payoffs, cash-out, scenario starts/ends. */
export function timelineEvents(
  flows: CashFlow[], accounts: Account[], proj: { key: number; cumulative: number }[], nowKey: number, floorCents = 0,
): TimelineEvent[] {
  const horizon = proj.length ? proj[proj.length - 1].key : nowKey
  const events: TimelineEvent[] = []
  for (const f of flows) {
    if (!f.active || f.direction !== 'income' || f.end_date === null || f.amount_cents === null) continue
    const k = monthKeyOf(f.end_date)
    if (k >= nowKey && k <= horizon) events.push({ key: k, label: `${f.name} ends`, kind: 'income_end' })
  }
  for (const f of flows) {
    if (f.id.startsWith('scenario-') && f.start_date) {
      events.push({ key: monthKeyOf(f.start_date), label: `${f.name} starts`, kind: 'scenario' })
    }
  }
  for (const o of debtOutlooks(accounts, flows, nowKey + 1)) {
    if (o.payoffKey !== null && o.payoffKey <= horizon) events.push({ key: o.payoffKey, label: `${o.name} paid off`, kind: 'payoff' })
  }
  const dead = proj.find((p) => p.cumulative <= floorCents)
  if (dead) events.push({ key: dead.key, label: floorCents > 0 ? 'dips below the shelf' : 'cash runs out', kind: 'cash_out' })
  return events.sort((a, b) => a.key - b.key)
}

/**
 * Starter questions derived from the live picture — income cliffs first, then debt
 * levers, then job-search what-ifs. Questions already asked (matching an existing
 * conversation title) are dropped.
 */
export function suggestions(accounts: Account[], flows: CashFlow[], convoTitles: string[], nowKey: number): string[] {
  const candidates: string[] = []

  for (const f of flows) {
    if (!f.active || f.direction !== 'income' || !f.committed || f.end_date === null || f.amount_cents === null) continue
    const k = monthKeyOf(f.end_date)
    if (k >= nowKey && k <= nowKey + 3) candidates.push(`${f.name} ends ${fullDate(f.end_date)} — how should we adjust?`)
  }

  for (const o of debtOutlooks(accounts, flows, nowKey + 1)) {
    if (o.underwater) candidates.push(`Payments on ${o.name} barely cover the interest — what should we do?`)
    else if (o.payoffKey !== null && o.payoffKey - nowKey > 180) candidates.push(`What if we put an extra $500/mo toward ${o.name}?`)
  }

  const jobHunting = flows.some((f) => f.active && ['severance', 'unemployment'].includes(f.category))
  if (jobHunting) {
    candidates.push('What if a new $100k job starts in 3 months?')
    candidates.push('What if there’s no new income for 12 months — what gets paid first?')
  }

  candidates.push('What should we do first?')
  candidates.push('Where does our money actually go each month?')

  const asked = convoTitles.map((t) => t.toLowerCase())
  return candidates
    .filter((c) => !asked.some((t) => t.startsWith(c.toLowerCase().slice(0, 55))))
    .slice(0, 3)
}

/**
 * LLM-facing amount for one flow. One-time flows have no monthly equivalent — sending
 * monthly_usd:null made known money read as "unknown" (and it wasn't in gaps). A truly
 * unknown amount stays null and IS in gaps; monthlyEquivalent's 0-for-null must not leak.
 */
function flowAmount(f: CashFlow): { monthly_usd?: number | null; one_time_usd?: number | null; on?: string | null } {
  const usd = (c: number | null) => (c === null ? null : Math.round(c / 100))
  return f.cadence === 'one_time'
    ? { one_time_usd: usd(f.amount_cents), on: f.start_date }
    : { monthly_usd: f.amount_cents === null ? null : usd(monthlyEquivalent(f)) }
}

/** Compact, numbers-only snapshot the advisor reasons over. Names are exact for delta targeting. */
export function buildSnapshot(accounts: Account[], flows: CashFlow[], nowKey: number, shelfCents = 0, estate: EstateItem[] = []) {
  const nw = netWorth(accounts)
  const liq = liquid(accounts)
  const cur = monthlyNet(flows, nowKey)
  const lean = monthlyNet(flows, nowKey, true)
  const projC = project(flows, liq.cents, nowKey + 1, 60)
  const projL = project(flows, liq.cents, nowKey + 1, 60, true)
  const dollars = (c: number | null) => (c === null ? null : Math.round(c / 100))
  return {
    date: isoMonth(nowKey),
    net_worth_usd: dollars(nw.cents),
    liquid_usd: dollars(liq.cents),
    do_not_touch_shelf_usd: dollars(shelfCents),
    monthly_net_usd: dollars(cur.cents),
    monthly_net_lean_usd: dollars(lean.cents),
    runway_months: runwayMonths(projC, shelfCents),
    runway_months_lean: runwayMonths(projL, shelfCents),
    income: flows.filter((f) => f.active && f.direction === 'income').map((f) => ({
      name: f.name, ...flowAmount(f), ends: f.end_date, committed: f.committed,
      tax_setaside_pct: f.tax_setaside_pct,
    })),
    expenses: flows.filter((f) => f.active && f.direction === 'expense')
      .sort((a, b) => monthlyEquivalent(b) - monthlyEquivalent(a))
      .map((f) => ({ name: f.name, ...flowAmount(f), essential: f.essential, category: f.category, ends: f.end_date })),
    assets: accounts.filter((a) => a.kind === 'asset').map((a) => ({
      name: a.name, balance_usd: dollars(a.balance_cents), growth_pct: a.interest_rate, category: a.category,
      ...(Object.keys(a.details ?? {}).length ? { details: a.details } : {}),
    })),
    debts: accounts.filter((a) => a.kind === 'liability').map((a) => {
      const o = debtOutlooks([a], flows, nowKey + 1)[0]
      return {
        name: a.name, balance_usd: dollars(a.balance_cents), apr_pct: a.interest_rate,
        payoff: o?.payoffKey != null ? isoMonth(o.payoffKey) : null, underwater: o?.underwater ?? false,
        ...(Object.keys(a.details ?? {}).length ? { details: a.details } : {}),
      }
    }),
    gaps: [
      ...accounts.filter((a) => a.balance_cents === null).map((a) => `${a.name}: balance unknown`),
      ...flows.filter((f) => f.active && f.amount_cents === null).map((f) => `${f.name}: amount unknown`),
    ],
    // estate posture rides along once the checklist exists — she can name what's unsigned
    // and what still sits outside the trust, but the app does the tracking.
    estate: estate.length === 0 ? undefined : {
      documents: estate.map((i) => ({ doc: i.item_type, person: i.person, status: i.status })),
      assets_titled_to_trust: accounts.filter((a) => a.kind === 'asset' && a.titled_to === 'trust').map((a) => a.name),
      assets_outside_trust: unfundedAssets(accounts).map((a) => a.name),
    },
  }
}
