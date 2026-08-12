import type { CoinId } from './types'
import { apiClient, fetchServerRates } from './api'

const CACHE_KEY = 'openflash_rates_cache'
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// ─── Server-aware rates (Phase 8) ─────────────────────────────────────────────
const USE_SERVER = !!import.meta.env.VITE_API_BASE_URL

interface RatesCache {
  usd: Record<CoinId, number>
  fetchedAt: number
}

/**
 * Demo fallback rates used only in development when the network fetch fails.
 * Production never falls back to constants — a stale or missing rate blocks
 * checkout instead of quoting the wrong amount.
 */
const FALLBACK_RATES: Record<CoinId, number> = {
  btc: 67000,
  eth: 3500,
  sol: 165
}

const PROD = import.meta.env.PROD

function readCache(): RatesCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || !('usd' in parsed) || !('fetchedAt' in parsed)) {
      return null
    }
    return parsed as RatesCache
  } catch {
    return null
  }
}

function writeCache(usd: Record<CoinId, number>): void {
  const cache: RatesCache = { usd, fetchedAt: Date.now() }
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
}

interface CoinGeckoRates {
  bitcoin?: { usd?: number }
  ethereum?: { usd?: number }
  solana?: { usd?: number }
}

/**
 * Fetch live USD rates for BTC, ETH, SOL from CoinGecko (no API key needed).
 * Falls back to cached values, then to hardcoded demo rates.
 */
export async function fetchRates(): Promise<Record<CoinId, number>> {
  const cached = readCache()
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.usd
  }
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd'
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = (await res.json()) as CoinGeckoRates
    const usd: Record<CoinId, number> = {
      btc: data.bitcoin?.usd ?? FALLBACK_RATES.btc,
      eth: data.ethereum?.usd ?? FALLBACK_RATES.eth,
      sol: data.solana?.usd ?? FALLBACK_RATES.sol
    }
    writeCache(usd)
    return usd
  } catch {
    if (cached) return cached.usd
    if (PROD) throw new Error('Live exchange rates are unavailable — refresh to retry.')
    return { ...FALLBACK_RATES }
  }
}

/** Whether the app can currently quote payments (live rates reachable). */
export async function checkRatesHealthy(): Promise<boolean> {
  try {
    await fetchRates()
    return true
  } catch {
    return false
  }
}

/** Convert a USD amount to crypto units at the given rate. */
export function usdToCrypto(usd: number, ratePerCoin: number): number {
  return Math.ceil((usd / ratePerCoin) * 1e8) / 1e8
}

/** Convert crypto units to USD at the given rate. */
export function cryptoToUsd(crypto: number, ratePerCoin: number): number {
  return Math.round(crypto * ratePerCoin * 100) / 100
}

/**
 * Preference-ordered rate fetch: server API → CoinGecko → cache → demo rates.
 * When `VITE_API_BASE_URL` is set, the server is authoritative.
 */
export async function fetchRatesServer(): Promise<Record<CoinId, number>> {
  const cached = readCache()
  if (USE_SERVER) {
    try {
      const usd = await fetchServerRates()
      const framed: Record<CoinId, number> = {
        btc: usd.btc,
        eth: usd.eth,
        sol: usd.sol
      }
      if (Object.values(framed).every(v => Number.isFinite(v) && v > 0)) {
        writeCache(framed)
        return framed
      }
      if (cached) return cached.usd
      return { ...FALLBACK_RATES }
    } catch {
      if (cached) return cached.usd
      return { ...FALLBACK_RATES }
    }
  }
  return fetchRates()
}

export { apiClient }
