import type { PaymentOrder } from './types'
import { getPayment, updatePayment, transition } from './payments'
import { settleOrder } from './settlement'

/**
 * ─── Blockchain Monitoring Service ───────────────────────────────────────────
 *
 * Watches on-chain payments for BTC / ETH / SOL and advances an order through
 *  awaiting → detecting → confirming → paid.
 *
 * Choosing the monitor (VITE_MONITOR_MODE):
 *   - "real"       (default in production)  → blockchain polling against
 *     public/configured RPC endpoints. Requires wallet addresses; ETH also
 *     requires VITE_ETHERSCAN_KEY. Checkout refuses to run if the monitor
 *     cannot function.
 *   - "simulated"  (default in development) → the demo monitor that fakes a
 *     transaction so the full UI flow can be exercised. NEVER enabled in
 *     production except for an explicit demo deployment + README notice.
 *   - "off"        → payments are disabled entirely.
 *
 * Amount matching uses a configurable tolerance (VITE_AMOUNT_TOLERANCE_PCT,
 * default 0.5% — the user pays the exact amount, matching covers miners' fees
 * and exchange drift while rejecting egregious underpayment).
 *
 * A tx-hash claim registry prevents double-spending one on-chain transaction
 * across multiple open orders for the same address (shared-address problem).
 */

export interface TxInfo {
  txHash: string
  amountCrypto: number
  confirmations: number
  blockTime: number
}

export interface BlockchainMonitor {
  /** Begin watching an order. Invokes `onUpdate` on status changes. */
  watch(_order: PaymentOrder, _onUpdate: (order: PaymentOrder) => void): void
  /** Stop watching. */
  unwatch(_orderId: string): void
}

export const CLAIM_KEY = 'openflash_claimed_tx'

export function readClaims(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CLAIM_KEY)
    return raw ? JSON.parse(raw) as Record<string, string> : {}
  } catch {
    return {}
  }
}

function writeClaims(claims: Record<string, string>): void {
  try {
    localStorage.setItem(CLAIM_KEY, JSON.stringify(claims))
  } catch { /* noop — claims are best-effort */ }
}

/** A transaction can only ever satisfy one order. */
export function claimTx(coin: string, txHash: string, orderId: string): boolean {
  const claims = readClaims()
  const existing = claims[`${coin}:${txHash.toLowerCase()}`]
  if (existing && existing !== orderId) return false
  claims[`${coin}:${txHash.toLowerCase()}`] = orderId
  writeClaims(claims)
  return true
}

export function readTolerancePct(): number {
  const raw = import.meta.env.VITE_AMOUNT_TOLERANCE_PCT
  const parsed = raw === undefined ? 0.5 : Number(raw)
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 10) return 0.5
  return parsed
}

export function amountsMatch(amountCrypto: number, receivedCrypto: number): boolean {
  if (!Number.isFinite(amountCrypto) || amountCrypto <= 0) return false
  if (!Number.isFinite(receivedCrypto) || receivedCrypto <= 0) return false
  const tolerance = readTolerancePct() / 100
  const low = amountCrypto * (1 - tolerance)
  const high = amountCrypto * (1 + tolerance * 3)
  return receivedCrypto >= low && receivedCrypto <= high
}

// ─── Bitcoin (Blockstream Esplora / mempool.space) ────────────────────────────
// Public API, no key required. Mempool-spotted transactions report 0 confirms.

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(12_000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<unknown>
}

const SATS_PER_BTC = 100_000_000

interface EsploraTx {
  txid?: string
  status?: { confirmed?: boolean; block_height?: number; block_time?: number }
  vout?: Array<{ value?: number; scriptpubkey_address?: string }>
}

async function scanBtc(address: string): Promise<TxInfo | null> {
  const bases = [
    import.meta.env.VITE_BLOCKSTREAM_URL as string | undefined,
    'https://blockstream.info',
    'https://mempool.space'
  ].filter((b): b is string => Boolean(b) && b !== 'demo')

  for (const base of bases) {
    try {
      const data = (await fetchJson(`${base}/api/address/${address}/txs`)) as EsploraTx[]
      if (!Array.isArray(data)) continue
      const txs = data.slice(0, 12)
      let best: TxInfo | null = null
      for (const tx of txs) {
        const txid = tx.txid
        if (!txid) continue
        const receivedSats = (tx.vout || [])
          .filter(v => v.scriptpubkey_address && v.scriptpubkey_address.toLowerCase() === address.toLowerCase())
          .reduce((sum, v) => sum + (typeof v.value === 'number' ? v.value : 0), 0)
        if (receivedSats <= 0) continue
        const amountCrypto = receivedSats / SATS_PER_BTC
        const confirmations = tx.status?.confirmed
          ? Math.max(1, (await bestLatestBlock(base)) - (tx.status.block_height ?? 0) + 1)
          : 0
        const blockTime = tx.status?.block_time ?? Math.floor(Date.now() / 1000)
        if (!best || confirmations > best.confirmations || (confirmations === best.confirmations && receivedSats > best.amountCrypto * SATS_PER_BTC)) {
          best = { txHash: txid, amountCrypto, confirmations, blockTime }
        }
      }
      if (best) return best
      return null
    } catch {
      continue
    }
  }
  return null
}

async function bestLatestBlock(base: string): Promise<number> {
  try {
    const json = (await fetchJson(`${base}/api/blocks/tip/height`)) as unknown
    if (typeof json === 'number') return json
  } catch { /* fall through */ }
  return 0
}

async function scanEth(address: string): Promise<TxInfo | null> {
  const key = import.meta.env.VITE_ETHERSCAN_KEY as string | undefined
  if (!key) return null
  const url = `https://api.etherscan.io/v2/api?chainid=1&module=account&action=txlist&address=${address}&sort=desc&offset=12&apikey=${key}`
  try {
    const json = (await fetchJson(url)) as { result?: Array<Record<string, string>> }
    const txs = Array.isArray(json.result) ? json.result : []
    for (const tx of txs) {
      if (!tx.hash || !tx.to) continue
      if (tx.to.toLowerCase() !== address.toLowerCase()) continue
      if (tx.isError !== '0' && tx.isError !== undefined) continue
      if (tx.txreceipt_status !== '1' && tx.txreceipt_status !== undefined) continue
      const valueWei = BigInt(tx.value ?? '0')
      if (valueWei <= 0n) continue
      const amountCrypto = Number(valueWei) / 1e18
      const confirms = Number(tx.confirmations ?? '0')
      return {
        txHash: tx.hash,
        amountCrypto,
        confirmations: Number.isFinite(confirms) ? confirms : 0,
        blockTime: Number(tx.timeStamp ?? Date.now() / 1000)
      }
    }
    return null
  } catch {
    return null
  }
}

interface SolTxMeta {
  err?: unknown
  blockTime?: number | null
  meta?: {
    postBalances?: number[]
    preBalances?: number[]
  }
  message?: {
    accountKeys?: Array<{ pubkey?: string }>
    instructions?: Array<{ programId?: string; parsed?: { info?: { memo?: string } } }>
  }
  slot?: number
}

async function scanSol(address: string, orderId: string): Promise<TxInfo | null> {
  const rpc = import.meta.env.VITE_SOL_RPC_URL as string | undefined
  if (!rpc || rpc === 'demo') return null
  const post = (method: string, params: unknown[]): Promise<unknown> =>
    fetchJsonWithPost(rpc, method, params)
  try {
    const sigs = (await post('getSignaturesForAddress', [
      address,
      { limit: 15, commitment: 'confirmed' }
    ])) as { result?: Array<{ signature?: string; err?: unknown; blockTime?: number | null }> }
    const list = Array.isArray(sigs.result) ? sigs.result.filter(s => s.signature && !s.err) : []
    for (let i = 0; i < list.length && i < 4; i++) {
      const sig = list[i].signature as string
      const tx = (await post('getTransaction', [
        sig,
        { maxSupportedTransactionVersion: 0, commitment: 'confirmed' }
      ])) as { result?: SolTxMeta }
      const meta = tx.result
      if (!meta || !meta.meta) continue
      const keys = meta.message?.accountKeys || []
      const idx = keys.findIndex(k => k.pubkey?.toLowerCase() === address.toLowerCase())
      if (idx < 0) continue
      const pre = meta.meta.preBalances?.[idx] ?? 0
      const postB = meta.meta.postBalances?.[idx] ?? 0
      const receivedLamports = postB - pre
      if (!Number.isFinite(receivedLamports) || receivedLamports <= 0) continue
      const amountCrypto = receivedLamports / 1e9
      const memo = meta.message?.instructions?.find(
        i => i.programId === 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'
      )
      const memoText = memo?.parsed?.info?.memo || ''
      if (memoText && memoText !== orderId) continue
      const slot = meta.slot ?? 0
      const currentSlot = await getSolSlot(rpc)
      const confirmations = currentSlot > 0 ? Math.max(1, currentSlot - slot) : 1
      return {
        txHash: sig,
        amountCrypto,
        confirmations,
        blockTime: meta.blockTime ?? Math.floor(Date.now() / 1000)
      }
    }
    return null
  } catch {
    return null
  }
}

async function fetchJsonWithPost(rpc: string, method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(rpc, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(12_000)
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<unknown>
}

async function getSolSlot(rpc: string): Promise<number> {
  const { post } = { post: (_m: string, _p: unknown[]) => fetchJsonWithPost(rpc, _m, _p) }
  try {
    const res = (await post('getSlot', [{ commitment: 'finalized' }])) as { result?: number }
    return typeof res.result === 'number' ? res.result : 0
  } catch {
    return 0
  }
}

// ─── Real monitor ─────────────────────────────────────────────────────────────

export class RealMonitor implements BlockchainMonitor {
  private listeners = new Map<string, { order: PaymentOrder; onUpdate: (o: PaymentOrder) => void; timer: ReturnType<typeof setInterval> }>()
  private pollMs: number

  constructor(pollMs = 15_000) {
    const configured = Number(import.meta.env.VITE_POLL_INTERVAL_MS)
    this.pollMs = Number.isFinite(configured) && configured >= 5_000 ? configured : pollMs
  }

  watch(order: PaymentOrder, onUpdate: (updated: PaymentOrder) => void): void {
    if (this.listeners.has(order.id)) return
    if (order.status === 'paid' || order.status === 'expired' || order.status === 'failed') return

    const tick = async () => {
      const fresh = this.listeners.get(order.id)
      if (!fresh) return
      const current = getPayment(order.id)
      if (!current) { this.unwatch(order.id); return }
      if (current.status === 'paid' || current.status === 'failed' || current.status === 'expired') {
        this.unwatch(order.id)
        return
      }
      if (current.expiresAt < Date.now() && current.status === 'awaiting') {
        const result = transition(order.id, 'expired')
        if (result.ok) { onUpdate(result.value); this.unwatch(order.id) }
        return
      }

      let tx: TxInfo | null = null
      try {
        if (current.coin === 'btc') tx = await scanBtc(current.address)
        else if (current.coin === 'eth') tx = await scanEth(current.address)
        else tx = await scanSol(current.address, current.id)
      } catch { /* network error — retry next poll */ }

      if (!tx) return
      if (current.expiresAt < Date.now()) {
        const result = transition(order.id, 'expired')
        if (result.ok) { onUpdate(result.value); this.unwatch(order.id) }
        return
      }
      if (!amountsMatch(current.amountCrypto, tx.amountCrypto)) return
      if (!claimTx(current.coin, tx.txHash, order.id)) {
        const result = transition(order.id, 'failed')
        if (result.ok) { onUpdate(result.value); this.unwatch(order.id) }
        return
      }

      const updated = updatePayment(order.id, {
        status: tx.confirmations > 0 ? 'confirming' : 'detecting',
        txHash: tx.txHash,
        confirmations: Math.max(tx.confirmations, current.confirmations)
      })
      if (!updated) return

      if (updated.status === 'confirming' && updated.confirmations >= updated.requiredConfirmations) {
        const paid = transition(order.id, 'paid', { paidAt: Date.now() })
        if (paid.ok) {
          settleOrder(paid.value)
          onUpdate(paid.value)
          this.unwatch(order.id)
          return
        }
      }
      onUpdate(updated)
    }

    const run = () => { void tick() }
    const timer = setInterval(run, this.pollMs)
    this.listeners.set(order.id, { order, onUpdate, timer })
    run()
  }

  unwatch(orderId: string): void {
    const l = this.listeners.get(orderId)
    if (l) {
      clearInterval(l.timer)
      this.listeners.delete(orderId)
    }
  }
}

// ─── Demo monitor (development / explicit demo deploys only) ─────────────────

export class SimulatedMonitor implements BlockchainMonitor {
  private listeners = new Map<string, { order: PaymentOrder; onUpdate: (o: PaymentOrder) => void; timer: ReturnType<typeof setInterval> }>()

  watch(order: PaymentOrder, onUpdate: (updated: PaymentOrder) => void): void {
    if (this.listeners.has(order.id)) return
    let phase: 'awaiting' | 'detecting' | 'confirming' = 'awaiting'
    const timer = setInterval(() => {
      const current = this.listeners.get(order.id)
      if (!current) return
      const fresh = getPayment(order.id)
      if (!fresh) { this.unwatch(order.id); return }
      if (fresh.status !== 'awaiting' && fresh.status !== 'detecting' && fresh.status !== 'confirming') {
        this.unwatch(order.id)
        return
      }
      if (phase === 'awaiting') {
        phase = 'detecting'
        const txHash = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
        const updated = updatePayment(order.id, { status: 'detecting', txHash })
        if (updated) onUpdate(updated)
      } else if (phase === 'detecting') {
        phase = 'confirming'
        const updated = updatePayment(order.id, { status: 'confirming', confirmations: 1 })
        if (updated) onUpdate(updated)
      } else {
        const next = Math.min(fresh.confirmations + 1, fresh.requiredConfirmations)
        const updated = updatePayment(order.id, { confirmations: next })
        if (updated && updated.confirmations >= updated.requiredConfirmations) {
          const paid = transition(order.id, 'paid', { paidAt: Date.now() })
          if (paid.ok) {
            settleOrder(paid.value)
            onUpdate(paid.value)
            this.unwatch(order.id)
          }
        }
      }
    }, 3000)
    this.listeners.set(order.id, { order, onUpdate, timer })
  }

  unwatch(orderId: string): void {
    const l = this.listeners.get(orderId)
    if (l) {
      clearInterval(l.timer)
      this.listeners.delete(orderId)
    }
  }
}

// ─── Off monitor (payments disabled) ─────────────────────────────────────────

export class OffMonitor implements BlockchainMonitor {
  watch(): void { /* payments disabled */ }
  unwatch(): void { /* noop */ }
}

// ─── Monitor factory ─────────────────────────────────────────────────────────

export function isPaymentsEnabled(): boolean {
  if (import.meta.env.PROD) {
    const mode = import.meta.env.VITE_MONITOR_MODE
    if (mode === 'off') return false
    if (mode === 'simulated') return true
    const btc = import.meta.env.VITE_BTC_ADDRESS
    const eth = import.meta.env.VITE_ETH_ADDRESS
    const sol = import.meta.env.VITE_SOL_ADDRESS
    const anyAddress = Boolean(btc || eth || sol)
    if (!anyAddress) return false
    if (eth && !import.meta.env.VITE_ETHERSCAN_KEY) return false
    if (sol && !import.meta.env.VITE_SOL_RPC_URL) return false
    return true
  }
  return import.meta.env.VITE_MONITOR_MODE !== 'off'
}

function createMonitor(): BlockchainMonitor {
  const mode = import.meta.env.VITE_MONITOR_MODE
  if (mode === 'simulated') return new SimulatedMonitor()
  if (mode === 'real') return new RealMonitor()
  if (import.meta.env.PROD) return mode === 'off' ? new OffMonitor() : new RealMonitor()
  return new SimulatedMonitor()
}

export const monitor: BlockchainMonitor = createMonitor()