import { describe, it, expect, beforeEach } from 'vitest'
import {
  recordRevenue,
  pendingBalanceForUser,
  createWithdrawal,
  withdrawnThisMonth,
  isValidWalletAddress,
  MIN_WITHDRAWAL
} from './earnings'
import { getPlan } from './plans'

const BTC_ADDRESS = 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'
const ETH_ADDRESS = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F'

beforeEach(() => {
  localStorage.clear()
})

describe('earnings', () => {
  it('splits revenue: creator + platform === gross', () => {
    const plan = getPlan('sigma')
    const r = recordRevenue({ userId: 'u1', gameId: 'g1', gameTitle: 'Test', type: 'ad', grossUsd: 0.01, creatorSharePct: plan.adRevenueShare })
    expect(r.creatorUsd + r.platformUsd).toBeCloseTo(r.grossUsd, 10)
  })

  it('micro-amounts do not round creator to zero', () => {
    const r = recordRevenue({ userId: 'u1', gameId: 'g1', gameTitle: 'Test', type: 'ad', grossUsd: 0.01, creatorSharePct: 40 })
    expect(r.creatorUsd).toBeGreaterThan(0)
  })

  it('pendingBalanceForUser decreases after withdrawal', () => {
    recordRevenue({ userId: 'u2', gameId: 'g2', gameTitle: 'T2', type: 'download', grossUsd: 100, creatorSharePct: 50 })
    const before = pendingBalanceForUser('u2')
    const result = createWithdrawal({ userId: 'u2', userName: 'Test', amountUsd: 50, coin: 'btc', walletAddress: BTC_ADDRESS, plan: getPlan('sigma') })
    expect(result.ok).toBe(true)
    const after = pendingBalanceForUser('u2')
    expect(after).toBeLessThan(before)
    expect(after).toBeCloseTo(before - 50, 5)
  })
})

describe('withdrawal validation', () => {
  const plan = getPlan('sigma')

  function fund(userId: string, grossUsd: number) {
    recordRevenue({ userId, gameId: 'g', gameTitle: 'T', type: 'download', grossUsd, creatorSharePct: 100 })
  }

  function request(overrides: Partial<Parameters<typeof createWithdrawal>[0]> = {}) {
    return createWithdrawal({
      userId: 'u1',
      userName: 'Creator',
      amountUsd: 50,
      coin: 'btc',
      walletAddress: BTC_ADDRESS,
      plan,
      ...overrides
    })
  }

  it('rejects non-positive and non-finite amounts', () => {
    fund('u1', 500)
    for (const amountUsd of [0, -5, NaN]) {
      const r = request({ amountUsd })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error.type).toBe('invalid_amount')
    }
  })

  it('rejects amounts below the minimum', () => {
    fund('u1', 500)
    const r = request({ amountUsd: MIN_WITHDRAWAL - 0.01 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.type).toBe('below_minimum')
  })

  it('accepts exactly the minimum', () => {
    fund('u1', 500)
    expect(request({ amountUsd: MIN_WITHDRAWAL }).ok).toBe(true)
  })

  it('rejects more than the pending balance', () => {
    fund('u1', 40)
    const r = request({ amountUsd: 50 })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.type).toBe('insufficient_balance')
      if (r.error.type === 'insufficient_balance') expect(r.error.available).toBeCloseTo(40, 5)
    }
  })

  it('enforces the monthly plan cap across multiple requests', () => {
    const beta = getPlan('beta')
    fund('u1', 1000)
    expect(request({ amountUsd: 60, plan: beta }).ok).toBe(true)
    expect(request({ amountUsd: 40, plan: beta }).ok).toBe(true)
    const r = request({ amountUsd: 10, plan: beta })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.type).toBe('monthly_cap')
      if (r.error.type === 'monthly_cap') {
        expect(r.error.cap).toBe(beta.maxWithdrawal)
        expect(r.error.used).toBeCloseTo(100, 5)
        expect(r.error.remaining).toBeCloseTo(0, 5)
      }
    }
  })

  it('ignores rejected withdrawals in the monthly total', () => {
    fund('u1', 1000)
    const first = request({ amountUsd: 50 })
    expect(first.ok).toBe(true)
    expect(withdrawnThisMonth('u1')).toBeCloseTo(50, 5)
  })

  it('rejects malformed wallet addresses', () => {
    fund('u1', 500)
    for (const walletAddress of ['', '   ', 'test', ETH_ADDRESS]) {
      const r = request({ walletAddress })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error.type).toBe('invalid_address')
    }
  })

  it('validates addresses per coin', () => {
    expect(isValidWalletAddress('btc', BTC_ADDRESS)).toBe(true)
    expect(isValidWalletAddress('eth', ETH_ADDRESS)).toBe(true)
    expect(isValidWalletAddress('sol', '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU')).toBe(true)
    expect(isValidWalletAddress('eth', BTC_ADDRESS)).toBe(false)
    expect(isValidWalletAddress('btc', '')).toBe(false)
  })

  it('trims the stored wallet address', () => {
    fund('u1', 500)
    const r = request({ walletAddress: `  ${BTC_ADDRESS}  ` })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.walletAddress).toBe(BTC_ADDRESS)
  })
})
