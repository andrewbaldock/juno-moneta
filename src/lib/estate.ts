// Phase 7: estate basics — the documents checklist and the trust-funding tracker.
// A trust that owns nothing still routes everything through probate; the whole
// point of this module is to make that gap visible and walk it down to zero.
import type { Account, EstateItem } from './types'

/** The personal document set every adult should have; the trust is shared. */
export const PERSONAL_DOCS = ['will', 'financial_poa', 'healthcare_directive'] as const

export const TRUST_PERSON = 'Household'

/** The rows "Start the checklist" creates: one trust, three documents per person. */
export function seedEstateItems(householdId: string, people: string[]) {
  return [
    { household_id: householdId, item_type: 'trust' as const, person: TRUST_PERSON },
    ...people.flatMap((person) =>
      PERSONAL_DOCS.map((item_type) => ({ household_id: householdId, item_type, person })),
    ),
  ]
}

/** A trust document exists in some form (anything past 'not started'). */
export function trustExists(items: EstateItem[]): boolean {
  return items.some((i) => i.item_type === 'trust' && i.status !== 'none')
}

/** Asset accounts still outside the trust with no beneficiary designation — the funding to-do list. */
export function unfundedAssets(accounts: Account[]): Account[] {
  return accounts.filter((a) => a.kind === 'asset' && a.titled_to !== 'trust' && a.titled_to !== 'beneficiary')
}

/** The brief-worthy state: a trust exists, assets exist, and not one is titled to it. */
export function trustUnfunded(items: EstateItem[], accounts: Account[]): boolean {
  const assets = accounts.filter((a) => a.kind === 'asset')
  return trustExists(items) && assets.length > 0 && !assets.some((a) => a.titled_to === 'trust')
}

/** How to actually move each kind of asset — Contra Costa / California specifics where they matter. */
export function fundingHint(a: Account): string {
  switch (a.category) {
    case 'home_value':
      return 'A trust transfer deed + PCOR filed with the county recorder moves it — no Prop 13 reassessment for a revocable trust.'
    case 'retirement':
      return 'Don’t retitle retirement accounts into a trust — name a beneficiary (usually each other) and mark it beneficiary-set here.'
    case 'brokerage':
      return 'The brokerage can retitle it into the trust, or add a transfer-on-death beneficiary.'
    case 'checking':
    case 'savings':
    case 'cash':
      return 'The bank can retitle it into the trust, or add a payable-on-death beneficiary.'
    case 'vehicle':
      return 'Vehicles are often left outside a trust on purpose — worth one question to the trust attorney.'
    default:
      return 'Retitle it into the trust, or add a beneficiary designation.'
  }
}
