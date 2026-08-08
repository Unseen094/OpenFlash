import type { CoinConfig, CoinId } from './types'

const env = import.meta.env

/**
 * Wallet addresses are read from environment variables at build time.
 * Set VITE_BTC_ADDRESS, VITE_ETH_ADDRESS, VITE_SOL_ADDRESS in your .env.
 * Demo-mode fallback addresses used for testing when env vars are absent.
 */
export const COINS: Record<CoinId, CoinConfig> = {
  btc: {
    id: 'btc',
    name: 'Bitcoin',
    symbol: 'BTC',
    address: env.VITE_BTC_ADDRESS || 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
    confirmations: 1,
    network: 'Bitcoin',
    uriScheme: 'bitcoin:',
    expiresIn: 30
  },
  eth: {
    id: 'eth',
    name: 'Ethereum',
    symbol: 'ETH',
    address: env.VITE_ETH_ADDRESS || '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
    confirmations: 12,
    network: 'Ethereum',
    uriScheme: 'ethereum:',
    expiresIn: 30
  },
  sol: {
    id: 'sol',
    name: 'Solana',
    symbol: 'SOL',
    address: env.VITE_SOL_ADDRESS || '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    confirmations: 32,
    network: 'Solana',
    uriScheme: 'solana:',
    expiresIn: 15
  }
}

export const COIN_LIST: CoinConfig[] = [COINS.btc, COINS.eth, COINS.sol]

export function getCoin(id: CoinId): CoinConfig {
  return COINS[id]
}
