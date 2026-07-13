export type Account = {
  id: string
  household_id: string
  name: string
  kind: 'asset' | 'liability'
  category: string
  balance_cents: number | null
  interest_rate: number | null
  last4: string | null
  titled_to: TitledTo
  details: Record<string, string>
  notes: string | null
  updated_at: string
}

export type TitledTo = 'unknown' | 'individual' | 'joint' | 'trust' | 'beneficiary'

export type EstateItem = {
  id: string
  household_id: string
  item_type: 'will' | 'trust' | 'financial_poa' | 'healthcare_directive' | 'guardianship' | 'other'
  person: string
  status: 'none' | 'drafted' | 'signed' | 'needs_update'
  signed_date: string | null
  location: string | null
  notes: string | null
  updated_at: string
}

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

export const ASSET_CATEGORIES = ['checking', 'savings', 'brokerage', 'retirement', 'home_value', 'vehicle', 'cash', 'other_asset']
export const LIABILITY_CATEGORIES = ['mortgage', 'heloc', 'student_loan', 'auto_loan', 'credit_card', 'other_debt']
export const INCOME_CATEGORIES = ['salary', 'contract', 'severance', 'unemployment', 'other_income']
export const EXPENSE_CATEGORIES = ['housing', 'property_tax', 'utilities', 'fuel', 'groceries', 'dining', 'insurance', 'phone', 'internet', 'subscription', 'medical', 'debt_payment', 'pets', 'transport', 'misc']

/**
 * The extra fields each account TYPE carries, shown in the edit dialog.
 * Values are display-grade strings stored in accounts.details (jsonb) — the
 * engine never computes on them; real money stays in the _cents columns.
 */
export type DetailField = { key: string; label: string; placeholder?: string }
export const ACCOUNT_DETAIL_FIELDS: Record<string, DetailField[]> = {
  checking: [
    { key: 'institution', label: 'Bank' },
    { key: 'joint_owner', label: 'Joint owner', placeholder: 'if shared' },
    { key: 'beneficiary', label: 'POD beneficiary', placeholder: 'payable on death' },
  ],
  savings: [
    { key: 'institution', label: 'Bank' },
    { key: 'joint_owner', label: 'Joint owner', placeholder: 'if shared' },
    { key: 'beneficiary', label: 'POD beneficiary', placeholder: 'payable on death' },
  ],
  brokerage: [
    { key: 'institution', label: 'Brokerage' },
    { key: 'beneficiary', label: 'TOD beneficiary', placeholder: 'transfer on death' },
  ],
  retirement: [
    { key: 'institution', label: 'Provider', placeholder: 'Fidelity, Vanguard…' },
    { key: 'plan_type', label: 'Plan type', placeholder: '401k, Roth IRA…' },
    { key: 'employer', label: 'Employer', placeholder: 'if a workplace plan' },
    { key: 'contribution_pct', label: 'Contributing (% of pay)' },
    { key: 'match_pct', label: 'Employer match (up to %)' },
    { key: 'beneficiary', label: 'Beneficiary' },
  ],
  home_value: [
    { key: 'address', label: 'Address' },
    { key: 'purchase_year', label: 'Purchase year' },
    { key: 'purchase_price', label: 'Purchase price ($)' },
  ],
  vehicle: [
    { key: 'make_model', label: 'Make & model' },
    { key: 'year', label: 'Year' },
  ],
  cash: [],
  other_asset: [],
  mortgage: [
    { key: 'lender', label: 'Lender' },
    { key: 'original_amount', label: 'Original amount ($)' },
    { key: 'term_years', label: 'Term (years)' },
    { key: 'matures', label: 'Paid off (year)' },
    { key: 'escrow', label: 'Escrow', placeholder: 'taxes/insurance in the payment?' },
  ],
  heloc: [
    { key: 'lender', label: 'Lender' },
    { key: 'credit_limit', label: 'Credit limit ($)' },
    { key: 'draw_ends', label: 'Draw period ends' },
  ],
  auto_loan: [
    { key: 'lender', label: 'Lender' },
    { key: 'original_amount', label: 'Original amount ($)' },
    { key: 'matures', label: 'Paid off (year)' },
  ],
  student_loan: [
    { key: 'servicer', label: 'Servicer' },
    { key: 'loan_type', label: 'Federal or private' },
  ],
  credit_card: [
    { key: 'issuer', label: 'Issuer' },
    { key: 'credit_limit', label: 'Credit limit ($)' },
    { key: 'promo_ends', label: 'Promo rate ends', placeholder: 'if on a 0% deal' },
  ],
  other_debt: [
    { key: 'lender', label: 'Lender' },
  ],
}

export const TITLED_TO_LABELS: Record<TitledTo, string> = {
  unknown: 'not recorded',
  individual: 'individual name',
  joint: 'joint',
  trust: 'in the trust',
  beneficiary: 'beneficiary set',
}

export const ESTATE_DOC_LABELS: Record<EstateItem['item_type'], string> = {
  will: 'Will',
  trust: 'Living trust',
  financial_poa: 'Financial power of attorney',
  healthcare_directive: 'Healthcare directive',
  guardianship: 'Guardianship nomination',
  other: 'Other',
}

export const ESTATE_STATUS_LABELS: Record<EstateItem['status'], string> = {
  none: 'not started',
  drafted: 'drafted',
  signed: 'signed',
  needs_update: 'needs update',
}

export const CADENCE_LABELS: Record<CashFlow['cadence'], string> = {
  monthly: 'Monthly',
  biweekly: 'Every 2 weeks',
  weekly: 'Weekly',
  annual: 'Yearly',
  bimonthly: 'Every 2 months',
  every_4_months: 'Every 4 months',
  one_time: 'One-time',
}
