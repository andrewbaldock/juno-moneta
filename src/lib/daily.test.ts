// Every number here is invented. Real household figures live in Supabase, never
// in the repo — these fixtures only have to exercise the SHAPE of the arithmetic.
import { expect, test } from 'bun:test'
import { projectDaily } from './daily'
import type { CashFlow } from './types'

const flow = (over: Partial<CashFlow>): CashFlow => ({
  id: 'x', household_id: 'h', name: 'f', direction: 'expense', category: 'misc',
  amount_cents: 0, cadence: 'monthly', start_date: null, end_date: null,
  active: true, essential: true, tax_setaside_pct: null, committed: true,
  account_id: null, due_day: null, late_after_days: null, autopay: false, notes: null, updated_at: '', ...over,
})

const at = (p: ReturnType<typeof projectDaily>, date: string) => p.points.find((x) => x.date === date)

test('the mid-month dip the monthly projection hides', () => {
  // Rent on the 1st, paycheck on the 20th. Ends the month up, but goes negative
  // on the 1st and stays there for nineteen days. project() reports +$1,000 net
  // and shows none of it.
  const p = projectDaily([
    flow({ id: 'rent', name: 'Rent', amount_cents: 200000, due_day: 1 }),
    flow({ id: 'pay', name: 'Pay', direction: 'income', amount_cents: 300000, due_day: 20 }),
  ], 50000, '2026-03-01', 40)

  expect(at(p, '2026-03-01')!.balance).toBe(-150000)
  expect(at(p, '2026-03-20')!.balance).toBe(150000)
  expect(p.low!.date).toBe('2026-03-01')
  expect(p.low!.balance).toBe(-150000)
  expect(p.firstBelow!.date).toBe('2026-03-01')
})

test('starts today — this month\'s remaining bills still count', () => {
  // project() passes nowKey + 1 everywhere, dropping the rest of the current month.
  const bill = flow({ amount_cents: 10000, due_day: 25 })
  expect(at(projectDaily([bill], 0, '2026-03-10', 30), '2026-03-25')!.balance).toBe(-10000)
  // ...and a bill already past on the start date is NOT re-charged
  expect(projectDaily([bill], 0, '2026-03-26', 3).points).toHaveLength(1)
})

test('biweekly lands on real dates, so three-paycheck months appear', () => {
  // The smoothed ×26/12 never shows this: May 2026 pays on the 1st, 15th and 29th.
  const p = projectDaily(
    [flow({ direction: 'income', amount_cents: 100000, cadence: 'biweekly', start_date: '2026-05-01' })],
    0, '2026-05-01', 30,
  )
  expect(p.points.filter((x) => x.delta > 0).map((x) => x.date))
    .toEqual(['2026-05-01', '2026-05-15', '2026-05-29'])
  expect(p.points[p.points.length - 1].balance).toBe(300000)
})

test('bimonthly and every-4-months skip the months they are not due', () => {
  // The failure this guards: charging an every-other-month water bill monthly.
  const p = projectDaily([
    flow({ id: 'w', name: 'Water', amount_cents: 10000, cadence: 'bimonthly', start_date: '2026-01-15', due_day: 15 }),
    flow({ id: 'g', name: 'Garbage', amount_cents: 20000, cadence: 'every_4_months', start_date: '2026-01-15', due_day: 15 }),
  ], 0, '2026-01-01', 365)

  // water every other month; garbage rides along on Jan, May, Sep only
  expect(p.points.filter((x) => x.date.endsWith('-15')).map((x) => x.date)).toEqual([
    '2026-01-15', '2026-03-15', '2026-05-15', '2026-07-15', '2026-09-15', '2026-11-15',
  ])
  expect(at(p, '2026-01-15')!.delta).toBe(-30000) // both due
  expect(at(p, '2026-03-15')!.delta).toBe(-10000) // water only
  expect(at(p, '2026-05-15')!.delta).toBe(-30000) // both again
})

test('same-day flows merge into one point', () => {
  const p = projectDaily([
    flow({ id: 'a', amount_cents: 1000, due_day: 9 }),
    flow({ id: 'b', amount_cents: 2000, due_day: 9 }),
  ], 10000, '2026-02-01', 28)
  expect(p.points).toHaveLength(2)
  expect(at(p, '2026-02-09')).toEqual({ date: '2026-02-09', delta: -3000, balance: 7000 })
})

test('day 31 clamps into short months', () => {
  const p = projectDaily([flow({ amount_cents: 1000, due_day: 31 })], 0, '2026-02-01', 28)
  expect(p.points[1].date).toBe('2026-02-28')
})

test('unknown amounts and undateable flows are excluded, not zeroed', () => {
  const p = projectDaily([
    flow({ id: 'k', name: 'Known', amount_cents: 1000, due_day: 5 }),
    flow({ id: 'u', name: 'Unknown', amount_cents: null, due_day: 5 }),
    flow({ id: 'n', name: 'No due day', amount_cents: 9999, cadence: 'monthly' }),
  ], 0, '2026-03-01', 31)
  expect(p.missing).toEqual(['Unknown'])
  expect(p.unplaced.map((f) => f.name)).toEqual(['No due day'])
  expect(p.points[p.points.length - 1].balance).toBe(-1000) // only the known one moved money
})

test('hypothetical income stays out; tax set-aside comes off; lean drops non-essentials', () => {
  const base = [
    flow({ id: 'i', direction: 'income', amount_cents: 100000, due_day: 1, tax_setaside_pct: 30 }),
    flow({ id: 'h', direction: 'income', amount_cents: 500000, due_day: 1, committed: false }),
    flow({ id: 'e', amount_cents: 10000, due_day: 2, essential: false }),
  ]
  expect(at(projectDaily(base, 0, '2026-03-01', 10), '2026-03-01')!.balance).toBe(70000)
  const lean = projectDaily(base, 0, '2026-03-01', 10, { lean: true })
  expect(lean.points[lean.points.length - 1].balance).toBe(70000) // non-essential expense dropped
})

test('an override changes one occurrence and nothing else', () => {
  // The reason overrides exist: a utility bill that is a different number every month.
  const bill = flow({ id: 'pge', name: 'Power', amount_cents: 20000, due_day: 17 })
  const p = projectDaily([bill], 100000, '2026-01-01', 90, {
    overrides: [{ flow_id: 'pge', occurs_on: '2026-02-17', amount_cents: 50000, skipped: false, note: 'cold snap' }],
  })
  expect(p.rows.map((r) => r.delta)).toEqual([-20000, -50000, -20000]) // Jan rule, Feb override, Mar rule
  expect(p.rows[1].overridden).toBe(true)
  expect(p.rows[1].note).toBe('cold snap')
  expect(p.rows[0].overridden).toBe(false)
  // everything after shifts by exactly the difference, the rule itself is untouched
  expect(p.rows[2].balance).toBe(100000 - 20000 - 50000 - 20000)
  expect(bill.amount_cents).toBe(20000)
})

test('a skipped occurrence drops out entirely', () => {
  const p = projectDaily([flow({ id: 'w', amount_cents: 10000, due_day: 5 })], 50000, '2026-01-01', 90, {
    overrides: [{ flow_id: 'w', occurs_on: '2026-02-05', amount_cents: null, skipped: true, note: null }],
  })
  expect(p.rows.map((r) => r.date)).toEqual(['2026-01-05', '2026-03-05'])
  expect(p.points[p.points.length - 1].balance).toBe(30000)
})

test('rows are the ledger — same running balance the chart draws', () => {
  const p = projectDaily([
    flow({ id: 'r', name: 'Rent', amount_cents: 200000, due_day: 1 }),
    flow({ id: 'p', name: 'Pay', direction: 'income', amount_cents: 300000, due_day: 20 }),
  ], 50000, '2026-03-01', 30) // through Mar 31 — day 31 would pull in April's rent
  expect(p.rows.map((r) => [r.flow.name, r.balance])).toEqual([['Rent', -150000], ['Pay', 150000]])
  expect(p.rows[p.rows.length - 1].balance).toBe(p.points[p.points.length - 1].balance)
})

test('the floor is the shelf, not zero', () => {
  const p = projectDaily([flow({ amount_cents: 30000, due_day: 10 })], 100000, '2026-03-01', 31, { floorCents: 80000 })
  expect(p.firstBelow!.date).toBe('2026-03-10')
  expect(projectDaily([flow({ amount_cents: 30000, due_day: 10 })], 100000, '2026-03-01', 31).firstBelow).toBeNull()
})
