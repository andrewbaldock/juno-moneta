// The engine, visible: a reference page for how Juno models the household.
// Owner's spec: "almost a wikipedia page about this app and the modeling it's doing."
// Two sub-tabs: "How Juno works" (the model) and "Design system" (the visual language).
import { useState } from 'react'
import { LIQUID_CATEGORIES } from '../lib/metrics'
import { COIN_SM_SRC } from '../components/juno/motifs'

const REPO = 'https://github.com/andrewbaldock/juno-moneta'

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display font-semibold text-[19px] mt-7 mb-2">{children}</h2>
}

function Rule({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="mb-2.5">
      <p className="text-[13.5px] font-medium">{term}</p>
      <p className="text-[13px] text-muted">{children}</p>
    </div>
  )
}

function A({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer" className="text-mint-ink underline decoration-mint-line underline-offset-2">{children}</a>
}

/** Ledger → engine → numbers, in three boxes. */
function FlowDiagram() {
  const box = { fill: 'var(--sunken)', stroke: 'var(--line-strong)', rx: 10 }
  const label = { fontSize: 12, fill: 'var(--ink)', fontFamily: 'var(--sans)' }
  const small = { fontSize: 10, fill: 'var(--muted)', fontFamily: 'var(--sans)' }
  const arrow = { stroke: 'var(--gold)', strokeWidth: 1.5, markerEnd: 'url(#arr)' }
  return (
    <svg viewBox="0 0 640 120" className="w-full max-w-xl my-3" role="img" aria-label="The ledger feeds the engine, the engine produces every number on screen">
      <defs>
        <marker id="arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8" fill="none" stroke="var(--gold)" strokeWidth="1.5" />
        </marker>
      </defs>
      <rect x="8" y="24" width="170" height="72" {...box} />
      <text x="93" y="52" textAnchor="middle" {...label}>The ledger</text>
      <text x="93" y="70" textAnchor="middle" {...small}>accounts · cash flows · shelf</text>
      <text x="93" y="84" textAnchor="middle" {...small}>integer cents, null = unknown</text>
      <line x1="182" y1="60" x2="230" y2="60" {...arrow} />
      <rect x="234" y="24" width="170" height="72" {...box} />
      <text x="319" y="52" textAnchor="middle" {...label}>The engine</text>
      <text x="319" y="70" textAnchor="middle" {...small}>pure functions, month by month</text>
      <text x="319" y="84" textAnchor="middle" {...small}>src/lib/metrics.ts</text>
      <line x1="408" y1="60" x2="456" y2="60" {...arrow} />
      <rect x="460" y="24" width="172" height="72" {...box} />
      <text x="546" y="52" textAnchor="middle" {...label}>Every number shown</text>
      <text x="546" y="70" textAnchor="middle" {...small}>runway · payoffs · net worth</text>
      <text x="546" y="84" textAnchor="middle" {...small}>charts recompute locally</text>
    </svg>
  )
}

/** The advisor loop: snapshot out, structured reply back, app does the math. */
function LoopDiagram() {
  const box = { fill: 'var(--sunken)', stroke: 'var(--line-strong)', rx: 10 }
  const label = { fontSize: 12, fill: 'var(--ink)', fontFamily: 'var(--sans)' }
  const small = { fontSize: 10, fill: 'var(--muted)', fontFamily: 'var(--sans)' }
  return (
    <svg viewBox="0 0 640 150" className="w-full max-w-xl my-3" role="img" aria-label="The app sends Juno a snapshot; Juno returns structured advice; the app verifies and applies it">
      <defs>
        <marker id="arr2" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8" fill="none" stroke="var(--gold)" strokeWidth="1.5" />
        </marker>
      </defs>
      <rect x="8" y="40" width="200" height="72" {...box} />
      <text x="108" y="66" textAnchor="middle" {...label}>The app</text>
      <text x="108" y="84" textAnchor="middle" {...small}>snapshot: names + dollars only,</text>
      <text x="108" y="98" textAnchor="middle" {...small}>today's real date, memory notes</text>
      <path d="M 212 62 C 290 30, 350 30, 426 62" fill="none" stroke="var(--gold)" strokeWidth="1.5" markerEnd="url(#arr2)" />
      <text x="320" y="34" textAnchor="middle" {...small}>question + snapshot</text>
      <rect x="430" y="40" width="202" height="72" {...box} />
      <text x="531" y="66" textAnchor="middle" {...label}>Juno (Claude Sonnet 5)</text>
      <text x="531" y="84" textAnchor="middle" {...small}>one edge function; the API key</text>
      <text x="531" y="98" textAnchor="middle" {...small}>never reaches the browser</text>
      <path d="M 426 96 C 350 128, 290 128, 212 96" fill="none" stroke="var(--gold)" strokeWidth="1.5" markerEnd="url(#arr2)" />
      <text x="320" y="140" textAnchor="middle" {...small}>reply + actions + scenario deltas + ledger edits — the app recomputes ALL math itself</text>
    </svg>
  )
}

/** A single design token, shown as its color over a labelled caption. */
function Swatch({ token, name, role }: { token: string; name: string; role: string }) {
  return (
    <div className="rounded-lg border border-line overflow-hidden bg-card">
      <div className="h-11" style={{ background: `var(--${token})` }} />
      <div className="px-2.5 py-1.5">
        <p className="text-[12px] font-medium text-ink">{name}</p>
        <p className="text-[11px] text-muted leading-snug">{role}</p>
      </div>
    </div>
  )
}

/** A status pill in one of the three semantic families (soft bg / ink text / line border). */
function Pill({ family, children }: { family: 'amber' | 'gold' | 'mint'; children: React.ReactNode }) {
  return (
    <span className="text-[11px] rounded-full px-2.5 py-0.5 border"
      style={{ background: `var(--${family}-soft)`, color: `var(--${family}-ink)`, borderColor: `var(--${family}-line)` }}>
      {children}
    </span>
  )
}

/** The visual language — Juno Moneta, in tokens you can see. Everything reads from the
 *  same CSS variables the app uses, so this page recolors itself in light and dark. */
function DesignSystem() {
  return (
    <>
      <p className="text-[13px] text-muted mb-2">
        Juno is named for <b className="text-ink">Juno Moneta</b> — the Roman goddess whose temple
        housed the mint (our word <em>money</em> comes from her). The app is her <b className="text-ink">temple
        of wealth and spa of financial therapy</b>: a calm place to see the whole picture clearly and
        leave steadier than you came. The look leans into that — warm parchment surfaces, a struck-coin
        mark with a natural (uncropped) edge, a temple-garden that tracks the time of day, and one honest
        voice. Every value below is a live CSS token, so this page recolors itself in day and night mode.
      </p>

      <H>Voice</H>
      <p className="text-[13px] text-muted mb-2">Juno speaks to one person, in plain language.</p>
      <Rule term="Warm, direct, no theatrics">No hype, no doom, no filler. Lead with the biggest lever; let real numbers do the settling.</Rule>
      <Rule term="Honest reassurance only">Steadies nerves through truth — real distance to a feared outcome, benchmarks, the next step — never manufactured comfort, and never announced as reassurance.</Rule>
      <Rule term="One light touch">At most one gently reassuring note per reply, only when the numbers earn it; if the truth is hard, it's said plainly with the next move.</Rule>
      <Rule term="Never Yoda">Despite the repo's old codename, the persona is warm modern English — inverted Yoda cadence is permanently vetoed.</Rule>
      <div className="rounded-xl border border-gold-line bg-card p-4 my-3">
        <p className="voice text-[15px]" style={{ color: 'var(--ink)' }}>
          “Evening. The month runs about <span className="n">$840</span> out at the current pace, with{' '}
          <span className="n">14 months</span> of runway behind it. Nothing to fix tonight.”
        </p>
        <p className="text-[11px] text-muted mt-2">Her speech is set in Newsreader italic; money inside it stays Inter tabular.</p>
      </div>

      <H>Color, by meaning</H>
      <p className="text-[13px] text-muted mb-2">
        Color is semantic, never decorative. Three hues carry the whole system:
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 my-3">
        <Swatch token="mint" name="Mint" role="Today — the live path, the real numbers" />
        <Swatch token="gold" name="Gold" role="Hypothetical — what-if scenarios, and the brand metal" />
        <Swatch token="amber-line" name="Amber" role="“Juno wants this number” — a data gap, not an error" />
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Pill family="amber">add balance</Pill>
        <Pill family="amber">add rate</Pill>
        <Pill family="gold">hypothetical</Pill>
        <Pill family="mint">on track</Pill>
        <span className="text-[11px] text-muted">— amber asks, gold marks a what-if, mint affirms.</span>
      </div>
      <p className="text-[13px] text-muted mb-1">Movement and surfaces:</p>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 my-3">
        <Swatch token="up" name="Up" role="net worth rising" />
        <Swatch token="down" name="Down" role="falling / underwater" />
        <Swatch token="page" name="Page" role="parchment ground" />
        <Swatch token="card" name="Card" role="raised surface" />
        <Swatch token="sunken" name="Sunken" role="wells & insets" />
        <Swatch token="ink" name="Ink" role="primary text" />
      </div>

      <H>Type</H>
      <div className="rounded-xl border border-line bg-card p-4 my-3 space-y-3">
        <div>
          <p className="font-display font-semibold text-[30px] leading-none" style={{ color: 'var(--ink)' }}>Juno Moneta</p>
          <p className="text-[11px] text-muted mt-1">Display — Cormorant Garamond, for mastheads and section heads.</p>
        </div>
        <div>
          <p className="voice text-[16px]" style={{ color: 'var(--ink)' }}>She answers from the real numbers, and only the real numbers.</p>
          <p className="text-[11px] text-muted mt-1">Voice — Newsreader, for everything Juno herself says.</p>
        </div>
        <div>
          <p className="text-[14px]" style={{ color: 'var(--ink)' }}>Interface copy, labels, and body text are set in Inter.</p>
          <p className="text-[11px] text-muted mt-1">Sans — Inter (variable).</p>
        </div>
        <div>
          <p className="num text-[16px]" style={{ color: 'var(--ink)' }}>$348,717.00 · 4.63% · 14 mo</p>
          <p className="text-[11px] text-muted mt-1">Numerals — Inter tabular figures, so columns of money align.</p>
        </div>
      </div>

      <H>Mark & motifs</H>
      <div className="flex items-center gap-4 rounded-xl border border-line bg-card p-4 my-3">
        <img src={COIN_SM_SRC} alt="The Juno coin" width={64} height={64} className="shrink-0" />
        <div>
          <p className="text-[13px] text-ink font-medium">The coin</p>
          <p className="text-[13px] text-muted">A struck coin with its natural, uneven edge — never circle-cropped. On good news it briefly beams gold rays. Motifs are Roman objects (coin, temple, garden), not generic fintech glyphs.</p>
        </div>
      </div>

      <H>Components</H>
      <div className="flex flex-wrap items-center gap-2.5 my-3">
        <button type="button" className="btn-mint">Primary (mint)</button>
        <button type="button" className="btn-gold">What-if (gold)</button>
        <button type="button" className="btn-quiet">Quiet</button>
        <input className="field" style={{ width: 160 }} placeholder="A field" readOnly />
      </div>
      <Rule term="Cards, rules, chips">Content sits on rounded cards over the parchment ground; definitions use a term-over-muted-description pattern (like this one); status reads through the three pill families above. Radii are soft (8–12px), borders are low-contrast lines, and gold is reserved for the hypothetical layer so it never competes with amber's “fill me in.”</Rule>
    </>
  )
}

export default function Help({ onClose }: { onClose: () => void }) {
  const [pane, setPane] = useState<'works' | 'design'>('works')
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: 'var(--page)' }}>
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-baseline justify-between">
          <h1 className="font-display font-semibold text-[26px]">{pane === 'works' ? 'How Juno works' : 'Design system'}</h1>
          <button type="button" onClick={onClose} className="btn-quiet">Close</button>
        </div>

        <div className="flex gap-1 mt-3 mb-1 border-b border-line">
          {([['works', 'How Juno works'], ['design', 'Design system']] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setPane(id)}
              className={`text-[13px] px-3 py-2 -mb-px border-b-2 ${pane === id ? 'border-mint text-ink font-medium' : 'border-transparent text-muted'}`}>
              {label}
            </button>
          ))}
        </div>

        {pane === 'design' && <DesignSystem />}

        {pane === 'works' && (<>
        <p className="text-[13.5px] text-muted mt-3">
          The whole working model — every rule the numbers obey, what the advisor can see and do,
          and where to read more. Nothing here is hidden anywhere else; this page <em>is</em> the engine, written down.
        </p>

        <H>The ledger</H>
        <p className="text-[13px] text-muted mb-2">
          Two tables hold the truth: <b className="text-ink">accounts</b> (assets and debts, each with a balance and a
          rate) and <b className="text-ink">cash flows</b> (every recurring dollar in or out). Three rules protect them:
        </p>
        <Rule term="Money is integer cents, always">Floats appear only when formatting for display — arithmetic can never drift.</Rule>
        <Rule term="A blank is unknown, never $0">Unknown values are excluded from every total and listed as gaps (the amber pills). The totals say "provisional" until the gaps fill.</Rule>
        <Rule term="Committed income only">Hoped-for income never touches the base numbers. It exists only inside clearly-labeled what-if scenarios.</Rule>
        <Rule term="Each account type carries its own fields">A bank account wants its bank and POD beneficiary; a mortgage wants lender, term, escrow; a 401k wants employer, match, beneficiary. The edit dialog shows the fields for the type — informational, never computed on.</Rule>
        <Rule term="Bills know their day">Recurring flows carry a due day, a grace period (late-after days), and an autopay flag. The Calendar view on "Monthly in & out" places every bill on its date — and the same occurrences will feed Juno's shared Google Calendar.</Rule>
        <FlowDiagram />

        <H>The engine, rule by rule</H>
        <Rule term="Monthly smoothing">Every cadence converts to a monthly equivalent: biweekly ×26÷12, weekly ×52÷12, yearly ÷12, every-2-months ÷2, every-4-months ÷4. Lumpy cadences with a start date land on their real months in projections instead of being smoothed.</Rule>
        <Rule term="The projection">Month by month, 60 months out: every flow that's active that month counts; income stops at its known end date (severance and unemployment cliffs are built in, not an afterthought); one-time flows land on their date.</Rule>
        <Rule term={`Liquid = ${LIQUID_CATEGORIES.join(', ')}`}>Retirement, home value, and vehicles count in net worth but never in spendable cash — and retirement balances are treated as market values that move daily.</Rule>
        <Rule term="Runway">The number of complete months before liquid cash would dip below the do-not-touch shelf. With the shelf at $0 it's plain months-to-empty. "Lean" runway re-runs the projection with only essential expenses.</Rule>
        <Rule term="The shelf">A household-level floor — savings you refuse to spend — set on the Dashboard. Every runway figure, chart line, and the advisor's advice bend around it.</Rule>
        <Rule term="Debts">Each month: balance × (APR ÷ 12) interest added, then linked payments subtracted. That produces payoff dates, and an "underwater" flag when payments don't cover interest.</Rule>
        <Rule term="Net worth over time">A snapshot row is written automatically every time a balance changes. The series forward-fills the latest known balance — and backfills a first-known balance to earlier dates, so entering a long-held account reads as data arrival, not a windfall.</Rule>
        <Rule term="1099 income">Netted by its tax-setaside percentage (~35% for California contract work) before it counts toward anything.</Rule>

        <H>The advisor</H>
        <p className="text-[13px] text-muted mb-2">
          Juno's advice comes from Claude (Sonnet 5) through one server function. The division of labor is strict:
        </p>
        <Rule term="What she sees">A compact snapshot — account and flow names, whole-dollar amounts, rates, dates, the shelf, gaps — plus today's real date (injected server-side) and her own memory notes. Never account numbers, never credentials.</Rule>
        <Rule term="What she can do">Answer; suggest up to five prioritized actions; propose what-if scenario deltas (the app's own engine recomputes every projection from them — she is never trusted with arithmetic); make up to three ledger edits per reply (add or update, never delete); keep at most two durable memory notes; and flag app gaps for the household to build.</Rule>
        <Rule term="What she's told to hold back">Unsolicited advice only when it's textbook-solid and provably right for these exact numbers — at most one per conversation, usually zero. No market predictions, no product pitches, no manufactured comfort.</Rule>
        <LoopDiagram />

        <H>How the app grows itself</H>
        <p className="text-[13px] text-muted mb-2">
          Three loops keep the picture getting sharper, in order of how much is known:
        </p>
        <Rule term="1 · Unknown numbers → chores">A row with a blank amount becomes a "fill it in" task. The guided flow asks one number at a time.</Rule>
        <Rule term="2 · Missing rows → questions">A completeness template (the standard household expense categories, shaped by what you own — home ⇒ property taxes, cars ⇒ fuel) turns wholly-absent categories into yes/no questions. Yes creates the row; no makes it disappear.</Rule>
        <Rule term="3 · Missing features → app-gap tasks">When Juno needs somewhere to put something the app can't hold yet, she files an "app gap" task addressed to the household — the app literally requests its own next feature. Ordinary expenses never qualify: anything on the completeness template (property taxes, insurance, …) always has a home as a row, so those come back as questions, not gaps.</Rule>
        <p className="text-[13px] text-muted mt-3 mb-2">
          The wider template those loops draw from is the financial-planning canon — eight domains,
          with today's coverage:
        </p>
        <table className="text-[12.5px] text-muted mt-1 mb-2">
          <tbody>
            {([
              ['Cash flow', 'covered — the ledger + checklist questions'],
              ['Emergency reserve', 'covered — runway + the shelf'],
              ['Debt structure', 'covered — amortization, payoffs, underwater flags'],
              ['Protection (coverage, not premiums)', 'not yet — no place for life/disability/umbrella coverage amounts'],
              ['Tax posture', 'partial — 1099 setasides only'],
              ['Retirement mechanics', 'partial — balances + match/contribution/beneficiary fields; no match-capture check yet'],
              ['Estate basics', 'v1 — documents checklist + what the trust owns (Estate tab)'],
              ['Big-ticket lifecycle', 'partial — representable as amount-unknown future flows'],
            ] as const).map(([d, s]) => (
              <tr key={d}>
                <td className="pr-4 py-0.5 text-ink font-medium whitespace-nowrap">{d}</td>
                <td className="py-0.5">{s}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <H>Estate</H>
        <p className="text-[13px] text-muted mb-2">
          Two halves, on its own Estate tab. Neither is legal advice — it's a tracker for
          decisions made with the trust attorney.
        </p>
        <Rule term="The documents checklist">One shared living trust plus, per person: a will, a financial power of attorney, and a healthcare directive. Each row tracks a status (not started → drafted → signed → needs update) and where the paper physically lives. California's healthcare directive has a free statutory form — no lawyer required for that one.</Rule>
        <Rule term="What the trust owns">A trust only controls what's titled into it — unfunded, it's an empty box and everything still passes through probate. Every asset account carries a "titled to" status; the list shows what's still outside with the move that fits: homes transfer by trust deed + PCOR at the county recorder (no Prop 13 reassessment for a revocable trust), bank and brokerage accounts retitle or take POD/TOD beneficiaries.</Rule>
        <Rule term="The retirement exception">Retirement accounts are never retitled into a living trust — that's a taxable distribution. They're handled by naming a beneficiary directly, and marked "beneficiary set" here.</Rule>
        <Rule term="Juno knows">Once the checklist exists, her snapshot includes document statuses and what sits outside the trust; a signed trust that owns nothing becomes one of her proactive openers.</Rule>

        <H>Sources & handy links</H>
        <div className="text-[13px] text-muted space-y-1.5">
          <p><A href={REPO}>The code itself</A> — every rule on this page lives in <span className="num">src/lib/</span> with tests; <A href={`${REPO}/blob/main/README.md`}>README</A> holds the invariants.</p>
          <p><A href="https://www.consumerfinance.gov/consumer-tools/">CFPB consumer tools</A> — the plain-English budgeting and debt references the checklist mirrors.</p>
          <p><A href="https://www.irs.gov/forms-pubs/about-form-1040-es">IRS 1040-ES</A> — quarterly estimated taxes, the rule behind the 1099 setaside.</p>
          <p><A href="https://edd.ca.gov/en/unemployment/">California EDD</A> — unemployment benefit rules and end dates.</p>
          <p><A href="https://www.boe.ca.gov/proptaxes/proptax.htm">CA Board of Equalization</A> — how California property taxes actually work.</p>
          <p><A href="https://www.investopedia.com/terms/e/emergency_fund.asp">Emergency funds (Investopedia)</A> — where the 3–6-month runway benchmarks come from.</p>
        </div>

        <H>Privacy & plumbing</H>
        <p className="text-[13px] text-muted">
          A household's finances live in their own private Supabase Postgres, row-level-security locked
          to the household's members (signups disabled). The browser talks to the database directly; the
          only server code is the one function that carries the snapshot to Claude.
          Every screen has its own address — <span className="num">/</span> (dashboard),{' '}
          <span className="num">/assets</span>, <span className="num">/payments</span>,{' '}
          <span className="num">/tasks</span>, and this page at <span className="num">/help</span> — so
          anything can be bookmarked or shared across devices.
        </p>
        <Rule term="Juno checks her own pulse">If something stops working — you're offline, the database won't answer, or the advisor can't be reached — a small card appears at the bottom of the screen saying which it is, and disappears on its own once things recover. Silence means everything is healthy.</Rule>
        </>)}

        <div className="mt-8 mb-4">
          <button type="button" onClick={onClose} className="btn-mint">Back to {`Juno`}</button>
        </div>
      </div>
    </div>
  )
}
