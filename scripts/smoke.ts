// Live smoke check: bun run smoke
// Verifies the deployed site, login, RLS-visible data, blocked signups, and the Claude proxy.
// Needs SMOKE_EMAIL / SMOKE_PASSWORD in .env (bun loads it automatically).

import { APP_NAME } from '../src/brand'

const SITE = 'https://juno.andrewbaldock.com'
const SUPA = process.env.VITE_SUPABASE_URL!
const KEY = process.env.VITE_SUPABASE_ANON_KEY!
const EMAIL = process.env.SMOKE_EMAIL
const PW = process.env.SMOKE_PASSWORD

const failures: string[] = []
const ok = (name: string, pass: boolean, detail = '') => {
  console.log(`${pass ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!pass) failures.push(name)
}

const site = await fetch(SITE)
ok('site up over HTTPS', site.status === 200)
ok('site is the app', (await site.text()).includes(`<title>${APP_NAME}</title>`))

if (!EMAIL || !PW) {
  ok('credentials present', false, 'add SMOKE_EMAIL and SMOKE_PASSWORD to .env')
} else {
  const login = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PW }),
  })
  const session = await login.json()
  ok('login works', !!session.access_token, session.error_description ?? '')

  if (session.access_token) {
    const h = { apikey: KEY, Authorization: `Bearer ${session.access_token}` }
    for (const table of ['accounts', 'cash_flows']) {
      const res = await fetch(`${SUPA}/rest/v1/${table}?select=id`, { headers: h })
      const rows = await res.json()
      ok(`${table} readable under RLS`, Array.isArray(rows) && rows.length > 0, `${rows.length ?? 0} rows`)
    }
    const proxy = await fetch(`${SUPA}/functions/v1/claude-proxy`, {
      method: 'POST',
      headers: { ...h, 'Content-Type': 'application/json' },
      body: JSON.stringify({ health: true }),
    })
    const reply = await proxy.json().catch(() => ({}))
    ok('claude proxy alive', proxy.status === 200 && !!reply.reply)
  }
}

const signup = await fetch(`${SUPA}/auth/v1/signup`, {
  method: 'POST',
  headers: { apikey: KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'stranger@example.com', password: 'whatever123' }),
})
ok('stranger signup blocked', signup.status !== 200)

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`)
  process.exit(1)
}
console.log('\nall good')
