import { expect, test } from 'bun:test'

// the tour card must never land off-screen (the "tour is offscreen" bug)
;(globalThis as any).window = { innerWidth: 1400, innerHeight: 900, addEventListener() {}, removeEventListener() {} }
const { place } = await import('./DemoTour')

const r = (x: number, y: number, w: number, h: number) =>
  ({ left: x, top: y, right: x + w, bottom: y + h, width: w, height: h }) as DOMRect

const onscreen = (c: any, h: number) => {
  expect(c.top).toBeGreaterThanOrEqual(0)
  expect(c.left).toBeGreaterThanOrEqual(0)
  expect(c.top + h).toBeLessThanOrEqual(900)
  expect(c.left + 320).toBeLessThanOrEqual(1400)
  expect(c.transform).toBeUndefined() // no translate that can push it back off
}

test('full-height column (the #c2 step) puts the card beside it, on-screen', () => {
  const c = place(r(220, 0, 320, 900), 200)
  onscreen(c, 200)
  expect(c.left).toBe(558) // right of the column
})

test('short target near the bottom flips above, still on-screen', () => {
  onscreen(place(r(240, 860, 300, 40), 200), 200)
})

test('no target centers the card', () => {
  const c = place(null, 200)
  expect(c).toEqual({ top: 350, left: 540 })
})

test('card taller than the viewport is clamped, not negative', () => {
  onscreen(place(r(220, 0, 320, 900), 900), 0)
})
