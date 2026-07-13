import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatCents, parseDollars, centsToInput } from '../lib/money'
import { ACCOUNT_DETAIL_FIELDS, ASSET_CATEGORIES, LIABILITY_CATEGORIES, TITLED_TO_LABELS, type Account, type TitledTo } from '../lib/types'
import { beam } from '../components/juno/motifs'

type Draft = {
  id?: string
  name: string
  kind: 'asset' | 'liability'
  category: string
  balance: string
  interest_rate: string
  last4: string
  titled_to: TitledTo
  details: Record<string, string>
  notes: string
}

const emptyDraft = (kind: 'asset' | 'liability'): Draft => ({
  name: '', kind, category: kind === 'asset' ? 'checking' : 'credit_card',
  balance: '', interest_rate: '', last4: '', titled_to: 'unknown', details: {}, notes: '',
})

type SortKey = 'name' | 'category' | 'balance_cents' | 'interest_rate'

function cmp(a: unknown, b: unknown): number {
  if (a === null || a === undefined) return b === null || b === undefined ? 0 : 1
  if (b === null || b === undefined) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b))
}

export default function Accounts({ householdId }: { householdId: string }) {
  const [rows, setRows] = useState<Account[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'name', dir: 1 })
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

  async function load() {
    const { data } = await supabase.from('accounts').select('*').order('name')
    setRows((data as Account[]) ?? [])
  }
  useEffect(() => { load() }, [])

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
    const balance = parseDollars(draft.balance)
    if (Number.isNaN(balance)) { setError('Balance doesn’t look like a dollar amount. Leave it blank if unknown.'); return }
    const rate = draft.interest_rate.trim() === '' ? null : Number(draft.interest_rate)
    if (rate !== null && Number.isNaN(rate)) { setError('Interest rate should be a number like 7.06.'); return }
    const rec = {
      household_id: householdId,
      name: draft.name.trim(),
      kind: draft.kind,
      category: draft.category,
      balance_cents: balance,
      interest_rate: rate,
      last4: draft.last4.trim() || null,
      titled_to: draft.titled_to,
      // keep only filled-in detail fields; blanks drop out of the bag
      details: Object.fromEntries(Object.entries(draft.details).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v)),
      notes: draft.notes.trim() || null,
    }
    const q = draft.id
      ? supabase.from('accounts').update(rec).eq('id', draft.id)
      : supabase.from('accounts').insert(rec)
    const { error: err } = await q
    if (err) { setError(err.message); return }
    // a gap just filled = the picture sharpened = she beams (05-system-notes.md §3)
    const old = draft.id ? rows.find((r) => r.id === draft.id) : undefined
    if (old && ((old.balance_cents === null && balance !== null) || (old.interest_rate === null && rate !== null))) beam()
    close()
    load()
  }

  async function remove(row: Account) {
    if (!confirm(`Delete "${row.name}"? Its balance history goes with it.`)) return
    await supabase.from('accounts').delete().eq('id', row.id)
    load()
  }

  function toDraft(row: Account, duplicate = false): Draft {
    return {
      id: duplicate ? undefined : row.id,
      name: duplicate ? `${row.name} (copy)` : row.name,
      kind: row.kind,
      category: row.category,
      balance: centsToInput(row.balance_cents),
      interest_rate: row.interest_rate === null ? '' : String(row.interest_rate),
      last4: row.last4 ?? '',
      titled_to: row.titled_to,
      details: { ...(row.details ?? {}) },
      notes: row.notes ?? '',
    }
  }

  const categories = draft?.kind === 'asset' ? ASSET_CATEGORIES : LIABILITY_CATEGORIES
  const sections: Array<['asset' | 'liability', string]> = [['asset', 'Assets'], ['liability', 'Debts']]
  const sorted = [...rows].sort((a, b) => sort.dir * cmp(a[sort.key], b[sort.key]))

  const Th = ({ label, k, right = false }: { label: string; k: SortKey; right?: boolean }) => (
    <th className={right ? 'r' : ''}>
      <button type="button" onClick={() => sortBy(k)} className="hover:text-muted" style={{ font: 'inherit', color: 'inherit', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        {label}{sort.key === k ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
      </button>
    </th>
  )

  return (
    <div>
      {sections.map(([kind, title]) => (
        <section key={kind} className="tw">
          <div className="twh">
            <h3>{title}</h3>
            <button type="button" className="btn-gold" onClick={() => open(emptyDraft(kind))}>+ Add</button>
          </div>
          <div className="tscroll">
            <table className="jt">
              <thead>
                <tr>
                  <Th label="Name" k="name" />
                  <Th label="Category" k="category" />
                  <Th label="Balance" k="balance_cents" right />
                  <Th label="Rate" k="interest_rate" right />
                  <th />
                </tr>
              </thead>
              <tbody>
                {sorted.filter((r) => r.kind === kind).map((r) => (
                  <tr key={r.id} onClick={() => open(toDraft(r))}>
                    <td>
                      <div className="rn">
                        {r.name}
                        {r.kind === 'asset' && (r.titled_to === 'trust' || r.titled_to === 'beneficiary') && (
                          <span className="bluechip" style={{ marginLeft: 8 }}>{TITLED_TO_LABELS[r.titled_to]}</span>
                        )}
                      </div>
                      {r.notes && <div className="rnote">{r.notes}</div>}
                    </td>
                    <td className="cat">{r.category.replace(/_/g, ' ')}</td>
                    <td className="r">
                      {r.balance_cents === null ? <span className="pchip">not entered</span> : formatCents(r.balance_cents)}
                    </td>
                    <td className="r">
                      {r.interest_rate !== null ? `${r.interest_rate}%` : r.kind === 'liability' ? (
                        <span className="pchip">add rate</span>
                      ) : ''}
                    </td>
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
                {rows.filter((r) => r.kind === kind).length === 0 && (
                  <tr><td colSpan={5} className="text-faint">Nothing here yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <dialog ref={dialogRef} className="jd w-full max-w-md m-auto">
        {draft && (
          <form className="p-6 space-y-3" onSubmit={(e) => { e.preventDefault(); save() }}>
            <h3 className="font-display font-semibold text-[19px]">
              {draft.id ? 'Edit' : 'Add'} {draft.kind === 'asset' ? 'asset' : 'debt'}
            </h3>
            <label className="block text-[13px] text-muted">Name
              <input autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="field mt-1" />
            </label>
            <label className="block text-[13px] text-muted">Category
              <select value={categories.includes(draft.category) ? draft.category : '__custom'}
                onChange={(e) => setDraft({ ...draft, category: e.target.value === '__custom' ? '' : e.target.value })}
                className="field mt-1">
                {categories.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                <option value="__custom">custom…</option>
              </select>
            </label>
            {!categories.includes(draft.category) && (
              <input placeholder="Custom category" value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                className="field" />
            )}
            <label className="block text-[13px] text-muted">Current balance ($) — leave blank if unknown
              <input inputMode="decimal" placeholder="unknown" value={draft.balance}
                onChange={(e) => setDraft({ ...draft, balance: e.target.value })}
                className="field mt-1" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-[13px] text-muted">{draft.kind === 'asset' ? 'Expected growth %/yr' : 'Interest rate %'}
                <input inputMode="decimal" value={draft.interest_rate}
                  onChange={(e) => setDraft({ ...draft, interest_rate: e.target.value })}
                  className="field mt-1" />
              </label>
              <label className="block text-[13px] text-muted">Last 4 digits
                <input maxLength={4} value={draft.last4}
                  onChange={(e) => setDraft({ ...draft, last4: e.target.value })}
                  className="field mt-1" />
              </label>
            </div>
            {(ACCOUNT_DETAIL_FIELDS[draft.category] ?? []).length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {(ACCOUNT_DETAIL_FIELDS[draft.category] ?? []).map((f) => (
                  <label key={f.key} className="block text-[13px] text-muted">{f.label}
                    <input value={draft.details[f.key] ?? ''} placeholder={f.placeholder}
                      onChange={(e) => setDraft({ ...draft, details: { ...draft.details, [f.key]: e.target.value } })}
                      className="field mt-1" />
                  </label>
                ))}
              </div>
            )}
            {draft.kind === 'asset' && (
              <label className="block text-[13px] text-muted">Titled to — who owns it on paper
                <select value={draft.titled_to}
                  onChange={(e) => setDraft({ ...draft, titled_to: e.target.value as TitledTo })}
                  className="field mt-1">
                  {(Object.entries(TITLED_TO_LABELS) as Array<[TitledTo, string]>).map(([v, label]) => (
                    <option key={v} value={v}>{label}</option>
                  ))}
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
