import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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
const M = 12 // viewport margin
const GAP = 18 // spotlight pad + breathing room

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi))

// Where the hint card goes. Never off-screen: below the target if it fits, else
// above, else beside it, and whatever we pick is clamped into the viewport.
export function place(rect: DOMRect | null, h: number): React.CSSProperties {
  const vw = window.innerWidth, vh = window.innerHeight
  if (!rect) return { top: clamp((vh - h) / 2, M, vh - h - M), left: clamp((vw - W) / 2, M, vw - W - M) }

  const left = clamp(rect.left, M, Math.max(M, vw - W - M))
  if (rect.bottom + GAP + h <= vh - M) return { top: rect.bottom + GAP, left }
  if (rect.top - GAP - h >= M) return { top: rect.top - GAP - h, left }

  // tall target (a full-height column): sit beside it instead
  const top = clamp(rect.top, M, Math.max(M, vh - h - M))
  const right = rect.right + GAP
  return { top, left: right + W <= vw - M ? right : clamp(rect.left - GAP - W, M, Math.max(M, vw - W - M)) }
}

export function DemoTour() {
  const [running, setRunning] = useState(false)
  const [i, setI] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [cardH, setCardH] = useState(180)

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
      const r = el?.getBoundingClientRect()
      // a collapsed/hidden target measures 0×0 — treat it as no target, not as (0,0)
      if (r && r.width > 0 && r.height > 0) {
        el!.scrollIntoView({ block: 'center', behavior: 'smooth' })
        setRect(r)
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

  // the card's own height decides whether it fits above/below the target
  useLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.offsetHeight)
  }, [running, i, rect])

  function start() {
    window.dispatchEvent(new Event('juno:expand')) // every panel visible before we point at one
    setI(0)
    setRunning(true)
  }
  function finish() { setRunning(false) }
  const next = () => (i + 1 < STEPS.length ? setI(i + 1) : finish())
  const back = () => setI(Math.max(0, i - 1))

  // tooltip placement: below, else above, else beside — always clamped on-screen
  const pad = 8
  const card = place(rect, cardH)

  return (
    <>
      {/* persistent pills — reopen the welcome, restart the tour, or reset, at any time */}
      <div className="fixed top-20 right-4 z-40 flex flex-wrap justify-end items-center gap-2">
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
          <div ref={cardRef} className="fixed z-[51] w-[320px] bg-card border border-line rounded-2xl p-4 shadow-xl"
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
