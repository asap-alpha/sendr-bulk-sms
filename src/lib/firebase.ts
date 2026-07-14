/**
 * Firebase app + auth singletons.
 *
 * Sendr authenticates against the SAME Firebase project as the TailorsFlow backend
 * (the backend verifies the Firebase ID token and looks the user up in Firestore).
 * Email/password AND Google both go through Firebase Auth — the backend only ever
 * sees the resulting ID token as a Bearer credential.
 *
 * Config comes from VITE_FIREBASE_* env vars (see .env.example). These are the
 * public web-app config values from the Firebase console — not secrets.
 */
import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const firebaseApp = initializeApp(firebaseConfig)
export const auth = getAuth(firebaseApp)
export const googleProvider = new GoogleAuthProvider()

/** Map a Firebase Auth error to a short, user-facing message. */
// True when a signup failed because the email is already registered (shared Cheqam
// identity — the account may have been created on any of our products). Lets the
// signup screen show a "sign in instead" banner rather than a generic error.
export function isEmailInUse(e: unknown): boolean {
  return (e as { code?: string })?.code === 'auth/email-already-in-use'
}

export function authErrorMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? ''
  switch (code) {
    case 'auth/invalid-email':
      return 'That email address looks invalid.'
    case 'auth/user-disabled':
      return 'This account has been disabled.'
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password.'
    case 'auth/email-already-in-use':
      return 'An account with that email already exists. Try signing in.'
    case 'auth/weak-password':
      return 'Choose a stronger password (at least 6 characters).'
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign-in was cancelled.'
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.'
    default:
      return 'Could not sign you in. Please try again.'
  }
}
