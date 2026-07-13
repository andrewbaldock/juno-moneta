// The Juno service — tool logic (design/juno-design-system/05-system-notes.md §6).
// The app renders; Juno decides what to say and what to change. These handlers run
// against Supabase under RLS as a signed-in household member — never service_role.
//
// Units at this boundary are DOLLARS (*_usd), same as the claude-proxy snapshot
// (README invariant #6). The DB stays integer cents; NULL stays "unknown", never 0.
import type { SupabaseClient } from '@supabase/supabase-js'
import { buildBrief } from '../src/lib/brief'
import { debtOutlooks, liquid, monthLabel, monthlyNet, netWorth, project, runwayMonths } from '../src/lib/metrics'
import type { Account, CashFlow } from '../src/lib/types'

const usd = (cents: number | null) => (cents === null ? null : cents / 100)
const cents = (dollars: number | null | undefined) =>
  dollars === null ? null : dollars === undefined ? undefined : Math.round(dollars * 100)

const nowKey = () => {
  const n = new Date()
  return n.getFullYear() * 12 + n.getMonth()
}

async function loadAll(supa: SupabaseClient) {
  const [a, f] = await Promise.all([
    supa.from('accounts').select('*').order('name'),
    supa.from('cash_flows').select('*').order('name'),
  ])
  if (a.error) throw new Error(a.error.message)
  if (f.error) throw new Error(f.error.message)
  return { accounts: (a.data as Account[]) ?? [], flows: (f.data as CashFlow[]) ?? [] }
}

export async function householdId(supa: SupabaseClient): Promise<string> {
  const { data, error } = await supa.from('households').select('id').limit(1).single()
  if (error || !data) throw new Error(error?.message ?? 'no household')
  return data.id
}

/** Current rows, balances, and the provisional gaps — the whole picture. */
export async function state(supa: SupabaseClient) {
  const { accounts, flows } = await loadAll(supa)
  const key = nowKey()
  const nw = netWorth(accounts)
  const liq = liquid(accounts)
  const net = monthlyNet(flows, key)
  const run = runwayMonths(project(flows, liq.cents, key + 1, 60))
  return {
    accounts: accounts.map((a) => ({
      id: a.id, name: a.name, kind: a.kind, category: a.category,
      balance_usd: usd(a.balance_cents), rate_pct: a.interest_rate, notes: a.notes,
    })),
    cash_flows: flows.map((f) => ({
      id: f.id, name: f.name, direction: f.direction, category: f.category,
      amount_usd: usd(f.amount_cents), cadence: f.cadence,
      start_date: f.start_date, end_date: f.end_date, active: f.active,
      essential: f.essential, committed: f.committed,
      tax_setaside_pct: f.tax_setaside_pct, pays_down_account_id: f.account_id, notes: f.notes,
    })),
    computed: {
      net_worth_usd: usd(nw.cents),
      liquid_usd: usd(liq.cents),
      monthly_net_usd: usd(net.cents),
      runway_months: run,   // null = beyond 5 years
    },
    gaps: [
      ...accounts.filter((a) => a.balance_cents === null).map((a) => `${a.name} (balance)`),
      ...flows.filter((f) => f.active && f.amount_cents === null).map((f) => `${f.name} (amount)`),
    ],
  }
}

const ACCOUNT_FIELDS = ['name', 'kind', 'category', 'interest_rate', 'last4', 'notes'] as const
const FLOW_FIELDS = [
  'name', 'direction', 'category', 'cadence', 'start_date', 'end_date',
  'active', 'essential', 'committed', 'tax_setaside_pct', 'account_id', 'notes',
] as const

function toRecord(table: 'accounts' | 'cash_flows', fields: Record<string, unknown>) {
  const allowed: readonly string[] = table === 'accounts' ? ACCOUNT_FIELDS : FLOW_FIELDS
  const rec: Record<string, unknown> = {}
  for (const k of allowed) if (k in fields) rec[k] = fields[k]
  if (table === 'accounts' && 'balance_usd' in fields) rec.balance_cents = cents(fields.balance_usd as number | null)
  if (table === 'cash_flows' && 'amount_usd' in fields) rec.amount_cents = cents(fields.amount_usd as number | null)
  return rec
}

export async function addRow(supa: SupabaseClient, table: 'accounts' | 'cash_flows', fields: Record<string, unknown>) {
  const rec = { ...toRecord(table, fields), household_id: await householdId(supa) }
  const { data, error } = await supa.from(table).insert(rec).select('id,name').single()
  if (error) throw new Error(error.message)
  return { created: data }
}

export async function updateRow(supa: SupabaseClient, table: 'accounts' | 'cash_flows', id: string, patch: Record<string, unknown>) {
  const rec = toRecord(table, patch)
  if (Object.keys(rec).length === 0) throw new Error('nothing to update — no recognized fields in patch')
  const { data, error } = await supa.from(table).update(rec).eq('id', id).select('id,name').single()
  if (error) throw new Error(error.message)
  return { updated: data }
}

export async function removeRow(supa: SupabaseClient, table: 'accounts' | 'cash_flows', id: string) {
  const { data, error } = await supa.from(table).delete().eq('id', id).select('id,name')
  if (error) throw new Error(error.message)
  if (!data?.length) throw new Error('no row with that id (or not yours to delete)')
  return { removed: data[0] }
}

/** Durable cross-session memory. */
export async function remember(supa: SupabaseClient, note: string) {
  const rec = { note, household_id: await householdId(supa) }
  const { data, error } = await supa.from('juno_notes').insert(rec).select('id,created_at').single()
  if (error) throw new Error(error.message)
  return { remembered: data }
}

export async function recall(supa: SupabaseClient, topic?: string) {
  let q = supa.from('juno_notes').select('id,note,created_at').order('created_at', { ascending: false }).limit(20)
  if (topic) q = q.ilike('note', `%${topic}%`)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return { notes: data ?? [] }
}

/** Forward view — cash projection, runway, and where each debt is heading. */
export async function projectForward(supa: SupabaseClient, horizonMonths = 24) {
  const { accounts, flows } = await loadAll(supa)
  const key = nowKey()
  const liq = liquid(accounts).cents
  const months = Math.max(1, Math.min(60, Math.round(horizonMonths)))
  const pts = project(flows, liq, key + 1, 60)
  return {
    cash: pts.slice(0, months).map((p) => ({ month: monthLabel(p.key), cumulative_usd: usd(p.cumulative) })),
    runway_months: runwayMonths(pts),
    runway_months_lean: runwayMonths(project(flows, liq, key + 1, 60, true)),
    debts: debtOutlooks(accounts, flows, key + 1).map((o) => ({
      name: o.name,
      status: o.unlinked ? 'no payment linked' : o.underwater ? 'payment does not cover interest' :
        o.payoffKey === null ? 'paid off beyond 50 years' : `paid off ${monthLabel(o.payoffKey)}`,
    })),
  }
}

/** The on-open greeting for one specific person — she speaks to one person. */
export async function brief(supa: SupabaseClient, user: string) {
  const { accounts, flows } = await loadAll(supa)
  return buildBrief(user, accounts, flows)
}
