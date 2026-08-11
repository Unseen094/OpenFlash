import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import DotGrid from './components/DotGrid'
import Navbar from './components/Navbar'
import KonamiOverlay from './components/KonamiOverlay'
import AdConsent from './components/AdConsent'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AuthProvider } from './context/AuthContext'
import { ensureArcadeSeed } from './lib/demoSeed'

import AuthPage, { RequireAuth } from './pages/AuthPage'

const LandingPage = lazy(() => import('./pages/LandingPage'))
const ArcadePage = lazy(() => import('./pages/ArcadePage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const StudioPage = lazy(() => import('./pages/StudioPage'))
const TemplatesPage = lazy(() => import('./pages/TemplatesPage'))
const DocsPage = lazy(() => import('./pages/DocsPage'))
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'))
const PlayPage = lazy(() => import('./pages/PlayPage'))
const EarningsPage = lazy(() => import('./pages/EarningsPage'))
const PublishPage = lazy(() => import('./pages/PublishPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

const routeTitles: Record<string, string> = {
  '/': 'OpenFlash — Interactive Creation Portal',
  '/arcade': 'Arcade — OpenFlash',
  '/play': 'Play — OpenFlash',
  '/checkout': 'Checkout — OpenFlash',
  '/publish': 'Publish — OpenFlash',
  '/earnings': 'Earnings — OpenFlash',
  '/admin': 'Admin — OpenFlash',
  '/dashboard': 'Creator Hub — OpenFlash',
  '/templates': 'Templates — OpenFlash',
  '/studio': 'Studio — OpenFlash',
  '/docs': 'Docs — OpenFlash',
  '/login': 'Sign In — OpenFlash',
  '/signup': 'Sign Up — OpenFlash',
}

function RouteTitle({ path }: { path: string }) {
  useEffect(() => {
    const base = '/' + (path.split('/')[1] || '')
    document.title = routeTitles[base] || routeTitles['/']
  }, [path])
  return null
}

function RouteFallback() {
  return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Loading…</div>
}

export default function App() {
  const location = useLocation()
  const [konamiActive, setKonamiActive] = useState(false)
  const konamiRef = useRef<string[]>([])
  const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']

  const playKonamiSound = () => {
    try {
      const ctx = new AudioContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.setValueAtTime(440, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1)
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.2)
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.4)
    } catch (e) {
      console.error('Konami sound failed:', e)
    }
  }

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    konamiRef.current.push(e.key)
    if (konamiRef.current.length > konamiCode.length) {
      konamiRef.current.shift()
    }
    if (konamiRef.current.join(',') === konamiCode.join(',')) {
      setKonamiActive(prev => !prev)
      playKonamiSound()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    ensureArcadeSeed()
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
  return (
    <AuthProvider>
      <div style={{ minHeight: '100vh', position: 'relative' }}>
        <DotGrid />
        <Navbar konamiActive={konamiActive} />
        <main style={{ position: 'relative', zIndex: 1 }}>
          <RouteTitle path={location.pathname} />
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<ErrorBoundary><LandingPage /></ErrorBoundary>} />
              <Route path="/arcade" element={<ErrorBoundary><ArcadePage /></ErrorBoundary>} />
              <Route path="/play/:gameId" element={<ErrorBoundary><PlayPage /></ErrorBoundary>} />
              <Route path="/checkout" element={<ErrorBoundary><CheckoutPage /></ErrorBoundary>} />
              <Route path="/publish" element={<ErrorBoundary><RequireAuth><PublishPage /></RequireAuth></ErrorBoundary>} />
              <Route path="/earnings" element={<ErrorBoundary><RequireAuth><EarningsPage /></RequireAuth></ErrorBoundary>} />
              <Route path="/admin" element={<ErrorBoundary><RequireAuth><AdminPage /></RequireAuth></ErrorBoundary>} />
              <Route path="/dashboard" element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
              <Route path="/templates" element={<ErrorBoundary><TemplatesPage /></ErrorBoundary>} />
              <Route path="/studio" element={<ErrorBoundary><RequireAuth><StudioPage /></RequireAuth></ErrorBoundary>} />
              <Route path="/docs" element={<ErrorBoundary><DocsPage /></ErrorBoundary>} />
              <Route path="/login" element={<ErrorBoundary><AuthPage /></ErrorBoundary>} />
              <Route path="/signup" element={<ErrorBoundary><AuthPage /></ErrorBoundary>} />
              <Route path="*" element={<ErrorBoundary><NotFoundPage /></ErrorBoundary>} />
            </Routes>
          </Suspense>
        </main>
        {konamiActive && <KonamiOverlay />}
        <AdConsent />
      </div>
    </AuthProvider>
  )
}
