import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getPublishedGame, recordPlay } from '../lib/monetization/games'
import { hasGameEntitlement } from '../lib/monetization/games'
import { getLeaderboard, postScore } from '../lib/monetization/leaderboard'
import { loadProject } from '../lib/projects'
import { getOfficialGame } from '../lib/officialGames'
import { IconArrowLeft, IconArrowRight, IconRefresh, IconTrophy, IconLock } from '../components/Icons'

type HostMessage = { kind: string }

export default function PlayPage() {
  const { gameId } = useParams<{ gameId: string }>()
  const { user } = useAuth()
  const userId = user ? (user.uid || user.email || '') : ''

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

  const frameRef = useRef<HTMLIFrameElement>(null)
  const playerNameRef = useRef('guest')
  const readyRef = useRef(false)
  const codeRef = useRef('')
  const countedRef = useRef<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastScore, setLastScore] = useState<number | null>(null)
  const [touched, setTouched] = useState<'up' | 'down' | 'left' | 'right' | 'jump' | null>(null)

  const paid = (game?.priceUsd ?? 0) > 0
  const entitled = paid && Boolean(userId) && hasGameEntitlement(userId, gameId || '')
  const canPlay = !paid || entitled

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
    const onMessage = (event: MessageEvent) => {
      const data = event.data as HostMessage & { source?: string }
      if (!data || typeof data !== 'object' || data.source !== 'openflash-player') return
      if (data.kind === 'of:ready') {
        readyRef.current = true
        if (codeRef.current && frameRef.current) {
          frameRef.current.contentWindow?.postMessage({ source: 'openflash-host', kind: 'of:load', code: codeRef.current }, '*')
        }
      } else if (data.kind === 'of:score' && game) {
        const score = (data as { score?: number }).score
        if (typeof score === 'number' && Number.isFinite(score)) {
          const board = postScore(game.id, playerNameRef.current, score)
          setState(prev => ({ ...prev, scores: board }))
          setLastScore(score)
        }
      } else if (data.kind === 'of:error') {
        setError((data as { message?: string }).message || 'The game could not start.')
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [game])

  const runCode = useCallback((code: string) => {
    codeRef.current = code
    setError(null)
    if (readyRef.current && frameRef.current) {
      frameRef.current.contentWindow?.postMessage({ source: 'openflash-host', kind: 'of:load', code }, '*')
    }
  }, [])

  useEffect(() => {
    if (!canPlay || !game) return
    const official = gameId ? getOfficialGame(gameId) : undefined
    const project = official ? null : loadProject(game.projectId)
    const code = official?.code || project?.code || ''
    if (!code.trim()) {
      setError('This game has not been published yet.')
      return
    }
    runCode(code)
  }, [canPlay, game, gameId, runCode])

  const restart = useCallback(() => {
    setLastScore(null)
    if (codeRef.current) runCode(codeRef.current)
  }, [runCode])

  useEffect(() => {
    if (!canPlay || !game) return
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault()
      }
      if (e.key === 'r' && !(e.ctrlKey || e.metaKey)) {
        restart()
        return
      }
      if (!e.repeat && frameRef.current) {
        frameRef.current.contentWindow?.postMessage({ source: 'openflash-host', kind: 'of:key', action: 'down', key: e.key }, '*')
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (frameRef.current) {
        frameRef.current.contentWindow?.postMessage({ source: 'openflash-host', kind: 'of:key', action: 'up', key: e.key }, '*')
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [canPlay, game, restart])

  const sendTouch = (key: string, down: boolean) => {
    frameRef.current?.contentWindow?.postMessage({ source: 'openflash-host', kind: 'of:key', action: down ? 'down' : 'up', key }, '*')
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

  if (!canPlay) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '60px 24px' }}>
        <div className="panel" style={{ padding: 32, textAlign: 'center' }}>
          <IconLock size={28} style={{ opacity: 0.7, marginBottom: 12 }} />
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{game.title}</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            This is a premium game. Unlock it for ${game.priceUsd.toFixed(2)} and climb the leaderboard.
          </p>
          <Link to={`/checkout?game=${encodeURIComponent(game.id)}&title=${encodeURIComponent(game.title)}`} className="btn btn-primary" style={{ padding: '10px 28px', fontWeight: 700, fontSize: 13, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            Unlock for ${game.priceUsd.toFixed(2)} <IconArrowRight size={13} />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px', minHeight: 'calc(100vh - 60px)' }}>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 560px', minWidth: 320 }}>
          <div className="panel" style={{ overflow: 'hidden' }}>
            <div className="row-between" style={{ padding: '8px 12px', borderBottom: '1px solid var(--line)' }}>
              <span className="tiny">{game.title}</span>
              <span className="tiny" style={{ color: 'var(--primary)' }}>
                {game.creatorName}
              </span>
            </div>
            <iframe
              ref={frameRef}
              src="/player.html"
              sandbox="allow-scripts"
              title="OpenFlash player"
              style={{ display: 'block', width: '100%', border: 'none', background: 'var(--bg)' }}
            />
          </div>
          {error && (
            <div style={{ marginTop: 10, padding: '10px 14px', border: '2px solid var(--danger)', color: 'var(--danger)', fontSize: 12 }}>
              {error}
            </div>
          )}
          {lastScore !== null && (
            <div className="panel" style={{ marginTop: 10, padding: '8px 12px' }}>
              <span className="tiny" style={{ color: 'var(--primary)' }}>LAST SCORE {lastScore} — on the board below</span>
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
          <div style={{ marginTop: 16 }}>
            <span className="tiny" style={{ display: 'block', marginBottom: 8 }}>TOUCH CONTROLS</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <TouchPad label="◀" onDown={() => sendTouch('ArrowLeft', true)} onUp={() => sendTouch('ArrowLeft', false)} />
              <TouchPad label="▲" onDown={() => sendTouch('ArrowUp', true)} onUp={() => sendTouch('ArrowUp', false)} />
              <TouchPad label="▼" onDown={() => sendTouch('ArrowDown', true)} onUp={() => sendTouch('ArrowDown', false)} />
              <TouchPad label="▶" onDown={() => sendTouch('ArrowRight', true)} onUp={() => sendTouch('ArrowRight', false)} />
              <TouchPad label="JUMP" onDown={() => sendTouch(' ', true)} onUp={() => sendTouch(' ', false)} accent />
            </div>
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
        </div>
      </div>
    </div>
  )
}

function TouchPad({ label, onDown, onUp, accent }: { label: string; onDown: () => void; onUp: () => void; accent?: boolean }) {
  const [held, setHeld] = useState(false)
  const [active, setActive] = useState(false)
  useEffect(() => {
    if (active && !held) {
      onDown()
      setHeld(true)
    } else if (!active && held) {
      onUp()
      setHeld(false)
    }
  }, [active, held, onDown, onUp])
  return (
    <button
      onPointerDown={e => { e.preventDefault(); setActive(true) }}
      onPointerUp={() => setActive(false)}
      onPointerLeave={() => setActive(false)}
      onPointerCancel={() => setActive(false)}
      className={`btn ${accent ? 'btn-primary' : 'btn-ghost'}`}
      style={{ flex: 1, minWidth: 48, padding: '12px 8px', fontSize: 13, touchAction: 'none', userSelect: 'none' }}
    >
      {label}
    </button>
  )
}
