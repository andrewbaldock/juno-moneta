import { describe, expect, test } from 'bun:test'
import { buildBrief } from './brief'
import type { Account, CashFlow } from './types'

// A Tuesday morning, 9am local. Cliff dates are computed relative to this.
const NOW = new Date(2026, 6, 14, 9, 0, 0)

let seq = 0
const acct = (over: Partial<Account>): Account => ({
  id: `a${++seq}`, household_id: 'h', name: 'Checking', kind: 'asset', category: 'checking',
  balance_cents: 0, interest_rate: null, last4: null, titled_to: 'unknown', details: {}, notes: null, updated_at: '', ...over,
})
const flow = (over: Partial<CashFlow>): CashFlow => ({
  id: `f${++seq}`, household_id: 'h', name: 'Flow', direction: 'expense', category: 'misc',
  amount_cents: 0, cadence: 'monthly', start_date: null, end_date: null, active: true,
  essential: true, tax_setaside_pct: null, committed: true, account_id: null, due_day: null, late_after_days: null, autopay: false, notes: null, updated_at: '', ...over,
})
const iso = (daysFromNow: number) => {
  const d = new Date(NOW.getTime() + daysFromNow * 86_400_000)
  return d.toISOString().slice(0, 10)
}

describe('buildBrief', () => {
  test('empty household → the introduce-me line', () => {
    const b = buildBrief('Maya', [], [], NOW)
    expect(b.text).toContain('Introduce me to an account')
    expect(b.good).toBe(false)
  })

  test('income cliff inside 60 days, well covered → good news, beams', () => {
    const accounts = [acct({ balance_cents: 100_000_00 })] // $100k liquid
    const flows = [
      flow({ name: 'Severance', direction: 'income', category: 'severance', amount_cents: 8_000_00, end_date: iso(40) }),
      flow({ name: 'Rent', amount_cents: 3_000_00 }),
    ]
    const b = buildBrief('Maya', accounts, flows, NOW)
    expect(b.text).toContain('Severance ends')
    expect(b.text).toContain('Morning, Maya.')
    expect(b.good).toBe(true)
  })

  test('thin runway outranks the cliff and is never "good"', () => {
    const accounts = [acct({ balance_cents: 8_000_00 })] // $8k against $3k/mo burn
    const flows = [
      flow({ name: 'Severance', direction: 'income', category: 'severance', amount_cents: 8_000_00, end_date: iso(20) }),
      flow({ name: 'Everything', amount_cents: 11_000_00 }),
    ]
    const b = buildBrief('Sam', accounts, flows, NOW)
    expect(b.text).toContain('Cash runs')
    expect(b.text).toContain('levers')
    expect(b.good).toBe(false)
    // the cliff still rides along as the footnote
    expect(b.yod).toContain('Severance ends')
  })

  test('the greeted user’s own name is stripped from the flow in her sentence', () => {
    const accounts = [acct({ balance_cents: 100_000_00 })]
    const flows = [
      flow({ name: 'Maya — severance', direction: 'income', category: 'severance', amount_cents: 8_000_00, end_date: iso(40) }),
      flow({ name: 'Rent', amount_cents: 3_000_00 }),
    ]
    const b = buildBrief('Maya', accounts, flows, NOW)
    expect(b.text).toContain('Severance ends')
    expect(b.text).not.toContain('Maya — severance')
  })

  test('debt clearing within 3 months → a day worth circling', () => {
    const debt = acct({ name: 'Car loan', kind: 'liability', category: 'auto_loan', balance_cents: 900_00, interest_rate: 0 })
    const accounts = [acct({ balance_cents: 200_000_00 }), debt]
    const flows = [flow({ name: 'Car payment', amount_cents: 500_00, account_id: debt.id })]
    const b = buildBrief('Maya', accounts, flows, NOW)
    expect(b.text).toContain('Car loan clears in')
    expect(b.good).toBe(true)
  })

  test('negative month with long runway → honest but calm', () => {
    const accounts = [acct({ balance_cents: 200_000_00 })]
    const flows = [flow({ name: 'Living', amount_cents: 3_000_00 })]
    const b = buildBrief('Sam', accounts, flows, NOW)
    expect(b.text).toContain('out at the current pace')
    expect(b.text).toContain('runway behind it')   // quiet framing earned by 5+ yrs runway
    expect(b.good).toBe(false)
  })

  test('unknowns only → the sharpen line', () => {
    const accounts = [acct({ balance_cents: null, name: 'Chase card', kind: 'liability', category: 'credit_card' })]
    const b = buildBrief('Maya', accounts, [], NOW)
    expect(b.text).toContain('still unknown')
  })

  test('late night with nothing alarming → go to bed, news in the footnote', () => {
    const lateNow = new Date(2026, 6, 14, 23, 30, 0)
    const accounts = [acct({ balance_cents: 100_000_00 })]
    const flows = [
      flow({ name: 'Salary', direction: 'income', category: 'salary', amount_cents: 9_000_00, end_date: iso(30) }),
      flow({ name: 'Living', amount_cents: 3_000_00 }),
    ]
    const b = buildBrief('Maya', accounts, flows, lateNow)
    expect(b.text).toContain('Go to bed, Maya')
    expect(b.yod).toContain('Salary ends')
  })

  test('net worth up since last snapshot → the good-team aside, beams', () => {
    const a = acct({ balance_cents: 200_000_00 })
    const snaps = [
      { account_id: a.id, balance_cents: 180_000_00, as_of_date: '2026-07-01' },
      { account_id: a.id, balance_cents: 200_000_00, as_of_date: '2026-07-10' },
    ]
    const b = buildBrief('Sam', [a], [], NOW, snaps)
    expect(b.text).toContain('good team')
    expect(b.good).toBe(true)
  })

  test('net worth down → honest, calm, never "good"', () => {
    const a = acct({ balance_cents: 150_000_00 })
    const snaps = [
      { account_id: a.id, balance_cents: 180_000_00, as_of_date: '2026-07-01' },
      { account_id: a.id, balance_cents: 150_000_00, as_of_date: '2026-07-10' },
    ]
    const b = buildBrief('Sam', [a], [], NOW, snaps)
    expect(b.text).toContain('down')
    expect(b.good).toBe(false)
  })

  test('late night does NOT swallow a thin-runway warning', () => {
    const lateNow = new Date(2026, 6, 14, 23, 30, 0)
    const accounts = [acct({ balance_cents: 5_000_00 })]
    const flows = [flow({ name: 'Everything', amount_cents: 4_000_00 })]
    const b = buildBrief('Maya', accounts, flows, lateNow)
    expect(b.text).toContain('levers')
    expect(b.text).not.toContain('Go to bed')
  })

  test('a signed trust that owns nothing outranks the gap nag; a funded one is quiet', () => {
    const estateItem = {
      id: 'e1', household_id: 'h', item_type: 'trust' as const, person: 'Household',
      status: 'signed' as const, signed_date: null, location: null, notes: null, updated_at: '',
    }
    const accounts = [acct({ balance_cents: 100_000_00 }), acct({ balance_cents: null })]
    const b = buildBrief('Maya', accounts, [], NOW, [], 0, [estateItem])
    expect(b.text).toContain('trust')
    expect(b.text).toContain('probate')
    expect(b.good).toBe(false)
    expect(b.yod).toContain('unknown') // the gap nag rides as the footnote

    const funded = buildBrief('Maya', [acct({ balance_cents: 100_000_00, titled_to: 'trust' })], [], NOW, [], 0, [estateItem])
    expect(funded.text).not.toContain('probate')
  })
})
