import type { CoinId, PaymentOrder, PaymentStatus } from './types'
import { updatePayment } from './payments'

/**
 * ─── Blockchain Monitoring Service ───────────────────────────────────────────
 *
 * This module provides a UNIFIED interface for watching on-chain payments.
 *
 * The included `SimulatedMonitor` is a CLIENT-SIDE STAND-IN for development
 * and demos. It randomly "detects" a transaction and advances confirmations
 * so you can test the full UI flow without real crypto.
 *
 * For production, implement the `BlockchainMonitor` interface against public
 * RPC endpoints or a self-hosted node:
 *
 *   - BTC  → Blockstream API (blockstream.info/api) or electrum
 *   - ETH  → Etherscan / Alchemy / Infura public JSON-RPC
 *   - SOL  → Solana public RPC (api.mainnet-beta.solana.com)
 *
 * Each implementation should poll `checkAddress(address, sinceBlock)` and
 * invoke the callback when a matching tx lands.
 */

export interface TxInfo {
  txHash: string
  amountCrypto: number
  confirmations: number
}

export interface BlockchainMonitor {
  /** Begin watching an order. Invokes `onUpdate` on status changes. */
  watch(order: PaymentOrder, onUpdate: (order: PaymentOrder) => void): void
  /** Stop watching. */
  unwatch(orderId: string): void
}

type Listener = {
  order: PaymentOrder
  onUpdate: (o: PaymentOrder) => void
  timer: ReturnType<typeof setInterval>
}

/**
 * Simulated monitor — randomly advances payment status so the full UI flow
 * (awaiting → detecting → confirming → paid) can be exercised in dev.
 *
 * Detects tx ~4s after watch(); a confirmation arrives ~3s after that;
 * paid status reached after `requiredConfirmations` ticks.
 */
export class SimulatedMonitor implements BlockchainMonitor {
  private listeners = new Map<string, Listener>()

  watch(order: PaymentOrder, onUpdate: (o: PaymentOrder) => void): void {
    if (this.listeners.has(order.id)) return

    let phase: 'awaiting' | 'detecting' | 'confirming' = 'awaiting'

    const timer = setInterval(() => {
      const current = this.listeners.get(order.id)
      if (!current) return

      if (phase === 'awaiting') {
        phase = 'detecting'
        const txHash = '0x' + Array.from({ length: 64 }, () =>
          Math.floor(Math.random() * 16).toString(16)
        ).join('')
        const updated = updatePayment(order.id, {
          status: 'detecting' as PaymentStatus,
          txHash
        })
        if (updated) onUpdate(updated)
      } else if (phase === 'detecting') {
        phase = 'confirming'
        const updated = updatePayment(order.id, {
          status: 'confirming' as PaymentStatus,
          confirmations: 1
        })
        if (updated) onUpdate(updated)
      } else if (phase === 'confirming') {
        const updated = updatePayment(order.id, {
          confirmations: Math.min((current.order.confirmations || 0) + 1, current.order.requiredConfirmations)
        })
        if (updated) {
          if (updated.confirmations >= updated.requiredConfirmations) {
            const paid = updatePayment(order.id, {
              status: 'paid' as PaymentStatus,
              paidAt: Date.now()
            })
            if (paid) {
              onUpdate(paid)
              this.unwatch(order.id)
              return
            }
          }
          onUpdate(updated)
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

/** Single shared monitor instance. Swap implementation for production. */
export const monitor: BlockchainMonitor = new SimulatedMonitor()

/**
 * PUBLIC RPC TEMPLATE (production — uncomment & implement per chain):
 *
 * export class RealMonitor implements BlockchainMonitor {
 *   async checkAddress(coin: CoinId, address: string): Promise<TxInfo | null> {
 *     switch (coin) {
 *       case 'btc': {
 *         const r = await fetch(`https://blockstream.info/api/address/${address}/txs`)
 *         const txs = await r.json()
 *         // find unspent-matching recent tx ...
 *         return null
 *       }
 *       case 'eth': {
 *         const r = await fetch(
 *           `https://api.etherscan.io/api?module=account&action=txlist&address=${address}&sort=desc&apikey=${env.VITE_ETHERSCAN_KEY}`
 *         )
 *         // parse result ...
 *         return null
 *       }
 *       case 'sol': {
 *         const r = await fetch('https://api.mainnet-beta.solana.com', {
 *           method: 'POST',
 *           headers: { 'Content-Type': 'application/json' },
 *           body: JSON.stringify({
 *             jsonrpc: '2.0', id: 1, method: 'getSignaturesForAddress',
 *             params: [address, { limit: 10 }]
 *           })
 *         })
 *         // parse result ...
 *         return null
 *       }
 *     }
 *   }
 * }
 */
