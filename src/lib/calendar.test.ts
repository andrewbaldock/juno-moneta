import { describe, expect, test } from 'bun:test'
import { monthEvents } from './calendar'
import type { CashFlow } from './types'

const flow = (over: Partial<CashFlow>): CashFlow => ({
  id: 'f1', household_id: 'h', name: 'Bill', direction: 'expense', category: 'utilities',
  amount_cents: 100_00, cadence: 'monthly', start_date: null, end_date: null, active: true,
  essential: true, tax_setaside_pct: null, committed: true, account_id: null,
  due_day: null, late_after_days: null, autopay: false, notes: null, updated_at: '', ...over,
})

describe('monthEvents', () => {
  test('monthly with a due day lands on it; grace period sets the late date', () => {
    const { events } = monthEvents([flow({ due_day: 5, late_after_days: 10 })], 2026, 7) // Aug 2026
    expect(events).toHaveLength(1)
    expect(events[0].date).toBe('2026-08-05')
    expect(events[0].lateBy).toBe('2026-08-15')
  })

  test('monthly with no due day falls back to the start-date day; neither → unplaced', () => {
    const anchored = monthEvents([flow({ start_date: '2026-01-17' })], 2026, 7)
    expect(anchored.events[0].date).toBe('2026-08-17')
    const lost = monthEvents([flow({})], 2026, 7)
    expect(lost.events).toHaveLength(0)
    expect(lost.unplaced).toHaveLength(1)
  })

  test('due day 31 clamps to the month\'s real end', () => {
    const { events } = monthEvents([flow({ due_day: 31 })], 2026, 1) // Feb 2026
    expect(events[0].date).toBe('2026-02-28')
  })

  test('biweekly steps by 14 days from its anchor, twice or thrice a month', () => {
    const { events } = monthEvents([flow({ cadence: 'biweekly', start_date: '2026-07-03' })], 2026, 7) // Aug
    expect(events.map((e) => e.date)).toEqual(['2026-08-14', '2026-08-28'])
  })

  test('bimonthly fires only on its months; annual only on its month', () => {
    const bi = flow({ cadence: 'bimonthly', start_date: '2026-01-10' })
    expect(monthEvents([bi], 2026, 6).events).toHaveLength(1)  // Jul = +6 months
    expect(monthEvents([bi], 2026, 7).events).toHaveLength(0)  // Aug = +7
    const annual = flow({ cadence: 'annual', start_date: '2025-12-10', due_day: 10 })
    expect(monthEvents([annual], 2026, 11).events[0]?.date).toBe('2026-12-10')
    expect(monthEvents([annual], 2026, 7).events).toHaveLength(0)
  })

  test('one-time lands on its date; window edges respected (ended/inactive/future never appear)', () => {
    const flows = [
      flow({ id: 'a', name: 'Roof', cadence: 'one_time', start_date: '2026-08-20' }),
      flow({ id: 'b', name: 'Old bill', due_day: 5, end_date: '2026-07-31' }),
      flow({ id: 'c', name: 'Off', due_day: 5, active: false }),
      flow({ id: 'd', name: 'Later', due_day: 5, start_date: '2026-09-01' }),
    ]
    const { events } = monthEvents(flows, 2026, 7)
    expect(events.map((e) => e.flow.name)).toEqual(['Roof'])
  })
})
