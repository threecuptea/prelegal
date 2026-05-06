'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  DOCUMENT_REGISTRY,
  mergeDocumentFields,
  missingRequiredDocumentFields,
  type ChatResponse,
  type DocumentFields,
  type DocumentType,
  type PartyInfo,
} from './lib/document-types'
import { DocumentPreview, downloadMarkdown } from './document-preview'
import { authFetch, getToken } from './lib/auth'
import AppHeader from './components/app-header'
import DisclaimerBanner from './components/disclaimer-banner'

let _msgIdSeq = 0
const nextMessageId = () => `m${++_msgIdSeq}`

interface UIMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const PURPLE = '#753991'
const PURPLE_DARK = '#5e2c75'

const buildGreeting = (): UIMessage => ({
  id: nextMessageId(),
  role: 'assistant',
  content:
    "Hi! I can help you draft any Common Paper legal agreement — a Mutual NDA, Cloud Service Agreement, Data Processing Agreement, and more. What kind of agreement do you need today?",
})

// ── FieldSummary ──────────────────────────────────────────────────────────────

function PartySubRows({ label, party }: { label: string; party?: PartyInfo }) {
  const subFields: [string, string | undefined][] = [
    ['Name', party?.name],
    ['Title', party?.title],
    ['Company', party?.company],
    ['Address', party?.noticeAddress],
  ]
  return (
    <>
      {subFields.map(([sub, val]) => (
        <div key={sub} className="grid grid-cols-3 gap-3 py-1.5">
          <dt className="text-gray-400 col-span-1 text-xs">
            {label} — {sub}
          </dt>
          <dd className="text-gray-900 col-span-2 break-words text-xs">
            {val || <span className="text-gray-300 italic">(empty)</span>}
          </dd>
        </div>
      ))}
    </>
  )
}

function FieldSummary({
  data,
  documentType,
}: {
  data: DocumentFields
  documentType: DocumentType | null
}) {
  if (!documentType) {
    return (
      <details open className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <summary className="cursor-pointer select-none px-4 py-3 font-semibold text-gray-800">
          Field Summary
        </summary>
        <p className="px-4 pb-4 pt-1 text-sm text-gray-400 italic">
          Document type not yet identified — start chatting to begin.
        </p>
      </details>
    )
  }

  const config = DOCUMENT_REGISTRY[documentType]
  const missing = missingRequiredDocumentFields(data, documentType)

  return (
    <details open className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <summary className="cursor-pointer select-none px-4 py-3 font-semibold text-gray-800 flex items-center justify-between">
        <span>Field Summary — {config.displayName}</span>
        <span className="text-xs font-normal text-gray-500">
          {missing.length === 0
            ? 'All required fields filled'
            : `${missing.length} required field(s) missing`}
        </span>
      </summary>
      <div className="px-4 pb-4 pt-1 text-sm">
        <dl className="divide-y divide-gray-100">
          {config.fields.map((f) => {
            if (f.isParty) {
              const party = data[f.key] as PartyInfo | undefined
              return (
                <div key={f.key} className="py-1">
                  <PartySubRows label={f.label} party={party} />
                </div>
              )
            }
            const raw = data[f.key]
            const display =
              raw != null && raw !== ''
                ? f.format
                  ? f.format(raw, data)
                  : String(raw)
                : null
            return (
              <div key={f.key} className="grid grid-cols-3 gap-3 py-1.5">
                <dt className="text-gray-500 col-span-1">{f.label}</dt>
                <dd className="text-gray-900 col-span-2 break-words">
                  {display ?? <span className="text-gray-300 italic">(empty)</span>}
                </dd>
              </div>
            )
          })}
        </dl>
      </div>
    </details>
  )
}

// ── ChatPanel ─────────────────────────────────────────────────────────────────

function ChatPanel({
  messages,
  input,
  setInput,
  isSending,
  onSend,
  onReset,
  isComplete,
  documentType,
}: {
  messages: UIMessage[]
  input: string
  setInput: (s: string) => void
  isSending: boolean
  onSend: () => void
  onReset: () => void
  isComplete: boolean
  documentType: DocumentType | null
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, isSending])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!isSending && input.trim()) onSend()
    }
  }

  const subtitle = documentType
    ? `Drafting a ${DOCUMENT_REGISTRY[documentType].displayName}${isComplete ? ' · finalized' : ''}`
    : 'Tell me what agreement you need'

  return (
    <div className="flex flex-col bg-white rounded-lg border border-gray-200 shadow-sm h-[calc(100vh-11rem)]">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-800">AI Chat</h2>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Start over
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
          >
            <div
              className={
                m.role === 'user'
                  ? 'max-w-[85%] rounded-2xl rounded-br-sm text-white px-4 py-2 text-sm whitespace-pre-wrap'
                  : 'max-w-[85%] rounded-2xl rounded-bl-sm bg-gray-100 text-gray-900 px-4 py-2 text-sm whitespace-pre-wrap'
              }
              style={m.role === 'user' ? { backgroundColor: PURPLE } : undefined}
            >
              {m.content}
            </div>
          </div>
        ))}
        {isSending && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-gray-100 text-gray-500 px-4 py-2 text-sm italic">
              Thinking…
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 p-3">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your reply…"
            rows={2}
            disabled={isSending}
            className="flex-1 resize-none rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50"
          />
          <button
            type="button"
            onClick={onSend}
            disabled={isSending || !input.trim()}
            className="self-stretch px-4 text-sm font-semibold text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: PURPLE }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = PURPLE_DARK)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = PURPLE)}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Chat() {
  const router = useRouter()
  const [data, setData] = useState<DocumentFields>({})
  const [documentType, setDocumentType] = useState<DocumentType | null>(null)
  const [templateContent, setTemplateContent] = useState<string | null>(null)
  const [messages, setMessages] = useState<UIMessage[]>(() => [buildGreeting()])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedDocId, setSavedDocId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveToast, setSaveToast] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const requestSeq = useRef(0)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auth guard + docId hydration (runs once on mount)
  useEffect(() => {
    const token = getToken()
    if (!token) {
      router.replace('/auth')
      return
    }
    const params = new URLSearchParams(window.location.search)
    const docId = params.get('docId')
    if (!docId) return
    const numId = parseInt(docId, 10)
    if (isNaN(numId)) return
    setSavedDocId(numId)
    authFetch(`/api/documents/${numId}`)
      .then(async (res) => {
        if (!res.ok) return
        const doc = await res.json()
        setData((doc.fields as DocumentFields) ?? {})
        if (doc.document_type) setDocumentType(doc.document_type as DocumentType)
      })
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      if (toastTimer.current) clearTimeout(toastTimer.current)
    }
  }, [])

  // Fetch standard terms template whenever the document type is identified
  useEffect(() => {
    if (!documentType) return
    let cancelled = false
    const { templateFile } = DOCUMENT_REGISTRY[documentType]
    setTemplateContent(null)
    fetch(`/templates/${templateFile}`)
      .then((res) => (res.ok ? res.text() : Promise.reject(res.status)))
      .then((text) => { if (!cancelled) setTemplateContent(text) })
      .catch(() => { if (!cancelled) setTemplateContent('') }) // '' = failed; download falls back to cover page only
    return () => { cancelled = true }
  }, [documentType])

  async function send() {
    const text = input.trim()
    if (!text || isSending) return
    setError(null)

    const userMsg: UIMessage = { id: nextMessageId(), role: 'user', content: text }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput('')
    setIsSending(true)

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const seq = ++requestSeq.current

    try {
      const res = await authFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
          fields: data,
        }),
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(`Chat failed: ${res.status}`)

      const body = (await res.json()) as ChatResponse
      if (seq !== requestSeq.current) return

      const {
        response: replyText,
        isComplete: complete,
        documentType: detected,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        suggestedDocument: _suggested,
        ...fieldUpdates
      } = body

      setData((prev) => mergeDocumentFields(prev, fieldUpdates))
      if (detected) setDocumentType(detected)
      setIsComplete(complete)
      setMessages((prev) => [
        ...prev,
        {
          id: nextMessageId(),
          role: 'assistant',
          content: replyText || "Got it — what else would you like to add or change?",
        },
      ])
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      if (seq !== requestSeq.current) return
      const msg = e instanceof Error ? e.message : 'Something went wrong'
      setError(msg)
      setMessages((prev) => [
        ...prev,
        {
          id: nextMessageId(),
          role: 'assistant',
          content: `Sorry — I hit an error (${msg}). Want to try that again?`,
        },
      ])
    } finally {
      if (seq === requestSeq.current) setIsSending(false)
    }
  }

  async function saveDocument(): Promise<boolean> {
    if (!documentType) return false
    const token = getToken()
    if (!token) {
      router.replace('/auth')
      return false
    }
    const title = `${DOCUMENT_REGISTRY[documentType].displayName} Draft`
    setSaving(true)
    try {
      let ok = false
      if (savedDocId === null) {
        const res = await authFetch('/api/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, document_type: documentType, fields: data }),
        })
        if (res.ok) {
          const doc = await res.json()
          setSavedDocId(doc.id)
          window.history.replaceState({}, '', `?docId=${doc.id}`)
          ok = true
        } else {
          setError('Save failed — please try again.')
        }
      } else {
        const res = await authFetch(`/api/documents/${savedDocId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, fields: data }),
        })
        if (res.ok) {
          ok = true
        } else {
          setError('Save failed — please try again.')
        }
      }
      if (ok) {
        setSaveToast(true)
        if (toastTimer.current) clearTimeout(toastTimer.current)
        toastTimer.current = setTimeout(() => setSaveToast(false), 2000)
      }
      return ok
    } catch (e) {
      if (!(e instanceof Error && e.message === 'Session expired')) {
        setError('Save failed — please try again.')
      }
      return false
    } finally {
      setSaving(false)
    }
  }

  async function saveAndPrint() {
    const ok = await saveDocument()
    if (ok) window.print()
  }

  function reset() {
    abortRef.current?.abort()
    requestSeq.current++
    setData({})
    setDocumentType(null)
    setTemplateContent(null)
    setSavedDocId(null)
    setMessages([buildGreeting()])
    setInput('')
    setIsSending(false)
    setIsComplete(false)
    setError(null)
    window.history.replaceState({}, '', '/')
  }

  const canDownload =
    documentType !== null &&
    (isComplete || missingRequiredDocumentFields(data, documentType).length === 0)

  const headerTitle = documentType
    ? `${DOCUMENT_REGISTRY[documentType].displayName} — AI Chat`
    : 'Legal Document — AI Chat'

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <DisclaimerBanner />

      <div className="no-print bg-white border-b border-gray-200 px-6 py-2 flex items-center gap-2">
        <h1 className="text-base font-semibold text-[#032147] flex-1 truncate">
          {headerTitle}
        </h1>
        {saveToast && (
          <span className="text-xs text-green-600 font-medium">Saved ✓</span>
        )}
        <button
          type="button"
          onClick={() => documentType && downloadMarkdown(data, documentType, templateContent ?? undefined)}
          disabled={!canDownload}
          className="px-3 py-1.5 text-xs font-medium text-white rounded-md disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ backgroundColor: PURPLE }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = PURPLE_DARK)}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = PURPLE)}
        >
          Download .md
        </button>
        <button
          type="button"
          onClick={saveAndPrint}
          disabled={!isComplete || saving}
          className="px-3 py-1.5 text-xs font-medium text-white bg-gray-800 rounded-md hover:bg-gray-900 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Save & Print PDF'}
        </button>
      </div>

      {error && (
        <div className="no-print bg-red-50 border-b border-red-200 text-red-800 text-sm px-6 py-2">
          {error}
        </div>
      )}

      <main className="grid lg:grid-cols-2 gap-6 p-6 print:block print:p-0">
        <div className="no-print">
          <ChatPanel
            messages={messages}
            input={input}
            setInput={setInput}
            isSending={isSending}
            onSend={send}
            onReset={reset}
            isComplete={isComplete}
            documentType={documentType}
          />
        </div>
        <div className="space-y-6">
          <div className="no-print">
            <FieldSummary data={data} documentType={documentType} />
          </div>
          <DocumentPreview
            data={data}
            documentType={documentType}
            templateContent={templateContent ?? undefined}
          />
        </div>
      </main>
    </div>
  )
}
