import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { listPublishedGames } from '../lib/monetization/games'
import { IconZap, IconPackage, IconFilm, IconMusic, IconPalette, IconWrench, IconArrowRight } from '../components/Icons'

const features = [
  { icon: <IconZap size={20} />, title: 'TypeScript Runtime', desc: 'Sandboxed API replacing ActionScript with physics, collision, and scene management.', color: 'var(--accent-yellow)' },
  { icon: <IconPackage size={20} />, title: 'Offline Export', desc: 'Compile projects into standalone .html files with zero external dependencies.', color: 'var(--accent-cyan)' },
  { icon: <IconFilm size={20} />, title: 'Multi-Layer Timeline', desc: 'Frame-by-frame animation with motion tweens, onion skinning, and keyframe tools.', color: 'var(--accent-magenta)' },
  { icon: <IconMusic size={20} />, title: 'Chiptune Synth', desc: 'Built-in retro sound generator and Web Audio matrix directly in the editor.', color: 'var(--accent-green)' },
  { icon: <IconPalette size={20} />, title: 'Vector Canvas', desc: 'Pen, brush, shape tools with magnetic grid snapping and node adjustment.', color: 'var(--accent-orange)' },
  { icon: <IconWrench size={20} />, title: 'Shader FX', desc: 'CRT scanlines, chromatic aberration, and bloom overlays for any project.', color: 'var(--accent-yellow)' },
]

const demoShape = (x: number, y: number, r: number, color: string, alpha: number) => ({
  x, y, r, color, alpha,
  vx: (Math.random() - 0.5) * 0.6,
  vy: (Math.random() - 0.5) * 0.6,
})

export default function LandingPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const lastPos = useRef<{ x: number; y: number } | null>(null)
  const { user } = useAuth()
  const [now] = useState(() => Date.now())
  const games = listPublishedGames().slice(0, 6)
  const totalPlays = listPublishedGames().reduce((s, g) => s + g.plays, 0)
  const creators = new Set(listPublishedGames().map(g => g.creatorId)).size
  const projectCount = listPublishedGames().length

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio
      canvas.height = canvas.offsetHeight * window.devicePixelRatio
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  const drawStar = (cx: number, cy: number, spikes: number, outerR: number, innerR: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let rot = Math.PI / 2 * 3
    const step = Math.PI / spikes
    ctx.beginPath()
    ctx.moveTo(cx, cy - outerR)
    for (let i = 0; i < spikes; i++) {
      ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR)
      rot += step
      ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR)
      rot += step
    }
    ctx.lineTo(cx, cy - outerR)
    ctx.closePath()
    ctx.fillStyle = 'var(--accent-yellow)'
    ctx.fill()
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.offsetWidth
    const h = canvas.offsetHeight
    const stars = Array.from({ length: 14 }, () => demoShape(
      Math.random() * w, Math.random() * h,
      6 + Math.random() * 18,
      ['var(--accent-yellow)', 'var(--accent-cyan)', 'var(--accent-magenta)', 'var(--accent-green)'][Math.floor(Math.random() * 4)],
      0.5 + Math.random() * 0.5
    ))

    const drawDemo = () => {
      ctx.clearRect(0, 0, w, h)
      const time = Date.now() / 1000

      for (const s of stars) {
        s.x += s.vx
        s.y += s.vy
        if (s.x < 0 || s.x > w) s.vx *= -1
        if (s.y < 0 || s.y > h) s.vy *= -1
        ctx.save()
        ctx.globalAlpha = s.alpha * (0.6 + 0.4 * Math.sin(time * 2 + s.x))
        ctx.shadowColor = s.color
        ctx.shadowBlur = 18
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = s.color
        ctx.fill()
        ctx.restore()
      }

      const cx = w / 2 + Math.sin(time * 0.5) * 60
      const cy = h / 2 + Math.cos(time * 0.3) * 24
      ctx.shadowColor = 'var(--accent-yellow)'
      ctx.shadowBlur = 28
      drawStar(cx, cy, 5, 46, 23)
      ctx.shadowBlur = 0
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.35)'
      ctx.lineWidth = 1
      for (let i = 0; i < 4; i++) {
        const r = 80 + i * 34 + Math.sin(time + i) * 8
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.stroke()
      }
    }

    const raf = () => { drawDemo(); requestAnimationFrame(raf) }
    const id = requestAnimationFrame(raf)
    return () => cancelAnimationFrame(id)
  }, [])

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDrawing(true)
    const rect = canvasRef.current!.getBoundingClientRect()
    lastPos.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const handleMouseUp = () => {
    setIsDrawing(false)
    lastPos.current = null
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !lastPos.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(x, y)
    ctx.strokeStyle = 'var(--accent-cyan)'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.shadowColor = 'var(--accent-cyan)'
    ctx.shadowBlur = 12
    ctx.stroke()
    ctx.shadowBlur = 0

    lastPos.current = { x, y }
  }

  const stats = [
    { value: creators || (user ? '1' : '0'), label: 'Creators' },
    { value: String(projectCount || 0), label: 'Projects' },
    { value: totalPlays ? totalPlays.toLocaleString() : '0', label: 'Plays' },
    { value: '60fps', label: 'Playback' },
  ]

  return (
    <div className="container" style={{ paddingTop: 8 }}>
      <section className="hero">
        <div className="animate-slide-up" style={{ maxWidth: 620 }}>
          <div className="hero-badge">
            <span className="dot dot-live" />
            <span className="tiny" style={{ color: 'var(--green)' }}>v1.0 NOW LIVE</span>
          </div>

          <h1 className="display" style={{ margin: '20px 0' }}>
            <span style={{ color: 'var(--accent-yellow)' }}>ActionScript</span>
            <br />
            is dead. Long live
            <br />
            <span style={{ color: 'var(--accent-cyan)' }}>OpenFlash.</span>
          </h1>

          <p className="hero-sub">
            The modern interactive creation portal. Build, play, and share
            vector experiences with TypeScript, HTML5 Canvas, and a sandboxed
            runtime — then ship them to the arcade and earn.
          </p>

          <div className="row" style={{ flexWrap: 'wrap' }}>
            <Link to="/studio" className="btn btn-amber btn-lg">
              Launch Studio <IconArrowRight size={14} />
            </Link>
            <Link to="/arcade" className="btn btn-lg">
              Browse Arcade
            </Link>
          </div>

          <div className="hero-stats">
            {stats.map(s => (
              <div key={s.label}>
                <div className="hero-stat-value">{s.value}</div>
                <div className="hero-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="panel corner" style={{ padding: 14 }}>
            <div className="window-bar">
              <span className="dot" style={{ background: '#FF5F57' }} />
              <span className="dot" style={{ background: '#FFBD2E' }} />
              <span className="dot" style={{ background: '#28CA41' }} />
              <span className="window-title">interactive_stage.canvas</span>
            </div>
            <canvas
              ref={canvasRef}
              className="stage-canvas"
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onMouseMove={handleMouseMove}
            />
            <div className="window-hint">Click and draw on the canvas</div>
          </div>
        </div>
      </section>

      <section style={{ padding: '72px 0' }}>
        <div className="row-between" style={{ marginBottom: 36, alignItems: 'flex-end' }}>
          <div>
            <span className="sec-label"><b>01</b> CAPABILITIES</span>
            <h2 className="h1" style={{ marginTop: 10 }}>Built for the modern era</h2>
          </div>
          <p className="muted small" style={{ maxWidth: 340, textAlign: 'right' }}>
            Six systems, one engine. Everything a creator needs to go from blank frame to published game.
          </p>
        </div>

        <div className="feature-grid">
          {features.map((f, i) => (
            <div key={i} className="panel panel-hover corner" style={{ padding: 22, cursor: 'default' }}>
              <div className="feature-icon" style={{ color: f.color, borderColor: `color-mix(in srgb, ${f.color} 25%, transparent)`, background: `color-mix(in srgb, ${f.color} 8%, transparent)` }}>
                {f.icon}
              </div>
              <div className="tiny" style={{ marginBottom: 6, opacity: 0.7 }}>0{i + 1}.{String.fromCharCode(97 + i)}</div>
              <h3 className="h3" style={{ marginBottom: 6 }}>{f.title}</h3>
              <p className="small muted" style={{ lineHeight: 1.55 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: '72px 0' }}>
        <div className="row-between" style={{ marginBottom: 24 }}>
          <div>
            <span className="sec-label"><b>02</b> ARCADE</span>
            <h2 className="h1" style={{ marginTop: 10 }}>Community Feed</h2>
          </div>
          <Link to="/arcade" className="btn btn-ghost">
            View All <IconArrowRight size={13} />
          </Link>
        </div>

        {games.length === 0 ? (
          <div className="empty-state">
            No projects published yet.
            {user ? ' Be the first to create something!' : ' Sign in and build the first one.'}
          </div>
        ) : (
          <div className="feature-grid">
            {games.map(g => (
              <div key={g.id} className="panel panel-hover corner" style={{ overflow: 'hidden' }}>
                {g.thumbnail ? (
                  <div className="game-thumb" style={{ backgroundImage: `url(${g.thumbnail})` }} />
                ) : (
                  <div className="game-thumb-placeholder" style={{ borderColor: (g.plan === 'alpha' ? 'var(--pink)' : g.plan === 'sigma' ? 'var(--cyan)' : 'var(--green)') }}>
                    {g.title.charAt(0).toUpperCase()}
                  </div>
                )}
                <div style={{ padding: 14 }}>
                  <div className="row-between">
                    <h3 className="h3" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.title}</h3>
                    <span className="badge" style={g.priceUsd > 0 ? { color: 'var(--amber)', borderColor: 'rgba(255,212,0,0.35)' } : undefined}>
                      {g.priceUsd > 0 ? `$${g.priceUsd}` : 'FREE'}
                    </span>
                  </div>
                  <div className="tiny" style={{ marginTop: 6, opacity: 0.7 }}>
                    {g.plan.toUpperCase()} · {g.plays} plays · {new Date(g.publishedAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={{ padding: '64px 0' }}>
        <div className="panel corner manifesto" style={{ padding: '56px 40px' }}>
          <span className="sec-label" style={{ justifyContent: 'center' }}><b>X</b> WHY</span>
          <blockquote className="manifesto-quote">
            "We grew up drawing vectors in Flash, writing ActionScript, and uploading to portals that no longer exist. OpenFlash is our love letter to that era — rebuilt for the modern web with the tools we always wished we had."
          </blockquote>
          <div className="tiny" style={{ color: 'var(--ink-2)' }}>— THE OPENFLASH TEAM</div>
        </div>
      </section>

      <footer className="site-footer">
        <div className="row" style={{ gap: 8 }}>
          <span className="nav-mark" style={{ width: 24, height: 24, fontSize: 10 }}>OF</span>
          <span className="tiny" style={{ opacity: 0.7 }}>OPENFLASH © {new Date(now).getFullYear()}</span>
        </div>
        <div className="row" style={{ gap: 20 }}>
          {['GitHub', 'Discord', 'Docs'].map(l => (
            <a key={l} href="#" className="tiny" style={{ color: 'var(--ink-3)', transition: 'color 120ms' }} onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-3)')}>
              {l.toUpperCase()}
            </a>
          ))}
        </div>
      </footer>
    </div>
  )
}