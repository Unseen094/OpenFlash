import { initializeApp, FirebaseApp } from 'firebase/app'
import { getAuth, Auth, connectAuthEmulator } from 'firebase/auth'

const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ''
}

export const isFirebaseConfigured: boolean =
  Boolean(FIREBASE_CONFIG.apiKey) &&
  Boolean(FIREBASE_CONFIG.authDomain) &&
  Boolean(FIREBASE_CONFIG.projectId)

if (import.meta.env.PROD && !isFirebaseConfigured) {
  console.warn('[firebase] No VITE_FIREBASE_* variables configured — running in guest-only mode.')
}

let app: FirebaseApp | null = null
let auth: Auth | null = null

if (isFirebaseConfigured) {
  try {
    app = initializeApp(FIREBASE_CONFIG)
    auth = getAuth(app)
    if (import.meta.env.VITE_FIREBASE_EMULATOR) {
      connectAuthEmulator(auth, import.meta.env.VITE_FIREBASE_EMULATOR)
    }
  } catch (e) {
    console.error('[auth] Firebase initialization failed:', e)
    app = null
    auth = null
  }
}

export function getFirebaseApp(): FirebaseApp | null {
  return app
}

export function getFirebaseAuth(): Auth | null {
  return auth
}
