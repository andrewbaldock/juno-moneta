// Phase 2 math. Pure functions, integer cents in and out.
// Unknown (null) amounts are EXCLUDED and reported in `missing` — never counted as 0.

import type { Account, CashFlow } from './types'

export const LIQUID_CATEGORIES = ['checking', 'savings', 'brokerage', 'cash']

/** 'YYYY-MM-DD' → year*12 + monthIndex, so consecutive months differ by 1. */
export function monthKeyOf(dateStr: string): number {
  const [y, m] = dateStr.split('-').map(Number)
  return y * 12 + (m - 1)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export function monthLabel(key: number): string {
  return `${MONTHS[key % 12]} ${String(Math.floor(key / 12)).slice(2)}`
}

export function netWorth(accounts: Account[]): { cents: number; missing: string[] } {
  let cents = 0
  const missing: string[] = []
  for (const a of accounts) {
    if (a.balance_cents === null) missing.push(a.name)
    else cents += a.kind === 'asset' ? a.balance_cents : -a.balance_cents
  }
  return { cents, missing }
}

export function liquid(accounts: Account[]): { cents: number; missing: string[] } {
  let cents = 0
  const missing: string[] = []
  for (const a of accounts) {
    if (a.kind !== 'asset' || !LIQUID_CATEGORIES.includes(a.category)) continue
    if (a.balance_cents === null) missing.push(a.name)
    else cents += a.balance_cents
  }
  return { cents, missing }
}

function afterTax(f: CashFlow): number {
  const amt = f.amount_cents!
  return f.tax_setaside_pct ? Math.round(amt * (1 - f.tax_setaside_pct / 100)) : amt
}

/** Smoothed monthly-equivalent of a recurring flow (positive; 0 for one-time/null). */
export function monthlyEquivalent(f: CashFlow): number {
  if (f.amount_cents === null || f.cadence === 'one_time') return 0
  const amt = f.direction === 'income' ? afterTax(f) : f.amount_cents
  switch (f.cadence) {
    case 'monthly': return amt
    case 'biweekly': return Math.round((amt * 26) / 12)
    case 'weekly': return Math.round((amt * 52) / 12)
    case 'annual': return Math.round(amt / 12)
    case 'bimonthly': return Math.round(amt / 2)
    case 'every_4_months': return Math.round(amt / 4)
  }
}

function counts(f: CashFlow, lean: boolean): boolean {
  if (!f.active) return false
  if (f.direction === 'income' && !f.committed) return false // hypothetical stays out of the base
  if (lean && f.direction === 'expense' && !f.essential) return false
  return true
}

/** Smoothed monthly net (income − expenses) for flows current at `nowKey`. */
export function monthlyNet(flows: CashFlow[], nowKey: number, lean = false): { cents: number; missing: string[] } {
  let cents = 0
  const missing: string[] = []
  for (const f of flows) {
    if (!counts(f, lean) || f.cadence === 'one_time') continue
    if (f.end_date !== null && monthKeyOf(f.end_date) < nowKey) continue
    if (f.start_date !== null && monthKeyOf(f.start_date) > nowKey) continue
    if (f.amount_cents === null) { missing.push(f.name); continue }
    cents += (f.direction === 'income' ? 1 : -1) * monthlyEquivalent(f)
  }
  return { cents, missing }
}

export type ProjPoint = { key: number; net: number; cumulative: number }

/**
 * Month-by-month cash projection starting at `startKey`.
 * Lumpy cadences (annual/bimonthly/every-4-months) land on their real months when
 * a start_date anchors them, otherwise they're smoothed. One-times land on their date's month.
 */
export function project(flows: CashFlow[], startCents: number, startKey: number, months: number, lean = false): ProjPoint[] {
  const pts: ProjPoint[] = []
  let cum = startCents
  for (let i = 0; i < months; i++) {
    const k = startKey + i
    let net = 0
    for (const f of flows) {
      if (!counts(f, lean) || f.amount_cents === null) continue
      const sKey = f.start_date === null ? null : monthKeyOf(f.start_date)
      const eKey = f.end_date === null ? null : monthKeyOf(f.end_date)
      const sign = f.direction === 'income' ? 1 : -1
      const amt = f.direction === 'income' ? afterTax(f) : f.amount_cents
      if (f.cadence === 'one_time') {
        if (sKey === k) net += sign * amt
        continue
      }
      if (sKey !== null && k < sKey) continue
      if (eKey !== null && k > eKey) continue
      switch (f.cadence) {
        case 'monthly': net += sign * amt; break
        case 'biweekly': net += sign * Math.round((amt * 26) / 12); break
        case 'weekly': net += sign * Math.round((amt * 52) / 12); break
        case 'annual':
          if (sKey === null) net += sign * Math.round(amt / 12)
          else if ((k - sKey) % 12 === 0) net += sign * amt
          break
        case 'bimonthly':
          if (sKey === null) net += sign * Math.round(amt / 2)
          else if ((k - sKey) % 2 === 0) net += sign * amt
          break
        case 'every_4_months':
          if (sKey === null) net += sign * Math.round(amt / 4)
          else if ((k - sKey) % 4 === 0) net += sign * amt
          break
      }
    }
    cum += net
    pts.push({ key: k, net, cumulative: cum })
  }
  return pts
}

/**
 * Complete months survived before cash dips to/below `floorCents`; null = never within
 * the projection. The floor is the household's do-not-touch shelf — runway everywhere
 * in the app means "months before the shelf gets breached" (0 = plain cash-out).
 */
export function runwayMonths(pts: ProjPoint[], floorCents = 0): number | null {
  const i = pts.findIndex((p) => p.cumulative <= floorCents)
  return i === -1 ? null : i
}

/** A flow's payment amount applying to month k (0 if out of range / null). */
function amountInMonth(f: CashFlow, k: number): number {
  if (!f.active || f.amount_cents === null) return 0
  const sKey = f.start_date === null ? null : monthKeyOf(f.start_date)
  const eKey = f.end_date === null ? null : monthKeyOf(f.end_date)
  if (f.cadence === 'one_time') return sKey === k ? f.amount_cents : 0
  if (sKey !== null && k < sKey) return 0
  if (eKey !== null && k > eKey) return 0
  return monthlyEquivalent(f)
}

export type DebtOutlook = {
  name: string
  /** month the balance reaches 0, null if beyond the cap */
  payoffKey: number | null
  /** true when linked payments don't cover the interest */
  underwater: boolean
  /** no payment flow is linked to this debt */
  unlinked: boolean
}

/**
 * Rates flow through the model here: debts accrue interest_rate (APR) monthly and
 * amortize by their linked payment flows; non-liquid assets grow at expected %/yr.
 */
export function debtOutlooks(accounts: Account[], flows: CashFlow[], startKey: number, capMonths = 600): DebtOutlook[] {
  return accounts
    .filter((a) => a.kind === 'liability' && a.balance_cents !== null)
    .map((a) => {
      const payments = flows.filter((f) => f.account_id === a.id && f.direction === 'expense')
      if (payments.length === 0) return { name: a.name, payoffKey: null, underwater: false, unlinked: true }
      let b = a.balance_cents!
      const monthlyRate = (a.interest_rate ?? 0) / 1200
      const firstInterest = Math.round(b * monthlyRate)
      const firstPayment = payments.reduce((s, f) => s + amountInMonth(f, startKey), 0)
      const underwater = firstPayment > 0 && firstPayment < firstInterest
      for (let i = 0; i < capMonths; i++) {
        const k = startKey + i
        b = Math.round(b * (1 + monthlyRate))
        b -= payments.reduce((s, f) => s + amountInMonth(f, k), 0)
        if (b <= 0) return { name: a.name, payoffKey: k, underwater, unlinked: false }
      }
      return { name: a.name, payoffKey: null, underwater, unlinked: false }
    })
}

/**
 * Projected net worth path: liquid follows the cash projection; non-liquid assets
 * compound at expected growth; debts accrue interest minus linked payments.
 * Accounts with unknown balances stay excluded (unknown ≠ 0).
 */
export function projectNetWorth(accounts: Account[], flows: CashFlow[], cash: ProjPoint[], startKey: number): { key: number; cents: number }[] {
  const growers = accounts
    .filter((a) => a.kind === 'asset' && !LIQUID_CATEGORIES.includes(a.category) && a.balance_cents !== null)
    .map((a) => ({ b: a.balance_cents!, r: (a.interest_rate ?? 0) / 1200 }))
  const debts = accounts
    .filter((a) => a.kind === 'liability' && a.balance_cents !== null)
    .map((a) => ({
      b: a.balance_cents!,
      r: (a.interest_rate ?? 0) / 1200,
      payments: flows.filter((f) => f.account_id === a.id && f.direction === 'expense'),
    }))
  return cash.map((pt, i) => {
    const k = startKey + i
    let nw = pt.cumulative
    for (const g of growers) {
      g.b = Math.round(g.b * (1 + g.r))
      nw += g.b
    }
    for (const d of debts) {
      if (d.b > 0) {
        d.b = Math.round(d.b * (1 + d.r))
        d.b -= d.payments.reduce((s, f) => s + amountInMonth(f, k), 0)
        if (d.b < 0) d.b = 0
      }
      nw -= d.b
    }
    return { key: k, cents: nw }
  })
}

export type Snapshot = { account_id: string; balance_cents: number; as_of_date: string }

/**
 * Net worth at each snapshot date. Forward-fills each account's latest known balance,
 * and BACKFILLS its first-known balance to earlier dates: entering a long-held account's
 * balance for the first time is data arrival, not a windfall — without the backfill the
 * series showed a fake one-day "+$139k" jump every time a missing number got filled in.
 * ponytail: genuinely NEW assets backfill too; fine until a real purchase needs a start date
 */
export function netWorthSeries(accounts: Account[], snaps: Snapshot[]): { date: string; cents: number }[] {
  const kind = new Map(accounts.map((a) => [a.id, a.kind]))
  const dates = [...new Set(snaps.map((s) => s.as_of_date))].sort()
  // ponytail: O(dates × snaps) rescan; fine for household volumes, index by account if it ever isn't
  return dates.map((d) => {
    const latest = new Map<string, number>()
    const known = new Set<string>()
    for (const s of snaps) {
      if (s.as_of_date <= d) { latest.set(s.account_id, s.balance_cents); known.add(s.account_id) }
      else if (!known.has(s.account_id) && !latest.has(s.account_id)) latest.set(s.account_id, s.balance_cents)
    }
    let cents = 0
    for (const [id, bal] of latest) cents += kind.get(id) === 'liability' ? -bal : bal
    return { date: d, cents }
  })
}
