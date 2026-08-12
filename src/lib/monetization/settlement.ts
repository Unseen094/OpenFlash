import type { PaymentOrder } from './types'
import { getPayment } from './payments'
import { settleGameSale } from './games'

const SETTLE_KEY = 'openflash_settled_orders'

function readLedger(): Record<string, number> {
  try {
    const raw = localStorage.getItem(SETTLE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, number>) : {}
  } catch {
    return {}
  }
}

function writeLedger(ledger: Record<string, number>): void {
  try {
    localStorage.setItem(SETTLE_KEY, JSON.stringify(ledger))
  } catch {
    /* noop */
  }
}

export interface SettleResult {
  settled: boolean
  alreadySettled: boolean
  grossUsd: number
}

/**
 * Idempotently book a paid order exactly once. Plan purchases (gameId =
 * `plan:<id>`) need no ledger entry — the user's entitlement is already
 * derived from the paid order via getEffectivePlan. Game purchases book the
 * sale via settleGameSale.
 */
export function settleOrder(order: PaymentOrder): SettleResult {
  if (!order || order.status !== 'paid') {
    return { settled: false, alreadySettled: false, grossUsd: 0 }
  }
  const ledger = readLedger()
  if (order.id in ledger) {
    return { settled: true, alreadySettled: true, grossUsd: ledger[order.id] }
  }
  const gross = order.amountUsd
  if (!order.gameId.startsWith('plan:')) {
    settleGameSale(order.gameId, gross)
  }
  ledger[order.id] = gross
  writeLedger(ledger)
  return { settled: true, alreadySettled: false, grossUsd: gross }
}
