// The task center: one list merging data-gap chores (amber) with the advisor's
// action items harvested from past conversations.
import type { Action } from './advisor'
import { LAW_REVIEWED } from './law'
import type { Account, CashFlow } from './types'

export type Task = {
  key: string                    // stable id for dismissal
  kind: 'gap' | 'action' | 'structural' | 'ask' | 'review'
  title: string
  detail?: string
  effort?: Action['effort']
  impact?: string
  goto?: 'accounts' | 'monthly'  // gap tasks link to the screen that fixes them
  noteId?: string                // structural tasks: the juno_notes row backing them
  create?: {                     // ask tasks: the row a "yes" creates (amount stays unknown)
    name: string
    category: string
    cadence: CashFlow['cadence']
    essential: boolean
  }
}

export const STRUCTURAL_PREFIX = 'structural gap: '

// dismissals live in localStorage per device (shared here so the tab dot can respect them)
export const DONE_KEY = 'juno.tasks.done'
export const loadDone = (): Set<string> => {
  try { return new Set(JSON.parse(localStorage.getItem(DONE_KEY) ?? '[]')) } catch { return new Set() }
}

/** Gaps Juno flagged in the APP itself — stored as prefixed juno_notes. */
export function structuralTasks(notes: Array<{ id: string; note: string }>): Task[] {
  return notes
    .filter((n) => n.note.toLowerCase().startsWith(STRUCTURAL_PREFIX))
    .map((n) => ({
      key: `structural:${n.id}`,
      kind: 'structural' as const,
      title: n.note.slice(STRUCTURAL_PREFIX.length),
      detail: 'Juno flagged this — the app has no place for it yet.',
      noteId: n.id,
    }))
}

/** Every unknown value is a chore: enter it and the whole picture sharpens. */
export function gapTasks(accounts: Account[], flows: CashFlow[]): Task[] {
  const tasks: Task[] = []
  for (const a of accounts) {
    if (a.balance_cents === null) {
      tasks.push({ key: `gap:balance:${a.id}`, kind: 'gap', title: `Enter the balance for ${a.name}`, goto: 'accounts' })
    }
    if (a.kind === 'liability' && a.interest_rate === null) {
      tasks.push({ key: `gap:rate:${a.id}`, kind: 'gap', title: `Add the interest rate for ${a.name}`, goto: 'accounts' })
    }
  }
  for (const f of flows) {
    if (f.active && f.amount_cents === null) {
      tasks.push({ key: `gap:amount:${f.id}`, kind: 'gap', title: `Enter the amount for ${f.name}`, goto: 'monthly' })
    }
  }
  return tasks
}

/**
 * The template in the world — what a household like this usually has. An expense
 * category with NO row at all becomes a QUESTION, not a nag: "yes" creates the row
 * (amount unknown, which feeds the fill-in flow), "no" dismisses it and nothing happens.
 * The null-amount chore above can't fire on a row that was never made; this can.
 */
type Check = {
  category: string
  name: string
  ask: string
  cadence?: CashFlow['cadence']
  essential?: boolean
  when?: (accounts: Account[]) => boolean
}
const ownsHome = (a: Account[]) => a.some((x) => x.kind === 'asset' && x.category === 'home_value')
const hasVehicle = (a: Account[]) => a.some((x) => x.kind === 'asset' && x.category === 'vehicle')
const CHECKLIST: Check[] = [
  { category: 'housing', name: 'Housing', ask: 'a mortgage or rent payment' },
  { category: 'property_tax', name: 'Property taxes', ask: 'property taxes', cadence: 'annual', when: ownsHome },
  { category: 'insurance', name: 'Insurance', ask: 'insurance premiums — home, auto, health, dental' },
  { category: 'utilities', name: 'Utilities', ask: 'utility bills — power, water, trash' },
  { category: 'groceries', name: 'Groceries', ask: 'a grocery budget' },
  { category: 'phone', name: 'Phone', ask: 'a phone plan' },
  { category: 'internet', name: 'Internet', ask: 'an internet bill' },
  { category: 'fuel', name: 'Fuel', ask: 'fuel costs', when: hasVehicle },
  { category: 'medical', name: 'Medical', ask: 'recurring medical or dental costs' },
  { category: 'pets', name: 'Pets', ask: 'pet costs — food, vet' },
  { category: 'subscription', name: 'Subscriptions', ask: 'subscriptions — streaming, software', essential: false },
]

export function checklistTasks(accounts: Account[], flows: CashFlow[]): Task[] {
  if (accounts.length === 0 && flows.length === 0) return [] // an empty app gets onboarding, not an interrogation
  return CHECKLIST
    .filter((c) => (c.when ? c.when(accounts) : true))
    .filter((c) => !flows.some((f) => f.active && f.direction === 'expense' && f.category === c.category))
    .map((c) => ({
      key: `ask:${c.category}`,
      kind: 'ask' as const,
      title: `Do you have ${c.ask}?`,
      detail: 'Nothing in the ledger for this. Yes adds the row — the amount can come later. No, and it disappears.',
      create: { name: c.name, category: c.category, cadence: c.cadence ?? 'monthly', essential: c.essential ?? true },
    }))
}

/**
 * Once a year the law constants (src/lib/law.ts) may drift — IRS COLA in Nov, HSA
 * Rev. Proc. in May, FTB/EDD rates. Nag from Jan 1 of any year past LAW_REVIEWED and
 * keep nagging until someone re-verifies and bumps the stamp. The year in the key
 * makes it reappear each new year even if last year's was dismissed.
 */
export function annualReviewTask(now: Date = new Date()): Task[] {
  const reviewedYear = Number(LAW_REVIEWED.slice(0, 4))
  if (now.getFullYear() <= reviewedYear) return []
  return [{
    key: `review:law:${now.getFullYear()}`,
    kind: 'review',
    title: 'Verify the law constants for this year',
    detail: 'Several tax figures adjust annually. Check IRS COLA (401k/IRA, each Nov), '
          + 'IRS Rev. Proc. (HSA, each May), ftb.ca.gov estimated-payments, and the EDD SDI rate. '
          + 'Update src/lib/law.ts values + effectiveDate, then bump LAW_REVIEWED.',
  }]
}

/**
 * Advisor actions from past conversations, newest first, deduped by title
 * (case-insensitive — she often repeats her best advice).
 */
export function actionTasks(payloads: Array<{ actions?: Action[] } | null>): Task[] {
  const seen = new Set<string>()
  const tasks: Task[] = []
  for (const p of payloads) {
    for (const a of p?.actions ?? []) {
      const id = a.title.trim().toLowerCase()
      if (!id || seen.has(id)) continue
      seen.add(id)
      tasks.push({
        key: `action:${id}`,
        kind: 'action',
        title: a.title,
        detail: a.rationale,
        impact: a.impact_estimate,
        effort: a.effort,
      })
    }
  }
  return tasks
}
