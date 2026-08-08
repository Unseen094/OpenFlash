import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { IconVolumeOn, IconVolumeOff } from '../components/Icons'

export default function Navbar({ konamiActive }: { konamiActive: boolean }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isConfigured, signOut } = useAuth()
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const navItems = [
    { path: '/', label: 'Home' },
    { path: '/arcade', label: 'Arcade' },
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/studio', label: 'Studio' },
    { path: '/docs', label: 'Docs' },
  ]

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const handleSignOut = async () => {
    setMenuOpen(false)
    await signOut()
    navigate('/')
  }

  const displayName = user?.displayName || (user?.email ? user.email.split('@')[0] : null)
  const initial = (displayName || '?').charAt(0).toUpperCase()

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
    } catch (e) {
      console.error('Navbar click sound failed:', e)
    }
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
          {soundEnabled ? <IconVolumeOn size={16} /> : <IconVolumeOff size={16} />}
        </button>

        {user ? (
          <div style={{ position: 'relative', marginLeft: 8 }} ref={menuRef}>
            <button
              onClick={() => setMenuOpen(o => !o)}
              style={{
                width: 34, height: 34, borderRadius: '50%', cursor: 'pointer',
                background: 'var(--accent-yellow)', color: 'var(--bg-primary)',
                border: '1px solid var(--accent-yellow)',
                fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all var(--transition-fast)'
              }}
              title={displayName || user.email || ''}
            >
              {initial}
            </button>
            {menuOpen && (
              <div className="glass-panel animate-slide-up" style={{
                position: 'absolute', right: 0, top: 44, width: 220, padding: 8, zIndex: 200
              }}>
                <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {displayName || 'User'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {user.email}
                  </div>
                  {!isConfigured && (
                    <div style={{ fontSize: 10, color: 'var(--accent-orange)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                      demo mode
                    </div>
                  )}
                </div>
                <Link to="/dashboard" onClick={() => setMenuOpen(false)}
                  style={{ display: 'block', padding: '10px 12px', fontSize: 13, color: 'var(--text-primary)', textDecoration: 'none', borderRadius: 'var(--radius-sm)', transition: 'background var(--transition-fast)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  Creator Hub
                </Link>
                <Link to="/earnings" onClick={() => setMenuOpen(false)}
                  style={{ display: 'block', padding: '10px 12px', fontSize: 13, color: 'var(--text-primary)', textDecoration: 'none', borderRadius: 'var(--radius-sm)', transition: 'background var(--transition-fast)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  Earnings
                </Link>
                <Link to="/publish" onClick={() => setMenuOpen(false)}
                  style={{ display: 'block', padding: '10px 12px', fontSize: 13, color: 'var(--text-primary)', textDecoration: 'none', borderRadius: 'var(--radius-sm)', transition: 'background var(--transition-fast)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  Publish Game
                </Link>
                <Link to="/admin" onClick={() => setMenuOpen(false)}
                  style={{ display: 'block', padding: '10px 12px', fontSize: 13, color: 'var(--text-primary)', textDecoration: 'none', borderRadius: 'var(--radius-sm)', transition: 'background var(--transition-fast)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  Admin
                </Link>
                <button onClick={handleSignOut}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', fontSize: 13, color: '#FF5F75', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-sm)', transition: 'background var(--transition-fast)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255, 95, 117, 0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link to="/login" className="btn btn-primary" style={{ marginLeft: 8, padding: '6px 14px', fontSize: 12 }}>
            Sign In
          </Link>
        )}
      </div>
    </nav>
  )
}
