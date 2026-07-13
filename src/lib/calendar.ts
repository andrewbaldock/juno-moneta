// The bill calendar: turn the flows into dated occurrences for one month.
// One engine, two consumers — the Calendar view on "Monthly in & out", and the
// calendar-ics edge function (which carries a COPY of this file — keep in sync).
// Date strings are split by hand — never Date.parse on bare YYYY-MM-DD (UTC
// midnight reads as the previous evening in California; see brief.ts).
import type { CashFlow } from './types'

export type BillEvent = {
  date: string           // YYYY-MM-DD
  flow: CashFlow
  lateBy: string | null  // the day it turns late, when a grace period is known
}

const pad = (n: number) => String(n).padStart(2, '0')
const fmt = (utcMs: number) => {
  const d = new Date(utcMs)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}
const parts = (dateStr: string): [number, number, number] => {
  const [y, m, d] = dateStr.split('-').map(Number)
  return [y, m - 1, d]
}
const DAY = 86_400_000

/** Clamp a due day into the target month (due_day 31 in Feb → Feb 28/29). */
const clampDay = (year: number, month0: number, day: number) =>
  Math.min(day, new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate())

/**
 * All occurrences in (year, month0) for the active flows. Flows that recur but
 * can't be placed on a day yet (no due_day, no start_date anchor) come back in
 * `unplaced` — that list is the "add a due day" chore.
 */
export function monthEvents(flows: CashFlow[], year: number, month0: number): { events: BillEvent[]; unplaced: CashFlow[] } {
  const monthStart = Date.UTC(year, month0, 1)
  const monthEnd = Date.UTC(year, month0 + 1, 0) // last day of month
  const events: BillEvent[] = []
  const unplaced: CashFlow[] = []

  const push = (flow: CashFlow, utcMs: number) => {
    events.push({
      date: fmt(utcMs),
      flow,
      lateBy: flow.late_after_days === null ? null : fmt(utcMs + flow.late_after_days * DAY),
    })
  }

  for (const f of flows) {
    if (!f.active) continue
    const anchor = f.start_date ? Date.UTC(...parts(f.start_date)) : null
    const ends = f.end_date ? Date.UTC(...parts(f.end_date)) : null
    if (anchor !== null && anchor > monthEnd) continue
    if (ends !== null && ends < monthStart) continue

    if (f.cadence === 'one_time') {
      if (anchor !== null && anchor >= monthStart && anchor <= monthEnd) push(f, anchor)
      else if (anchor === null) unplaced.push(f)
      continue
    }

    if (f.cadence === 'weekly' || f.cadence === 'biweekly') {
      if (anchor === null) { unplaced.push(f); continue }
      const step = (f.cadence === 'weekly' ? 7 : 14) * DAY
      const first = anchor >= monthStart ? anchor : anchor + Math.ceil((monthStart - anchor) / step) * step
      for (let t = first; t <= monthEnd; t += step) {
        if (ends !== null && t > ends) break
        push(f, t)
      }
      continue
    }

    // month-based cadences: monthly, bimonthly, every_4_months, annual
    const everyMonths = f.cadence === 'monthly' ? 1 : f.cadence === 'bimonthly' ? 2 : f.cadence === 'every_4_months' ? 4 : 12
    const day = f.due_day ?? (f.start_date ? parts(f.start_date)[2] : null)
    if (day === null || (everyMonths > 1 && anchor === null)) { unplaced.push(f); continue }
    if (everyMonths > 1) {
      const [ay, am] = parts(f.start_date as string)
      const monthsSince = (year - ay) * 12 + (month0 - am)
      if (monthsSince % everyMonths !== 0) continue
    }
    const t = Date.UTC(year, month0, clampDay(year, month0, day))
    if (anchor !== null && t < anchor) continue
    if (ends !== null && t > ends) continue
    push(f, t)
  }

  events.sort((a, b) => a.date.localeCompare(b.date) || a.flow.name.localeCompare(b.flow.name))
  return { events, unplaced }
}
