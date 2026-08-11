import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as fbSignOut,
  updateProfile,
  User
} from 'firebase/auth'
import { getFirebaseAuth, isFirebaseConfigured } from '../lib/firebase'

interface AuthContextValue {
  user: User | null
  loading: boolean
  isConfigured: boolean
  isAdmin: boolean
  signIn: (_email: string, _password: string) => Promise<User>
  signUp: (_email: string, _password: string, _displayName?: string) => Promise<User>
  signInWithGoogle: () => Promise<User>
  signInAsGuest: () => User
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

interface DemoUser {
  email: string
  displayName: string
  uid: string
}

const DEMO_FLAG_KEY = 'openflash_demo_skip_firebase'

function isDemoForced(): boolean {
  try {
    return localStorage.getItem(DEMO_FLAG_KEY) === '1'
  } catch {
    return false
  }
}

function loadDemoUser(): DemoUser | null {
  try {
    const raw = localStorage.getItem('openflash_demo_user')
    return raw ? JSON.parse(raw) as DemoUser : null
  } catch {
    return null
  }
}

function demoUid(email: string): string {
  let hash = 0
  for (let i = 0; i < email.length; i++) {
    hash = (hash * 31 + email.charCodeAt(i)) | 0
  }
  return `demo-${Math.abs(hash).toString(36)}`
}

const createDemoUser = (email: string): DemoUser => ({
  uid: demoUid(email),
  email,
  displayName: email.split('@')[0]
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(isFirebaseConfigured)
  const [isAdmin, setIsAdmin] = useState(false)
  const [demoUser, setDemoUser] = useState<DemoUser | null>(() => loadDemoUser())

  useEffect(() => {
    if (demoUser) {
      setIsAdmin(true)
    }
  }, [demoUser])

  useEffect(() => {
    const auth = getFirebaseAuth()
    if (!auth) {
      setLoading(false)
      return
    }
    if (isDemoForced() || loadDemoUser()) {
      setLoading(false)
      return
    }
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      if (u) {
        u.getIdTokenResult().then(token => {
          setIsAdmin(token.claims.admin === true)
        }).catch(() => setIsAdmin(false))
      } else {
        setIsAdmin(false)
      }
      setLoading(false)
    })
    return () => unsub()
  }, [])

  const signIn = useCallback(async (email: string, password: string): Promise<User> => {
    try { localStorage.removeItem(DEMO_FLAG_KEY) } catch { /* noop */ }
    setDemoUser(null)
    const auth = getFirebaseAuth()
    if (!auth) throw new Error('Firebase is not configured. Add your keys to src/lib/firebase.ts')
    const cred = await signInWithEmailAndPassword(auth, email, password)
    setUser(cred.user)
    cred.user.getIdTokenResult().then(token => {
      setIsAdmin(token.claims.admin === true)
    }).catch(() => setIsAdmin(false))
    return cred.user
  }, [])

  const signUp = useCallback(async (email: string, password: string, displayName?: string): Promise<User> => {
    try { localStorage.removeItem(DEMO_FLAG_KEY) } catch { /* noop */ }
    setDemoUser(null)
    const auth = getFirebaseAuth()
    if (!auth) throw new Error('Firebase is not configured. Add your keys to src/lib/firebase.ts')
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    if (displayName) {
      try {
        await updateProfile(cred.user, { displayName })
      } catch (e) {
        console.error('Failed to update profile:', e)
      }
    }
    setUser(cred.user)
    setIsAdmin(false)
    return cred.user
  }, [])

  const signInWithGoogle = useCallback(async (): Promise<User> => {
    try { localStorage.removeItem(DEMO_FLAG_KEY) } catch { /* noop */ }
    setDemoUser(null)
    const auth = getFirebaseAuth()
    if (!auth) throw new Error('Firebase is not configured. Add your keys to src/lib/firebase.ts')
    const cred = await signInWithPopup(auth, new GoogleAuthProvider())
    setUser(cred.user)
    cred.user.getIdTokenResult().then(token => {
      setIsAdmin(token.claims.admin === true)
    }).catch(() => setIsAdmin(false))
    return cred.user
  }, [])

  const signInAsGuest = useCallback((): User => {
    const demo = createDemoUser(`guest_${Math.random().toString(36).slice(2, 8)}@openflash.demo`)
    try {
      localStorage.setItem(DEMO_FLAG_KEY, '1')
      localStorage.setItem('openflash_demo_user', JSON.stringify(demo))
    } catch { /* noop */ }
    setDemoUser(demo)
    setIsAdmin(true)
    setLoading(false)
    return { uid: demo.uid, email: demo.email, displayName: demo.displayName } as User
  }, [])

  const signOut = useCallback(async (): Promise<void> => {
    const auth = getFirebaseAuth()
    if (auth && !isDemoForced()) {
      await fbSignOut(auth)
    }
    setUser(null)
    setIsAdmin(false)
    try {
      localStorage.removeItem('openflash_demo_user')
    } catch { /* noop */ }
    setDemoUser(null)
  }, [])

  const effectiveUser: User | null = demoUser
    ? ({ uid: demoUser.uid, email: demoUser.email, displayName: demoUser.displayName } as User)
    : user

  const value = useMemo((): AuthContextValue => ({
    user: effectiveUser,
    loading: !demoUser && loading,
    isConfigured: isFirebaseConfigured,
    isAdmin,
    signIn,
    signUp,
    signInWithGoogle,
    signInAsGuest,
    signOut
  }), [effectiveUser, demoUser, loading, isAdmin, signIn, signUp, signInWithGoogle, signInAsGuest, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
