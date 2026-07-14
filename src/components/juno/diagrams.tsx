// Juno's system diagrams — bespoke inline SVG in the app's own tokens, so every
// one recolors itself in day and night mode. Shared by the Help page (the deep
// reference) and the demo Welcome (the front door), so the pictures never drift.
// Style matches the house idiom: rounded --sunken boxes, gold arrows, small
// --muted captions. NOT Mermaid — motifs here are hand-drawn.

const box = { fill: 'var(--sunken)', stroke: 'var(--line-strong)', rx: 10 }
const label = { fontSize: 12, fill: 'var(--ink)', fontFamily: 'var(--sans)' }
const small = { fontSize: 10, fill: 'var(--muted)', fontFamily: 'var(--sans)' }

/** A reusable arrowhead marker. Each diagram passes a unique id (ids are document-global). */
function Arrow({ id }: { id: string }) {
  return (
    <marker id={id} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
      <path d="M0,0 L8,4 L0,8" fill="none" stroke="var(--gold)" strokeWidth="1.5" />
    </marker>
  )
}

/** Ledger → engine → numbers, in three boxes. */
export function FlowDiagram() {
  const arrow = { stroke: 'var(--gold)', strokeWidth: 1.5, markerEnd: 'url(#arr)' }
  return (
    <svg viewBox="0 0 640 120" className="w-full max-w-xl my-3" role="img" aria-label="The ledger feeds the engine, the engine produces every number on screen">
      <defs><Arrow id="arr" /></defs>
      <rect x="8" y="24" width="170" height="72" {...box} />
      <text x="93" y="52" textAnchor="middle" {...label}>The ledger</text>
      <text x="93" y="70" textAnchor="middle" {...small}>accounts · cash flows · shelf</text>
      <text x="93" y="84" textAnchor="middle" {...small}>integer cents, null = unknown</text>
      <line x1="182" y1="60" x2="230" y2="60" {...arrow} />
      <rect x="234" y="24" width="170" height="72" {...box} />
      <text x="319" y="52" textAnchor="middle" {...label}>The engine</text>
      <text x="319" y="70" textAnchor="middle" {...small}>pure functions, month by month</text>
      <text x="319" y="84" textAnchor="middle" {...small}>src/lib/metrics.ts</text>
      <line x1="408" y1="60" x2="456" y2="60" {...arrow} />
      <rect x="460" y="24" width="172" height="72" {...box} />
      <text x="546" y="52" textAnchor="middle" {...label}>Every number shown</text>
      <text x="546" y="70" textAnchor="middle" {...small}>runway · payoffs · net worth</text>
      <text x="546" y="84" textAnchor="middle" {...small}>charts recompute locally</text>
    </svg>
  )
}

/** The advisor loop: snapshot out, structured reply back, app does the math.
 *  This is also the "grounded, not guessing" picture — the app recomputes all arithmetic. */
export function LoopDiagram() {
  return (
    <svg viewBox="0 0 640 150" className="w-full max-w-xl my-3" role="img" aria-label="The app sends Juno a snapshot; Juno returns structured advice; the app verifies and applies it">
      <defs><Arrow id="arr2" /></defs>
      <rect x="8" y="40" width="200" height="72" {...box} />
      <text x="108" y="66" textAnchor="middle" {...label}>The app</text>
      <text x="108" y="84" textAnchor="middle" {...small}>snapshot: names + dollars only,</text>
      <text x="108" y="98" textAnchor="middle" {...small}>today's real date, memory notes</text>
      <path d="M 212 62 C 290 30, 350 30, 426 62" fill="none" stroke="var(--gold)" strokeWidth="1.5" markerEnd="url(#arr2)" />
      <text x="320" y="34" textAnchor="middle" {...small}>question + snapshot</text>
      <rect x="430" y="40" width="202" height="72" {...box} />
      <text x="531" y="66" textAnchor="middle" {...label}>Juno (Claude Sonnet 5)</text>
      <text x="531" y="84" textAnchor="middle" {...small}>one edge function; the API key</text>
      <text x="531" y="98" textAnchor="middle" {...small}>never reaches the browser</text>
      <path d="M 426 96 C 350 128, 290 128, 212 96" fill="none" stroke="var(--gold)" strokeWidth="1.5" markerEnd="url(#arr2)" />
      <text x="320" y="140" textAnchor="middle" {...small}>reply + actions + scenario deltas + ledger edits — the app recomputes ALL math itself</text>
    </svg>
  )
}

/** You ⇄ Juno: the relationship that compounds. You ask or add a number; she reasons on
 *  the real picture; advice comes back and the ledger updates; the picture sharpens; repeat. */
export function GrowDiagram() {
  return (
    <svg viewBox="0 0 640 150" className="w-full max-w-xl my-3" role="img" aria-label="You ask or add a number; Juno reasons on the whole real picture and updates the ledger; the picture sharpens; and around again">
      <defs><Arrow id="arr3" /></defs>
      <rect x="8" y="40" width="200" height="72" {...box} />
      <text x="108" y="66" textAnchor="middle" {...label}>You</text>
      <text x="108" y="84" textAnchor="middle" {...small}>ask a question · run a what-if</text>
      <text x="108" y="98" textAnchor="middle" {...small}>add a number she was missing</text>
      <path d="M 212 62 C 290 30, 350 30, 426 62" fill="none" stroke="var(--gold)" strokeWidth="1.5" markerEnd="url(#arr3)" />
      <text x="320" y="34" textAnchor="middle" {...small}>you tell her a little more</text>
      <rect x="430" y="40" width="202" height="72" {...box} />
      <text x="531" y="66" textAnchor="middle" {...label}>Juno</text>
      <text x="531" y="84" textAnchor="middle" {...small}>reasons on the whole picture,</text>
      <text x="531" y="98" textAnchor="middle" {...small}>answers · keeps the ledger</text>
      <path d="M 426 96 C 350 128, 290 128, 212 96" fill="none" stroke="var(--gold)" strokeWidth="1.5" markerEnd="url(#arr3)" />
      <text x="320" y="140" textAnchor="middle" {...small}>the picture sharpens — and the next answer is sharper still</text>
    </svg>
  )
}

/** Grounded, not guessing: Juno replies in structure, but the arithmetic is done in code
 *  from two grounded inputs — your real ledger and the current, dated tax/legal constants —
 *  which converge into the compute step. Unknowns stay unknown, never guessed. */
export function GroundedDiagram() {
  return (
    <svg viewBox="0 0 640 160" className="w-full max-w-xl my-3" role="img" aria-label="Juno replies in structured form; your real numbers and current dated tax and legal figures converge, and the app computes every figure in code — unknowns stay unknown, never guessed">
      <defs><Arrow id="arr5" /></defs>
      <rect x="8" y="16" width="224" height="56" {...box} />
      <text x="120" y="38" textAnchor="middle" {...label}>Juno replies</text>
      <text x="120" y="53" textAnchor="middle" {...small}>structured actions &amp; scenarios —</text>
      <text x="120" y="65" textAnchor="middle" {...small}>never arithmetic</text>

      <rect x="8" y="88" width="224" height="56" {...box} />
      <text x="120" y="110" textAnchor="middle" {...label}>Your numbers + current figures</text>
      <text x="120" y="125" textAnchor="middle" {...small}>the ledger, to the cent ·</text>
      <text x="120" y="137" textAnchor="middle" {...small}>dated tax &amp; legal constants</text>

      <path d="M 232 44 C 316 44, 316 72, 400 72" fill="none" stroke="var(--gold)" strokeWidth="1.5" markerEnd="url(#arr5)" />
      <path d="M 232 116 C 316 116, 316 88, 400 88" fill="none" stroke="var(--gold)" strokeWidth="1.5" markerEnd="url(#arr5)" />

      <rect x="400" y="52" width="232" height="56" {...box} />
      <text x="516" y="74" textAnchor="middle" {...label}>The app computes, in code</text>
      <text x="516" y="90" textAnchor="middle" {...small}>every figure itself ·</text>
      <text x="516" y="102" textAnchor="middle" {...small}>unknown stays unknown, never $0</text>

      <text x="320" y="154" textAnchor="middle" {...small}>an answer grounded in your numbers — not guessed</text>
    </svg>
  )
}

/** The agentic loop: Juno reaches the app and its data only through MCP tools, each call
 *  RLS-scoped, dollars at the boundary, never the service_role key. */
export function AgentDiagram() {
  const dbl = { stroke: 'var(--gold)', strokeWidth: 1.5, markerEnd: 'url(#arr4)', markerStart: 'url(#arr4start)' }
  return (
    <svg viewBox="0 0 640 150" className="w-full max-w-xl my-3" role="img" aria-label="Juno acts on the app and its database only through MCP tools; every tool call runs under row-level security with dollars at the boundary, never the service-role key">
      <defs>
        <Arrow id="arr4" />
        <marker id="arr4start" markerWidth="8" markerHeight="8" refX="1" refY="4" orient="auto">
          <path d="M8,0 L0,4 L8,8" fill="none" stroke="var(--gold)" strokeWidth="1.5" />
        </marker>
      </defs>
      <rect x="8" y="42" width="176" height="66" {...box} />
      <text x="96" y="70" textAnchor="middle" {...label}>Juno</text>
      <text x="96" y="88" textAnchor="middle" {...small}>Claude Sonnet 5</text>
      <line x1="188" y1="75" x2="230" y2="75" {...dbl} />
      <text x="209" y="64" textAnchor="middle" {...small}>calls</text>
      <rect x="234" y="42" width="172" height="66" {...box} />
      <text x="320" y="70" textAnchor="middle" {...label}>MCP tools</text>
      <text x="320" y="88" textAnchor="middle" {...small}>read · add · update · project · remember</text>
      <line x1="410" y1="75" x2="452" y2="75" {...dbl} />
      <text x="431" y="64" textAnchor="middle" {...small}>under RLS</text>
      <rect x="456" y="42" width="176" height="66" {...box} />
      <text x="544" y="70" textAnchor="middle" {...label}>The app &amp; DB</text>
      <text x="544" y="88" textAnchor="middle" {...small}>your private Postgres</text>
      <text x="320" y="130" textAnchor="middle" {...small}>dollars at the boundary (*_usd) · a short-lived scoped session · never the service_role key</text>
    </svg>
  )
}
