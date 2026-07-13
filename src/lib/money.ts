// Money is integer cents everywhere. Floats only ever appear for display formatting.

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export function formatCents(cents: number | null): string {
  if (cents === null) return '—'
  return usd.format(cents / 100)
}

/** "1,234.56" | "$1234" | "" → integer cents, null for blank, NaN for garbage. */
export function parseDollars(input: string): number | null {
  const t = input.replace(/[$,\s]/g, '')
  if (t === '') return null
  if (!/^-?\d+(\.\d{1,2})?$/.test(t)) return NaN
  const neg = t.startsWith('-')
  const [whole, frac = ''] = (neg ? t.slice(1) : t).split('.')
  const cents = parseInt(whole, 10) * 100 + parseInt(frac.padEnd(2, '0') || '0', 10)
  return neg ? -cents : cents
}

/** Cents → editable input value ("1234.56"), '' for null. */
export function centsToInput(cents: number | null): string {
  if (cents === null) return ''
  const neg = cents < 0
  const abs = Math.abs(cents)
  return `${neg ? '-' : ''}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
}
