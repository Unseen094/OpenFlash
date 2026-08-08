import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getPublishedGame, recordPlay } from '../lib/monetization/games'
import { recordRevenue } from '../lib/monetization/earnings'
import { getPlan } from '../lib/monetization/plans'
import AdSlot from '../components/AdSlot'
import { getSlot, loadAdConfig } from '../lib/monetization/ads'
import { IconArrowLeft, IconRefresh, IconArrowRight } from '../components/Icons'

/**
 * Game player page.
 *  - If the game has ads enabled, shows a pre-roll ad before gameplay.
 *  - Renders the game canvas (loads project data from localStorage).
 */
export default function PlayPage() {
  const { gameId } = useParams<{ gameId: string }>()
  const [game, setGame] = useState(() => (gameId ? getPublishedGame(gameId) : null))
  const [adDone, setAdDone] = useState(false)
  const [sidebarSlot] = useState(() => getSlot(loadAdConfig(), 'sidebar'))
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef(0)

  useEffect(() => {
    if (!gameId) return
    const g = getPublishedGame(gameId)
    setGame(g)
    if (g) {
      // Record play + ad revenue
      recordPlay(g.id, 0.01)
      const plan = getPlan(g.plan)
      recordRevenue({
        userId: g.creatorId,
        gameId: g.id,
        gameTitle: g.title,
        type: 'ad',
        grossUsd: 0.01,
        creatorSharePct: plan.adRevenueShare
      })
    }
  }, [gameId])

  // Simple demo game loop — loads project shapes if available
  useEffect(() => {
    if (!adDone) return
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = 800
    canvas.height = 450
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let frame = 0
    const loop = () => {
      ctx.fillStyle = '#0D0E12'
      ctx.fillRect(0, 0, 800, 450)
      const t = frame / 60
      for (let i = 0; i < 3; i++) {
        const x = 400 + Math.sin(t * (0.5 + i * 0.3)) * (80 + i * 40)
        const y = 225 + Math.cos(t * (0.3 + i * 0.2)) * (60 + i * 30)
        ctx.beginPath()
        ctx.arc(x, y, 6, 0, Math.PI * 2)
        ctx.fillStyle = i === 0 ? '#FFE600' : i === 1 ? '#00F0FF' : '#FF00AA'
        ctx.shadowColor = ctx.fillStyle
        ctx.shadowBlur = 20
        ctx.fill()
        ctx.shadowBlur = 0
      }
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.font = '12px "JetBrains Mono", monospace'
      ctx.fillText(game?.title || 'Game', 20, 430)
      frame++
      animRef.current = requestAnimationFrame(loop)
    }
    animRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animRef.current)
  }, [adDone, game])

  if (!game) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '60px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>Game not found</h2>
        <Link to="/arcade" className="btn btn-ghost" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <IconArrowLeft size={13} /> Back to Arcade
        </Link>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px', minHeight: 'calc(100vh - 60px)' }}>
      {/* Pre-roll ad */}
      {game.adsEnabled && !adDone && (
        <div className="glass-panel" style={{ padding: 40, textAlign: 'center', marginBottom: 20 }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
            Ad · game starts after this short break
          </p>
          <div style={{ maxWidth: 728, margin: '0 auto' }}>
            <AdSlot config={getSlot(loadAdConfig(), 'before-article') || { placement: 'before-article', enabled: true, type: 'custom', customCode: '<div style="padding:20px;color:var(--text-muted);font-family:var(--font-mono);font-size:11px">Your ad here</div>' }} />
          </div>
          <button
            onClick={() => setAdDone(true)}
            className="btn btn-primary"
            style={{ marginTop: 20, padding: '8px 24px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            Skip Ad <IconArrowRight size={13} />
          </button>
        </div>
      )}

      {/* Game canvas */}
      {adDone && (
        <div style={{ display: 'flex', gap: 20 }}>
          <div style={{ flex: 1 }}>
            <div style={{
              background: '#0D0E12',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              boxShadow: '0 0 60px rgba(0,0,0,0.5)'
            }}>
              <canvas
                ref={canvasRef}
                style={{ display: 'block', width: '100%', maxWidth: 800, height: 'auto' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <Link to="/arcade" className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: 12, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <IconArrowLeft size={12} /> Arcade
              </Link>
              <button onClick={() => setAdDone(false)} className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <IconRefresh size={12} /> Replay
              </button>
            </div>
          </div>
          {/* Sidebar ad */}
          {sidebarSlot && (
            <div style={{ width: 200, flexShrink: 0 }}>
              <AdSlot config={sidebarSlot} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
