import { useEffect, useRef } from 'react'

export default function KonamiOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const particles: Array<{
      x: number; y: number; vx: number; vy: number; life: number; color: string
    }> = []

    const colors = ['#FFE600', '#00F0FF', '#FF00AA', '#00FF88']

    for (let i = 0; i < 100; i++) {
      particles.push({
        x: canvas.width / 2,
        y: canvas.height / 2,
        vx: (Math.random() - 0.5) * 16,
        vy: (Math.random() - 0.5) * 16,
        life: 1,
        color: colors[Math.floor(Math.random() * colors.length)]
      })
    }

    let animId: number
    const animate = () => {
      ctx.fillStyle = 'rgba(10, 11, 14, 0.1)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      particles.forEach((p, i) => {
        p.x += p.vx
        p.y += p.vy
        p.life -= 0.01
        p.vy += 0.2

        if (p.life > 0) {
          ctx.fillStyle = p.color + Math.floor(p.life * 255).toString(16).padStart(2, '0')
          ctx.fillRect(p.x, p.y, 4, 4)
        }
      })

      if (particles.some(p => p.life > 0)) {
        animId = requestAnimationFrame(animate)
      }
    }

    animate()
    return () => cancelAnimationFrame(animId)
  }, [])

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9998,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none'
    }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0 }} />
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 24,
        fontWeight: 700,
        color: 'var(--accent-yellow)',
        textShadow: '0 0 32px var(--accent-yellow)',
        zIndex: 1
      }}>
        FLASH PLAYER 32 DETECTED
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        color: 'var(--accent-cyan)',
        marginTop: 12,
        zIndex: 1
      }}>
        You are now running in compatibility mode
      </div>
    </div>
  )
}
