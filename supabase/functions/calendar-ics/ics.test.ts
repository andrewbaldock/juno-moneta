import { describe, expect, test } from 'bun:test'
import { buildIcs } from './ics.ts'
import type { CashFlow } from './types.ts'

const flow = (over: Partial<CashFlow>): CashFlow => ({
  id: 'f1', household_id: 'h', name: 'Bill', direction: 'expense', category: 'utilities',
  amount_cents: 100_00, cadence: 'monthly', start_date: null, end_date: null, active: true,
  essential: true, tax_setaside_pct: null, committed: true, account_id: null,
  due_day: null, late_after_days: null, autopay: false, notes: null, updated_at: '', ...over,
})

describe('buildIcs', () => {
  test('a monthly flow yields one all-day event per month across the 14-month window', () => {
    const ics = buildIcs([flow({ due_day: 5 })], { y: 2026, m0: 6 }) // window Jun 2026 – Jul 2027
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(14)
    expect(ics).toContain('DTSTART;VALUE=DATE:20260705')
    expect(ics).toContain('DTSTART;VALUE=DATE:20270705')
    expect(ics).toContain('UID:f1-2026-07-05@juno')
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
  })

  test('summary carries the amount, + on income, nothing when unknown', () => {
    const ics = buildIcs([
      flow({ id: 'a', name: 'Rent', amount_cents: 2450_00, due_day: 1 }),
      flow({ id: 'b', name: 'Pay', direction: 'income', amount_cents: 1234_56, due_day: 2 }),
      flow({ id: 'c', name: 'Mystery', amount_cents: null, due_day: 3 }),
    ], { y: 2026, m0: 6 })
    expect(ics).toContain('SUMMARY:Rent — $2\\,450')
    expect(ics).toContain('SUMMARY:Pay — +$1\\,234.56')
    expect(ics).toContain('SUMMARY:Mystery\r\n')
  })

  test('autopay and grace period land in the description; commas and semicolons escape', () => {
    const ics = buildIcs([flow({ name: 'PG&E; gas, electric', due_day: 5, late_after_days: 10, autopay: true })], { y: 2026, m0: 6 })
    expect(ics).toContain('SUMMARY:PG&E\\; gas\\, electric')
    expect(ics).toContain('DESCRIPTION:autopay · late after 2026-07-15')
  })

  test('a one-time flow appears exactly once, only inside the window', () => {
    const ics = buildIcs([
      flow({ id: 'in', cadence: 'one_time', start_date: '2026-09-15' }),
      flow({ id: 'out', cadence: 'one_time', start_date: '2028-01-15' }),
    ], { y: 2026, m0: 6 })
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1)
    expect(ics).toContain('UID:in-2026-09-15@juno')
  })
})
