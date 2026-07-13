import { expect, test } from 'bun:test'
import { debtOutlooks, monthKeyOf, monthlyEquivalent, monthlyNet, netWorth, project, projectNetWorth, runwayMonths, netWorthSeries } from './metrics'
import type { Account, CashFlow } from './types'

const flow = (over: Partial<CashFlow>): CashFlow => ({
  id: 'x', household_id: 'h', name: 'f', direction: 'expense', category: 'misc',
  amount_cents: 0, cadence: 'monthly', start_date: null, end_date: null,
  active: true, essential: true, tax_setaside_pct: null, committed: true,
  account_id: null, due_day: null, late_after_days: null, autopay: false, notes: null, updated_at: '', ...over,
})

const acct = (over: Partial<Account>): Account => ({
  id: 'a', household_id: 'h', name: 'a', kind: 'asset', category: 'checking',
  balance_cents: 0, interest_rate: null, last4: null, titled_to: 'unknown', details: {}, notes: null, updated_at: '', ...over,
})

test('debt amortizes with interest to a real payoff month', () => {
  // $12,000 @ 12% APR, $1,000/mo → 12 interest-free months wouldn't cut it; ~13 with interest
  const debt = acct({ id: 'd', kind: 'liability', category: 'other_debt', balance_cents: 1200000, interest_rate: 12 })
  const pay = flow({ amount_cents: 100000, account_id: 'd' })
  const [o] = debtOutlooks([debt], [pay], 0)
  expect(o.payoffKey).toBe(12) // 13th month (0-indexed)
  expect(o.underwater).toBe(false)
  expect(o.unlinked).toBe(false)
})

test('payment below interest is flagged underwater; unlinked debt is flagged', () => {
  const debt = acct({ id: 'd', kind: 'liability', category: 'credit_card', balance_cents: 1000000, interest_rate: 24 })
  const tiny = flow({ amount_cents: 10000, account_id: 'd' }) // $100 vs $200/mo interest
  const [o] = debtOutlooks([debt], [tiny], 0, 24)
  expect(o.underwater).toBe(true)
  expect(o.payoffKey).toBeNull()
  const [u] = debtOutlooks([debt], [], 0, 24)
  expect(u.unlinked).toBe(true)
})

test('projected net worth grows assets and amortizes debts', () => {
  const home = acct({ id: 'h1', category: 'home_value', balance_cents: 100000000, interest_rate: 6 }) // $1M @ 6%/yr
  const debt = acct({ id: 'd', kind: 'liability', category: 'other_debt', balance_cents: 1200000, interest_rate: 0 })
  const pay = flow({ amount_cents: 100000, account_id: 'd' })
  const cash = project([pay], 5000000, 0, 2) // $50k liquid, paying $1k/mo out
  const series = projectNetWorth([home, debt], [pay], cash, 0)
  // month 1: liquid 49k + home 1,005,000 (0.5%/mo) − debt 11k = 1,043,000
  expect(series[0].cents).toBe(4900000 + 100500000 - 1100000)
  // debt shrinks $1k/mo while liquid drops the same — home growth is the only net change
  expect(series[1].cents).toBe(4800000 + Math.round(100500000 * 1.005) - 1000000)
})

test('cadence normalization', () => {
  expect(monthlyEquivalent(flow({ amount_cents: 100000, cadence: 'biweekly' }))).toBe(216667)
  expect(monthlyEquivalent(flow({ amount_cents: 120000, cadence: 'annual' }))).toBe(10000)
  expect(monthlyEquivalent(flow({ amount_cents: 20716, cadence: 'every_4_months' }))).toBe(5179)
})

test('contract income nets out tax set-aside', () => {
  const f = flow({ direction: 'income', amount_cents: 600000, tax_setaside_pct: 35 })
  expect(monthlyEquivalent(f)).toBe(390000)
})

test('unknown amounts are reported, never counted as zero', () => {
  const { cents, missing } = monthlyNet([flow({ amount_cents: null, name: 'severance' })], 0)
  expect(cents).toBe(0)
  expect(missing).toEqual(['severance'])
  const nw = netWorth([acct({ balance_cents: null, name: '401k' }), acct({ balance_cents: 500 })])
  expect(nw.cents).toBe(500)
  expect(nw.missing).toEqual(['401k'])
})

test('projection shows the income cliff', () => {
  const aug = monthKeyOf('2026-08-01')
  const flows = [
    flow({ direction: 'income', amount_cents: 500000, end_date: '2026-08-31' }),
    flow({ amount_cents: 300000 }),
  ]
  const pts = project(flows, 1000000, aug, 3)
  expect(pts[0].net).toBe(200000)   // Aug: income still on
  expect(pts[1].net).toBe(-300000)  // Sep: cliff
  expect(pts[2].net).toBe(-300000)
})

test('one-time expense lands on its month only', () => {
  const start = monthKeyOf('2026-08-01')
  const pts = project([flow({ amount_cents: 200000, cadence: 'one_time', start_date: '2026-10-15' })], 0, start, 4)
  expect(pts.map((p) => p.net)).toEqual([0, 0, -200000, 0])
})

test('hypothetical income stays out of the base projection', () => {
  const pts = project([flow({ direction: 'income', amount_cents: 600000, committed: false })], 0, 0, 2)
  expect(pts[1].cumulative).toBe(0)
})

test('runway from projection, and lean burn beats current burn', () => {
  const flows = [
    flow({ direction: 'income', amount_cents: 100000 }),
    flow({ amount_cents: 130000, essential: true }),
    flow({ amount_cents: 20000, essential: false }),
  ]
  const current = project(flows, 100000, 0, 24)        // net −500/mo → dies in month 3 (index 1 = survive 1... )
  expect(runwayMonths(current)).toBe(1)                 // 1000 → 500 → ≤0 at index 1: survives 1 full month
  const lean = project(flows, 100000, 0, 24, true)      // net −300/mo
  expect(runwayMonths(lean)).toBe(3)                    // 700, 400, 100, −200
  expect(runwayMonths(project([flow({ direction: 'income', amount_cents: 1 })], 100, 0, 24))).toBeNull()
})

test('anchored lumpy cadence lands on real months', () => {
  const jan = monthKeyOf('2027-01-01')
  const pts = project([flow({ amount_cents: 120000, cadence: 'annual', start_date: '2027-03-01' })], 0, jan, 15)
  expect(pts[2].net).toBe(-120000)                      // Mar 27
  expect(pts.filter((p) => p.net !== 0).length).toBe(2) // Mar 27 + Mar 28
})

test('net worth series forward-fills, and backfills first-known balances (no entry-day jumps)', () => {
  const accounts = [acct({ id: 'sav' }), acct({ id: 'loan', kind: 'liability' })]
  const snaps = [
    { account_id: 'sav', balance_cents: 1000, as_of_date: '2026-01-01' },
    { account_id: 'loan', balance_cents: 400, as_of_date: '2026-02-01' },
    { account_id: 'sav', balance_cents: 900, as_of_date: '2026-03-01' },
  ]
  // the loan existed before it was entered on 02-01 — backfilled to 01-01, so the
  // series moves only on REAL balance changes (sav 1000→900), never on data entry
  expect(netWorthSeries(accounts, snaps)).toEqual([
    { date: '2026-01-01', cents: 600 },
    { date: '2026-02-01', cents: 600 },
    { date: '2026-03-01', cents: 500 },
  ])
})
