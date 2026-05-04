import type { NDAData } from './nda-document'

export type FieldUpdates = Partial<NDAData>

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// Required fields that must be filled before the document is "complete".
// `modifications` is intentionally optional.
export const REQUIRED_FIELDS: (keyof NDAData)[] = [
  'purpose',
  'effectiveDate',
  'mndaTerm',
  'termOfConfidentiality',
  'governingLaw',
  'jurisdiction',
  'party1Name',
  'party1Title',
  'party1Company',
  'party1Address',
  'party2Name',
  'party2Title',
  'party2Company',
  'party2Address',
]

// Apply only the keys the AI actually returned. null/undefined are dropped so
// a partial response can never wipe a previously captured field. Empty strings
// ARE honored so the user can clear an optional field (e.g. modifications).
export function mergeFieldUpdates(current: NDAData, updates: FieldUpdates): NDAData {
  const next = { ...current }
  for (const key of Object.keys(updates) as (keyof NDAData)[]) {
    const value = updates[key]
    if (value === null || value === undefined) continue
    ;(next as Record<keyof NDAData, NDAData[keyof NDAData]>)[key] = value as NDAData[keyof NDAData]
  }
  return next
}

export function missingRequiredFields(data: NDAData): (keyof NDAData)[] {
  return REQUIRED_FIELDS.filter((k) => !data[k])
}
