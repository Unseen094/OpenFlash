import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { listEarningsByUser, pendingBalanceForUser, listWithdrawalsByUser, createWithdrawal } from '../lib/monetization/earnings'
import { listPublishedGamesByCreator } from '../lib/monetization/games'
import { COIN_LIST } from '../lib/monetization/coins'
import type { CoinId } from '../lib/monetization/types'
import { PLAN_LIST, getPlan } from '../lib/monetization/plans'
import type { EarningRecord, WithdrawalRequest, PlanId, PublishedGame } from '../lib/monetization/types'
import { useNavigate } from 'react-router-dom'

export default function EarningsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const userId = user?.uid || user?.email || 'anonymous'
  const userName = user?.displayName || user?.email?.split('@')[0] || 'Creator'

  const [earnings, setEarnings] = useState<EarningRecord[]>([])
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([])
  const [games, setGames] = useState<PublishedGame[]>([])
  const [planId, setPlanId] = useState<PlanId>('beta')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawCoin, setWithdrawCoin] = useState<CoinId>('sol')
  const [walletAddress, setWalletAddress] = useState('')
  const [message, setMessage] = useState('')

  const balance = pendingBalanceForUser(userId)
  const plan = getPlan(planId)

  const refresh = () => {
    setEarnings(listEarningsByUser(userId))
    setWithdrawals(listWithdrawalsByUser(userId))
    setGames(listPublishedGamesByCreator(userId))
  }

  useEffect(() => { refresh() }, [userId])

  const totalAd = earnings.filter(e => e.type === 'ad').reduce((s, e) => s + e.creatorUsd, 0)
  const totalDownload = earnings.filter(e => e.type === 'download').reduce((s, e) => s + e.creatorUsd, 0)

  const handleWithdraw = () => {
    const amount = parseFloat(withdrawAmount)
    if (!amount || amount <= 0) {
      setMessage('Enter a valid amount.')
      return
    }
    if (amount > balance) {
      setMessage(`Insufficient balance. Available: $${balance.toFixed(2)}`)
      return
    }
    if (amount > plan.maxWithdrawal) {
      setMessage(`Your ${plan.name} plan allows max $${plan.maxWithdrawal}/month.`)
      return
    }
    if (!walletAddress.trim()) {
      setMessage('Enter your wallet address.')
      return
    }
    createWithdrawal({
      userId,
      userName,
      amountUsd: amount,
      coin: withdrawCoin,
      walletAddress: walletAddress.trim()
    })
    setWithdrawAmount('')
    setWalletAddress('')
    setMessage('Withdrawal request submitted! An admin will process it shortly.')
    refresh()
  }

  if (!user) {
    return <Shell><p style={{ color: 'var(--text-secondary)' }}>Please sign in to view earnings.</p></Shell>
  }

  return (
    <Shell>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 26, fontWeight: 700 }}>Creator Earnings</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          Track revenue, manage withdrawals, and view your plan
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
        <StatCard label="Available Balance" value={`$${balance.toFixed(2)}`} color="var(--accent-green)" />
        <StatCard label="Ad Revenue (your share)" value={`$${totalAd.toFixed(2)}`} color="var(--accent-cyan)" />
        <StatCard label="Download Revenue (your share)" value={`$${totalDownload.toFixed(2)}`} color="var(--accent-yellow)" />
        <StatCard label="Your Plan" value={plan.name} color="var(--accent-magenta)" />
      </div>

      {/* Plan selector */}
      <div className="glass-panel" style={{ padding: 16, marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Your Plan</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {PLAN_LIST.map(p => (
            <button
              key={p.id}
              onClick={() => {
                if (p.priceUsd > 0 && planId !== p.id) {
                  navigate(`/checkout?plan=${p.id}&title=${encodeURIComponent('Plan: ' + p.name)}&price=${p.priceUsd}`)
                } else {
                  setPlanId(p.id)
                }
              }}
              className={`btn ${planId === p.id ? 'btn-cyan' : 'btn-ghost'}`}
              style={{ padding: '6px 12px', fontSize: 11 }}
            >
              {p.name} {p.priceUsd > 0 ? `· $${p.priceUsd}/mo` : '· Free'}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          <div>Ad revenue share: <strong>{plan.adRevenueShare}%</strong> to you / {100 - plan.adRevenueShare}% platform</div>
          <div>Download revenue share: <strong>{plan.downloadRevenueShare}%</strong> to you / {100 - plan.downloadRevenueShare}% platform</div>
          <div>Max withdrawal: <strong>${plan.maxWithdrawal}/month</strong></div>
        </div>
      </div>

      {/* Withdrawal form */}
      <div className="glass-panel" style={{ padding: 16, marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Request Withdrawal</h3>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
          When you click withdraw, a request is sent to the admin. They will manually transfer the funds to your wallet.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={labelStyle}>Amount (USD)</label>
            <input
              type="number"
              value={withdrawAmount}
              onChange={e => setWithdrawAmount(e.target.value)}
              placeholder={`Max $${balance.toFixed(2)}`}
              min={0}
              className="input" style={{ padding: '6px 10px', fontSize: 12, width: 140, marginTop: 4 }}
            />
          </div>
          <div>
            <label style={labelStyle}>Receive in</label>
            <select
              value={withdrawCoin}
              onChange={e => setWithdrawCoin(e.target.value as CoinId)}
              className="input" style={{ padding: '6px 10px', fontSize: 12, marginTop: 4 }}
            >
              {COIN_LIST.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.symbol})</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={labelStyle}>Your wallet address</label>
            <input
              value={walletAddress}
              onChange={e => setWalletAddress(e.target.value)}
              placeholder="Your personal wallet address"
              className="input" style={{ width: '100%', padding: '6px 10px', fontSize: 12, marginTop: 4 }}
            />
          </div>
          <button onClick={handleWithdraw} className="btn btn-primary" style={{ padding: '6px 16px', fontSize: 12 }}>
            Withdraw
          </button>
        </div>
        {message && <p style={{ fontSize: 12, color: message.includes('submitted') ? 'var(--accent-green)' : '#FF5F75', marginTop: 10 }}>{message}</p>}
      </div>

      {/* Withdrawal history */}
      <div className="glass-panel" style={{ overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ padding: 16, borderBottom: '1px solid var(--border-subtle)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600 }}>Withdrawal History ({withdrawals.length})</h3>
        </div>
        {withdrawals.length === 0 ? (
          <Empty>No withdrawal requests yet.</Empty>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                {['Amount', 'Coin', 'Wallet', 'Status', 'Date'].map(h => <th key={h} style={thStyle}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {withdrawals.map(w => (
                <tr key={w.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={tdStyle}>${w.amountUsd.toFixed(2)}</td>
                  <td style={tdStyle}>{w.coin.toUpperCase()}</td>
                  <td style={tdStyle}><code style={{ fontSize: 10 }}>{w.walletAddress.slice(0, 14)}…</code></td>
                  <td style={tdStyle}><StatusBadge status={w.status} /></td>
                  <td style={{ ...tdStyle, fontSize: 11, color: 'var(--text-muted)' }}>{new Date(w.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Earnings log */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <div style={{ padding: 16, borderBottom: '1px solid var(--border-subtle)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600 }}>Earnings Log ({earnings.length})</h3>
        </div>
        {earnings.length === 0 ? (
          <Empty>No earnings yet. Publish a game to start earning!</Empty>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                {['Game', 'Type', 'Gross', 'Your Share', 'Date'].map(h => <th key={h} style={thStyle}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {earnings.map(e => (
                <tr key={e.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={tdStyle}>{e.gameTitle}</td>
                  <td style={tdStyle}>
                    <span style={{
                      fontSize: 10,
                      fontFamily: 'var(--font-mono)',
                      padding: '1px 6px',
                      borderRadius: 'var(--radius-sm)',
                      background: e.type === 'ad' ? 'rgba(0,240,255,0.1)' : 'rgba(255,230,0,0.1)',
                      color: e.type === 'ad' ? 'var(--accent-cyan)' : 'var(--accent-yellow)'
                    }}>
                      {e.type}
                    </span>
                  </td>
                  <td style={tdStyle}>${e.grossUsd.toFixed(2)}</td>
                  <td style={{ ...tdStyle, color: 'var(--accent-green)', fontWeight: 600 }}>${e.creatorUsd.toFixed(2)}</td>
                  <td style={{ ...tdStyle, fontSize: 11, color: 'var(--text-muted)' }}>{new Date(e.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px', minHeight: 'calc(100vh - 60px)' }}>{children}</div>
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="glass-panel" style={{ padding: 16 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color, marginTop: 6 }}>{value}</div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'var(--accent-yellow)',
    approved: 'var(--accent-cyan)',
    rejected: '#FF5F75',
    paid: 'var(--accent-green)'
  }
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 'var(--radius-sm)',
      fontSize: 10,
      fontFamily: 'var(--font-mono)',
      color: colors[status] || 'var(--text-secondary)',
      background: `${colors[status]}15`,
      textTransform: 'capitalize'
    }}>
      {status}
    </span>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '32px 24px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>{children}</div>
}

const thStyle: React.CSSProperties = {
  padding: '8px 12px',
  textAlign: 'left',
  fontSize: 10,
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  fontWeight: 500
}

const tdStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 12,
  color: 'var(--text-secondary)'
}

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: 1,
  display: 'block'
}
