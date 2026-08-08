import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { listPayments, paymentStats } from '../lib/monetization/payments'
import { listWithdrawals, setWithdrawalStatus, totalPendingWithdrawals } from '../lib/monetization/earnings'
import { listPublishedGames } from '../lib/monetization/games'
import { loadAdConfig, saveAdConfig, updateSlot } from '../lib/monetization/ads'
import { COIN_LIST } from '../lib/monetization/coins'
import { PLAN_LIST } from '../lib/monetization/plans'
import type { AdConfig, PaymentOrder, WithdrawalRequest, PublishedGame, AdPlacement } from '../lib/monetization/types'

type Tab = 'overview' | 'orders' | 'payments' | 'ads' | 'wallets' | 'creators' | 'analytics'

const PLACEMENT_LABELS: Record<AdPlacement, string> = {
  header: 'Header',
  footer: 'Footer',
  sidebar: 'Sidebar',
  'between-content': 'Between Content',
  'before-article': 'Before Article',
  'after-article': 'After Article',
  'in-content': 'In-Content (every N paragraphs)'
}

export default function AdminPage() {
  const { user, isAdmin } = useAuth()
  const [tab, setTab] = useState<Tab>('overview')
  const [orders, setOrders] = useState<PaymentOrder[]>([])
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([])
  const [games, setGames] = useState<PublishedGame[]>([])
  const [adConfig, setAdConfig] = useState<AdConfig>(loadAdConfig())

  const refresh = () => {
    setOrders(listPayments())
    setWithdrawals(listWithdrawals())
    setGames(listPublishedGames())
    setAdConfig(loadAdConfig())
  }

  useEffect(() => { refresh() }, [])

  // In demo mode, allow access. In production, gate on admin role.
  if (!isAdmin) {
    return <Shell><p style={{ color: '#FF5F75', padding: 40 }}>Access denied. Admins only. Log in with admin@123.com.</p></Shell>
  }

  const stats = paymentStats()
  const totalRevenue = orders.filter(o => o.status === 'paid').reduce((s, o) => s + o.amountUsd, 0)
  const pendingWd = totalPendingWithdrawals()

  const tabs: Tab[] = ['overview', 'orders', 'payments', 'ads', 'wallets', 'creators', 'analytics']

  return (
    <Shell>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 26, fontWeight: 700 }}>Admin Dashboard</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          Manage payments, ads, creators, and revenue
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border-subtle)', marginBottom: 24, overflowX: 'auto' }}>
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 14px',
              fontSize: 12,
              fontWeight: 500,
              background: 'none',
              border: 'none',
              borderBottom: tab === t ? '2px solid var(--accent-yellow)' : '2px solid transparent',
              color: tab === t ? 'var(--text-primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              textTransform: 'capitalize',
              whiteSpace: 'nowrap',
              transition: 'all var(--transition-fast)'
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab orders={orders} totalRevenue={totalRevenue} pendingWd={pendingWd} games={games} stats={stats} />}
      {tab === 'orders' && <OrdersTab orders={orders} onRefresh={refresh} />}
      {tab === 'payments' && <PaymentsTab orders={orders} />}
      {tab === 'ads' && <AdsTab config={adConfig} onSave={c => { saveAdConfig(c); setAdConfig(c) }} />}
      {tab === 'wallets' && <WalletsTab />}
      {tab === 'creators' && <CreatorsTab withdrawals={withdrawals} onRefresh={refresh} />}
      {tab === 'analytics' && <AnalyticsTab orders={orders} games={games} withdrawals={withdrawals} />}
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px', minHeight: 'calc(100vh - 60px)' }}>{children}</div>
}

// ─── Overview ────────────────────────────────────────────────────────────────

function OverviewTab({ orders, totalRevenue, pendingWd, games, stats }: {
  orders: PaymentOrder[]
  totalRevenue: number
  pendingWd: number
  games: PublishedGame[]
  stats: Record<string, number>
}) {
  const cards = [
    { label: 'Total Revenue', value: `$${totalRevenue.toFixed(2)}`, color: 'var(--accent-green)' },
    { label: 'Paid Orders', value: `${stats.paid || 0}`, color: 'var(--accent-cyan)' },
    { label: 'Pending Payments', value: `${(stats.awaiting || 0) + (stats.detecting || 0) + (stats.confirming || 0)}`, color: 'var(--accent-yellow)' },
    { label: 'Pending Withdrawals', value: `$${pendingWd.toFixed(2)}`, color: 'var(--accent-orange)' },
    { label: 'Published Games', value: `${games.length}`, color: 'var(--accent-magenta)' },
    { label: 'Total Plays', value: `${games.reduce((s, g) => s + g.plays, 0)}`, color: 'var(--accent-cyan)' }
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
      {cards.map(c => (
        <div key={c.label} className="glass-panel" style={{ padding: 16 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
            {c.label}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: c.color, marginTop: 6 }}>{c.value}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Orders ──────────────────────────────────────────────────────────────────

function OrdersTab({ orders, onRefresh }: { orders: PaymentOrder[]; onRefresh: () => void }) {
  return (
    <div className="glass-panel" style={{ overflow: 'hidden' }}>
      <div style={{ padding: 16, borderBottom: '1px solid var(--border-subtle)' }}>
        <h3 style={{ fontSize: 14, fontWeight: 600 }}>All Orders ({orders.length})</h3>
      </div>
      {orders.length === 0 ? (
        <Empty>No orders yet.</Empty>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              {['ID', 'Game', 'Coin', 'Amount (USD)', 'Status', 'Date'].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.map(o => (
              <tr key={o.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={tdStyle}><code style={{ fontSize: 10 }}>{o.id.slice(0, 14)}…</code></td>
                <td style={tdStyle}>{o.gameTitle}</td>
                <td style={tdStyle}>{o.coin.toUpperCase()}</td>
                <td style={tdStyle}>${o.amountUsd.toFixed(2)}</td>
                <td style={tdStyle}><StatusBadge status={o.status} /></td>
                <td style={{ ...tdStyle, fontSize: 11, color: 'var(--text-muted)' }}>{new Date(o.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ─── Payments ────────────────────────────────────────────────────────────────

function PaymentsTab({ orders }: { orders: PaymentOrder[] }) {
  const withTx = orders.filter(o => o.txHash)
  return (
    <div className="glass-panel" style={{ overflow: 'hidden' }}>
      <div style={{ padding: 16, borderBottom: '1px solid var(--border-subtle)' }}>
        <h3 style={{ fontSize: 14, fontWeight: 600 }}>Payment Transactions ({withTx.length})</h3>
      </div>
      {withTx.length === 0 ? (
        <Empty>No transactions detected yet.</Empty>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              {['Order', 'Coin', 'Crypto Amount', 'Tx Hash', 'Confirmations', 'Status'].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {withTx.map(o => (
              <tr key={o.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={tdStyle}><code style={{ fontSize: 10 }}>{o.id.slice(0, 10)}…</code></td>
                <td style={tdStyle}>{o.coin.toUpperCase()}</td>
                <td style={tdStyle}><code style={{ fontSize: 11 }}>{o.amountCrypto.toFixed(8)}</code></td>
                <td style={tdStyle}><code style={{ fontSize: 10, color: 'var(--accent-cyan)' }}>{o.txHash?.slice(0, 18)}…</code></td>
                <td style={tdStyle}>{o.confirmations}/{o.requiredConfirmations}</td>
                <td style={tdStyle}><StatusBadge status={o.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ─── Ads ─────────────────────────────────────────────────────────────────────

function AdsTab({ config, onSave }: { config: AdConfig; onSave: (c: AdConfig) => void }) {
  const [local, setLocal] = useState(config)
  useEffect(() => { setLocal(config) }, [config])

  const toggleGlobal = () => {
    const next = { ...local, enabled: !local.enabled }
    setLocal(next)
    onSave(next)
  }

  const toggleSlot = (placement: AdPlacement) => {
    const next = updateSlot(local, placement, { enabled: !local.slots.find(s => s.placement === placement)?.enabled })
    setLocal(next)
    onSave(next)
  }

  const setSlot = (placement: AdPlacement, patch: Record<string, unknown>) => {
    const next = updateSlot(local, placement, patch)
    setLocal(next)
    onSave(next)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="glass-panel" style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 600 }}>Ads Global Toggle</h3>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Enable or disable all ads site-wide</p>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={local.enabled} onChange={toggleGlobal} style={{ accentColor: 'var(--accent-cyan)', width: 18, height: 18 }} />
          <span style={{ fontSize: 12 }}>{local.enabled ? 'Enabled' : 'Disabled'}</span>
        </label>
      </div>

      <div className="glass-panel" style={{ padding: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>AdSense Configuration</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Publisher ID (ca-pub-…)</label>
            <input
              value={local.adsensePub || ''}
              onChange={e => { const next = { ...local, adsensePub: e.target.value }; setLocal(next); onSave(next) }}
              placeholder="ca-pub-1234567890123456"
              className="input" style={{ width: '100%', padding: '6px 10px', fontSize: 12, marginTop: 4 }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={local.autoAds} onChange={e => { const next = { ...local, autoAds: e.target.checked }; setLocal(next); onSave(next) }} style={{ accentColor: 'var(--accent-cyan)' }} />
              <span style={{ fontSize: 12 }}>Auto Ads</span>
            </label>
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Ad Placements</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {local.slots.map(slot => (
            <div key={slot.placement} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', width: 200 }}>
                <input type="checkbox" checked={slot.enabled} onChange={() => toggleSlot(slot.placement)} style={{ accentColor: 'var(--accent-cyan)' }} />
                <span style={{ fontSize: 12 }}>{PLACEMENT_LABELS[slot.placement]}</span>
              </label>
              <select
                value={slot.type}
                onChange={e => setSlot(slot.placement, { type: e.target.value })}
                className="input" style={{ padding: '4px 8px', fontSize: 11, width: 120 }}
              >
                <option value="adsense">AdSense</option>
                <option value="custom">Custom HTML</option>
              </select>
              {slot.type === 'adsense' && (
                <input
                  value={slot.adsenseSlot || ''}
                  onChange={e => setSlot(slot.placement, { adsenseSlot: e.target.value })}
                  placeholder="Ad slot ID"
                  className="input" style={{ padding: '4px 8px', fontSize: 11, width: 140 }}
                />
              )}
              {slot.type === 'custom' && (
                <input
                  value={slot.customCode || ''}
                  onChange={e => setSlot(slot.placement, { customCode: e.target.value })}
                  placeholder="<ins>…</ins>"
                  className="input" style={{ padding: '4px 8px', fontSize: 11, flex: 1 }}
                />
              )}
              {slot.placement === 'in-content' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                  every
                  <input
                    type="number"
                    value={slot.everyN || 3}
                    onChange={e => setSlot(slot.placement, { everyN: Number(e.target.value) })}
                    min={1} max={20}
                    className="input" style={{ width: 50, padding: '2px 6px', fontSize: 11 }}
                  />
                  paragraphs
                </label>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Wallets ─────────────────────────────────────────────────────────────────

function WalletsTab() {
  return (
    <div className="glass-panel" style={{ padding: 16 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Platform Wallets</h3>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
        These addresses receive customer payments. Configure via environment variables.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {COIN_LIST.map(coin => (
          <div key={coin.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: 12, fontWeight: 600, width: 100 }}>{coin.name} ({coin.symbol})</span>
            <code style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', flex: 1, wordBreak: 'break-all' }}>
              {coin.address}
            </code>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {coin.confirmations} conf{coin.confirmations > 1 ? 's' : ''}
            </span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)' }}>
        <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <strong>Environment variables:</strong> Set <code>VITE_BTC_ADDRESS</code>, <code>VITE_ETH_ADDRESS</code>, <code>VITE_SOL_ADDRESS</code> in your .env to override the demo addresses above.
        </p>
      </div>
    </div>
  )
}

// ─── Creators ────────────────────────────────────────────────────────────────

function CreatorsTab({ withdrawals, onRefresh }: { withdrawals: WithdrawalRequest[]; onRefresh: () => void }) {
  const handleResolve = (id: string, status: 'approved' | 'rejected') => {
    setWithdrawalStatus(id, status)
    onRefresh()
  }

  return (
    <div className="glass-panel" style={{ overflow: 'hidden' }}>
      <div style={{ padding: 16, borderBottom: '1px solid var(--border-subtle)' }}>
        <h3 style={{ fontSize: 14, fontWeight: 600 }}>Creator Withdrawals ({withdrawals.length})</h3>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
          When a creator requests a withdrawal, review it here. Manually transfer funds, then mark as paid.
        </p>
      </div>
      {withdrawals.length === 0 ? (
        <Empty>No withdrawal requests.</Empty>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              {['Creator', 'Amount', 'Coin', 'Wallet', 'Status', 'Requested', 'Actions'].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {withdrawals.map(w => (
              <tr key={w.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={tdStyle}>{w.userName}</td>
                <td style={tdStyle}>${w.amountUsd.toFixed(2)}</td>
                <td style={tdStyle}>{w.coin.toUpperCase()}</td>
                <td style={tdStyle}><code style={{ fontSize: 10 }}>{w.walletAddress.slice(0, 14)}…</code></td>
                <td style={tdStyle}><StatusBadge status={w.status} /></td>
                <td style={{ ...tdStyle, fontSize: 11, color: 'var(--text-muted)' }}>{new Date(w.createdAt).toLocaleDateString()}</td>
                <td style={tdStyle}>
                  {w.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => handleResolve(w.id, 'approved')} className="btn btn-ghost" style={{ padding: '3px 8px', fontSize: 10, color: 'var(--accent-green)' }}>
                        Approve
                      </button>
                      <button onClick={() => handleResolve(w.id, 'rejected')} className="btn btn-ghost" style={{ padding: '3px 8px', fontSize: 10, color: '#FF5F75' }}>
                        Reject
                      </button>
                    </div>
                  )}
                  {w.status === 'approved' && (
                    <button onClick={() => { setWithdrawalStatus(w.id, 'paid', { txHash: 'manual_' + Date.now().toString(36) }); onRefresh() }} className="btn btn-primary" style={{ padding: '3px 8px', fontSize: 10 }}>
                      Mark Paid
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ─── Analytics ───────────────────────────────────────────────────────────────

function AnalyticsTab({ orders, games, withdrawals }: { orders: PaymentOrder[]; games: PublishedGame[]; withdrawals: WithdrawalRequest[] }) {
  const paidOrders = orders.filter(o => o.status === 'paid')
  const totalRevenue = paidOrders.reduce((s, o) => s + o.amountUsd, 0)
  const totalPaid = withdrawals.filter(w => w.status === 'paid').reduce((s, w) => s + w.amountUsd, 0)
  const platformRevenue = totalRevenue * 0.5 // simplified
  const topGames = [...games].sort((a, b) => b.revenueUsd - a.revenueUsd).slice(0, 5)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
        <StatCard label="Gross Revenue" value={`$${totalRevenue.toFixed(2)}`} color="var(--accent-green)" />
        <StatCard label="Creator Payouts" value={`$${totalPaid.toFixed(2)}`} color="var(--accent-yellow)" />
        <StatCard label="Platform Revenue" value={`$${platformRevenue.toFixed(2)}`} color="var(--accent-cyan)" />
        <StatCard label="Avg Order" value={`$${paidOrders.length ? (totalRevenue / paidOrders.length).toFixed(2) : '0.00'}`} color="var(--accent-magenta)" />
      </div>
      <div className="glass-panel" style={{ padding: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Top Games by Revenue</h3>
        {topGames.length === 0 ? (
          <Empty>No revenue data yet.</Empty>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {topGames.map((g, i) => (
              <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', width: 24 }}>#{i + 1}</span>
                <span style={{ flex: 1, fontSize: 13 }}>{g.title}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{g.plays} plays</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-green)', fontWeight: 600 }}>${g.revenueUsd.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="glass-panel" style={{ padding: 16 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color, marginTop: 6 }}>{value}</div>
    </div>
  )
}

// ─── Shared ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    awaiting: 'var(--accent-yellow)',
    detecting: 'var(--accent-cyan)',
    confirming: 'var(--accent-cyan)',
    paid: 'var(--accent-green)',
    expired: '#FF5F75',
    failed: '#FF5F75',
    pending: 'var(--accent-yellow)',
    approved: 'var(--accent-cyan)',
    rejected: '#FF5F75'
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
  return (
    <div style={{ padding: '40px 24px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
      {children}
    </div>
  )
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
