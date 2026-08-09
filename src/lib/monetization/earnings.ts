import { z } from 'zod'
import { createRepository, Result } from '../storage/repository'
import type { EarningRecord, WithdrawalRequest, WithdrawalStatus, CoinId, Plan } from './types'
import { apiClient, ApiError, checkEntitlement } from './api'

const EARNINGS_KEY = 'openflash_earnings'
const WITHDRAWALS_KEY = 'openflash_withdrawals'

const CoinIdSchema = z.enum(['btc', 'eth', 'sol'])

const EarningRecordSchema: z.ZodType<EarningRecord> = z.object({
  id: z.string(),
  userId: z.string(),
  gameId: z.string(),
  gameTitle: z.string(),
  type: z.enum(['ad', 'download']),
  grossUsd: z.number().nonnegative(),
  creatorUsd: z.number().nonnegative(),
  platformUsd: z.number().nonnegative(),
  createdAt: z.number()
})

const WithdrawalRequestSchema: z.ZodType<WithdrawalRequest> = z.object({
  id: z.string(),
  userId: z.string(),
  userName: z.string(),
  amountUsd: z.number().nonnegative(),
  status: z.enum(['pending', 'approved', 'rejected', 'paid']),
  coin: CoinIdSchema,
  walletAddress: z.string(),
  createdAt: z.number(),
  resolvedAt: z.number().nullable(),
  approvedAt: z.number().nullable().optional(),
  paidAt: z.number().nullable().optional(),
  txHash: z.string().nullable(),
  notes: z.string()
})

const EarningsArraySchema = z.array(EarningRecordSchema)
const WithdrawalsArraySchema = z.array(WithdrawalRequestSchema)

const earningsRepo = createRepository<EarningRecord[]>(EARNINGS_KEY, EarningsArraySchema)
const withdrawalsRepo = createRepository<WithdrawalRequest[]>(WITHDRAWALS_KEY, WithdrawalsArraySchema)

// ─── Earnings ────────────────────────────────────────────────────────────────

function loadEarnings(): EarningRecord[] {
  return earningsRepo.readOrDefault([])
}

function saveEarnings(records: EarningRecord[]): Result<void> {
  return earningsRepo.write(records)
}

export function listEarnings(): EarningRecord[] {
  return loadEarnings().sort((a, b) => b.createdAt - a.createdAt)
}

export function listEarningsByUser(userId: string): EarningRecord[] {
  return loadEarnings().filter(e => e.userId === userId).sort((a, b) => b.createdAt - a.createdAt)
}

export function recordRevenue(params: {
  userId: string
  gameId: string
  gameTitle: string
  type: 'ad' | 'download'
  grossUsd: number
  creatorSharePct: number
}): EarningRecord {
  const grossMicros = Math.round(params.grossUsd * 1_000_000)
  const creatorMicros = Math.floor(grossMicros * params.creatorSharePct / 100)
  const platformMicros = grossMicros - creatorMicros
  const record: EarningRecord = {
    id: `earn_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`,
    userId: params.userId,
    gameId: params.gameId,
    gameTitle: params.gameTitle,
    type: params.type,
    grossUsd: grossMicros / 1_000_000,
    creatorUsd: creatorMicros / 1_000_000,
    platformUsd: platformMicros / 1_000_000,
    createdAt: Date.now()
  }
  const all = loadEarnings()
  all.push(record)
  saveEarnings(all)
  return record
}

export function pendingBalanceForUser(userId: string): number {
  const earned = loadEarnings()
    .filter(e => e.userId === userId)
    .reduce((sum, e) => sum + e.creatorUsd, 0)
  const withdrawn = loadWithdrawals()
    .filter(w => w.userId === userId && w.status !== 'rejected')
    .reduce((sum, w) => sum + w.amountUsd, 0)
  return Math.max(0, earned - withdrawn)
}

// ─── Withdrawals ─────────────────────────────────────────────────────────────

function loadWithdrawals(): WithdrawalRequest[] {
  return withdrawalsRepo.readOrDefault([])
}

function saveWithdrawals(items: WithdrawalRequest[]): Result<void> {
  return withdrawalsRepo.write(items)
}

export function listWithdrawals(): WithdrawalRequest[] {
  return loadWithdrawals().sort((a, b) => b.createdAt - a.createdAt)
}

export function listWithdrawalsByUser(userId: string): WithdrawalRequest[] {
  return loadWithdrawals().filter(w => w.userId === userId).sort((a, b) => b.createdAt - a.createdAt)
}

export function getWithdrawal(id: string): WithdrawalRequest | null {
  return loadWithdrawals().find(w => w.id === id) ?? null
}

/** Smallest withdrawal we will process, in USD. */
export const MIN_WITHDRAWAL = 10

/** Basic per-chain address shape checks (format only, not existence). */
const ADDRESS_PATTERNS: Record<CoinId, RegExp> = {
  btc: /^(bc1[023456789acdefghjklmnpqrstuvwxyz]{11,71}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/,
  eth: /^0x[0-9a-fA-F]{40}$/,
  sol: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
}

export type WithdrawalError =
  | { type: 'invalid_amount'; message: string }
  | { type: 'below_minimum'; message: string; minimum: number }
  | { type: 'insufficient_balance'; message: string; available: number }
  | { type: 'monthly_cap'; message: string; cap: number; used: number; remaining: number }
  | { type: 'invalid_address'; message: string }
  | { type: 'storage'; message: string }

export type WithdrawalResult =
  | { ok: true; value: WithdrawalRequest }
  | { ok: false; error: WithdrawalError }

export function isValidWalletAddress(coin: CoinId, address: string): boolean {
  const trimmed = address.trim()
  if (!trimmed) return false
  return ADDRESS_PATTERNS[coin].test(trimmed)
}

function startOfMonth(ts: number): number {
  const d = new Date(ts)
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime()
}

/** Total non-rejected withdrawals a user has requested in the current calendar month. */
export function withdrawnThisMonth(userId: string, now: number = Date.now()): number {
  const from = startOfMonth(now)
  return loadWithdrawals()
    .filter(w => w.userId === userId && w.status !== 'rejected' && w.createdAt >= from)
    .reduce((sum, w) => sum + w.amountUsd, 0)
}

export interface CreateWithdrawalInput {
  userId: string
  userName: string
  amountUsd: number
  coin: CoinId
  walletAddress: string
  plan: Plan
}

export function createWithdrawal(input: CreateWithdrawalInput): WithdrawalResult {
  const amount = input.amountUsd

  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: { type: 'invalid_amount', message: 'Enter a valid amount greater than zero.' } }
  }

  if (amount < MIN_WITHDRAWAL) {
    return {
      ok: false,
      error: {
        type: 'below_minimum',
        message: `Minimum withdrawal is $${MIN_WITHDRAWAL.toFixed(2)}.`,
        minimum: MIN_WITHDRAWAL
      }
    }
  }

  const available = pendingBalanceForUser(input.userId)
  if (amount > available) {
    return {
      ok: false,
      error: {
        type: 'insufficient_balance',
        message: `Insufficient balance. Available: $${available.toFixed(2)}`,
        available
      }
    }
  }

  const now = Date.now()
  const used = withdrawnThisMonth(input.userId, now)
  const cap = input.plan.maxWithdrawal
  if (used + amount > cap) {
    const remaining = Math.max(0, cap - used)
    return {
      ok: false,
      error: {
        type: 'monthly_cap',
        message: `Your ${input.plan.name} plan allows $${cap}/month. Used $${used.toFixed(2)}, remaining $${remaining.toFixed(2)}.`,
        cap,
        used,
        remaining
      }
    }
  }

  const walletAddress = input.walletAddress.trim()
  if (!isValidWalletAddress(input.coin, walletAddress)) {
    return {
      ok: false,
      error: {
        type: 'invalid_address',
        message: `That does not look like a valid ${input.coin.toUpperCase()} address.`
      }
    }
  }

  const request: WithdrawalRequest = {
    id: `wd_${now.toString(36)}_${Math.random().toString(36).substr(2, 6)}`,
    userId: input.userId,
    userName: input.userName,
    amountUsd: amount,
    status: 'pending',
    coin: input.coin,
    walletAddress,
    createdAt: now,
    resolvedAt: null,
    txHash: null,
    notes: ''
  }
  const all = loadWithdrawals()
  all.push(request)
  const written = saveWithdrawals(all)
  if (!written.ok) {
    return { ok: false, error: { type: 'storage', message: written.error.message } }
  }
  return { ok: true, value: request }
}

export function updateWithdrawal(id: string, patch: Partial<WithdrawalRequest>): WithdrawalRequest | null {
  const all = loadWithdrawals()
  const idx = all.findIndex(w => w.id === id)
  if (idx === -1) return null
  all[idx] = { ...all[idx], ...patch }
  saveWithdrawals(all)
  return all[idx]
}

/**
 * Transition a withdrawal, stamping only the timestamp that belongs to the new
 * status. `resolvedAt` records when the request left `pending` and is never
 * rewritten by a later transition.
 */
export function setWithdrawalStatus(id: string, status: WithdrawalStatus, extra: Partial<WithdrawalRequest> = {}): WithdrawalRequest | null {
  const current = getWithdrawal(id)
  if (!current) return null
  const now = Date.now()
  const stamps: Partial<WithdrawalRequest> = {}
  if (status === 'approved') {
    stamps.approvedAt = now
    stamps.resolvedAt = current.resolvedAt ?? now
  } else if (status === 'rejected') {
    stamps.resolvedAt = current.resolvedAt ?? now
  } else if (status === 'paid') {
    stamps.paidAt = now
    stamps.resolvedAt = current.resolvedAt ?? now
  }
  return updateWithdrawal(id, { status, ...stamps, ...extra })
}

export function totalPendingWithdrawals(): number {
  return loadWithdrawals()
    .filter(w => w.status === 'pending')
    .reduce((sum, w) => sum + w.amountUsd, 0)
}

// ─── Server-side money (Phase 8) ───────────────────────────────────────────────

const USE_SERVER = !!import.meta.env.VITE_API_BASE_URL

/**
 * Server-authoritative balance. Falls back to local computation if no API is configured.
 */
export async function getServerBalance(userId: string): Promise<number> {
  if (!USE_SERVER) {
    return pendingBalanceForUser(userId)
  }
  try {
    const { data } = await apiClient.get<{ balance: number }>(`/api/balance?userId=${userId}`)
    return data.balance
  } catch {
    return pendingBalanceForUser(userId)
  }
}

/**
 * Submit a withdrawal via the server API (idempotent). Falls back to local
 * createWithdrawal if no API is configured.
 */
export async function submitServerWithdrawal(input: CreateWithdrawalInput): Promise<WithdrawalResult> {
  if (!USE_SERVER) {
    return createWithdrawal(input)
  }
  try {
    const result = await apiClient.post<WithdrawalRequest>(
      '/api/withdrawals',
      {
        userId: input.userId,
        userName: input.userName,
        amountUsd: input.amountUsd,
        coin: input.coin,
        walletAddress: input.walletAddress,
      },
      'withdrawal',
      {
        userId: input.userId,
        amountUsd: input.amountUsd,
        coin: input.coin,
      }
    )
    return { ok: true, value: result.data }
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) {
      return { ok: false, error: { type: 'storage', message: 'Withdrawal already submitted' } }
    }
    return { ok: false, error: { type: 'storage', message: e instanceof Error ? e.message : String(e) } }
  }
}

/**
 * Server-authoritative earnings list for a user (syncs to localStorage cache).
 */
export async function syncServerEarnings(userId: string): Promise<EarningRecord[]> {
  if (!USE_SERVER) {
    return listEarningsByUser(userId)
  }
  try {
    const { data } = await apiClient.get<EarningRecord[]>(`/api/earnings?userId=${userId}`)
    const result = earningsRepo.write(data)
    if (!result.ok) {
      return listEarningsByUser(userId)
    }
    return data
  } catch {
    return listEarningsByUser(userId)
  }
}

export { checkEntitlement as verifyEntitlement }
