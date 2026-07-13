// Rows are hers: Juno edits the ledger from conversation (05-system-notes.md §5).
// The edge fn returns proposed edits; THIS code validates, resolves names → ids,
// and converts dollars → cents. She can add and update — never delete (an account
// delete takes its balance history with it; that stays a human move in the tables).
import { formatCents } from './money'
import type { Account, CashFlow } from './types'

export type LedgerEdit = {
  op: 'add' | 'update'
  table: 'accounts' | 'cash_flows'
  target_name?: string
  fields: Record<string, unknown>
}

const OPS = ['add', 'update']
const TABLES = ['accounts', 'cash_flows']

/** Shape-check whatever the model sent; drop anything malformed. Cap 5. */
export function validateEdits(raw: unknown): LedgerEdit[] {
  if (!Array.isArray(raw)) return []
  const out: LedgerEdit[] = []
  for (const e of raw.slice(0, 5)) {
    if (typeof e !== 'object' || e === null) continue
    const { op, table, target_name, fields } = e as Record<string, unknown>
    if (typeof op !== 'string' || !OPS.includes(op)) continue
    if (typeof table !== 'string' || !TABLES.includes(table)) continue
    if (op === 'update' && typeof target_name !== 'string') continue
    if (typeof fields !== 'object' || fields === null) continue
    out.push({ op: op as LedgerEdit['op'], table: table as LedgerEdit['table'], target_name: target_name as string | undefined, fields: fields as Record<string, unknown> })
  }
  return out
}

export type ResolvedEdit =
  | { kind: 'insert'; table: LedgerEdit['table']; record: Record<string, unknown>; summary: string }
  | { kind: 'update'; table: LedgerEdit['table']; id: string; record: Record<string, unknown>; summary: string; fillsGap: boolean }
  | { kind: 'skipped'; reason: string }

const ACCOUNT_FIELDS = ['name', 'kind', 'category', 'interest_rate', 'last4', 'titled_to', 'notes']
const FLOW_FIELDS = ['name', 'direction', 'category', 'cadence', 'start_date', 'end_date', 'active', 'essential', 'committed', 'tax_setaside_pct', 'notes']

/** Dollars (or null = unknown) → integer cents; anything non-finite is rejected as undefined. */
function centsOf(v: unknown): number | null | undefined {
  if (v === null) return null
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v * 100)
  return undefined
}

function toRecord(table: LedgerEdit['table'], fields: Record<string, unknown>, accounts: Account[]) {
  const allowed = table === 'accounts' ? ACCOUNT_FIELDS : FLOW_FIELDS
  const rec: Record<string, unknown> = {}
  for (const k of allowed) if (k in fields) rec[k] = fields[k]
  if (table === 'accounts' && 'balance_usd' in fields) {
    const c = centsOf(fields.balance_usd)
    if (c !== undefined) rec.balance_cents = c
  }
  if (table === 'cash_flows') {
    if ('amount_usd' in fields) {
      const c = centsOf(fields.amount_usd)
      if (c !== undefined) rec.amount_cents = c
    }
    // she links a payment to the debt it pays down by name
    if (typeof fields.pays_down_name === 'string') {
      const debt = accounts.find((a) => a.kind === 'liability' && a.name.toLowerCase() === (fields.pays_down_name as string).toLowerCase())
      if (debt) rec.account_id = debt.id
    }
  }
  return rec
}

function money(rec: Record<string, unknown>): string | null {
  const c = (rec.balance_cents ?? rec.amount_cents) as number | null | undefined
  if (c === undefined) return null
  return c === null ? 'unknown' : formatCents(c)
}

/** Resolve validated edits against the live rows. Unknown update targets are skipped, never guessed. */
export function resolveEdits(edits: LedgerEdit[], accounts: Account[], flows: CashFlow[]): ResolvedEdit[] {
  return edits.map((e): ResolvedEdit => {
    const rec = toRecord(e.table, e.fields, accounts)

    if (e.op === 'add') {
      if (typeof rec.name !== 'string' || !(rec.name as string).trim()) return { kind: 'skipped', reason: 'add without a name' }
      if (e.table === 'accounts' && rec.kind !== 'asset' && rec.kind !== 'liability') return { kind: 'skipped', reason: `add "${rec.name}" without kind` }
      if (e.table === 'cash_flows' && rec.direction !== 'income' && rec.direction !== 'expense') return { kind: 'skipped', reason: `add "${rec.name}" without direction` }
      const amt = money(rec)
      return {
        kind: 'insert', table: e.table, record: rec,
        summary: `added ${rec.name}${amt ? ` — ${amt}` : ''}`,
      }
    }

    const rows: Array<Account | CashFlow> = e.table === 'accounts' ? accounts : flows
    const target = rows.find((r) => r.name.toLowerCase() === (e.target_name as string).toLowerCase())
    if (!target) return { kind: 'skipped', reason: `no row named "${e.target_name}"` }
    const changed = Object.keys(rec)
    if (changed.length === 0) return { kind: 'skipped', reason: `nothing recognizable to change on "${target.name}"` }

    const fillsGap = e.table === 'accounts'
      ? (('balance_cents' in rec && rec.balance_cents !== null && (target as Account).balance_cents === null) ||
         ('interest_rate' in rec && rec.interest_rate !== null && (target as Account).interest_rate === null))
      : ('amount_cents' in rec && rec.amount_cents !== null && (target as CashFlow).amount_cents === null)

    const amt = money(rec)
    return {
      kind: 'update', table: e.table, id: target.id, record: rec, fillsGap,
      summary: `updated ${target.name}${amt ? ` — ${amt}` : ` (${changed.join(', ')})`}`,
    }
  })
}
