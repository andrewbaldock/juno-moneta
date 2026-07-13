import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CartesianGrid, Line, LineChart as RLineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { centsToInput, formatCents, parseDollars } from '../lib/money'
import {
  debtOutlooks, liquid, LIQUID_CATEGORIES, monthLabel, monthlyNet, netWorth, netWorthSeries, project, projectNetWorth, runwayMonths,
  type Snapshot,
} from '../lib/metrics'
import type { Account, CashFlow } from '../lib/types'
import { beam, MarkOwn, MarkSavings, MarkSpending, MarkIncome, MarkOwe } from '../components/juno/motifs'
import { juno } from '../copy/juno'

const HORIZON = 60          // months computed for runway; chart shows first 12

export default function Dashboard({ householdId, shelfCents, setShelfCents }: {
  householdId: string; shelfCents: number; setShelfCents: (n: number) => void
}) {
  const [accounts, setAccounts] = useState<Account[] | null>(null)
  const [flows, setFlows] = useState<CashFlow[] | null>(null)
  const [snaps, setSnaps] = useState<Snapshot[] | null>(null)

  useEffect(() => {
    supabase.from('accounts').select('*').then(({ data }) => setAccounts((data as Account[]) ?? []))
    supabase.from('cash_flows').select('*').then(({ data }) => setFlows((data as CashFlow[]) ?? []))
    supabase.from('balance_snapshots').select('account_id,balance_cents,as_of_date').order('created_at')
      .then(({ data }) => setSnaps((data as Snapshot[]) ?? []))
  }, [])

  const now = new Date()
  const nowKey = now.getFullYear() * 12 + now.getMonth()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  // compare-since anchor: unset = previous snapshot (auto); a picked date sticks
  const [since, setSince] = useState<string | null>(() => localStorage.getItem('juno.nwSince'))
  const pickSince = (d: string) => { setSince(d); localStorage.setItem('juno.nwSince', d) }

  const m = useMemo(() => {
    if (!accounts || !flows || !snaps) return null
    const nw = netWorth(accounts)
    const liq = liquid(accounts)
    const current = monthlyNet(flows, nowKey)
    const lean = monthlyNet(flows, nowKey, true)
    const spending = monthlyNet(flows.filter((f) => f.direction === 'expense'), nowKey)
    const incomeFlows = flows.filter((f) => f.direction === 'income')
    const income = monthlyNet(incomeFlows, nowKey)
    const own = accounts.filter((a) => a.kind === 'asset' && a.balance_cents !== null)
      .reduce((s, a) => s + (a.balance_cents as number), 0)
    const owe = accounts.filter((a) => a.kind === 'liability' && a.balance_cents !== null)
      .reduce((s, a) => s + (a.balance_cents as number), 0)
    const projCurrent = project(flows, liq.cents, nowKey + 1, HORIZON)
    const projLean = project(flows, liq.cents, nowKey + 1, HORIZON, true)
    return {
      nw, liq, current, lean, own, owe, spending: -spending.cents, income: income.cents, projCurrent,
      incomeMonths: project(incomeFlows, 0, nowKey, 12).map((p) => ({ label: monthLabel(p.key), cents: p.net })),
      runCurrent: runwayMonths(projCurrent, shelfCents),
      runLean: runwayMonths(projLean, shelfCents),
      nwSeries: netWorthSeries(accounts, snaps),
      nwProjected: projectNetWorth(accounts, flows, projCurrent.slice(0, 12), nowKey + 1),
      outlooks: debtOutlooks(accounts, flows, nowKey + 1),
    }
  }, [accounts, flows, snaps, nowKey, shelfCents])

  // a debt's payoff date moved CLOSER since last look → milestone crossed → she beams
  useEffect(() => {
    if (!m) return
    let stored: Record<string, number> = {}
    try { stored = JSON.parse(localStorage.getItem('juno.payoffs') ?? '{}') } catch { /* fresh start */ }
    const next: Record<string, number> = {}
    let improved = false
    for (const o of m.outlooks) {
      if (o.unlinked || o.underwater || o.payoffKey === null) continue
      next[o.name] = o.payoffKey
      if (typeof stored[o.name] === 'number' && o.payoffKey < stored[o.name]) improved = true
    }
    localStorage.setItem('juno.payoffs', JSON.stringify(next))
    if (improved) beam()
  }, [m])

  if (!m) return <p className="text-faint">Loading…</p>

  const gaps = [...m.nw.missing.map((n) => `${n} (balance)`), ...m.current.missing.map((n) => `${n} (amount)`)]
  const [worthD, worthC] = formatCents(m.nw.cents).split('.')

  // latest snapshot at-or-before the picked date; before all history → earliest
  const last = m.nwSeries.length >= 1 ? m.nwSeries[m.nwSeries.length - 1] : null
  const anchor = since
    ? m.nwSeries.filter((p) => p.date <= since).at(-1) ?? m.nwSeries[0] ?? null
    : m.nwSeries.length >= 2 ? m.nwSeries[m.nwSeries.length - 2] : null
  const delta = anchor && last ? last.cents - anchor.cents : null
  const nwChart = since && anchor ? m.nwSeries.slice(m.nwSeries.indexOf(anchor)) : m.nwSeries

  const runwayText = (r: number | null) => (r === null ? `${HORIZON / 12}+ yrs` : `${r} mo`)

  return (
    <div>
      <div className="k">{juno.whereYouStand}</div>
      <div className="worthv">
        {worthD}
        {worthC && <span className="c">.{worthC}</span>}
      </div>
      {delta !== null && (
        <div className={`dlt ${delta < 0 ? 'down' : ''}`}>
          {delta < 0 ? '▼' : '▲'} <span className="num">{delta < 0 ? '−' : '+'}{formatCents(Math.abs(delta))}</span>
          <span className="text-muted">since</span>
          <input type="date" aria-label="Compare since" value={since ?? anchor!.date} max={today}
            onChange={(e) => e.target.value && pickSince(e.target.value)} />
          <button type="button" className="today" title="Start counting from today" onClick={() => pickSince(today)}>
            today
          </button>
        </div>
      )}

      <div className="cards">
        <AccountCard mark={<MarkOwn />} name="What you own" balance={formatCents(m.own)} />
        <AccountCard mark={<MarkSavings />} name="Savings & liquid" balance={formatCents(m.liq.cents)} />
        <AccountCard mark={<MarkSpending />} name="Spending / month" balance={formatCents(m.spending)} />
        <AccountCard mark={<MarkIncome />} name="Income / month" balance={formatCents(m.income)}
          hover={<IncomeMonthsList months={m.incomeMonths} />} />
        <AccountCard mark={<MarkOwe />} name="What you owe" balance={formatCents(m.owe)} />
      </div>

      <ShelfEditor householdId={householdId} shelfCents={shelfCents} setShelfCents={setShelfCents} />

      {gaps.length > 0 && (
        <div className="prov"><b style={{ fontWeight: 500 }}>Provisional</b> — {juno.provisional(gaps)}</div>
      )}

      <div className="mnet">
        <span className="lab">{juno.keptEachMonth} · runway{shelfCents > 0 ? ' to shelf' : ''} {runwayText(m.runCurrent)} (lean {runwayText(m.runLean)})</span>
        <span className="v">{m.current.cents < 0 ? '−' : '+'}{formatCents(Math.abs(m.current.cents))}</span>
      </div>

      <CompositionBars accounts={accounts!} />

      <div className="chart">
        <div className="ct">Cash — next 12 months</div>
        <div className="cs">Liquid cash month by month — committed income only, known income end-dates baked in.</div>
        <LineChart
          points={m.projCurrent.slice(0, 12).map((p) => ({ label: monthLabel(p.key), cents: p.cumulative }))}
          showZero
          floor={shelfCents}
        />
      </div>

      <div className="chart">
        <div className="ct">Where it's heading</div>
        <div className="cs">
          Assets compound at the growth rates you entered; debts accrue interest and amortize by their linked payments.
        </div>
        <p className="text-[13.5px] mb-3">
          Projected net worth in 12 months:{' '}
          <span className="num">{formatCents(m.nwProjected[m.nwProjected.length - 1]?.cents ?? null)}</span>
          <span className="text-faint"> (from {formatCents(m.nw.cents)} today)</span>
        </p>
        <ul className="space-y-1.5 text-[13px] pb-2">
          {m.outlooks.map((o) => (
            <li key={o.name} className="flex items-baseline gap-2">
              <span>{o.name}</span>
              {o.unlinked ? (
                <span className="text-xs text-faint">no payment linked — edit its payment row to link it</span>
              ) : o.underwater ? (
                <span className="text-xs text-down">payment doesn't cover interest — balance grows</span>
              ) : o.payoffKey === null ? (
                <span className="text-xs text-faint">paid off beyond 50 years</span>
              ) : (
                <span className="text-xs text-mint-ink font-medium">paid off {monthLabel(o.payoffKey)}</span>
              )}
            </li>
          ))}
          {m.outlooks.length === 0 && <li className="text-faint text-[13px]">No debts with known balances.</li>}
        </ul>
      </div>

      <div className="chart">
        <div className="ct">Net worth over time</div>
        <div className="cs">One point per day a balance was recorded. History grows as balances get updated.</div>
        {nwChart.length < 2 ? (
          <p className="text-[13px] text-faint py-6">
            {m.nwSeries.length < 2
              ? `Only one snapshot so far (${m.nwSeries[0] ? `${formatCents(m.nwSeries[0].cents)} on ${m.nwSeries[0].date}` : '—'}). Update any balance to add history.`
              : `History since ${since} will grow as balances get updated.`}
          </p>
        ) : (
          <LineChart points={nwChart.map((p) => ({ label: p.date.slice(5), cents: p.cents }))} />
        )}
      </div>
    </div>
  )
}

/**
 * Where the total comes from: every asset and every debt as two composition strips
 * on a SHARED dollar scale (the owe strip's length is honest against the own strip).
 * Segments alternate two validated shades per side; identity rides on direct labels
 * for wide segments, native tooltips for all, and the table view underneath.
 */
function CompositionBars({ accounts }: { accounts: Account[] }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null)
  const known = accounts.filter((a) => a.balance_cents !== null && (a.balance_cents as number) > 0)
  const bySize = (a: Account, b: Account) => (b.balance_cents as number) - (a.balance_cents as number)
  const assets = known.filter((a) => a.kind === 'asset').sort(bySize)
  const liquidRows = assets.filter((a) => LIQUID_CATEGORIES.includes(a.category))
  const debts = known.filter((a) => a.kind === 'liability').sort(bySize)
  const sum = (rows: Account[]) => rows.reduce((s, a) => s + (a.balance_cents as number), 0)
  const ownTotal = sum(assets)
  const oweTotal = sum(debts)
  const scale = Math.max(ownTotal, oweTotal)
  if (scale === 0) return null

  const strip = (rows: Account[], total: number, colors: [string, string]) => (
    <div className="flex h-9 rounded-md overflow-hidden" style={{ width: `${(total / scale) * 100}%`, gap: 2 }}>
      {rows.map((a, i) => {
        const share = (a.balance_cents as number) / scale
        const move = (e: React.MouseEvent) => {
          const r = wrapRef.current?.getBoundingClientRect()
          if (!r) return
          const pct = Math.round(((a.balance_cents as number) / total) * 100)
          setTip({
            x: e.clientX - r.left,
            y: e.clientY - r.top,
            text: `${a.name} — ${formatCents(a.balance_cents)} (${pct}% of ${a.kind === 'asset' ? 'what you own' : 'what you owe'})`,
          })
        }
        return (
          <div
            key={a.id}
            aria-label={`${a.name} — ${formatCents(a.balance_cents)}`}
            onMouseMove={move}
            onMouseLeave={() => setTip(null)}
            className="h-full flex items-center px-1.5 overflow-hidden"
            style={{ width: `${((a.balance_cents as number) / total) * 100}%`, background: colors[i % 2], minWidth: 3 }}
          >
            {share >= 0.08 && (
              <span className="text-[11px] font-medium whitespace-nowrap overflow-hidden text-ellipsis" style={{ color: '#fffdf7' }}>
                {a.name}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )

  const row = (label: string, cents: number) => (
    <div className="flex items-baseline gap-2 text-xs text-muted mb-1 mt-2.5 first:mt-0">
      <span>{label}</span>
      <span className="num text-ink">{formatCents(cents)}</span>
    </div>
  )

  return (
    <div className="chart relative" ref={wrapRef}>
      {tip && (
        <div
          className="absolute z-10 pointer-events-none rounded-lg bg-card shadow-lg border border-line px-3 py-2 text-xs whitespace-nowrap"
          style={{
            top: tip.y + 14,
            // flip to the left of the cursor near the right edge so it never clips
            ...(tip.x > (wrapRef.current?.clientWidth ?? 600) / 2
              ? { right: (wrapRef.current?.clientWidth ?? 600) - tip.x + 10 }
              : { left: tip.x + 10 }),
          }}
        >
          {tip.text}
        </div>
      )}
      <div className="ct">Where the total comes from</div>
      <div className="cs">Everything with a known balance, largest first, on one shared scale. Hover any block for its number.</div>
      {row('What you own', ownTotal)}
      {strip(assets, ownTotal, ['var(--chart-own1)', 'var(--chart-own2)'])}
      {liquidRows.length > 0 && (
        <>
          {row('Liquid — the part you can actually spend', sum(liquidRows))}
          {strip(liquidRows, sum(liquidRows), ['var(--chart-own1)', 'var(--chart-own2)'])}
        </>
      )}
      {row('What you owe', oweTotal)}
      {strip(debts, oweTotal, ['var(--chart-owe1)', 'var(--chart-owe2)'])}
      <p className="text-[13px] mt-3">
        <span className="text-muted">Net worth </span>
        <span className="num font-medium">{formatCents(ownTotal - oweTotal)}</span>
      </p>
      <details className="text-xs text-faint mt-1">
        <summary className="cursor-pointer">View as table</summary>
        <table className="mt-2 text-muted">
          <tbody>
            {[...assets, ...debts].map((a) => (
              <tr key={a.id}>
                <td className="pr-4">{a.name}</td>
                <td className="pr-4 text-faint">{a.kind === 'asset' ? 'own' : 'owe'}</td>
                <td className="tabular-nums text-right">{formatCents(a.balance_cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}

/**
 * The do-not-touch shelf: liquid savings the household refuses to draw below.
 * A plaything — type a number, watch runway and the chart bend around it. Persists per household.
 */
function ShelfEditor({ householdId, shelfCents, setShelfCents }: {
  householdId: string; shelfCents: number; setShelfCents: (n: number) => void
}) {
  const [val, setVal] = useState(() => (shelfCents > 0 ? centsToInput(shelfCents) : ''))
  // household row arrives after first render — adopt it unless the user is mid-edit
  const [touched, setTouched] = useState(false)
  useEffect(() => {
    if (!touched) setVal(shelfCents > 0 ? centsToInput(shelfCents) : '')
  }, [shelfCents, touched])

  function commit() {
    setTouched(false)
    const parsed = parseDollars(val)
    const next = parsed === null ? 0 : parsed
    if (Number.isNaN(next) || next < 0) { setVal(shelfCents > 0 ? centsToInput(shelfCents) : ''); return }
    if (next === shelfCents) return
    setShelfCents(next) // the whole app recomputes immediately; DB write follows
    supabase.from('households').update({ shelf_cents: next }).eq('id', householdId)
      .then(({ error }) => { if (error) alert(`Couldn't save the shelf: ${error.message}`) })
  }

  return (
    <label className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[13px] mt-3 mb-3">
      <span className="font-medium">Do-not-touch shelf</span>
      <span className="flex items-baseline gap-1 text-muted">
        $
        <input
          value={val}
          onChange={(e) => { setTouched(true); setVal(e.target.value) }}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
          inputMode="decimal"
          placeholder="0"
          className="w-24 bg-sunken border border-line rounded px-2 py-0.5 tabular-nums text-ink"
        />
      </span>
      <span className="text-xs text-faint">savings we refuse to dip into — runway and charts bend around it</span>
    </label>
  )
}

function AccountCard({ mark, name, balance, whisper, hover }: {
  mark: React.ReactNode; name: string; balance: string; whisper?: string; hover?: React.ReactNode
}) {
  return (
    <div className="ac">
      <span className="well">{mark}</span>
      <div className="nm">{name}{hover && <span className="peek" aria-hidden="true"> ▾</span>}</div>
      <div className="bl">{balance}</div>
      {whisper && <div className="whisper">{whisper}</div>}
      {hover && <div className="acpop">{hover}</div>}
    </div>
  )
}

/** The 12-month income read inside the card's hover panel. */
function IncomeMonthsList({ months }: { months: { label: string; cents: number }[] }) {
  return (
    <div>
      <div className="ph">Next 12 months</div>
      {months.map((mo, i) => (
        <div key={mo.label} className={`pr${i === 0 ? ' now' : ''}`}>
          <span className="pl">{mo.label}</span>
          <span className={`pv${mo.cents === 0 ? ' zero' : ''}`}>{formatCents(mo.cents)}</span>
        </div>
      ))}
    </div>
  )
}

/** Single-series line via Recharts — same system as the scenario chart. Mint = the live layer, gold = the shelf. */
function LineChart({ points, showZero = false, floor = 0 }: { points: { label: string; cents: number }[]; showZero?: boolean; floor?: number }) {
  const firstNeg = showZero ? points.find((p) => p.cents <= floor) : undefined
  return (
    <div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <RLineChart data={points} margin={{ top: 14, right: 12, bottom: 0, left: 4 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--faint)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={40} />
            <YAxis tickFormatter={(v: number) => `$${Math.round(v / 100000)}k`} tick={{ fontSize: 11, fill: 'var(--faint)' }} tickLine={false} axisLine={false} width={44} />
            {showZero && <ReferenceLine y={0} stroke="var(--line-strong)" strokeDasharray="4 3" />}
            {showZero && floor > 0 && (
              <ReferenceLine y={floor} stroke="var(--gold)" strokeDasharray="4 3"
                label={{ value: 'shelf', position: 'insideTopRight', fontSize: 11, fill: 'var(--gold-ink)' }} />
            )}
            <Tooltip content={<CentsTooltip />} />
            <Line dataKey="cents" stroke="var(--mint-bright)" strokeWidth={2.5} dot={false} />
            {firstNeg && (
              <ReferenceDot x={firstNeg.label} y={firstNeg.cents} r={5} fill="var(--down)" stroke="var(--card)" strokeWidth={2}
                label={{ value: `⚠ ${floor > 0 ? 'shelf breached' : 'cash out'} — ${firstNeg.label}`, position: 'top', fontSize: 11, fill: 'var(--down)' }} />
            )}
          </RLineChart>
        </ResponsiveContainer>
      </div>
      <details className="text-xs text-faint mt-1">
        <summary className="cursor-pointer">View as table</summary>
        <table className="mt-2 text-muted">
          <tbody>
            {points.map((p, i) => (
              <tr key={i}><td className="pr-4">{p.label}</td><td className="tabular-nums text-right">{formatCents(p.cents)}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}

function CentsTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg bg-card shadow-lg border border-line px-3 py-2 text-xs">
      <p className="font-medium">{label}</p>
      <p className="text-muted">{formatCents(payload[0].value)}</p>
    </div>
  )
}
