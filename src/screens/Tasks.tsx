import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { parseDollars } from '../lib/money'
import { actionTasks, annualReviewTask, checklistTasks, gapTasks, loadDone, structuralTasks, DONE_KEY, type Task } from '../lib/tasks'
import type { Action } from '../lib/advisor'
import type { Account, CashFlow } from '../lib/types'
import { beam } from '../components/juno/motifs'

type FillItem = {
  table: 'accounts' | 'cash_flows'
  id: string
  field: 'balance_cents' | 'amount_cents' | 'interest_rate'
  prompt: string
  hint: string
}

function fillItems(accounts: Account[], flows: CashFlow[]): FillItem[] {
  const items: FillItem[] = []
  for (const a of accounts) {
    if (a.balance_cents === null) items.push({
      table: 'accounts', id: a.id, field: 'balance_cents',
      prompt: `What's the balance on ${a.name}?`, hint: 'dollars — blank to skip',
    })
    if (a.kind === 'liability' && a.interest_rate === null) items.push({
      table: 'accounts', id: a.id, field: 'interest_rate',
      prompt: `What's the interest rate on ${a.name}?`, hint: 'APR % , like 7.06 — blank to skip',
    })
  }
  for (const f of flows) {
    if (f.active && f.amount_cents === null) items.push({
      table: 'cash_flows', id: f.id, field: 'amount_cents',
      prompt: `How much is ${f.name}?`, hint: `dollars per ${f.cadence.replace(/_/g, ' ')} — blank to skip`,
    })
  }
  return items
}

// ponytail: dismissals live in localStorage per device; a shared done-state table if one member ever wants to see another's checkmarks

export default function Tasks({ goTo }: { goTo: (tab: 'accounts' | 'monthly') => void }) {
  const [accounts, setAccounts] = useState<Account[] | null>(null)
  const [flows, setFlows] = useState<CashFlow[] | null>(null)
  const [payloads, setPayloads] = useState<Array<{ actions?: Action[] } | null> | null>(null)
  const [notes, setNotes] = useState<Array<{ id: string; note: string }> | null>(null)
  const [done, setDone] = useState<Set<string>>(loadDone)
  const [filling, setFilling] = useState(false)

  useEffect(() => {
    supabase.from('accounts').select('*').then(({ data }) => setAccounts((data as Account[]) ?? []))
    supabase.from('cash_flows').select('*').then(({ data }) => setFlows((data as CashFlow[]) ?? []))
    supabase.from('messages').select('payload').eq('role', 'assistant').not('payload', 'is', null)
      .order('created_at', { ascending: false }).limit(100)
      .then(({ data }) => setPayloads((data ?? []).map((m) => m.payload as { actions?: Action[] })))
    supabase.from('juno_notes').select('id,note').ilike('note', 'structural gap:%')
      .order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => setNotes(data ?? []))
  }, [])

  const tasks = useMemo(() => {
    if (!accounts || !flows || !payloads || !notes) return null
    return [...structuralTasks(notes), ...gapTasks(accounts, flows), ...checklistTasks(accounts, flows), ...actionTasks(payloads), ...annualReviewTask()]
  }, [accounts, flows, payloads, notes])

  function dismiss(key: string) {
    const next = new Set(done)
    next.add(key)
    setDone(next)
    localStorage.setItem(DONE_KEY, JSON.stringify([...next]))
  }

  // "yes, we have that" → the row exists from this moment, amount unknown (its own chore)
  async function addRow(t: Task) {
    if (!t.create) return
    const hid = accounts?.[0]?.household_id ?? flows?.[0]?.household_id
    if (!hid) return
    const { error } = await supabase.from('cash_flows').insert({
      household_id: hid, direction: 'expense', amount_cents: null, active: true, committed: true, ...t.create,
    })
    if (!error) supabase.from('cash_flows').select('*').then(({ data }) => setFlows((data as CashFlow[]) ?? []))
  }

  // structural gaps live in her memory; dismissing one means handled → the note goes too
  async function dismissStructural(t: Task) {
    if (t.noteId) {
      await supabase.from('juno_notes').delete().eq('id', t.noteId)
      setNotes((n) => (n ? n.filter((x) => x.id !== t.noteId) : n))
    }
  }

  function restore() {
    setDone(new Set())
    localStorage.removeItem(DONE_KEY)
  }

  if (!tasks) return <p className="text-faint">Loading…</p>

  const open = tasks.filter((t) => !done.has(t.key))
  const structural = open.filter((t) => t.kind === 'structural')
  const gaps = open.filter((t) => t.kind === 'gap')
  const asks = open.filter((t) => t.kind === 'ask')
  const actions = open.filter((t) => t.kind === 'action')
  const reviews = open.filter((t) => t.kind === 'review')
  const dismissed = tasks.length - open.length

  return (
    <div>
      {open.length === 0 && (
        <div className="chart"><p className="voice text-[15px] py-2">Nothing on the list. The picture is as sharp as it gets today.</p></div>
      )}

      {structural.length > 0 && (
        <section className="tw">
          <div className="twh"><h3>The app is missing</h3></div>
          {structural.map((t) => (
            <TaskRow key={t.key} task={t} onDismiss={() => dismissStructural(t)} />
          ))}
        </section>
      )}

      {gaps.length > 0 && (
        <section className="tw">
          <div className="twh">
            <h3 className="flex items-center gap-2.5">
              <CompletenessRing accounts={accounts!} flows={flows!} />
              Numbers Juno wants
            </h3>
            <button type="button" className="btn-gold" onClick={() => setFilling(true)}>
              Fill them in
            </button>
          </div>
          {gaps.map((t) => (
            <TaskRow key={t.key} task={t} onDismiss={() => dismiss(t.key)}
              onOpen={t.goto ? () => goTo(t.goto as 'accounts' | 'monthly') : undefined} />
          ))}
        </section>
      )}

      {asks.length > 0 && (
        <section className="tw">
          <div className="twh"><h3>Does the household have…</h3></div>
          {asks.map((t) => (
            <TaskRow key={t.key} task={t} onDismiss={() => dismiss(t.key)} onYes={() => addRow(t)} />
          ))}
        </section>
      )}

      {filling && accounts && flows && (
        <GuidedFill
          items={fillItems(accounts, flows)}
          onClose={(filledAny) => {
            setFilling(false)
            if (filledAny) {
              beam()
              supabase.from('accounts').select('*').then(({ data }) => setAccounts((data as Account[]) ?? []))
              supabase.from('cash_flows').select('*').then(({ data }) => setFlows((data as CashFlow[]) ?? []))
            }
          }}
        />
      )}

      {actions.length > 0 && (
        <section className="tw">
          <div className="twh"><h3>Moves she's suggested</h3></div>
          {actions.map((t) => (
            <TaskRow key={t.key} task={t} onDismiss={() => dismiss(t.key)} />
          ))}
        </section>
      )}

      {reviews.length > 0 && (
        <section className="tw">
          <div className="twh"><h3>Once a year</h3></div>
          {reviews.map((t) => (
            <TaskRow key={t.key} task={t} onDismiss={() => dismiss(t.key)} />
          ))}
        </section>
      )}

      {dismissed > 0 && (
        <button type="button" onClick={restore} className="text-xs text-faint underline bg-transparent border-0 cursor-pointer p-0">
          {dismissed} dismissed — show again
        </button>
      )}
    </div>
  )
}

/** How complete the picture is: known value slots over all value slots. */
function CompletenessRing({ accounts, flows }: { accounts: Account[]; flows: CashFlow[] }) {
  const slots =
    accounts.length +
    accounts.filter((a) => a.kind === 'liability').length +
    flows.filter((f) => f.active).length
  const missing = fillItems(accounts, flows).length
  const pct = slots === 0 ? 1 : (slots - missing) / slots
  const R = 10
  const C = 2 * Math.PI * R
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-label={`${Math.round(pct * 100)}% of values entered`}>
      <circle cx="13" cy="13" r={R} fill="none" stroke="var(--line)" strokeWidth="3" />
      <circle cx="13" cy="13" r={R} fill="none" stroke="var(--mint)" strokeWidth="3" strokeLinecap="round"
        strokeDasharray={`${C * pct} ${C}`} transform="rotate(-90 13 13)" />
    </svg>
  )
}

/** Phase 3, the lean core: one gap at a time, skip-friendly, she beams when you're done. */
function GuidedFill({ items, onClose }: { items: FillItem[]; onClose: (filledAny: boolean) => void }) {
  const [idx, setIdx] = useState(0)
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [filled, setFilled] = useState(0)

  const item = items[idx]
  const doneAll = !item

  function advance() {
    setValue('')
    setError(null)
    setIdx(idx + 1)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!value.trim()) { advance(); return }   // blank = skip
    let update: Record<string, number>
    if (item.field === 'interest_rate') {
      const rate = Number(value)
      if (Number.isNaN(rate)) { setError('A number like 7.06.'); return }
      update = { interest_rate: rate }
    } else {
      const cents = parseDollars(value)
      if (cents === null || Number.isNaN(cents)) { setError('A dollar amount, like 4,212.50.'); return }
      update = { [item.field]: cents }
    }
    const { error: err } = await supabase.from(item.table).update(update).eq('id', item.id)
    if (err) { setError(err.message); return }
    setFilled(filled + 1)
    advance()
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center" style={{ background: 'rgba(20,16,9,.35)' }}
      onClick={() => onClose(filled > 0)}>
      <div className="w-full max-w-sm bg-card border border-line rounded-2xl p-6 space-y-3 text-center"
        onClick={(e) => e.stopPropagation()}>
        {doneAll ? (
          <>
            <p className="voice text-[15.5px]">
              {filled > 0
                ? `That's ${filled === 1 ? 'one number' : `${filled} numbers`} sharper. My answers just got better.`
                : 'All skipped — they’ll keep. Come back when you have them.'}
            </p>
            <button type="button" className="btn-mint w-full" onClick={() => onClose(filled > 0)}>Done</button>
          </>
        ) : (
          <form onSubmit={save} className="space-y-3">
            <p className="text-xs text-faint">{idx + 1} of {items.length}</p>
            <p className="voice text-[16px]">{item.prompt}</p>
            <input autoFocus inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)}
              placeholder={item.hint} className="field text-center" />
            {error && <p className="text-sm text-down">{error}</p>}
            <div className="flex gap-3">
              <button type="submit" className="btn-gold flex-1">Save</button>
              <button type="button" className="btn-quiet" onClick={advance}>Skip</button>
              <button type="button" className="btn-quiet" onClick={() => onClose(filled > 0)}>Close</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function TaskRow({ task, onDismiss, onOpen, onYes }: { task: Task; onDismiss: () => void; onOpen?: () => void; onYes?: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-line bg-card px-4 py-3 mb-2">
      {task.kind === 'gap' ? (
        <span className="pchip mt-0.5">fill in</span>
      ) : task.kind === 'structural' ? (
        <span className="pchip mt-0.5">app gap</span>
      ) : task.kind === 'ask' ? (
        <span className="pchip mt-0.5">question</span>
      ) : task.kind === 'review' ? (
        <span className="pchip mt-0.5">yearly</span>
      ) : (
        <span className="bluechip mt-0.5">{task.effort ?? 'move'}{task.effort ? ' effort' : ''}</span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-medium">{task.title}</p>
        {task.impact && <p className="text-[13px] text-gold-ink font-medium mt-0.5">{task.impact}</p>}
        {task.detail && <p className="text-xs text-muted mt-0.5">{task.detail}</p>}
      </div>
      {task.kind === 'ask' ? (
        <div className="flex gap-2 shrink-0">
          <button type="button" className="btn-mint" onClick={onYes}>Yes — add it</button>
          <button type="button" className="btn-quiet" onClick={onDismiss}>No</button>
        </div>
      ) : (
        <>
          {onOpen && (
            <button type="button" onClick={onOpen} className="btn-gold shrink-0">Open</button>
          )}
          <button type="button" onClick={onDismiss} aria-label="Dismiss task"
            className="text-faint hover:text-down bg-transparent border-0 cursor-pointer text-[15px] leading-none px-1 shrink-0">
            ×
          </button>
        </>
      )}
    </div>
  )
}
