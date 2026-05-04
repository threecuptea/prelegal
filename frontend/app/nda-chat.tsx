'use client'

import { useEffect, useRef, useState } from 'react'
import {
  CONFIDENTIALITY_OPTIONS,
  MNDA_TERM_OPTIONS,
  type NDAData,
  clampYears,
  formatDate,
} from './lib/nda-document'
import {
  type ChatMessage,
  type FieldUpdates,
  mergeFieldUpdates,
  missingRequiredFields,
} from './lib/nda-chat-helpers'
import { NDAPreview, downloadMarkdown } from './nda-preview'

let _msgIdSeq = 0
const nextMessageId = () => `m${++_msgIdSeq}`

interface UIMessage extends ChatMessage {
  id: string
}

// Common Paper / Prelegal brand purple — used for primary submit actions
// (per CLAUDE.md color scheme: "Purple Secondary: #753991 (submit buttons)").
const PURPLE = '#753991'
const PURPLE_DARK = '#5e2c75'

const todayISO = () => new Date().toISOString().split('T')[0]

const buildDefaults = (): NDAData => ({
  purpose: '',
  effectiveDate: todayISO(),
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
})

const buildGreeting = (): UIMessage => ({
  id: nextMessageId(),
  role: 'assistant',
  content:
    "Hi! I'll help you draft a Common Paper Mutual NDA. Let's start simple — what's the purpose of the relationship between the two parties (e.g., evaluating a partnership, exploring a vendor engagement)?",
})

interface ChatApiResponse {
  reply: string
  field_updates: FieldUpdates
  done: boolean
}

const FIELD_ORDER: { key: keyof NDAData; label: string; format?: (v: string, d: NDAData) => string }[] = [
  { key: 'purpose', label: 'Purpose' },
  { key: 'effectiveDate', label: 'Effective Date', format: (v) => formatDate(v) },
  {
    key: 'mndaTerm',
    label: 'MNDA Term',
    format: (v, d) => {
      const opt = MNDA_TERM_OPTIONS.find((o) => o.id === v)
      return opt ? opt.label(clampYears(d.mndaTermYears)) : v
    },
  },
  {
    key: 'termOfConfidentiality',
    label: 'Term of Confidentiality',
    format: (v, d) => {
      const opt = CONFIDENTIALITY_OPTIONS.find((o) => o.id === v)
      return opt ? opt.label(clampYears(d.termOfConfidentialityYears)) : v
    },
  },
  { key: 'governingLaw', label: 'Governing Law' },
  { key: 'jurisdiction', label: 'Jurisdiction' },
  { key: 'modifications', label: 'Modifications' },
  { key: 'party1Name', label: 'Party 1 — Name' },
  { key: 'party1Title', label: 'Party 1 — Title' },
  { key: 'party1Company', label: 'Party 1 — Company' },
  { key: 'party1Address', label: 'Party 1 — Notice Address' },
  { key: 'party2Name', label: 'Party 2 — Name' },
  { key: 'party2Title', label: 'Party 2 — Title' },
  { key: 'party2Company', label: 'Party 2 — Company' },
  { key: 'party2Address', label: 'Party 2 — Notice Address' },
]

function FieldSummary({ data }: { data: NDAData }) {
  const missing = missingRequiredFields(data)
  return (
    <details open className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <summary className="cursor-pointer select-none px-4 py-3 font-semibold text-gray-800 flex items-center justify-between">
        <span>Field Summary</span>
        <span className="text-xs font-normal text-gray-500">
          {missing.length === 0 ? 'All required fields filled' : `${missing.length} required field(s) missing`}
        </span>
      </summary>
      <div className="px-4 pb-4 pt-1 text-sm">
        <dl className="divide-y divide-gray-100">
          {FIELD_ORDER.map(({ key, label, format }) => {
            const raw = data[key]
            const display = raw ? (format ? format(raw, data) : raw) : ''
            return (
              <div key={key} className="grid grid-cols-3 gap-3 py-1.5">
                <dt className="text-gray-500 col-span-1">{label}</dt>
                <dd className="text-gray-900 col-span-2 break-words">
                  {display || <span className="text-gray-300 italic">(empty)</span>}
                </dd>
              </div>
            )
          })}
        </dl>
      </div>
    </details>
  )
}

function ChatPanel({
  messages,
  input,
  setInput,
  isSending,
  onSend,
  onReset,
  done,
}: {
  messages: UIMessage[]
  input: string
  setInput: (s: string) => void
  isSending: boolean
  onSend: () => void
  onReset: () => void
  done: boolean
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

  return (
    <div className="flex flex-col bg-white rounded-lg border border-gray-200 shadow-sm h-[calc(100vh-7rem)]">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-800">AI Chat</h2>
          <p className="text-xs text-gray-500">
            Drafting a Mutual NDA{done ? ' · finalized' : ''}
          </p>
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

export default function NDAChat() {
  const [data, setData] = useState<NDAData>(buildDefaults)
  const [messages, setMessages] = useState<UIMessage[]>(() => [buildGreeting()])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Tracks the currently in-flight request so reset/unmount can cancel it and
  // ignore late responses. Bumping `requestSeq` invalidates older fetches.
  const abortRef = useRef<AbortController | null>(null)
  const requestSeq = useRef(0)

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

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
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
          fields: data,
        }),
        signal: controller.signal,
      })
      if (!res.ok) {
        throw new Error(`Chat failed: ${res.status}`)
      }
      const body = (await res.json()) as ChatApiResponse
      if (seq !== requestSeq.current) return // stale (reset or newer send raced us)
      setData((prev) => mergeFieldUpdates(prev, body.field_updates ?? {}))
      setMessages((prev) => [
        ...prev,
        { id: nextMessageId(), role: 'assistant', content: body.reply },
      ])
      setDone(Boolean(body.done))
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

  function reset() {
    abortRef.current?.abort()
    requestSeq.current++
    setData(buildDefaults())
    setMessages([buildGreeting()])
    setInput('')
    setIsSending(false)
    setDone(false)
    setError(null)
  }

  const canDownload = done || missingRequiredFields(data).length === 0

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="no-print bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
        <h1 className="text-lg font-bold text-gray-900 flex-1">Mutual NDA — AI Chat</h1>
        <button
          type="button"
          onClick={() => downloadMarkdown(data)}
          disabled={!canDownload}
          className="px-4 py-2 text-sm font-medium text-white rounded-md disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ backgroundColor: PURPLE }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = PURPLE_DARK)}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = PURPLE)}
        >
          Download .md
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          disabled={!canDownload}
          className="px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-md hover:bg-gray-900 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Print / Save PDF
        </button>
      </header>

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
            done={done}
          />
        </div>
        <div className="space-y-6">
          <div className="no-print">
            <FieldSummary data={data} />
          </div>
          <NDAPreview data={data} />
        </div>
      </main>
    </div>
  )
}
