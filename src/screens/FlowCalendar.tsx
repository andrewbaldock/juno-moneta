// The Calendar view of "Monthly in & out": every flow with a known day, on its
// day, in the app's own week/month/year grid (lib/calendar.ts). Share hands out
// the live ICS feed URL from household settings.calendar — Google/Apple
// Calendar subscribe to it. An embed_url in settings would replace the grid
// with an iframe; unused since the ICS route needs no Google calendar.
import { useRef, useState } from 'react'
import { monthEvents } from '../lib/calendar'
import { formatCents } from '../lib/money'
import type { CashFlow } from '../lib/types'

export type CalendarLinks = { embed_url?: string; ics_url?: string }

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY = 86_400_000

type Scale = 'week' | 'month' | 'year'

const short = (m0: number) => MONTHS[m0].slice(0, 3)
const ds = (y: number, m0: number, d: number) => `${y}-${String(m0 + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
// anchor.d can exceed the month (Jan 31 → Feb); clamp before UTC math or Date.UTC rolls over
const clampD = (y: number, m0: number, d: number) => Math.min(d, new Date(y, m0 + 1, 0).getDate())

export default function FlowCalendar({ flows, links, onOpen }: {
  flows: CashFlow[]
  links: CalendarLinks
  onOpen: (f: CashFlow) => void
}) {
  const now = new Date()
  const [scale, setScaleRaw] = useState<Scale>(() => {
    const v = localStorage.getItem('juno.flows.calScale')
    return v === 'week' || v === 'year' ? v : 'month'
  })
  const setScale = (s: Scale) => { setScaleRaw(s); localStorage.setItem('juno.flows.calScale', s) }
  const [anchor, setAnchor] = useState(() => ({ y: now.getFullYear(), m0: now.getMonth(), d: now.getDate() }))
  const shareRef = useRef<HTMLDialogElement>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  // Sun–Sat week containing the anchor day. All week math in UTC ms — same
  // convention as lib/calendar.ts (local-time arithmetic breaks on DST).
  const anchorUtc = Date.UTC(anchor.y, anchor.m0, clampD(anchor.y, anchor.m0, anchor.d))
  const weekStart = anchorUtc - new Date(anchorUtc).getUTCDay() * DAY
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const t = new Date(weekStart + i * DAY)
    return { y: t.getUTCFullYear(), m0: t.getUTCMonth(), d: t.getUTCDate() }
  })

  // unplaced is month-independent (no due day / no anchor), so the anchor-month
  // call covers every scale
  const { events: monthEvts, unplaced } = monthEvents(flows, anchor.y, anchor.m0)
  let events = monthEvts
  if (scale === 'week') {
    const wanted = new Set(weekDates.map((w) => ds(w.y, w.m0, w.d)))
    const other = [weekDates[0], weekDates[6]].find((w) => w.m0 !== anchor.m0 || w.y !== anchor.y)
    events = [...monthEvts, ...(other ? monthEvents(flows, other.y, other.m0).events : [])]
      .filter((e) => wanted.has(e.date))
  }
  const byDay = new Map<string, typeof events>()
  for (const e of events) {
    const list = byDay.get(e.date) ?? []
    list.push(e)
    byDay.set(e.date, list)
  }
  const yearMonths = scale === 'year'
    ? Array.from({ length: 12 }, (_, m) => new Set(monthEvents(flows, anchor.y, m).events.map((e) => e.date)))
    : null

  const firstDow = new Date(anchor.y, anchor.m0, 1).getDay()
  const daysInMonth = new Date(anchor.y, anchor.m0 + 1, 0).getDate()
  const cells: Array<string | null> = scale === 'week'
    ? weekDates.map((w) => ds(w.y, w.m0, w.d))
    : [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => ds(anchor.y, anchor.m0, i + 1))]

  function step(delta: number) {
    setAnchor(({ y, m0, d }) => {
      if (scale === 'year') return { y: y + delta, m0, d }
      if (scale === 'month') {
        const k = y * 12 + m0 + delta
        return { y: Math.floor(k / 12), m0: ((k % 12) + 12) % 12, d }
      }
      const t = new Date(Date.UTC(y, m0, clampD(y, m0, d)) + delta * 7 * DAY)
      return { y: t.getUTCFullYear(), m0: t.getUTCMonth(), d: t.getUTCDate() }
    })
  }

  const wa = weekDates[0], wb = weekDates[6]
  const label = scale === 'year' ? String(anchor.y)
    : scale === 'week'
      ? `${short(wa.m0)} ${wa.d}${wa.y !== wb.y ? `, ${wa.y}` : ''} – ${short(wb.m0)} ${wb.d}, ${wb.y}`
      : `${MONTHS[anchor.m0]} ${anchor.y}`

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(url)
      setTimeout(() => setCopied(null), 1500)
    } catch { /* clipboard denied — the url is visible to select by hand */ }
  }

  return (
    <div>
      <section className="tw">
        <div className="twh">
          <h3 className="flex items-center gap-2">
            <button type="button" className="btn-quiet" onClick={() => step(-1)} aria-label={`Previous ${scale}`}>‹</button>
            {label}
            <button type="button" className="btn-quiet" onClick={() => step(1)} aria-label={`Next ${scale}`}>›</button>
          </h3>
          <div className="flex items-center gap-2">
            {!links.embed_url && (['week', 'month', 'year'] as const).map((s) => (
              <button key={s} type="button" className={scale === s ? 'btn-mint' : 'btn-quiet'} onClick={() => setScale(s)}>
                {s[0].toUpperCase() + s.slice(1)}
              </button>
            ))}
            <button type="button" className="btn-gold" onClick={() => shareRef.current?.showModal()}>Share</button>
          </div>
        </div>

        {links.embed_url ? (
          <iframe src={links.embed_url} title="Juno calendar"
            style={{ width: '100%', height: 560, border: '1px solid var(--line)', borderRadius: 12, background: '#fff' }} />
        ) : scale === 'year' ? (
          <div className="grid grid-cols-3 gap-3">
            {yearMonths!.map((has, m) => {
              const fd = new Date(anchor.y, m, 1).getDay()
              const dim = new Date(anchor.y, m + 1, 0).getDate()
              const miniCells: Array<number | null> = [...Array(fd).fill(null), ...Array.from({ length: dim }, (_, i) => i + 1)]
              return (
                <div key={m} className="rounded-xl border border-line bg-card p-2">
                  <button type="button" className="btn-quiet w-full mb-1"
                    onClick={() => { setAnchor((a) => ({ ...a, m0: m })); setScale('month') }}>
                    {short(m)}
                  </button>
                  <div className="grid grid-cols-7">
                    {miniCells.map((d, i) => {
                      const date = d === null ? null : ds(anchor.y, m, d)
                      return (
                        <div key={i} className="text-[9px] text-center py-0.5 rounded"
                          style={date === today ? { background: 'var(--sunken)', fontWeight: 600 }
                            : date && has.has(date) ? { background: 'var(--mint-soft)', color: 'var(--mint-ink)' }
                            : undefined}>
                          {d ?? ''}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-line bg-card overflow-hidden">
            <div className="grid grid-cols-7 border-b border-line">
              {DOW.map((d) => (
                <div key={d} className="text-[11px] text-faint text-center py-1.5">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((date, i) => {
                const dayEvents = date ? byDay.get(date) ?? [] : []
                const dayNum = date ? Number(date.slice(8)) : null
                const corner = scale === 'week' && dayNum !== null && (i === 0 || dayNum === 1)
                  ? `${short(Number(date!.slice(5, 7)) - 1)} ${dayNum}`
                  : dayNum
                return (
                  <div key={i} className={`${scale === 'week' ? 'min-h-[200px]' : 'min-h-[76px]'} border-b border-r border-line p-1`}
                    style={date === today ? { background: 'var(--sunken)' } : undefined}>
                    {date !== null && <div className="text-[11px] text-faint text-right pr-0.5">{corner}</div>}
                    {dayEvents.map((e) => (
                      <button key={e.flow.id + e.date} type="button" onClick={() => onOpen(e.flow)}
                        title={`${e.flow.name}${e.lateBy ? ` — late after ${e.lateBy}` : ''}${e.flow.autopay ? ' · autopay' : ''}`}
                        className="block w-full text-left text-[11px] leading-tight rounded px-1 py-0.5 mb-0.5 border-0 cursor-pointer truncate"
                        style={{
                          background: e.flow.direction === 'income' ? 'var(--mint-soft)' : 'var(--sunken)',
                          color: e.flow.direction === 'income' ? 'var(--mint-ink)' : 'var(--ink)',
                        }}>
                        {e.flow.autopay ? '↻ ' : ''}{e.flow.name}
                        {e.flow.amount_cents !== null && <span className="text-faint"> {formatCents(e.flow.amount_cents)}</span>}
                      </button>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {unplaced.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-muted mb-1.5">No day on the calendar yet — click to add a due day:</p>
            <div className="flex flex-wrap gap-1.5">
              {unplaced.map((f) => (
                <button key={f.id} type="button" className="pchip cursor-pointer border-0" onClick={() => onOpen(f)}>
                  {f.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <dialog ref={shareRef} className="jd w-full max-w-md m-auto">
        <div className="p-6 space-y-3">
          <h3 className="font-display font-semibold text-[19px]">Share the calendar</h3>
          {links.ics_url || links.embed_url ? (
            <>
              <p className="text-[13px] text-muted">
                Juno publishes a live calendar feed of every due date. Subscribe from your
                own calendar and it stays current — nothing to maintain.
              </p>
              {links.ics_url && (
                <div>
                  <p className="text-[13px] font-medium mb-1">Subscribe by URL (Google Calendar → Other calendars → From URL)</p>
                  <div className="flex gap-2">
                    <input readOnly value={links.ics_url} className="field flex-1 text-xs" onFocus={(e) => e.target.select()} />
                    <button type="button" className="btn-mint" onClick={() => copy(links.ics_url as string)}>
                      {copied === links.ics_url ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}
              {links.embed_url && (
                <div>
                  <p className="text-[13px] font-medium mb-1">View in a browser</p>
                  <div className="flex gap-2">
                    <input readOnly value={links.embed_url} className="field flex-1 text-xs" onFocus={(e) => e.target.select()} />
                    <button type="button" className="btn-mint" onClick={() => copy(links.embed_url as string)}>
                      {copied === links.embed_url ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-[13px] text-muted">
              Juno's calendar feed isn't set up yet. Once it is, the subscribe link
              lives here — everyone in the household adds it to their own calendar and every due
              date shows up on your phones.
            </p>
          )}
          <div className="pt-2">
            <button type="button" className="btn-quiet" onClick={() => shareRef.current?.close()}>Close</button>
          </div>
        </div>
      </dialog>
    </div>
  )
}
