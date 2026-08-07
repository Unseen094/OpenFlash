import { Link, useLocation } from 'react-router-dom'
import { useState } from 'react'

export default function Navbar({ konamiActive }: { konamiActive: boolean }) {
  const location = useLocation()
  const [soundEnabled, setSoundEnabled] = useState(true)

  const navItems = [
    { path: '/', label: 'Home' },
    { path: '/arcade', label: 'Arcade' },
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/studio', label: 'Studio' },
  ]

  const playClick = () => {
    if (!soundEnabled) return
    try {
      const ctx = new AudioContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'square'
      osc.frequency.setValueAtTime(1800, ctx.currentTime)
      gain.gain.setValueAtTime(0.08, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.04)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.04)
    } catch (e) {}
  }

  return (
    <nav style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 24px',
      background: 'rgba(10, 11, 14, 0.85)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--border-subtle)'
    }}>
      <Link to="/" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        textDecoration: 'none',
        color: 'inherit'
      }}>
        <div style={{
          width: 32,
          height: 32,
          background: 'var(--accent-yellow)',
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-mono)',
          fontWeight: 700,
          fontSize: 14,
          color: 'var(--bg-primary)'
        }}>
          OF
        </div>
        <span style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: 700,
          fontSize: 16,
          letterSpacing: '-0.02em'
        }}>
          OPENFLASH
        </span>
        {konamiActive && (
          <span className="badge badge-magenta">RETRO MODE</span>
        )}
      </Link>

      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        {navItems.map(item => (
          <Link
            key={item.path}
            to={item.path}
            onClick={playClick}
            style={{
              padding: '6px 14px',
              fontSize: 13,
              fontWeight: 500,
              textDecoration: 'none',
              color: location.pathname === item.path ? 'var(--accent-yellow)' : 'var(--text-secondary)',
              borderRadius: 'var(--radius-md)',
              transition: 'all var(--transition-fast)',
              background: location.pathname === item.path ? 'rgba(255, 230, 0, 0.08)' : 'transparent'
            }}
          >
            {item.label}
          </Link>
        ))}
        <button
          className="btn btn-icon btn-ghost"
          onClick={() => setSoundEnabled(!soundEnabled)}
          style={{ marginLeft: 8 }}
          title={soundEnabled ? 'Mute UI Sounds' : 'Enable UI Sounds'}
        >
          {soundEnabled ? '🔊' : '🔇'}
        </button>
      </div>
    </nav>
  )
}
