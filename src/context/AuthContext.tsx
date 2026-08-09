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
  signIn: (email: string, password: string) => Promise<User>
  signUp: (email: string, password: string, displayName?: string) => Promise<User>
  signInWithGoogle: () => Promise<User>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const ADMIN_EMAILS_KEY = 'openflash_admin_emails'

function loadAdminEmails(): string[] {
  if (!isFirebaseConfigured) return []
  try {
    const raw = localStorage.getItem(ADMIN_EMAILS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

interface DemoUser {
  email: string
  displayName: string
  uid: string
}

const DEMO_UID = 'demo-user'

function loadDemoUser(): DemoUser | null {
  try {
    const raw = localStorage.getItem('openflash_demo_user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const DemoUserKey = (user: DemoUser) => localStorage.setItem('openflash_demo_user', JSON.stringify(user))
const clearDemoUser = localStorage.removeItem.bind(localStorage, 'openflash_demo_user')

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
  const [adminEmails, setAdminEmails] = useState<string[]>(() => loadAdminEmails())

  useEffect(() => {
    if (demoUser) {
      setIsAdmin(false)
    }
  }, [demoUser])

  useEffect(() => {
    const auth = getFirebaseAuth()
    if (!auth) {
      setLoading(false)
      return
    }
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      // Admin is determined by Firebase custom claims, not localStorage
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
    const auth = getFirebaseAuth()
    if (!auth) throw new Error('Firebase is not configured. Add your keys to src/lib/firebase.ts')
    const cred = await signInWithPopup(auth, new GoogleAuthProvider())
    setUser(cred.user)
    cred.user.getIdTokenResult().then(token => {
      setIsAdmin(token.claims.admin === true)
    }).catch(() => setIsAdmin(false))
    return cred.user
  }, [])

  const signOut = useCallback(async (): Promise<void> => {
    const auth = getFirebaseAuth()
    if (auth) {
      await fbSignOut(auth)
    }
    setUser(null)
    setIsAdmin(false)
    clearDemoUser()
    setDemoUser(null)
  }, [])

  const value = useMemo((): AuthContextValue => ({
    user,
    loading,
    isConfigured: isFirebaseConfigured,
    isAdmin,
    signIn,
    signUp,
    signInWithGoogle,
    signOut
  }), [user, loading, isAdmin, signIn, signUp, signInWithGoogle, signOut])

  if (!isFirebaseConfigured) {
    const demoValue = useMemo((): AuthContextValue => ({
      user: (demoUser ? { uid: demoUser.uid, email: demoUser.email, displayName: demoUser.displayName } : null) as User | null,
      loading: false,
      isConfigured: false,
      isAdmin: false,
      signIn: async (email: string, _password: string) => {
        const demo = createDemoUser(email)
        DemoUserKey(demo)
        setDemoUser(demo)
        return { uid: demo.uid, email: demo.email, displayName: demo.displayName } as User
      },
      signUp: async (email: string, _password: string) => {
        const demo = createDemoUser(email)
        DemoUserKey(demo)
        setDemoUser(demo)
        return { uid: demo.uid, email: demo.email, displayName: demo.displayName } as User
      },
      signInWithGoogle: async () => {
        const demo = createDemoUser('demo@openflash.io')
        DemoUserKey(demo)
        setDemoUser(demo)
        return { uid: demo.uid, email: demo.email, displayName: demo.displayName } as User
      },
      signOut: async () => {
        clearDemoUser()
        setDemoUser(null)
        setIsAdmin(false)
      }
    }), [demoUser])
    return <AuthContext.Provider value={demoValue}>{children}</AuthContext.Provider>
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
