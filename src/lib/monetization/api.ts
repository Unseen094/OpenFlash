import type { WithdrawalRequest } from './types'

const envApiBase = (import.meta as unknown as { env: Record<string, string | undefined> }).env.VITE_API_BASE_URL
export const API_BASE_URL = envApiBase || ''

export class ApiError extends Error {
  public readonly status: number
  public readonly code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

const idempotencyKeys = new Map<string, string>()

function getIdempotencyKey(operation: string, params: Record<string, unknown>): string {
  const existing = idempotencyKeys.get(operation)
  if (existing) return existing

  const key = `${operation}:${JSON.stringify(params, Object.keys(params).sort())}`
  const hash = Math.random().toString(36).slice(2, 18)
  const idKey = `${key}_${Date.now()}_${hash}`
  idempotencyKeys.set(operation, idKey)
  return idKey
}

export function clearIdempotencyKey(operation: string): void {
  idempotencyKeys.delete(operation)
}

interface ApiResponse<T> {
  data: T
  status: number
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  idempotencyKey?: string
): Promise<ApiResponse<T>> {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const data: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const errMsg = (data && typeof data === 'object' && 'message' in data)
      ? (data as { message: string }).message
      : response.statusText
    const errCode = (data && typeof data === 'object' && 'code' in data)
      ? (data as { code: string }).code
      : undefined
    throw new ApiError(errMsg, response.status, errCode)
  }

  return { data: data as T, status: response.status }
}

export const apiClient = {
  get<T>(path: string): Promise<ApiResponse<T>> {
    return request<T>('GET', path)
  },
  post<T>(path: string, body: unknown, operation?: string, params?: Record<string, unknown>): Promise<ApiResponse<T>> {
    const idKey = operation && params ? getIdempotencyKey(operation, params) : undefined
    return request<T>('POST', path, body, idKey)
  },
  put<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
    return request<T>('PUT', path, body)
  },
  delete<T>(path: string): Promise<ApiResponse<T>> {
    return request<T>('DELETE', path)
  },
  clearIdempotencyKey,
}

export interface EntitlementCheck {
  entitled: boolean
}

export async function checkEntitlement(gameId: string, userId: string): Promise<boolean> {
  try {
    const { data } = await apiClient.get<EntitlementCheck>(`/api/entitlements/check?gameId=${gameId}&userId=${userId}`)
    return data.entitled
  } catch {
    return false
  }
}

export async function createServerOrder(
  userId: string,
  gameId: string,
  gameTitle: string,
  coin: string,
  amountUsd: number
): Promise<string> {
  const { data } = await apiClient.post<{ orderId: string }>(
    '/api/payments/create-order',
    { userId, gameId, gameTitle, coin, amountUsd },
    'createOrder',
    { userId, gameId, coin, amountUsd }
  )
  return data.orderId
}

export interface PaymentStatusResponse {
  status: string
  txHash: string | null
  confirmations: number
  paidAt: number | null
}

export async function getServerPaymentStatus(orderId: string): Promise<PaymentStatusResponse> {
  const { data } = await apiClient.get<PaymentStatusResponse>(`/api/payments/${orderId}/status`)
  return data
}

export interface RevenueRecordParams {
  userId: string
  gameId: string
  gameTitle: string
  type: 'ad' | 'download'
  grossUsd: number
  creatorSharePct: number
  sessionId: string
}

export interface RevenueRecordResult {
  id: string
  grossUsd: number
  creatorUsd: number
  platformUsd: number
}

export async function recordServerRevenue(params: RevenueRecordParams): Promise<RevenueRecordResult> {
  const { data } = await apiClient.post<RevenueRecordResult>(
    '/api/revenue/record',
    {
      userId: params.userId,
      gameId: params.gameId,
      gameTitle: params.gameTitle,
      type: params.type,
      grossUsd: params.grossUsd,
      creatorSharePct: params.creatorSharePct,
      sessionId: params.sessionId,
    },
    'recordRevenue',
    { userId: params.userId, gameId: params.gameId, sessionId: params.sessionId }
  )
  return data
}

export interface WithdrawalRequestData {
  userId: string
  userName: string
  amountUsd: number
  coin: string
  walletAddress: string
  planId: string
}

export async function serverWithdrawal(input: WithdrawalRequestData & { idempotencyKey: string }): Promise<WithdrawalRequest> {
  const { data } = await apiClient.post<WithdrawalRequest>(
    '/api/withdrawals',
    {
      userId: input.userId,
      userName: input.userName,
      amountUsd: input.amountUsd,
      coin: input.coin,
      walletAddress: input.walletAddress,
      planId: input.planId,
    },
    'withdrawal',
    {
      userId: input.userId,
      amountUsd: input.amountUsd,
      coin: input.coin,
    }
  )
  return data
}

export async function fetchServerRates(): Promise<Record<string, number>> {
  const { data } = await apiClient.get<Record<string, number>>('/api/rates')
  return data
}

export interface UserProfile {
  id: string
  email: string
  displayName: string
  planId: string
  createdAt: number
}

export async function getServerProfile(userId: string): Promise<UserProfile> {
  const { data } = await apiClient.get<UserProfile>(`/api/users/${userId}/profile`)
  return data
}

export interface PublishedGameApi {
  id: string
  projectId: string
  title: string
  description: string
  creatorId: string
  creatorName: string
  priceUsd: number
  adsEnabled: boolean
  plan: string
  publishedAt: number
  plays: number
  downloads: number
  revenueUsd: number
  thumbnail: string
}

export async function recordServerPlay(gameId: string, userId: string, sessionId: string, revenueUsd?: number): Promise<void> {
  await apiClient.post<{ ok: true }>(
    '/api/games/play',
    { gameId, userId, sessionId, revenueUsd: revenueUsd ?? 0 },
    'recordPlay',
    { gameId, sessionId }
  )
}

export async function recordServerDownload(gameId: string, userId: string, sessionId: string, revenueUsd?: number): Promise<void> {
  await apiClient.post<{ ok: true }>(
    '/api/games/download',
    { gameId, userId, sessionId, revenueUsd: revenueUsd ?? 0 },
    'recordDownload',
    { gameId, sessionId }
  )
}

export async function getServerGames(creatorId?: string): Promise<PublishedGameApi[]> {
  const path = creatorId
    ? `/api/games?creatorId=${creatorId}`
    : '/api/games'
  const { data } = await apiClient.get<PublishedGameApi[]>(path)
  return data
}
