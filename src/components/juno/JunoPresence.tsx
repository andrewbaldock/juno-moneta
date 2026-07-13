import { useEffect, useRef, useState } from 'react'
import { COIN_SRC, Rays, TempleGarden } from './motifs'

// She knows what day it is: `Sat Jul 11, 2026`, rolling over at midnight (04-motifs.md).
const DAYS = ['Sun', 'Mon', 'Tues', 'Weds', 'Thurs', 'Fri', 'Sat']
const MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const stamp = () => {
  const d = new Date()
  return `${DAYS[d.getDay()]} ${MONS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

/**
 * Her identity block: coin (rays only during the beam) → J·UNO → gold rules + live date.
 * Scales with its column via the CSS vars --cs/--pp/--bns set by the shell.
 * The beam fires on `juno:beam` window events (see motifs.beam()) or a coin click.
 */
export default function JunoPresence() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const gardenRef = useRef<HTMLDivElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const [date, setDate] = useState(stamp)
  const [, tick] = useState(0) // bumped on the hour so the sun/moon advances a position
  // the garden draws to its own pixel size — extra width buys more scene, not a stretch;
  // coin size feeds the clearing so nothing collides with Juno
  const [dim, setDim] = useState({ w: 300, h: 150, coin: 80 })

  function fire() {
    const el = wrapRef.current
    if (!el) return
    el.classList.remove('beam')
    void el.offsetWidth
    el.classList.add('beam')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => el.classList.remove('beam'), 1200)
  }

  useEffect(() => {
    window.addEventListener('juno:beam', fire)
    return () => { window.removeEventListener('juno:beam', fire); window.clearTimeout(timer.current) }
  }, [])

  // re-render on the hour so the sun/moon steps to its next position in the sky
  useEffect(() => {
    const now = new Date()
    const next = new Date(now)
    next.setHours(now.getHours() + 1, 0, 0, 0)
    let hourly: number | undefined
    const first = window.setTimeout(() => {
      tick((n) => n + 1)
      hourly = window.setInterval(() => tick((n) => n + 1), 3_600_000)
    }, next.getTime() - now.getTime())
    return () => { window.clearTimeout(first); window.clearInterval(hourly) }
  }, [])

  useEffect(() => {
    const g = gardenRef.current
    const c = wrapRef.current
    if (!g || typeof ResizeObserver === 'undefined') return
    const measure = () => {
      const gr = g.getBoundingClientRect()
      setDim({ w: Math.round(gr.width), h: Math.round(gr.height), coin: Math.round(c?.getBoundingClientRect().width ?? 80) })
    }
    const ro = new ResizeObserver(measure)
    ro.observe(g)
    if (c) ro.observe(c)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const now = new Date()
    const midnight = new Date(now)
    midnight.setHours(24, 0, 0, 0)
    let daily: number | undefined
    const first = window.setTimeout(() => {
      setDate(stamp())
      daily = window.setInterval(() => setDate(stamp()), 86_400_000)
    }, midnight.getTime() - now.getTime())
    return () => { window.clearTimeout(first); window.clearInterval(daily) }
  }, [])

  return (
    <div className="presence">
      <div className="garden" ref={gardenRef}><TempleGarden w={dim.w} h={dim.h} coin={dim.coin} /></div>
      <div ref={wrapRef} className="coinwrap" onClick={fire} title="Juno">
        <div className="rays"><Rays /></div>
        <div className="coin"><img src={COIN_SRC} alt="Juno" /></div>
        <div className="glint"><b /></div>
      </div>
      <div className="bn">J<span className="u">UNO</span></div>
      <div className="rules"><i /><b>{date}</b><i /></div>
    </div>
  )
}
