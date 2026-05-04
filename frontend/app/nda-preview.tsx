'use client'

import {
  CONFIDENTIALITY_OPTIONS,
  MNDA_TERM_OPTIONS,
  type NDAData,
  clampYears,
  confidentialityDescription,
  formatDate,
  generateMarkdown,
  mndaTermDescription,
} from './lib/nda-document'

const tableCellClass = 'border border-gray-300 px-3 py-2'
const tableSpacerCellClass = 'border border-gray-300 px-3 py-3'

export function downloadMarkdown(data: NDAData) {
  const content = generateMarkdown(data)
  const blob = new Blob([content], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'Mutual-NDA.md'
  a.click()
  // Defer revocation: a.click() schedules the download asynchronously, and
  // revoking the URL synchronously can race with the browser starting it.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function NDAPreview({ data }: { data: NDAData }) {
  return (
    <div className="bg-white shadow-sm rounded-lg p-8 print:shadow-none print:rounded-none print:p-0">
      <h1 className="text-2xl font-bold text-center mb-2">Mutual Non-Disclosure Agreement</h1>
      <p className="text-xs text-center text-gray-500 mb-8">
        Common Paper Mutual NDA Version 1.0 · Free to use under{' '}
        <a href="https://creativecommons.org/licenses/by/4.0/" className="underline">CC BY 4.0</a>
      </p>

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
            <div className="text-gray-900">{data.purpose || <em className="text-gray-400">[Not yet provided]</em>}</div>
          </div>

          <div>
            <div className="font-semibold text-gray-700 mb-1">Effective Date</div>
            <div className="text-gray-900">{formatDate(data.effectiveDate)}</div>
          </div>

          <div>
            <div className="font-semibold text-gray-700 mb-1">MNDA Term</div>
            <div className="text-gray-500 text-xs mb-1">The length of this MNDA</div>
            <div className="space-y-1 text-gray-900">
              {MNDA_TERM_OPTIONS.map((opt) => (
                <div key={opt.id} className="flex items-center gap-2">
                  <span className="text-base">{data.mndaTerm === opt.id ? '☑' : '☐'}</span>
                  <span>{opt.label(clampYears(data.mndaTermYears))}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="font-semibold text-gray-700 mb-1">Term of Confidentiality</div>
            <div className="text-gray-500 text-xs mb-1">How long Confidential Information is protected</div>
            <div className="space-y-1 text-gray-900">
              {CONFIDENTIALITY_OPTIONS.map((opt) => (
                <div key={opt.id} className="flex items-start gap-2">
                  <span className="text-base">{data.termOfConfidentiality === opt.id ? '☑' : '☐'}</span>
                  <span>{opt.label(clampYears(data.termOfConfidentialityYears))}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="font-semibold text-gray-700 mb-1">Governing Law & Jurisdiction</div>
            <div className="text-gray-900">
              <div>Governing Law: {data.governingLaw || <em className="text-gray-400">[Not yet provided]</em>}</div>
              <div>Jurisdiction: {data.jurisdiction || <em className="text-gray-400">[Not yet provided]</em>}</div>
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
                <th className={`${tableCellClass} text-left text-gray-700 w-1/3`}></th>
                <th className={`${tableCellClass} text-center text-gray-700`}>Party 1</th>
                <th className={`${tableCellClass} text-center text-gray-700`}>Party 2</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Signature', v1: ' ', v2: ' ', spacer: true },
                { label: 'Print Name', v1: data.party1Name, v2: data.party2Name },
                { label: 'Title', v1: data.party1Title, v2: data.party2Title },
                { label: 'Company', v1: data.party1Company, v2: data.party2Company },
                { label: 'Notice Address', v1: data.party1Address, v2: data.party2Address },
                { label: 'Date', v1: ' ', v2: ' ', spacer: true },
              ].map(({ label, v1, v2, spacer }) => {
                const cls = spacer ? tableSpacerCellClass : tableCellClass
                return (
                  <tr key={label}>
                    <td className={`${cls} text-gray-600`}>{label}</td>
                    <td className={`${cls} text-center`}>{v1}</td>
                    <td className={`${cls} text-center`}>{v2}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <hr className="my-8 border-gray-300" />

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
  )
}
