import { useState, useEffect, useCallback, useRef } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import DotGrid from './components/DotGrid'
import Navbar from './components/Navbar'
import KonamiOverlay from './components/KonamiOverlay'
import AdConsent from './components/AdConsent'
import LandingPage from './pages/LandingPage'
import ArcadePage from './pages/ArcadePage'
import DashboardPage from './pages/DashboardPage'
import StudioPage from './pages/StudioPage'
import DocsPage from './pages/DocsPage'
import AuthPage, { RequireAuth } from './pages/AuthPage'
import CheckoutPage from './pages/CheckoutPage'
import PlayPage from './pages/PlayPage'
import EarningsPage from './pages/EarningsPage'
import PublishPage from './pages/PublishPage'
import AdminPage from './pages/AdminPage'
import NotFoundPage from './pages/NotFoundPage'
import { AuthProvider } from './context/AuthContext'

export default function App() {
  const location = useLocation()
  const [konamiActive, setKonamiActive] = useState(false)
  const konamiRef = useRef<string[]>([])
  const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    konamiRef.current.push(e.key)
    if (konamiRef.current.length > konamiCode.length) {
      konamiRef.current.shift()
    }
    if (konamiRef.current.join(',') === konamiCode.join(',')) {
      setKonamiActive(prev => !prev)
      playKonamiSound()
    }
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

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

  return (
    <AuthProvider>
      <div style={{ minHeight: '100vh', position: 'relative' }}>
        <DotGrid />
        <Navbar konamiActive={konamiActive} />
        <main style={{ position: 'relative', zIndex: 1 }}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/arcade" element={<ArcadePage />} />
            <Route path="/play/:gameId" element={<PlayPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/publish" element={<PublishPage />} />
            <Route path="/earnings" element={<EarningsPage />} />
            <Route path="/admin" element={<RequireAuth><AdminPage /></RequireAuth>} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/studio" element={<RequireAuth><StudioPage /></RequireAuth>} />
            <Route path="/docs" element={<DocsPage />} />
            <Route path="/login" element={<AuthPage />} />
            <Route path="/signup" element={<AuthPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>
        {konamiActive && <KonamiOverlay />}
        <AdConsent />
      </div>
    </AuthProvider>
  )
}
