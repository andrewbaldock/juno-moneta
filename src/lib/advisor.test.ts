import { expect, test } from 'bun:test'
import { applyScenario, buildSnapshot, suggestions, timelineEvents } from './advisor'
import { monthKeyOf, project, runwayMonths, liquid } from './metrics'
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

const nowKey = monthKeyOf('2026-07-01')

test('a new job scenario extends runway', () => {
  const base = [flow({ amount_cents: 500000 })] // burn $5k/mo
  const scenario = applyScenario(base, [
    { kind: 'add_income', name: 'New job', amount_usd: 6000, start_offset_months: 2 },
  ], nowKey)
  const baseRun = runwayMonths(project(base, 2000000, nowKey + 1, 60))
  const scenRun = runwayMonths(project(scenario, 2000000, nowKey + 1, 60))
  expect(baseRun).toBe(3)
  expect(scenRun).toBeNull() // income exceeds burn from month 2 → never dies
})

test('end_flow truncates income by exact name, case-insensitive', () => {
  const base = [flow({ name: 'Severance', direction: 'income', amount_cents: 500000 })]
  const out = applyScenario(base, [{ kind: 'end_flow', flow_name: 'severance', end_offset_months: 1 }], nowKey)
  expect(out[0].end_date).toBe('2026-08-01')
  const untouched = applyScenario(base, [{ kind: 'end_flow', flow_name: 'nope', end_offset_months: 1 }], nowKey)
  expect(untouched[0].end_date).toBeNull()
})

test('dollars, cents, or missing amounts all stay finite — no NaN poisoning', () => {
  const base = [flow({ amount_cents: 100000 })]
  const out = applyScenario(base, [
    { kind: 'add_income', name: 'usd', amount_usd: 6250 },
    { kind: 'add_income', name: 'legacy-alias', monthly_usd: 1000 },
    { kind: 'add_income', name: 'missing amount' }, // Claude omitted it → unknown, not NaN
  ], nowKey)
  expect(out.find((f) => f.name === 'usd')!.amount_cents).toBe(625000)
  expect(out.find((f) => f.name === 'legacy-alias')!.amount_cents).toBe(100000)
  expect(out.find((f) => f.name === 'missing amount')!.amount_cents).toBeNull()
  const proj = project(out, 500000, nowKey + 1, 12)
  expect(proj.every((p) => Number.isFinite(p.cumulative))).toBe(true)
})

test('scenario never mutates the base flows', () => {
  const base = [flow({ name: 'Rent', amount_cents: 100000 })]
  applyScenario(base, [{ kind: 'remove_flow', flow_name: 'Rent' }], nowKey)
  expect(base[0].active).toBe(true)
})

test('timeline events: income cliff, cash-out, scenario start', () => {
  const flows = [
    flow({ name: 'EDD', direction: 'income', amount_cents: 90000, end_date: '2026-11-07' }),
    flow({ name: 'Bills', amount_cents: 400000 }),
  ]
  const withScenario = applyScenario(flows, [{ kind: 'add_income', name: 'Contract', amount_cents: 100000, start_offset_months: 3 }], nowKey)
  const proj = project(withScenario, 1000000, nowKey + 1, 24)
  const events = timelineEvents(withScenario, [], proj, nowKey)
  expect(events.map((e) => e.kind)).toContain('income_end')
  expect(events.map((e) => e.kind)).toContain('scenario')
  expect(events.map((e) => e.kind)).toContain('cash_out')
})

test('suggestions react to the picture and skip already-asked questions', () => {
  const flows = [
    flow({ name: 'Severance', direction: 'income', category: 'severance', amount_cents: 500000, end_date: '2026-08-21' }),
  ]
  const fresh = suggestions([], flows, [], nowKey)
  expect(fresh[0]).toBe('Severance ends Aug 21, 2026 — how should we adjust?')
  expect(fresh).toContain('What if a new $100k job starts in 3 months?')
  // asking one removes it next time (titles are truncated to 60 chars like real convo titles)
  const after = suggestions([], flows, [fresh[0].slice(0, 60)], nowKey)
  expect(after).not.toContain(fresh[0])
  expect(after.length).toBe(3) // backfilled from the pool
})

test('the shelf raises the floor: runway counts months until liquid dips below it', () => {
  const flows = [flow({ amount_cents: 1000000 })] // burn $10k/mo
  const pts = project(flows, 6000000, nowKey + 1, 60) // $60k liquid
  expect(runwayMonths(pts)).toBe(5)
  expect(runwayMonths(pts, 3000000)).toBe(2) // $30k shelf → the floor is hit 3 months sooner
})

test('snapshot carries the shelf and shelf-aware runway', () => {
  const accounts = [acct({ name: 'Savings', category: 'savings', balance_cents: 6000000 })]
  const flows = [flow({ name: 'Bills', amount_cents: 1000000 })]
  const s = buildSnapshot(accounts, flows, nowKey, 3000000)
  expect(s.do_not_touch_shelf_usd).toBe(30000)
  expect(s.runway_months).toBe(2)
  expect(buildSnapshot(accounts, flows, nowKey).do_not_touch_shelf_usd).toBe(0)
})

test('snapshot carries exact names, dollar units, and gaps', () => {
  const accounts = [
    acct({ name: 'Savings', category: 'savings', balance_cents: 6000000 }),
    acct({ name: 'Mystery', balance_cents: null }),
  ]
  const flows = [
    flow({ name: 'Sam — salary', direction: 'income', amount_cents: 696906 }),
    flow({ name: 'Tax refund', direction: 'income', amount_cents: 250000, cadence: 'one_time', start_date: '2026-09-15' }),
    flow({ name: 'Vet bill', amount_cents: null }),
  ]
  const s = buildSnapshot(accounts, flows, nowKey)
  expect(s.liquid_usd).toBe(60000)
  expect(s.date).toBe('2026-07') // unambiguous — never "Jul 26"
  expect(s.income[0].name).toBe('Sam — salary')
  expect(s.income[0].monthly_usd).toBe(6969)
  // one-time money is real and dated, not "monthly: null" pretending to be unknown
  expect(s.income[1]).toMatchObject({ name: 'Tax refund', one_time_usd: 2500, on: '2026-09-15' })
  // truly unknown stays null AND lands in gaps
  expect(s.expenses[0].monthly_usd).toBeNull()
  expect(s.gaps).toEqual(['Mystery: balance unknown', 'Vet bill: amount unknown'])
  expect(liquid(accounts).cents).toBe(6000000)
})
