import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { IconVolumeOn, IconVolumeOff } from './Icons'

const navItems = [
  { path: '/', label: 'Home', index: '00' },
  { path: '/arcade', label: 'Arcade', index: '01' },
  { path: '/studio', label: 'Studio', index: '02' },
  { path: '/templates', label: 'Templates', index: '03' },
  { path: '/dashboard', label: 'Hub', index: '04' },
  { path: '/docs', label: 'Docs', index: '05' },
]

export default function Navbar({ konamiActive }: { konamiActive: boolean }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isConfigured, signOut } = useAuth()
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
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

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)

  return (
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

      <div className="row" style={{ gap: 10 }}>
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
                <button className="nav-menu-item nav-menu-danger" onClick={handleSignOut}>Sign Out</button>
              </div>
            )}
          </div>
        ) : (
          <Link to="/login" className="btn btn-amber btn-sm" style={{ padding: '7px 14px' }}>
            Sign In
          </Link>
        )}
      </div>
    </nav>
  )
}