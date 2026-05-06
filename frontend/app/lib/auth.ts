const TOKEN_KEY = 'prelegal_jwt'
const EMAIL_KEY = 'prelegal_email'

function storage(): Storage | null {
  return typeof window !== 'undefined' ? window.sessionStorage : null
}

export function setToken(token: string, email: string): void {
  const s = storage()
  if (!s) return
  s.setItem(TOKEN_KEY, token)
  s.setItem(EMAIL_KEY, email)
}

export function getToken(): string | null {
  return storage()?.getItem(TOKEN_KEY) ?? null
}

export function getEmail(): string | null {
  return storage()?.getItem(EMAIL_KEY) ?? null
}

export function clearToken(): void {
  const s = storage()
  if (!s) return
  s.removeItem(TOKEN_KEY)
  s.removeItem(EMAIL_KEY)
}

export async function authFetch(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = getToken()
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(input, { ...init, headers })
  if (res.status === 401) {
    clearToken()
    window.location.replace('/auth')
    throw new Error('Session expired')
  }
  return res
}
