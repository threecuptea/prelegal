export async function authFetch(
  input: string,
  init: RequestInit = {},
  getToken: () => Promise<string | null>,
): Promise<Response> {
  const token = await getToken()
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(input, { ...init, headers })
  if (res.status === 401 || res.status === 403) {
    window.location.replace('/auth')
    throw new Error('Session expired')
  }
  return res
}
