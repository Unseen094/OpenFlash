import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { listPublishedGames } from '../lib/monetization/games'
import { IconZap, IconPackage, IconFilm, IconMusic, IconPalette, IconWrench, IconArrowRight, IconPlay, IconGamepad, IconBolt } from '../components/Icons'

const features = [
  { icon: <IconZap size={20} />, title: 'TypeScript Runtime', desc: 'Sandboxed API replacing ActionScript with physics, collision, and scene management.', color: '#FFD400' },
  { icon: <IconPackage size={20} />, title: 'Offline Export', desc: 'Compile projects into standalone .html files with zero external dependencies.', color: '#00E5FF' },
  { icon: <IconFilm size={20} />, title: 'Multi-Layer Timeline', desc: 'Frame-by-frame animation with motion tweens, onion skinning, and keyframe tools.', color: '#FF2EB3' },
  { icon: <IconMusic size={20} />, title: 'Chiptune Synth', desc: 'Built-in retro sound generator and Web Audio matrix directly in the editor.', color: '#16F08C' },
  { icon: <IconPalette size={20} />, title: 'Vector Canvas', desc: 'Pen, brush, shape tools with magnetic grid snapping and node adjustment.', color: '#FF8A00' },
  { icon: <IconWrench size={20} />, title: 'Shader FX', desc: 'CRT scanlines, chromatic aberration, and bloom overlays for any project.', color: '#FFD400' },
]

export default function LandingPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { user } = useAuth()
  const games = listPublishedGames().slice(0, 6)
  const totalPlays = listPublishedGames().reduce((s, g) => s + g.plays, 0)
  const creators = new Set(listPublishedGames().map(g => g.creatorId)).size
  const projectCount = listPublishedGames().length
  const [typedCode, setTypedCode] = useState('')

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let last = performance.now()
    const particles: Array<{ x: number; y: number; vx: number; vy: number; r: number; color: string; life: number }> = []
    let mouseX = 0
    let mouseY = 0
    const stars: Array<{ x: number; y: number; r: number; phase: number }> = []

    const rect = canvas.getBoundingClientRect()
    for (let i = 0; i < 22; i++) {
      stars.push({
        x: Math.random() * rect.width,
        y: Math.random() * rect.height,
        r: 0.5 + Math.random() * 1.2,
        phase: Math.random() * Math.PI * 2,
      })
    }

    const handleMove = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect()
      mouseX = e.clientX - r.left
      mouseY = e.clientY - r.top
    }
    canvas.addEventListener('mousemove', handleMove)

    const palette = ['#FFD400', '#00E5FF', '#FF2EB3', '#16F08C']

    const render = (now: number) => {
      const dt = Math.min(50, now - last)
      last = now
      const r = canvas.getBoundingClientRect()
      const w = r.width
      const h = r.height
      ctx.clearRect(0, 0, w, h)

      const time = now / 1000

      for (const s of stars) {
        const a = 0.4 + 0.3 * Math.sin(time * 1.4 + s.phase)
        ctx.fillStyle = `rgba(242, 243, 245, ${a})`
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fill()
      }

      if (mouseX > 0 || mouseY > 0) {
        for (let i = 0; i < 2; i++) {
          if (Math.random() < 0.7) {
            const angle = Math.random() * Math.PI * 2
            const speed = 0.3 + Math.random() * 0.8
            particles.push({
              x: mouseX,
              y: mouseY,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              r: 1 + Math.random() * 2,
              color: palette[Math.floor(Math.random() * palette.length)],
              life: 1,
            })
          }
        }
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.x += p.vx
        p.y += p.vy
        p.life -= dt / 1200
        if (p.life <= 0) {
          particles.splice(i, 1)
          continue
        }
        ctx.save()
        ctx.globalAlpha = p.life
        ctx.shadowColor = p.color
        ctx.shadowBlur = 12
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      const cx = w * 0.18
      const cy = h * 0.5
      const cx2 = w * 0.82
      const cy2 = h * 0.55

      ctx.save()
      ctx.lineWidth = 1
      ctx.strokeStyle = `rgba(0, 229, 255, ${0.3 + 0.15 * Math.sin(time)})`
      ctx.beginPath()
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2 + time * 0.5
        const r1 = 30 + Math.sin(time * 2 + i) * 8
        const x = cx + Math.cos(angle) * r1
        const y = cy + Math.sin(angle) * r1
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.stroke()
      ctx.restore()

      ctx.save()
      ctx.fillStyle = '#FFD400'
      ctx.shadowColor = '#FFD400'
      ctx.shadowBlur = 30
      ctx.beginPath()
      ctx.arc(cx, cy, 14, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()

      ctx.save()
      ctx.fillStyle = '#FF2EB3'
      ctx.shadowColor = '#FF2EB3'
      ctx.shadowBlur = 30
      ctx.beginPath()
      ctx.arc(cx2, cy2, 18, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()

      for (let i = 0; i < 4; i++) {
        const t = (time * 0.3 + i * 0.25) % 1
        const x1 = cx + (cx2 - cx) * t
        const y1 = cy + (cy2 - cy) * t + Math.sin(t * Math.PI) * -40
        const r = 4 * (1 - t)
        ctx.save()
        ctx.globalAlpha = 1 - t
        ctx.fillStyle = '#00E5FF'
        ctx.shadowColor = '#00E5FF'
        ctx.shadowBlur = 16
        ctx.beginPath()
        ctx.arc(x1, y1, r, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      raf = requestAnimationFrame(render)
    }
    raf = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('mousemove', handleMove)
    }
  }, [])

  useEffect(() => {
    const code = `const player = OpenFlash.createSprite({
  color: '#00E5FF', x: 80, y: 200, width: 40, height: 24
})

OpenFlash.on('tick', (e) => {
  player.x += 120 * e.delta
  if (player.x > 760) player.x = 80
})

OpenFlash.on('pointerDown', (e) => {
  OpenFlash.drawParticle(e.x, e.y, { color: '#FFE600', count: 18 })
  OpenFlash.playSound('hit')
})`
    let i = 0
    const tick = () => {
      i += 2
      setTypedCode(code.slice(0, i))
      if (i < code.length) setTimeout(tick, 18)
    }
    const t = setTimeout(tick, 600)
    return () => clearTimeout(t)
  }, [])

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
            <span className="tiny" style={{ color: 'var(--green)' }}>v1.0 — STUDIO LIVE</span>
         </div>

          <h1 className="display" style={{ margin: '20px 0' }}>
            <span style={{ color: 'var(--amber)' }}>ActionScript</span>
            <br />
            is dead.
            <br />
            <span style={{ color: 'var(--cyan)' }}>OpenFlash</span> is the sequel.
         </h1>

          <p className="hero-sub">
            A modern creation portal for vector games, interactive stories, and chiptune
            experiments. Draw, animate, and code — then ship to the arcade and earn
            from your players.
         </p>

          <div className="row" style={{ flexWrap: 'wrap' }}>
            <Link to="/studio" className="btn btn-amber btn-lg">
              Open Studio <IconArrowRight size={14} />
           </Link>
            <Link to="/arcade" className="btn btn-lg">
              <IconPlay size={13} /> Browse Arcade
           </Link>
            <Link to="/templates" className="btn btn-ghost btn-lg">
              <IconBolt size={13} /> Templates
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

        <div className="animate-slide-up" style={{ animationDelay: '0.15s' }}>
          <div className="panel corner hero-stage">
            <div className="window-bar">
              <span className="dot" style={{ background: '#FF5F57' }} />
              <span className="dot" style={{ background: '#FFBD2E' }} />
              <span className="dot" style={{ background: '#28CA41' }} />
              <span className="window-title">stage.canvas — live</span>
              <span className="row" style={{ marginLeft: 'auto', gap: 6 }}>
                <span className="tiny" style={{ color: 'var(--green)' }}>● running</span>
             </span>
           </div>
            <canvas ref={canvasRef} className="stage-canvas" />
            <div className="window-hint">move your cursor across the stage</div>
         </div>
       </div>
     </section>

      <section style={{ padding: '72px 0 32px' }}>
        <div className="row-between" style={{ marginBottom: 28, alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <span className="sec-label"><b>01</b> THE STACK</span>
            <h2 className="h1" style={{ marginTop: 10 }}>Everything in one editor</h2>
         </div>
          <p className="muted small" style={{ maxWidth: 340, textAlign: 'right' }}>
            Six systems, one engine. From blank frame to published game in the same window.
         </p>
       </div>

        <div className="feature-grid">
          {features.map((f, i) => (
            <div key={i} className="panel panel-hover corner" style={{ padding: 22, cursor: 'default' }}>
              <div className="feature-icon" style={{ color: f.color, borderColor: `${f.color}40`, background: `${f.color}14` }}>
                {f.icon}
             </div>
              <div className="tiny" style={{ marginBottom: 6, opacity: 0.7 }}>0{i + 1}</div>
              <h3 className="h3" style={{ marginBottom: 6 }}>{f.title}</h3>
              <p className="small muted" style={{ lineHeight: 1.55 }}>{f.desc}</p>
           </div>
          ))}
       </div>
     </section>

      <section style={{ padding: '32px 0 72px' }}>
        <div className="row-between" style={{ marginBottom: 28, alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <span className="sec-label"><b>02</b> LIVE PREVIEW</span>
            <h2 className="h1" style={{ marginTop: 10 }}>Code that runs in the editor</h2>
         </div>
          <Link to="/docs" className="btn btn-ghost btn-sm">
            Read the docs <IconArrowRight size={12} />
         </Link>
       </div>

        <div className="code-showcase">
          <div className="code-showcase-head">
            <span className="tiny">main.ts</span>
            <span className="tiny" style={{ color: 'var(--green)' }}>● executing</span>
         </div>
          <pre className="code-block">
            <code>{typedCode}<span className="cursor-blink">▍</span></code>
         </pre>
       </div>
     </section>

      <section style={{ padding: '32px 0 72px' }}>
        <div className="row-between" style={{ marginBottom: 24 }}>
          <div>
            <span className="sec-label"><b>03</b> ARCADE</span>
            <h2 className="h1" style={{ marginTop: 10 }}>Community Feed</h2>
         </div>
          <Link to="/arcade" className="btn btn-ghost btn-sm">
            View All <IconArrowRight size={12} />
         </Link>
       </div>

        {games.length === 0 ? (
          <div className="empty-state">
            <IconGamepad size={28} style={{ opacity: 0.5, marginBottom: 10 }} />
            <div>No projects published yet</div>
            {user ? <div style={{ marginTop: 6 }}>Be the first to create something</div> : <div style={{ marginTop: 6 }}>Sign in and build the first one</div>}
         </div>
        ) : (
          <div className="feature-grid">
            {games.map(g => (
              <Link
                key={g.id}
                to={`/play/${g.id}`}
                className="panel panel-hover corner game-card"
                style={{ overflow: 'hidden', textDecoration: 'none', color: 'inherit' }}
              >
                {g.thumbnail ? (
                  <div className="game-thumb" style={{ backgroundImage: `url(${g.thumbnail})` }} />
                ) : (
                  <div className="game-thumb-placeholder" style={{ borderColor: g.plan === 'alpha' ? 'var(--pink)' : g.plan === 'sigma' ? 'var(--cyan)' : 'var(--green)' }}>
                    {g.title.charAt(0).toUpperCase()}
                 </div>
                )}
                <div style={{ padding: 14 }}>
                  <div className="row-between">
                    <h3 className="h3" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.title}</h3>
                    <span className="badge" style={g.priceUsd > 0 ? { color: 'var(--amber)', borderColor: 'rgba(255,212,0,0.35)' } : undefined}>
                      {g.priceUsd > 0 ? `$${g.priceUsd.toFixed(2)}` : 'FREE'}
                   </span>
                 </div>
                  <div className="tiny" style={{ marginTop: 6, opacity: 0.7 }}>
                    {g.plan.toUpperCase()} · {g.plays} plays · {g.creatorName}
                 </div>
               </div>
             </Link>
            ))}
         </div>
        )}
     </section>

      <section style={{ padding: '32px 0 72px' }}>
        <div className="panel corner pricing-shell">
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <span className="sec-label" style={{ justifyContent: 'center' }}><b>04</b> CREATOR PLANS</span>
            <h2 className="h1" style={{ marginTop: 10 }}>Pick a tier, ship your work</h2>
            <p className="muted small" style={{ marginTop: 8, maxWidth: 480, marginInline: 'auto' }}>
              Every plan ships with the full editor. Higher tiers unlock higher revenue shares and unlimited publishing.
           </p>
         </div>

          <div className="pricing-grid">
            {[
              { id: 'beta', name: 'Beta', price: 0, color: 'var(--green)', accent: '#16F08C', share: '40/50%', games: '3 games', perks: ['Ad revenue', 'Download revenue', 'Community support'] },
              { id: 'sigma', name: 'Sigma', price: 9.99, color: 'var(--cyan)', accent: '#00E5FF', share: '50/60%', games: '15 games', perks: ['Custom pricing', 'Priority support', 'Analytics'], featured: true },
              { id: 'alpha', name: 'Alpha', price: 29.99, color: 'var(--pink)', accent: '#FF2EB3', share: '60/70%', games: 'Unlimited', perks: ['Disable ads', 'Dedicated AM', 'API access'] },
            ].map(p => (
              <div key={p.id} className={`pricing-card${p.featured ? ' is-featured' : ''}`}>
                {p.featured && <span className="badge badge-amber pricing-flag">POPULAR</span>}
                <div className="pricing-name" style={{ color: p.color }}>{p.name.toUpperCase()}</div>
                <div className="pricing-price">
                  {p.price === 0 ? <span style={{ fontSize: 36 }}>Free</span> : (
                    <>
                      <span style={{ fontSize: 36 }}>${p.price}</span>
                      <span className="muted small" style={{ marginLeft: 6 }}>/mo</span>
                    </>
                  )}
               </div>
                <div className="tiny" style={{ marginTop: 4, opacity: 0.7 }}>{p.share} rev share · {p.games}</div>
                <div className="pricing-divider" />
                <ul className="pricing-perks">
                  {p.perks.map(perk => (
                    <li key={perk} style={{ color: 'var(--ink-2)' }}>
                      <span style={{ color: p.accent, marginRight: 6 }}>✓</span>
                      {perk}
                   </li>
                  ))}
               </ul>
                <Link to={`/checkout?plan=${p.id}`} className={`btn ${p.featured ? 'btn-amber' : ''} btn-block`}>
                  {p.price === 0 ? 'Start free' : `Choose ${p.name}`}
               </Link>
             </div>
            ))}
         </div>
       </div>
     </section>

      <section style={{ padding: '64px 0' }}>
        <div className="panel corner manifesto" style={{ padding: '56px 40px' }}>
          <span className="sec-label" style={{ justifyContent: 'center' }}><b>X</b> WHY</span>
          <blockquote className="manifesto-quote">
            "We grew up drawing vectors in Flash, writing ActionScript, and uploading to
            portals that no longer exist. OpenFlash is our love letter to that era —
            rebuilt for the modern web with the tools we always wished we had."
         </blockquote>
          <div className="tiny" style={{ color: 'var(--ink-2)' }}>— THE OPENFLASH TEAM</div>
       </div>
     </section>

      <footer className="site-footer">
        <div className="row" style={{ gap: 8 }}>
          <span className="nav-mark" style={{ width: 24, height: 24, fontSize: 10 }}>OF</span>
          <span className="tiny" style={{ opacity: 0.7 }}>OPENFLASH © {new Date().getFullYear()}</span>
       </div>
        <div className="row" style={{ gap: 20, flexWrap: 'wrap' }}>
          <Link to="/docs" className="tiny" style={{ color: 'var(--ink-3)' }}>DOCS</Link>
          <Link to="/arcade" className="tiny" style={{ color: 'var(--ink-3)' }}>ARCADE</Link>
          <Link to="/studio" className="tiny" style={{ color: 'var(--ink-3)' }}>STUDIO</Link>
       </div>
     </footer>
   </div>
  )
}
