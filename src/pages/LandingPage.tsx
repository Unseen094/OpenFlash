import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

export default function LandingPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const lastPos = useRef<{ x: number; y: number } | null>(null)

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
    const w = canvas.offsetWidth
    const h = canvas.offsetHeight

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

    const drawDemo = () => {
      ctx.clearRect(0, 0, w, h)

      const time = Date.now() / 1000
      const cx = w / 2 + Math.sin(time * 0.5) * 40
      const cy = h / 2 + Math.cos(time * 0.3) * 20

      ctx.shadowColor = 'var(--accent-yellow)'
      ctx.shadowBlur = 32
      drawStar(cx, cy, 5, 60, 30)

      ctx.shadowBlur = 0
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)'
      ctx.lineWidth = 1
      for (let i = 0; i < 5; i++) {
        const r = 100 + i * 40 + Math.sin(time + i) * 10
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.stroke()
      }
    }

    const interval = setInterval(drawDemo, 1000 / 60)
    return () => clearInterval(interval)
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

  return (
    <div style={{ padding: '0 24px' }}>
      {/* Hero Section */}
      <section style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 40,
        alignItems: 'center',
        minHeight: 'calc(100vh - 80px)',
        padding: '40px 0'
      }}>
        <div className="animate-slide-up">
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 12px',
            background: 'rgba(255, 230, 0, 0.08)',
            border: '1px solid rgba(255, 230, 0, 0.2)',
            borderRadius: 'var(--radius-xl)',
            marginBottom: 24
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-green)', boxShadow: '0 0 8px var(--accent-green)' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-green)' }}>
              v1.0 NOW LIVE
            </span>
          </div>

          <h1 style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'clamp(40px, 6vw, 72px)',
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: '-0.03em',
            marginBottom: 20
          }}>
            <span style={{ color: 'var(--accent-yellow)' }}>ActionScript</span>
            <br />
            is dead. Long live
            <br />
            <span style={{ color: 'var(--accent-cyan)' }}>OpenFlash.</span>
          </h1>

          <p style={{
            fontSize: 16,
            lineHeight: 1.6,
            color: 'var(--text-secondary)',
            maxWidth: 480,
            marginBottom: 32
          }}>
            The modern WebGL vector creation portal. Build, play, and share
            interactive experiences with TypeScript, HTML5 Canvas, and a
            sandboxed runtime engine.
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link to="/studio" className="btn btn-primary" style={{ padding: '12px 24px', fontSize: 14 }}>
              Launch Studio →
            </Link>
            <Link to="/arcade" className="btn" style={{ padding: '12px 24px', fontSize: 14 }}>
              Browse Arcade
            </Link>
          </div>

          <div style={{ display: 'flex', gap: 24, marginTop: 40 }}>
            {[
              { value: '0', label: 'Creators' },
              { value: '0', label: 'Projects' },
              { value: '60fps', label: 'Playback' }
            ].map(stat => (
              <div key={stat.label}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: 'var(--accent-yellow)' }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="glass-panel" style={{ padding: 16 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 12,
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--text-muted)'
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#FF5F57' }} />
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#FFBD2E' }} />
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#28CA41' }} />
              <span style={{ marginLeft: 8 }}>interactive_stage.canvas</span>
            </div>
            <canvas
              ref={canvasRef}
              style={{
                width: '100%',
                height: 360,
                borderRadius: 'var(--radius-md)',
                cursor: 'crosshair',
                display: 'block'
              }}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onMouseMove={handleMouseMove}
            />
            <div style={{
              marginTop: 8,
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--text-muted)',
              textAlign: 'center'
            }}>
              Click and draw on the canvas
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section style={{ padding: '80px 0' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span className="badge badge-cyan" style={{ marginBottom: 12 }}>CORE FEATURES</span>
          <h2 style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 36,
            fontWeight: 700,
            letterSpacing: '-0.02em'
          }}>
            Built for the modern era
          </h2>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16
        }}>
          {[
            {
              icon: '⚡',
              title: 'TypeScript Runtime',
              desc: 'Sandboxed API replacing ActionScript with full physics, collision, and scene management.',
              color: 'var(--accent-yellow)'
            },
            {
              icon: '📦',
              title: 'Offline Export',
              desc: 'Compile projects into standalone .html files with zero external dependencies.',
              color: 'var(--accent-cyan)'
            },
            {
              icon: '🎬',
              title: 'Multi-Layer Timeline',
              desc: 'Frame-by-frame animation with motion tweens, onion skinning, and keyframe tools.',
              color: 'var(--accent-magenta)'
            },
            {
              icon: '🎵',
              title: 'Chiptune Synth',
              desc: 'Built-in retro sound generator and Web Audio matrix directly in the editor.',
              color: 'var(--accent-green)'
            },
            {
              icon: '🎨',
              title: 'Vector Canvas',
              desc: 'Pen, brush, shape tools with magnetic grid snapping and node adjustment.',
              color: 'var(--accent-orange)'
            },
            {
              icon: '🔧',
              title: 'Shader FX',
              desc: 'CRT scanlines, chromatic aberration, and bloom overlays for any project.',
              color: 'var(--accent-yellow)'
            }
          ].map((feature, i) => (
            <div
              key={i}
              className="glass-panel glass-panel-hover"
              style={{
                padding: 24,
                transition: 'all var(--transition-base)',
                cursor: 'default'
              }}
            >
              <div style={{
                width: 40,
                height: 40,
                borderRadius: 'var(--radius-md)',
                background: `${feature.color}15`,
                border: `1px solid ${feature.color}30`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                marginBottom: 16
              }}>
                {feature.icon}
              </div>
              <h3 style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 16,
                fontWeight: 600,
                marginBottom: 8
              }}>
                {feature.title}
              </h3>
              <p style={{
                fontSize: 13,
                lineHeight: 1.5,
                color: 'var(--text-secondary)'
              }}>
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Community Feed */}
      <section style={{ padding: '80px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32 }}>
          <div>
            <span className="badge badge-yellow" style={{ marginBottom: 12 }}>TRENDING</span>
            <h2 style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 36,
              fontWeight: 700,
              letterSpacing: '-0.02em'
            }}>
              Community Feed
            </h2>
          </div>
          <Link to="/arcade" className="btn btn-ghost">
            View All →
          </Link>
        </div>

        <div style={{
          textAlign: 'center',
          padding: '48px 0',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          color: 'var(--text-muted)'
        }}>
          No projects published yet. Be the first to create something!
        </div>
      </section>

      {/* Manifesto */}
      <section style={{ padding: '80px 0', textAlign: 'center' }}>
        <div className="glass-panel" style={{ padding: '60px 40px', maxWidth: 720, margin: '0 auto' }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--accent-cyan)',
            textTransform: 'uppercase',
            letterSpacing: 2,
            marginBottom: 20
          }}>
            The Manifesto
          </div>
          <blockquote style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'clamp(20px, 3vw, 28px)',
            fontWeight: 600,
            lineHeight: 1.4,
            letterSpacing: '-0.02em',
            marginBottom: 24
          }}>
            "We grew up drawing vectors in Flash, writing ActionScript, and
            uploading to portals that no longer exist. OpenFlash is our love
            letter to that era — rebuilt for the modern web with the tools
            we always wished we had."
          </blockquote>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            — The OpenFlash Team
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        padding: '40px 0',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 24,
            height: 24,
            background: 'var(--accent-yellow)',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            fontSize: 10,
            color: 'var(--bg-primary)'
          }}>
            OF
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
            OPENFLASH © 2026
          </span>
        </div>
        <div style={{ display: 'flex', gap: 24, fontSize: 12, color: 'var(--text-muted)' }}>
          <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>GitHub</a>
          <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>Discord</a>
          <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>Docs</a>
        </div>
      </footer>
    </div>
  )
}
