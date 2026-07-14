import { useEffect, useRef } from 'react'
import { welcome } from '../copy/juno'
import { GrowDiagram, AgentDiagram, GroundedDiagram } from './juno/diagrams'
import { COIN_SRC } from './juno/motifs'

// The demo's front door: a warm, diagram-led welcome that auto-shows once, then stays
// gone (localStorage juno.welcomeSeen). Reopenable via the "Welcome" pill (DemoTour fires
// juno:welcome). It's a native <dialog>, so focus-trap, ESC-to-dismiss and the backdrop
// come for free; the global prefers-reduced-motion rule (index.css) disables the fade.

// one diagram per beat that has one — the rest are prose-only
const DIAGRAMS: Record<string, () => React.JSX.Element> = {
  grow: GrowDiagram,
  act: AgentDiagram,
  ground: GroundedDiagram,
}

export function DemoWelcome() {
  const ref = useRef<HTMLDialogElement>(null)

  function open() { if (!ref.current?.open) ref.current?.showModal() }
  function dismiss() {
    ref.current?.close()
    localStorage.setItem('juno.welcomeSeen', '1')
  }

  useEffect(() => {
    if (!localStorage.getItem('juno.welcomeSeen')) open()
    window.addEventListener('juno:welcome', open)
    return () => window.removeEventListener('juno:welcome', open)
  }, [])

  function startTour() {
    dismiss()
    window.dispatchEvent(new Event('juno:tour'))
  }
  function openHelp() {
    dismiss()
    history.pushState(null, '', '/help')
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  return (
    <dialog ref={ref} className="jd welcome-dlg" onCancel={dismiss}
      aria-labelledby="welcome-title">
      <div className="welcome-body">
        <div className="text-center">
          <img src={COIN_SRC} alt="" width={72} height={72} className="mx-auto" />
          <p className="text-[11px] tracking-[.18em] uppercase text-gold-ink mt-3">{welcome.eyebrow}</p>
          <h2 id="welcome-title" className="font-display font-semibold text-[30px] leading-tight mt-1">{welcome.title}</h2>
          <p className="voice text-[16px] text-ink mt-2 max-w-md mx-auto">{welcome.lede}</p>
        </div>

        <div className="rounded-xl border border-gold-line bg-card p-3.5 my-5 flex items-start gap-2.5">
          <span className="text-[11px] rounded-full px-2.5 py-0.5 border shrink-0 mt-0.5"
            style={{ background: 'var(--amber-soft)', color: 'var(--amber-ink)', borderColor: 'var(--amber-line)' }}>
            {welcome.fictionChip}
          </span>
          <p className="text-[12.5px] text-muted leading-snug">{welcome.fiction}</p>
        </div>

        {welcome.beats.map((b) => {
          const D = DIAGRAMS[b.key]
          return (
            <section key={b.key} className="mt-6">
              <h3 className="font-display font-semibold text-[19px]">{b.title}</h3>
              <p className="text-[13.5px] text-muted mt-1 leading-relaxed">{b.body}</p>
              {D && <div className="flex justify-center"><D /></div>}
            </section>
          )
        })}

        <div className="flex flex-wrap items-center gap-2.5 mt-7">
          <button type="button" onClick={startTour} className="btn-mint">{welcome.tourCta}</button>
          <button type="button" onClick={openHelp} className="btn-gold">{welcome.helpCta} →</button>
          <span className="sp flex-1" />
          <button type="button" onClick={dismiss} className="btn-quiet">{welcome.dismiss}</button>
        </div>
      </div>
    </dialog>
  )
}
