// COPY of the CashFlow type from src/lib/types.ts — keep in sync (the edge
// function bundle can't reach src/, so the shape lives here too).
export type CashFlow = {
  id: string
  household_id: string
  name: string
  direction: 'income' | 'expense'
  category: string
  amount_cents: number | null
  cadence: 'monthly' | 'biweekly' | 'weekly' | 'annual' | 'bimonthly' | 'every_4_months' | 'one_time'
  start_date: string | null
  end_date: string | null
  active: boolean
  essential: boolean
  tax_setaside_pct: number | null
  committed: boolean
  account_id: string | null
  due_day: number | null          // day of month it's due (month-based cadences)
  late_after_days: number | null  // grace period before it counts as late
  autopay: boolean
  notes: string | null
  updated_at: string
}
