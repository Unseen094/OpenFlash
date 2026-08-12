import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { IconVolumeOn, IconVolumeOff } from './Icons'

const navItems = [
  { path: '/', label: 'Home', index: '00' },
  { path: '/arcade', label: 'Arcade', index: '01' },
  { path: '/studio', label: 'Studio', index: '02' },
  { path: '/dashboard', label: 'Hub', index: '04' },
  { path: '/docs', label: 'Docs', index: '05' },
]

const HamburgerIcon = () => (
  <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
    <rect y="0" width="18" height="2" rx="1" fill="currentColor" />
    <rect y="6" width="18" height="2" rx="1" fill="currentColor" />
    <rect y="12" width="18" height="2" rx="1" fill="currentColor" />
  </svg>
)

export default function Navbar({ konamiActive }: { konamiActive: boolean }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isConfigured, signOut } = useAuth()
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  const handleSignOut = async () => {
    setMenuOpen(false)
    setMobileOpen(false)
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
    } catch {
      // audio context not available
    }
  }

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)

  return (
    <>
      <nav className="nav">
        <Link className="nav-brand" to="/" onClick={playClick}>
          <span className="nav-mark">OF</span>
          <span className="nav-word">OPENFLASH</span>
          {konamiActive && <span className="badge badge-pink">RETRO MODE</span>}
        </Link>

        <div className="nav-links">
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              onClick={playClick}
              className={`nav-link${isActive(item.path) ? ' is-active' : ''}`}
            >
              <span className="nav-idx">{item.index}</span>
              {item.label}
            </Link>
          ))}
        </div>

        <div className="row nav-right-group">
          <button
            className="btn btn-icon btn-ghost"
            onClick={() => setSoundEnabled(v => !v)}
            title={soundEnabled ? 'Mute UI Sounds' : 'Enable UI Sounds'}
          >
            {soundEnabled ? <IconVolumeOn size={16} /> : <IconVolumeOff size={16} />}
          </button>

          {user ? (
            <div style={{ position: 'relative' }} ref={menuRef}>
              <button
                className="nav-avatar"
                onClick={() => setMenuOpen(o => !o)}
                title={displayName || user.email || ''}
              >
                {initial}
              </button>
              {menuOpen && (
                <div className="glass-panel nav-menu">
                  <div className="nav-menu-head">
                    <div className="nav-menu-name">{displayName || 'User'}</div>
                    <div className="nav-menu-email">{user.email}</div>
                    {!isConfigured && <div className="nav-menu-demo">demo mode</div>}
                  </div>
                  <Link className="nav-menu-item" to="/dashboard" onClick={() => setMenuOpen(false)}>Creator Hub</Link>
                  <Link className="nav-menu-item" to="/earnings" onClick={() => setMenuOpen(false)}>Earnings</Link>
                  <Link className="nav-menu-item" to="/publish" onClick={() => setMenuOpen(false)}>Publish Game</Link>
                  <Link className="nav-menu-item" to="/admin" onClick={() => setMenuOpen(false)}>Admin</Link>
                  <button className="nav-menu-item nav-menu-danger" onClick={() => { void handleSignOut() }}>Sign Out</button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" className="btn btn-amber btn-sm nav-signin-btn">
              Sign In
            </Link>
          )}

          <button
            className="nav-hamburger"
            onClick={() => setMobileOpen(o => !o)}
            aria-label="Toggle menu"
          >
            <HamburgerIcon />
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div className="nav-mobile-overlay" onClick={() => setMobileOpen(false)}>
          <div className="nav-mobile-panel" onClick={e => e.stopPropagation()}>
            {navItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => { playClick(); setMobileOpen(false) }}
                className={`nav-mobile-link${isActive(item.path) ? ' is-active' : ''}`}
              >
                <span className="nav-idx">{item.index}</span>
                {item.label}
              </Link>
            ))}
            <div className="nav-mobile-divider" />
            {user ? (
              <>
                <div className="nav-mobile-user">
                  <div className="nav-avatar" style={{ width: 28, height: 28, fontSize: 11 }}>{initial}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{displayName || 'User'}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{user.email}</div>
                  </div>
                </div>
                <Link className="nav-mobile-link" to="/dashboard" onClick={() => setMobileOpen(false)}>Creator Hub</Link>
                <Link className="nav-mobile-link" to="/earnings" onClick={() => setMobileOpen(false)}>Earnings</Link>
                <Link className="nav-mobile-link" to="/publish" onClick={() => setMobileOpen(false)}>Publish Game</Link>
                <button className="nav-mobile-link nav-menu-danger" onClick={() => { void handleSignOut() }}>Sign Out</button>
              </>
            ) : (
              <Link to="/login" className="btn btn-amber btn-block" onClick={() => setMobileOpen(false)}>
                Sign In
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  )
}
