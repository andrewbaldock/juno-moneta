// Juno's character bible (design/juno-design-system/00-persona-voice.md).
// Every user-facing string she "says" lives here, parameterized by the current user.
// She speaks to ONE person — never "you two". Money in her speech renders via <span className="n">.

// Household-specific data (names, advisor tuning) lives in the DB (households.settings),
// never in code — so the public repo carries no real people. See supabase migration 0009.
export type HouseholdSettings = {
  /** email → display name for this household's members */
  people?: Record<string, string>
  /** household-specific advisor prompt tuning, appended to the generic base prompt */
  advisor_overlay?: string
  calendar?: { embed_url?: string; ics_url?: string }
}

/** The household's people — the estate checklist seeds one document set per person. */
export function peopleList(people: Record<string, string> | undefined): string[] {
  return [...new Set(Object.values(people ?? {}))]
}

export function firstName(email: string | undefined | null, people?: Record<string, string>): string {
  if (!email) return 'friend'
  const known = people?.[email.toLowerCase()]
  if (known) return known
  const raw = email.split('@')[0].replace(/[^a-zA-Z]+.*$/, '')
  return raw ? raw[0].toUpperCase() + raw.slice(1) : 'friend'
}

const PURSE_TITLES = [
  "JUNO'S LEDGER",
  "THE GODDESS' HAUL",
  "MONETA'S TALLY",
  "THE HOUSEHOLD ARCA",
  "THE SACRED MINT",
  "THE HEARTH TREASURY",
  "THE DOMUS RECKONING",
  "THE COIN OF THE HOUSE",
  "THE TABULAE",
  "THE STRONGBOX OF THE ATRIUM",
  "THE HOUSEHOLD DINERO",
  "THE TEMPLE OF THE PURSE",
  "THE MONEY TEMPLE",
  "THE HOUSE MINT",
  "JUNO'S COUNTINGHOUSE",
  "THE CONSUL'S BOOKS",
  "SILVER AND GOLD",
  "FORTUNA DOMUS",
  "VIA MONETA",
  "THE COMMON PURSE",
  "THE DOMESTIC EXCHEQUER",
  "THE HOUSEHOLD BOOKS",
  "THE KITCHEN LEDGER",
  "THE HOUSE ACCOUNT",
  "THE FAMILY PURSE",
  "THE HEARTH FUND",
  "THE HOME COFFERS",
  "THE HOUSEHOLD RECKONING",
  "THE COMMON POT",
  "THE SHARED PURSE",
  "THE DOMESTIC TILL",
  "THE TWO-PERSON TREASURY",
  "THE HOUSEHOLD CHEST",
  "THE KEEPING BOOK",
  "THE RUNNING TALLY",
  "THE HOUSE LEDGER",
  "THE DAILY RECKONING",
  "THE FAMILY TILL",
  "THE STANDING ACCOUNT",
  "THE STEWARDSHIP",
  "THE GETAWAY STASH",
  "THE BIG SCORE",
  "MONEY IN THE MATTRESS",
  "THE ROYAL STASH",
  "THE SLUSH FUND",
  "THE COLD CASH DRAWER",
  "THE VAULT",
  "THE TAKE",
  "THE HAUL",
  "THE SWAG BAG",
  "DIAMONDS ARE FOREVER",
  "THE LOOT LEDGER",
  "THE FIRST NATIONAL OF US",
  "THE UNDERGROUND VAULT",
  "THE SAFEHOUSE",
  "THE BAG",
  "THE SCORE SHEET",
  "THE DOUBLE-CROSS FUND",
  "THE LAST JOB",
  "HOT HOT MONEY",
  "THE PAYOFF",
  "THE SPLIT",
  "THE CUT",
  "THE CARRY",
  "THE BIG BUCKS",
  "THE LONG GREEN",
  "THE FOLDING MONEY",
  "THE RAINY DAY VAULT",
  "THE NEST EGG",
  "THE WAR CHEST",
  "THE GRAVY BOAT",
  "THE HONEY POT",
  "THE PIGGY BANK IMPERIAL",
  "COFFEE CASH",
  "THE SERIOUS COIN",
  "THE COOKIE JAR",
  "THE COFFEE CAN",
  "THE SOCK DRAWER",
  "THE MAD MONEY",
  "THE FUN TICKET",
  "THE BOTTOM LINE",
  "THE HOUSE ALWAYS WINS",
  "THE KITTY",
  "THE STASH",
  "THE BANKROLL",
  "THE PURSE STRINGS",
  "THE RESERVE",
  "THE FLOAT",
  "THE BALANCE OF THE HOUSE",
]

export const juno = {
  signIn: 'Sign in',
  signingIn: 'Signing in…',

  emptyThread: (name: string) =>
    `What shall we look at, ${name}? Ask anything about the household picture, or run a what-if — I answer from the real numbers.`,
  noAccounts: 'Introduce me to an account and I’ll take it from there. That’s rather the point of me.',

  stillUnknown: (gaps: string[]) =>
    `Still unknown — my answers get sharper as these fill in: ${gaps.join(', ')}.`,

  thinking: 'Juno is thinking…',
  noAnswer: 'I lost my thread of thought just now — my hiccup, not yours. Ask me again.',
  cantReach: (detail: string) => `I couldn’t reach the ledger just now — not your doing. (${detail})`,

  newConversation: 'New conversation',
  pastConversations: 'Past conversations',
  composerPlaceholder: 'Ask Juno, or run a what-if…',
  send: 'Send',

  provisional: (gaps: string[]) =>
    `Not entered yet, so left out of the totals rather than counted as $0: ${gaps.join(', ')}. Juno’s numbers sharpen as these fill in.`,

  /** The dashboard's masthead — a different name for the purse every day. */
  get whereYouStand() {
    const d = new Date()
    return PURSE_TITLES[(d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate()) % PURSE_TITLES.length]
  },
  keptEachMonth: 'Kept each month, at current pace',
}

/** The proactive-open moments — she has already looked (05-system-notes.md §1).
 *  Truth first; the reassuring clause only appears when the numbers earn it. */
export const moments = {
  cliff: (flowName: string, dateStr: string, runwayText: string, covered: boolean) =>
    covered
      ? `${flowName} ends ${dateStr}. Even after it stops, you’ve ${runwayText} of runway.`
      : `${flowName} ends ${dateStr} — that’s the date to plan around. ${runwayText} of runway as things stand; ask me about levers.`,
  cliffShort: (flowName: string, dateStr: string) => `${flowName} ends ${dateStr}`,

  lowRunway: (runwayText: string, leanText: string, shelf?: string) =>
    shelf
      ? `About ${runwayText} at the current pace before dipping into the ${shelf} you’ve shelved — ${leanText} if you go lean. That’s the number to move first; ask me for levers.`
      : `Cash runs about ${runwayText} at the current pace — ${leanText} if you go lean. That’s the number to move first; ask me for levers.`,

  payoff: (debtName: string, month: string) =>
    `${debtName} clears in ${month}. A day worth circling.`,
  payoffShort: (debtName: string, month: string) => `${debtName} clears ${month}`,

  strongMonth: (kept: string) =>
    `You’re keeping ${kept} a month at the current pace. Quietly solid.`,
  strongMonthShort: (kept: string) => `keeping ${kept}/mo`,

  softMonth: (over: string, runwayText: string, earned: boolean) =>
    earned
      ? `The month runs about ${over} out at the current pace, with ${runwayText} of runway behind it.`
      : `The month runs about ${over} out at the current pace, against ${runwayText} of runway. Ask me where the give is.`,
  softMonthShort: (over: string) => `${over}/mo out at current pace`,

  gaps: (n: number) =>
    n === 1
      ? 'One number is still unknown — my answers sharpen the moment it fills in.'
      : `${n} numbers are still unknown — my answers sharpen as they fill in.`,
  gapsShort: (n: number) => (n === 1 ? '1 number still unknown' : `${n} numbers still unknown`),

  lateNight: (name: string) =>
    `It’s late, and the money’s fine — it’ll still be fine in the morning. Go to bed, ${name}.`,

  worthUp: (amount: string, since: string) =>
    `Up ${amount} since ${since}. I’d say we make a good team.`,
  worthDown: (amount: string, since: string) =>
    `Net worth is down ${amount} since ${since}. Worth a look if that surprises you.`,
  worthShort: (delta: number, amount: string) => `${delta < 0 ? '▼' : '▲'} ${amount} net worth`,

  trustUnfunded: () =>
    `The trust exists, but nothing is titled into it yet — as things stand, everything still passes through probate. The list of what to move is on the Estate tab.`,
  trustUnfundedShort: 'the trust owns nothing yet',
}

export function greetingPrefix(name: string, hour: number): string {
  const part = hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening'
  return `${part}, ${name}.`
}
