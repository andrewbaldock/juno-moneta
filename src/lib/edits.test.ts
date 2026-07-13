import { describe, expect, test } from 'bun:test'
import { resolveEdits, validateEdits } from './edits'
import type { Account, CashFlow } from './types'

const acct = (over: Partial<Account>): Account => ({
  id: 'a1', household_id: 'h', name: 'Chase card', kind: 'liability', category: 'credit_card',
  balance_cents: null, interest_rate: null, last4: null, titled_to: 'unknown', details: {}, notes: null, updated_at: '', ...over,
})
const flow = (over: Partial<CashFlow>): CashFlow => ({
  id: 'f1', household_id: 'h', name: 'Apple TV', direction: 'expense', category: 'subscription',
  amount_cents: null, cadence: 'monthly', start_date: null, end_date: null, active: true,
  essential: false, tax_setaside_pct: null, committed: true, account_id: null, due_day: null, late_after_days: null, autopay: false, notes: null, updated_at: '', ...over,
})

describe('validateEdits', () => {
  test('drops malformed entries, keeps well-formed ones, caps at 5', () => {
    const edits = validateEdits([
      { op: 'add', table: 'cash_flows', fields: { name: 'Property tax' } },
      { op: 'delete', table: 'accounts', fields: {} },          // op not allowed
      { op: 'update', table: 'accounts', fields: {} },          // update without target
      'garbage',
      ...Array(6).fill({ op: 'add', table: 'accounts', fields: {} }),
    ])
    expect(edits.length).toBeLessThanOrEqual(5)
    expect(edits[0].fields.name).toBe('Property tax')
    expect(edits.every((e) => e.op !== 'delete' as string)).toBe(true)
  })

  test('non-array → empty', () => {
    expect(validateEdits({ op: 'add' })).toEqual([])
  })
})

describe('resolveEdits', () => {
  test('add converts dollars to cents and requires direction', () => {
    const [ok, skipped] = resolveEdits([
      { op: 'add', table: 'cash_flows', fields: { name: 'Property tax', direction: 'expense', category: 'property_tax', amount_usd: 750, cadence: 'bimonthly' } },
      { op: 'add', table: 'cash_flows', fields: { name: 'Mystery' } },
    ], [], [])
    expect(ok.kind).toBe('insert')
    if (ok.kind !== 'insert') throw new Error('unreachable')
    expect(ok.record.amount_cents).toBe(75000)
    expect(ok.record.cadence).toBe('bimonthly')
    expect(ok.summary).toContain('added Property tax')
    expect(skipped.kind).toBe('skipped')
  })

  test('update targets by exact name, case-insensitive; unknown target skipped', () => {
    const [hit, miss] = resolveEdits([
      { op: 'update', table: 'accounts', target_name: 'chase CARD', fields: { balance_usd: 4212.5 } },
      { op: 'update', table: 'accounts', target_name: 'Nope', fields: { balance_usd: 1 } },
    ], [acct({})], [])
    expect(hit.kind).toBe('update')
    if (hit.kind !== 'update') throw new Error('unreachable')
    expect(hit.id).toBe('a1')
    expect(hit.record.balance_cents).toBe(421250)
    expect(hit.fillsGap).toBe(true)   // balance was null
    expect(miss.kind).toBe('skipped')
  })

  test('null money means unknown, and filling a known value is not a gap-fill', () => {
    const [toNull, known] = resolveEdits([
      { op: 'update', table: 'cash_flows', target_name: 'Apple TV', fields: { amount_usd: null } },
      { op: 'update', table: 'cash_flows', target_name: 'Gym', fields: { amount_usd: 50 } },
    ], [], [flow({}), flow({ id: 'f2', name: 'Gym', amount_cents: 4500 })])
    if (toNull.kind !== 'update' || known.kind !== 'update') throw new Error('unreachable')
    expect(toNull.record.amount_cents).toBeNull()
    expect(toNull.fillsGap).toBe(false)
    expect(known.fillsGap).toBe(false)
  })

  test('pays_down_name links a payment to its debt; unknown fields never pass through', () => {
    const [r] = resolveEdits([
      { op: 'update', table: 'cash_flows', target_name: 'Apple TV', fields: { pays_down_name: 'chase card', household_id: 'EVIL', id: 'EVIL' } },
    ], [acct({})], [flow({})])
    if (r.kind !== 'update') throw new Error('unreachable')
    expect(r.record.account_id).toBe('a1')
    expect('household_id' in r.record).toBe(false)
    expect('id' in r.record).toBe(false)
  })
})
