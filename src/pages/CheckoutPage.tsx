import { useEffect, useState, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import QrCode from '../components/QrCode'
import { IconCheck, IconRefresh, IconArrowRight, IconLock } from '../components/Icons'
import { COIN_LIST, buildPaymentUri, getCoin } from '../lib/monetization/coins'
import type { CoinId, PaymentOrder } from '../lib/monetization/types'
import { fetchRatesServer } from '../lib/monetization/rates'
import { createOrder, getPayment, transition } from '../lib/monetization/payments'
import { monitor, isPaymentsEnabled } from '../lib/monetization/blockchain'
import { getPublishedGame } from '../lib/monetization/games'
import { getPlan, isPlanId, activateFreePlan } from '../lib/monetization/plans'

export default function CheckoutPage() {
  const { user } = useAuth()
  const userId = user ? (user.uid || user.email || 'anonymous') : ''
  const [searchParams] = useSearchParams()
  const gameId = searchParams.get('game') || ''
  const gameTitle = searchParams.get('title') || 'Game'
  const planId = searchParams.get('plan') || ''
  const isPlanPurchase = !!planId

  // Price is resolved from the authoritative source (game/plan data), never
  // from a URL parameter — the URL price is ignored to prevent tampering.
  let priceUsd = 0
  let itemKnown = false
  if (isPlanPurchase && planId) {
    priceUsd = isPlanId(planId) ? getPlan(planId).priceUsd : 0
    itemKnown = isPlanId(planId)
  } else if (gameId) {
    const game = getPublishedGame(gameId)
    priceUsd = game?.priceUsd ?? 0
    itemKnown = Boolean(game && (game.priceUsd > 0 || !game.priceUsd))
  }
  const validPlan = isPlanPurchase && isPlanId(planId) ? planId : null
  const paymentsEnabled = isPaymentsEnabled()

  const itemTitle = isPlanPurchase ? `Plan: ${planId.charAt(0).toUpperCase() + planId.slice(1)}` : gameTitle

  const [coin, setCoin] = useState<CoinId>('btc')
  const [rates, setRates] = useState<Record<CoinId, number> | null>(null)
  const [ratesFailed, setRatesFailed] = useState(false)
  const [order, setOrder] = useState<PaymentOrder | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchRatesServer()
      .then(setRates)
      .catch(() => {
        setRatesFailed(true)
        setRates(null)
      })
  }, [])

  // Free plans (e.g. Beta) don't need crypto — activate them instantly.
  const activatePlanNow = () => {
    if (!validPlan || !userId) return
    const activated = activateFreePlan(userId, validPlan)
    if (activated) setOrder(activated)
  }

  // Create order when coin & rates are ready, tear down any watcher from the
  // previous coin first. Plan purchases record `gameId = plan:<id>` so the
  // entitlement survives reloads.
  useEffect(() => {
    if (!rates || !userId || priceUsd <= 0 || !paymentsEnabled) return
    const rate = rates[coin]
    if (!rate) return
    const o = createOrder({
      userId,
      gameId: isPlanPurchase ? `plan:${planId}` : gameId,
      gameTitle,
      coin,
      amountUsd: priceUsd,
      rate
    })
    setOrder(o)
    monitor.watch(o, updated => setOrder({ ...updated }))
    return () => { monitor.unwatch(o.id) }
  }, [rates, coin, userId, gameId, gameTitle, planId, priceUsd, isPlanPurchase, paymentsEnabled])

  const orderId = order?.id
  const expiresAt = order?.expiresAt

  // Countdown + expiry. A confirmed payment must win the race: expiry only
  // applies while the order is still awaiting, or when a detected transaction
  // has had a generous grace window to confirm.
  useEffect(() => {
    if (!orderId || !expiresAt) return
    const tick = () => {
      const left = Math.max(0, Math.round((expiresAt - Date.now()) / 1000))
      setSecondsLeft(left)
      if (left > 0) return
      const fresh = getPayment(orderId)
      if (!fresh) return
      if (fresh.status === 'awaiting' || fresh.status === 'detecting') {
        const result = transition(orderId, 'expired')
        if (result.ok) {
          monitor.unwatch(orderId)
          setOrder({ ...result.value })
        }
      } else if (fresh.status === 'confirming') {
        const graceOver = Date.now() - fresh.expiresAt > 60 * 60 * 1000
        if (graceOver && fresh.status === 'confirming') {
          const result = transition(orderId, 'failed')
          if (result.ok) {
            monitor.unwatch(orderId)
            setOrder({ ...result.value })
          }
        }
      }
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [orderId, expiresAt])

  const refreshOrder = useCallback(() => {
    if (!order) return
    const fresh = getPayment(order.id)
    if (fresh) setOrder({ ...fresh })
  }, [order])

  const copyAddress = async () => {
    if (!order) return
    try {
      await navigator.clipboard.writeText(order.address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const rate = rates?.[coin]

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const statusLabel: Record<string, { text: React.ReactNode; color: string }> = {
    awaiting: { text: 'Awaiting Payment', color: 'var(--accent-yellow)' },
    detecting: { text: 'Transaction Detected', color: 'var(--accent-cyan)' },
    confirming: { text: 'Confirming…', color: 'var(--accent-cyan)' },
    paid: { text: isPlanPurchase ? 'Plan Activated ✓' : 'Payment Confirmed ✓', color: 'var(--accent-green)' },
    expired: { text: 'Expired', color: '#C62828' },
    failed: { text: 'Failed', color: '#C62828' }
  }

  if (!user) {
    return <CheckoutShell><p style={{ color: 'var(--text-secondary)' }}>Please sign in to purchase.</p></CheckoutShell>
  }

  if (!itemKnown) {
    return (
      <CheckoutShell>
        <div className="panel corner" style={{ padding: 24, maxWidth: 420 }}>
          <div className="row" style={{ gap: 10, marginBottom: 8 }}>
            <IconLock size={18} style={{ opacity: 0.6 }} />
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>Item unavailable</h2>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            This item could not be found. It may have been removed from the arcade.
          </p>
          <Link to="/arcade" className="btn" style={{ textDecoration: 'none', display: 'inline-flex' }}>
            <IconArrowRight size={13} /> Back to Arcade
          </Link>
        </div>
      </CheckoutShell>
    )
  }

  if (!Number.isFinite(priceUsd) || priceUsd < 0) {
    return <CheckoutShell><p style={{ color: 'var(--text-secondary)' }}>This item has no valid price.</p></CheckoutShell>
  }

  // Free plans (e.g. Beta) are activated with one click instead of a crypto flow.
  if (priceUsd === 0 && validPlan) {
    return (
      <CheckoutShell>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 420 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
              Activate {itemTitle}
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              This plan is free. Activate it to enable its features immediately.
            </p>
          </div>
          {order?.status === 'paid' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: 13, color: 'var(--accent-green)', fontWeight: 600 }}>Plan Activated ✓</p>
              <Link to="/earnings" className="btn btn-primary" style={{ padding: '10px 16px', fontSize: 13, textDecoration: 'none', textAlign: 'center' }}>
                View Earnings <IconArrowRight size={14} />
              </Link>
            </div>
          ) : (
            <button onClick={activatePlanNow} className="btn btn-primary" style={{ padding: '10px 16px', fontSize: 13 }}>
              Activate free plan
            </button>
          )}
        </div>
      </CheckoutShell>
    )
  }

  if (!paymentsEnabled) {
    return (
      <CheckoutShell>
        <div className="panel corner" style={{ padding: 24, maxWidth: 460 }}>
          <div className="row" style={{ gap: 10, marginBottom: 8 }}>
            <IconLock size={18} style={{ opacity: 0.6 }} />
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>Payments are not enabled</h2>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            This deployment has not configured a payment wallet (VITE_BTC_ADDRESS / VITE_ETH_ADDRESS /
            VITE_SOL_ADDRESS, plus VITE_ETHERSCAN_KEY for ETH and VITE_SOL_RPC_URL for SOL). Checkout is
            deliberately disabled so no one can pay into an unverified address.
          </p>
          <Link to="/arcade" className="btn" style={{ marginTop: 16, textDecoration: 'none', display: 'inline-flex' }}>
            <IconArrowRight size={13} /> Back to Arcade
          </Link>
        </div>
      </CheckoutShell>
    )
  }

  return (
    <CheckoutShell>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
            Checkout
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Purchasing <strong style={{ color: 'var(--text-primary)' }}>{itemTitle}</strong> · ${priceUsd.toFixed(2)} USD
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Send crypto to the address below. Payment is detected directly on-chain — no manual verification.
          </p>
        </div>

        {/* Coin selector */}
        <div>
          <label style={labelStyle}>Select Cryptocurrency</label>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            {COIN_LIST.map(c => (
              <button
                key={c.id}
                onClick={() => { if (c.id !== coin) { setOrder(null); setCoin(c.id) } }}
                className={`btn ${coin === c.id ? 'btn-cyan' : 'btn-ghost'}`}
                style={{ flex: 1, padding: '8px 12px', fontSize: 12, textTransform: 'capitalize' }}
              >
                {c.name} ({c.symbol})
              </button>
            ))}
          </div>
        </div>

        {!rates && !ratesFailed && <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Fetching live exchange rates…</p>}
        {ratesFailed && (
          <div style={{ padding: '10px 14px', border: '2px solid #C62828', borderRadius: 'var(--radius-md)', fontSize: 12, color: '#C62828' }}>
            Live exchange rates are unavailable right now. Checkout is paused so amounts stay accurate — refresh to retry.
          </div>
        )}

        {order && rates && rate && (
          <>
            {/* Status */}
            <div style={{
              padding: '10px 16px',
              background: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                color: statusLabel[order.status]?.color || 'var(--text-secondary)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }}>
                {statusLabel[order.status]?.text || order.status}
              </span>
              {(order.status === 'awaiting' || order.status === 'detecting') && (
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 14,
                  fontWeight: 700,
                  color: secondsLeft < 120 ? '#C62828' : 'var(--accent-yellow)'
                }}>
                  {formatTime(secondsLeft)}
                </span>
              )}
              {order.status === 'confirming' && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                  {order.confirmations} / {order.requiredConfirmations} confirmations
                </span>
              )}
            </div>

            {/* QR + Address + Amount */}
            <div style={{
              display: 'flex',
              gap: 24,
              flexWrap: 'wrap',
              alignItems: 'flex-start'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <QrCode
                  data={buildPaymentUri(coin, order.address, order.amountCrypto, order.id)}
                  size={180}
                />
                <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  Scan to pay · {getCoin(coin).network}
                </span>
              </div>

              <div style={{ flex: 1, minWidth: 260, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Field label="Amount to send">
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: 'var(--accent-yellow)' }}>
                    {order.amountCrypto.toFixed(8)} {coin.toUpperCase()}
                  </span>
                </Field>
                <Field label="To this address">
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <code style={{
                      flex: 1,
                      fontSize: 11,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-primary)',
                      background: 'var(--bg-tertiary)',
                      padding: '6px 10px',
                      borderRadius: 'var(--radius-sm)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      display: 'block'
                    }}>
                      {order.address}
                    </code>
                    <button onClick={() => void copyAddress()} className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 10 }}>
                      {copied ? <><IconCheck size={12} /> Copied</> : 'Copy'}
                    </button>
                  </div>
                </Field>
                <Field label="Exchange rate (locked for this order)">
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>
                    1 {coin.toUpperCase()} = ${rate.toLocaleString(undefined, { maximumFractionDigits: 2 })} USD
                  </span>
                </Field>
                {order.txHash && (
                  <Field label="Transaction hash">
                    <code style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', wordBreak: 'break-all' }}>
                      {order.txHash}
                    </code>
                  </Field>
                )}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={refreshOrder} className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: 12 }}>
                <IconRefresh size={13} /> Refresh status
              </button>
              {order.status === 'paid' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  {isPlanPurchase ? (
                    <Link to="/earnings" className="btn btn-primary" style={{ padding: '6px 14px', fontSize: 12, textDecoration: 'none' }}>
                      View Earnings <IconArrowRight size={13} />
                    </Link>
                  ) : (
                    <Link to={`/play/${gameId}`} className="btn btn-primary" style={{ padding: '6px 14px', fontSize: 12, textDecoration: 'none' }}>
                      Play now <IconArrowRight size={13} />
                    </Link>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </CheckoutShell>
  )
}

function CheckoutShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      maxWidth: 720,
      margin: '0 auto',
      padding: '40px 24px',
      minHeight: 'calc(100vh - 60px)'
    }}>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ marginTop: 4 }}>{children}</div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: 1,
  display: 'block'
}