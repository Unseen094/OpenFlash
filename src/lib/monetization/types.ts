// ─── Shared monetization types ───────────────────────────────────────────────

export type CoinId = 'btc' | 'eth' | 'sol'

export interface CoinConfig {
  id: CoinId
  name: string
  symbol: string
  /** Placeholder address — replaced via env var at build time */
  address: string
  /** Confirmation blocks required before marking paid */
  confirmations: number
  /** Network display name */
  network: string
  /** URI scheme for QR (e.g. "bitcoin:", "ethereum:") */
  uriScheme: string
  /** Minutes before a payment window expires */
  expiresIn: number
}

// ─── Ads ─────────────────────────────────────────────────────────────────────

export type AdPlacement =
  | 'header'
  | 'footer'
  | 'sidebar'
  | 'between-content'
  | 'before-article'
  | 'after-article'
  | 'in-content'

export interface AdSlotConfig {
  placement: AdPlacement
  enabled: boolean
  /** AdSense slot ID (ca-pub-xxx) — used when type = 'adsense' */
  adsenseSlot?: string
  /** Custom HTML/JS injected when type = 'custom' */
  customCode?: string
  /** 'adsense' | 'custom' */
  type: 'adsense' | 'custom'
  /** For in-content: insert every N paragraphs */
  everyN?: number
}

export interface AdConfig {
  enabled: boolean
  /** AdSense publisher ID, e.g. "ca-pub-1234567890" */
  adsensePub?: string
  /** Enable AdSense Auto Ads */
  autoAds: boolean
  slots: AdSlotConfig[]
}

// ─── Plans ───────────────────────────────────────────────────────────────────

export type PlanId = 'beta' | 'sigma' | 'alpha'

export interface Plan {
  id: PlanId
  name: string
  /** Monthly price in USD */
  priceUsd: number
  /** Creator share of ad revenue (0-100) */
  adRevenueShare: number
  /** Creator share of download revenue (0-100) */
  downloadRevenueShare: number
  /** Max games a creator can publish */
  maxGames: number
  /** Max monthly withdrawal in USD */
  maxWithdrawal: number
  /** Whether creator can set custom prices */
  customPricing: boolean
  /** Whether creator can disable ads on their games */
  canDisableAds: boolean
  features: string[]
}

// ─── Payments ────────────────────────────────────────────────────────────────

export type PaymentStatus =
  | 'awaiting'     // waiting for user to send
  | 'detecting'    // tx seen in mempool
  | 'confirming'   // has some confirmations
  | 'paid'         // fully confirmed
  | 'expired'      // timer ran out
  | 'failed'       // underpaid / wrong coin

export interface PaymentOrder {
  id: string
  userId: string
  gameId: string
  gameTitle: string
  coin: CoinId
  /** Amount in crypto units */
  amountCrypto: number
  /** Amount in USD at time of order */
  amountUsd: number
  /** Exchange rate (usd per 1 coin) locked at order time */
  rate: number
  /** Platform wallet address to pay to */
  address: string
  status: PaymentStatus
  /** Blockchain tx hash once detected */
  txHash: string | null
  confirmations: number
  requiredConfirmations: number
  createdAt: number
  expiresAt: number
  paidAt: number | null
}

// ─── Earnings ────────────────────────────────────────────────────────────────

export interface EarningRecord {
  id: string
  userId: string
  gameId: string
  gameTitle: string
  type: 'ad' | 'download'
  /** Gross USD amount */
  grossUsd: number
  /** Creator's share (USD) */
  creatorUsd: number
  /** Platform's share (USD) */
  platformUsd: number
  createdAt: number
}

export type WithdrawalStatus = 'pending' | 'approved' | 'rejected' | 'paid'

export interface WithdrawalRequest {
  id: string
  userId: string
  userName: string
  amountUsd: number
  status: WithdrawalStatus
  /** Coin the creator wants to be paid in */
  coin: CoinId
  /** Creator's personal wallet address */
  walletAddress: string
  createdAt: number
  /** When the request left `pending` (approved or rejected) */
  resolvedAt: number | null
  /** When an admin approved the request */
  approvedAt?: number | null
  /** When the funds were actually sent */
  paidAt?: number | null
  /** Platform tx hash after manual transfer */
  txHash: string | null
  notes: string
}

// ─── Published games ─────────────────────────────────────────────────────────

export interface PublishedGame {
  id: string
  projectId: string
  title: string
  description: string
  creatorId: string
  creatorName: string
  /** Price in USD. 0 = free/direct install */
  priceUsd: number
  /** Whether ads play before/during the game */
  adsEnabled: boolean
  plan: PlanId
  publishedAt: number
  plays: number
  downloads: number
  revenueUsd: number
  thumbnail: string
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export interface AnalyticsSnapshot {
  totalRevenue: number
  creatorPayouts: number
  platformRevenue: number
  totalPlays: number
  totalDownloads: number
  activeCreators: number
  pendingWithdrawals: number
}
