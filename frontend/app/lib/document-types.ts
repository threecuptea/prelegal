// Central registry for all supported Common Paper document types.
// Drives field collection, cover page generation, preview, and field summary.

export type DocumentType =
  | 'mutual-nda'
  | 'csa'
  | 'design-partner'
  | 'sla'
  | 'psa'
  | 'dpa'
  | 'software-license'
  | 'partnership'
  | 'pilot'
  | 'baa'
  | 'ai-addendum'

export interface PartyInfo {
  name?: string
  title?: string
  company?: string
  noticeAddress?: string
  date?: string
}

export interface DocumentFields {
  // Common
  purpose?: string
  effectiveDate?: string
  governingLaw?: string
  jurisdiction?: string
  // Mutual NDA
  mndaTermType?: 'expires' | 'continues'
  mndaTermYears?: number
  confidentialityTermType?: 'years' | 'perpetuity'
  confidentialityTermYears?: number
  modifications?: string
  // Cloud Service Agreement
  providerName?: string
  customerName?: string
  subscriptionPeriod?: string
  technicalSupport?: string
  fees?: string
  paymentTerms?: string
  // Pilot Agreement
  pilotPeriod?: string
  evaluationPurpose?: string
  generalCapAmount?: string
  // Design Partner Agreement
  programName?: string
  feedbackRequirements?: string
  accessPeriod?: string
  // Service Level Agreement
  uptimeTarget?: string
  responseTimeCommitment?: string
  serviceCredits?: string
  // Professional Services Agreement
  deliverables?: string
  projectTimeline?: string
  paymentSchedule?: string
  ipOwnership?: string
  // Partnership Agreement
  partnershipScope?: string
  trademarkRights?: string
  revenueShare?: string
  // Software License Agreement
  licensedSoftware?: string
  licenseType?: string
  licenseFees?: string
  supportTerms?: string
  // Data Processing Agreement
  dataSubjects?: string
  processingPurpose?: string
  dataCategories?: string
  subprocessors?: string
  // Business Associate Agreement
  phiDescription?: string
  permittedUses?: string
  safeguards?: string
  // AI Addendum
  aiFeatures?: string
  trainingDataRights?: string
  outputOwnership?: string
  // Parties
  party1?: PartyInfo
  party2?: PartyInfo
}

export interface ChatResponse extends DocumentFields {
  response: string
  isComplete: boolean
  documentType?: DocumentType
  suggestedDocument?: string
}

export interface FieldDescriptor {
  key: keyof DocumentFields
  label: string
  required: boolean
  isParty?: boolean
  format?: (value: unknown, data: DocumentFields) => string
}

export interface DocumentTypeConfig {
  documentType: DocumentType
  displayName: string
  commonPaperUrl: string
  templateFile: string
  fields: FieldDescriptor[]
}

// ── Utilities ────────────────────────────────────────────────────────────────

export function clampYears(input: number | null | undefined): number {
  if (input == null || !Number.isFinite(input) || input < 1) return 1
  if (input > 99) return 99
  return Math.round(input)
}

export function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '[Date]'
  const d = new Date(dateStr + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return '[Date]'
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export function isEffectiveDateInPast(dateStr: string): boolean {
  const d = new Date(dateStr + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return false
  const today = new Date().toISOString().split('T')[0]
  return dateStr < today
}

export function escapePipe(s: string | undefined): string {
  return (s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

export function escapeMarkdownText(s: string | undefined): string {
  return (s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/[\[\]<>]/g, (c) => '\\' + c)
}

// ── Document Registry ────────────────────────────────────────────────────────

const COMMON_CORE_FIELDS: FieldDescriptor[] = [
  { key: 'purpose', label: 'Purpose', required: true },
  {
    key: 'effectiveDate',
    label: 'Effective Date',
    required: true,
    format: (v) => formatDate(v as string),
  },
  { key: 'governingLaw', label: 'Governing Law', required: true },
  { key: 'jurisdiction', label: 'Jurisdiction', required: true },
]

const COMMON_PARTY_FIELDS: FieldDescriptor[] = [
  { key: 'party1', label: 'Party 1', required: true, isParty: true },
  { key: 'party2', label: 'Party 2', required: true, isParty: true },
]

const COMMON_FIELDS: FieldDescriptor[] = [...COMMON_CORE_FIELDS, ...COMMON_PARTY_FIELDS]

export const DOCUMENT_REGISTRY: Record<DocumentType, DocumentTypeConfig> = {
  'mutual-nda': {
    documentType: 'mutual-nda',
    displayName: 'Mutual NDA',
    commonPaperUrl: 'https://commonpaper.com/standards/mutual-nda/1.0/',
    templateFile: 'Mutual-NDA.md',
    fields: [
      ...COMMON_CORE_FIELDS,
      {
        key: 'mndaTermType',
        label: 'MNDA Term',
        required: true,
        format: (v, d) => {
          if (v === 'expires') return `Expires after ${clampYears(d.mndaTermYears)} year(s)`
          return 'Continues until terminated'
        },
      },
      { key: 'mndaTermYears', label: 'MNDA Term Years', required: false },
      {
        key: 'confidentialityTermType',
        label: 'Term of Confidentiality',
        required: true,
        format: (v, d) => {
          if (v === 'years') return `${clampYears(d.confidentialityTermYears)} year(s) from Effective Date`
          return 'In perpetuity'
        },
      },
      { key: 'confidentialityTermYears', label: 'Confidentiality Term Years', required: false },
      { key: 'modifications', label: 'Modifications', required: false },
      ...COMMON_PARTY_FIELDS,
    ],
  },

  csa: {
    documentType: 'csa',
    displayName: 'Cloud Service Agreement',
    commonPaperUrl: 'https://commonpaper.com/standards/cloud-service-agreement/1.0/',
    templateFile: 'CSA.md',
    fields: [
      ...COMMON_FIELDS,
      { key: 'providerName', label: 'Provider', required: true },
      { key: 'customerName', label: 'Customer', required: true },
      { key: 'subscriptionPeriod', label: 'Subscription Period', required: true },
      { key: 'technicalSupport', label: 'Technical Support', required: true },
      { key: 'fees', label: 'Fees', required: true },
      { key: 'paymentTerms', label: 'Payment Terms', required: true },
    ],
  },

  'design-partner': {
    documentType: 'design-partner',
    displayName: 'Design Partner Agreement',
    commonPaperUrl: 'https://commonpaper.com/standards/design-partner-agreement/1.0/',
    templateFile: 'design-partner-agreement.md',
    fields: [
      ...COMMON_FIELDS,
      { key: 'programName', label: 'Program Name', required: true },
      { key: 'feedbackRequirements', label: 'Feedback Requirements', required: true },
      { key: 'accessPeriod', label: 'Access Period', required: true },
    ],
  },

  sla: {
    documentType: 'sla',
    displayName: 'Service Level Agreement',
    commonPaperUrl: 'https://commonpaper.com/standards/service-level-agreement/1.0/',
    templateFile: 'sla.md',
    fields: [
      ...COMMON_FIELDS,
      { key: 'uptimeTarget', label: 'Uptime Target', required: true },
      { key: 'responseTimeCommitment', label: 'Response Time Commitment', required: true },
      { key: 'serviceCredits', label: 'Service Credits', required: true },
    ],
  },

  psa: {
    documentType: 'psa',
    displayName: 'Professional Services Agreement',
    commonPaperUrl: 'https://commonpaper.com/standards/professional-services-agreement/1.0/',
    templateFile: 'psa.md',
    fields: [
      ...COMMON_FIELDS,
      { key: 'deliverables', label: 'Deliverables', required: true },
      { key: 'projectTimeline', label: 'Project Timeline', required: true },
      { key: 'paymentSchedule', label: 'Payment Schedule', required: true },
      { key: 'ipOwnership', label: 'IP Ownership', required: true },
    ],
  },

  dpa: {
    documentType: 'dpa',
    displayName: 'Data Processing Agreement',
    commonPaperUrl: 'https://commonpaper.com/standards/data-processing-agreement/1.0/',
    templateFile: 'DPA.md',
    fields: [
      ...COMMON_FIELDS,
      { key: 'dataSubjects', label: 'Data Subjects', required: true },
      { key: 'processingPurpose', label: 'Processing Purpose', required: true },
      { key: 'dataCategories', label: 'Data Categories', required: true },
      { key: 'subprocessors', label: 'Subprocessors', required: true },
    ],
  },

  'software-license': {
    documentType: 'software-license',
    displayName: 'Software License Agreement',
    commonPaperUrl: 'https://commonpaper.com/standards/software-license-agreement/1.0/',
    templateFile: 'Software-License-Agreement.md',
    fields: [
      ...COMMON_FIELDS,
      { key: 'licensedSoftware', label: 'Licensed Software', required: true },
      { key: 'licenseType', label: 'License Type', required: true },
      { key: 'licenseFees', label: 'License Fees', required: true },
      { key: 'supportTerms', label: 'Support Terms', required: true },
    ],
  },

  partnership: {
    documentType: 'partnership',
    displayName: 'Partnership Agreement',
    commonPaperUrl: 'https://commonpaper.com/standards/partnership-agreement/1.0/',
    templateFile: 'Partnership-Agreement.md',
    fields: [
      ...COMMON_FIELDS,
      { key: 'partnershipScope', label: 'Partnership Scope', required: true },
      { key: 'trademarkRights', label: 'Trademark Rights', required: true },
      { key: 'revenueShare', label: 'Revenue Share', required: true },
    ],
  },

  pilot: {
    documentType: 'pilot',
    displayName: 'Pilot Agreement',
    commonPaperUrl: 'https://commonpaper.com/standards/pilot-agreement/1.0/',
    templateFile: 'Pilot-Agreement.md',
    fields: [
      ...COMMON_FIELDS,
      { key: 'pilotPeriod', label: 'Pilot Period', required: true },
      { key: 'evaluationPurpose', label: 'Evaluation Purpose', required: true },
      { key: 'generalCapAmount', label: 'Liability Cap', required: true },
    ],
  },

  baa: {
    documentType: 'baa',
    displayName: 'Business Associate Agreement',
    commonPaperUrl: 'https://commonpaper.com/standards/business-associate-agreement/1.0/',
    templateFile: 'BAA.md',
    fields: [
      ...COMMON_FIELDS,
      { key: 'phiDescription', label: 'PHI Description', required: true },
      { key: 'permittedUses', label: 'Permitted Uses', required: true },
      { key: 'safeguards', label: 'Safeguards', required: true },
    ],
  },

  'ai-addendum': {
    documentType: 'ai-addendum',
    displayName: 'AI Addendum',
    commonPaperUrl: 'https://commonpaper.com/standards/ai-addendum/1.0/',
    templateFile: 'AI-Addendum.md',
    fields: [
      ...COMMON_FIELDS,
      { key: 'aiFeatures', label: 'AI Features', required: true },
      { key: 'trainingDataRights', label: 'Training Data Rights', required: true },
      { key: 'outputOwnership', label: 'Output Ownership', required: true },
    ],
  },
}

// ── State helpers ─────────────────────────────────────────────────────────────

export function mergeDocumentFields(
  current: DocumentFields,
  incoming: Partial<DocumentFields>,
): DocumentFields {
  const next = { ...current }
  for (const key of Object.keys(incoming) as (keyof DocumentFields)[]) {
    const value = incoming[key]
    if (value === null || value === undefined) continue
    if (key === 'party1' || key === 'party2') {
      const existing = (current[key] ?? {}) as Record<string, unknown>
      const patch = value as Record<string, unknown>
      const merged: Record<string, unknown> = { ...existing }
      for (const pk of Object.keys(patch)) {
        if (patch[pk] !== null && patch[pk] !== undefined) {
          merged[pk] = patch[pk]
        }
      }
      ;(next as Record<string, unknown>)[key] = merged
    } else {
      ;(next as Record<string, unknown>)[key] = value
    }
  }
  return next
}

export function missingRequiredDocumentFields(
  data: DocumentFields,
  docType: DocumentType,
): (keyof DocumentFields)[] {
  const config = DOCUMENT_REGISTRY[docType]
  return config.fields
    .filter((f) => f.required)
    .filter((f) => {
      if (f.isParty) {
        const party = data[f.key] as PartyInfo | undefined
        return !party?.name && !party?.company
      }
      return !data[f.key]
    })
    .map((f) => f.key)
}

// ── Cover page generation ─────────────────────────────────────────────────────

export function generateCoverPage(data: DocumentFields, docType: DocumentType): string {
  const config = DOCUMENT_REGISTRY[docType]
  const lines: string[] = []

  lines.push(`# ${config.displayName}`)
  lines.push('')
  lines.push(
    `Common Paper Standard Agreement · [Full Standard Terms](${config.commonPaperUrl})`,
  )
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## Cover Page')
  lines.push('')

  for (const { key, label, isParty, format } of config.fields) {
    if (isParty) continue
    const raw = data[key]
    if (raw === null || raw === undefined || raw === '') continue
    const display = format ? format(raw, data) : String(raw)
    lines.push(`### ${label}`)
    lines.push('')
    lines.push(escapeMarkdownText(display))
    lines.push('')
  }

  // Signature table
  const p1 = data.party1 ?? {}
  const p2 = data.party2 ?? {}
  lines.push('### Signatures')
  lines.push('')
  lines.push('|  | Party 1 | Party 2 |')
  lines.push('| :--- | :----: | :----: |')
  lines.push('| Signature |  |  |')
  lines.push(`| Print Name | ${escapePipe(p1.name)} | ${escapePipe(p2.name)} |`)
  lines.push(`| Title | ${escapePipe(p1.title)} | ${escapePipe(p2.title)} |`)
  lines.push(`| Company | ${escapePipe(p1.company)} | ${escapePipe(p2.company)} |`)
  lines.push(`| Notice Address | ${escapePipe(p1.noticeAddress)} | ${escapePipe(p2.noticeAddress)} |`)
  lines.push('| Date |  |  |')
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push(
    `Common Paper ${config.displayName} free to use under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).`,
  )

  return lines.join('\n')
}

// ── Full document generation ──────────────────────────────────────────────────

export function processTemplateContent(raw: string): string {
  // Strip <span> tags, keeping inner text (e.g. coverpage_link, header spans)
  const noSpans = raw.replace(/<span[^>]*>(.*?)<\/span>/g, '$1')
  // Trim first, then remove the template's own leading "# ..." heading; we add our own section header
  return noSpans.trim().replace(/^#\s+[^\n]*\n\n?/, '').trim()
}

export function generateDocument(
  data: DocumentFields,
  docType: DocumentType,
  templateContent: string,
): string {
  const config = DOCUMENT_REGISTRY[docType]
  const lines: string[] = []

  lines.push(`# ${config.displayName}`)
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## Cover Page')
  lines.push('')

  for (const { key, label, isParty, format } of config.fields) {
    if (isParty) continue
    const raw = data[key]
    if (raw === null || raw === undefined || raw === '') continue
    const display = format ? format(raw, data) : String(raw)
    lines.push(`### ${label}`)
    lines.push('')
    lines.push(escapeMarkdownText(display))
    lines.push('')
  }

  lines.push('---')
  lines.push('')
  lines.push('## Standard Terms')
  lines.push('')
  lines.push(processTemplateContent(templateContent))
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## Signatures')
  lines.push('')
  lines.push(
    `By signing this Cover Page, each party agrees to enter into this ${config.displayName} as of the Effective Date.`,
  )
  lines.push('')

  const p1 = data.party1 ?? {}
  const p2 = data.party2 ?? {}
  lines.push('|  | Party 1 | Party 2 |')
  lines.push('| :--- | :----: | :----: |')
  lines.push('| Signature |  |  |')
  lines.push(`| Print Name | ${escapePipe(p1.name)} | ${escapePipe(p2.name)} |`)
  lines.push(`| Title | ${escapePipe(p1.title)} | ${escapePipe(p2.title)} |`)
  lines.push(`| Company | ${escapePipe(p1.company)} | ${escapePipe(p2.company)} |`)
  lines.push(`| Notice Address | ${escapePipe(p1.noticeAddress)} | ${escapePipe(p2.noticeAddress)} |`)
  lines.push('| Date |  |  |')
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push(
    `Common Paper ${config.displayName} free to use under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).`,
  )

  return lines.join('\n')
}
