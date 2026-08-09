import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getPublishedGame, recordPlay } from '../lib/monetization/games'
import { getLeaderboard, postScore } from '../lib/monetization/leaderboard'
import { loadProject } from '../lib/projects'
import { StudioSandbox } from '../studio/runtime/sandbox'
import AdSlot from '../components/AdSlot'
import { getSlot, loadAdConfig } from '../lib/monetization/ads'
import { IconArrowLeft, IconArrowRight, IconRefresh, IconTrophy } from '../components/Icons'

export default function PlayPage() {
  const { gameId } = useParams<{ gameId: string }>()
  const [state, setState] = useState(() => ({
    gameId,
    game: gameId ? getPublishedGame(gameId) : null,
    scores: gameId ? getLeaderboard(gameId) : []
  }))
  if (state.gameId !== gameId) {
    setState({
      gameId,
      game: gameId ? getPublishedGame(gameId) : null,
      scores: gameId ? getLeaderboard(gameId) : []
    })
  }
  const { game, scores } = state
  const [adDone, setAdDone] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sandboxRef = useRef<StudioSandbox | null>(null)
  const playerNameRef = useRef('guest')
  const [lastScore, setLastScore] = useState<number | null>(null)
  const [sidebarSlot] = useState(() => getSlot(loadAdConfig(), 'sidebar'))

  const countedRef = useRef<string | null>(null)
  useEffect(() => {
    if (game && countedRef.current !== game.id) {
      countedRef.current = game.id
      recordPlay(game.id, 0)
    }
  }, [game])

  useEffect(() => {
    if (!gameId) return
    const saved = localStorage.getItem('openflash_player_name')
    if (saved) playerNameRef.current = saved
  }, [gameId])

  useEffect(() => {
    if (!adDone || !game) return
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = 800
    canvas.height = 450

    const project = loadProject(game.projectId)
    const sandbox = new StudioSandbox(
      canvas,
      () => {},
      (name, value) => {
        if (name !== 'score') return
        const { score } = value as { score: number }
        const board = postScore(game.id, playerNameRef.current, score)
        setState(prev => ({ ...prev, scores: board }))
        setLastScore(score)
      }
    )
    sandboxRef.current = sandbox

    if (project && project.code.trim()) {
      sandbox.run(project.code)
    } else {
      sandbox.run(`// generic demo stand-in — publish real code from the studio
Open.on('tick', () => {
  Open.drawRect(0, 0, 800, 450, '#0D0E12')
})`)
    }
    return () => {
      sandbox.stop()
      sandboxRef.current = null
    }
  }, [adDone, game])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'r' && adDone && game) {
        sandboxRef.current?.stop()
        sandboxRef.current?.run(loadProject(game.projectId)?.code || '')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [adDone, game])

  const restart = () => {
    if (!game) return
    sandboxRef.current?.stop()
    const project = loadProject(game.projectId)
    if (sandboxRef.current) {
      const code = project?.code || ''
      if (code.trim()) sandboxRef.current.run(code)
    }
  }

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
      {game.adsEnabled && !adDone && (
        <div className="glass-panel" style={{ padding: 40, textAlign: 'center', marginBottom: 20 }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
            Ad — game starts after this short break
          </p>
          <div style={{ maxWidth: 728, margin: '0 auto' }}>
            <AdSlot config={getSlot(loadAdConfig(), 'before-article') || { placement: 'before-article', enabled: true, type: 'custom', customCode: '<div style="padding:20px;color:var(--text-muted);font-family:var(--font-mono);font-size:11px">Your ad here</div>' }} />
          </div>
          <button
            onClick={() => setAdDone(true)}
            className="btn btn-amber"
            style={{ marginTop: 20, padding: '8px 24px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            Skip Ad <IconArrowRight size={13} />
          </button>
        </div>
      )}

      {adDone && (
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 560px', minWidth: 320 }}>
            <div className="panel corner" style={{ background: '#0D0E12', overflow: 'hidden' }}>
              <div className="row-between" style={{ padding: '8px 12px', borderBottom: '1px solid var(--line)' }}>
                <span className="tiny">{game.title}</span>
                <span className="tiny" style={{ color: 'var(--amber)' }}>
                  {game.creatorName}
                </span>
              </div>
              <canvas
                ref={canvasRef}
                style={{ display: 'block', width: '100%', maxWidth: 800, margin: '0 auto' }}
              />
            </div>
            {lastScore !== null && (
              <div className="panel" style={{ marginTop: 10, padding: '8px 12px', borderColor: 'rgba(255,212,0,0.4)' }}>
                <span className="tiny" style={{ color: 'var(--amber)' }}>LAST SCORE {lastScore} — on the board below</span>
              </div>
            )}
            <div className="row" style={{ marginTop: 12, gap: 8 }}>
              <Link to="/arcade" className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>
                <IconArrowLeft size={12} /> Arcade
              </Link>
              <button onClick={restart} className="btn btn-ghost btn-sm">
                <IconRefresh size={12} /> Replay <kbd>R</kbd>
              </button>
            </div>
          </div>

          <div style={{ flex: '0 1 260px', minWidth: 220 }}>
            <div className="panel" style={{ overflow: 'hidden' }}>
              <div className="panel-head">
                <span className="tiny"><IconTrophy size={12} /> HIGH SCORES</span>
              </div>
              <div>
                {scores.length === 0 ? (
                  <div className="empty-state" style={{ border: 'none', padding: '24px 12px' }}>
                    No scores yet. Beat the game and your name goes here.
                  </div>
                ) : (
                  <table className="table">
                    <tbody>
                      {scores.map((s, i) => (
                        <tr key={i}>
                          <td className="tiny" style={{ width: 28, color: i === 0 ? 'var(--amber)' : 'var(--ink-3)' }}>#{i + 1}</td>
                          <td style={{ fontSize: 12, fontWeight: 600 }}>{s.player}</td>
                          <td className="mono" style={{ textAlign: 'right', fontSize: 12, color: i === 0 ? 'var(--amber)' : 'var(--ink-2)' }}>
                            {s.score.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
            {sidebarSlot && (
              <div style={{ marginTop: 12 }}>
                <AdSlot config={sidebarSlot} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}