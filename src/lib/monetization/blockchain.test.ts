import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SimulatedMonitor, monitor } from './blockchain'
import { createOrder, getPayment, deletePayment } from './payments'
import type { CoinId, PaymentOrder, PaymentStatus } from './types'

const TICK = 3000

function makeOrder(coin: CoinId): PaymentOrder {
  return createOrder({
    userId: 'user_1',
    gameId: 'game_1',
    gameTitle: 'Test Game',
    coin,
    amountUsd: 10,
    rate: 1_000
  })
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
  vi.setSystemTime(1_700_000_000_000)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('SimulatedMonitor — status progression', () => {
  it('advances awaiting → detecting → confirming → paid for BTC (1 confirmation)', () => {
    const m = new SimulatedMonitor()
    const o = makeOrder('btc')
    expect(o.requiredConfirmations).toBe(1)
    expect(o.status).toBe('awaiting')

    const seen: PaymentStatus[] = []
    m.watch(o, u => seen.push(u.status))

    vi.advanceTimersByTime(TICK)
    expect(seen).toEqual(['detecting'])
    expect(getPayment(o.id)?.txHash).toMatch(/^0x[0-9a-f]{64}$/)

    vi.advanceTimersByTime(TICK)
    expect(seen).toEqual(['detecting', 'confirming'])
    expect(getPayment(o.id)?.confirmations).toBe(1)

    vi.advanceTimersByTime(TICK)
    expect(seen).toEqual(['detecting', 'confirming', 'paid'])

    const final = getPayment(o.id)
    expect(final?.status).toBe('paid')
    expect(final?.confirmations).toBe(1)
    expect(final?.paidAt).toBe(Date.now())
  })

  it('requires 12 confirmations for ETH before reaching paid', () => {
    const m = new SimulatedMonitor()
    const o = makeOrder('eth')
    expect(o.requiredConfirmations).toBe(12)

    const updates: PaymentOrder[] = []
    m.watch(o, u => updates.push({ ...u }))

    vi.advanceTimersByTime(TICK * 12)
    expect(getPayment(o.id)?.status).toBe('confirming')
    expect(getPayment(o.id)?.confirmations).toBe(11)

    vi.advanceTimersByTime(TICK)
    expect(getPayment(o.id)?.status).toBe('paid')
    expect(getPayment(o.id)?.confirmations).toBe(12)

    expect(updates).toHaveLength(13)
    expect(updates[0].status).toBe('detecting')
    expect(updates[1].status).toBe('confirming')
    expect(updates[updates.length - 1].status).toBe('paid')
    expect(updates.map(u => u.confirmations)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  })

  it('requires 32 confirmations for SOL before reaching paid', () => {
    const m = new SimulatedMonitor()
    const o = makeOrder('sol')
    expect(o.requiredConfirmations).toBe(32)

    const seen: PaymentStatus[] = []
    m.watch(o, u => seen.push(u.status))

    vi.advanceTimersByTime(TICK * 32)
    expect(getPayment(o.id)?.status).toBe('confirming')
    expect(getPayment(o.id)?.confirmations).toBe(31)

    vi.advanceTimersByTime(TICK)
    expect(getPayment(o.id)?.status).toBe('paid')
    expect(seen[seen.length - 1]).toBe('paid')
    expect(seen).toHaveLength(33)
  })

  it('never emits confirmations above the required amount', () => {
    const m = new SimulatedMonitor()
    const o = makeOrder('eth')
    const confs: number[] = []
    m.watch(o, u => confs.push(u.confirmations))
    vi.advanceTimersByTime(TICK * 50)
    expect(Math.max(...confs)).toBe(12)
  })

  it('stops emitting once paid', () => {
    const m = new SimulatedMonitor()
    const o = makeOrder('btc')
    const onUpdate = vi.fn()
    m.watch(o, onUpdate)

    vi.advanceTimersByTime(TICK * 3)
    expect(onUpdate).toHaveBeenCalledTimes(3)

    vi.advanceTimersByTime(TICK * 20)
    expect(onUpdate).toHaveBeenCalledTimes(3)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('generates a unique 64-hex tx hash per order', () => {
    const m = new SimulatedMonitor()
    const a = makeOrder('btc')
    const b = makeOrder('eth')
    m.watch(a, () => {})
    m.watch(b, () => {})
    vi.advanceTimersByTime(TICK)
    const hashA = getPayment(a.id)?.txHash
    const hashB = getPayment(b.id)?.txHash
    expect(hashA).toMatch(/^0x[0-9a-f]{64}$/)
    expect(hashB).toMatch(/^0x[0-9a-f]{64}$/)
    expect(hashA).not.toBe(hashB)
  })

  it('watches multiple orders independently', () => {
    const m = new SimulatedMonitor()
    const btc = makeOrder('btc')
    const eth = makeOrder('eth')
    m.watch(btc, () => {})
    m.watch(eth, () => {})

    vi.advanceTimersByTime(TICK * 3)
    expect(getPayment(btc.id)?.status).toBe('paid')
    expect(getPayment(eth.id)?.status).toBe('confirming')
  })
})

describe('SimulatedMonitor — watch/unwatch lifecycle', () => {
  it('unwatch clears the interval and halts updates', () => {
    const clearSpy = vi.spyOn(globalThis, 'clearInterval')
    const m = new SimulatedMonitor()
    const o = makeOrder('eth')
    const onUpdate = vi.fn()

    m.watch(o, onUpdate)
    expect(vi.getTimerCount()).toBe(1)

    vi.advanceTimersByTime(TICK)
    expect(onUpdate).toHaveBeenCalledTimes(1)

    m.unwatch(o.id)
    expect(clearSpy).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)

    vi.advanceTimersByTime(TICK * 20)
    expect(onUpdate).toHaveBeenCalledTimes(1)
    expect(getPayment(o.id)?.status).toBe('detecting')
  })

  it('unwatch is a no-op for an unknown order id', () => {
    const clearSpy = vi.spyOn(globalThis, 'clearInterval')
    const m = new SimulatedMonitor()
    expect(() => m.unwatch('does-not-exist')).not.toThrow()
    expect(clearSpy).not.toHaveBeenCalled()
  })

  it('unwatch is idempotent', () => {
    const m = new SimulatedMonitor()
    const o = makeOrder('btc')
    m.watch(o, () => {})
    m.unwatch(o.id)
    m.unwatch(o.id)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('ignores a duplicate watch for the same order', () => {
    const m = new SimulatedMonitor()
    const o = makeOrder('btc')
    const first = vi.fn()
    const second = vi.fn()
    m.watch(o, first)
    m.watch(o, second)
    expect(vi.getTimerCount()).toBe(1)

    vi.advanceTimersByTime(TICK)
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).not.toHaveBeenCalled()
  })

  it('self-unwatches when the order disappears mid-flight', () => {
    const m = new SimulatedMonitor()
    const o = makeOrder('eth')
    const onUpdate = vi.fn()
    m.watch(o, onUpdate)

    vi.advanceTimersByTime(TICK * 2)
    expect(onUpdate).toHaveBeenCalledTimes(2)

    deletePayment(o.id)
    vi.advanceTimersByTime(TICK)
    expect(vi.getTimerCount()).toBe(0)

    vi.advanceTimersByTime(TICK * 10)
    expect(onUpdate).toHaveBeenCalledTimes(2)
  })

  it('the shared monitor instance exposes the watch/unwatch contract', () => {
    expect(typeof monitor.watch).toBe('function')
    expect(typeof monitor.unwatch).toBe('function')
    const o = makeOrder('btc')
    monitor.watch(o, () => {})
    monitor.unwatch(o.id)
    expect(vi.getTimerCount()).toBe(0)
  })
})
