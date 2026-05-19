'use client'

import Link from 'next/link'
import { useUser, SignOutButton } from '@clerk/clerk-react'

const NAVY = '#032147'

export default function AppHeader() {
  const { user } = useUser()
  const email = user?.primaryEmailAddress?.emailAddress ?? null

  return (
    <header className="no-print bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4">
      <Link href="/" className="text-lg font-bold shrink-0" style={{ color: NAVY }}>
        Prelegal
      </Link>
      <span className="flex-1" />
      {email && (
        <span className="text-xs text-gray-500 hidden sm:block truncate max-w-[200px]">
          {email}
        </span>
      )}
      <Link
        href="/documents"
        className="text-sm font-medium text-gray-600 hover:text-gray-900 shrink-0"
      >
        My Documents
      </Link>
      <SignOutButton redirectUrl="/auth">
        <button
          type="button"
          className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 shrink-0"
        >
          Sign Out
        </button>
      </SignOutButton>
    </header>
  )
}
