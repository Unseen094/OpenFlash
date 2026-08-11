import { initializeApp, FirebaseApp } from 'firebase/app'
import { getAuth, Auth, connectAuthEmulator } from 'firebase/auth'

const DEFAULT_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAmFOJvKECIJZTYtCOTl_acfl8FOn6mc2I',
  authDomain: 'gen-lang-client-0652022231.firebaseapp.com',
  projectId: 'gen-lang-client-0652022231',
  storageBucket: 'gen-lang-client-0652022231.firebasestorage.app',
  messagingSenderId: '818583549241',
  appId: '1:818583549241:web:4681b79337432a10a5a4e8'
}

const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || DEFAULT_FIREBASE_CONFIG.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || DEFAULT_FIREBASE_CONFIG.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_CONFIG.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || DEFAULT_FIREBASE_CONFIG.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || DEFAULT_FIREBASE_CONFIG.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || DEFAULT_FIREBASE_CONFIG.appId
}

export const isFirebaseConfigured: boolean =
  Boolean(FIREBASE_CONFIG.apiKey) &&
  Boolean(FIREBASE_CONFIG.authDomain) &&
  Boolean(FIREBASE_CONFIG.projectId)

if (import.meta.env.PROD && !isFirebaseConfigured) {
  throw new Error('[firebase] Firebase is not configured for production. Set VITE_FIREBASE_* environment variables.')
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
