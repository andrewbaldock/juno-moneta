import { describe, expect, test } from 'bun:test'
import { actionTasks, annualReviewTask, checklistTasks, gapTasks, structuralTasks } from './tasks'
import { LAW_REVIEWED } from './law'
import type { Account, CashFlow } from './types'

const reviewedYear = Number(LAW_REVIEWED.slice(0, 4))

const acct = (over: Partial<Account>): Account => ({
  id: 'a1', household_id: 'h', name: 'X', kind: 'asset', category: 'checking',
  balance_cents: 0, interest_rate: null, last4: null, titled_to: 'unknown', details: {}, notes: null, updated_at: '', ...over,
})
const flow = (over: Partial<CashFlow>): CashFlow => ({
  id: 'f1', household_id: 'h', name: 'Y', direction: 'expense', category: 'misc',
  amount_cents: 0, cadence: 'monthly', start_date: null, end_date: null, active: true,
  essential: true, tax_setaside_pct: null, committed: true, account_id: null, due_day: null, late_after_days: null, autopay: false, notes: null, updated_at: '', ...over,
})

describe('gapTasks', () => {
  test('unknown balance, missing debt rate, unknown amount each become a chore', () => {
    const tasks = gapTasks(
      [acct({ id: 'a1', name: 'Chase card', kind: 'liability', category: 'credit_card', balance_cents: null })],
      [flow({ id: 'f1', name: 'Apple TV', amount_cents: null })],
    )
    expect(tasks.map((t) => t.key)).toEqual(['gap:balance:a1', 'gap:rate:a1', 'gap:amount:f1'])
    expect(tasks[0].goto).toBe('accounts')
    expect(tasks[2].goto).toBe('monthly')
  })

  test('known values and inactive flows produce nothing', () => {
    const tasks = gapTasks(
      [acct({ balance_cents: 100, kind: 'asset' })],
      [flow({ amount_cents: null, active: false })],
    )
    expect(tasks).toEqual([])
  })

})

describe('annualReviewTask', () => {
  test('a year past the review stamp raises one year-keyed review task', () => {
    const tasks = annualReviewTask(new Date(`${reviewedYear + 1}-06-01`))
    expect(tasks.length).toBe(1)
    expect(tasks[0].kind).toBe('review')
    expect(tasks[0].key).toBe(`review:law:${reviewedYear + 1}`)
  })

  test('within the reviewed year (or earlier) it stays quiet', () => {
    expect(annualReviewTask(new Date(`${reviewedYear}-06-01`))).toEqual([])
    expect(annualReviewTask(new Date(`${reviewedYear - 1}-06-01`))).toEqual([])
  })
})

describe('checklistTasks', () => {
  const home = acct({ id: 'h1', name: 'Home', category: 'home_value', balance_cents: 100_000_000 })

  test('missing categories become questions; conditional ones respect the household shape', () => {
    const asks = checklistTasks([home], [])
    expect(asks.every((t) => t.kind === 'ask')).toBe(true)
    expect(asks.map((t) => t.key)).toContain('ask:property_tax')
    expect(asks.map((t) => t.key)).not.toContain('ask:fuel') // no vehicle → no fuel question
    // renters are never asked about property tax
    expect(checklistTasks([acct({ balance_cents: 100 })], []).map((t) => t.key)).not.toContain('ask:property_tax')
  })

  test('any row in the category silences its question — even amount-unknown', () => {
    const flows = [flow({ id: 'pt', name: 'Property taxes', category: 'property_tax', amount_cents: null })]
    expect(checklistTasks([home], flows).map((t) => t.key)).not.toContain('ask:property_tax')
    // and that row raises the normal enter-the-amount chore instead
    expect(gapTasks([home], flows).map((t) => t.key)).toEqual(['gap:amount:pt'])
  })

  test('a "yes" payload carries what the row needs; an empty app asks nothing', () => {
    const ask = checklistTasks([home], []).find((t) => t.key === 'ask:property_tax')!
    expect(ask.create).toMatchObject({ category: 'property_tax', cadence: 'annual', essential: true })
    expect(checklistTasks([], [])).toEqual([])
  })
})

describe('structuralTasks', () => {
  test('only prefixed notes become tasks, prefix stripped, note id kept for deletion', () => {
    const tasks = structuralTasks([
      { id: 'n1', note: 'structural gap: no way to track quarterly estimated taxes' },
      { id: 'n2', note: 'Maya decided to refinance in October' },
    ])
    expect(tasks).toHaveLength(1)
    expect(tasks[0].title).toBe('no way to track quarterly estimated taxes')
    expect(tasks[0].noteId).toBe('n1')
  })
})

describe('actionTasks', () => {
  const action = (title: string, priority = 1) => ({
    title, rationale: 'because', impact_estimate: '+2 mo runway', effort: 'low' as const, priority,
  })

  test('dedupes by title across conversations, keeping the newest (first seen)', () => {
    const tasks = actionTasks([
      { actions: [action('Refinance the HELOC'), action('Trim subscriptions')] },
      null,
      { actions: [action('refinance the heloc')] },   // older duplicate, different case
    ])
    expect(tasks.map((t) => t.title)).toEqual(['Refinance the HELOC', 'Trim subscriptions'])
    expect(tasks[0].effort).toBe('low')
    expect(tasks[0].impact).toBe('+2 mo runway')
  })
})
