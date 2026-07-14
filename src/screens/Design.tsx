// Juno's design system, as a public page at /design — a portfolio-grade showcase of the
// visual language, styled in that language itself (the page IS the demonstration). Everything
// reads from the same live CSS tokens the app uses, so the light/dark toggle here recolors the
// whole thing. Reachable with no login (App renders it before the auth gate).
import { useEffect, useState } from 'react'
import { APP_NAME } from '../brand'
import {
  COIN_SRC, MarkOwn, MarkSavings, MarkSpending, MarkIncome, MarkOwe,
  Sun, Moon, Rays, TempleGarden,
} from '../components/juno/motifs'
import { FlowDiagram, LoopDiagram, GrowDiagram, AgentDiagram, GroundedDiagram } from '../components/juno/diagrams'
import { CompositionBars, LineChart, AccountCard } from './Dashboard'
import type { Account } from '../lib/types'

// Mock ledger so the real workspace components (charts, cards) render on this public page
// without touching the database. The Rivera-ish shape keeps the composition strip believable.
const acct = (name: string, kind: Account['kind'], category: string, dollars: number): Account => ({
  id: name, household_id: 'demo', name, kind, category, balance_cents: dollars * 100,
  interest_rate: null, last4: null, titled_to: 'unknown', details: {}, notes: null, updated_at: '2026-01-01',
})
export const MOCK_ACCOUNTS: Account[] = [
  acct('The house', 'asset', 'home_value', 780000),
  acct('Maya · 401(k)', 'asset', 'retirement', 95000),
  acct('Daniel · 401(k)', 'asset', 'retirement', 62000),
  acct('Joint savings', 'asset', 'savings', 48000),
  acct('Checking', 'asset', 'checking', 12400),
  acct('Mortgage', 'liability', 'mortgage', 441300),
  acct('Auto loan', 'liability', 'auto_loan', 18500),
  acct('Credit card', 'liability', 'credit_card', 6200),
]
export const CASH_POINTS = [6040, 6280, 6120, 6550, 6800, 7300, 7150, 7600, 7950, 8300, 8750, 9200]
  .map((k, i) => ({ label: ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'][i], cents: k * 1000 }))

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display font-semibold text-[22px] mt-12 mb-1">{children}</h2>
}
function Sub({ children }: { children: React.ReactNode }) {
  return <p className="text-[13.5px] text-muted mb-3 max-w-2xl leading-relaxed">{children}</p>
}
function Rule({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="mb-2.5">
      <p className="text-[13.5px] font-medium">{term}</p>
      <p className="text-[13px] text-muted max-w-2xl">{children}</p>
    </div>
  )
}

/** A single design token, shown as its color over a labelled caption. */
function Swatch({ token, name, role }: { token: string; name: string; role: string }) {
  return (
    <div className="rounded-lg border border-line overflow-hidden bg-card">
      <div className="h-12" style={{ background: `var(--${token})` }} />
      <div className="px-2.5 py-1.5">
        <p className="text-[12px] font-medium text-ink">{name}</p>
        <p className="text-[11px] text-muted leading-snug">{role}</p>
        <p className="text-[10px] text-faint num mt-0.5">--{token}</p>
      </div>
    </div>
  )
}

function Pill({ family, children }: { family: 'amber' | 'gold' | 'mint'; children: React.ReactNode }) {
  return (
    <span className="text-[11px] rounded-full px-2.5 py-0.5 border"
      style={{ background: `var(--${family}-soft)`, color: `var(--${family}-ink)`, borderColor: `var(--${family}-line)` }}>
      {children}
    </span>
  )
}

/** A motif in a small labelled well. Marks stroke gold via .mo; others carry their own color. */
function Motif({ name, note, children }: { name: string; note: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-card p-3 flex flex-col items-center text-center">
      <div className="h-16 grid place-items-center [&_svg]:w-8 [&_svg]:h-8">{children}</div>
      <p className="text-[12px] font-medium text-ink mt-1">{name}</p>
      <p className="text-[11px] text-muted leading-snug">{note}</p>
    </div>
  )
}

export default function Design() {
  const [dark, setDark] = useState(() => document.documentElement.getAttribute('data-mode') === 'dark')
  useEffect(() => {
    document.documentElement.setAttribute('data-mode', dark ? 'dark' : 'light')
    localStorage.setItem('juno.mode', dark ? 'dark' : 'light')
  }, [dark])

  return (
    <div className="min-h-screen" style={{ background: 'var(--page)', color: 'var(--ink)' }}>
      <div className="max-w-4xl mx-auto px-6 py-10">

        {/* header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <a href="/" className="text-[12.5px] text-muted hover:text-ink">← {APP_NAME}</a>
          <button type="button" onClick={() => setDark(!dark)}
            className="modebtn modeicon" aria-label={dark ? 'Switch to day' : 'Switch to night'}
            title={dark ? 'Switch to day' : 'Switch to night'}>
            {dark ? <Moon /> : <Sun />}
          </button>
        </div>

        <div className="flex items-center gap-5 mt-6">
          <img src={COIN_SRC} alt={APP_NAME} width={84} height={84} className="shrink-0" />
          <div>
            <p className="text-[11px] tracking-[.18em] uppercase text-gold-ink">Design system</p>
            <h1 className="font-display font-semibold text-[38px] leading-none mt-0.5">Juno Moneta</h1>
          </div>
        </div>
        <p className="text-[15px] text-muted mt-5 max-w-2xl leading-relaxed">
          Juno is named for <a href="https://en.wikipedia.org/wiki/Juno_Moneta" target="_blank" rel="noreferrer"
            className="text-ink font-semibold underline decoration-mint-line underline-offset-2 hover:decoration-mint">Juno Moneta</a> — the Roman goddess whose temple
          housed the mint (our word <em>money</em> comes from her). The application is her
          <b className="text-ink"> temple and spa of financial wellbeing</b>: a calm place to see the
          whole picture clearly and leave steadier than you came.
        </p>

        <H>Voice</H>
        <Sub>
          Juno speaks to one person, in plain modern English — warm and direct, no hype, no doom, no
          filler. She leads with the biggest lever and lets the real numbers do the settling.
        </Sub>
        <div className="rounded-xl border border-gold-line bg-card p-4 my-3 max-w-2xl">
          <p className="voice text-[15px]" style={{ color: 'var(--ink)' }}>
            “Evening. The month runs about <span className="n">$840</span> out at the current pace, with{' '}
            <span className="n">14 months</span> of runway behind it. Nothing to fix tonight.”
          </p>
          <p className="text-[11px] text-muted mt-2">Her speech is set in Newsreader italic; money inside it stays Inter tabular.</p>
        </div>

        <H>Color</H>
        <Sub>
          <b style={{ color: 'var(--gold-ink)' }}>Gold</b> is the coin — wealth and prosperity, a little
          divine goodwill. <b style={{ color: 'var(--mint-ink)' }}>Mint</b> is the temple's greenery — nature
          and calm. In the app, gold leans toward what-ifs and mint toward where you actually stand. Colors
          chosen to look good in Day or Night mode — try it{' '}
          <button type="button" onClick={() => setDark(!dark)}
            className="p-0 border-0 bg-transparent text-mint-ink underline decoration-mint-line underline-offset-2 hover:decoration-mint cursor-pointer">
            here
          </button>.
        </Sub>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 my-3">
          <Swatch token="mint" name="Mint" role="Nature and calm — and the live numbers" />
          <Swatch token="gold" name="Gold" role="Wealth and prosperity — and what-ifs" />
          <Swatch token="amber-line" name="Amber" role="A number Juno's still waiting on" />
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Pill family="amber">add balance</Pill>
          <Pill family="amber">add rate</Pill>
          <Pill family="gold">hypothetical</Pill>
          <Pill family="mint">on track</Pill>
        </div>
        <Sub>Movement and surfaces:</Sub>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 my-3">
          <Swatch token="up" name="Up" role="net worth rising" />
          <Swatch token="down" name="Down" role="falling / underwater" />
          <Swatch token="page" name="Page" role="parchment ground" />
          <Swatch token="card" name="Card" role="raised surface" />
          <Swatch token="sunken" name="Sunken" role="wells & insets" />
          <Swatch token="ink" name="Ink" role="primary text" />
        </div>

        <H>Type</H>
        <Sub>Three families, each with one job.</Sub>
        <div className="rounded-xl border border-line bg-card p-5 my-3 space-y-4 max-w-2xl">
          <div>
            <p className="font-display font-semibold text-[34px] leading-none" style={{ color: 'var(--ink)' }}>Juno Moneta</p>
            <p className="text-[11px] text-muted mt-1">Display — Cormorant Garamond, for mastheads and section heads.</p>
          </div>
          <div>
            <p className="voice text-[17px]" style={{ color: 'var(--ink)' }}>She answers from the real numbers, and only the real numbers.</p>
            <p className="text-[11px] text-muted mt-1">Voice — Newsreader, for everything Juno herself says.</p>
          </div>
          <div>
            <p className="text-[14px]" style={{ color: 'var(--ink)' }}>Interface copy, labels, and body text are set in Inter.</p>
            <p className="text-[11px] text-muted mt-1">Sans — Inter (variable).</p>
          </div>
          <div>
            <p className="num text-[17px]" style={{ color: 'var(--ink)' }}>$348,717.00 · 4.63% · 14 mo</p>
            <p className="text-[11px] text-muted mt-1">Numerals — Inter tabular figures, so columns of money align.</p>
          </div>
        </div>

        <H>Mark &amp; motifs</H>
        <Sub>
          Roman objects, not generic fintech glyphs — a struck coin with its natural, uneven edge
          (never circle-cropped), a temple, a garden that tracks the time of day.
        </Sub>
        <div className="flex items-center gap-4 rounded-xl border border-line bg-card p-4 my-3 max-w-2xl">
          <img src={COIN_SRC} alt="The Juno coin" width={72} height={72} className="shrink-0" />
          <div>
            <p className="text-[13px] text-ink font-medium">The coin — the logo</p>
            <p className="text-[13px] text-muted">Struck, with its natural ragged edge kept intact. On good news it briefly beams gold and mint rays past the frame.</p>
          </div>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5 my-3">
          <Motif name="Own" note="temple / house"><MarkOwn /></Motif>
          <Motif name="Savings" note="the arca jar"><MarkSavings /></Motif>
          <Motif name="Spending" note="a coin"><MarkSpending /></Motif>
          <Motif name="Income" note="wheat sheaf"><MarkIncome /></Motif>
          <Motif name="Owe" note="folded ledger"><MarkOwe /></Motif>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-3">
          <div className="rounded-xl border border-line bg-card p-4 flex items-center gap-4">
            <div className="relative w-24 h-24 grid place-items-center shrink-0 [&_svg]:w-full [&_svg]:h-full">
              <Rays />
            </div>
            <div>
              <p className="text-[13px] text-ink font-medium">Rays</p>
              <p className="text-[12px] text-muted">Gold and mint interleaved — the beam behind the coin when something good lands.</p>
            </div>
          </div>
          <div className="rounded-xl border border-line bg-card p-4 overflow-hidden">
            <div style={{ color: 'var(--mint)' }}><TempleGarden w={320} h={120} coin={0} /></div>
            <p className="text-[13px] text-ink font-medium mt-1">Temple garden</p>
            <p className="text-[12px] text-muted">An engraved mint colonnade that changes with the hour — day sun, night crescent and stars.</p>
          </div>
        </div>

        <H>Diagrams</H>
        <Sub>
          Bespoke inline SVG in the same tokens, shared between this page, the Help reference, and the
          demo welcome — so a picture is drawn once and never drifts.
        </Sub>
        <div className="rounded-xl border border-line bg-card px-4 py-2 my-3">
          <FlowDiagram />
          <LoopDiagram />
          <GroundedDiagram />
          <GrowDiagram />
          <AgentDiagram />
        </div>

        <H>Components</H>
        <Sub>Soft radii (8–12px), low-contrast line borders, gold reserved for the hypothetical layer.</Sub>
        <div className="flex flex-wrap items-center gap-2.5 my-3">
          <button type="button" className="btn-mint">Primary (mint)</button>
          <button type="button" className="btn-gold">What-if (gold)</button>
          <button type="button" className="btn-quiet">Quiet</button>
          <input className="field" style={{ width: 160 }} placeholder="A field" readOnly />
          <span className="whopill">Name pill</span>
          <span className="pchip">amber chip</span>
          <span className="bluechip">mint chip</span>
        </div>
        <Rule term="Cards, rules, chips">Content sits on rounded cards over the parchment ground; definitions use a term-over-muted-description pattern (like this one); status reads through the three pill families above.</Rule>

        <H>Cards, banners &amp; charts</H>
        <Sub>The real workspace components — rendered here on mock numbers, exactly as they appear in the app.</Sub>

        <div className="cards">
          <AccountCard mark={<MarkOwn />} name="What you own" balance="$997,400" />
          <AccountCard mark={<MarkSavings />} name="Savings & liquid" balance="$60,400" whisper="≈ 5 years of runway" />
          <AccountCard mark={<MarkOwe />} name="What you owe" balance="$466,000" />
        </div>

        <div className="prov"><b style={{ fontWeight: 500 }}>Provisional</b> — a couple of balances aren't entered yet, so they're left out of the totals rather than counted as $0.</div>
        <div className="mnet">
          <span className="lab">Kept each month, at current pace · runway 5+ yrs</span>
          <span className="v">+$3,101.67</span>
        </div>

        <CompositionBars accounts={MOCK_ACCOUNTS} />

        <div className="chart">
          <div className="ct">Cash — next 12 months</div>
          <div className="cs">Liquid cash month by month, on one shared scale — the mint line is the live path, the dashed gold line the do-not-touch shelf.</div>
          <LineChart points={CASH_POINTS} showZero floor={3000000} />
        </div>

        <div className="mt-12 mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <a href="/" className="btn-mint">Enter {APP_NAME} →</a>
          <a href="/help" className="text-[12.5px] text-mint-ink underline decoration-mint-line underline-offset-2">How Juno works</a>
          <a href="https://juno-storybook.andrewbaldock.com" target="_blank" rel="noreferrer" className="text-[12.5px] text-mint-ink underline decoration-mint-line underline-offset-2">Storybook</a>
          <a href="https://andrewbaldock.com" target="_blank" rel="noreferrer" className="text-[12.5px] text-mint-ink underline decoration-mint-line underline-offset-2">Portfolio</a>
          <a href="https://github.com/andrewbaldock/juno-moneta" target="_blank" rel="noreferrer" className="text-[12.5px] text-mint-ink underline decoration-mint-line underline-offset-2">The code</a>
        </div>
      </div>
    </div>
  )
}
