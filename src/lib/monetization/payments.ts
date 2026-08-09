import { z } from 'zod'
import { createRepository, Result } from '../storage/repository'
import type { CoinId, PaymentOrder, PaymentStatus } from './types'
import { getCoin } from './coins'
import { getServerPaymentStatus } from './api'
import { apiClient } from './api'

const STORAGE_KEY = 'openflash_payments'

const CoinIdSchema = z.enum(['btc', 'eth', 'sol'])

const PaymentStatusSchema = z.enum(['awaiting', 'detecting', 'confirming', 'paid', 'expired', 'failed'])

const PaymentOrderSchema: z.ZodType<PaymentOrder> = z.object({
  id: z.string(),
  userId: z.string(),
  gameId: z.string(),
  gameTitle: z.string(),
  coin: CoinIdSchema,
  amountCrypto: z.number().nonnegative(),
  amountUsd: z.number().nonnegative(),
  rate: z.number().positive(),
  address: z.string(),
  status: PaymentStatusSchema,
  txHash: z.string().nullable(),
  confirmations: z.number().nonnegative(),
  requiredConfirmations: z.number().nonnegative(),
  createdAt: z.number(),
  expiresAt: z.number(),
  paidAt: z.number().nullable()
})

const PaymentsArraySchema = z.array(PaymentOrderSchema)

const paymentsRepo = createRepository<PaymentOrder[]>(STORAGE_KEY, PaymentsArraySchema)

function loadAll(): PaymentOrder[] {
  return paymentsRepo.readOrDefault([])
}

function saveAll(orders: PaymentOrder[]): Result<void> {
  return paymentsRepo.write(orders)
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

// ─── State machine ───────────────────────────────────────────────────────────

/** Statuses from which no further transition is possible. */
export const TERMINAL_STATUSES: readonly PaymentStatus[] = ['paid', 'expired', 'failed']

/** Every legal status transition. Anything not listed here is rejected. */
export const ALLOWED_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  awaiting: ['detecting', 'expired', 'failed'],
  detecting: ['confirming', 'failed', 'expired'],
  confirming: ['paid', 'failed'],
  paid: [],
  expired: [],
  failed: []
}

export type PaymentTransitionError =
  | { type: 'not_found'; message: string }
  | { type: 'terminal'; message: string; from: PaymentStatus; to: PaymentStatus }
  | { type: 'invalid_transition'; message: string; from: PaymentStatus; to: PaymentStatus }
  | { type: 'storage'; message: string }

export type TransitionResult =
  | { ok: true; value: PaymentOrder }
  | { ok: false; error: PaymentTransitionError }

export function isTerminalStatus(status: PaymentStatus): boolean {
  return TERMINAL_STATUSES.includes(status)
}

export function canTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  if (from === to) return true
  return ALLOWED_TRANSITIONS[from].includes(to)
}

/**
 * Move an order to `newStatus`, rejecting any transition that the state
 * machine does not allow. Extra fields may be written atomically with the
 * status change via `patch`.
 */
export function transition(
  id: string,
  newStatus: PaymentStatus,
  patch: Partial<Omit<PaymentOrder, 'id' | 'status'>> = {}
): TransitionResult {
  const all = loadAll()
  const idx = all.findIndex(o => o.id === id)
  if (idx === -1) {
    return { ok: false, error: { type: 'not_found', message: `Payment ${id} not found` } }
  }
  const current = all[idx]
  const from = current.status
  if (from !== newStatus) {
    if (isTerminalStatus(from)) {
      return {
        ok: false,
        error: { type: 'terminal', message: `Payment ${id} is already ${from}`, from, to: newStatus }
      }
    }
    if (!canTransition(from, newStatus)) {
      return {
        ok: false,
        error: {
          type: 'invalid_transition',
          message: `Cannot move payment ${id} from ${from} to ${newStatus}`,
          from,
          to: newStatus
        }
      }
    }
  }
  const next: PaymentOrder = { ...current, ...patch, status: newStatus }
  all[idx] = next
  const written = saveAll(all)
  if (!written.ok) {
    return { ok: false, error: { type: 'storage', message: written.error.message } }
  }
  return { ok: true, value: next }
}

/**
 * Patch an order. Status changes are routed through the state machine and are
 * dropped (returning null) when the transition is illegal.
 */
export function updatePayment(id: string, patch: Partial<PaymentOrder>): PaymentOrder | null {
  const { status, id: _ignoredId, ...rest } = patch
  if (status !== undefined) {
    const result = transition(id, status, rest)
    return result.ok ? result.value : null
  }
  const all = loadAll()
  const idx = all.findIndex(o => o.id === id)
  if (idx === -1) return null
  all[idx] = { ...all[idx], ...rest }
  saveAll(all)
  return all[idx]
}

export function setStatus(id: string, status: PaymentStatus): PaymentOrder | null {
  const result = transition(id, status)
  return result.ok ? result.value : null
}

export function deletePayment(id: string): void {
  saveAll(loadAll().filter(o => o.id !== id))
}

export function paymentStats() {
  const all = loadAll()
  const stats: Record<PaymentStatus, number> = {
    awaiting: 0, detecting: 0, confirming: 0, paid: 0, expired: 0, failed: 0
  }
  for (const o of all) stats[o.status]++
  return stats
}

// ─── Server-side payments (Phase 8) ───────────────────────────────────────────

const USE_SERVER = !!import.meta.env.VITE_API_BASE_URL

/**
 * Create a payment order via the server API (with idempotency).
 * Falls back to local createOrder if no API is configured.
 */
export async function createServerOrderSafe(
  input: CreateOrderInput
): Promise<PaymentOrder> {
  if (!USE_SERVER) {
    return createOrder(input)
  }
  try {
    const rate = input.rate
    const orderId = await apiClient.post<string>(
      '/api/payments/create-order',
      {
        userId: input.userId,
        gameId: input.gameId,
        gameTitle: input.gameTitle,
        coin: input.coin,
        amountUsd: input.amountUsd,
        rate,
      },
      'createOrder',
      {
        userId: input.userId,
        gameId: input.gameId,
        coin: input.coin,
        amountUsd: input.amountUsd,
      }
    )

    const coin = getCoin(input.coin)
    const amountCrypto = Math.ceil((input.amountUsd / input.rate) * 1e8) / 1e8
    const now = Date.now()

    const order: PaymentOrder = {
      id: orderId.data,
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
  } catch {
    return createOrder(input)
  }
}

/**
 * Fetch the authoritative payment status from the server.
 * Falls back to local storage if no API is configured.
 */
export async function fetchServerPaymentStatus(orderId: string): Promise<PaymentOrder | null> {
  if (!USE_SERVER) {
    return getPayment(orderId)
  }
  try {
     const status = await getServerPaymentStatus(orderId)
     const existing = getPayment(orderId)
     if (!existing) return null
     const updated: PaymentOrder = { ...existing, ...status, status: status.status as PaymentStatus }
    const all = loadAll()
    const idx = all.findIndex(o => o.id === orderId)
    if (idx >= 0) {
      all[idx] = updated
      saveAll(all)
    }
    return updated
  } catch {
    return getPayment(orderId)
  }
}
