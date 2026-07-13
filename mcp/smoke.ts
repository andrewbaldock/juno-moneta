// Live check for the Juno service: signs in, exercises every read tool, and
// round-trips one memory note (insert → recall → delete). Touches NOTHING in
// the real ledger. Run: bun mcp/smoke.ts
import { createClient } from '@supabase/supabase-js'
import * as h from './handlers'

const supa = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
})
const { error } = await supa.auth.signInWithPassword({
  email: process.env.SMOKE_EMAIL!, password: process.env.SMOKE_PASSWORD!,
})
if (error) { console.error(`✗ sign-in: ${error.message}`); process.exit(1) }
console.log('✓ signed in')

const s = await h.state(supa)
if (!s.accounts.length) throw new Error('state returned no accounts')
console.log(`✓ juno_state — ${s.accounts.length} accounts, ${s.cash_flows.length} flows, runway ${s.computed.runway_months ?? '5y+'} mo, ${s.gaps.length} gaps`)

const p = await h.projectForward(supa, 12)
if (p.cash.length !== 12) throw new Error('project returned wrong horizon')
console.log(`✓ juno_project — 12 months, lean runway ${p.runway_months_lean ?? '5y+'} mo, ${p.debts.length} debt outlooks`)

const b = await h.brief(supa, 'Maya')
if (!b.text) throw new Error('brief returned no text')
console.log(`✓ juno_brief — "${b.text.slice(0, 70)}…"${b.good ? ' (beams)' : ''}`)

try {
  const marker = `smoke-note ${Date.now()}`
  const r = await h.remember(supa, marker)
  const found = (await h.recall(supa, 'smoke-note')).notes.some((n) => n.note === marker)
  await supa.from('juno_notes').delete().eq('id', r.remembered.id)
  if (!found) throw new Error('recall did not find the note just remembered')
  console.log('✓ juno_remember / juno_recall — roundtrip + cleanup')
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e)
  if (msg.includes('juno_notes')) {
    console.log('⚠ juno_remember/recall — juno_notes table missing; apply supabase/migrations/0004_juno_notes.sql')
  } else throw e
}

console.log('\nall good')
