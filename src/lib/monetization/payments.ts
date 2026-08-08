import type { CoinId, PaymentOrder, PaymentStatus } from './types'
import { getCoin } from './coins'

const STORAGE_KEY = 'openflash_payments'

function loadAll(): PaymentOrder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveAll(orders: PaymentOrder[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders))
}

export function listPayments(): PaymentOrder[] {
  return loadAll().sort((a, b) => b.createdAt - a.createdAt)
}

export function listPaymentsByUser(userId: string): PaymentOrder[] {
  return loadAll().filter(o => o.userId === userId).sort((a, b) => b.createdAt - a.createdAt)
}

export function getPayment(id: string): PaymentOrder | null {
  return loadAll().find(o => o.id === id) ?? null
}

export interface CreateOrderInput {
  userId: string
  gameId: string
  gameTitle: string
  coin: CoinId
  amountUsd: number
  rate: number
}

export function createOrder(input: CreateOrderInput): PaymentOrder {
  const coin = getCoin(input.coin)
  const now = Date.now()
  const amountCrypto = Math.ceil((input.amountUsd / input.rate) * 1e8) / 1e8
  const order: PaymentOrder = {
    id: `ord_${now.toString(36)}_${Math.random().toString(36).substr(2, 6)}`,
    userId: input.userId,
    gameId: input.gameId,
    gameTitle: input.gameTitle,
    coin: input.coin,
    amountCrypto,
    amountUsd: input.amountUsd,
    rate: input.rate,
    address: coin.address,
    status: 'awaiting',
    txHash: null,
    confirmations: 0,
    requiredConfirmations: coin.confirmations,
    createdAt: now,
    expiresAt: now + coin.expiresIn * 60 * 1000,
    paidAt: null
  }
  const all = loadAll()
  all.push(order)
  saveAll(all)
  return order
}

export function updatePayment(id: string, patch: Partial<PaymentOrder>): PaymentOrder | null {
  const all = loadAll()
  const idx = all.findIndex(o => o.id === id)
  if (idx === -1) return null
  all[idx] = { ...all[idx], ...patch }
  saveAll(all)
  return all[idx]
}

export function setStatus(id: string, status: PaymentStatus): PaymentOrder | null {
  return updatePayment(id, { status })
}

export function deletePayment(id: string): void {
  saveAll(loadAll().filter(o => o.id !== id))
}

/** Count of payments by status — used in admin analytics. */
export function paymentStats() {
  const all = loadAll()
  const stats: Record<PaymentStatus, number> = {
    awaiting: 0, detecting: 0, confirming: 0, paid: 0, expired: 0, failed: 0
  }
  for (const o of all) stats[o.status]++
  return stats
}
