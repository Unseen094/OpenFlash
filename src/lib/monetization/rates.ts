import type { CoinId } from './types'

const CACHE_KEY = 'openflash_rates_cache'
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

interface RatesCache {
  usd: Record<CoinId, number>
  fetchedAt: number
}

/**
 * Demo fallback rates used when the network fetch fails or in dev mode.
 * In production these are overridden by live data.
 */
const FALLBACK_RATES: Record<CoinId, number> = {
  btc: 67000,
  eth: 3500,
  sol: 165
}

function readCache(): RatesCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function writeCache(usd: Record<CoinId, number>): void {
  const cache: RatesCache = { usd, fetchedAt: Date.now() }
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
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
    const data = await res.json()
    const usd: Record<CoinId, number> = {
      btc: data.bitcoin?.usd ?? FALLBACK_RATES.btc,
      eth: data.ethereum?.usd ?? FALLBACK_RATES.eth,
      sol: data.solana?.usd ?? FALLBACK_RATES.sol
    }
    writeCache(usd)
    return usd
  } catch {
    if (cached) return cached.usd
    return { ...FALLBACK_RATES }
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
