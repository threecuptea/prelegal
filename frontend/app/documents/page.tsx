'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { clearToken, getToken } from '../lib/auth'
import AppHeader from '../components/app-header'
import DisclaimerBanner from '../components/disclaimer-banner'

const NAVY = '#032147'
const PURPLE = '#753991'
const PURPLE_DARK = '#5e2c75'

interface DocumentSummary {
  id: number
  title: string
  document_type: string
  created_at: string
  updated_at: string
}

function formatDate(dt: string): string {
  // SQLite returns "YYYY-MM-DD HH:MM:SS" — replace space with T for ISO 8601
  return new Date(dt.replace(' ', 'T') + 'Z').toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function DocumentsPage() {
  const router = useRouter()
  const [docs, setDocs] = useState<DocumentSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = getToken()
    if (!token) {
      router.replace('/auth')
      return
    }
    fetch('/api/documents', { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        if (res.status === 401) {
          clearToken()
          router.replace('/auth')
          return
        }
        if (!res.ok) throw new Error('Failed to load documents')
        setDocs(await res.json())
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [router])

  async function deleteDoc(id: number) {
    const token = getToken()
    if (!token || !confirm('Delete this document? This cannot be undone.')) return
    const res = await fetch(`/api/documents/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok || res.status === 204) {
      setDocs((prev) => prev.filter((d) => d.id !== id))
    }
  }

  function loadDoc(id: number) {
    router.push(`/?docId=${id}`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <DisclaimerBanner />

      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold" style={{ color: NAVY }}>
            My Documents
          </h2>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="px-4 py-2 text-sm font-semibold text-white rounded-md"
            style={{ backgroundColor: PURPLE }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = PURPLE_DARK)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = PURPLE)}
          >
            + New Document
          </button>
        </div>

        {loading && (
          <p className="text-sm text-gray-400 italic text-center py-12">Loading…</p>
        )}

        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && docs.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-16 text-center">
            <p className="text-gray-400 text-sm mb-5">No saved documents yet.</p>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="px-5 py-2.5 text-sm font-semibold text-white rounded-md"
              style={{ backgroundColor: PURPLE }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = PURPLE_DARK)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = PURPLE)}
            >
              Start drafting
            </button>
          </div>
        )}

        {!loading && !error && docs.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden divide-y divide-gray-100">
            {docs.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="min-w-0 mr-4">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {doc.title}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {doc.document_type.replace(/-/g, ' ')} ·{' '}
                    Updated {formatDate(doc.updated_at)}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => loadDoc(doc.id)}
                    className="px-3 py-1.5 text-xs font-semibold text-white rounded-md"
                    style={{ backgroundColor: PURPLE }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor = PURPLE_DARK)
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = PURPLE)
                    }
                  >
                    Load
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteDoc(doc.id)}
                    className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
