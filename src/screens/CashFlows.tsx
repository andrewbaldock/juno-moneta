import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatCents, parseDollars, centsToInput } from '../lib/money'
import { monthlyNet } from '../lib/metrics'
import { CADENCE_LABELS, EXPENSE_CATEGORIES, INCOME_CATEGORIES, type Account, type CashFlow } from '../lib/types'
import { beam } from '../components/juno/motifs'
import { juno } from '../copy/juno'
import FlowCalendar, { type CalendarLinks } from './FlowCalendar'

type Draft = {
  id?: string
  name: string
  direction: 'income' | 'expense'
  category: string
  amount: string
  cadence: CashFlow['cadence']
  start_date: string
  end_date: string
  essential: boolean
  committed: boolean
  tax_setaside_pct: string
  account_id: string
  due_day: string
  late_after_days: string
  autopay: boolean
  notes: string
}

const emptyDraft = (direction: 'income' | 'expense'): Draft => ({
  name: '', direction, category: direction === 'income' ? 'salary' : 'utilities',
  amount: '', cadence: 'monthly', start_date: '', end_date: '',
  essential: direction === 'expense', committed: true, tax_setaside_pct: '', account_id: '',
  due_day: '', late_after_days: '', autopay: false, notes: '',
})

type SortKey = 'name' | 'category' | 'amount_cents' | 'cadence'

function cmp(a: unknown, b: unknown): number {
  if (a === null || a === undefined) return b === null || b === undefined ? 0 : 1
  if (b === null || b === undefined) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b))
}

export default function CashFlows({ householdId }: { householdId: string }) {
  const [rows, setRows] = useState<CashFlow[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'amount_cents', dir: -1 })
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (!menuFor) return
    const close = () => setMenuFor(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [menuFor])

  function sortBy(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }))
  }

  const [debts, setDebts] = useState<Pick<Account, 'id' | 'name'>[]>([])
  const [view, setView] = useState<'list' | 'calendar'>(() =>
    localStorage.getItem('juno.flows.view') === 'calendar' ? 'calendar' : 'list')
  const [calLinks, setCalLinks] = useState<CalendarLinks>({})

  function switchView(v: 'list' | 'calendar') {
    setView(v)
    localStorage.setItem('juno.flows.view', v)
  }

  async function load() {
    const { data } = await supabase.from('cash_flows').select('*').order('amount_cents', { ascending: false, nullsFirst: false })
    setRows((data as CashFlow[]) ?? [])
  }
  useEffect(() => {
    load()
    supabase.from('accounts').select('id,name').eq('kind', 'liability').order('name')
      .then(({ data }) => setDebts(data ?? []))
    supabase.from('households').select('settings').limit(1).single()
      .then(({ data }) => setCalLinks((data?.settings as { calendar?: CalendarLinks } | null)?.calendar ?? {}))
  }, [])

  function open(d: Draft) {
    setDraft(d)
    setError(null)
    dialogRef.current?.showModal()
  }

  function close() {
    dialogRef.current?.close()
    setDraft(null)
  }

  async function save() {
    if (!draft) return
    if (!draft.name.trim()) { setError('Name is required.'); return }
    const amount = parseDollars(draft.amount)
    if (Number.isNaN(amount)) { setError('Amount doesn’t look like a dollar amount. Leave it blank if unknown.'); return }
    const pct = draft.tax_setaside_pct.trim() === '' ? null : Number(draft.tax_setaside_pct)
    if (pct !== null && Number.isNaN(pct)) { setError('Tax set-aside should be a number like 35.'); return }
    const dueDay = draft.due_day.trim() === '' ? null : Number(draft.due_day)
    if (dueDay !== null && (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31)) { setError('Due day is a day of the month, 1–31.'); return }
    const grace = draft.late_after_days.trim() === '' ? null : Number(draft.late_after_days)
    if (grace !== null && (!Number.isInteger(grace) || grace < 0)) { setError('Late after should be a number of days, like 15.'); return }
    const rec = {
      household_id: householdId,
      name: draft.name.trim(),
      direction: draft.direction,
      category: draft.category,
      amount_cents: amount,
      cadence: draft.cadence,
      start_date: draft.start_date || null,
      end_date: draft.end_date || null,
      essential: draft.essential,
      committed: draft.committed,
      tax_setaside_pct: pct,
      account_id: draft.account_id || null,
      due_day: dueDay,
      late_after_days: grace,
      autopay: draft.autopay,
      notes: draft.notes.trim() || null,
    }
    const q = draft.id
      ? supabase.from('cash_flows').update(rec).eq('id', draft.id)
      : supabase.from('cash_flows').insert(rec)
    const { error: err } = await q
    if (err) { setError(err.message); return }
    // a gap just filled = the picture sharpened = she beams (05-system-notes.md §3)
    const old = draft.id ? rows.find((r) => r.id === draft.id) : undefined
    if (old && old.amount_cents === null && amount !== null) beam()
    close()
    load()
  }

  async function remove(row: CashFlow) {
    if (!confirm(`Delete "${row.name}"?`)) return
    await supabase.from('cash_flows').delete().eq('id', row.id)
    load()
  }

  function toDraft(row: CashFlow, duplicate = false): Draft {
    return {
      id: duplicate ? undefined : row.id,
      name: duplicate ? `${row.name} (copy)` : row.name,
      direction: row.direction,
      category: row.category,
      amount: centsToInput(row.amount_cents),
      cadence: row.cadence,
      start_date: row.start_date ?? '',
      end_date: row.end_date ?? '',
      essential: row.essential,
      committed: row.committed,
      tax_setaside_pct: row.tax_setaside_pct === null ? '' : String(row.tax_setaside_pct),
      account_id: row.account_id ?? '',
      due_day: row.due_day === null ? '' : String(row.due_day),
      late_after_days: row.late_after_days === null ? '' : String(row.late_after_days),
      autopay: row.autopay,
      notes: row.notes ?? '',
    }
  }

  const categories = draft?.direction === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
  const sections: Array<['income' | 'expense', string]> = [['income', 'Coming in'], ['expense', 'Going out']]
  const sorted = [...rows].sort((a, b) => sort.dir * cmp(a[sort.key], b[sort.key]))

  const now = new Date()
  const nowKey = now.getFullYear() * 12 + now.getMonth()
  const net = monthlyNet(rows, nowKey)

  const Th = ({ label, k, right = false }: { label: string; k: SortKey; right?: boolean }) => (
    <th className={right ? 'r' : ''}>
      <button type="button" onClick={() => sortBy(k)} className="hover:text-muted" style={{ font: 'inherit', color: 'inherit', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        {label}{sort.key === k ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
      </button>
    </th>
  )

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <button type="button" className={view === 'list' ? 'btn-mint' : 'btn-quiet'} onClick={() => switchView('list')}>List</button>
        <button type="button" className={view === 'calendar' ? 'btn-mint' : 'btn-quiet'} onClick={() => switchView('calendar')}>Calendar</button>
      </div>

      {view === 'calendar' && (
        <FlowCalendar flows={rows} links={calLinks} onOpen={(f) => open(toDraft(f))} />
      )}

      {view === 'list' && sections.map(([direction, title]) => (
        <section key={direction} className="tw">
          <div className="twh">
            <h3>{title}</h3>
            <button type="button" className="btn-gold" onClick={() => open(emptyDraft(direction))}>+ Add</button>
          </div>
          <div className="tscroll">
            <table className="jt">
              <thead>
                <tr>
                  <Th label="Name" k="name" />
                  <Th label="Category" k="category" />
                  <Th label="Amount" k="amount_cents" right />
                  <Th label="Cadence" k="cadence" />
                  <th />
                </tr>
              </thead>
              <tbody>
                {sorted.filter((r) => r.direction === direction).map((r) => (
                  <tr key={r.id} onClick={() => open(toDraft(r))}>
                    <td>
                      <div className="rn">
                        {r.name}
                        {direction === 'expense' && !r.essential && <span className="bluechip ml-2">optional</span>}
                        {direction === 'income' && !r.committed && <span className="bluechip ml-2">hypothetical</span>}
                        {r.end_date && <span className="text-xs text-faint ml-2">ends {r.end_date}</span>}
                      </div>
                      {r.notes && <div className="rnote">{r.notes}</div>}
                    </td>
                    <td className="cat">{r.category.replace(/_/g, ' ')}</td>
                    <td className="r">
                      {r.amount_cents === null ? <span className="pchip">not entered</span> : formatCents(r.amount_cents)}
                    </td>
                    <td className="cat">{CADENCE_LABELS[r.cadence]}{r.cadence === 'one_time' && r.start_date ? ` · ${r.start_date}` : ''}</td>
                    <td className="dots" style={{ position: 'relative' }}>
                      <button type="button" aria-label="Row actions"
                        onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === r.id ? null : r.id) }}
                        style={{ font: 'inherit', fontSize: 16, lineHeight: 1, color: 'var(--faint)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}>
                        ⋮
                      </button>
                      {menuFor === r.id && (
                        <div className="rowmenu" onClick={(e) => e.stopPropagation()}>
                          <button type="button" onClick={() => { setMenuFor(null); open(toDraft(r, true)) }}>Duplicate</button>
                          <button type="button" className="danger" onClick={() => { setMenuFor(null); remove(r) }}>Delete</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {rows.filter((r) => r.direction === direction).length === 0 && (
                  <tr><td colSpan={5} className="text-faint">Nothing here yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <div className="mnet">
        <span className="lab">{juno.keptEachMonth}</span>
        <span className="v">{net.cents < 0 ? '−' : '+'}{formatCents(Math.abs(net.cents))}</span>
      </div>

      <dialog ref={dialogRef} className="jd w-full max-w-md m-auto">
        {draft && (
          <form className="p-6 space-y-3" onSubmit={(e) => { e.preventDefault(); save() }}>
            <h3 className="font-display font-semibold text-[19px]">
              {draft.id ? 'Edit' : 'Add'} {draft.direction === 'income' ? 'income' : 'expense'}
            </h3>
            <label className="block text-[13px] text-muted">Name
              <input autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="field mt-1" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-[13px] text-muted">Category
                <select value={categories.includes(draft.category) ? draft.category : '__custom'}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value === '__custom' ? '' : e.target.value })}
                  className="field mt-1">
                  {categories.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                  <option value="__custom">custom…</option>
                </select>
              </label>
              <label className="block text-[13px] text-muted">Amount ($)
                <input inputMode="decimal" placeholder="unknown" value={draft.amount}
                  onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                  className="field mt-1" />
              </label>
            </div>
            {!categories.includes(draft.category) && (
              <input placeholder="Custom category" value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                className="field" />
            )}
            <div className="grid grid-cols-3 gap-3">
              <label className="block text-[13px] text-muted">Cadence
                <select value={draft.cadence}
                  onChange={(e) => setDraft({ ...draft, cadence: e.target.value as CashFlow['cadence'] })}
                  className="field mt-1">
                  {Object.entries(CADENCE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              <label className="block text-[13px] text-muted">{draft.cadence === 'one_time' ? 'Date' : 'Starts'}
                <input type="date" value={draft.start_date}
                  onChange={(e) => setDraft({ ...draft, start_date: e.target.value })}
                  className="field mt-1" />
              </label>
              <label className="block text-[13px] text-muted">Ends
                <input type="date" value={draft.end_date} disabled={draft.cadence === 'one_time'}
                  onChange={(e) => setDraft({ ...draft, end_date: e.target.value })}
                  className="field mt-1 disabled:bg-sunken" />
              </label>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <label className="block text-[13px] text-muted">Due (day of month)
                <input inputMode="numeric" placeholder="e.g. 1" value={draft.due_day}
                  disabled={draft.cadence === 'one_time' || draft.cadence === 'weekly' || draft.cadence === 'biweekly'}
                  onChange={(e) => setDraft({ ...draft, due_day: e.target.value })}
                  className="field mt-1 disabled:bg-sunken" />
              </label>
              <label className="block text-[13px] text-muted">Late after (days)
                <input inputMode="numeric" placeholder="grace period" value={draft.late_after_days}
                  onChange={(e) => setDraft({ ...draft, late_after_days: e.target.value })}
                  className="field mt-1" />
              </label>
              <label className="flex items-end gap-2 text-[13px] text-muted pb-2.5">
                <input type="checkbox" checked={draft.autopay}
                  onChange={(e) => setDraft({ ...draft, autopay: e.target.checked })} />
                Autopay
              </label>
            </div>
            <div className="flex gap-6 text-[13px] text-muted">
              {draft.direction === 'expense' && (
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={draft.essential}
                    onChange={(e) => setDraft({ ...draft, essential: e.target.checked })} />
                  Essential (survival budget)
                </label>
              )}
              {draft.direction === 'income' && (
                <>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={draft.committed}
                      onChange={(e) => setDraft({ ...draft, committed: e.target.checked })} />
                    Committed (real, not hoped-for)
                  </label>
                  <label className="flex items-center gap-2">
                    Tax set-aside %
                    <input inputMode="decimal" value={draft.tax_setaside_pct}
                      onChange={(e) => setDraft({ ...draft, tax_setaside_pct: e.target.value })}
                      className="field w-16 px-2 py-1" />
                  </label>
                </>
              )}
            </div>
            {draft.direction === 'expense' && debts.length > 0 && (
              <label className="block text-[13px] text-muted">Pays down a debt? (links the payment so the projection can amortize it)
                <select value={draft.account_id}
                  onChange={(e) => setDraft({ ...draft, account_id: e.target.value })}
                  className="field mt-1">
                  <option value="">no — regular expense</option>
                  {debts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </label>
            )}
            <label className="block text-[13px] text-muted">Notes
              <input value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                className="field mt-1" />
            </label>
            {error && <p className="text-sm text-down">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button type="submit" className="btn-gold">Save</button>
              <button type="button" onClick={close} className="btn-quiet">Cancel</button>
            </div>
          </form>
        )}
      </dialog>
    </div>
  )
}
