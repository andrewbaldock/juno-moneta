// The proactive open: when a fresh conversation opens, Juno has already looked.
// Rank candidate observations by urgency × actionability, surface the top one
// (a second, at most, as the yod footnote). 05-system-notes.md §1.
import { debtOutlooks, liquid, monthLabel, monthlyNet, netWorthSeries, project, runwayMonths, type Snapshot } from './metrics'
import { trustUnfunded } from './estate'
import { formatCents } from './money'
import type { Account, CashFlow, EstateItem } from './types'
import { greetingPrefix, juno, moments } from '../copy/juno'

export type Brief = {
  text: string
  yod?: string
  good: boolean   // good news → the coin beams
}

type Candidate = { score: number; text: string; short: string; good: boolean }

const HORIZON = 60
const runwayText = (r: number | null) => (r === null ? '5+ years' : r === 1 ? '1 month' : `${r} months`)

export function buildBrief(name: string, accounts: Account[], flows: CashFlow[], now: Date = new Date(), snaps: Snapshot[] = [], shelfCents = 0, estate: EstateItem[] = []): Brief {
  if (accounts.length === 0 && flows.length === 0) {
    return { text: `${greetingPrefix(name, now.getHours())} ${juno.noAccounts}`, good: false }
  }

  const nowKey = now.getFullYear() * 12 + now.getMonth()
  const liq = liquid(accounts).cents
  const proj = project(flows, liq, nowKey + 1, HORIZON)
  const runway = runwayMonths(proj, shelfCents)
  const runwayLean = runwayMonths(project(flows, liq, nowKey + 1, HORIZON, true), shelfCents)
  const net = monthlyNet(flows, nowKey).cents

  const candidates: Candidate[] = []

  // cash running thin — the one thing that outranks everything.
  // Only meaningful when the household is actually burning (a no-flow or
  // no-balance picture projects flat at ≤0 and would false-alarm).
  if (net < 0 && runway !== null && runway < 6) {
    candidates.push({
      score: 96,
      text: moments.lowRunway(runwayText(runway), runwayText(runwayLean), shelfCents > 0 ? formatCents(shelfCents) : undefined),
      short: `${runwayText(runway)} of runway`,
      good: false,
    })
  }

  // income cliff inside 60 days (runway already accounts for the end date)
  const cliffs = flows
    .filter((f) => f.direction === 'income' && f.active && f.committed && f.end_date && (f.amount_cents ?? 0) > 0)
    // parse at local noon: bare YYYY-MM-DD is UTC midnight = the evening BEFORE in California,
    // which made "ends today" read as already past and vanish a day early
    .map((f) => ({ f, days: Math.floor((Date.parse(`${f.end_date}T12:00:00`) - now.getTime()) / 86_400_000) }))
    .filter((c) => c.days >= 0 && c.days <= 60)
    .sort((a, b) => a.days - b.days)
  if (cliffs[0]) {
    const covered = runway === null || runway >= 6
    const dateStr = new Date(Date.parse(cliffs[0].f.end_date as string)).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', timeZone: 'UTC',
    })
    // "Evening, Sam. Sam — severance ends…" reads twice — drop the greeted
    // user's own name prefix from the flow name in her sentence.
    const raw = cliffs[0].f.name.replace(new RegExp(`^${name}\\s*[—–-]+\\s*`, 'i'), '')
    const flowName = raw ? raw[0].toUpperCase() + raw.slice(1) : cliffs[0].f.name
    candidates.push({
      score: 90,
      text: moments.cliff(flowName, dateStr, runwayText(runway), covered),
      short: moments.cliffShort(flowName, dateStr),
      good: covered,
    })
  }

  // a debt clears within ~3 months
  const payoffs = debtOutlooks(accounts, flows, nowKey + 1)
    .filter((o) => !o.unlinked && !o.underwater && o.payoffKey !== null && o.payoffKey - nowKey <= 3)
    .sort((a, b) => (a.payoffKey as number) - (b.payoffKey as number))
  if (payoffs[0]) {
    candidates.push({
      score: 70,
      text: moments.payoff(payoffs[0].name, monthLabel(payoffs[0].payoffKey as number)),
      short: moments.payoffShort(payoffs[0].name, monthLabel(payoffs[0].payoffKey as number)),
      good: true,
    })
  }

  // the month's pace
  if (net > 0) {
    candidates.push({
      score: 45,
      text: moments.strongMonth(formatCents(net)),
      short: moments.strongMonthShort(formatCents(net)),
      good: true,
    })
  } else if (net < 0) {
    const earned = runway === null || runway >= 12
    candidates.push({
      score: 35,
      text: moments.softMonth(formatCents(-net), runwayText(runway), earned),
      short: moments.softMonthShort(formatCents(-net)),
      good: false,
    })
  }

  // net worth moved since the last recorded balance — the aside, honest both ways
  const series = snaps.length >= 2 ? netWorthSeries(accounts, snaps) : []
  if (series.length >= 2) {
    const delta = series[series.length - 1].cents - series[series.length - 2].cents
    const since = series[series.length - 2].date
    if (delta >= 500_000) {
      candidates.push({
        score: 50,
        text: moments.worthUp(formatCents(delta), since),
        short: moments.worthShort(delta, formatCents(Math.abs(delta))),
        good: true,
      })
    } else if (delta <= -500_000) {
      candidates.push({
        score: 40,
        text: moments.worthDown(formatCents(-delta), since),
        short: moments.worthShort(delta, formatCents(Math.abs(delta))),
        good: false,
      })
    }
  }

  // the trust exists but owns nothing — important, not urgent; it outranks only the gap nag
  if (trustUnfunded(estate, accounts)) {
    candidates.push({ score: 30, text: moments.trustUnfunded(), short: moments.trustUnfundedShort, good: false })
  }

  // unknowns
  const gapCount =
    accounts.filter((a) => a.balance_cents === null).length +
    flows.filter((f) => f.active && f.amount_cents === null).length
  if (gapCount > 0) {
    candidates.push({ score: 25, text: moments.gaps(gapCount), short: moments.gapsShort(gapCount), good: false })
  }

  candidates.sort((a, b) => b.score - a.score)
  const top = candidates[0]
  const second = candidates[1]

  if (!top) {
    return { text: `${greetingPrefix(name, now.getHours())} ${juno.emptyThread(name)}`, good: false }
  }

  // late night and nothing alarming → she sends you to bed; the news waits as a footnote
  const hour = now.getHours()
  if ((hour >= 23 || hour < 4) && top.good !== false) {
    return { text: moments.lateNight(name), yod: top.short, good: false }
  }

  return {
    text: `${greetingPrefix(name, hour)} ${top.text}`,
    yod: second?.short,
    good: top.good,
  }
}
