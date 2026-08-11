import type { AdConfig, AdSlotConfig, AdPlacement } from './types'

export type { AdPlacement }

const STORAGE_KEY = 'openflash_ad_config'

export const DEFAULT_AD_CONFIG: AdConfig = {
  enabled: false,
  adsensePub: '',
  autoAds: false,
  slots: [
    { placement: 'header', enabled: false, type: 'adsense' },
    { placement: 'footer', enabled: false, type: 'adsense' },
    { placement: 'sidebar', enabled: false, type: 'adsense' },
    { placement: 'between-content', enabled: false, type: 'adsense' },
    { placement: 'before-article', enabled: false, type: 'adsense' },
    { placement: 'after-article', enabled: false, type: 'adsense' },
    { placement: 'in-content', enabled: false, type: 'adsense', everyN: 3 }
  ]
}

export function loadAdConfig(): AdConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return structuredClone(DEFAULT_AD_CONFIG)
    return { ...structuredClone(DEFAULT_AD_CONFIG), ...JSON.parse(raw) as Partial<AdConfig> }
  } catch {
    return structuredClone(DEFAULT_AD_CONFIG)
  }
}

export function saveAdConfig(config: AdConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  notifyAdConfigChanged()
}

export function resetAdConfig(): AdConfig {
  localStorage.removeItem(STORAGE_KEY)
  notifyAdConfigChanged()
  return structuredClone(DEFAULT_AD_CONFIG)
}

type AdConfigListener = (_config: AdConfig) => void

const listeners = new Set<AdConfigListener>()
let storageBound = false

function notifyAdConfigChanged(): void {
  if (listeners.size === 0) return
  const config = loadAdConfig()
  for (const listener of listeners) listener(config)
}

function onStorage(e: StorageEvent): void {
  if (e.key !== null && e.key !== STORAGE_KEY) return
  notifyAdConfigChanged()
}

/**
 * Subscribe to ad config changes.
 *
 * Replaces per-component polling: updates are pushed on `saveAdConfig` /
 * `resetAdConfig` (same tab) and via the `storage` event (other tabs).
 * A single window listener is shared by all subscribers.
 */
export function subscribeAdConfig(listener: AdConfigListener): () => void {
  listeners.add(listener)
  if (!storageBound && typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage)
    storageBound = true
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && storageBound && typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage)
      storageBound = false
    }
  }
}

export function updateSlot(
  config: AdConfig,
  placement: AdPlacement,
  patch: Partial<AdSlotConfig>
): AdConfig {
  const slots = config.slots.map(s =>
    s.placement === placement ? { ...s, ...patch } : s
  )
  return { ...config, slots }
}

export function getSlot(config: AdConfig, placement: AdPlacement): AdSlotConfig | undefined {
  return config.slots.find(s => s.placement === placement)
}
