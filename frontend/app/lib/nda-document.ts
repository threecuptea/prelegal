export interface NDAData {
  purpose: string
  effectiveDate: string
  mndaTerm: 'expires' | 'continues'
  mndaTermYears: string
  termOfConfidentiality: 'years' | 'perpetuity'
  termOfConfidentialityYears: string
  governingLaw: string
  jurisdiction: string
  modifications: string
  party1Name: string
  party1Title: string
  party1Company: string
  party1Address: string
  party2Name: string
  party2Title: string
  party2Company: string
  party2Address: string
}

export const MIN_YEARS = 1
export const MAX_YEARS = 99

export const MNDA_TERM_OPTIONS = [
  {
    id: 'expires' as const,
    label: (years: string) => `Expires ${years} year(s) from Effective Date.`,
    showsYears: true,
  },
  {
    id: 'continues' as const,
    label: () => 'Continues until terminated in accordance with the terms of the MNDA.',
    showsYears: false,
  },
]

export const CONFIDENTIALITY_OPTIONS = [
  {
    id: 'years' as const,
    label: (years: string) =>
      `${years} year(s) from Effective Date, but in the case of trade secrets until Confidential Information is no longer considered a trade secret under applicable laws.`,
    showsYears: true,
  },
  {
    id: 'perpetuity' as const,
    label: () => 'In perpetuity.',
    showsYears: false,
  },
]

export const COVER_PAGE_PREAMBLE_MD =
  'This Mutual Non-Disclosure Agreement (the "MNDA") consists of: (1) this Cover Page ("**Cover Page**") and (2) the Common Paper Mutual NDA Standard Terms Version 1.0 ("**Standard Terms**") identical to those posted at [commonpaper.com/standards/mutual-nda/1.0](https://commonpaper.com/standards/mutual-nda/1.0). Any modifications of the Standard Terms should be made on the Cover Page, which will control over conflicts with the Standard Terms.'

export const CC_BY_FOOTER_MD =
  'Common Paper Mutual Non-Disclosure Agreement (Version 1.0) free to use under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).'

// Escape characters that would break a markdown table cell.
export function escapePipe(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

// Escape characters that would let user input inject markdown links or inline HTML.
// We escape `\` first to avoid double-escaping, then brackets and angle brackets.
export function escapeMarkdownText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/[\[\]<>]/g, (c) => '\\' + c)
}

export function clampYears(input: string): string {
  const n = parseInt(input, 10)
  if (!Number.isFinite(n) || n < MIN_YEARS) return String(MIN_YEARS)
  if (n > MAX_YEARS) return String(MAX_YEARS)
  return String(n)
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '[Date]'
  const d = new Date(dateStr + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return '[Date]'
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export function mndaTermDescription(d: NDAData): string {
  return d.mndaTerm === 'expires'
    ? `${clampYears(d.mndaTermYears)} year(s) from Effective Date`
    : 'until terminated'
}

export function confidentialityDescription(d: NDAData): string {
  return d.termOfConfidentiality === 'years'
    ? `${clampYears(d.termOfConfidentialityYears)} year(s) from Effective Date`
    : 'in perpetuity'
}

function checkbox(selected: boolean): string {
  return selected ? '[x]' : '[ ]'
}

export function generateMarkdown(d: NDAData): string {
  const safePurpose = escapeMarkdownText(d.purpose)
  const safeGoverningLaw = escapeMarkdownText(d.governingLaw)
  const safeJurisdiction = escapeMarkdownText(d.jurisdiction)
  const safeModifications = d.modifications ? escapeMarkdownText(d.modifications) : 'None'
  const mndaYears = clampYears(d.mndaTermYears)
  const confYears = clampYears(d.termOfConfidentialityYears)

  const mndaTermLines = MNDA_TERM_OPTIONS.map(
    (opt) => `- ${checkbox(d.mndaTerm === opt.id)} ${opt.label(mndaYears)}`,
  ).join('\n')

  const confidentialityLines = CONFIDENTIALITY_OPTIONS.map(
    (opt) => `- ${checkbox(d.termOfConfidentiality === opt.id)} ${opt.label(confYears)}`,
  ).join('\n')

  const tableRows = [
    ['Signature', '', ''],
    ['Print Name', escapePipe(d.party1Name), escapePipe(d.party2Name)],
    ['Title', escapePipe(d.party1Title), escapePipe(d.party2Title)],
    ['Company', escapePipe(d.party1Company), escapePipe(d.party2Company)],
    ['Notice Address', escapePipe(d.party1Address), escapePipe(d.party2Address)],
    ['Date', '', ''],
  ]
    .map((row) => `| ${row[0]} | ${row[1]} | ${row[2]} |`)
    .join('\n')

  const coverPage = `# Mutual Non-Disclosure Agreement

## USING THIS MUTUAL NON-DISCLOSURE AGREEMENT

${COVER_PAGE_PREAMBLE_MD}

### Purpose

${safePurpose}

### Effective Date

${formatDate(d.effectiveDate)}

### MNDA Term

${mndaTermLines}

### Term of Confidentiality

${confidentialityLines}

### Governing Law & Jurisdiction

Governing Law: ${safeGoverningLaw}

Jurisdiction: ${safeJurisdiction}

### MNDA Modifications

${safeModifications}

By signing this Cover Page, each party agrees to enter into this MNDA as of the Effective Date.

|  | PARTY 1 | PARTY 2 |
| :--- | :----: | :----: |
${tableRows}

${CC_BY_FOOTER_MD}`

  const purposeForTerms = safePurpose
  const govForTerms = safeGoverningLaw
  const jurForTerms = safeJurisdiction

  const standardTerms = `---

# Standard Terms

1. **Introduction**. This Mutual Non-Disclosure Agreement (which incorporates these Standard Terms and the Cover Page (defined below)) ("**MNDA**") allows each party ("**Disclosing Party**") to disclose or make available information in connection with the **${purposeForTerms}** which (1) the Disclosing Party identifies to the receiving party ("**Receiving Party**") as "confidential", "proprietary", or the like or (2) should be reasonably understood as confidential or proprietary due to its nature and the circumstances of its disclosure ("**Confidential Information**"). Each party's Confidential Information also includes the existence and status of the parties' discussions and information on the Cover Page. Confidential Information includes technical or business information, product designs or roadmaps, requirements, pricing, security and compliance documentation, technology, inventions and know-how. To use this MNDA, the parties must complete and sign a cover page incorporating these Standard Terms ("**Cover Page**"). Each party is identified on the Cover Page and capitalized terms have the meanings given herein or on the Cover Page.

2. **Use and Protection of Confidential Information**. The Receiving Party shall: (a) use Confidential Information solely for the **${purposeForTerms}**; (b) not disclose Confidential Information to third parties without the Disclosing Party's prior written approval, except that the Receiving Party may disclose Confidential Information to its employees, agents, advisors, contractors and other representatives having a reasonable need to know for the **${purposeForTerms}**, provided these representatives are bound by confidentiality obligations no less protective of the Disclosing Party than the applicable terms in this MNDA and the Receiving Party remains responsible for their compliance with this MNDA; and (c) protect Confidential Information using at least the same protections the Receiving Party uses for its own similar information but no less than a reasonable standard of care.

3. **Exceptions**. The Receiving Party's obligations in this MNDA do not apply to information that it can demonstrate: (a) is or becomes publicly available through no fault of the Receiving Party; (b) it rightfully knew or possessed prior to receipt from the Disclosing Party without confidentiality restrictions; (c) it rightfully obtained from a third party without confidentiality restrictions; or (d) it independently developed without using or referencing the Confidential Information.

4. **Disclosures Required by Law**. The Receiving Party may disclose Confidential Information to the extent required by law, regulation or regulatory authority, subpoena or court order, provided (to the extent legally permitted) it provides the Disclosing Party reasonable advance notice of the required disclosure and reasonably cooperates, at the Disclosing Party's expense, with the Disclosing Party's efforts to obtain confidential treatment for the Confidential Information.

5. **Term and Termination**. This MNDA commences on the **${formatDate(d.effectiveDate)}** and expires at the end of the **${mndaTermDescription(d)}**. Either party may terminate this MNDA for any or no reason upon written notice to the other party. The Receiving Party's obligations relating to Confidential Information will survive for **${confidentialityDescription(d)}**, despite any expiration or termination of this MNDA.

6. **Return or Destruction of Confidential Information**. Upon expiration or termination of this MNDA or upon the Disclosing Party's earlier request, the Receiving Party will: (a) cease using Confidential Information; (b) promptly after the Disclosing Party's written request, destroy all Confidential Information in the Receiving Party's possession or control or return it to the Disclosing Party; and (c) if requested by the Disclosing Party, confirm its compliance with these obligations in writing. As an exception to subsection (b), the Receiving Party may retain Confidential Information in accordance with its standard backup or record retention policies or as required by law, but the terms of this MNDA will continue to apply to the retained Confidential Information.

7. **Proprietary Rights**. The Disclosing Party retains all of its intellectual property and other rights in its Confidential Information and its disclosure to the Receiving Party grants no license under such rights.

8. **Disclaimer**. ALL CONFIDENTIAL INFORMATION IS PROVIDED "AS IS", WITH ALL FAULTS, AND WITHOUT WARRANTIES, INCLUDING THE IMPLIED WARRANTIES OF TITLE, MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE.

9. **Governing Law and Jurisdiction**. This MNDA and all matters relating hereto are governed by, and construed in accordance with, the laws of the State of **${govForTerms}**, without regard to the conflict of laws provisions of such **${govForTerms}**. Any legal suit, action, or proceeding relating to this MNDA must be instituted in the federal or state courts located in **${jurForTerms}**. Each party irrevocably submits to the exclusive jurisdiction of such **${jurForTerms}** in any such suit, action, or proceeding.

10. **Equitable Relief**. A breach of this MNDA may cause irreparable harm for which monetary damages are an insufficient remedy. Upon a breach of this MNDA, the Disclosing Party is entitled to seek appropriate equitable relief, including an injunction, in addition to its other remedies.

11. **General**. Neither party has an obligation under this MNDA to disclose Confidential Information to the other or proceed with any proposed transaction. Neither party may assign this MNDA without the prior written consent of the other party, except that either party may assign this MNDA in connection with a merger, reorganization, acquisition or other transfer of all or substantially all its assets or voting securities. Any assignment in violation of this Section is null and void. This MNDA will bind and inure to the benefit of each party's permitted successors and assigns. Waivers must be signed by the waiving party's authorized representative and cannot be implied from conduct. If any provision of this MNDA is held unenforceable, it will be limited to the minimum extent necessary so the rest of this MNDA remains in effect. This MNDA (including the Cover Page) constitutes the entire agreement of the parties with respect to its subject matter, and supersedes all prior and contemporaneous understandings, agreements, representations, and warranties, whether written or oral, regarding such subject matter. This MNDA may only be amended, modified, waived, or supplemented by an agreement in writing signed by both parties. Notices, requests and approvals under this MNDA must be sent in writing to the email or postal addresses on the Cover Page and are deemed delivered on receipt. This MNDA may be executed in counterparts, including electronic copies, each of which is deemed an original and which together form the same agreement.

Common Paper Mutual Non-Disclosure Agreement [Version 1.0](https://commonpaper.com/standards/mutual-nda/1.0/) free to use under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).`

  return coverPage + '\n\n' + standardTerms
}
