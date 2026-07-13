// The Juno service — a local stdio MCP server (same shape as Magic Sticky).
// Run: bun mcp/server.ts   (registered for Claude Code via .mcp.json at repo root)
//
// Auth: signs in as a real household member with SMOKE_EMAIL / SMOKE_PASSWORD
// from .env, so every query runs under RLS with a short-lived Supabase JWT.
// ponytail: session JWT is the "scoped token" for now; per-tool scoped tokens
// when this ever leaves this machine (05-system-notes.md security note).
import { createClient } from '@supabase/supabase-js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import * as h from './handlers'

const URL = process.env.VITE_SUPABASE_URL
const KEY = process.env.VITE_SUPABASE_ANON_KEY
const EMAIL = process.env.SMOKE_EMAIL
const PASSWORD = process.env.SMOKE_PASSWORD
if (!URL || !KEY || !EMAIL || !PASSWORD) {
  console.error('juno-mcp: missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / SMOKE_EMAIL / SMOKE_PASSWORD in .env')
  process.exit(1)
}

const supa = createClient(URL, KEY, { auth: { persistSession: false } })
const { error: authError } = await supa.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
if (authError) {
  console.error(`juno-mcp: sign-in failed — ${authError.message}`)
  process.exit(1)
}

const server = new McpServer({ name: 'juno', version: '1.0.0' })

// stdout belongs to the MCP transport; logs go to stderr.
const asText = (v: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(v, null, 1) }] })
const asError = (e: unknown) => ({
  content: [{ type: 'text' as const, text: `error: ${e instanceof Error ? e.message : String(e)}` }],
  isError: true,
})
const run = async (fn: () => Promise<unknown>) => {
  try { return asText(await fn()) } catch (e) { return asError(e) }
}

const TABLE = z.enum(['accounts', 'cash_flows']).describe('which ledger table')

server.registerTool('juno_state', {
  description: 'The whole household picture: accounts, cash flows, computed net worth / liquid / monthly net / runway, and the provisional gaps (unknown values excluded from totals, never counted as $0). Dollar fields are *_usd.',
  inputSchema: {},
}, () => run(() => h.state(supa)))

server.registerTool('juno_add_row', {
  description: 'Add a ledger row. accounts: name, kind (asset|liability), category, balance_usd (omit/null = unknown), interest_rate (APR % for debts, growth %/yr for assets), notes. cash_flows: name, direction (income|expense), category, amount_usd, cadence (monthly|biweekly|weekly|annual|bimonthly|every_4_months|one_time), start_date/end_date (YYYY-MM-DD), essential, committed, tax_setaside_pct, account_id (links a payment to the debt it pays down), notes.',
  inputSchema: {
    table: TABLE,
    fields: z.record(z.string(), z.unknown()).describe('column values; money as *_usd dollars'),
  },
}, ({ table, fields }) => run(() => h.addRow(supa, table, fields)))

server.registerTool('juno_update_row', {
  description: 'Update a ledger row by id. Same fields as juno_add_row; only recognized fields are applied. Set balance_usd/amount_usd to null to mark a value unknown (never 0).',
  inputSchema: {
    table: TABLE,
    id: z.string().min(1),
    patch: z.record(z.string(), z.unknown()).describe('fields to change; money as *_usd dollars'),
  },
}, ({ table, id, patch }) => run(() => h.updateRow(supa, table, id, patch)))

server.registerTool('juno_remove_row', {
  description: 'Delete a ledger row by id. Deleting an account also deletes its balance history — prefer juno_update_row {active:false} for cash flows that merely ended.',
  inputSchema: { table: TABLE, id: z.string().min(1) },
}, ({ table, id }) => run(() => h.removeRow(supa, table, id)))

server.registerTool('juno_remember', {
  description: 'Save a durable note to Juno’s cross-session memory (decisions, worries voiced, context worth keeping).',
  inputSchema: { note: z.string().min(1).max(2000) },
}, ({ note }) => run(() => h.remember(supa, note)))

server.registerTool('juno_recall', {
  description: 'Recall from Juno’s memory: latest 20 notes, or notes matching a topic substring.',
  inputSchema: { topic: z.string().optional() },
}, ({ topic }) => run(() => h.recall(supa, topic)))

server.registerTool('juno_project', {
  description: 'Forward view: monthly liquid-cash projection (committed income only), runway (current + lean), and each debt’s payoff outlook.',
  inputSchema: { horizon_months: z.number().int().min(1).max(60).optional().describe('default 24') },
}, ({ horizon_months }) => run(() => h.projectForward(supa, horizon_months ?? 24)))

server.registerTool('juno_brief', {
  description: 'The on-open greeting for one specific person (Juno speaks to one person, never both): the single most worth-knowing observation, ranked by urgency × actionability.',
  inputSchema: { user: z.string().min(1).describe('the household member to greet, by first name') },
}, ({ user }) => run(() => h.brief(supa, user)))

await server.connect(new StdioServerTransport())
console.error('juno-mcp: ready (signed in, RLS scoped)')
