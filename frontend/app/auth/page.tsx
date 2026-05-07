'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getToken, setToken } from '../lib/auth'

const NAVY = '#032147'
const PURPLE = '#753991'
const PURPLE_DARK = '#5e2c75'

type Tab = 'signin' | 'signup' | 'forgot'

export default function AuthPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (getToken()) router.replace('/')
  }, [router])

  async function submit() {
    if (tab === 'forgot') {
      await submitForgot()
      return
    }
    if (!email || !password || loading) return
    setError(null)
    setLoading(true)
    try {
      const endpoint = tab === 'signin' ? '/api/auth/signin' : '/api/auth/signup'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        if (res.status === 423) {
          setError('Account locked due to too many failed login attempts.')
        } else if (res.status === 409) {
          setError('An account with this email already exists.')
        } else if (res.status === 422) {
          setError('Password must be at least 8 characters.')
        } else {
          setError(body.detail ?? 'Invalid credentials.')
        }
        return
      }
      const body = await res.json()
      setToken(body.access_token, body.email)
      router.replace('/')
    } catch {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function submitForgot() {
    if (!email || loading) return
    setError(null)
    setInfo(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(body.detail ?? 'Something went wrong. Please try again.')
        return
      }
      setInfo(body.message)
    } catch {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') submit()
  }

  function switchTab(t: Tab) {
    setTab(t)
    setError(null)
    setInfo(null)
    setPassword('')
  }

  const isForgot = tab === 'forgot'

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-xl font-bold" style={{ color: NAVY }}>
          Prelegal
        </h1>
        <p className="text-sm text-gray-500">AI-powered legal document drafting</p>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
            <h2 className="text-xl font-bold mb-1" style={{ color: NAVY }}>
              {isForgot ? 'Reset password' : tab === 'signin' ? 'Sign in' : 'Create account'}
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              {isForgot
                ? "Enter your email and we'll send you a reset link."
                : tab === 'signin'
                  ? 'Welcome back. Sign in to access your documents.'
                  : 'Start drafting legal agreements with AI.'}
            </p>

            {!isForgot && (
              <div className="flex mb-6 rounded-lg overflow-hidden border border-gray-200">
                {(['signin', 'signup'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`flex-1 py-2 text-sm font-medium transition-colors ${
                      tab === t ? 'text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                    style={tab === t ? { backgroundColor: PURPLE } : {}}
                    onClick={() => switchTab(t)}
                  >
                    {t === 'signin' ? 'Sign In' : 'Sign Up'}
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-4" onKeyDown={handleKeyDown}>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {!isForgot && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={tab === 'signup' ? 'Min. 8 characters' : '••••••••'}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}

              {error && (
                <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              {info && (
                <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
                  {info}
                </div>
              )}

              <button
                type="button"
                onClick={submit}
                disabled={loading || !email || (!isForgot && !password)}
                className="w-full py-2.5 text-sm font-semibold text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                style={{ backgroundColor: PURPLE }}
                onMouseEnter={(e) =>
                  !loading && (e.currentTarget.style.backgroundColor = PURPLE_DARK)
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = PURPLE)
                }
              >
                {loading
                  ? 'Please wait…'
                  : isForgot
                    ? 'Send Reset Link'
                    : tab === 'signin'
                      ? 'Sign In'
                      : 'Create Account'}
              </button>

              {tab === 'signin' && (
                <button
                  type="button"
                  onClick={() => switchTab('forgot')}
                  className="w-full text-center text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Forgot password?
                </button>
              )}

              {isForgot && (
                <button
                  type="button"
                  onClick={() => switchTab('signin')}
                  className="w-full text-center text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Back to Sign In
                </button>
              )}
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-gray-400 px-4 leading-relaxed">
            Documents generated by this tool are considered drafts and are
            subject to legal review before use.
          </p>
        </div>
      </main>
    </div>
  )
}
