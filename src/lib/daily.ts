// The daily rolling balance — every bill and paycheck on its real date, running-summed.
//
// project() in metrics.ts smooths each cadence to a monthly net, which is the right
// shape for runway and net worth but hides what happens INSIDE a month: the dip on
// the 20th before the paycheck on the 22nd. A household living close to the line
// steers by that dip, so it needs its own engine.
//
// Both are true at once. This one answers "when does the account go negative"; the
// monthly one answers "how long does the cash last".
//
// Dates are handled the calendar.ts way — split by hand, arithmetic in UTC. Never
// Date.parse a bare YYYY-MM-DD (UTC midnight reads as the previous evening here).
import { monthEvents } from './calendar'
import { afterTax, counts, monthlyEquivalent, monthKeyOf, type ProjPoint } from './metrics'
import type { CashFlow } from './types'

/** A per-occurrence correction to a flow's rule. Keyed by (flow_id, occurs_on). */
export type FlowOverride = {
  flow_id: string
  occurs_on: string
  amount_cents: number | null
  skipped: boolean
  note: string | null
}

/** One dated occurrence — a row in the ledger. */
export type Occurrence = {
  date: string
  flow: CashFlow
  /** Signed cents: income positive, expense negative. Post-override, post-tax. */
  delta: number
  /** Running balance after this row. */
  balance: number
  /** True when a flow_overrides row changed this occurrence. */
  overridden: boolean
  note: string | null
}

export type DayPoint = {
  date: string      // YYYY-MM-DD
  delta: number     // net cents moving that day (all flows landing on it)
  balance: number   // running balance after the day's movement
}

export type DailyProjection = {
  /** Every dated occurrence in order — the ledger, one row per bill or paycheck. */
  rows: Occurrence[]
  /** The start anchor, then one point per day money actually moves. */
  points: DayPoint[]
  /** Recurring flows with no due_day and no start_date — undateable, so EXCLUDED. */
  unplaced: CashFlow[]
  /** Flows whose amount is still unknown — excluded, never counted as 0. */
  missing: string[]
  /** The lowest the balance gets, and when. The number the household steers by. */
  low: DayPoint | null
  /** First day at or below the floor, null if it never gets there. */
  firstBelow: DayPoint | null
}

const DAY = 86_400_000
const pad = (n: number) => String(n).padStart(2, '0')
const parts = (s: string): [number, number, number] => {
  const [y, m, d] = s.split('-').map(Number)
  return [y, m - 1, d]
}
const fmt = (utcMs: number) => {
  const d = new Date(utcMs)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/**
 * Running cash balance from `fromISO` for `days`, starting at `startCents`
 * (normally liquid(accounts).cents).
 *
 * Starts TODAY, not next month — this month's remaining bills are the ones that
 * decide whether the account survives to payday.
 */
export function projectDaily(
  flows: CashFlow[],
  startCents: number,
  fromISO: string,
  days: number,
  { lean = false, floorCents = 0, overrides = [] }: {
    lean?: boolean; floorCents?: number; overrides?: FlowOverride[]
  } = {},
): DailyProjection {
  const byKey = new Map(overrides.map((o) => [`${o.flow_id}|${o.occurs_on}`, o]))
  const [fy, fm, fd] = parts(fromISO)
  const fromMs = Date.UTC(fy, fm, fd)
  const toMs = fromMs + days * DAY
  const toISO = fmt(toMs)

  const eligible = flows.filter((f) => counts(f, lean))
  const missing = eligible.filter((f) => f.amount_cents === null).map((f) => f.name)
  const priced = eligible.filter((f) => f.amount_cents !== null)

  // monthEvents works one month at a time; walk every month the window touches.
  // Same flow comes back unplaced each month it's asked about — dedupe by id.
  const dated: { date: string; flow: CashFlow }[] = []
  const unplaced = new Map<string, CashFlow>()
  for (let y = fy, m0 = fm; Date.UTC(y, m0, 1) <= toMs; m0 === 11 ? (m0 = 0, y++) : m0++) {
    const { events, unplaced: stuck } = monthEvents(priced, y, m0)
    for (const e of events) if (e.date >= fromISO && e.date <= toISO) dated.push(e)
    for (const f of stuck) unplaced.set(f.id, f)
  }
  dated.sort((a, b) => a.date.localeCompare(b.date))

  let balance = startCents
  const rows: Occurrence[] = []
  const points: DayPoint[] = [{ date: fromISO, delta: 0, balance }]
  for (const { date, flow } of dated) {
    const o = byKey.get(`${flow.id}|${date}`)
    if (o?.skipped) continue
    // An override replaces the rule's amount for this date only. Tax set-aside still
    // applies — the override is what was billed, not what lands after tax.
    const raw = o?.amount_cents ?? (flow.amount_cents as number)
    const amt = flow.direction === 'income'
      ? afterTax({ ...flow, amount_cents: raw })
      : raw
    const delta = flow.direction === 'income' ? amt : -amt
    balance += delta
    rows.push({ date, flow, delta, balance, overridden: o !== undefined, note: o?.note ?? null })
    const last = points[points.length - 1]
    if (last.date === date) { last.delta += delta; last.balance = balance }
    else points.push({ date, delta, balance })
  }

  let low = points[0]
  for (const p of points) if (p.balance < low.balance) low = p

  return {
    rows,
    points,
    unplaced: [...unplaced.values()],
    missing,
    low,
    firstBelow: points.find((p) => p.balance <= floorCents) ?? null,
  }
}

/**
 * The monthly projection, derived from the dated one — same `ProjPoint[]` shape
 * `metrics.project` returns, so runway, net worth and the scenario charts consume
 * it unchanged.
 *
 * This is the reconciliation. `project()` smooths every cadence to a monthly
 * average, which means the monthly chart and the day-by-day ledger were two
 * independent answers to "what happens in June" and could quietly disagree.
 * Here a month's net is just its dated occurrences added up — one engine, two
 * zoom levels — so correcting one bill in the Ledger moves runway too.
 *
 * Flows that can't be dated yet (no due_day, no start_date anchor) keep the old
 * smoothed treatment rather than vanishing: adding a due day should sharpen WHEN
 * money moves without changing WHETHER it was counted.
 */
export function projectMonthly(
  flows: CashFlow[],
  startCents: number,
  startKey: number,
  months: number,
  { lean = false, overrides = [] }: { lean?: boolean; overrides?: FlowOverride[] } = {},
): ProjPoint[] {
  const y = Math.floor(startKey / 12)
  const m0 = startKey % 12
  const from = Date.UTC(y, m0, 1)
  const through = Date.UTC(Math.floor((startKey + months) / 12), (startKey + months) % 12, 0)
  const daily = projectDaily(flows, startCents, fmt(from), Math.round((through - from) / DAY), { lean, overrides })

  const netByKey = new Map<number, number>()
  for (const r of daily.rows) netByKey.set(monthKeyOf(r.date), (netByKey.get(monthKeyOf(r.date)) ?? 0) + r.delta)

  // undateable flows still count, the old smoothed way
  for (const f of daily.unplaced) {
    const sKey = f.start_date === null ? null : monthKeyOf(f.start_date)
    const eKey = f.end_date === null ? null : monthKeyOf(f.end_date)
    const sign = f.direction === 'income' ? 1 : -1
    for (let i = 0; i < months; i++) {
      const k = startKey + i
      if (sKey !== null && k < sKey) continue
      if (eKey !== null && k > eKey) continue
      netByKey.set(k, (netByKey.get(k) ?? 0) + sign * monthlyEquivalent(f))
    }
  }

  const pts: ProjPoint[] = []
  let cum = startCents
  for (let i = 0; i < months; i++) {
    const k = startKey + i
    const net = netByKey.get(k) ?? 0
    cum += net
    pts.push({ key: k, net, cumulative: cum })
  }
  return pts
}
