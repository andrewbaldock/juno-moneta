import { useId } from 'react'

// Motifs from design/juno-design-system/04-motifs.md — Roman objects, not fintech glyphs.
// Decorative: aria-hidden; the category NAME is the accessible label.

// THE logo: natural ragged edge, never cropped to a circle — anywhere in the UI.
// The circular master exists only for icon slots the platform forces (favicon, PWA).
export const COIN_SRC = '/juno/coin-natural-edge.png'
export const COIN_SM_SRC = '/juno/coin-natural-edge-96.png'

export function MarkOwn() {
  return (
    <svg viewBox="0 0 24 24" className="mo" aria-hidden="true">
      <path d="M3.5 9L12 4l8.5 5" /><path d="M6 9v9M18 9v9M10 9v9M14 9v9" /><path d="M4 19h16" />
    </svg>
  )
}

export function MarkSavings() {
  return (
    <svg viewBox="0 0 24 24" className="mo" aria-hidden="true">
      <ellipse cx="12" cy="7" rx="7" ry="2.6" />
      <path d="M5 7v4c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6V7" />
      <path d="M5 11v4c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6v-4" />
    </svg>
  )
}

export function MarkSpending() {
  return (
    <svg viewBox="0 0 24 24" className="mo" aria-hidden="true">
      <path d="M9 4h6" /><path d="M10 4c-1 3-4.5 3.5-4.5 8S8 20 12 20s6.5-3.5 6.5-8S16 7 15 4" /><path d="M8 20h8" />
    </svg>
  )
}

/* wheat sheaf — the harvest coming in */
export function MarkIncome() {
  return (
    <svg viewBox="0 0 24 24" className="mo" aria-hidden="true">
      <path d="M12 20V8" />
      <path d="M12 8C9.8 7.6 8.4 5.8 8.4 3.5 10.6 3.9 12 5.7 12 8Z" />
      <path d="M12 8c2.2-.4 3.6-2.2 3.6-4.5C13.4 3.9 12 5.7 12 8Z" />
      <path d="M12 13.5c-2.2-.4-3.6-2.2-3.6-4.5 2.2.4 3.6 2.2 3.6 4.5Z" />
      <path d="M12 13.5c2.2-.4 3.6-2.2 3.6-4.5-2.2.4-3.6 2.2-3.6 4.5Z" />
      <path d="M9.5 20h5" />
    </svg>
  )
}

export function MarkOwe() {
  return (
    <svg viewBox="0 0 24 24" className="mo" aria-hidden="true">
      <path d="M7 3h8a2 2 0 0 1 2 2v13" /><path d="M7 3a2 2 0 0 0-2 2v13a3 3 0 0 0 3 3h9" /><path d="M9 8h6M9 12h6" />
    </svg>
  )
}

export function Sun() {
  return (
    <svg viewBox="0 0 24 24" className="mo" aria-hidden="true">
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1" />
    </svg>
  )
}

export function Moon() {
  return (
    <svg viewBox="0 0 24 24" className="mo" aria-hidden="true">
      <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10Z" />
    </svg>
  )
}

export function Yod() {
  return (
    <svg viewBox="0 0 12 16" aria-hidden="true">
      <path d="M6 1C4 6 1.5 7.5 1.5 10.5A4.5 4.5 0 0 0 10.5 10.5C10.5 7.5 8 6 6 1Z" />
    </svg>
  )
}

/** The rays behind the coin — rendered always, visible only during the beam.
 *  Gold and mint interleaved, reaching far past the coin; the inner ends hide
 *  behind it, so they always read as bursting from her edge. */
export function Rays() {
  const n = 60
  const lines = Array.from({ length: n }, (_, i) => {
    const gold = i % 2 === 0
    return (
      <line key={i} x1="0" y1="-10" x2="0" y2={gold ? -96 : -78}
        transform={`rotate(${(i / n) * 360})`}
        stroke={gold ? 'var(--gold)' : 'var(--mint)'}
        strokeWidth={gold ? 1.1 : 0.9} strokeLinecap="round" opacity={gold ? 0.8 : 0.6} />
    )
  })
  return (
    <svg viewBox="-100 -100 200 200" width="100%" height="100%" style={{ overflow: 'visible' }} aria-hidden="true">
      {lines}
    </svg>
  )
}

/** Current hour 0–23. `juno.hour` in localStorage pins an hour (design preview);
 *  otherwise it follows the clock. JunoPresence re-renders on the hour so it advances. */
function clockHour() {
  const o = typeof localStorage !== 'undefined' ? localStorage.getItem('juno.hour') : null
  if (o !== null && o.trim() !== '' && Number.isFinite(+o)) return ((((+o) | 0) % 24) + 24) % 24
  return new Date().getHours()
}

/**
 * The temple garden — an engraved mint scene Juno's coin sits in.
 * Parametric in its own pixel size (measured by JunoPresence, coin + garden ≤160px):
 * a cypress flanks Juno on each side, then a colonnade steps outward with a CHANGING
 * understory — column · topiary · column · amphora · column … — cycling so no bay
 * looks stamped. Columns stretch a touch as the panel widens, and the sky carries a
 * gold sun and warm wash by day, a pale moon, stars and cool wash by night. Extra
 * WIDTH buys more garden, not a stretched drawing; the center stays quiet for the
 * wordmark and date. Static by design.
 */
export function TempleGarden({ w = 300, h = 150, coin = 80, hour = clockHour() }: { w?: number; h?: number; coin?: number; hour?: number }) {
  const moonId = useId().replace(/:/g, '') // unique mask id (two presences can mount at once)
  if (w < 40 || h < 40) return <svg aria-hidden="true" /> // hidden/collapsed: nothing to draw

  const ground = h - 13
  const capY = Math.max(40, Math.round(h * 0.42)) // column capital line
  const cx = w / 2
  const clearHalf = Math.max(58, Math.round(coin / 2) + 12) // clear Juno's coin, whatever her size
  const px = (f: number) => Math.round(w * f)
  const py = (f: number) => Math.round(h * f)

  // columns stretch a little taller + wider as the panel widens (0 narrow → 1 wide)
  const stretch = Math.max(0, Math.min(1, (w - 260) / 380))
  const cw = +(6 + stretch * 2.6).toFixed(1) // shaft half-width
  const cTop = Math.round(capY - stretch * 12) // taller columns when there's room

  // cypress flanks Juno; then column · topiary · column · amphora · column, cycling
  const rhythm = ['cypress', 'col', 'topiary', 'col', 'amphora', 'col'] as const
  const gap: Record<string, number> = { col: 42, cypress: 32, topiary: 40, amphora: 40 }
  const items: { x: number; kind: (typeof rhythm)[number]; key: string }[] = []
  for (const dir of [-1, 1] as const) {
    let x = cx + dir * (clearHalf + 6)
    let i = 0
    while (dir > 0 ? x < w - 18 : x > 18) {
      const kind = rhythm[i % rhythm.length]
      items.push({ x: Math.round(x), kind, key: `${dir}-${i}` })
      x += dir * gap[kind]
      i++
    }
  }

  const column = (x: number, key: string) => (
    <g key={key} opacity=".72">
      <path d={`M${x - cw} ${cTop + 6} V${ground} M${x + cw} ${cTop + 6} V${ground}`} />
      <path d={`M${x} ${cTop + 8} V${ground - 2}`} opacity=".45" />
      <path d={`M${x - cw - 4} ${cTop + 2} H${x + cw + 4} M${x - cw - 2} ${cTop - 3} H${x + cw + 2}`} />
      <path d={`M${x - cw - 4} ${cTop + 2} q-4 -4 1 -7 M${x + cw + 4} ${cTop + 2} q4 -4 -1 -7`} />
      <path d={`M${x - cw - 4} ${ground} H${x + cw + 4} M${x - cw - 7} ${ground + 5} H${x + cw + 7}`} />
    </g>
  )
  const cypress = (x: number, key: string) => {
    const top = Math.max(cTop - 2, ground - 62)
    return (
      <g key={key} opacity=".64">
        <path d={`M${x} ${ground - 3} C${x - 7} ${ground - 20} ${x - 6} ${top + 12} ${x} ${top} C${x + 6} ${top + 12} ${x + 7} ${ground - 20} ${x} ${ground - 3}`} />
        <path d={`M${x} ${ground - 9} V${top + 9}`} opacity=".4" />
        <path d={`M${x} ${ground - 3} v6`} />
        {/* grass tuft at the base */}
        <path d={`M${x - 5} ${ground + 1} q2 -5 3 -8 M${x + 5} ${ground + 1} q-2 -5 -3 -8`} opacity=".5" />
      </g>
    )
  }
  // a cloud-pruned topiary — two stacked balls on a short trunk
  const topiary = (x: number, key: string) => (
    <g key={key} opacity=".6">
      <path d={`M${x} ${ground - 2} V${ground - 13}`} />
      <circle cx={x} cy={ground - 20} r="9.5" />
      <circle cx={x} cy={ground - 33} r="6" />
      <path d={`M${x - 5} ${ground - 22} q5 4 11 0`} opacity=".4" />
    </g>
  )
  // a two-handled amphora on the ground
  const amphora = (x: number, key: string) => {
    const g0 = ground - 2
    return (
      <g key={key} opacity=".6">
        <path d={`M${x} ${g0 - 24} C${x - 7} ${g0 - 22} ${x - 8} ${g0 - 16} ${x - 7} ${g0 - 10} C${x - 6} ${g0 - 3} ${x + 6} ${g0 - 3} ${x + 7} ${g0 - 10} C${x + 8} ${g0 - 16} ${x + 7} ${g0 - 22} ${x} ${g0 - 24} Z`} />
        <path d={`M${x - 4} ${g0 - 24} H${x + 4}`} />
        <path d={`M${x - 3} ${g0 - 23} q-6 3 -4 8 M${x + 3} ${g0 - 23} q6 3 4 8`} />
        <path d={`M${x - 3} ${g0} H${x + 3}`} />
      </g>
    )
  }
  const draw = { col: column, cypress, topiary, amphora }

  // sun rays — eight short spokes around the disc
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2
    const c = Math.cos(a), s = Math.sin(a)
    return `M${(10 * c).toFixed(1)} ${(10 * s).toFixed(1)} L${(14 * c).toFixed(1)} ${(14 * s).toFixed(1)}`
  }).join(' ')
  const stars: [number, number][] = [[0.24, 0.15], [0.33, 0.3], [0.72, 0.14], [0.82, 0.3], [0.9, 0.19]]
  if (w > 420) stars.push([0.12, 0.34], [0.66, 0.36], [0.94, 0.11])
  // ambient sky life instead of a visible dial: gulls wheel by day, stars come out at night
  const birds: [number, number][] = [[0.2, 0.16], [0.28, 0.22], [0.78, 0.18]]
  if (w > 420) birds.push([0.86, 0.25])
  const bird = (x: number, y: number) => `M${x - 5} ${y} q2.5 -3 5 0 M${x} ${y} q2.5 -3 5 0`
  // sun-moon complication — the celestial rides a 12-step arc across the sky like a watch:
  // sunrise (6am, left horizon) → noon (apex) → sunset (6pm, right), then the moon 6pm→6am.
  const day = hour >= 6 && hour < 18
  const idx = day ? hour - 6 : (hour - 18 + 24) % 24 // 0..11 — the twelve hour positions
  const arcRx = Math.max(60, cx - 18)
  const arcRy = Math.min(50, Math.round(h * 0.34))
  const arcBaseY = Math.round(h * 0.46) // horizon the sun/moon rises from and sets into
  const at = (i: number) => {
    const a = Math.PI * (1 - i / 11)
    return [Math.round(cx + arcRx * Math.cos(a)), Math.round(arcBaseY - arcRy * Math.sin(a))] as const
  }
  const [bx, by] = at(idx)
  const mR = 14 // moon radius; the bite disc is masked out toward the upper-right
  const sun = '#dca43a'
  const moon = '#7f9fe0'

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5">
        {/* ground — full span, split around the clearing */}
        <path d={`M8 ${ground} H${cx - clearHalf} M${cx + clearHalf} ${ground} H${w - 8}`} opacity=".6" />
        <path d={`M28 ${ground + 6} H${cx - clearHalf - 6} M${cx + clearHalf + 6} ${ground + 6} H${w - 28}`} opacity=".3" />

        {items.map((it) => draw[it.kind](it.x, it.key))}

        {/* central reflecting basin — the reward for extra width; on the ground,
            below the date, so it never fights the wordmark */}
        {w > 330 && (
          <g opacity=".5">
            <ellipse cx={cx} cy={ground} rx="22" ry="5" />
            <path d={`M${cx - 22} ${ground} q22 10 44 0`} />
            <ellipse cx={cx} cy={ground + 6} rx="12" ry="2.6" />
          </g>
        )}

        {/* the dial is a SECRET — the sun/moon rides its hidden arc; the sky just shows
            life: gulls by day, stars at night (drawn with the moon below) */}
        {day && (
          <g opacity=".5" strokeWidth="1.1">
            {birds.map(([fx, fy], k) => <path key={`b${k}`} d={bird(px(fx), py(fy))} />)}
          </g>
        )}

        {/* the gold sun by day, the blue crescent moon by night, on the active hour mark */}
        {day ? (
          <g opacity=".92">
            <circle cx={bx} cy={by} r="8" fill={sun} stroke={sun} />
            <g transform={`translate(${bx} ${by})`} stroke={sun} strokeWidth="1.7"><path d={rays} /></g>
          </g>
        ) : (
          <g opacity=".92">
            <defs>
              <mask id={moonId}>
                <circle cx={bx} cy={by} r={mR} fill="#fff" />
                <circle cx={bx + 11} cy={by - 8} r={mR} fill="#000" />
              </mask>
            </defs>
            <circle cx={bx} cy={by} r={mR} fill={moon} stroke="none" mask={`url(#${moonId})`} />
            {stars.map(([fx, fy], k) => {
              const sx = px(fx), sy = py(fy), r = k % 2 ? 2.7 : 1.8
              return (
                <g key={`s${k}`} stroke={moon}>
                  <path d={`M${sx} ${sy - r} V${sy + r} M${sx - r} ${sy} H${sx + r}`} opacity={k % 2 ? '.95' : '.6'} />
                  {k % 2 === 0 && <circle cx={sx} cy={sy} r="1" fill={moon} stroke="none" />}
                </g>
              )
            })}
          </g>
        )}
      </g>
    </svg>
  )
}

/** Fire the beam on the presence coin — call when something good happens. */
export function beam() {
  window.dispatchEvent(new Event('juno:beam'))
}
