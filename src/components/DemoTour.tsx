import { useEffect, useLayoutEffect, useState } from 'react'
import { resetDemo } from '../lib/demo'

// The public demo's guided tour — the UI walkthrough that follows the Welcome modal.
// It starts on demand (the Welcome's "Take the tour" fires juno:tour, or the "Tour"
// pill), never on its own. Steps spotlight a real element and float a Juno-voiced hint
// beside it; nothing is blocked — the overlay is click-through, so a visitor can wander
// off and back anytime.

type Step = { sel?: string; title: string; body: string }

const STEPS: Step[] = [
  {
    sel: '#c2',
    title: 'She opens with what matters.',
    body: "Juno has already read the whole picture — cash flow, debts, runway — and leads with the one thing worth knowing today, before you ask a thing.",
  },
  {
    sel: '.composer',
    title: 'Ask her anything.',
    body: "Plain questions or what-ifs, both answered from the real numbers: “what if Maya lost her job?”, “pay the card off in six months?”, “can we afford a bigger place?”",
  },
  {
    sel: '.chips',
    title: 'Or start with a nudge.',
    body: "Not sure where to begin? These starters are drawn from this household's own situation. A what-if draws a second line on the chart — today's path against the road not taken.",
  },
  {
    sel: '.tabbar',
    title: 'Her workspace.',
    body: "Dashboard, the tasks she's noticed, monthly in & out, accounts & debts, and the estate. Add or edit anything here — or just ask Juno and she'll keep the ledger for you.",
  },
  {
    sel: 'button[title="How Juno works"]',
    title: 'How she works.',
    body: "The ? opens a look under the hood — how Juno reasons from your numbers, and the design system behind her temple-and-spa look.",
  },
]

const W = 320

export function DemoTour() {
  const [running, setRunning] = useState(false)
  const [i, setI] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)

  // the Welcome modal (or the Tour pill) starts the walkthrough — never on its own
  useEffect(() => {
    const go = () => start()
    window.addEventListener('juno:tour', go)
    return () => window.removeEventListener('juno:tour', go)
  }, [])

  const step = STEPS[i]

  // measure the current step's target (and keep it fresh on resize/scroll)
  useLayoutEffect(() => {
    if (!running) return
    function measure() {
      const el = step.sel ? document.querySelector(step.sel) : null
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        setRect(el.getBoundingClientRect())
      } else {
        setRect(null) // no target → centered card
      }
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [running, i, step.sel])

  function start() { setI(0); setRunning(true) }
  function finish() { setRunning(false) }
  const next = () => (i + 1 < STEPS.length ? setI(i + 1) : finish())
  const back = () => setI(Math.max(0, i - 1))

  // tooltip placement: beside the target if there's room, else centered
  const pad = 8
  let card: React.CSSProperties
  if (rect) {
    const below = rect.bottom + 180 < window.innerHeight
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - W - 12))
    card = below
      ? { top: rect.bottom + pad + 10, left }
      : { top: Math.max(12, rect.top - pad - 10), left, transform: 'translateY(-100%)' }
  } else {
    card = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
  }

  return (
    <>
      {/* persistent pills — reopen the welcome, restart the tour, or reset, at any time */}
      <div className="fixed bottom-4 left-4 z-40 flex items-center gap-2">
        {!running && (
          <>
            <button type="button" onClick={() => window.dispatchEvent(new Event('juno:welcome'))}
              className="flex items-center gap-1.5 bg-card border border-line rounded-full pl-3 pr-3.5 py-1.5 shadow-lg text-[12.5px] hover:border-mint-line transition-colors">
              <span className="text-gold-ink">✦</span>
              <span className="font-medium">Welcome</span>
            </button>
            <button type="button" onClick={start}
              className="bg-card border border-line rounded-full px-3 py-1.5 shadow-lg text-[12.5px] text-muted hover:text-ink transition-colors">
              Tour
            </button>
          </>
        )}
        <button type="button" onClick={resetDemo}
          className="bg-card border border-line rounded-full px-3 py-1.5 shadow-lg text-[12.5px] text-muted hover:text-ink transition-colors"
          title="Restore the fictional Rivera data">
          Reset demo
        </button>
      </div>

      {running && (
        <>
          {/* dim + spotlight (click-through, purely visual) */}
          <div className="fixed inset-0 z-50 pointer-events-none">
            {rect ? (
              <div style={{
                position: 'absolute',
                top: rect.top - pad, left: rect.left - pad,
                width: rect.width + pad * 2, height: rect.height + pad * 2,
                borderRadius: 14,
                boxShadow: '0 0 0 9999px rgba(30,22,10,.42)',
                transition: 'all .28s cubic-bezier(.4,0,.2,1)',
              }} />
            ) : (
              <div className="absolute inset-0" style={{ background: 'rgba(30,22,10,.42)' }} />
            )}
          </div>

          {/* the hint card */}
          <div className="fixed z-[51] w-[320px] bg-card border border-line rounded-2xl p-4 shadow-xl"
            style={{ ...card, boxShadow: '0 12px 40px rgba(60,44,16,.22)' }}>
            <h3 className="font-display font-semibold text-[17px] leading-tight">{step.title}</h3>
            <p className="voice text-[13.5px] text-muted mt-1.5 leading-snug">{step.body}</p>
            <div className="flex items-center justify-between mt-3.5">
              <span className="text-[11px] text-faint tabular-nums">{i + 1} / {STEPS.length}</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={finish} className="btn-quiet text-[12.5px]">Skip</button>
                {i > 0 && <button type="button" onClick={back} className="btn-quiet text-[12.5px]">Back</button>}
                <button type="button" onClick={next} className="btn-mint text-[12.5px] px-3.5 py-1.5">
                  {i + 1 < STEPS.length ? 'Next' : 'Explore'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
