import { useEffect, useRef, useState } from 'react'
import { welcome } from '../copy/juno'
import { GrowDiagram, AgentDiagram, GroundedDiagram } from './juno/diagrams'
import { COIN_SRC } from './juno/motifs'

// The demo's front door: a warm, diagram-led welcome, paginated as a slide deck so it
// never scrolls. Auto-shows once, then stays gone (localStorage juno.welcomeSeen).
// Reopenable via the "Welcome" pill (DemoTour fires juno:welcome). It's a native <dialog>,
// so focus-trap, ESC-to-dismiss and the backdrop come free; a backdrop click also dismisses;
// the global prefers-reduced-motion rule (index.css) disables the fades.

// one diagram per beat that has one — the rest are prose-only
const DIAGRAMS: Record<string, () => React.JSX.Element> = {
  grow: GrowDiagram,
  act: AgentDiagram,
  ground: GroundedDiagram,
}

// slide 0 is the intro; the rest are the beats, one per slide
const SLIDES = welcome.beats.length + 1

export function DemoWelcome() {
  const ref = useRef<HTMLDialogElement>(null)
  const [i, setI] = useState(0)

  function open() {
    setI(0) // a reopen starts fresh
    if (!ref.current?.open) ref.current?.showModal()
  }
  function dismiss() {
    ref.current?.close()
    localStorage.setItem('juno.welcomeSeen', '1')
  }

  useEffect(() => {
    if (!localStorage.getItem('juno.welcomeSeen')) open()
    window.addEventListener('juno:welcome', open)
    return () => window.removeEventListener('juno:welcome', open)
  }, [])

  const last = i === SLIDES - 1
  const back = () => setI((n) => Math.max(0, n - 1))
  const next = () => (last ? dismiss() : setI((n) => Math.min(SLIDES - 1, n + 1)))

  function startTour() {
    dismiss()
    window.dispatchEvent(new Event('juno:tour'))
  }
  function openHelp() {
    dismiss()
    history.pushState(null, '', '/help')
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  // a backdrop click lands on the <dialog> itself (padding is 0, .welcome-body fills it)
  function onBackdrop(e: React.MouseEvent) {
    if (e.target === ref.current) dismiss()
  }

  const beat = i > 0 ? welcome.beats[i - 1] : null
  const D = beat ? DIAGRAMS[beat.key] : null

  return (
    <dialog ref={ref} className="jd welcome-dlg" onCancel={dismiss} onClick={onBackdrop}
      aria-labelledby="welcome-title">
      <div className="welcome-body">
        {/* the current slide — keyed on i so the fade re-triggers on each move */}
        <div key={i} className="welcome-slide">
          {i === 0 ? (
            <div className="text-center">
              <img src={COIN_SRC} alt="" width={72} height={72} className="mx-auto" />
              <p className="text-[11px] tracking-[.18em] uppercase text-gold-ink mt-3">{welcome.eyebrow}</p>
              <h2 id="welcome-title" className="font-display font-semibold text-[30px] leading-tight mt-1">{welcome.title}</h2>
              <p className="voice text-[16px] text-ink mt-2 max-w-md mx-auto">{welcome.lede}</p>
              <div className="rounded-xl border border-gold-line bg-card p-3.5 mt-6 flex items-start gap-2.5 text-left max-w-md mx-auto">
                <span className="text-[11px] rounded-full px-2.5 py-0.5 border shrink-0 mt-0.5"
                  style={{ background: 'var(--amber-soft)', color: 'var(--amber-ink)', borderColor: 'var(--amber-line)' }}>
                  {welcome.fictionChip}
                </span>
                <p className="text-[12.5px] text-muted leading-snug">{welcome.fiction}</p>
              </div>
            </div>
          ) : (
            <section className="text-center">
              <h3 className="font-display font-semibold text-[24px]">{beat!.title}</h3>
              <p className="text-[14.5px] text-muted mt-2 leading-relaxed max-w-md mx-auto">{beat!.body}</p>
              {D && <div className="flex justify-center mt-5"><D /></div>}
            </section>
          )}
        </div>

        {/* persistent footer: CTAs · dots · Back/Next */}
        <div className="flex items-center gap-2.5 pt-4 border-t border-line">
          <button type="button" onClick={startTour} className="btn-mint">{welcome.tourCta}</button>
          <button type="button" onClick={openHelp} className="btn-gold">{welcome.helpCta} →</button>
          <span className="flex-1 flex justify-center gap-1.5">
            {Array.from({ length: SLIDES }, (_, n) => (
              <span key={n} className="h-1.5 w-1.5 rounded-full transition-colors"
                style={{ background: n === i ? 'var(--gold-ink)' : 'var(--line-strong)' }} />
            ))}
          </span>
          {i > 0 && <button type="button" onClick={back} className="btn-quiet">Back</button>}
          <button type="button" onClick={next} className="btn-mint">{last ? welcome.dismiss : 'Next'}</button>
        </div>
      </div>
    </dialog>
  )
}
