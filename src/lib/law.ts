// The single source of truth for the legal/tax numbers Juno's copy and heuristics
// lean on — federal, California, and Contra Costa county. Nothing here is polled or
// scraped: every figure changes at most once a year on a stable government page.
// Each value carries where it came from and when it took effect, so it can be
// re-verified by hand. The engine does not compute on these yet — features §2/§3/
// §4/§9 wire in as they're built (see ROADMAP.md §law).
//
// UPDATING: these go stale silently. When you re-verify (each January, or when the
// annual-review task nags), update the value + effectiveDate and bump LAW_REVIEWED.
// That stamp is what silences the task in src/lib/tasks.ts (annualReviewTask).

export type LawValue<T> = {
  value: T
  effectiveDate: string // 'YYYY' or 'YYYY-MM' the figure took effect
  source: string        // stable gov page or citation to re-verify against
}

/** Year/month these constants were last hand-verified. Bump it after a review. */
export const LAW_REVIEWED = '2026-01'

// ─── Federal ────────────────────────────────────────────────────────────────

export const FEDERAL = {
  /** Estimated-tax due dates (MM-DD). Q3 is Jan of the following year. */
  estimatedTaxDueDates: {
    value: ['04-15', '06-15', '09-15', '01-15'],
    effectiveDate: '2026',
    source: 'IRS Pub 505',
  } as LawValue<string[]>,

  /** Underpayment safe harbor: pay this % of prior-year tax to avoid penalty. */
  safeHarborPct: {
    value: { base: 100, overAgi150k: 110 },
    effectiveDate: '2026',
    source: 'IRS Pub 505',
  } as LawValue<{ base: number; overAgi150k: number }>,

  /** 401(k) employee elective-deferral limit (excludes employer match). */
  contribution401kCents: {
    value: null, // TODO 2026 figure — 2025 was $23,500 (+ $7,500 catch-up 50+)
    effectiveDate: '2026',
    source: 'IRS COLA notice (each Nov)',
  } as LawValue<number | null>,

  /** IRA contribution limit. */
  contributionIraCents: {
    value: null, // TODO 2026 figure — 2025 was $7,000 (+ $1,000 catch-up 50+)
    effectiveDate: '2026',
    source: 'IRS',
  } as LawValue<number | null>,

  /** HSA contribution limits + the HDHP definition that makes a plan HSA-eligible. */
  hsa: {
    value: null, // TODO 2026 figures (self / family limits; HDHP min deductible + OOP max)
    effectiveDate: '2026',
    source: 'IRS Rev. Proc. (each May)',
  } as LawValue<null>,

  /** Health FSA contribution limit. */
  contributionFsaCents: {
    value: null, // TODO 2026 figure
    effectiveDate: '2026',
    source: 'IRS',
  } as LawValue<number | null>,

  /** Estate-tax exemption per person — note-only; far above this household's exposure. */
  estateTaxExemptionCents: {
    value: 1_500_000_000_00, // ~$15M/person (2026, OBBBA)
    effectiveDate: '2026',
    source: 'IRS (OBBBA)',
  } as LawValue<number>,
} as const

// ─── California ──────────────────────────────────────────────────────────────

export const CALIFORNIA = {
  /** FTB estimated-payment weighting (NOT even quarters). Q3 is 0%. */
  ftbEstimateWeightingPct: {
    value: [30, 40, 0, 30],
    effectiveDate: '2026',
    source: 'ftb.ca.gov (estimated payments page)',
  } as LawValue<number[]>,

  /** FTB underpayment safe harbor — mirrors federal. */
  ftbSafeHarborPct: {
    value: { base: 100, overAgi150k: 110 },
    effectiveDate: '2026',
    source: 'FTB',
  } as LawValue<{ base: number; overAgi150k: number }>,

  /** Prop 13: base 1% rate (+ local voter-approved rates), assessed value capped at +2%/yr. */
  prop13: {
    value: { baseRatePct: 1, assessedGrowthCapPct: 2 },
    effectiveDate: '1978',
    source: 'county assessor / BOE',
  } as LawValue<{ baseRatePct: number; assessedGrowthCapPct: number }>,

  /** Property-tax delinquency dates (MM-DD): 1st installment / 2nd installment. */
  propertyTaxDelinquencyDates: {
    value: ['12-10', '04-10'],
    effectiveDate: '2026',
    source: 'county tax collector',
  } as LawValue<string[]>,

  /**
   * Transferring a home into a revocable trust is NOT a change of ownership → NO
   * reassessment. This defuses the fear that blocks trust funding — say it out loud
   * in the estate task copy. Record the trust-transfer deed + PCOR (BOE-502-A).
   */
  trustTransferNotReassessed: {
    value: true,
    effectiveDate: '1978',
    source: 'R&T Code §62(d); BOE + county recorder',
  } as LawValue<boolean>,

  /** Probate small-estate threshold — under this can skip formal probate. Adjusts every 3 yrs. */
  probateSmallEstateCents: {
    value: 208_850_00,
    effectiveDate: '2025-04', // next adjustment 2028
    source: 'CA Prob. Code §13100 (CA courts self-help)',
  } as LawValue<number>,

  /** Statutory advance healthcare directive form is free (§4701). */
  healthcareDirectiveForm: {
    value: 'Prob. Code §4701',
    effectiveDate: '2026',
    source: 'CA legislature / courts',
  } as LawValue<string>,

  /**
   * State Disability Insurance: W-2 covered, no wage cap since 2024, 70–90% benefit
   * (SB 951). Rate changes annually (~1.2–1.3%). 1099 income is NOT covered
   * (elective coverage exists) — this is the disability-gap nuance for 1099 income.
   */
  sdi: {
    value: { w2Covered: true, ratePct: 1.2, benefitPctLow: 70, benefitPctHigh: 90, ten99Covered: false },
    effectiveDate: '2026',
    source: 'EDD (edd.ca.gov) — SB 951',
  } as LawValue<{ w2Covered: boolean; ratePct: number; benefitPctLow: number; benefitPctHigh: number; ten99Covered: boolean }>,

  /** Minimum auto liability limits (bodily-injury-per-person / per-accident / property, $k). */
  autoLiabilityMinimums: {
    value: { perPerson: 30, perAccident: 60, property: 15 },
    effectiveDate: '2025-01', // SB 1107; rises again 2035
    source: 'CA DOI',
  } as LawValue<{ perPerson: number; perAccident: number; property: number }>,

  /** Prop 19 parent-child transfer reassessment rules — note-only, matters for inheritance later. */
  prop19: {
    value: 'parent-child transfers may trigger reassessment except a continuing primary residence (capped)',
    effectiveDate: '2021-02',
    source: 'BOE',
  } as LawValue<string>,
} as const

// ─── Contra Costa county (744 Pomona Ave, El Cerrito) ────────────────────────

export const CONTRA_COSTA = {
  assessor: {
    value: 'ParcelQuest lookup, PCOR questions — (925) 313-7400',
    effectiveDate: '2026',
    source: 'contracosta.ca.gov/191/Assessor',
  } as LawValue<string>,

  /** The source of truth for their real property_tax flow amount — pull the actual bill. */
  taxCollectorLookup: {
    value: 'actual bill by address',
    effectiveDate: '2026',
    source: 'taxcolp.cccttc.us/lookup',
  } as LawValue<string>,

  clerkRecorder: {
    value: 'record the trust-transfer deed (Change of Title & Transfer of Property)',
    effectiveDate: '2026',
    source: 'contracostavote.gov/recorder',
  } as LawValue<string>,

  /** Must accompany the deed; extra fee without it. */
  pcorForm: {
    value: 'Preliminary Change of Ownership Report (BOE-502-A)',
    effectiveDate: '2026',
    source: 'contracostavote.gov/recorder/recorder-forms/preliminary-change-of-ownership-report',
  } as LawValue<string>,

  /**
   * El Cerrito nuance: the parcel's Tax Rate Area carries voter-approved extras
   * (WCCUSD bonds, city parcel taxes) — effective rates run ~1.2–1.5% of assessed
   * value, well above the bare 1%. Don't estimate: pull the real bill once. Prop 13
   * caps assessed-value growth at 2%/yr, but flat parcel taxes move by ballot measure.
   */
  elCerritoTaxRateNote: {
    value: 'effective rate ~1.2–1.5% (TRA extras); pull the real bill, do not estimate',
    effectiveDate: '2026',
    source: 'taxcolp.cccttc.us/lookup',
  } as LawValue<string>,
} as const
