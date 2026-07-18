import { computed, reactive } from 'vue'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth'
import { auth, googleProvider } from '@/lib/firebase'
import { api } from '@/lib/api'
import { resetSenderIds } from '@/stores/senderIds'

/**
 * Auth store (module singleton), backed by Firebase Auth.
 *
 * Email/password and Google both authenticate via Firebase; the resulting ID token is
 * attached to every backend call by `lib/api`. After sign-in we call the backend's
 * idempotent `register-sendr` endpoint, which creates the Sendr (sourceApp=sendrbulksms)
 * profile on first login and returns the existing one afterwards.
 */
export interface User {
  name: string
  email: string
  provider: 'password' | 'google'
  emailVerified: boolean
}

// Shape of the backend UserProfileResponse fields we use.
interface SendrProfile {
  uid: string
  name: string
  email: string
  businessName: string
}

const state = reactive<{ user: User | null; ready: boolean }>({ user: null, ready: false })

// Resolves once Firebase has restored (or ruled out) a session on first load, so the
// router guard doesn't bounce a signed-in user to /login during the async restore.
let markReady: () => void
const readyPromise = new Promise<void>((resolve) => {
  markReady = resolve
})
export function authReady(): Promise<void> {
  return readyPromise
}

function nameFromEmail(email: string): string {
  const local = email.split('@')[0].replace(/[._-]/g, ' ') || 'there'
  return local.replace(/\b\w/g, (c) => c.toUpperCase())
}

function providerOf(fbUser: FirebaseUser): 'password' | 'google' {
  return fbUser.providerData.some((p) => p.providerId === 'google.com') ? 'google' : 'password'
}

/**
 * Ensure a Sendr profile exists for this Firebase user and map it to our User shape.
 * `nameOverride` lets the signup flow pass the just-typed name directly, so we never
 * depend on Firebase's `displayName` having propagated yet (register-sendr is idempotent
 * and won't rename an existing account, so the FIRST call must carry the real name).
 */
async function ensureProfile(fbUser: FirebaseUser, nameOverride?: string): Promise<User> {
  const name = nameOverride?.trim() || fbUser.displayName || nameFromEmail(fbUser.email ?? '')
  const profile = await api.post<SendrProfile>('/api/users/register-sendr', {
    name,
    email: fbUser.email ?? '',
    photoURL: fbUser.photoURL ?? undefined,
  })
  return {
    name: profile.name || profile.businessName || name,
    email: profile.email || fbUser.email || '',
    provider: providerOf(fbUser),
    emailVerified: fbUser.emailVerified,
  }
}

// True while an explicit login/signup/google flow is running. Suppresses the restore
// listener below so it can't race that flow and POST register-sendr before the flow has
// set the displayName (which would persist an email-derived name) or fire a duplicate
// registration. The explicit flow sets `state.user` itself.
let bootstrapping = false

// Session restore + external sign-out. Runs once on load. Explicit login/signup below
// set `state.user` themselves (so navigation is deterministic), so this only ensures the
// profile when we don't already have one and no explicit flow is in flight — i.e. the
// page-refresh restore path.
onAuthStateChanged(auth, async (fbUser) => {
  try {
    if (fbUser && !state.user && !bootstrapping) {
      state.user = await ensureProfile(fbUser)
    } else if (!fbUser) {
      state.user = null
      resetSenderIds()
    }
  } catch {
    // If we can't confirm the profile, treat the session as signed-out rather than
    // leaving a half-authenticated state that would fail every API call.
    state.user = null
  } finally {
    state.ready = true
    markReady()
  }
})

export function useAuth() {
  const isAuthenticated = computed(() => state.user !== null)

  async function login(email: string, password: string) {
    bootstrapping = true
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password)
      state.user = await ensureProfile(cred.user)
    } finally {
      bootstrapping = false
    }
  }

  async function signup(name: string, email: string, password: string) {
    bootstrapping = true
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      await updateProfile(cred.user, { displayName: name })
      // Pass the typed name explicitly — register-sendr is idempotent, so the first
      // call must carry it (a later call won't rename the account). register-sendr also
      // triggers Sendr's own (Resend-branded) verification email on the backend, so we
      // deliberately don't call Firebase's sendEmailVerification here — that would send a
      // second, generic email from the shared Firebase template.
      state.user = await ensureProfile(cred.user, name)
    } finally {
      bootstrapping = false
    }
  }

  async function loginWithGoogle() {
    bootstrapping = true
    try {
      const cred = await signInWithPopup(auth, googleProvider)
      state.user = await ensureProfile(cred.user)
    } finally {
      bootstrapping = false
    }
  }

  async function logout() {
    await signOut(auth)
    state.user = null
    // Clear per-account caches so the next user to sign in on this device is assessed
    // fresh — otherwise they'd inherit the previous user's sender IDs and skip onboarding.
    resetSenderIds()
  }

  // Ask the backend to re-send the Sendr verification email (no-op server-side if already
  // verified). Throws on a network/API error so the caller can surface it.
  async function resendVerification() {
    await api.post('/api/users/resend-verification')
  }

  // Re-check verification with Firebase (after the user clicks the link in another tab) and
  // sync it into our user state. Returns the fresh verified flag.
  async function refreshVerification(): Promise<boolean> {
    const fb = auth.currentUser
    if (!fb) return false
    await fb.reload()
    if (state.user) state.user.emailVerified = fb.emailVerified
    return fb.emailVerified
  }

  return {
    user: computed(() => state.user),
    isAuthenticated,
    ready: computed(() => state.ready),
    emailVerified: computed(() => state.user?.emailVerified ?? false),
    login,
    signup,
    loginWithGoogle,
    logout,
    resendVerification,
    refreshVerification,
  }
}
