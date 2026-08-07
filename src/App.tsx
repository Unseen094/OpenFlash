import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import DotGrid from './components/DotGrid'
import Navbar from './components/Navbar'
import KonamiOverlay from './components/KonamiOverlay'
import LandingPage from './pages/LandingPage'
import ArcadePage from './pages/ArcadePage'
import DashboardPage from './pages/DashboardPage'
import StudioPage from './pages/StudioPage'

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
    } catch (e) {}
  }

  const renderPage = () => {
    switch (location.pathname) {
      case '/arcade': return <ArcadePage />
      case '/dashboard': return <DashboardPage />
      case '/studio': return <StudioPage />
      default: return <LandingPage />
    }
  }

  return (
    <div style={{ minHeight: '100vh', position: 'relative' }}>
      <DotGrid />
      <Navbar konamiActive={konamiActive} />
      <main style={{ position: 'relative', zIndex: 1 }}>
        {renderPage()}
      </main>
      {konamiActive && <KonamiOverlay />}
    </div>
  )
}
