import { describe, expect, it } from 'vitest'
import { mergeFieldUpdates, missingRequiredFields, REQUIRED_FIELDS } from './nda-chat-helpers'
import type { NDAData } from './nda-document'

const baseData = (): NDAData => ({
  purpose: '',
  effectiveDate: '',
  mndaTerm: 'expires',
  mndaTermYears: '1',
  termOfConfidentiality: 'years',
  termOfConfidentialityYears: '1',
  governingLaw: '',
  jurisdiction: '',
  modifications: '',
  party1Name: '',
  party1Title: '',
  party1Company: '',
  party1Address: '',
  party2Name: '',
  party2Title: '',
  party2Company: '',
  party2Address: '',
})

describe('mergeFieldUpdates', () => {
  it('applies only the provided keys', () => {
    const result = mergeFieldUpdates(baseData(), { purpose: 'p1', governingLaw: 'CA' })
    expect(result.purpose).toBe('p1')
    expect(result.governingLaw).toBe('CA')
    expect(result.party1Name).toBe('')
  })

  it('ignores null and undefined to avoid wiping fields', () => {
    const start = { ...baseData(), purpose: 'kept', jurisdiction: 'kept2' }
    // @ts-expect-error: simulating raw JSON from the API
    const result = mergeFieldUpdates(start, { purpose: null, jurisdiction: undefined })
    expect(result.purpose).toBe('kept')
    expect(result.jurisdiction).toBe('kept2')
  })

  it('honors empty strings so optional fields can be cleared', () => {
    const start = { ...baseData(), modifications: 'some text' }
    const result = mergeFieldUpdates(start, { modifications: '' })
    expect(result.modifications).toBe('')
  })

  it('overwrites existing values when the AI provides a new one', () => {
    const start = { ...baseData(), governingLaw: 'CA' }
    const result = mergeFieldUpdates(start, { governingLaw: 'Delaware' })
    expect(result.governingLaw).toBe('Delaware')
  })

  it('returns a new object rather than mutating the input', () => {
    const start = baseData()
    const result = mergeFieldUpdates(start, { purpose: 'x' })
    expect(result).not.toBe(start)
    expect(start.purpose).toBe('')
  })
})

describe('missingRequiredFields', () => {
  it('reports every required field when none have values', () => {
    // baseData() defaults the two enum fields to truthy strings; clear them so
    // we can assert the helper considers truly empty data fully unfilled.
    const blank = { ...baseData(), mndaTerm: '' as NDAData['mndaTerm'], termOfConfidentiality: '' as NDAData['termOfConfidentiality'] }
    expect(missingRequiredFields(blank)).toEqual(REQUIRED_FIELDS)
  })

  it('treats default enum values as filled', () => {
    expect(missingRequiredFields(baseData())).not.toContain('mndaTerm')
    expect(missingRequiredFields(baseData())).not.toContain('termOfConfidentiality')
  })

  it('omits filled fields', () => {
    const start = { ...baseData(), purpose: 'p', governingLaw: 'CA', jurisdiction: 'SF, CA' }
    const missing = missingRequiredFields(start)
    expect(missing).not.toContain('purpose')
    expect(missing).not.toContain('governingLaw')
    expect(missing).not.toContain('jurisdiction')
    expect(missing).toContain('party1Name')
  })

  it('does not require modifications', () => {
    expect(REQUIRED_FIELDS).not.toContain('modifications')
  })
})
