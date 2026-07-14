/**
 * Tiny fetch wrapper for the TailorsFlow backend.
 *
 * - Prefixes VITE_API_BASE_URL.
 * - Attaches the current Firebase user's ID token as `Authorization: Bearer …`.
 * - Unwraps the backend's `{ success, data, message, errors }` envelope, returning
 *   `data` on success and throwing `ApiError(message)` on failure.
 */
import { auth } from './firebase'

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

// Tells the shared backend which product this request comes from. The identity/wallet are
// shared with tailoredflow, but platform-scoped behaviour (multiple sender IDs, Sendr
// pricing) keys off this — so a dual account still gets Sendr behaviour here.
const WEB_PLATFORM = 'sendrbulksms'

export class ApiError extends Error {
  status: number
  errors: string[]
  constructor(message: string, status: number, errors: string[] = []) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
  }
}

interface ApiEnvelope<T> {
  success: boolean
  data?: T
  message?: string
  errors?: string[]
}

async function authHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser
  if (!user) return {}
  const token = await user.getIdToken()
  return { Authorization: `Bearer ${token}` }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'X-Web-Platform': WEB_PLATFORM, ...(await authHeaders()) }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  let envelope: ApiEnvelope<T> | null = null
  try {
    envelope = (await res.json()) as ApiEnvelope<T>
  } catch {
    // Non-JSON response (e.g. a proxy 502 HTML page) — fall through to a status error.
  }

  if (!res.ok || (envelope && envelope.success === false)) {
    const message = envelope?.message || `Request failed (${res.status})`
    throw new ApiError(message, res.status, envelope?.errors ?? [])
  }

  return envelope?.data as T
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
}
