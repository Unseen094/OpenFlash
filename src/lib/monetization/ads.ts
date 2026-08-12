import type { AdConfig, AdPlacement, AdSlotConfig } from './types'

const ADS_KEY = 'openflash_ad_config_v2'

export const DEFAULT_AD_CONFIG: AdConfig = {
  enabled: false,
  adsensePub: '',
  autoAds: false,
  slots: [
    { placement: 'header', enabled: false, type: 'custom', customCode: '' },
    { placement: 'footer', enabled: false, type: 'custom', customCode: '' },
    { placement: 'sidebar', enabled: false, type: 'custom', customCode: '' },
    { placement: 'between-content', enabled: false, type: 'custom', customCode: '' },
    { placement: 'before-article', enabled: false, type: 'custom', customCode: '' },
    { placement: 'after-article', enabled: false, type: 'custom', customCode: '' },
    { placement: 'in-content', enabled: false, type: 'custom', customCode: '', everyN: 4 }
  ]
}

export function loadAdConfig(): AdConfig {
  try {
    const raw = localStorage.getItem(ADS_KEY)
    if (!raw) return DEFAULT_AD_CONFIG
    const parsed = JSON.parse(raw) as AdConfig
    if (!parsed || typeof parsed !== 'object' || typeof parsed.enabled !== 'boolean') {
      return DEFAULT_AD_CONFIG
    }
    return { ...DEFAULT_AD_CONFIG, ...parsed }
  } catch {
    return DEFAULT_AD_CONFIG
  }
}

export function saveAdConfig(config: AdConfig): void {
  try {
    localStorage.setItem(ADS_KEY, JSON.stringify(config))
  } catch {
    /* noop */
  }
}

export function updateSlot(config: AdConfig, placement: AdPlacement, patch: Partial<AdSlotConfig>): AdConfig {
  const next: AdConfig = { ...config, slots: config.slots.map(s => (s.placement === placement ? { ...s, ...patch } : s)) }
  saveAdConfig(next)
  return next
}

export function getSlot(config: AdConfig, placement: AdPlacement): AdSlotConfig | null {
  const slot = config.slots.find(s => s.placement === placement)
  if (!slot || !config.enabled || !slot.enabled) return null
  return slot
}
