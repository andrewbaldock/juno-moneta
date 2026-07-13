import { describe, expect, test } from 'bun:test'
import { fundingHint, seedEstateItems, trustExists, trustUnfunded, unfundedAssets } from './estate'
import type { Account, EstateItem } from './types'

const acct = (over: Partial<Account>): Account => ({
  id: 'a1', household_id: 'h', name: 'X', kind: 'asset', category: 'checking',
  balance_cents: 0, interest_rate: null, last4: null, titled_to: 'unknown', details: {}, notes: null, updated_at: '', ...over,
})
const item = (over: Partial<EstateItem>): EstateItem => ({
  id: 'e1', household_id: 'h', item_type: 'will', person: 'Maya', status: 'none',
  signed_date: null, location: null, notes: null, updated_at: '', ...over,
})

describe('seedEstateItems', () => {
  test('one shared trust plus three documents per person', () => {
    const rows = seedEstateItems('h', ['Maya', 'Sam'])
    expect(rows).toHaveLength(7)
    expect(rows.filter((r) => r.item_type === 'trust')).toHaveLength(1)
    expect(rows.filter((r) => r.person === 'Sam').map((r) => r.item_type).sort())
      .toEqual(['financial_poa', 'healthcare_directive', 'will'])
    expect(rows.every((r) => r.household_id === 'h')).toBe(true)
  })
})

describe('trust funding', () => {
  const signedTrust = item({ item_type: 'trust', person: 'Household', status: 'signed' })

  test('a not-started trust does not exist yet; drafted or signed does', () => {
    expect(trustExists([item({ item_type: 'trust' })])).toBe(false)
    expect(trustExists([item({ item_type: 'trust', status: 'drafted' })])).toBe(true)
    expect(trustExists([item({ status: 'signed' })])).toBe(false) // a signed will is not a trust
  })

  test('unfundedAssets: trust-titled and beneficiary-designated accounts are handled; debts never appear', () => {
    const accounts = [
      acct({ id: 'a1', titled_to: 'trust' }),
      acct({ id: 'a2', titled_to: 'beneficiary', category: 'retirement' }),
      acct({ id: 'a3', titled_to: 'joint' }),
      acct({ id: 'a4', titled_to: 'unknown' }),
      acct({ id: 'a5', kind: 'liability', category: 'mortgage' }),
    ]
    expect(unfundedAssets(accounts).map((a) => a.id)).toEqual(['a3', 'a4'])
  })

  test('trustUnfunded fires only when a trust exists, assets exist, and none are titled to it', () => {
    const outside = acct({ titled_to: 'joint' })
    expect(trustUnfunded([signedTrust], [outside])).toBe(true)
    expect(trustUnfunded([signedTrust], [acct({ titled_to: 'trust' })])).toBe(false)   // one funded → quiet
    expect(trustUnfunded([item({ item_type: 'trust' })], [outside])).toBe(false)       // no trust yet
    expect(trustUnfunded([signedTrust], [])).toBe(false)                               // nothing to fund
    expect(trustUnfunded([signedTrust], [acct({ kind: 'liability', titled_to: 'unknown' })])).toBe(false)
  })

  test('fundingHint knows the moves that differ by asset kind', () => {
    expect(fundingHint(acct({ category: 'home_value' }))).toContain('PCOR')
    expect(fundingHint(acct({ category: 'retirement' }))).toContain('beneficiary')
    expect(fundingHint(acct({ category: 'retirement' }))).toContain('Don’t retitle')
    expect(fundingHint(acct({ category: 'other_asset' }))).toBeTruthy()
  })
})
