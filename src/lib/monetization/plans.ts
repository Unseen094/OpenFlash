import type { Plan, PlanId } from './types'

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
