import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getPublishedGame, recordPlay } from '../lib/monetization/games'
import { getLeaderboard, postScore } from '../lib/monetization/leaderboard'
import { loadProject } from '../lib/projects'
import { StudioSandbox } from '../studio/runtime/sandbox'
import AdSlot from '../components/AdSlot'
import { getSlot, loadAdConfig } from '../lib/monetization/ads'
import { IconArrowLeft, IconArrowRight, IconRefresh, IconTrophy, IconLock } from '../components/Icons'

const AD_REVENUE_PER_PLAY = 0.003

function hasUnlocked(gameId: string): boolean {
  try {
    const raw = localStorage.getItem('openflash_game_unlocks')
    if (!raw) return false
    const parsed: unknown = JSON.parse(raw)
    const set = new Set<string>(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [])
    return set.has(gameId)
  } catch {
    return false
  }
}

function saveUnlock(gameId: string): void {
  try {
    const raw = localStorage.getItem('openflash_game_unlocks')
    const parsed: unknown = raw ? JSON.parse(raw) : []
    const list = Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
    const set = new Set<string>(list)
    set.add(gameId)
    localStorage.setItem('openflash_game_unlocks', JSON.stringify([...set]))
  } catch { /* noop */ }
}

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
  const [unlocked, setUnlocked] = useState(() => (gameId ? hasUnlocked(gameId) : false))
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sandboxRef = useRef<StudioSandbox | null>(null)
  const playerNameRef = useRef('guest')
  const [lastScore, setLastScore] = useState<number | null>(null)
  const [sidebarSlot] = useState(() => getSlot(loadAdConfig(), 'sidebar'))

  const countedRef = useRef<string | null>(null)
  useEffect(() => {
    if (game && countedRef.current !== game.id) {
      countedRef.current = game.id
      recordPlay(game.id, game.adsEnabled ? AD_REVENUE_PER_PLAY : 0)
    }
  }, [game])

  const gameReady = adDone || !game?.adsEnabled

  useEffect(() => {
    if (!gameId) return
    const saved = localStorage.getItem('openflash_player_name')
    if (saved) playerNameRef.current = saved
  }, [gameId])

  useEffect(() => {
    if (!gameReady || !game) return
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
      sandbox.run(`// Publish code from the studio to play here
Open.on('tick', () => {
  Open.drawText(160, 200, 'Not published yet — open the studio,\nwrite code, then publish.', '#888', 16)
})`)
    }

    const handlePointer = (type: 'pointerDown' | 'pointerUp' | 'pointerMove') => (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * canvas.width
      const y = ((e.clientY - rect.top) / rect.height) * canvas.height
      sandbox.forwardPointer(type, x, y)
    }
    const onPointerDown = handlePointer('pointerDown')
    const onPointerUp = handlePointer('pointerUp')
    const onPointerMove = handlePointer('pointerMove')
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointermove', onPointerMove)

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointermove', onPointerMove)
      sandbox.stop()
      sandboxRef.current = null
    }
  }, [gameReady, game])

  const restart = useCallback(() => {
    if (!game) return
    setLastScore(null)
    sandboxRef.current?.stop()
    const project = loadProject(game.projectId)
    let code = project?.code || ''
    if (!code.trim()) {
      code = `// Publish code from the studio to play here
Open.on('tick', () => {
  Open.drawText(160, 200, 'Not published yet — open the studio,\nwrite code, then publish.', '#888', 16)
})`
    }
    sandboxRef.current?.run(code)
  }, [game])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!gameReady || !game) return
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault()
      }
      if (e.key === 'r' && !(e.ctrlKey || e.metaKey)) {
        restart()
        return
      }
      if (!e.repeat) {
        sandboxRef.current?.forwardKey('keyDown', e.key)
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (!gameReady || !game) return
      sandboxRef.current?.forwardKey('keyUp', e.key)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [gameReady, game, restart])

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

      {game.priceUsd > 0 && !unlocked && (
        <div className="glass-panel" style={{ padding: 40, textAlign: 'center', marginBottom: 20 }}>
          <IconLock size={28} style={{ opacity: 0.7, marginBottom: 12 }} />
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{game.title}</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            This is a premium game — unlock it for ${game.priceUsd.toFixed(2)} to play and climb the leaderboard.
          </p>
          <button
            onClick={() => { saveUnlock(game.id); setUnlocked(true) }}
            className="btn btn-amber"
            style={{ padding: '10px 28px', fontWeight: 700, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            Unlock for ${game.priceUsd.toFixed(2)} <IconArrowRight size={13} />
          </button>
          <p className="tiny" style={{ marginTop: 12, opacity: 0.6 }}>
            Demo environment — purchases are simulated and unlock is stored locally.
          </p>
        </div>
      )}

      {gameReady && (
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