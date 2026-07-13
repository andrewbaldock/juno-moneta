// Phase 7: estate — its own tab. The documents checklist and the trust-funding
// tracker: every asset account listed with how it's titled, so "sign things over
// to the trust" becomes a visible list that walks down to zero.
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatCents } from '../lib/money'
import { fundingHint, seedEstateItems, TRUST_PERSON } from '../lib/estate'
import { ESTATE_DOC_LABELS, ESTATE_STATUS_LABELS, TITLED_TO_LABELS, type Account, type EstateItem, type TitledTo } from '../lib/types'
import { beam } from '../components/juno/motifs'

// a custom label (e.g. "Digital-asset inventory") lives in notes for 'other' docs
const docTitle = (i: EstateItem) => {
  const label = i.item_type === 'other' && i.notes ? i.notes : ESTATE_DOC_LABELS[i.item_type]
  return i.person === TRUST_PERSON ? label : `${i.person} — ${label}`
}

type NewDoc = { person: string; item_type: EstateItem['item_type']; label: string }

export default function Estate({ householdId, people }: { householdId: string; people: string[] }) {
  const [items, setItems] = useState<EstateItem[] | null>(null)
  const [accounts, setAccounts] = useState<Account[] | null>(null)
  const [draft, setDraft] = useState<NewDoc | null>(null)
  const seeded = useRef(false)
  const dialogRef = useRef<HTMLDialogElement>(null)

  function load() {
    supabase.from('estate_items').select('*').order('person').order('item_type')
      .then(async ({ data }) => {
        // first visit seeds the standard set — the checklist just IS, no button
        if (data?.length === 0 && !seeded.current) {
          seeded.current = true
          const { error } = await supabase.from('estate_items').insert(seedEstateItems(householdId, people))
          if (!error) { load(); return }
        }
        setItems((data as EstateItem[]) ?? [])
      })
    supabase.from('accounts').select('*').order('name')
      .then(({ data }) => setAccounts((data as Account[]) ?? []))
  }
  // oxlint-disable-next-line react-hooks/exhaustive-deps -- load once; householdId never changes in a session
  useEffect(() => { load() }, [])

  async function setStatus(i: EstateItem, status: EstateItem['status']) {
    const patch: Record<string, unknown> = { status }
    if (status === 'signed' && !i.signed_date) patch.signed_date = new Date().toISOString().slice(0, 10)
    const { error } = await supabase.from('estate_items').update(patch).eq('id', i.id)
    if (error) return
    if (status === 'signed') beam()
    load()
  }

  async function setLocation(i: EstateItem, location: string) {
    const v = location.trim() || null
    if (v === i.location) return
    await supabase.from('estate_items').update({ location: v }).eq('id', i.id)
    load()
  }

  async function setTitledTo(a: Account, titled_to: TitledTo) {
    const { error } = await supabase.from('accounts').update({ titled_to }).eq('id', a.id)
    if (error) return
    if (titled_to === 'trust' || titled_to === 'beneficiary') beam()
    load()
  }

  function openAdd() {
    setDraft({ person: people[0] ?? '', item_type: 'other', label: '' })
    dialogRef.current?.showModal()
  }

  function closeAdd() {
    dialogRef.current?.close()
    setDraft(null)
  }

  async function addDoc() {
    if (!draft || !draft.person.trim()) return
    const { error } = await supabase.from('estate_items').insert({
      household_id: householdId,
      item_type: draft.item_type,
      person: draft.person.trim(),
      notes: draft.item_type === 'other' ? draft.label.trim() || null : null,
    })
    if (!error) { closeAdd(); load() }
  }

  async function removeDoc(i: EstateItem) {
    if (!confirm(`Remove "${docTitle(i)}" from the checklist?`)) return
    await supabase.from('estate_items').delete().eq('id', i.id)
    load()
  }

  if (items === null || accounts === null) return <p className="text-faint">Loading…</p>

  const assets = accounts.filter((a) => a.kind === 'asset')
  const funded = assets.filter((a) => a.titled_to === 'trust' || a.titled_to === 'beneficiary')

  return (
    <div>
      <section className="tw">
        <div className="twh">
          <h3>The documents</h3>
          <button type="button" className="btn-gold" onClick={openAdd}>+ Add</button>
        </div>
        {items.map((i) => (
          <div key={i.id} className="flex items-center gap-3 rounded-xl border border-line bg-card px-4 py-3 mb-2 flex-wrap">
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-medium">{docTitle(i)}</p>
              {i.status === 'signed' && i.signed_date && (
                <p className="text-xs text-muted mt-0.5">signed {i.signed_date}</p>
              )}
            </div>
            <input className="field" style={{ width: 170 }} defaultValue={i.location ?? ''}
              placeholder="where the papers live" aria-label={`Where the ${docTitle(i)} lives`}
              onBlur={(e) => setLocation(i, e.target.value)} />
            <select className="field" style={{ width: 140 }} value={i.status}
              aria-label={`Status of ${docTitle(i)}`}
              onChange={(e) => setStatus(i, e.target.value as EstateItem['status'])}>
              {(Object.entries(ESTATE_STATUS_LABELS) as Array<[EstateItem['status'], string]>).map(([v, label]) => (
                <option key={v} value={v}>{label}</option>
              ))}
            </select>
            <button type="button" onClick={() => removeDoc(i)} aria-label={`Remove ${docTitle(i)}`}
              className="text-faint hover:text-down bg-transparent border-0 cursor-pointer text-[15px] leading-none px-1 shrink-0">
              ×
            </button>
          </div>
        ))}
      </section>

      <dialog ref={dialogRef} className="jd w-full max-w-md m-auto">
        {draft && (
          <form className="p-6 space-y-3" onSubmit={(e) => { e.preventDefault(); addDoc() }}>
            <h3 className="font-display font-semibold text-[19px]">Add document</h3>
            <label className="block text-[13px] text-muted">Whose is it?
              <input autoFocus list="estate-people" value={draft.person}
                onChange={(e) => setDraft({ ...draft, person: e.target.value })}
                className="field mt-1" />
              <datalist id="estate-people">
                {[...people, TRUST_PERSON].map((p) => <option key={p} value={p} />)}
              </datalist>
            </label>
            <label className="block text-[13px] text-muted">Document type
              <select value={draft.item_type}
                onChange={(e) => setDraft({ ...draft, item_type: e.target.value as EstateItem['item_type'] })}
                className="field mt-1">
                {(Object.entries(ESTATE_DOC_LABELS) as Array<[EstateItem['item_type'], string]>).map(([v, label]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>
            </label>
            {draft.item_type === 'other' && (
              <label className="block text-[13px] text-muted">What is it?
                <input placeholder="e.g. Digital-asset inventory" value={draft.label}
                  onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                  className="field mt-1" />
              </label>
            )}
            <div className="flex gap-3 pt-2">
              <button type="submit" className="btn-gold">Add</button>
              <button type="button" onClick={closeAdd} className="btn-quiet">Cancel</button>
            </div>
          </form>
        )}
      </dialog>

      {assets.length > 0 && (
        <section className="tw">
          <div className="twh">
            <h3>What the trust owns</h3>
            <span className="text-xs text-faint">{funded.length} of {assets.length} assets handled</span>
          </div>
          {funded.length === 0 && (
            <p className="text-xs text-muted rounded-xl border border-line bg-card px-4 py-3 mb-2">
              The trust only controls what's titled into it — until these move, it's an
              empty box and everything still passes through probate.
            </p>
          )}
          {assets.map((a) => {
            const handled = a.titled_to === 'trust' || a.titled_to === 'beneficiary'
            return (
              <div key={a.id} className="flex items-start gap-3 rounded-xl border border-line bg-card px-4 py-3 mb-2 flex-wrap">
                {handled ? (
                  <span className="bluechip mt-0.5">{TITLED_TO_LABELS[a.titled_to]}</span>
                ) : (
                  <span className="pchip mt-0.5">outside the trust</span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-medium">
                    {a.name}
                    {a.balance_cents !== null && (
                      <span className="text-muted font-normal"> — {formatCents(a.balance_cents)}</span>
                    )}
                  </p>
                  {!handled && <p className="text-xs text-muted mt-0.5">{fundingHint(a)}</p>}
                </div>
                <select className="field" style={{ width: 160 }} value={a.titled_to}
                  aria-label={`How ${a.name} is titled`}
                  onChange={(e) => setTitledTo(a, e.target.value as TitledTo)}>
                  {(Object.entries(TITLED_TO_LABELS) as Array<[TitledTo, string]>).map(([v, label]) => (
                    <option key={v} value={v}>{label}</option>
                  ))}
                </select>
              </div>
            )
          })}
        </section>
      )}
    </div>
  )
}
