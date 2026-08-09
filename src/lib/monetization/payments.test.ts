import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fc from 'fast-check'
import {
  createOrder,
  getPayment,
  listPayments,
  listPaymentsByUser,
  updatePayment,
  setStatus,
  deletePayment,
  paymentStats
} from './payments'
import { COINS, getCoin } from './coins'
import { usdToCrypto, cryptoToUsd } from './rates'
import type { CoinId } from './types'

const STORAGE_KEY = 'openflash_payments'
const NOW = 1_700_000_000_000

function order(overrides: Partial<Parameters<typeof createOrder>[0]> = {}) {
  return createOrder({
    userId: 'user_1',
    gameId: 'game_1',
    gameTitle: 'Test Game',
    coin: 'btc',
    amountUsd: 10,
    rate: 67_000,
    ...overrides
  })
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('createOrder', () => {
  it('creates an order with valid inputs', () => {
    const o = order()
    expect(o.id.startsWith('ord_')).toBe(true)
    expect(o.userId).toBe('user_1')
    expect(o.gameId).toBe('game_1')
    expect(o.gameTitle).toBe('Test Game')
    expect(o.coin).toBe('btc')
    expect(o.amountUsd).toBe(10)
    expect(o.rate).toBe(67_000)
    expect(o.status).toBe('awaiting')
    expect(o.txHash).toBeNull()
    expect(o.paidAt).toBeNull()
    expect(o.confirmations).toBe(0)
  })

  it('uses the coin config for address and required confirmations', () => {
    const coins: CoinId[] = ['btc', 'eth', 'sol']
    for (const id of coins) {
      const o = order({ coin: id })
      expect(o.address).toBe(COINS[id].address)
      expect(o.requiredConfirmations).toBe(COINS[id].confirmations)
    }
  })

  it('computes amountCrypto with 8-decimal ceiling rounding', () => {
    const o = order({ amountUsd: 10, rate: 3 })
    expect(o.amountCrypto).toBe(Math.ceil((10 / 3) * 1e8) / 1e8)
    expect(o.amountCrypto).toBeGreaterThanOrEqual(10 / 3)
  })

  it('persists the order so it is retrievable', () => {
    const o = order()
    expect(getPayment(o.id)).toEqual(o)
    expect(listPayments()).toHaveLength(1)
  })

  it('generates unique ids for repeated orders', () => {
    const ids = new Set(Array.from({ length: 25 }, () => order().id))
    expect(ids.size).toBe(25)
  })
})

describe('expiresAt calculation', () => {
  it('is createdAt plus the coin expiry window in minutes', () => {
    const coins: CoinId[] = ['btc', 'eth', 'sol']
    for (const id of coins) {
      const o = order({ coin: id })
      expect(o.createdAt).toBe(NOW)
      expect(o.expiresAt).toBe(NOW + getCoin(id).expiresIn * 60 * 1000)
      expect(o.expiresAt - o.createdAt).toBe(getCoin(id).expiresIn * 60_000)
    }
  })

  it('gives BTC/ETH 30 minutes and SOL 15 minutes', () => {
    expect(order({ coin: 'btc' }).expiresAt - NOW).toBe(30 * 60_000)
    expect(order({ coin: 'eth' }).expiresAt - NOW).toBe(30 * 60_000)
    expect(order({ coin: 'sol' }).expiresAt - NOW).toBe(15 * 60_000)
  })

  it('is always strictly in the future at creation time', () => {
    const o = order()
    expect(o.expiresAt).toBeGreaterThan(Date.now())
  })

  it('tracks the mocked clock as time advances', () => {
    const first = order()
    vi.advanceTimersByTime(60_000)
    const second = order()
    expect(second.createdAt).toBe(first.createdAt + 60_000)
    expect(second.expiresAt).toBe(first.expiresAt + 60_000)
  })
})

describe('usdToCrypto / cryptoToUsd round-trip', () => {
  it('round-trips within a cent for common amounts', () => {
    const rates = [67_000, 3_500, 165]
    const amounts = [1, 9.99, 25, 100, 4999.95]
    for (const rate of rates) {
      for (const usd of amounts) {
        const crypto = usdToCrypto(usd, rate)
        const back = cryptoToUsd(crypto, rate)
        expect(Math.abs(back - usd)).toBeLessThanOrEqual(0.01)
      }
    }
  })

  it('round-trips for arbitrary amounts and rates (property)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1_000_000 }),
        fc.integer({ min: 1, max: 200_000 }),
        (cents, rate) => {
          const usd = cents / 100
          const back = cryptoToUsd(usdToCrypto(usd, rate), rate)
          expect(Math.abs(back - usd)).toBeLessThanOrEqual(0.01 + rate * 1e-8)
        }
      ),
      { numRuns: 300 }
    )
  })

  it('never under-quotes the crypto amount (ceiling favours the platform)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 500_000 }),
        fc.integer({ min: 1, max: 100_000 }),
        (cents, rate) => {
          const usd = cents / 100
          const crypto = usdToCrypto(usd, rate)
          const back = crypto * rate
          expect(back).toBeGreaterThanOrEqual(usd - 1e-10)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('quantises crypto to at most 8 decimals', () => {
    const crypto = usdToCrypto(1, 67_000)
    expect(Math.round(crypto * 1e8)).toBeCloseTo(crypto * 1e8, 6)
  })

  it('rounds USD to two decimals', () => {
    expect(cryptoToUsd(0.000015, 67_000)).toBe(1.01)
    expect(cryptoToUsd(0, 67_000)).toBe(0)
  })

  it('matches createOrder amountCrypto', () => {
    const o = order({ amountUsd: 42.42, rate: 3_500 })
    expect(o.amountCrypto).toBe(usdToCrypto(42.42, 3_500))
  })
})

describe('payment queries and mutations', () => {
  it('lists newest orders first', () => {
    const a = order()
    vi.advanceTimersByTime(1_000)
    const b = order()
    const list = listPayments()
    expect(list[0].id).toBe(b.id)
    expect(list[1].id).toBe(a.id)
  })

  it('filters by user', () => {
    order({ userId: 'a' })
    order({ userId: 'b' })
    expect(listPaymentsByUser('a')).toHaveLength(1)
    expect(listPaymentsByUser('zzz')).toHaveLength(0)
  })

  it('returns null for an unknown payment', () => {
    expect(getPayment('nope')).toBeNull()
  })

  it('updates a payment and returns null for unknown ids', () => {
    const o = order()
    const updated = updatePayment(o.id, { confirmations: 3 })
    expect(updated?.confirmations).toBe(3)
    expect(updatePayment('missing', { confirmations: 1 })).toBeNull()
  })

  it('sets status along a legal path', () => {
    const o = order()
    expect(setStatus(o.id, 'detecting')?.status).toBe('detecting')
    expect(setStatus(o.id, 'confirming')?.status).toBe('confirming')
    expect(setStatus(o.id, 'paid')?.status).toBe('paid')
    expect(setStatus('missing', 'paid')).toBeNull()
  })

  it('refuses to skip states via setStatus', () => {
    const o = order()
    expect(setStatus(o.id, 'paid')).toBeNull()
    expect(getPayment(o.id)?.status).toBe('awaiting')
  })

  it('deletes a payment', () => {
    const o = order()
    deletePayment(o.id)
    expect(getPayment(o.id)).toBeNull()
    expect(listPayments()).toHaveLength(0)
  })

  it('aggregates stats by status', () => {
    const a = order()
    const b = order()
    order()
    // a: awaiting → detecting → confirming → paid
    setStatus(a.id, 'detecting')
    setStatus(a.id, 'confirming')
    setStatus(a.id, 'paid')
    // b: awaiting → expired
    setStatus(b.id, 'expired')
    const stats = paymentStats()
    expect(stats.paid).toBe(1)
    expect(stats.expired).toBe(1)
    expect(stats.awaiting).toBe(1)
    expect(stats.detecting).toBe(0)
    expect(stats.confirming).toBe(0)
    expect(stats.failed).toBe(0)
  })
})

describe('corrupt storage resilience', () => {
  it('degrades to an empty list without throwing', () => {
    localStorage.setItem(STORAGE_KEY, 'not-json')
    expect(() => listPayments()).not.toThrow()
    expect(listPayments()).toEqual([])
    expect(listPaymentsByUser('a')).toEqual([])
    expect(getPayment('x')).toBeNull()
    expect(updatePayment('x', {})).toBeNull()
    expect(paymentStats().awaiting).toBe(0)
  })
})
