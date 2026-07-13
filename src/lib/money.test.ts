import { expect, test } from 'bun:test'
import { parseDollars, formatCents, centsToInput } from './money'

test('no float drift: three $9.99 items', () => {
  const sum = [9.99, 9.99, 9.99]
    .map((n) => parseDollars(String(n))!)
    .reduce((a, b) => a + b, 0)
  expect(sum).toBe(2997)
  expect(formatCents(sum)).toBe('$29.97')
})

test('parse edge cases', () => {
  expect(parseDollars('$1,234.56')).toBe(123456)
  expect(parseDollars('1234')).toBe(123400)
  expect(parseDollars('0.07')).toBe(7)
  expect(parseDollars('-42.50')).toBe(-4250)
  expect(parseDollars('')).toBeNull()
  expect(parseDollars('abc')).toBeNaN()
})

test('roundtrip', () => {
  expect(centsToInput(123456)).toBe('1234.56')
  expect(parseDollars(centsToInput(7)!)).toBe(7)
  expect(centsToInput(null)).toBe('')
  expect(formatCents(null)).toBe('—')
})
