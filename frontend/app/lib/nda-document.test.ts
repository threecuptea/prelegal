import { describe, it, expect } from 'vitest'
import {
  type NDAData,
  clampYears,
  confidentialityDescription,
  escapeMarkdownText,
  escapePipe,
  formatDate,
  generateMarkdown,
  mndaTermDescription,
  MIN_YEARS,
  MAX_YEARS,
} from './nda-document'

const baseData: NDAData = {
  purpose: 'Evaluating a partnership.',
  effectiveDate: '2026-04-29',
  mndaTerm: 'expires',
  mndaTermYears: '2',
  termOfConfidentiality: 'years',
  termOfConfidentialityYears: '3',
  governingLaw: 'California',
  jurisdiction: 'San Francisco, CA',
  modifications: '',
  party1Name: 'Alice Adams',
  party1Title: 'CEO',
  party1Company: 'Acme Corp',
  party1Address: 'alice@acme.com',
  party2Name: 'Bob Brown',
  party2Title: 'CTO',
  party2Company: 'Beta LLC',
  party2Address: 'bob@beta.com',
}

describe('escapePipe', () => {
  it('passes plain text unchanged', () => {
    expect(escapePipe('Acme Corp')).toBe('Acme Corp')
  })

  it('escapes single pipe to keep table cell intact', () => {
    expect(escapePipe('Smith | Jones LLC')).toBe('Smith \\| Jones LLC')
  })

  it('escapes multiple pipes', () => {
    expect(escapePipe('a|b|c')).toBe('a\\|b\\|c')
  })

  it('flattens newlines so they cannot break the table row', () => {
    expect(escapePipe('line1\nline2')).toBe('line1 line2')
  })

  it('handles empty string', () => {
    expect(escapePipe('')).toBe('')
  })
})

describe('escapeMarkdownText', () => {
  it('passes plain text unchanged', () => {
    expect(escapeMarkdownText('a normal sentence')).toBe('a normal sentence')
  })

  it('escapes brackets so a markdown link cannot be injected', () => {
    expect(escapeMarkdownText('click [here](javascript:alert(1))')).toBe(
      'click \\[here\\](javascript:alert(1))',
    )
  })

  it('escapes angle brackets so inline HTML cannot render', () => {
    expect(escapeMarkdownText('<script>x</script>')).toBe('\\<script\\>x\\</script\\>')
  })

  it('escapes backslashes before special chars', () => {
    expect(escapeMarkdownText('a\\b')).toBe('a\\\\b')
  })

  it('handles empty string', () => {
    expect(escapeMarkdownText('')).toBe('')
  })
})

describe('clampYears', () => {
  it('preserves a valid integer string', () => {
    expect(clampYears('5')).toBe('5')
  })

  it('clamps zero up to MIN_YEARS', () => {
    expect(clampYears('0')).toBe(String(MIN_YEARS))
  })

  it('clamps negatives up to MIN_YEARS', () => {
    expect(clampYears('-3')).toBe(String(MIN_YEARS))
  })

  it('clamps absurdly large values down to MAX_YEARS', () => {
    expect(clampYears('1000')).toBe(String(MAX_YEARS))
  })

  it('handles non-numeric input', () => {
    expect(clampYears('abc')).toBe(String(MIN_YEARS))
  })

  it('handles empty input', () => {
    expect(clampYears('')).toBe(String(MIN_YEARS))
  })

  it('truncates fractional input via parseInt', () => {
    expect(clampYears('2.9')).toBe('2')
  })
})

describe('formatDate', () => {
  it('formats an ISO date as a long English date', () => {
    expect(formatDate('2026-04-29')).toBe('April 29, 2026')
  })

  it('returns a placeholder for an empty value', () => {
    expect(formatDate('')).toBe('[Date]')
  })

  it('returns a placeholder for an unparseable value', () => {
    expect(formatDate('not-a-date')).toBe('[Date]')
  })
})

describe('mndaTermDescription', () => {
  it('uses the year count when term expires', () => {
    expect(mndaTermDescription({ ...baseData, mndaTerm: 'expires', mndaTermYears: '5' })).toBe(
      '5 year(s) from Effective Date',
    )
  })

  it('uses static phrase when term continues', () => {
    expect(mndaTermDescription({ ...baseData, mndaTerm: 'continues' })).toBe('until terminated')
  })

  it('clamps zero years up to MIN_YEARS', () => {
    expect(mndaTermDescription({ ...baseData, mndaTerm: 'expires', mndaTermYears: '0' })).toBe(
      `${MIN_YEARS} year(s) from Effective Date`,
    )
  })
})

describe('confidentialityDescription', () => {
  it('uses the year count for years variant', () => {
    expect(
      confidentialityDescription({
        ...baseData,
        termOfConfidentiality: 'years',
        termOfConfidentialityYears: '7',
      }),
    ).toBe('7 year(s) from Effective Date')
  })

  it('uses "in perpetuity" for perpetuity variant', () => {
    expect(
      confidentialityDescription({ ...baseData, termOfConfidentiality: 'perpetuity' }),
    ).toBe('in perpetuity')
  })
})

describe('generateMarkdown', () => {
  it('produces a document with the cover page and standard terms', () => {
    const md = generateMarkdown(baseData)
    expect(md).toContain('# Mutual Non-Disclosure Agreement')
    expect(md).toContain('# Standard Terms')
    expect(md).toContain('Evaluating a partnership.')
    expect(md).toContain('April 29, 2026')
    expect(md).toContain('Governing Law: California')
    expect(md).toContain('Jurisdiction: San Francisco, CA')
  })

  it('checks the selected MNDA term option only', () => {
    const md = generateMarkdown({ ...baseData, mndaTerm: 'expires', mndaTermYears: '2' })
    expect(md).toContain('- [x] Expires 2 year(s) from Effective Date.')
    expect(md).toContain('- [ ] Continues until terminated')
  })

  it('checks the selected confidentiality option only', () => {
    const md = generateMarkdown({ ...baseData, termOfConfidentiality: 'perpetuity' })
    expect(md).toContain('- [ ] 3 year(s) from Effective Date')
    expect(md).toContain('- [x] In perpetuity.')
  })

  it('escapes pipes in party fields so the signature table stays intact', () => {
    const md = generateMarkdown({ ...baseData, party1Company: 'Smith | Jones LLC' })
    expect(md).toContain('Smith \\| Jones LLC')
    expect(md).not.toMatch(/Smith \| Jones LLC(?!\s*\|)/)
    const rows = md.split('\n').filter((l) => l.startsWith('| Company'))
    expect(rows).toHaveLength(1)
    // Split on unescaped pipes only — a markdown parser treats \| as a literal pipe.
    const cells = rows[0].split(/(?<!\\)\|/)
    expect(cells).toHaveLength(5)
  })

  it('escapes markdown link syntax in user-supplied prose', () => {
    const md = generateMarkdown({
      ...baseData,
      purpose: 'evaluation [click](javascript:alert(1))',
    })
    expect(md).not.toContain('[click](javascript:alert(1))')
    expect(md).toContain('\\[click\\]')
  })

  it('escapes inline HTML in user-supplied prose', () => {
    const md = generateMarkdown({ ...baseData, governingLaw: '<script>bad</script>' })
    expect(md).not.toContain('<script>')
    expect(md).toContain('\\<script\\>')
  })

  it('clamps zero years to the minimum so the document is never nonsensical', () => {
    const md = generateMarkdown({ ...baseData, mndaTermYears: '0' })
    expect(md).toContain(`Expires ${MIN_YEARS} year(s) from Effective Date.`)
    expect(md).not.toContain('Expires 0 year(s)')
  })

  it('clamps absurdly large years to MAX_YEARS', () => {
    const md = generateMarkdown({ ...baseData, termOfConfidentialityYears: '99999' })
    expect(md).toContain(`${MAX_YEARS} year(s) from Effective Date`)
    expect(md).not.toContain('99999')
  })

  it('renders "None" when modifications is empty', () => {
    const md = generateMarkdown({ ...baseData, modifications: '' })
    expect(md).toContain('### MNDA Modifications\n\nNone')
  })

  it('renders supplied modifications text (escaped)', () => {
    const md = generateMarkdown({ ...baseData, modifications: 'Section 5 amended' })
    expect(md).toContain('Section 5 amended')
  })

  it('produces well-formed table rows with exactly two data cells per row', () => {
    const md = generateMarkdown(baseData)
    const cellRows = md.split('\n').filter((l) => /^\| (Print Name|Title|Company|Notice Address) /.test(l))
    expect(cellRows).toHaveLength(4)
    for (const row of cellRows) {
      // | label | v1 | v2 | -> 5 segments after split
      expect(row.split('|')).toHaveLength(5)
    }
  })
})
