import { useState, useEffect, ReactNode } from 'react'
import { Link, useNavigate, useLocation, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { IconWarning } from '../components/Icons'

interface LocationState {
  from?: string
}

export default function AuthPage() {
  const { user, loading, isConfigured, signIn, signUp, signInWithGoogle, signInAsGuest } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = (location.state as LocationState | null)?.from || '/studio'

  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!loading && user) {
      navigate(redirectTo, { replace: true })
    }
  }, [user, loading, navigate, redirectTo])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === 'signup') {
        await signUp(email.trim(), password, displayName.trim() || undefined)
      } else {
        await signIn(email.trim(), password)
      }
      navigate(redirectTo, { replace: true })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong.'
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  const handleGoogle = async () => {
    setError(null)
    setBusy(true)
    try {
      await signInWithGoogle()
      navigate(redirectTo, { replace: true })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Google sign-in failed.'
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  const toggleMode = (m: 'login' | 'signup') => {
    setMode(m)
    setError(null)
  }

  const handleGuest = () => {
    setError(null)
    setBusy(true)
    try {
      signInAsGuest()
      navigate(redirectTo, { replace: true })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Guest sign-in failed.'
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{
      minHeight: 'calc(100vh - 60px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 40
    }}>
<div className="glass-panel animate-slide-up" style={{ width: 400, padding: 40, position: 'relative' }}>
          <div className="panel corner" style={{
            padding: '10px 14px',
            marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(255, 138, 0, 0.05)',
            borderColor: 'rgba(255, 138, 0, 0.3)'
          }}>
            <IconWarning size={14} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent-orange)' }}>
              DEMO MODE — instant access, one click
            </span>
          </div>

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div className="nav-mark" style={{ width: 48, height: 48, margin: '0 auto 12px', fontSize: 18 }}>OF</div>
          <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
            {mode === 'login' ? 'Sign in to continue to the Studio.' : 'Start building in seconds.'}
          </p>
        </div>

        <button className="btn btn-amber btn-block" onClick={() => { void handleGuest() }} disabled={busy}
          style={{ padding: '12px 0', fontWeight: 700, marginBottom: 16 }}>
          {busy ? 'Entering…' : 'Continue as Guest'}
        </button>

        <div className="row" style={{ gap: 0, justifyContent: 'center' }}>
          <span className="tiny" style={{ opacity: 0.6 }}>— or use an email —</span>
        </div>

        <div style={{
          display: 'flex', gap: 4, background: 'var(--bg-primary)',
          borderRadius: 'var(--radius-md)', padding: 4, marginBottom: 20
        }}>
          {(['login', 'signup'] as const).map(m => (
            <button key={m} onClick={() => toggleMode(m)}
              style={{
                flex: 1, padding: '8px 0', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: mode === m ? 'var(--accent-yellow)' : 'transparent',
                color: mode === m ? 'var(--bg-primary)' : 'var(--text-muted)',
                border: 'none', borderRadius: 'var(--radius-sm)',
                fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 1,
                transition: 'all var(--transition-fast)'
              }}>
              {m}
            </button>
          ))}
        </div>

        <form onSubmit={(e) => { void handleSubmit(e) }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mode === 'signup' && (
            <input className="input" type="text" placeholder="Display name (optional)"
              value={displayName} onChange={e => setDisplayName(e.target.value)}
              autoComplete="name" />
          )}
          <input className="input" type="email" required placeholder="Email"
            value={email} onChange={e => setEmail(e.target.value)}
            autoComplete="email" />
          <input className="input" type="password" required placeholder="Password (6+ characters)"
            value={password} onChange={e => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />

          {error && (
            <div style={{
              padding: '10px 12px', fontSize: 12, background: 'rgba(255, 0, 90, 0.08)',
              border: '1px solid rgba(255, 0, 90, 0.3)', borderRadius: 'var(--radius-sm)',
              color: '#FF5F75', fontFamily: 'var(--font-mono)'
            }}>{error}</div>
          )}

          <button className="btn btn-primary" disabled={busy}
            style={{ width: '100%', justifyContent: 'center', padding: '11px 0', fontWeight: 700 }}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="row" style={{ justifyContent: 'center', margin: '18px 0' }}>
          <span className="tiny" style={{ opacity: 0.6 }}>guests get a sandboxed workspace — save your work with an account</span>
        </div>

        {isConfigured && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0',
            color: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase'
          }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
            or
            <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
          </div>
        )}

        {isConfigured && (
          <button className="btn btn-block" onClick={() => { void handleGoogle() }} disabled={busy}
            style={{ padding: '11px 0' }}>
            <span style={{ fontSize: 15 }}>G</span> Continue with Google
          </button>
        )}

        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
          {mode === 'login' ? (
            <>New here? <Link to="/docs" style={{ color: 'var(--accent-cyan)', textDecoration: 'none' }}>Check the docs</Link></>
          ) : (
            <>Already have an account? <span style={{ color: 'var(--accent-cyan)', cursor: 'pointer' }} onClick={() => toggleMode('login')}>Sign in</span></>
          )}
        </div>
      </div>
    </div>
  )
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div style={{
        minHeight: 'calc(100vh - 60px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)'
      }}>Loading…</div>
    )
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  return children
}