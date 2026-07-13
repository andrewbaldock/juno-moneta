import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { formatCents } from '../lib/money'
import { liquid, monthLabel, project, runwayMonths, type Snapshot } from '../lib/metrics'
import { applyScenario, buildSnapshot, suggestions, timelineEvents, type Advice, type Scenario } from '../lib/advisor'
import { resolveEdits, validateEdits } from '../lib/edits'
import type { Account, CashFlow, EstateItem } from '../lib/types'
import JunoSays from '../components/juno/JunoSays'
import JunoPresence from '../components/juno/JunoPresence'
import { beam, COIN_SM_SRC, Yod } from '../components/juno/motifs'
import { buildBrief } from '../lib/brief'
import { juno } from '../copy/juno'

type Convo = { id: string; title: string; updated_at: string }
type Msg = { id: string; role: 'user' | 'assistant'; content: string; payload: { actions?: Advice['actions']; scenario?: Scenario; remember?: string[]; edits_applied?: string[] } | null }
type Note = { id: string; note: string; created_at: string }

// Mint is the live layer (today's path); gold is Juno's hypothetical (01-tokens.md).
const BASE_COLOR = 'var(--mint)'
const SCENARIO_COLOR = 'var(--gold)'

/** md-lite: just **bold** — enough for the advisor's emphasis without a parser dep. */
function md(text: string) {
  return text.split('**').map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part))
}

function when(iso: string): string {
  const d = new Date(iso)
  const mins = Math.floor((Date.now() - d.getTime()) / 60000)
  if (mins < 60) return mins <= 1 ? 'just now' : `${mins} minutes ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return hrs === 1 ? 'an hour ago' : `${hrs} hours ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: 'long' })
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function useAdvisor(householdId: string, shelfCents = 0, overlay = '') {
  const [convos, setConvos] = useState<Convo[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [flows, setFlows] = useState<CashFlow[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [snaps, setSnaps] = useState<Snapshot[]>([])
  const [estate, setEstate] = useState<EstateItem[]>([])
  const [ready, setReady] = useState(false)

  const now = new Date()
  const nowKey = now.getFullYear() * 12 + now.getMonth()

  useEffect(() => {
    supabase.from('conversations').select('id,title,updated_at').order('updated_at', { ascending: false })
      .then(({ data }) => setConvos((data as Convo[]) ?? []))
    supabase.from('juno_notes').select('id,note,created_at').order('created_at', { ascending: false }).limit(12)
      .then(({ data }) => setNotes((data as Note[]) ?? []))
    Promise.all([
      supabase.from('accounts').select('*').then(({ data }) => setAccounts((data as Account[]) ?? [])),
      supabase.from('cash_flows').select('*').then(({ data }) => setFlows((data as CashFlow[]) ?? [])),
      supabase.from('balance_snapshots').select('account_id,balance_cents,as_of_date').order('created_at')
        .then(({ data }) => setSnaps((data as Snapshot[]) ?? [])),
      supabase.from('estate_items').select('*').then(({ data }) => setEstate((data as EstateItem[]) ?? [])),
    ]).then(() => setReady(true))
  }, [])

  useEffect(() => {
    if (!activeId) { setMsgs([]); return }
    supabase.from('messages').select('id,role,content,payload').eq('conversation_id', activeId).order('created_at')
      .then(({ data }) => setMsgs((data as Msg[]) ?? []))
  }, [activeId])

  const gaps = useMemo(() => [
    ...accounts.filter((a) => a.balance_cents === null).map((a) => a.name),
    ...flows.filter((f) => f.active && f.amount_cents === null).map((f) => f.name),
  ], [accounts, flows])

  const starters = useMemo(
    () => suggestions(accounts, flows, convos.map((c) => c.title), nowKey),
    [accounts, flows, convos, nowKey],
  )

  async function send(text: string) {
    const question = text.trim()
    if (!question || busy) return
    setBusy(true)
    setError(null)

    let convoId = activeId
    if (!convoId) {
      const { data, error: err } = await supabase.from('conversations')
        .insert({ household_id: householdId, title: question.slice(0, 60) })
        .select('id,title,updated_at').single()
      if (err || !data) { setError(err?.message ?? 'could not start conversation'); setBusy(false); return }
      convoId = data.id
      setActiveId(convoId)
      setConvos((c) => [data as Convo, ...c])
    }

    const userMsg: Msg = { id: `tmp-${msgs.length}`, role: 'user', content: question, payload: null }
    setMsgs((m) => [...m, userMsg])
    await supabase.from('messages').insert({ conversation_id: convoId, role: 'user', content: question })

    const history = [...msgs, userMsg].map((m) => ({ role: m.role, content: m.content }))
    const snapshot = buildSnapshot(accounts, flows, nowKey, shelfCents, estate)
    const { data, error: err } = await supabase.functions.invoke('claude-proxy', {
      body: { messages: history, snapshot, memories: notes.map((n) => n.note), overlay },
    })
    if (err || data?.error || !data?.advice) {
      setError(err?.message ?? data?.error ?? juno.noAnswer)
      setBusy(false)
      return
    }
    const advice: Advice = data.advice

    // memory over time: durable notes she chose to keep, shared with the MCP.
    // Structural gaps she flags ride along as prefixed notes → the Tasks tab.
    const remember = (Array.isArray(advice.remember) ? advice.remember : [])
      .filter((r): r is string => typeof r === 'string' && r.trim().length > 0)
      .slice(0, 2)
      .map((r) => r.slice(0, 300))
    // fuzzy dedupe: Claude never words a gap identically twice, so exact equality let
    // near-duplicates pile up — match on normalized text, either being a prefix of the other
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    const isDupe = (a: string, b: string) => {
      const [x, y] = [norm(a), norm(b)]
      return x === y || x.startsWith(y.slice(0, 80)) || y.startsWith(x.slice(0, 80))
    }
    const gapNotes = (Array.isArray(advice.structural_gaps) ? advice.structural_gaps : [])
      .filter((g): g is string => typeof g === 'string' && g.trim().length > 0)
      .slice(0, 2)
      .map((g) => `structural gap: ${g.slice(0, 280)}`)
      .filter((g) => !notes.some((n) => isDupe(n.note, g)))
    const toSave = [...remember, ...gapNotes]
    if (toSave.length > 0) {
      const { data: savedNotes } = await supabase.from('juno_notes')
        .insert(toSave.map((note) => ({ household_id: householdId, note })))
        .select('id,note,created_at')
      if (savedNotes) setNotes((n) => [...(savedNotes as Note[]), ...n].slice(0, 12))
    }

    // rows are hers: apply her real ledger edits under RLS, then refresh the picture
    const applied: string[] = []
    const resolved = resolveEdits(validateEdits(advice.edits), accounts, flows)
    let gapFilled = false
    for (const r of resolved) {
      if (r.kind === 'insert') {
        const { error: e2 } = await supabase.from(r.table).insert({ ...r.record, household_id: householdId })
        if (!e2) applied.push(r.summary)
      } else if (r.kind === 'update') {
        const { error: e2 } = await supabase.from(r.table).update(r.record).eq('id', r.id)
        if (!e2) {
          applied.push(r.summary)
          if (r.fillsGap) gapFilled = true
        }
      }
    }
    if (applied.length > 0) {
      if (gapFilled) beam()
      await Promise.all([
        supabase.from('accounts').select('*').then(({ data }) => setAccounts((data as Account[]) ?? [])),
        supabase.from('cash_flows').select('*').then(({ data }) => setFlows((data as CashFlow[]) ?? [])),
      ])
    }

    const payload = {
      actions: advice.actions, scenario: advice.scenario,
      remember: remember.length ? remember : undefined,
      edits_applied: applied.length ? applied : undefined,
    }
    const { data: saved } = await supabase.from('messages')
      .insert({ conversation_id: convoId, role: 'assistant', content: advice.reply, payload })
      .select('id,role,content,payload').single()
    setMsgs((m) => [...m, (saved as Msg) ?? { id: `tmp-a-${m.length}`, role: 'assistant', content: advice.reply, payload }])
    await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', convoId)
    setBusy(false)
  }

  async function removeConvo(c: Convo) {
    if (!confirm(`Delete conversation "${c.title}"?`)) return
    await supabase.from('conversations').delete().eq('id', c.id)
    setConvos((list) => list.filter((x) => x.id !== c.id))
    if (activeId === c.id) setActiveId(null)
  }

  const activeTitle = convos.find((c) => c.id === activeId)?.title ?? null

  return {
    convos, activeId, setActiveId, activeTitle, msgs, busy, error,
    accounts, flows, snaps, estate, ready, nowKey, shelfCents, gaps, starters, send, removeConvo,
  }
}

export type AdvisorState = ReturnType<typeof useAdvisor>

/** Column 1, below the presence: new conversation + past conversations. */
export function ConvoRail({ adv }: { adv: AdvisorState }) {
  return (
    <>
      <button type="button" className="newc" onClick={() => adv.setActiveId(null)}>
        <svg width="13" height="13" viewBox="0 0 24 24" className="mo" style={{ stroke: 'var(--mint-ink)' }} aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        {juno.newConversation}
      </button>
      <div className="threads">
        <div className="hd">{juno.pastConversations}</div>
        {adv.convos.map((c) => (
          <div key={c.id} className={`th ${adv.activeId === c.id ? 'on' : ''}`} onClick={() => adv.setActiveId(c.id)}>
            <div className="t">{c.title}</div>
            <div className="w">{when(c.updated_at)}</div>
            <button type="button" className="x" aria-label="Delete conversation"
              onClick={(e) => { e.stopPropagation(); adv.removeConvo(c) }}>
              ×
            </button>
          </div>
        ))}
      </div>
    </>
  )
}

/** Column 2: the current conversation — thread, what-if chips, the honest hint, composer. */
export function ConvoThread({ adv, userName, showPresence = false }: { adv: AdvisorState; userName: string; showPresence?: boolean }) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [adv.msgs, adv.busy])

  // the proactive open: she has already looked (recomputed when the data lands)
  const brief = useMemo(
    () => (adv.ready ? buildBrief(userName, adv.accounts, adv.flows, new Date(), adv.snaps, adv.shelfCents, adv.estate) : null),
    [adv.ready, adv.accounts, adv.flows, adv.snaps, adv.shelfCents, adv.estate, userName],
  )

  // good news beams the coin — once a day, not every mount
  useEffect(() => {
    if (!brief?.good || adv.msgs.length > 0 || adv.busy) return
    const today = new Date().toDateString()
    if (localStorage.getItem('juno.beamDay') !== today) {
      localStorage.setItem('juno.beamDay', today)
      beam()
    }
  }, [brief, adv.msgs.length, adv.busy])

  function submit(text: string) {
    setInput('')
    adv.send(text)
  }

  return (
    <>
      {showPresence ? (
        // sidebar collapsed: her coin + garden move here, with New conversation in reach
        <div className="c2top">
          <JunoPresence />
          <button type="button" className="newc" onClick={() => adv.setActiveId(null)}>
            <svg width="13" height="13" viewBox="0 0 24 24" className="mo" style={{ stroke: 'var(--mint-ink)' }} aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            {juno.newConversation}
          </button>
        </div>
      ) : (
        <div className="c2hd">
          <div className="av"><img src={COIN_SM_SRC} alt="" aria-hidden="true" /></div>
          <div className="t">{adv.activeTitle ?? 'Juno'}</div>
        </div>
      )}

      <div className="thread">
        {adv.msgs.length === 0 && !adv.busy && brief && (
          <JunoSays yod={brief.yod}>{brief.text}</JunoSays>
        )}

        {adv.msgs.map((m) => (
          m.role === 'user' ? (
            <div key={m.id} className="msg u"><div className="bd">{m.content}</div></div>
          ) : (
            <div key={m.id}>
              <JunoSays yod={m.payload?.remember?.length ? `remembered: ${m.payload.remember.join(' · ')}` : undefined}>
                {md(m.content)}
              </JunoSays>
              {m.payload?.edits_applied && m.payload.edits_applied.length > 0 && (
                <div className="ml-9.5 mb-4 -mt-2">
                  {m.payload.edits_applied.map((s) => (
                    <div key={s} className="yodline"><Yod />{s}</div>
                  ))}
                </div>
              )}
              {m.payload?.actions && m.payload.actions.length > 0 && (
                <div className="space-y-2 mb-4 ml-9.5">
                  {[...m.payload.actions].sort((a, b) => a.priority - b.priority).map((a) => (
                    <div key={a.title} className="rounded-xl border border-line bg-card p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-[13px]">{a.title}</p>
                        <span className="bluechip">{a.effort} effort</span>
                      </div>
                      <p className="text-[13px] text-gold-ink font-medium mt-0.5">{a.impact_estimate}</p>
                      <p className="text-xs text-muted mt-0.5">{a.rationale}</p>
                    </div>
                  ))}
                </div>
              )}
              {m.payload?.scenario && (
                <div className="mb-4 ml-9.5">
                  <ScenarioView scenario={m.payload.scenario} accounts={adv.accounts} flows={adv.flows} nowKey={adv.nowKey} shelfCents={adv.shelfCents} />
                </div>
              )}
            </div>
          )
        ))}

        {adv.busy && <p className="voice italic text-[13.5px] text-gold-ink animate-pulse">{juno.thinking}</p>}
        {adv.error && <p className="text-[13px] text-down">{adv.error}</p>}
        <div ref={bottomRef} />
      </div>

      {adv.msgs.length === 0 && !adv.busy && adv.starters.length > 0 && (
        <div className="chips">
          {adv.starters.map((s) => (
            <button key={s} type="button" className="chip" onClick={() => submit(s)}>{s}</button>
          ))}
        </div>
      )}
      {adv.gaps.length > 0 && <div className="hint">{juno.stillUnknown(adv.gaps)}</div>}

      <form className="composer" onSubmit={(e) => { e.preventDefault(); submit(input) }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={juno.composerPlaceholder}
        />
        <button type="submit" disabled={adv.busy || !input.trim()}>{juno.send}</button>
      </form>
    </>
  )
}

function ScenarioView({ scenario, accounts, flows, nowKey, shelfCents }: {
  scenario: Scenario; accounts: Account[]; flows: CashFlow[]; nowKey: number; shelfCents: number
}) {
  const m = useMemo(() => {
    const liq = liquid(accounts).cents
    const scenFlows = applyScenario(flows, scenario.changes, nowKey)
    const MONTHS = 24
    const base = project(flows, liq, nowKey + 1, MONTHS)
    const scen = project(scenFlows, liq, nowKey + 1, MONTHS)
    const events = timelineEvents(scenFlows, accounts, scen, nowKey, shelfCents)
    const evByKey = new Map<number, string>()
    for (const e of events) evByKey.set(e.key, evByKey.has(e.key) ? `${evByKey.get(e.key)} · ${e.label}` : e.label)
    return {
      data: base.map((p, i) => ({
        label: monthLabel(p.key),
        base: p.cumulative,
        scenario: scen[i].cumulative,
        eventLabel: evByKey.get(p.key),
      })),
      runBase: runwayMonths(project(flows, liq, nowKey + 1, 60), shelfCents),
      runScen: runwayMonths(project(scenFlows, liq, nowKey + 1, 60), shelfCents),
    }
  }, [scenario, accounts, flows, nowKey, shelfCents])

  const runwayText = (r: number | null) => (r === null ? '5+ yrs' : `${r} mo`)

  return (
    <div className="rounded-xl border border-gold-line bg-card p-3.5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="font-display font-semibold text-[16px]">Scenario: {scenario.name}</p>
        <p className="text-xs text-muted">
          runway {runwayText(m.runBase)} → <span className="font-semibold text-gold-ink">{runwayText(m.runScen)}</span>
        </p>
      </div>
      {scenario.description && <p className="text-xs text-muted mt-1">{scenario.description}</p>}
      <div className="h-56 mt-3">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={m.data} margin={{ top: 10, right: 12, bottom: 0, left: 4 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--faint)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={40} />
            <YAxis tickFormatter={(v: number) => `$${Math.round(v / 100000)}k`} tick={{ fontSize: 11, fill: 'var(--faint)' }} tickLine={false} axisLine={false} width={44} />
            <Tooltip content={<ScenarioTooltip />} />
            <Legend formatter={(v: string) => <span className="text-xs text-muted">{v === 'base' ? 'today’s path' : 'this scenario'}</span>} />
            <Line dataKey="base" stroke={BASE_COLOR} strokeWidth={2} dot={false} />
            <Line
              dataKey="scenario"
              stroke={SCENARIO_COLOR}
              strokeWidth={2}
              dot={(p: { cx?: number; cy?: number; payload?: { eventLabel?: string }; index?: number }) =>
                p.payload?.eventLabel && p.cx != null && p.cy != null
                  ? <circle key={p.index} cx={p.cx} cy={p.cy} r={5} fill="var(--gold)" stroke="var(--card)" strokeWidth={2} />
                  : <circle key={p.index} r={0} />}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {m.data.filter((d) => d.eventLabel).map((d) => (
          <span key={d.label} title={`${d.label}: ${formatCents(d.scenario)}`}
            className="text-[11px] rounded-full bg-sunken border border-line text-muted px-2 py-0.5 cursor-default">
            <span className="text-gold-ink font-medium">{d.label}</span> {d.eventLabel}
          </span>
        ))}
      </div>
    </div>
  )
}

function ScenarioTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ dataKey: string; value: number; payload: { eventLabel?: string } }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const ev = payload[0]?.payload?.eventLabel
  return (
    <div className="rounded-lg bg-card shadow-lg border border-line px-3 py-2 text-xs space-y-0.5">
      <p className="font-medium">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="text-muted">
          <span style={{ color: p.dataKey === 'base' ? BASE_COLOR : SCENARIO_COLOR }}>●</span>{' '}
          {p.dataKey === 'base' ? 'today’s path' : 'scenario'}: {formatCents(p.value)}
        </p>
      ))}
      {ev && <p className="text-gold-ink font-medium pt-0.5">⚑ {ev}</p>}
    </div>
  )
}
