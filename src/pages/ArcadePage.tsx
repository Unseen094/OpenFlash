import { useState, useEffect, useRef, useCallback } from 'react'

export default function ArcadePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isPlaying, setIsPlaying] = useState(true)
  const [fps, setFps] = useState(60)
  const [scale, setScale] = useState(1)
  const [crtEnabled, setCrtEnabled] = useState(false)
  const [bloomEnabled, setBloomEnabled] = useState(false)
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [showExport, setShowExport] = useState(false)
  const frameCount = useRef(0)
  const lastTime = useRef(performance.now())
  const animRef = useRef<number>(0)

  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height

    ctx.fillStyle = 'rgba(10, 11, 14, 0.15)'
    ctx.fillRect(0, 0, w, h)

    const time = Date.now() / 1000

    for (let i = 0; i < 3; i++) {
      const x = w / 2 + Math.sin(time * (0.5 + i * 0.3)) * (80 + i * 40)
      const y = h / 2 + Math.cos(time * (0.3 + i * 0.2)) * (60 + i * 30)
      const size = 4 + Math.sin(time * 2 + i) * 2

      ctx.beginPath()
      ctx.arc(x, y, size, 0, Math.PI * 2)
      ctx.fillStyle = i === 0 ? '#FFE600' : i === 1 ? '#00F0FF' : '#FF00AA'
      ctx.shadowColor = ctx.fillStyle
      ctx.shadowBlur = 16
      ctx.fill()
      ctx.shadowBlur = 0
    }

    frameCount.current++
    const now = performance.now()
    if (now - lastTime.current >= 1000) {
      setFps(frameCount.current)
      frameCount.current = 0
      lastTime.current = now
    }

    animRef.current = requestAnimationFrame(gameLoop)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = 800
    canvas.height = 450

    if (isPlaying) {
      animRef.current = requestAnimationFrame(gameLoop)
    }
    return () => cancelAnimationFrame(animRef.current)
  }, [isPlaying, gameLoop])

  const handleExport = () => {
    const projectData = {
      version: '1.0',
      canvas: { width: 800, height: 450 },
      scripts: ['OpenFlash.on("tick", () => { /* animation loop */ })'],
      assets: [],
      meta: { title: 'OpenFlash Export', created: new Date().toISOString() }
    }

    const runtime = `<script>(function(){const c=document.querySelector('canvas');const x=c.getContext('2d');let t=0;function loop(){t+=0.016;x.fillStyle='rgba(10,11,14,0.15)';x.fillRect(0,0,800,450);const e=Date.now()/1000;for(let i=0;i<3;i++){const a=400+Math.sin(e*(0.5+i*0.3))*(80+i*40),b=225+Math.cos(e*(0.3+i*0.2))*(60+i*30);x.beginPath();x.arc(a,b,4,0,6.28);x.fillStyle=['#FFE600','#00F0FF','#FF00AA'][i];x.fill();}requestAnimationFrame(loop);}loop();})()</script>`

    const html = `<!DOCTYPE html><html><head><title>OpenFlash Project</title><style>body{margin:0;background:#0A0B0E;display:flex;align-items:center;justify-content:center;min-height:100vh}canvas{max-width:100%;height:auto}</style></head><body><canvas width="800" height="450"></canvas>${runtime}</body></html>`

    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'openflash-project.html'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <span className="badge badge-yellow" style={{ marginBottom: 8, display: 'inline-block' }}>NOW PLAYING</span>
        <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 28, fontWeight: 700, marginBottom: 4 }}>
          Untitled Project
        </h1>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
          <span>by <strong>@anonymous</strong></span>
          <span>•</span>
          <span>0 plays</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>
        {/* Player */}
        <div>
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
              <span style={{ marginLeft: 8, flex: 1 }}>player_stage</span>
              <span style={{ color: fps > 55 ? 'var(--accent-green)' : 'var(--accent-orange)' }}>
                {fps} FPS
              </span>
            </div>

            <div style={{
              position: 'relative',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              transform: `scale(${scale})`,
              transformOrigin: 'top left'
            }}>
              <canvas
                ref={canvasRef}
                style={{
                  width: '100%',
                  height: 'auto',
                  display: 'block',
                  background: '#0A0B0E'
                }}
              />
              {crtEnabled && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.12) 0px, rgba(0,0,0,0.12) 1px, transparent 1px, transparent 2px)',
                  pointerEvents: 'none'
                }} />
              )}
              {bloomEnabled && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'radial-gradient(ellipse at center, rgba(0,240,255,0.08) 0%, transparent 70%)',
                  pointerEvents: 'none'
                }} />
              )}
            </div>

            {/* Controls */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 12,
              padding: '8px 0'
            }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className={`btn ${isPlaying ? 'btn-primary' : ''}`}
                  onClick={() => setIsPlaying(!isPlaying)}
                >
                  {isPlaying ? '⏸ Pause' : '▶ Play'}
                </button>
                <button className="btn btn-icon">⏮</button>
                <button className="btn btn-icon">⏭</button>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                  Scale:
                </span>
                {[1, 2].map(s => (
                  <button
                    key={s}
                    className={`btn ${scale === s ? 'btn-cyan' : ''}`}
                    style={{ padding: '4px 10px', fontSize: 11 }}
                    onClick={() => setScale(s)}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Comments */}
          <div className="glass-panel" style={{ padding: 20, marginTop: 16 }}>
            <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
              Frame Comments
            </h3>
            <div style={{
              textAlign: 'center',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--text-muted)',
              padding: '24px 0'
            }}>
              No comments yet. Be the first to leave feedback!
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Display Controls */}
          <div className="glass-panel" style={{ padding: 20 }}>
            <h3 style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: 1,
              marginBottom: 16
            }}>
              Display Controls
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer'
              }}>
                <span style={{ fontSize: 13 }}>CRT Scanlines</span>
                <div
                  onClick={() => setCrtEnabled(!crtEnabled)}
                  style={{
                    width: 36,
                    height: 20,
                    borderRadius: 10,
                    background: crtEnabled ? 'var(--accent-cyan)' : 'var(--bg-tertiary)',
                    position: 'relative',
                    transition: 'background var(--transition-fast)',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  <div style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: '#fff',
                    position: 'absolute',
                    top: 1,
                    left: crtEnabled ? 17 : 1,
                    transition: 'left var(--transition-fast)'
                  }} />
                </div>
              </label>

              <label style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer'
              }}>
                <span style={{ fontSize: 13 }}>Bloom FX</span>
                <div
                  onClick={() => setBloomEnabled(!bloomEnabled)}
                  style={{
                    width: 36,
                    height: 20,
                    borderRadius: 10,
                    background: bloomEnabled ? 'var(--accent-cyan)' : 'var(--bg-tertiary)',
                    position: 'relative',
                    transition: 'background var(--transition-fast)',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  <div style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: '#fff',
                    position: 'absolute',
                    top: 1,
                    left: bloomEnabled ? 17 : 1,
                    transition: 'left var(--transition-fast)'
                  }} />
                </div>
              </label>

              <label style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer'
              }}>
                <span style={{ fontSize: 13 }}>Vector Sharp</span>
                <div style={{
                  width: 36,
                  height: 20,
                  borderRadius: 10,
                  background: 'var(--accent-cyan)',
                  position: 'relative',
                  border: '1px solid var(--border-subtle)'
                }}>
                  <div style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: '#fff',
                    position: 'absolute',
                    top: 1,
                    left: 17
                  }} />
                </div>
              </label>
            </div>
          </div>

          {/* Rating */}
          <div className="glass-panel" style={{ padding: 20 }}>
            <h3 style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: 1,
              marginBottom: 16
            }}>
              Rate This Project
            </h3>

            <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: 24,
                    cursor: 'pointer',
                    color: star <= (hoverRating || rating) ? 'var(--accent-yellow)' : 'var(--bg-tertiary)',
                    transition: 'color var(--transition-fast)',
                    padding: 0
                  }}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                >
                  ★
                </button>
              ))}
            </div>
            <div style={{
              textAlign: 'center',
              marginTop: 8,
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--text-muted)'
            }}>
              {rating > 0 ? `${rating}.0 / 5.0` : 'Click to rate'}
            </div>
          </div>

          {/* Actions */}
          <div className="glass-panel" style={{ padding: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button className="btn btn-primary" onClick={handleExport}>
                📦 Export Offline HTML
              </button>
              <button className="btn" onClick={() => setShowExport(!showExport)}>
                🔗 Generate Embed
              </button>
              <button className="btn">
                💰 Tip Creator
              </button>
              <button className="btn btn-ghost">
                ☆ Favorite
              </button>
            </div>

            {showExport && (
              <div style={{ marginTop: 12 }}>
                <div className="input" style={{
                  width: '100%',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  padding: 8,
                  background: 'var(--bg-primary)',
                  wordBreak: 'break-all'
                }}>
                  {`<iframe src="https://openflash.io/embed/neon-vector" width="800" height="450" frameborder="0"></iframe>`}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
