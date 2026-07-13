// Juno calendar feed — a live ICS of every dated occurrence, recomputed on
// each fetch. Auth is the secret token in the URL (verify_jwt is OFF at
// deploy: Google/Apple Calendar fetch this anonymously). The token lives at
// households.settings.calendar.token — rotate by updating that value and the
// ics_url beside it. Known ceiling: Google polls subscribed feeds ~12–24h.
import { buildIcs } from './ics.ts'
import type { CashFlow } from './types.ts'

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get('t') ?? ''
  // UUID shape only — doubles as the injection guard for the PostgREST filter
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(token)) {
    return new Response('not found', { status: 404 })
  }

  const base = Deno.env.get('SUPABASE_URL')!
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const headers = { apikey: key, authorization: `Bearer ${key}` }

  const households: { id: string }[] = await fetch(
    `${base}/rest/v1/households?select=id&settings->calendar->>token=eq.${token}`,
    { headers },
  ).then((r) => r.json())
  if (!households[0]) return new Response('not found', { status: 404 })

  const flows: CashFlow[] = await fetch(
    `${base}/rest/v1/cash_flows?household_id=eq.${households[0].id}&active=is.true`,
    { headers },
  ).then((r) => r.json())

  const now = new Date()
  return new Response(buildIcs(flows, { y: now.getUTCFullYear(), m0: now.getUTCMonth() }), {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'cache-control': 'no-cache',
    },
  })
})
