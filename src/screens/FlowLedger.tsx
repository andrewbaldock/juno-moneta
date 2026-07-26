// The ledger: the household spreadsheet, except the numbers come from the model.
//
// A hand-kept bills spreadsheet is a column of dated rows and a running balance,
// where every month gets copied down and the amounts retyped. That's a good
// interface — it's legible, it shows the dip before payday, and you can correct
// any single line. What it can't do is stay consistent with anything else.
//
// So this IS that view, reading the same cash_flows the Dashboard and the advisor
// read. Retyping an amount writes a flow_overrides row for that ONE date; the
// underlying rule stays put, and every other number in Juno moves with it.
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatCents, parseDollars } from '../lib/money'
import { projectDaily, type FlowOverride, type Occurrence } from '../lib/daily'
import type { Account, CashFlow } from '../lib/types'
import { liquid } from '../lib/metrics'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const monthTitle = (iso: string) => {
  const [y, m] = iso.split('-').map(Number)
  return `${MONTHS[m - 1]} ${y}`
}
const dayOf = (iso: string) => Number(iso.split('-')[2])
const monthOf = (iso: string) => iso.slice(0, 7)

export default function FlowLedger({ flows, onOpen }: { flows: CashFlow[]; onOpen: (f: CashFlow) => void }) {
  const [accounts, setAccounts] = useState<Account[] | null>(null)
  const [overrides, setOverrides] = useState<FlowOverride[]>([])
  const [months, setMonths] = useState(6)
  const [editing, setEditing] = useState<string | null>(null)  // `${flow_id}|${date}`

  useEffect(() => {
    supabase.from('accounts').select('*').then(({ data }) => setAccounts((data as Account[]) ?? []))
    reloadOverrides()
  }, [])

  const reloadOverrides = () =>
    supabase.from('flow_overrides').select('flow_id,occurs_on,amount_cents,skipped,note')
      .then(({ data }) => setOverrides((data as FlowOverride[]) ?? []))

  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const startCents = accounts ? liquid(accounts).cents : 0

  const p = useMemo(
    () => projectDaily(flows, startCents, today, months * 31, { overrides }),
    [flows, startCents, today, months, overrides],
  )

  // group the flat ledger into month blocks, the way the spreadsheet stacks them
  const blocks = useMemo(() => {
    const out: { month: string; rows: Occurrence[] }[] = []
    for (const r of p.rows) {
      const key = monthOf(r.date)
      if (out.length === 0 || out[out.length - 1].month !== key) out.push({ month: key, rows: [] })
      out[out.length - 1].rows.push(r)
    }
    return out
  }, [p.rows])

  async function saveOverride(flowId: string, date: string, cents: number | null, skipped: boolean) {
    setEditing(null)
    if (cents === null && !skipped) {
      await supabase.from('flow_overrides').delete().eq('flow_id', flowId).eq('occurs_on', date)
    } else {
      const { error } = await supabase.from('flow_overrides')
        .upsert({ flow_id: flowId, occurs_on: date, amount_cents: cents, skipped }, { onConflict: 'flow_id,occurs_on' })
      if (error) { alert(`Couldn't save that amount: ${error.message}`); return }
    }
    reloadOverrides()
  }

  if (!accounts) return <p className="text-faint">Loading…</p>

  return (
    <div className="ledger">
      <p className="lgi">
        Every bill and paycheck on its real date, running-summed from{' '}
        <span className="num">{formatCents(startCents)}</span> of liquid cash today. Click any amount to correct
        it for that date only — the recurring row keeps its usual number, and the rest of Juno follows.
      </p>

      {p.missing.length > 0 && (
        <p className="lgw">Left out, amount unknown: {p.missing.join(', ')}</p>
      )}
      {p.unplaced.length > 0 && (
        <p className="lgw">
          Left out, no due day yet: {p.unplaced.map((f) => f.name).join(', ')} — open each and set the day it lands.
        </p>
      )}

      {blocks.map((b) => {
        const income = b.rows.reduce((s, r) => s + (r.delta > 0 ? r.delta : 0), 0)
        const out = b.rows.reduce((s, r) => s + (r.delta < 0 ? -r.delta : 0), 0)
        const end = b.rows[b.rows.length - 1].balance
        return (
          <div className="lgm" key={b.month}>
            <div className="lgh">
              <h3>{monthTitle(b.month)}</h3>
              <span className="lgt">
                in <span className="num up">{formatCents(income)}</span>
                {' · '}out <span className="num">{formatCents(out)}</span>
                {' · '}ends <span className={`num${end < 0 ? ' down' : ''}`}>{formatCents(end)}</span>
              </span>
            </div>
            <table className="lgtbl">
              <thead>
                <tr><th>Day</th><th>What</th><th className="r">Out</th><th className="r">In</th><th className="r">Balance</th></tr>
              </thead>
              <tbody>
                {b.rows.map((r) => {
                  const key = `${r.flow.id}|${r.date}`
                  return (
                    <tr key={key} className={r.balance < 0 ? 'neg' : undefined}>
                      <td className="d">{dayOf(r.date)}</td>
                      <td>
                        <button type="button" className="nm" onClick={() => onOpen(r.flow)}>{r.flow.name}</button>
                        {r.flow.autopay && <span className="tag">auto</span>}
                        {r.overridden && <span className="tag ov" title={r.note ?? 'corrected for this date'}>edited</span>}
                      </td>
                      <td className="r num">{r.delta < 0 ? <AmountCell
                        editing={editing === key} onEdit={() => setEditing(key)}
                        cents={-r.delta} overridden={r.overridden}
                        onSave={(c) => saveOverride(r.flow.id, r.date, c, false)}
                        onSkip={() => saveOverride(r.flow.id, r.date, null, true)}
                        onReset={() => saveOverride(r.flow.id, r.date, null, false)}
                      /> : ''}</td>
                      <td className="r num up">{r.delta > 0 ? <AmountCell
                        editing={editing === key} onEdit={() => setEditing(key)}
                        cents={r.delta} overridden={r.overridden}
                        onSave={(c) => saveOverride(r.flow.id, r.date, c, false)}
                        onSkip={() => saveOverride(r.flow.id, r.date, null, true)}
                        onReset={() => saveOverride(r.flow.id, r.date, null, false)}
                      /> : ''}</td>
                      <td className={`r num bal${r.balance < 0 ? ' down' : ''}`}>{formatCents(r.balance)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })}

      {blocks.length === 0 && (
        <p className="text-faint text-[13px] py-6">
          Nothing to place yet — recurring rows need a due day (or a start date, for weekly and biweekly ones).
        </p>
      )}

      {months < 24 && (
        <button type="button" className="btn-quiet mt-3" onClick={() => setMonths((n) => n + 6)}>
          Show six more months
        </button>
      )}
    </div>
  )
}

/**
 * One amount. Reads as text until clicked, then it's an input — the spreadsheet feel.
 * Blank saves nothing and clears any correction; "didn't happen" skips the occurrence.
 */
function AmountCell({ cents, overridden, editing, onEdit, onSave, onSkip, onReset }: {
  cents: number; overridden: boolean; editing: boolean
  onEdit: () => void; onSave: (cents: number) => void; onSkip: () => void; onReset: () => void
}) {
  const [val, setVal] = useState('')
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (editing) { setVal((cents / 100).toFixed(2)); ref.current?.focus(); ref.current?.select() }
  }, [editing, cents])

  if (!editing) {
    return (
      <button type="button" className={`amt${overridden ? ' ov' : ''}`} onClick={onEdit} title="Correct this one date">
        {formatCents(cents)}
      </button>
    )
  }

  const commit = () => {
    if (val.trim() === '') { onReset(); return }
    const parsed = parseDollars(val)
    if (parsed === null || Number.isNaN(parsed) || parsed < 0) { onReset(); return }
    onSave(parsed)
  }

  return (
    <span className="amte">
      <input
        ref={ref} value={val} inputMode="decimal"
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') { setVal(''); onReset() }
        }}
      />
      <button type="button" className="skip" onMouseDown={(e) => { e.preventDefault(); onSkip() }} title="It didn't happen this time">
        skip
      </button>
    </span>
  )
}
