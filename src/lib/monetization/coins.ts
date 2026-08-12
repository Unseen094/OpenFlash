import type { CoinConfig, CoinId } from './types'

const env = import.meta.env

/**
 * Wallet addresses are read from environment variables at build time.
 * In production the build FAILS CLOSED: if you accept payments you must
 * configure real addresses (plus an Etherscan key for ETH and an RPC for
 * SOL). Dev builds keep demo fallback addresses so the flow can be tested
 * without a wallet.
 */
const isProd = import.meta.env.PROD

function readAddress(variable: string, demoFallback: string): string {
  if (isProd) return env[variable] || ''
  return env[variable] || demoFallback
}

export const COINS: Record<CoinId, CoinConfig> = {
  btc: {
    id: 'btc',
    name: 'Bitcoin',
    symbol: 'BTC',
    address: readAddress('VITE_BTC_ADDRESS', 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'),
    confirmations: 1,
    network: 'Bitcoin',
    uriScheme: 'bitcoin:',
    expiresIn: 30
  },
  eth: {
    id: 'eth',
    name: 'Ethereum',
    symbol: 'ETH',
    address: readAddress('VITE_ETH_ADDRESS', '0x71C7656EC7ab88b098defB751B7401B5f6d8976F'),
    confirmations: 12,
    network: 'Ethereum',
    uriScheme: 'ethereum:',
    expiresIn: 30
  },
  sol: {
    id: 'sol',
    name: 'Solana',
    symbol: 'SOL',
    address: readAddress('VITE_SOL_ADDRESS', '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'),
    confirmations: 2,
    network: 'Solana',
    uriScheme: 'solana:',
    expiresIn: 15
  }
}

export const COIN_LIST: CoinConfig[] = [COINS.btc, COINS.eth, COINS.sol]

export function getCoin(id: CoinId): CoinConfig {
  return COINS[id]
}

/**
 * Build a payment QR payload per chain.
 *  - BTC:  bitcoin:<addr>?amount=<crypto>
 *  - ETH:  EIP-681 ethereum:<addr>@1?value=<wei> (no decimal ambiguity)
 *  - SOL:  solana:<addr>?amount=<crypto>&memo=<orderId> (order correlation)
 */
export function buildPaymentUri(coin: CoinId, address: string, amountCrypto: number, orderId?: string): string {
  switch (coin) {
    case 'eth': {
      const wei = BigInt(Math.round(amountCrypto * 1e18))
      return `ethereum:${address}@1?value=${wei.toString()}`
    }
    case 'sol': {
      const memo = orderId ? `&memo=${encodeURIComponent(orderId)}` : ''
      return `solana:${address}?amount=${amountCrypto.toFixed(9)}${memo}`
    }
    default: {
      return `bitcoin:${address}?amount=${amountCrypto.toFixed(8)}`
    }
  }
}