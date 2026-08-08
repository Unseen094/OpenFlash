import type { EarningRecord, WithdrawalRequest, WithdrawalStatus, CoinId } from './types'

const EARNINGS_KEY = 'openflash_earnings'
const WITHDRAWALS_KEY = 'openflash_withdrawals'

// ─── Earnings ────────────────────────────────────────────────────────────────

function loadEarnings(): EarningRecord[] {
  try {
    const raw = localStorage.getItem(EARNINGS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveEarnings(records: EarningRecord[]): void {
  localStorage.setItem(EARNINGS_KEY, JSON.stringify(records))
}

export function listEarnings(): EarningRecord[] {
  return loadEarnings().sort((a, b) => b.createdAt - a.createdAt)
}

export function listEarningsByUser(userId: string): EarningRecord[] {
  return loadEarnings().filter(e => e.userId === userId).sort((a, b) => b.createdAt - a.createdAt)
}

/**
 * Record a revenue event and split it between creator and platform.
 * Returns the created record.
 */
export function recordRevenue(params: {
  userId: string
  gameId: string
  gameTitle: string
  type: 'ad' | 'download'
  grossUsd: number
  creatorSharePct: number
}): EarningRecord {
  const creatorUsd = Math.round(params.grossUsd * (params.creatorSharePct / 100) * 100) / 100
  const platformUsd = Math.round((params.grossUsd - creatorUsd) * 100) / 100
  const record: EarningRecord = {
    id: `earn_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`,
    userId: params.userId,
    gameId: params.gameId,
    gameTitle: params.gameTitle,
    type: params.type,
    grossUsd: params.grossUsd,
    creatorUsd,
    platformUsd,
    createdAt: Date.now()
  }
  const all = loadEarnings()
  all.push(record)
  saveEarnings(all)
  return record
}

/** Sum of creator earnings not yet withdrawn. */
export function pendingBalanceForUser(userId: string): number {
  return loadEarnings()
    .filter(e => e.userId === userId)
    .reduce((sum, e) => sum + e.creatorUsd, 0)
}

// ─── Withdrawals ─────────────────────────────────────────────────────────────

function loadWithdrawals(): WithdrawalRequest[] {
  try {
    const raw = localStorage.getItem(WITHDRAWALS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveWithdrawals(items: WithdrawalRequest[]): void {
  localStorage.setItem(WITHDRAWALS_KEY, JSON.stringify(items))
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

export interface CreateWithdrawalInput {
  userId: string
  userName: string
  amountUsd: number
  coin: CoinId
  walletAddress: string
}

export function createWithdrawal(input: CreateWithdrawalInput): WithdrawalRequest {
  const request: WithdrawalRequest = {
    id: `wd_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`,
    userId: input.userId,
    userName: input.userName,
    amountUsd: input.amountUsd,
    status: 'pending',
    coin: input.coin,
    walletAddress: input.walletAddress,
    createdAt: Date.now(),
    resolvedAt: null,
    txHash: null,
    notes: ''
  }
  const all = loadWithdrawals()
  all.push(request)
  saveWithdrawals(all)
  return request
}

export function updateWithdrawal(id: string, patch: Partial<WithdrawalRequest>): WithdrawalRequest | null {
  const all = loadWithdrawals()
  const idx = all.findIndex(w => w.id === id)
  if (idx === -1) return null
  all[idx] = { ...all[idx], ...patch }
  saveWithdrawals(all)
  return all[idx]
}

export function setWithdrawalStatus(id: string, status: WithdrawalStatus, extra: Partial<WithdrawalRequest> = {}): WithdrawalRequest | null {
  return updateWithdrawal(id, { status, resolvedAt: Date.now(), ...extra })
}

/** Total pending withdrawal amount (admin view). */
export function totalPendingWithdrawals(): number {
  return loadWithdrawals()
    .filter(w => w.status === 'pending')
    .reduce((sum, w) => sum + w.amountUsd, 0)
}
