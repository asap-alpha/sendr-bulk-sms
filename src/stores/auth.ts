import { computed, reactive } from 'vue'

/**
 * Mock auth store (module singleton). Persists a fake session to localStorage
 * so a refresh keeps you logged in. Swap login/signup for real API calls at
 * the backend seam — the rest of the app only depends on `isAuthenticated`
 * and `user`.
 */
export interface User {
  name: string
  email: string
  provider: 'password' | 'google'
}

const STORAGE_KEY = 'sendr.auth'

function load(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

const state = reactive<{ user: User | null }>({ user: load() })

export function useAuth() {
  const isAuthenticated = computed(() => state.user !== null)

  function persist(user: User) {
    state.user = user
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
  }

  function nameFromEmail(email: string) {
    const local = email.split('@')[0].replace(/[._-]/g, ' ') || 'there'
    return local.replace(/\b\w/g, (c) => c.toUpperCase())
  }

  async function login(email: string, _password: string) {
    // Mock: accept any credentials.
    await new Promise((r) => setTimeout(r, 600))
    persist({ name: nameFromEmail(email), email, provider: 'password' })
  }

  async function signup(name: string, email: string, _password: string) {
    await new Promise((r) => setTimeout(r, 600))
    persist({ name, email, provider: 'password' })
  }

  /**
   * Mock Google sign-in. In production, replace with Google Identity Services:
   * load the GIS client, render/trigger the button, exchange the returned ID
   * token with the backend, and persist the real profile. For now we simulate
   * the account picker returning a demo Google account.
   */
  async function loginWithGoogle() {
    await new Promise((r) => setTimeout(r, 700))
    persist({ name: 'Demo User', email: 'demo.user@gmail.com', provider: 'google' })
  }

  function logout() {
    state.user = null
    localStorage.removeItem(STORAGE_KEY)
  }

  return {
    user: computed(() => state.user),
    isAuthenticated,
    login,
    signup,
    loginWithGoogle,
    logout,
  }
}
