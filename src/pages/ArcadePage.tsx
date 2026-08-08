import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { listPublishedGames, recordPlay, recordDownload } from '../lib/monetization/games'
import type { PublishedGame } from '../lib/monetization/types'
import { recordRevenue } from '../lib/monetization/earnings'
import { getPlan } from '../lib/monetization/plans'
import AdSlot from '../components/AdSlot'
import { getSlot, loadAdConfig } from '../lib/monetization/ads'
import { IconGamepad, IconPlay, IconArrowDown, IconDownload } from '../components/Icons'

export default function ArcadePage() {
  const [games, setGames] = useState<PublishedGame[]>([])
  const [headerSlot] = useState(() => getSlot(loadAdConfig(), 'header'))
  const [footerSlot] = useState(() => getSlot(loadAdConfig(), 'footer'))
  const [betweenSlot] = useState(() => getSlot(loadAdConfig(), 'between-content'))

  const refresh = () => setGames(listPublishedGames())
  useEffect(() => { refresh() }, [])

  const handlePlay = (game: PublishedGame) => {
    recordPlay(game.id, 0.01)
    // ad revenue: 40% to creator
    const plan = getPlan(game.plan)
    recordRevenue({
      userId: game.creatorId,
      gameId: game.id,
      gameTitle: game.title,
      type: 'ad',
      grossUsd: 0.01,
      creatorSharePct: plan.adRevenueShare
    })
    refresh()
  }

  const handleDownload = (game: PublishedGame) => {
    if (game.priceUsd === 0) {
      recordDownload(game.id, 0)
      return
    }
    const plan = getPlan(game.plan)
    recordRevenue({
      userId: game.creatorId,
      gameId: game.id,
      gameTitle: game.title,
      type: 'download',
      grossUsd: game.priceUsd,
      creatorSharePct: plan.downloadRevenueShare
    })
    recordDownload(game.id, game.priceUsd)
    refresh()
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px', minHeight: 'calc(100vh - 60px)' }}>
      {/* Header ad */}
      {headerSlot && <div style={{ marginBottom: 20 }}><AdSlot config={headerSlot} /></div>}

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 30, fontWeight: 700, marginBottom: 4 }}>
          Arcade
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          Play games from creators. Free games install instantly — paid games use crypto checkout.
        </p>
      </div>

      {/* Between-content ad */}
      {betweenSlot && <div style={{ marginBottom: 20 }}><AdSlot config={betweenSlot} /></div>}

      {games.length === 0 ? (
        <div className="glass-panel" style={{ padding: 60, textAlign: 'center' }}>
          <div style={{ marginBottom: 12 }}><IconGamepad size={40} /></div>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No games yet</h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
            Be the first to publish a game and start earning!
          </p>
          <Link to="/studio" className="btn btn-primary" style={{ padding: '8px 20px', fontSize: 13, textDecoration: 'none' }}>
            Create a Game
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {games.map(game => (
            <GameCard
              key={game.id}
              game={game}
              onPlay={() => handlePlay(game)}
              onDownload={() => handleDownload(game)}
            />
          ))}
        </div>
      )}

      {/* Footer ad */}
      {footerSlot && <div style={{ marginTop: 28 }}><AdSlot config={footerSlot} /></div>}
    </div>
  )
}

function GameCard({ game, onPlay, onDownload }: {
  game: PublishedGame
  onPlay(): void
  onDownload(): void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="glass-panel" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Thumbnail */}
      <div style={{
        height: 140,
        background: game.thumbnail
          ? `url(${game.thumbnail}) center/cover`
          : 'linear-gradient(135deg, #1A1B22 0%, #2A2B38 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative'
      }}>
        {!game.thumbnail && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}><IconGamepad size={36} style={{ opacity: 0.5 }} /></div>}
        {game.adsEnabled && (
          <span style={{
            position: 'absolute',
            top: 8,
            right: 8,
            fontSize: 9,
            fontFamily: 'var(--font-mono)',
            padding: '2px 6px',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(0,0,0,0.6)',
            color: 'var(--text-secondary)'
          }}>
            AD-SUPPORTED
          </span>
        )}
      </div>

      <div style={{ padding: 14, flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>{game.title}</h3>
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>by {game.creatorName}</p>
        </div>

        {expanded && game.description && (
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{game.description}</p>
        )}

        <div style={{ display: 'flex', gap: 10, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><IconPlay size={10} /> {game.plays}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><IconArrowDown size={10} /> {game.downloads}</span>
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ display: 'flex', gap: 6 }}>
          <a
            href={`/play/${game.id}`}
            onClick={() => onPlay()}
            className="btn btn-ghost"
            style={{ flex: 1, padding: '6px 10px', fontSize: 11, textAlign: 'center', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
          >
            <IconPlay size={11} /> Play
          </a>
          {game.priceUsd === 0 ? (
            <button
              onClick={() => { onDownload(); window.open(`/play/${game.id}`, '_blank') }}
              className="btn btn-primary"
              style={{ flex: 1, padding: '6px 10px', fontSize: 11, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
            >
              <IconDownload size={11} /> Install Free
            </button>
          ) : (
            <Link
              to={`/checkout?game=${game.id}&title=${encodeURIComponent(game.title)}&price=${game.priceUsd}`}
              onClick={() => onDownload()}
              className="btn btn-primary"
              style={{ flex: 1, padding: '6px 10px', fontSize: 11, textAlign: 'center', textDecoration: 'none' }}
            >
              ${game.priceUsd.toFixed(2)} · Buy
            </Link>
          )}
        </div>

        {game.description && (
          <button
            onClick={() => setExpanded(e => !e)}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 10, cursor: 'pointer', textAlign: 'left' }}
          >
            {expanded ? 'less' : 'more…'}
          </button>
        )}
      </div>
    </div>
  )
}
