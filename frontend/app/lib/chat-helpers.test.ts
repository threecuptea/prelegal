import { describe, expect, it } from 'vitest'
import {
  mergeDocumentFields,
  missingRequiredDocumentFields,
  generateCoverPage,
  generateDocument,
  generateDocumentTitle,
  processTemplateContent,
  isEffectiveDateInPast,
  DOCUMENT_REGISTRY,
  type DocumentFields,
} from './document-types'

// ── generateDocumentTitle ─────────────────────────────────────────────────────

describe('generateDocumentTitle', () => {
  it('uses both party companies when available', () => {
    const data: DocumentFields = { party1: { company: 'Acme Corp' }, party2: { company: 'Beta Inc' } }
    expect(generateDocumentTitle(data, 'mutual-nda')).toBe('Mutual NDA — Acme Corp & Beta Inc')
  })

  it('uses only the available company when one party has no company', () => {
    const data: DocumentFields = { party1: { company: 'Acme Corp' } }
    expect(generateDocumentTitle(data, 'mutual-nda')).toBe('Mutual NDA — Acme Corp')
  })

  it('falls back to party names when no companies are present', () => {
    const data: DocumentFields = { party1: { name: 'Alice Smith' }, party2: { name: 'Bob Jones' } }
    expect(generateDocumentTitle(data, 'mutual-nda')).toBe('Mutual NDA — Alice Smith & Bob Jones')
  })

  it('uses a single name when only one party name is present', () => {
    const data: DocumentFields = { party1: { name: 'Alice Smith' } }
    expect(generateDocumentTitle(data, 'csa')).toBe('Cloud Service Agreement — Alice Smith')
  })

  it('prefers company over name when both are present', () => {
    const data: DocumentFields = { party1: { name: 'Alice', company: 'Acme Corp' }, party2: { name: 'Bob', company: 'Beta Inc' } }
    expect(generateDocumentTitle(data, 'mutual-nda')).toBe('Mutual NDA — Acme Corp & Beta Inc')
  })

  it('falls back to purpose when no party info is present', () => {
    const data: DocumentFields = { purpose: 'Evaluating a cloud partnership' }
    expect(generateDocumentTitle(data, 'mutual-nda')).toBe('Mutual NDA — Evaluating a cloud partnership')
  })

  it('truncates purpose at 40 characters with ellipsis', () => {
    const data: DocumentFields = { purpose: 'This is a very long purpose that exceeds the forty character limit' }
    const result = generateDocumentTitle(data, 'mutual-nda')
    expect(result).toContain('…')
    const purposePart = result.replace('Mutual NDA — ', '')
    expect(purposePart.length).toBeLessThanOrEqual(41) // 40 chars + ellipsis
  })

  it('does not truncate purpose that is exactly 40 characters', () => {
    const data: DocumentFields = { purpose: '1234567890123456789012345678901234567890' }
    const result = generateDocumentTitle(data, 'mutual-nda')
    expect(result).not.toContain('…')
  })

  it('falls back to displayName Draft when no fields are present', () => {
    expect(generateDocumentTitle({}, 'mutual-nda')).toBe('Mutual NDA Draft')
    expect(generateDocumentTitle({}, 'csa')).toBe('Cloud Service Agreement Draft')
  })
})

// ── isEffectiveDateInPast ────────────────────────────────────────────────────

describe('isEffectiveDateInPast', () => {
  it('returns true for a date clearly in the past', () => {
    expect(isEffectiveDateInPast('2020-01-01')).toBe(true)
  })

  it('returns false for a date clearly in the future', () => {
    expect(isEffectiveDateInPast('2099-12-31')).toBe(false)
  })

  it('returns false for today', () => {
    const today = new Date().toISOString().split('T')[0]
    expect(isEffectiveDateInPast(today)).toBe(false)
  })
})

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

// ── processTemplateContent ────────────────────────────────────────────────────

describe('processTemplateContent', () => {
  it('strips coverpage_link span tags, keeping inner text', () => {
    const input = 'See the <span class="coverpage_link">Purpose</span> field.'
    expect(processTemplateContent(input)).toBe('See the Purpose field.')
  })

  it('strips header span tags', () => {
    const input = '<span class="header_2" id="1">Definitions</span>\n\nSome text.'
    expect(processTemplateContent(input)).toBe('Definitions\n\nSome text.')
  })

  it('removes a leading top-level # heading', () => {
    const input = '# Standard Terms\n\nSection 1. Intro.'
    expect(processTemplateContent(input)).toBe('Section 1. Intro.')
  })

  it('does not remove sub-level headings', () => {
    const input = '## Sub Section\n\nContent.'
    expect(processTemplateContent(input)).toContain('## Sub Section')
  })

  it('trims leading and trailing whitespace', () => {
    const input = '\n\n# Title\n\nContent.\n\n'
    expect(processTemplateContent(input)).toBe('Content.')
  })
})

// ── generateDocument ──────────────────────────────────────────────────────────

const SAMPLE_TEMPLATE = '# Standard Terms\n\n1. **Introduction**. This is the agreement.\n\nCommon Paper Version free to use under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).'

describe('generateDocument', () => {
  it('includes the document title', () => {
    const output = generateDocument({}, 'mutual-nda', SAMPLE_TEMPLATE)
    expect(output).toContain('# Mutual NDA')
  })

  it('includes a Cover Page section', () => {
    const output = generateDocument({}, 'mutual-nda', SAMPLE_TEMPLATE)
    expect(output).toContain('## Cover Page')
  })

  it('includes a Standard Terms section with processed template content', () => {
    const output = generateDocument({}, 'mutual-nda', SAMPLE_TEMPLATE)
    expect(output).toContain('## Standard Terms')
    expect(output).toContain('1. **Introduction**')
    // The template's own top-level heading should be stripped (only our ## heading remains)
    expect(output).not.toMatch(/^# Standard Terms$/m)
  })

  it('includes a Signatures section at the bottom', () => {
    const output = generateDocument({}, 'mutual-nda', SAMPLE_TEMPLATE)
    expect(output).toContain('## Signatures')
    const sigIdx = output.indexOf('## Signatures')
    const termsIdx = output.indexOf('## Standard Terms')
    expect(sigIdx).toBeGreaterThan(termsIdx)
  })

  it('includes the "By signing" statement in the Signatures section', () => {
    const output = generateDocument({}, 'mutual-nda', SAMPLE_TEMPLATE)
    expect(output).toContain(
      'By signing this Cover Page, each party agrees to enter into this Mutual NDA as of the Effective Date.',
    )
  })

  it('renders cover page fields above the standard terms', () => {
    const data: DocumentFields = { purpose: 'Partnership evaluation', governingLaw: 'California' }
    const output = generateDocument(data, 'mutual-nda', SAMPLE_TEMPLATE)
    expect(output).toContain('### Purpose')
    expect(output).toContain('Partnership evaluation')
    const fieldsIdx = output.indexOf('### Purpose')
    const termsIdx = output.indexOf('## Standard Terms')
    expect(fieldsIdx).toBeLessThan(termsIdx)
  })

  it('renders party signature table after the standard terms', () => {
    const data: DocumentFields = {
      party1: { name: 'Alice Smith', company: 'Acme' },
      party2: { name: 'Bob Jones', company: 'Beta' },
    }
    const output = generateDocument(data, 'mutual-nda', SAMPLE_TEMPLATE)
    expect(output).toContain('Alice Smith')
    expect(output).toContain('Bob Jones')
    const sigIdx = output.indexOf('## Signatures')
    const termsIdx = output.indexOf('## Standard Terms')
    expect(sigIdx).toBeGreaterThan(termsIdx)
  })

  it('includes CC BY footer', () => {
    const output = generateDocument({}, 'pilot', SAMPLE_TEMPLATE)
    expect(output).toContain('CC BY 4.0')
  })

  it('does not include the external Full Standard Terms link', () => {
    const output = generateDocument({}, 'mutual-nda', SAMPLE_TEMPLATE)
    expect(output).not.toContain('Full Standard Terms')
    expect(output).not.toContain('commonpaper.com/standards')
  })
})
