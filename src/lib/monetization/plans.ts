import type { Plan, PlanId, PaymentOrder } from './types'
import { createOrder, listPaymentsByUser, getPayment, setStatus } from './payments'

/**
 * Three creator plans.
 *
 * Revenue splits:
 *   Ad revenue  → creator 40% / platform 60%
 *   Downloads   → creator 50% / platform 50%
 *
 * Higher plans raise the creator's share and unlock more features.
 */
export const PLANS: Record<PlanId, Plan> = {
  beta: {
    id: 'beta',
    name: 'Beta',
    priceUsd: 0,
    adRevenueShare: 40,
    downloadRevenueShare: 50,
    maxGames: 3,
    maxWithdrawal: 100,
    customPricing: false,
    canDisableAds: false,
    features: [
      'Publish up to 3 games',
      '40% ad revenue share',
      '50% download revenue share',
      'Up to $100 / month withdrawals',
      'Community support'
    ]
  },
  sigma: {
    id: 'sigma',
    name: 'Sigma',
    priceUsd: 9.99,
    adRevenueShare: 50,
    downloadRevenueShare: 60,
    maxGames: 15,
    maxWithdrawal: 1000,
    customPricing: true,
    canDisableAds: false,
    features: [
      'Publish up to 15 games',
      '50% ad revenue share',
      '60% download revenue share',
      'Set your own game price',
      'Up to $1,000 / month withdrawals',
      'Priority support',
      'Analytics dashboard'
    ]
  },
  alpha: {
    id: 'alpha',
    name: 'Alpha',
    priceUsd: 29.99,
    adRevenueShare: 60,
    downloadRevenueShare: 70,
    maxGames: 999,
    maxWithdrawal: 10000,
    customPricing: true,
    canDisableAds: true,
    features: [
      'Unlimited game publishing',
      '60% ad revenue share',
      '70% download revenue share',
      'Set your own game price',
      'Disable ads on your games',
      'Up to $10,000 / month withdrawals',
      'Dedicated account manager',
      'Advanced analytics & API access'
    ]
  }
}

export const PLAN_LIST: Plan[] = [PLANS.beta, PLANS.sigma, PLANS.alpha]

export function getPlan(id: PlanId): Plan {
  return PLANS[id]
}

export function isPlanId(value: string): value is PlanId {
  return value === 'beta' || value === 'sigma' || value === 'alpha'
}

/**
 * A plan is entitled when a paid order exists for it. Plan purchases are
 * stored as orders with `gameId` = `plan:<planId>`, so entitlement survives
 * reloads and is derived from the same source of truth as every other sale.
 */
export function hasPlanEntitlement(userId: string, planId: PlanId): boolean {
  return listPaymentsByUser(userId).some(p => p.gameId === `plan:${planId}` && p.status === 'paid')
}

/** Free (Beta) plans skip the crypto flow and are activated directly. */
export function activateFreePlan(userId: string, planId: PlanId): PaymentOrder | null {
  const plan = PLANS[planId]
  if (!plan || plan.priceUsd > 0) return null
  const order = createOrder({
    userId,
    gameId: `plan:${planId}`,
    gameTitle: `Plan: ${plan.name}`,
    coin: 'btc',
    amountUsd: 0,
    rate: 1
  })
  setStatus(order.id, 'paid')
  return getPayment(order.id)
}

const PLAN_RANK: Record<PlanId, number> = { beta: 0, sigma: 1, alpha: 2 }

/**
 * The highest plan a user actually holds (has a paid order for), defaulting
 * to Beta. Callers must use this everywhere plan features are enforced —
 * never trust a plan passed in by the user or picked from the URL.
 */
export function getEffectivePlan(userId: string): Plan {
  let best: PlanId = 'beta'
  for (const id of ['sigma', 'alpha'] as PlanId[]) {
    if (hasPlanEntitlement(userId, id)) best = PLAN_RANK[id] > PLAN_RANK[best] ? id : best
  }
  return PLANS[best]
}
