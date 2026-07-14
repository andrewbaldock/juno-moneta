// The engine, visible: a reference page for how Juno models the household.
// Owner's spec: "almost a wikipedia page about this app and the modeling it's doing."
// Two sub-tabs: "How Juno works" (the model) and "Design system" (the visual language).
import { useState } from 'react'
import { LIQUID_CATEGORIES } from '../lib/metrics'
import { FlowDiagram, LoopDiagram } from '../components/juno/diagrams'

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

/** The design system now lives at its own public page, /design. This pane is a short
 *  pointer to it, so the deep showcase has a single home and can't drift out of sync. */
function DesignSystem() {
  return (
    <>
      <p className="text-[13px] text-muted mt-3 mb-3">
        Juno is named for <b className="text-ink">Juno Moneta</b> — the Roman goddess whose temple
        housed the mint (our word <em>money</em> comes from her). The app is her <b className="text-ink">temple
        and spa of financial wellbeing</b>: warm parchment surfaces, a struck-coin mark with its natural
        edge, a temple garden that tracks the time of day, gold for the coin and a soothing mint for the
        plants, and one honest voice.
      </p>
      <p className="text-[13px] text-muted mb-4">
        The full design system — colour tokens, type, motifs, diagrams, and components, with a live
        day/night toggle — is a public page:
      </p>
      <a href="/design" className="btn-mint inline-block no-underline">Open the full design system →</a>
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
        <p className="text-[12.5px] text-muted mb-4">Built by <A href="https://andrewbaldock.com">andrewbaldock.com</A></p>
      </div>
    </div>
  )
}
