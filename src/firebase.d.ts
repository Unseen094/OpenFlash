declare module 'firebase/app' {
  export interface FirebaseOptions {
    apiKey?: string
    authDomain?: string
    projectId?: string
    storageBucket?: string
    messagingSenderId?: string
    appId?: string
    measurementId?: string
  }

  export interface FirebaseApp {
    name: string
    options: FirebaseOptions
    automaticDataCollectionEnabled: boolean
  }

  export function initializeApp(options: FirebaseOptions, name?: string): FirebaseApp
  export function getApps(): FirebaseApp[]
  export function getApp(name?: string): FirebaseApp
  export function deleteApp(app: FirebaseApp): Promise<void>

  export type FirebaseError = Error & { code?: string }
}

declare module 'firebase/auth' {
  import type { FirebaseApp } from 'firebase/app'

  export interface User {
    uid: string
    email: string | null
    displayName: string | null
    photoURL: string | null
    emailVerified: boolean
    isAnonymous: boolean
    phoneNumber: string | null
    providerId: string
    tenantId: string | null
    metadata: {
      creationTime?: string
      lastSignInTime?: string
    }
    providerData: Array<{
      uid: string
      displayName: string | null
      email: string | null
      phoneNumber: string | null
      photoURL: string | null
      providerId: string
    }>
    refreshToken: string
    getIdToken(forceRefresh?: boolean): Promise<string>
    getIdTokenResult(forceRefresh?: boolean): Promise<{
      token: string
      expirationTime: string
      authTime: string
      issuedAtTime: string
      signInProvider: string | null
      signInSecondFactor: string | null
      claims: Record<string, unknown>
    }>
    delete(): Promise<void>
    reload(): Promise<void>
    toJSON(): object
  }

  export interface Auth {
    app: FirebaseApp
    currentUser: User | null
    languageCode: string | null
    tenantId: string | null
    settings: { appVerificationDisabledForTesting: boolean }
    onAuthStateChanged(nextOrObserver: (user: User | null) => void): () => void
  }

  export interface AuthCredential {
    providerId: string
    signInMethod: string
    toJSON(): object
  }

  export interface UserCredential {
    user: User
    providerId: string | null
    operationType: string | null
    credential: AuthCredential | null
  }

  export function getAuth(app?: FirebaseApp): Auth
  export function signInWithEmailAndPassword(auth: Auth, email: string, password: string): Promise<UserCredential>
  export function createUserWithEmailAndPassword(auth: Auth, email: string, password: string): Promise<UserCredential>
  export function signInWithPopup(auth: Auth, provider: any): Promise<UserCredential>
  export function signOut(auth: Auth): Promise<void>
  export function onAuthStateChanged(auth: Auth, nextOrObserver: (user: User | null) => void): () => void
  export function updateProfile(user: User, profile: { displayName?: string | null; photoURL?: string | null }): Promise<void>
  export function connectAuthEmulator(auth: Auth, url: string, options?: { disableWarnings?: boolean }): void

  export class GoogleAuthProvider {
    constructor()
    providerId: string
    addScope(scope: string): this
    setCustomParameters(customOAuthParameters: Record<string, string>): this
    credential(idToken?: string, accessToken?: string): AuthCredential
    static credentialFromResult(userCredential: UserCredential): AuthCredential | null
    static credentialFromError(error: any): AuthCredential | null
    static credential(idToken: string | null, accessToken?: string): AuthCredential
  }

  export class OAuthProvider {
    constructor(providerId: string)
    providerId: string
    addScope(scope: string): this
    setCustomParameters(customOAuthParameters: Record<string, string>): this
  }

  export type NextOrObserver<T> = (value: T) => void
  export type ErrorFn = (error: Error) => void
  export type CompleteFn = () => void
}
