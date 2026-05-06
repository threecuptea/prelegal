'use client'

import {
  DOCUMENT_REGISTRY,
  generateCoverPage,
  generateDocument,
  processTemplateContent,
  type DocumentFields,
  type DocumentType,
  type PartyInfo,
} from './lib/document-types'

// ── Sub-components ────────────────────────────────────────────────────────────

function SignatureTable({ party1, party2 }: { party1?: PartyInfo; party2?: PartyInfo }) {
  const p1 = party1 ?? {}
  const p2 = party2 ?? {}
  const rows: [string, string | undefined, string | undefined][] = [
    ['Signature', undefined, undefined],
    ['Print Name', p1.name, p2.name],
    ['Title', p1.title, p2.title],
    ['Company', p1.company, p2.company],
    ['Notice Address', p1.noticeAddress, p2.noticeAddress],
    ['Date', undefined, undefined],
  ]
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr>
          <th className="text-left py-1 pr-4 font-medium text-gray-500 w-32" />
          <th className="text-center py-1 px-4 font-semibold text-gray-700 border-b border-gray-300">
            Party 1
          </th>
          <th className="text-center py-1 px-4 font-semibold text-gray-700 border-b border-gray-300">
            Party 2
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, v1, v2]) => (
          <tr key={label} className="border-b border-gray-100">
            <td className="py-2 pr-4 text-gray-500 font-medium">{label}</td>
            <td className="py-2 px-4 text-center text-gray-800">{v1 ?? ''}</td>
            <td className="py-2 px-4 text-center text-gray-800">{v2 ?? ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── TemplateContent ───────────────────────────────────────────────────────────

function TemplateContent({ raw }: { raw: string }) {
  const processed = processTemplateContent(raw)
  const paragraphs = processed.split('\n')
  return (
    <div className="space-y-3">
      {paragraphs.map((para, i) => {
        const trimmed = para.trim()
        if (!trimmed) return null
        if (trimmed.startsWith('## ')) {
          return (
            <h4 key={i} className="text-xs font-bold text-gray-700 mt-2">
              {trimmed.slice(3)}
            </h4>
          )
        }
        const html = trimmed
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => {
            const safeUrl = url.startsWith('https://') ? url : '#'
            return `<a href="${safeUrl}" class="underline text-blue-500 hover:text-blue-700" target="_blank" rel="noopener noreferrer">${text}</a>`
          })
        return (
          <p
            key={i}
            className="text-xs text-gray-700 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )
      })}
    </div>
  )
}

// ── DocumentPreview ───────────────────────────────────────────────────────────

export function DocumentPreview({
  data,
  documentType,
  templateContent,
}: {
  data: DocumentFields
  documentType: DocumentType | null
  templateContent?: string | null
}) {
  if (!documentType) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 text-center text-gray-400 text-sm italic">
        Your document preview will appear here once we identify the agreement type.
      </div>
    )
  }

  const config = DOCUMENT_REGISTRY[documentType]

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-6 text-sm print:shadow-none print:border-0">
      <div>
        <h2 className="text-xl font-bold text-[#032147]">{config.displayName}</h2>
        <p className="text-xs text-gray-400 mt-1">Common Paper Standard Agreement</p>
      </div>

      <hr className="border-gray-200" />

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
          Cover Page
        </h3>
        <div className="space-y-4">
          {config.fields
            .filter((f) => !f.isParty)
            .map(({ key, label, format }) => {
              const raw = data[key]
              const display =
                raw != null && raw !== '' ? (format ? format(raw, data) : String(raw)) : null
              return (
                <div key={key}>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-0.5">
                    {label}
                  </dt>
                  <dd className="text-gray-800">
                    {display ?? <span className="italic text-gray-300">[Not yet provided]</span>}
                  </dd>
                </div>
              )
            })}
        </div>
      </div>

      <hr className="border-gray-200" />

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
          Standard Terms
        </h3>
        {templateContent == null ? (
          <p className="text-xs italic text-gray-300">Loading standard terms…</p>
        ) : templateContent === '' ? (
          <p className="text-xs italic text-gray-400">Standard terms unavailable.</p>
        ) : (
          <TemplateContent raw={templateContent} />
        )}
      </div>

      <hr className="border-gray-200" />

      <div>
        <p className="text-xs text-gray-600 mb-4">
          By signing this Cover Page, each party agrees to enter into this{' '}
          {config.displayName} as of the Effective Date.
        </p>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
          Signatures
        </h3>
        <SignatureTable party1={data.party1} party2={data.party2} />
      </div>

      <p className="text-xs text-gray-400 pt-2 border-t border-gray-100">
        Common Paper {config.displayName} free to use under{' '}
        <a
          href="https://creativecommons.org/licenses/by/4.0/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          CC BY 4.0
        </a>
        .
      </p>
    </div>
  )
}

// ── Download helper ───────────────────────────────────────────────────────────

export function downloadMarkdown(
  data: DocumentFields,
  documentType: DocumentType,
  templateContent?: string,
): void {
  const config = DOCUMENT_REGISTRY[documentType]
  const markdown = templateContent
    ? generateDocument(data, documentType, templateContent)
    : generateCoverPage(data, documentType)
  const blob = new Blob([markdown], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = config.displayName.replace(/\s+/g, '-') + '.md'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1_000)
}
