import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { loadProject, type ProjectData } from '../lib/projects'
import { publishGame } from '../lib/monetization/games'
import { getPlan, PLAN_LIST } from '../lib/monetization/plans'
import type { PlanId } from '../lib/monetization/types'
import { IconParty, IconRocket } from '../components/Icons'

export default function PublishPage() {
  const { user } = useAuth()
  const userId = user?.uid || user?.email || 'anonymous'
  const userName = user?.displayName || user?.email?.split('@')[0] || 'Creator'

  const [project, setProject] = useState<ProjectData | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priceUsd, setPriceUsd] = useState('0')
  const [adsEnabled, setAdsEnabled] = useState(true)
  const [planId, setPlanId] = useState<PlanId>('beta')
  const [message, setMessage] = useState('')
  const [published, setPublished] = useState(false)

  const plan = getPlan(planId)

  // Load the current studio project from localStorage
  useEffect(() => {
    // most recent project acts as the "current" one
    const keys = Object.keys(localStorage).filter(k => k.startsWith('openflash_project_'))
    if (keys.length > 0) {
      const latestKey = keys.sort().reverse()[0]
      try {
        const p: ProjectData = JSON.parse(localStorage.getItem(latestKey) || '')
        setProject(p)
        setTitle(p.name || 'Untitled Game')
      } catch { /* ignore */ }
    }
  }, [])

  const handlePublish = () => {
    if (!title.trim()) {
      setMessage('Please enter a title.')
      return
    }
    if (!plan.customPricing && parseFloat(priceUsd) > 0) {
      setMessage(`Your ${plan.name} plan requires a price of $0. Upgrade to set a price.`)
      return
    }
    if (!plan.canDisableAds && !adsEnabled) {
      setMessage(`Your ${plan.name} plan requires ads to be enabled.`)
      return
    }
    const game = publishGame({
      projectId: project?.id || `pub_${Date.now().toString(36)}`,
      title: title.trim(),
      description: description.trim(),
      creatorId: userId,
      creatorName: userName,
      priceUsd: parseFloat(priceUsd) || 0,
      adsEnabled,
      plan: planId
    })
    setPublished(true)
    setMessage(`Published! Game ID: ${game.id.slice(0, 18)}`)
  }

  if (!user) {
    return <Shell><p style={{ color: 'var(--text-secondary)' }}>Please sign in to publish.</p></Shell>
  }

  if (published) {
    return (
      <Shell>
        <div className="glass-panel" style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}><IconParty size={48} /></div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Game Published!</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>{message}</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <a href="/arcade" className="btn btn-primary" style={{ padding: '8px 18px', fontSize: 13, textDecoration: 'none' }}>
              View in Arcade
            </a>
            <a href="/earnings" className="btn btn-ghost" style={{ padding: '8px 18px', fontSize: 13, textDecoration: 'none' }}>
              View Earnings
            </a>
          </div>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 26, fontWeight: 700 }}>Publish Game</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          Set your monetization options and publish to the arcade
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Plan */}
        <div className="glass-panel" style={{ padding: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Your Plan</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {PLAN_LIST.map(p => (
              <button
                key={p.id}
                onClick={() => setPlanId(p.id)}
                className={`btn ${planId === p.id ? 'btn-cyan' : 'btn-ghost'}`}
                style={{ padding: '6px 12px', fontSize: 11 }}
              >
                {p.name} {p.priceUsd > 0 ? `· $${p.priceUsd}/mo` : '· Free'}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)' }}>
            {plan.features.map((f, i) => (
              <div key={i} style={{ lineHeight: 1.6 }}>• {f}</div>
            ))}
          </div>
        </div>

        {/* Game details */}
        <div className="glass-panel" style={{ padding: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Game Details</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={labelStyle}>Title</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="input" style={{ width: '100%', padding: '8px 12px', fontSize: 13, marginTop: 4 }}
              />
            </div>
            <div>
              <label style={labelStyle}>Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                className="input" style={{ width: '100%', padding: '8px 12px', fontSize: 13, marginTop: 4, resize: 'vertical' }}
              />
            </div>
          </div>
        </div>

        {/* Monetization */}
        <div className="glass-panel" style={{ padding: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Monetization</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>Price (USD)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>$</span>
                <input
                  type="number"
                  value={priceUsd}
                  onChange={e => setPriceUsd(e.target.value)}
                  min={0}
                  step={0.99}
                  disabled={!plan.customPricing}
                  className="input" style={{ padding: '6px 10px', fontSize: 13, width: 120 }}
                />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {parseFloat(priceUsd) === 0 ? '(free / direct install)' : `You earn $${(parseFloat(priceUsd) * plan.downloadRevenueShare / 100).toFixed(2)} per download`}
                </span>
              </div>
              {!plan.customPricing && (
                <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                  Upgrade to Sigma or Alpha to set a price.
                </p>
              )}
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={adsEnabled}
                onChange={e => setAdsEnabled(e.target.checked)}
                disabled={!plan.canDisableAds}
                style={{ accentColor: 'var(--accent-cyan)', width: 16, height: 16 }}
              />
              <span style={{ fontSize: 13 }}>
                Enable ads
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>
                  (you earn {plan.adRevenueShare}% of ad revenue)
                </span>
              </span>
            </label>
            {!plan.canDisableAds && (
              <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                Ads are required on the {plan.name} plan. Upgrade to Alpha to disable ads.
              </p>
            )}
          </div>
        </div>

        {/* Revenue summary */}
        <div className="glass-panel" style={{ padding: 16, background: 'rgba(0, 255, 136, 0.04)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Revenue Summary</h3>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            <div>• <strong>Ad revenue:</strong> {plan.adRevenueShare}% to you / {100 - plan.adRevenueShare}% platform</div>
            <div>• <strong>Download revenue:</strong> {plan.downloadRevenueShare}% to you / {100 - plan.downloadRevenueShare}% platform</div>
            <div>• <strong>Price:</strong> ${parseFloat(priceUsd || '0').toFixed(2)} ({parseFloat(priceUsd) === 0 ? 'free' : 'paid'})</div>
            <div>• <strong>Ads:</strong> {adsEnabled ? 'Enabled' : 'Disabled'}</div>
          </div>
        </div>

        {message && !published && (
          <p style={{ fontSize: 12, color: message.includes('Published') ? 'var(--accent-green)' : '#FF5F75' }}>{message}</p>
        )}

        <button onClick={handlePublish} className="btn btn-primary" style={{ padding: '10px 24px', fontSize: 14, alignSelf: 'flex-start' }}>
          <IconRocket size={16} /> Publish Game
        </button>
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div style={{ maxWidth: 700, margin: '0 auto', padding: '32px 24px', minHeight: 'calc(100vh - 60px)' }}>{children}</div>
}

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: 1,
  display: 'block'
}
