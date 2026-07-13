import { describe, expect, test } from 'bun:test'
import { CALIFORNIA, CONTRA_COSTA, FEDERAL, LAW_REVIEWED } from './law'

// Every constant must be traceable: a source to re-verify against and when it took
// effect. This guard is what keeps a hand-added entry honest.
describe('law constants shape', () => {
  const groups = { FEDERAL, CALIFORNIA, CONTRA_COSTA }
  for (const [name, group] of Object.entries(groups)) {
    for (const [key, v] of Object.entries(group)) {
      test(`${name}.${key} carries effectiveDate + source`, () => {
        expect(v.effectiveDate.length).toBeGreaterThan(0)
        expect(v.source.length).toBeGreaterThan(0)
        expect('value' in v).toBe(true)
      })
    }
  }

  test('LAW_REVIEWED is a YYYY or YYYY-MM stamp', () => {
    expect(LAW_REVIEWED).toMatch(/^\d{4}(-\d{2})?$/)
  })
})

describe('anchor values', () => {
  test('FTB weighting is the uneven 30/40/0/30', () => {
    expect(CALIFORNIA.ftbEstimateWeightingPct.value).toEqual([30, 40, 0, 30])
  })

  test('federal estimated-tax has four due dates', () => {
    expect(FEDERAL.estimatedTaxDueDates.value.length).toBe(4)
  })

  test('trust transfer into a revocable trust is not a reassessment', () => {
    expect(CALIFORNIA.trustTransferNotReassessed.value).toBe(true)
  })
})
