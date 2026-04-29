'use client'

import { useState } from 'react'

interface NDAData {
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

const today = new Date().toISOString().split('T')[0]

const defaultData: NDAData = {
  purpose: 'Evaluating whether to enter into a business relationship with the other party.',
  effectiveDate: today,
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
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '[Date]'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function mndaTermDescription(d: NDAData): string {
  return d.mndaTerm === 'expires'
    ? `${d.mndaTermYears} year(s) from Effective Date`
    : 'until terminated'
}

function confidentialityDescription(d: NDAData): string {
  return d.termOfConfidentiality === 'years'
    ? `${d.termOfConfidentialityYears} year(s) from Effective Date`
    : 'in perpetuity'
}

function generateMarkdown(d: NDAData): string {
  const mndaTermLine =
    d.mndaTerm === 'expires'
      ? `- [x] Expires ${d.mndaTermYears} year(s) from Effective Date.\n- [ ] Continues until terminated in accordance with the terms of the MNDA.`
      : `- [ ] Expires ${d.mndaTermYears} year(s) from Effective Date.\n- [x] Continues until terminated in accordance with the terms of the MNDA.`

  const confidentialityLine =
    d.termOfConfidentiality === 'years'
      ? `- [x] ${d.termOfConfidentialityYears} year(s) from Effective Date, but in the case of trade secrets until Confidential Information is no longer considered a trade secret under applicable laws.\n- [ ] In perpetuity.`
      : `- [ ] ${d.termOfConfidentialityYears} year(s) from Effective Date, but in the case of trade secrets until Confidential Information is no longer considered a trade secret under applicable laws.\n- [x] In perpetuity.`

  const coverPage = `# Mutual Non-Disclosure Agreement

## USING THIS MUTUAL NON-DISCLOSURE AGREEMENT

This Mutual Non-Disclosure Agreement (the "MNDA") consists of: (1) this Cover Page ("**Cover Page**") and (2) the Common Paper Mutual NDA Standard Terms Version 1.0 ("**Standard Terms**") identical to those posted at [commonpaper.com/standards/mutual-nda/1.0](https://commonpaper.com/standards/mutual-nda/1.0). Any modifications of the Standard Terms should be made on the Cover Page, which will control over conflicts with the Standard Terms.

### Purpose

${d.purpose}

### Effective Date

${formatDate(d.effectiveDate)}

### MNDA Term

${mndaTermLine}

### Term of Confidentiality

${confidentialityLine}

### Governing Law & Jurisdiction

Governing Law: ${d.governingLaw}

Jurisdiction: ${d.jurisdiction}

### MNDA Modifications

${d.modifications || 'None'}

By signing this Cover Page, each party agrees to enter into this MNDA as of the Effective Date.

|| PARTY 1 | PARTY 2 |
|:--- | :----: | :----: |
| Signature | | |
| Print Name | ${d.party1Name} | ${d.party2Name} |
| Title | ${d.party1Title} | ${d.party2Title} |
| Company | ${d.party1Company} | ${d.party2Company} |
| Notice Address | ${d.party1Address} | ${d.party2Address} |
| Date | | |

Common Paper Mutual Non-Disclosure Agreement (Version 1.0) free to use under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).`

  const standardTerms = `---

# Standard Terms

1. **Introduction**. This Mutual Non-Disclosure Agreement (which incorporates these Standard Terms and the Cover Page (defined below)) ("**MNDA**") allows each party ("**Disclosing Party**") to disclose or make available information in connection with the **${d.purpose}** which (1) the Disclosing Party identifies to the receiving party ("**Receiving Party**") as "confidential", "proprietary", or the like or (2) should be reasonably understood as confidential or proprietary due to its nature and the circumstances of its disclosure ("**Confidential Information**"). Each party's Confidential Information also includes the existence and status of the parties' discussions and information on the Cover Page. Confidential Information includes technical or business information, product designs or roadmaps, requirements, pricing, security and compliance documentation, technology, inventions and know-how. To use this MNDA, the parties must complete and sign a cover page incorporating these Standard Terms ("**Cover Page**"). Each party is identified on the Cover Page and capitalized terms have the meanings given herein or on the Cover Page.

2. **Use and Protection of Confidential Information**. The Receiving Party shall: (a) use Confidential Information solely for the **${d.purpose}**; (b) not disclose Confidential Information to third parties without the Disclosing Party's prior written approval, except that the Receiving Party may disclose Confidential Information to its employees, agents, advisors, contractors and other representatives having a reasonable need to know for the **${d.purpose}**, provided these representatives are bound by confidentiality obligations no less protective of the Disclosing Party than the applicable terms in this MNDA and the Receiving Party remains responsible for their compliance with this MNDA; and (c) protect Confidential Information using at least the same protections the Receiving Party uses for its own similar information but no less than a reasonable standard of care.

3. **Exceptions**. The Receiving Party's obligations in this MNDA do not apply to information that it can demonstrate: (a) is or becomes publicly available through no fault of the Receiving Party; (b) it rightfully knew or possessed prior to receipt from the Disclosing Party without confidentiality restrictions; (c) it rightfully obtained from a third party without confidentiality restrictions; or (d) it independently developed without using or referencing the Confidential Information.

4. **Disclosures Required by Law**. The Receiving Party may disclose Confidential Information to the extent required by law, regulation or regulatory authority, subpoena or court order, provided (to the extent legally permitted) it provides the Disclosing Party reasonable advance notice of the required disclosure and reasonably cooperates, at the Disclosing Party's expense, with the Disclosing Party's efforts to obtain confidential treatment for the Confidential Information.

5. **Term and Termination**. This MNDA commences on the **${formatDate(d.effectiveDate)}** and expires at the end of the **${mndaTermDescription(d)}**. Either party may terminate this MNDA for any or no reason upon written notice to the other party. The Receiving Party's obligations relating to Confidential Information will survive for **${confidentialityDescription(d)}**, despite any expiration or termination of this MNDA.

6. **Return or Destruction of Confidential Information**. Upon expiration or termination of this MNDA or upon the Disclosing Party's earlier request, the Receiving Party will: (a) cease using Confidential Information; (b) promptly after the Disclosing Party's written request, destroy all Confidential Information in the Receiving Party's possession or control or return it to the Disclosing Party; and (c) if requested by the Disclosing Party, confirm its compliance with these obligations in writing. As an exception to subsection (b), the Receiving Party may retain Confidential Information in accordance with its standard backup or record retention policies or as required by law, but the terms of this MNDA will continue to apply to the retained Confidential Information.

7. **Proprietary Rights**. The Disclosing Party retains all of its intellectual property and other rights in its Confidential Information and its disclosure to the Receiving Party grants no license under such rights.

8. **Disclaimer**. ALL CONFIDENTIAL INFORMATION IS PROVIDED "AS IS", WITH ALL FAULTS, AND WITHOUT WARRANTIES, INCLUDING THE IMPLIED WARRANTIES OF TITLE, MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE.

9. **Governing Law and Jurisdiction**. This MNDA and all matters relating hereto are governed by, and construed in accordance with, the laws of the State of **${d.governingLaw}**, without regard to the conflict of laws provisions of such **${d.governingLaw}**. Any legal suit, action, or proceeding relating to this MNDA must be instituted in the federal or state courts located in **${d.jurisdiction}**. Each party irrevocably submits to the exclusive jurisdiction of such **${d.jurisdiction}** in any such suit, action, or proceeding.

10. **Equitable Relief**. A breach of this MNDA may cause irreparable harm for which monetary damages are an insufficient remedy. Upon a breach of this MNDA, the Disclosing Party is entitled to seek appropriate equitable relief, including an injunction, in addition to its other remedies.

11. **General**. Neither party has an obligation under this MNDA to disclose Confidential Information to the other or proceed with any proposed transaction. Neither party may assign this MNDA without the prior written consent of the other party, except that either party may assign this MNDA in connection with a merger, reorganization, acquisition or other transfer of all or substantially all its assets or voting securities. Any assignment in violation of this Section is null and void. This MNDA will bind and inure to the benefit of each party's permitted successors and assigns. Waivers must be signed by the waiving party's authorized representative and cannot be implied from conduct. If any provision of this MNDA is held unenforceable, it will be limited to the minimum extent necessary so the rest of this MNDA remains in effect. This MNDA (including the Cover Page) constitutes the entire agreement of the parties with respect to its subject matter, and supersedes all prior and contemporaneous understandings, agreements, representations, and warranties, whether written or oral, regarding such subject matter. This MNDA may only be amended, modified, waived, or supplemented by an agreement in writing signed by both parties. Notices, requests and approvals under this MNDA must be sent in writing to the email or postal addresses on the Cover Page and are deemed delivered on receipt. This MNDA may be executed in counterparts, including electronic copies, each of which is deemed an original and which together form the same agreement.

Common Paper Mutual Non-Disclosure Agreement [Version 1.0](https://commonpaper.com/standards/mutual-nda/1.0/) free to use under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).`

  return coverPage + '\n\n' + standardTerms
}

function NDAPreview({ data, onBack }: { data: NDAData; onBack: () => void }) {
  function downloadMarkdown() {
    const content = generateMarkdown(data)
    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'Mutual-NDA.md'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Action bar */}
      <div className="no-print sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          ← Edit
        </button>
        <span className="text-sm text-gray-500 flex-1">Mutual Non-Disclosure Agreement</span>
        <button
          onClick={downloadMarkdown}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
        >
          Download .md
        </button>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-md hover:bg-gray-900"
        >
          Print / Save PDF
        </button>
      </div>

      {/* Document */}
      <div className="max-w-4xl mx-auto my-8 px-4 print:my-0 print:px-0">
        <div className="bg-white shadow-md rounded-lg p-10 print:shadow-none print:rounded-none print:p-0">
          <h1 className="text-2xl font-bold text-center mb-2">Mutual Non-Disclosure Agreement</h1>
          <p className="text-xs text-center text-gray-500 mb-8">
            Common Paper Mutual NDA Version 1.0 · Free to use under{' '}
            <a href="https://creativecommons.org/licenses/by/4.0/" className="underline">CC BY 4.0</a>
          </p>

          {/* --- COVER PAGE --- */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold border-b pb-2 mb-4">Cover Page</h2>
            <p className="text-sm text-gray-600 mb-6">
              This MNDA consists of (1) this Cover Page and (2) the{' '}
              <a href="https://commonpaper.com/standards/mutual-nda/1.0" className="underline text-blue-600">
                Common Paper Mutual NDA Standard Terms Version 1.0
              </a>
              . Any modifications of the Standard Terms should be made on the Cover Page, which will
              control over conflicts with the Standard Terms.
            </p>

            <div className="space-y-5 text-sm">
              <div>
                <div className="font-semibold text-gray-700 mb-1">Purpose</div>
                <div className="text-gray-500 text-xs mb-1">How Confidential Information may be used</div>
                <div className="text-gray-900">{data.purpose}</div>
              </div>

              <div>
                <div className="font-semibold text-gray-700 mb-1">Effective Date</div>
                <div className="text-gray-900">{formatDate(data.effectiveDate)}</div>
              </div>

              <div>
                <div className="font-semibold text-gray-700 mb-1">MNDA Term</div>
                <div className="text-gray-500 text-xs mb-1">The length of this MNDA</div>
                <div className="space-y-1 text-gray-900">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{data.mndaTerm === 'expires' ? '☑' : '☐'}</span>
                    <span>Expires {data.mndaTermYears} year(s) from Effective Date.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base">{data.mndaTerm === 'continues' ? '☑' : '☐'}</span>
                    <span>Continues until terminated in accordance with the terms of the MNDA.</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="font-semibold text-gray-700 mb-1">Term of Confidentiality</div>
                <div className="text-gray-500 text-xs mb-1">How long Confidential Information is protected</div>
                <div className="space-y-1 text-gray-900">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{data.termOfConfidentiality === 'years' ? '☑' : '☐'}</span>
                    <span>
                      {data.termOfConfidentialityYears} year(s) from Effective Date, but in the case of trade
                      secrets until Confidential Information is no longer considered a trade secret under applicable laws.
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base">{data.termOfConfidentiality === 'perpetuity' ? '☑' : '☐'}</span>
                    <span>In perpetuity.</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="font-semibold text-gray-700 mb-1">Governing Law & Jurisdiction</div>
                <div className="text-gray-900">
                  <div>Governing Law: {data.governingLaw}</div>
                  <div>Jurisdiction: {data.jurisdiction}</div>
                </div>
              </div>

              {data.modifications && (
                <div>
                  <div className="font-semibold text-gray-700 mb-1">MNDA Modifications</div>
                  <div className="text-gray-900 whitespace-pre-wrap">{data.modifications}</div>
                </div>
              )}
            </div>

            <p className="text-sm text-gray-700 mt-6 mb-4">
              By signing this Cover Page, each party agrees to enter into this MNDA as of the Effective Date.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-300 px-3 py-2 text-left text-gray-700 w-1/3"></th>
                    <th className="border border-gray-300 px-3 py-2 text-center text-gray-700">Party 1</th>
                    <th className="border border-gray-300 px-3 py-2 text-center text-gray-700">Party 2</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-300 px-3 py-3 text-gray-600">Signature</td>
                    <td className="border border-gray-300 px-3 py-3">&nbsp;</td>
                    <td className="border border-gray-300 px-3 py-3">&nbsp;</td>
                  </tr>
                  {[
                    ['Print Name', data.party1Name, data.party2Name],
                    ['Title', data.party1Title, data.party2Title],
                    ['Company', data.party1Company, data.party2Company],
                    ['Notice Address', data.party1Address, data.party2Address],
                  ].map(([label, v1, v2]) => (
                    <tr key={label}>
                      <td className="border border-gray-300 px-3 py-2 text-gray-600">{label}</td>
                      <td className="border border-gray-300 px-3 py-2 text-center">{v1}</td>
                      <td className="border border-gray-300 px-3 py-2 text-center">{v2}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="border border-gray-300 px-3 py-3 text-gray-600">Date</td>
                    <td className="border border-gray-300 px-3 py-3">&nbsp;</td>
                    <td className="border border-gray-300 px-3 py-3">&nbsp;</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <hr className="my-8 border-gray-300" />

          {/* --- STANDARD TERMS --- */}
          <section>
            <h2 className="text-lg font-semibold border-b pb-2 mb-4">Standard Terms</h2>
            <ol className="list-decimal list-outside space-y-4 text-sm text-gray-800 leading-relaxed pl-5">
              <li>
                <strong>Introduction.</strong> This Mutual Non-Disclosure Agreement (which incorporates these
                Standard Terms and the Cover Page) (&ldquo;MNDA&rdquo;) allows each party
                (&ldquo;Disclosing Party&rdquo;) to disclose or make available information in connection with
                the <em>{data.purpose}</em> which (1) the Disclosing Party identifies to the receiving party
                (&ldquo;Receiving Party&rdquo;) as &ldquo;confidential&rdquo;, &ldquo;proprietary&rdquo;, or
                the like or (2) should be reasonably understood as confidential or proprietary due to its nature
                and the circumstances of its disclosure (&ldquo;Confidential Information&rdquo;). Each
                party&apos;s Confidential Information also includes the existence and status of the parties&apos;
                discussions and information on the Cover Page. Confidential Information includes technical or
                business information, product designs or roadmaps, requirements, pricing, security and compliance
                documentation, technology, inventions and know-how.
              </li>
              <li>
                <strong>Use and Protection of Confidential Information.</strong> The Receiving Party shall: (a)
                use Confidential Information solely for the <em>{data.purpose}</em>; (b) not disclose
                Confidential Information to third parties without the Disclosing Party&apos;s prior written
                approval, except to representatives with a reasonable need to know bound by equivalent
                confidentiality obligations; and (c) protect Confidential Information using at least the same
                protections the Receiving Party uses for its own similar information but no less than a
                reasonable standard of care.
              </li>
              <li>
                <strong>Exceptions.</strong> The Receiving Party&apos;s obligations do not apply to information
                that: (a) is or becomes publicly available through no fault of the Receiving Party; (b) it
                rightfully knew prior to receipt without confidentiality restrictions; (c) it rightfully obtained
                from a third party without confidentiality restrictions; or (d) it independently developed
                without using the Confidential Information.
              </li>
              <li>
                <strong>Disclosures Required by Law.</strong> The Receiving Party may disclose Confidential
                Information to the extent required by law, regulation, subpoena or court order, provided it
                gives the Disclosing Party reasonable advance notice and cooperates with efforts to obtain
                confidential treatment.
              </li>
              <li>
                <strong>Term and Termination.</strong> This MNDA commences on{' '}
                <strong>{formatDate(data.effectiveDate)}</strong> and expires at the end of the{' '}
                <strong>{mndaTermDescription(data)}</strong>. Either party may terminate this MNDA upon written
                notice. The Receiving Party&apos;s obligations relating to Confidential Information will survive
                for <strong>{confidentialityDescription(data)}</strong>, despite any expiration or termination.
              </li>
              <li>
                <strong>Return or Destruction of Confidential Information.</strong> Upon expiration or
                termination, the Receiving Party will cease using Confidential Information and promptly destroy
                or return it upon request, confirming compliance in writing if requested.
              </li>
              <li>
                <strong>Proprietary Rights.</strong> The Disclosing Party retains all intellectual property
                rights in its Confidential Information. Disclosure grants no license under such rights.
              </li>
              <li>
                <strong>Disclaimer.</strong> ALL CONFIDENTIAL INFORMATION IS PROVIDED &ldquo;AS IS&rdquo;, WITH
                ALL FAULTS, AND WITHOUT WARRANTIES, INCLUDING THE IMPLIED WARRANTIES OF TITLE, MERCHANTABILITY
                AND FITNESS FOR A PARTICULAR PURPOSE.
              </li>
              <li>
                <strong>Governing Law and Jurisdiction.</strong> This MNDA is governed by the laws of the State
                of <strong>{data.governingLaw}</strong>, without regard to conflict of laws provisions. Any
                legal proceedings must be instituted in the courts located in{' '}
                <strong>{data.jurisdiction}</strong>. Each party irrevocably submits to such jurisdiction.
              </li>
              <li>
                <strong>Equitable Relief.</strong> A breach of this MNDA may cause irreparable harm for which
                monetary damages are an insufficient remedy. The Disclosing Party is entitled to seek appropriate
                equitable relief, including an injunction.
              </li>
              <li>
                <strong>General.</strong> Neither party has an obligation to disclose Confidential Information or
                proceed with any transaction. This MNDA may not be assigned without prior written consent except
                in connection with a merger or acquisition. This MNDA constitutes the entire agreement with
                respect to its subject matter and may only be amended in a signed writing. Notices must be sent
                to the addresses on the Cover Page. This MNDA may be executed in counterparts, including
                electronic copies.
              </li>
            </ol>

            <p className="text-xs text-gray-400 mt-8 pt-4 border-t border-gray-200">
              Common Paper Mutual Non-Disclosure Agreement{' '}
              <a href="https://commonpaper.com/standards/mutual-nda/1.0" className="underline">
                Version 1.0
              </a>{' '}
              free to use under{' '}
              <a href="https://creativecommons.org/licenses/by/4.0/" className="underline">
                CC BY 4.0
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {hint && <span className="ml-2 text-xs font-normal text-gray-400">{hint}</span>}
      </label>
      {children}
    </div>
  )
}

const inputClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

export default function NDAForm() {
  const [data, setData] = useState<NDAData>(defaultData)
  const [step, setStep] = useState<'form' | 'preview'>('form')

  function set(field: keyof NDAData, value: string) {
    setData((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStep('preview')
  }

  if (step === 'preview') {
    return <NDAPreview data={data} onBack={() => setStep('form')} />
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Mutual NDA Creator</h1>
          <p className="mt-1 text-sm text-gray-500">
            Fill in the details below to generate your Mutual Non-Disclosure Agreement.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Agreement Details */}
          <section className="bg-white rounded-lg border border-gray-200 p-6 space-y-5">
            <h2 className="text-base font-semibold text-gray-800">Agreement Details</h2>

            <Field label="Purpose" hint="How Confidential Information may be used">
              <textarea
                value={data.purpose}
                onChange={(e) => set('purpose', e.target.value)}
                rows={2}
                required
                className={inputClass}
              />
            </Field>

            <Field label="Effective Date">
              <input
                type="date"
                value={data.effectiveDate}
                onChange={(e) => set('effectiveDate', e.target.value)}
                required
                className={inputClass}
              />
            </Field>
          </section>

          {/* MNDA Term */}
          <section className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-800">MNDA Term</h2>
            <p className="text-xs text-gray-400">The length of this MNDA</p>

            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="mndaTerm"
                  value="expires"
                  checked={data.mndaTerm === 'expires'}
                  onChange={() => set('mndaTerm', 'expires')}
                  className="mt-0.5"
                />
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <span>Expires after</span>
                  <input
                    type="number"
                    min="1"
                    value={data.mndaTermYears}
                    onChange={(e) => set('mndaTermYears', e.target.value)}
                    disabled={data.mndaTerm !== 'expires'}
                    className="w-16 rounded border border-gray-300 px-2 py-1 text-sm text-center disabled:opacity-40"
                  />
                  <span>year(s) from Effective Date</span>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer text-sm text-gray-700">
                <input
                  type="radio"
                  name="mndaTerm"
                  value="continues"
                  checked={data.mndaTerm === 'continues'}
                  onChange={() => set('mndaTerm', 'continues')}
                />
                Continues until terminated in accordance with the terms of the MNDA
              </label>
            </div>
          </section>

          {/* Term of Confidentiality */}
          <section className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-800">Term of Confidentiality</h2>
            <p className="text-xs text-gray-400">How long Confidential Information is protected</p>

            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="termOfConfidentiality"
                  value="years"
                  checked={data.termOfConfidentiality === 'years'}
                  onChange={() => set('termOfConfidentiality', 'years')}
                  className="mt-0.5"
                />
                <div className="flex items-center gap-2 text-sm text-gray-700 flex-wrap">
                  <input
                    type="number"
                    min="1"
                    value={data.termOfConfidentialityYears}
                    onChange={(e) => set('termOfConfidentialityYears', e.target.value)}
                    disabled={data.termOfConfidentiality !== 'years'}
                    className="w-16 rounded border border-gray-300 px-2 py-1 text-sm text-center disabled:opacity-40"
                  />
                  <span>
                    year(s) from Effective Date (trade secrets protected until no longer a trade secret under
                    applicable law)
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer text-sm text-gray-700">
                <input
                  type="radio"
                  name="termOfConfidentiality"
                  value="perpetuity"
                  checked={data.termOfConfidentiality === 'perpetuity'}
                  onChange={() => set('termOfConfidentiality', 'perpetuity')}
                />
                In perpetuity
              </label>
            </div>
          </section>

          {/* Governing Law & Jurisdiction */}
          <section className="bg-white rounded-lg border border-gray-200 p-6 space-y-5">
            <h2 className="text-base font-semibold text-gray-800">Governing Law & Jurisdiction</h2>

            <Field label="Governing Law" hint="State name, e.g. Delaware">
              <input
                type="text"
                value={data.governingLaw}
                onChange={(e) => set('governingLaw', e.target.value)}
                placeholder="California"
                required
                className={inputClass}
              />
            </Field>

            <Field label="Jurisdiction" hint='City/county and state, e.g. "San Francisco, CA"'>
              <input
                type="text"
                value={data.jurisdiction}
                onChange={(e) => set('jurisdiction', e.target.value)}
                placeholder="San Francisco, CA"
                required
                className={inputClass}
              />
            </Field>
          </section>

          {/* Modifications */}
          <section className="bg-white rounded-lg border border-gray-200 p-6 space-y-5">
            <h2 className="text-base font-semibold text-gray-800">
              MNDA Modifications <span className="text-sm font-normal text-gray-400">(optional)</span>
            </h2>
            <Field label="List any modifications to the Standard Terms">
              <textarea
                value={data.modifications}
                onChange={(e) => set('modifications', e.target.value)}
                rows={3}
                placeholder="Leave blank if none"
                className={inputClass}
              />
            </Field>
          </section>

          {/* Parties */}
          <section className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-5">Party Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {(['1', '2'] as const).map((n) => {
                const prefix = `party${n}` as 'party1' | 'party2'
                return (
                  <div key={n} className="space-y-4">
                    <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                      Party {n}
                    </h3>
                    <Field label="Full Name">
                      <input
                        type="text"
                        value={data[`${prefix}Name`]}
                        onChange={(e) => set(`${prefix}Name`, e.target.value)}
                        placeholder="Jane Smith"
                        required
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Title">
                      <input
                        type="text"
                        value={data[`${prefix}Title`]}
                        onChange={(e) => set(`${prefix}Title`, e.target.value)}
                        placeholder="CEO"
                        required
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Company">
                      <input
                        type="text"
                        value={data[`${prefix}Company`]}
                        onChange={(e) => set(`${prefix}Company`, e.target.value)}
                        placeholder="Acme Corp"
                        required
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Notice Address" hint="Email or postal address">
                      <input
                        type="text"
                        value={data[`${prefix}Address`]}
                        onChange={(e) => set(`${prefix}Address`, e.target.value)}
                        placeholder="jane@acme.com"
                        required
                        className={inputClass}
                      />
                    </Field>
                  </div>
                )
              })}
            </div>
          </section>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-6 py-3 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Generate NDA →
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
