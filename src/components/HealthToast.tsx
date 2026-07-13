import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { APP_NAME } from '../brand.ts'

// Self-health check: watches the connection, the database, and the advisor
// edge function, and shows one gentle toast when something is down. Worst
// fault wins (offline explains the others). Sibling of UpdateToast.
type Fault = 'offline' | 'db' | 'advisor'

const COPY: Record<Fault, string> = {
  offline: `You're offline — ${APP_NAME} will pick right back up when the connection returns.`,
  db: `${APP_NAME} can't reach her records right now. Your data is safe — this usually passes in a minute.`,
  advisor: `${APP_NAME}'s advisor is unreachable at the moment. Everything else still works — try her again in a bit.`,
}

function useHealth(signedIn: boolean): Fault | null {
  const [offline, setOffline] = useState(false)
  const [db, setDb] = useState(false)
  const [advisor, setAdvisor] = useState(false)
  // The advisor probe costs a (tiny) Anthropic call, so it runs once per page
  // load when healthy and only keeps re-probing while it's failing.
  const advisorProbed = useRef(false)

  useEffect(() => {
    if (import.meta.env.DEV) return
    setOffline(!navigator.onLine)
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  useEffect(() => {
    if (import.meta.env.DEV) return
    let cancelled = false

    const check = async () => {
      if (!navigator.onLine) return
      let dbDown = false
      try {
        dbDown = !!(await supabase.from('households').select('id').limit(1)).error
      } catch {
        dbDown = true
      }
      if (cancelled) return
      setDb(dbDown)
      // Can't tell advisor health apart from a db outage, and the edge
      // function rejects signed-out calls (verify_jwt) — skip both cases.
      if (dbDown || !signedIn) return
      if (advisorProbed.current && !advisor) return
      advisorProbed.current = true
      try {
        const { data, error } = await supabase.functions.invoke('claude-proxy', { body: { health: true } })
        if (!cancelled) setAdvisor(!!error || !!(data as { error?: string } | null)?.error)
      } catch {
        if (!cancelled) setAdvisor(true)
      }
    }

    check()
    const id = setInterval(check, 5 * 60_000)
    const onVisible = () => { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [signedIn, advisor])

  return offline ? 'offline' : db ? 'db' : advisor ? 'advisor' : null
}

export function HealthToast({ signedIn }: { signedIn: boolean }) {
  const fault = useHealth(signedIn)
  const [dismissed, setDismissed] = useState<Fault | null>(null)
  useEffect(() => { if (!fault) setDismissed(null) }, [fault])
  if (!fault || fault === dismissed) return null
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-4 bg-card border border-line rounded-2xl px-5 py-3 shadow-lg">
        <span className="text-[13.5px]">{COPY[fault]}</span>
        <button type="button" className="btn-quiet" onClick={() => setDismissed(fault)}>Okay</button>
      </div>
    </div>
  )
}
