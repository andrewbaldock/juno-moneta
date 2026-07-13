// Pure ICS builder: flows → RFC 5545 calendar text. All-day events, one per
// occurrence, 1 month back / 12 ahead of the given month. Kept pure (no Deno,
// no fetch) so bun test covers it — index.ts is the thin handler around it.
import { monthEvents } from './calendar.ts'
import type { CashFlow } from './types.ts'

// Backslash first, then the chars RFC 5545 says to escape in text values.
const esc = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')

const usd = (cents: number) =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: cents % 100 === 0 ? 0 : 2 })

const compact = (date: string) => date.replaceAll('-', '') // YYYY-MM-DD → YYYYMMDD

export function buildIcs(flows: CashFlow[], today: { y: number; m0: number }): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Juno//bills//EN',
    'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:Juno — bills',
    'X-WR-TIMEZONE:America/Los_Angeles',
    'REFRESH-INTERVAL;VALUE=DURATION:PT12H',
    'X-PUBLISHED-TTL:PT12H',
  ]

  // ponytail: no 75-octet line folding — summaries here are a name + amount,
  // far under the limit; add folding if a flow name ever gets essay-length
  for (let k = -1; k <= 12; k++) {
    const total = today.y * 12 + today.m0 + k
    const y = Math.floor(total / 12)
    const m0 = ((total % 12) + 12) % 12
    for (const e of monthEvents(flows, y, m0).events) {
      const amount = e.flow.amount_cents === null ? ''
        : ` — ${e.flow.direction === 'income' ? '+' : ''}${usd(e.flow.amount_cents)}`
      const notes = [
        e.flow.autopay ? 'autopay' : null,
        e.lateBy ? `late after ${e.lateBy}` : null,
      ].filter(Boolean).join(' · ')
      lines.push(
        'BEGIN:VEVENT',
        `UID:${e.flow.id}-${e.date}@juno`,
        `DTSTAMP:${compact(e.date)}T000000Z`,
        `DTSTART;VALUE=DATE:${compact(e.date)}`,
        `SUMMARY:${esc(e.flow.name + amount)}`,
        ...(notes ? [`DESCRIPTION:${esc(notes)}`] : []),
        'END:VEVENT',
      )
    }
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n') + '\r\n'
}
