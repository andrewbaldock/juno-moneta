import { useEffect, useState } from 'react'
import { APP_NAME } from '../brand.ts'
import { Rays } from './juno/motifs'

// Polls /version.json (emitted per-build by vite.config.ts) and compares it to
// the __BUILD_ID__ baked into this bundle. A mismatch means a newer deploy is
// live and this tab is stale.
function useVersionCheck(): boolean {
  const [stale, setStale] = useState(false)

  useEffect(() => {
    if (import.meta.env.DEV || stale) return
    let cancelled = false

    const check = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
        const { buildId } = await res.json()
        if (!cancelled && buildId && buildId !== __BUILD_ID__) setStale(true)
      } catch {
        // offline or mid-deploy — try again next tick
      }
    }

    check() // catches a cached index.html serving an old bundle
    const id = setInterval(check, 5 * 60_000)
    const onVisible = () => { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [stale])

  return stale
}

export function UpdateToast() {
  const stale = useVersionCheck()
  if (!stale) return null
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="uptoast-rays" aria-hidden="true"><Rays /></div>
      <div className="relative flex items-center gap-4 bg-card border border-line rounded-2xl px-5 py-3 shadow-lg">
        <span className="text-[13.5px]">{APP_NAME} has been updated.</span>
        <button type="button" className="btn-mint" onClick={() => location.reload()}>Reload</button>
      </div>
    </div>
  )
}
