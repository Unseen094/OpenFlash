import { initializeApp, FirebaseApp } from 'firebase/app'
import { getAuth, Auth, connectAuthEmulator } from 'firebase/auth'

// ─────────────────────────────────────────────────────────────────────────────
// FIREBASE CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────
// Paste your Firebase web app config below. Get it from:
// Firebase Console → Project Settings → Your apps → Web app → SDK setup.
//
// Recommended: use a .env file instead of editing this file directly.
//   VITE_FIREBASE_API_KEY=...
//   VITE_FIREBASE_AUTH_DOMAIN=...
//   VITE_FIREBASE_PROJECT_ID=...
//   VITE_FIREBASE_STORAGE_BUCKET=...
//   VITE_FIREBASE_MESSAGING_SENDER_ID=...
//   VITE_FIREBASE_APP_ID=...
//
// Until a real config is provided, `isFirebaseConfigured` is false and the app
// runs in dev mode (auth routes work in demo mode, /studio and /dashboard are
// not locked). Once you add your keys, login becomes mandatory for the studio.
// ─────────────────────────────────────────────────────────────────────────────

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
