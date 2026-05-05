import { describe, expect, it } from 'vitest'
import {
  mergeDocumentFields,
  missingRequiredDocumentFields,
  generateCoverPage,
  DOCUMENT_REGISTRY,
  type DocumentFields,
} from './document-types'

// ── mergeDocumentFields ───────────────────────────────────────────────────────

describe('mergeDocumentFields', () => {
  it('applies only the provided keys', () => {
    const result = mergeDocumentFields({}, { purpose: 'p1', governingLaw: 'CA' })
    expect(result.purpose).toBe('p1')
    expect(result.governingLaw).toBe('CA')
    expect(result.jurisdiction).toBeUndefined()
  })

  it('ignores null and undefined to avoid wiping fields', () => {
    const start: DocumentFields = { purpose: 'kept', jurisdiction: 'kept2' }
    // @ts-expect-error: simulating raw JSON from the API
    const result = mergeDocumentFields(start, { purpose: null, jurisdiction: undefined })
    expect(result.purpose).toBe('kept')
    expect(result.jurisdiction).toBe('kept2')
  })

  it('honors empty strings so optional fields can be cleared', () => {
    const start: DocumentFields = { modifications: 'some text' }
    const result = mergeDocumentFields(start, { modifications: '' })
    expect(result.modifications).toBe('')
  })

  it('overwrites existing scalar values when the AI provides a new one', () => {
    const start: DocumentFields = { governingLaw: 'California' }
    const result = mergeDocumentFields(start, { governingLaw: 'Delaware' })
    expect(result.governingLaw).toBe('Delaware')
  })

  it('returns a new object rather than mutating the input', () => {
    const start: DocumentFields = { purpose: '' }
    const result = mergeDocumentFields(start, { purpose: 'x' })
    expect(result).not.toBe(start)
    expect(start.purpose).toBe('')
  })

  it('shallow-merges party objects without wiping existing sub-fields', () => {
    const start: DocumentFields = {
      party1: { name: 'Alice', company: 'Acme' },
    }
    const result = mergeDocumentFields(start, {
      party1: { title: 'CEO', noticeAddress: 'alice@acme.com' },
    })
    expect(result.party1?.name).toBe('Alice')
    expect(result.party1?.company).toBe('Acme')
    expect(result.party1?.title).toBe('CEO')
    expect(result.party1?.noticeAddress).toBe('alice@acme.com')
  })

  it('does not overwrite party sub-field with null', () => {
    const start: DocumentFields = { party1: { name: 'Alice' } }
    // @ts-expect-error: simulating partial API response
    const result = mergeDocumentFields(start, { party1: { name: null, title: 'CEO' } })
    expect(result.party1?.name).toBe('Alice')
    expect(result.party1?.title).toBe('CEO')
  })

  it('creates party object from scratch when none exists', () => {
    const result = mergeDocumentFields({}, { party1: { name: 'Bob', company: 'Beta' } })
    expect(result.party1?.name).toBe('Bob')
    expect(result.party1?.company).toBe('Beta')
  })
})

// ── missingRequiredDocumentFields ─────────────────────────────────────────────

describe('missingRequiredDocumentFields', () => {
  it('reports all required fields for mutual-nda when data is empty', () => {
    const missing = missingRequiredDocumentFields({}, 'mutual-nda')
    const requiredKeys = DOCUMENT_REGISTRY['mutual-nda'].fields
      .filter((f) => f.required)
      .map((f) => f.key)
    expect(missing).toEqual(requiredKeys)
  })

  it('omits filled scalar fields', () => {
    const data: DocumentFields = { purpose: 'p', governingLaw: 'CA', jurisdiction: 'SF, CA' }
    const missing = missingRequiredDocumentFields(data, 'mutual-nda')
    expect(missing).not.toContain('purpose')
    expect(missing).not.toContain('governingLaw')
    expect(missing).not.toContain('jurisdiction')
  })

  it('treats modifications as not required for mutual-nda', () => {
    const config = DOCUMENT_REGISTRY['mutual-nda']
    const modField = config.fields.find((f) => f.key === 'modifications')
    expect(modField?.required).toBe(false)
  })

  it('considers party1 missing when party1 has no name or company', () => {
    const missing = missingRequiredDocumentFields({}, 'csa')
    expect(missing).toContain('party1')
  })

  it('considers party1 filled when it has a name', () => {
    const data: DocumentFields = { party1: { name: 'Alice' } }
    const missing = missingRequiredDocumentFields(data, 'mutual-nda')
    expect(missing).not.toContain('party1')
  })

  it('considers party1 filled when it has a company even without a name', () => {
    const data: DocumentFields = { party1: { company: 'Acme' } }
    const missing = missingRequiredDocumentFields(data, 'csa')
    expect(missing).not.toContain('party1')
  })

  it('reports csa-specific required fields', () => {
    const missing = missingRequiredDocumentFields({}, 'csa')
    expect(missing).toContain('subscriptionPeriod')
    expect(missing).toContain('fees')
    expect(missing).toContain('paymentTerms')
  })
})

// ── generateCoverPage ─────────────────────────────────────────────────────────

describe('generateCoverPage', () => {
  it('includes the document display name as a heading', () => {
    const output = generateCoverPage({}, 'mutual-nda')
    expect(output).toContain('# Mutual NDA')
  })

  it('includes the Common Paper URL', () => {
    const output = generateCoverPage({}, 'csa')
    expect(output).toContain('commonpaper.com')
  })

  it('emits a section for each filled field', () => {
    const data: DocumentFields = {
      purpose: 'Evaluating a partnership',
      governingLaw: 'California',
    }
    const output = generateCoverPage(data, 'mutual-nda')
    expect(output).toContain('### Purpose')
    expect(output).toContain('Evaluating a partnership')
    expect(output).toContain('### Governing Law')
    expect(output).toContain('California')
  })

  it('omits sections for empty fields', () => {
    const output = generateCoverPage({}, 'mutual-nda')
    expect(output).not.toContain('### Purpose')
    expect(output).not.toContain('### Governing Law')
  })

  it('uses the format function for mndaTermType', () => {
    const data: DocumentFields = { mndaTermType: 'expires', mndaTermYears: 3 }
    const output = generateCoverPage(data, 'mutual-nda')
    expect(output).toContain('Expires after 3 year(s)')
  })

  it('renders party signature table with filled values', () => {
    const data: DocumentFields = {
      party1: { name: 'Alice Smith', company: 'Acme Corp', title: 'CEO' },
      party2: { name: 'Bob Jones', company: 'Beta Inc' },
    }
    const output = generateCoverPage(data, 'mutual-nda')
    expect(output).toContain('Alice Smith')
    expect(output).toContain('Acme Corp')
    expect(output).toContain('Bob Jones')
  })

  it('renders an empty signature table when parties are absent', () => {
    const output = generateCoverPage({}, 'pilot')
    expect(output).toContain('| Print Name |')
  })

  it('includes CC BY footer', () => {
    const output = generateCoverPage({}, 'dpa')
    expect(output).toContain('CC BY 4.0')
  })
})
