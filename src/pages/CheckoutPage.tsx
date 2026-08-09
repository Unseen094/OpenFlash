import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import QrCode from '../components/QrCode'
import { IconCheck, IconRefresh, IconArrowRight } from '../components/Icons'
import { COIN_LIST } from '../lib/monetization/coins'
import type { CoinId, PaymentOrder } from '../lib/monetization/types'
import { fetchRates, usdToCrypto } from '../lib/monetization/rates'
import { createOrder, getPayment, transition } from '../lib/monetization/payments'
import { monitor } from '../lib/monetization/blockchain'
import { getPublishedGame } from '../lib/monetization/games'
import { getPlan } from '../lib/monetization/plans'

export default function CheckoutPage() {
  const { user } = useAuth()
  const userId = user ? (user.uid || user.email || 'anonymous') : ''
  const [searchParams] = useSearchParams()
  const gameId = searchParams.get('game') || ''
  const gameTitle = searchParams.get('title') || 'Game'
  const planId = searchParams.get('plan') || ''
  const isPlanPurchase = !!planId

  // Resolve price from authoritative source (game/plan data), never from URL.
  // The URL price param is ignored to prevent price manipulation.
  let priceUsd = 0
  if (isPlanPurchase && planId) {
    const plan = getPlan(planId as any)
    priceUsd = plan.priceUsd
  } else if (gameId) {
    const game = getPublishedGame(gameId)
    priceUsd = game?.priceUsd ?? 0
  }

  const itemTitle = isPlanPurchase ? `Plan: ${planId.charAt(0).toUpperCase() + planId.slice(1)}` : gameTitle

  const [coin, setCoin] = useState<CoinId>('btc')
  const [rates, setRates] = useState<Record<CoinId, number> | null>(null)
  const [order, setOrder] = useState<PaymentOrder | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  // Load exchange rates once
  useEffect(() => {
    fetchRates().then(setRates)
  }, [])

  // Create order when coin & rates are ready.
  // Deliberately keyed on coin (not `order`) so switching coin tears the old
  // watcher down before a new order is created.
  useEffect(() => {
    if (!rates || !userId) return
    const rate = rates[coin]
    if (!rate) return
    const o = createOrder({
      userId,
      gameId,
      gameTitle,
      coin,
      amountUsd: priceUsd,
      rate
    })
    setOrder(o)
    monitor.watch(o, updated => setOrder({ ...updated }))
    return () => { monitor.unwatch(o.id) }
  }, [rates, coin, userId, gameId, gameTitle, priceUsd])

  const orderId = order?.id
  const expiresAt = order?.expiresAt

  // Countdown timer. Expiry is only applied if the order is still awaiting in
  // storage — a payment confirmed on the last tick must win the race.
  useEffect(() => {
    if (!orderId || !expiresAt) return
    const tick = () => {
      const left = Math.max(0, Math.round((expiresAt - Date.now()) / 1000))
      setSecondsLeft(left)
      if (left > 0) return
      const fresh = getPayment(orderId)
      if (!fresh || fresh.status !== 'awaiting') return
      const result = transition(orderId, 'expired')
      if (result.ok) {
        monitor.unwatch(orderId)
        setOrder({ ...result.value })
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
  const cryptoAmount = rate ? usdToCrypto(priceUsd, rate) : 0

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
    expired: { text: 'Expired', color: '#FF5F75' },
    failed: { text: 'Failed', color: '#FF5F75' }
  }

  if (!user) {
    return <CheckoutShell><p style={{ color: 'var(--text-secondary)' }}>Please sign in to purchase.</p></CheckoutShell>
  }

  if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
    return <CheckoutShell><p style={{ color: 'var(--text-secondary)' }}>This item is free or has no valid price. No payment required.</p></CheckoutShell>
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
            Send crypto to the address below. Payment will be detected automatically.
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

        {!rates && <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading exchange rates…</p>}

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
              {order.status === 'awaiting' && (
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 14,
                  fontWeight: 700,
                  color: secondsLeft < 120 ? '#FF5F75' : 'var(--accent-yellow)'
                }}>
                  {formatTime(secondsLeft)}
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
                  data={`${COIN_LIST.find(c => c.id === coin)?.uriScheme}${order.address}?amount=${order.amountCrypto}`}
                  size={180}
                />
                <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  Scan to pay
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
                    <button onClick={copyAddress} className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 10 }}>
                      {copied ? <><IconCheck size={12} /> Copied</> : 'Copy'}
                    </button>
                  </div>
                </Field>
                <Field label="Exchange rate">
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>
                    1 {coin.toUpperCase()} = ${rate.toLocaleString()} USD
                  </span>
                </Field>
                {order.txHash && (
                  <Field label="Transaction hash">
                    <code style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', wordBreak: 'break-all' }}>
                      {order.txHash}
                    </code>
                  </Field>
                )}
                {order.status === 'confirming' && (
                  <Field label="Confirmations">
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                      {order.confirmations} / {order.requiredConfirmations}
                    </span>
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
                    <a href="/earnings" className="btn btn-primary" style={{ padding: '6px 14px', fontSize: 12, textDecoration: 'none' }}>
                      View Earnings <IconArrowRight size={13} />
                    </a>
                  ) : (
                    <a href={`/play/${gameId}`} className="btn btn-primary" style={{ padding: '6px 14px', fontSize: 12, textDecoration: 'none' }}>
                      Play now <IconArrowRight size={13} />
                    </a>
                  )}
                </div>
              )}
            </div>

            {error && <p style={{ fontSize: 12, color: '#FF5F75' }}>{error}</p>}
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
