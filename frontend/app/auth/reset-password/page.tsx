'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const NAVY = '#032147'
const PURPLE = '#753991'
const PURPLE_DARK = '#5e2c75'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const t = params.get('token')
    if (!t) {
      setError('Invalid reset link. Please request a new one.')
    } else {
      setToken(t)
    }
  }, [])

  async function submit() {
    if (!token || !newPassword || !confirmPassword || loading) return
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please re-type.')
      return
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: newPassword }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(body.detail ?? 'Reset failed. The link may have expired.')
        return
      }
      setSuccess(true)
      setTimeout(() => router.replace('/auth'), 3000)
    } catch {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') submit()
  }

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
              Choose a new password
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Enter your new password below.
            </p>

            {success ? (
              <div className="rounded-md bg-green-50 border border-green-200 px-3 py-3 text-sm text-green-700">
                Password updated! Redirecting you to sign in…
              </div>
            ) : (
              <div className="space-y-4" onKeyDown={handleKeyDown}>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    disabled={!token}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Re-type New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={!token}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50"
                  />
                </div>

                {error && (
                  <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <button
                  type="button"
                  onClick={submit}
                  disabled={loading || !token || !newPassword || !confirmPassword}
                  className="w-full py-2.5 text-sm font-semibold text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  style={{ backgroundColor: PURPLE }}
                  onMouseEnter={(e) =>
                    !loading && (e.currentTarget.style.backgroundColor = PURPLE_DARK)
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = PURPLE)
                  }
                >
                  {loading ? 'Please wait…' : 'Update Password'}
                </button>

                <button
                  type="button"
                  onClick={() => router.replace('/auth')}
                  className="w-full text-center text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Back to Sign In
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
