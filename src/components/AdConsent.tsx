import { useEffect, useState } from 'react'
import { loadAdConfig } from '../lib/monetization/ads'

const CONSENT_KEY = 'openflash_ad_consent'

/**
 * GDPR-style consent banner for ads.
 *  - Only shown when ads are globally enabled.
 *  - Remembers choice in localStorage.
 *  - Loads AdSense Auto Ads script only after consent is granted.
 */
export default function AdConsent() {
  const [visible, setVisible] = useState(false)
  const [autoLoad, setAutoLoad] = useState(false)

  useEffect(() => {
    const adConfig = loadAdConfig()
    if (!adConfig.enabled) return
    const stored = localStorage.getItem(CONSENT_KEY)
    if (stored === null) {
      setVisible(true)
    } else if (stored === 'accepted') {
      setAutoLoad(true)
    }
  }, [])

  const accept = () => {
    localStorage.setItem(CONSENT_KEY, 'accepted')
    setAutoLoad(true)
    setVisible(false)
  }

  const decline = () => {
    localStorage.setItem(CONSENT_KEY, 'declined')
    setVisible(false)
  }

  // Load Auto Ads script after consent
  useEffect(() => {
    if (!autoLoad) return
    const adConfig = loadAdConfig()
    if (!adConfig.adsensePub || !adConfig.autoAds) return
    if (document.querySelector('script[data-adsense-auto]')) return
    const s = document.createElement('script')
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(adConfig.adsensePub)}`
    s.async = true
    s.crossOrigin = 'anonymous'
    s.setAttribute('data-adsense-auto', 'true')
    document.head.appendChild(s)
  }, [autoLoad])

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 9000,
      padding: '16px 24px',
      background: 'var(--bg-secondary)',
      borderTop: '1px solid var(--border-subtle)',
      boxShadow: '0 -4px 24px rgba(0,0,0,0.4)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      flexWrap: 'wrap'
    }}>
      <span style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 520 }}>
        We use cookies and personalized ads to keep OpenFlash free.
        By clicking "Accept", you consent to AdSense Auto Ads and our use of cookies for ad personalization.
      </span>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={decline} className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: 12 }}>
          Decline
        </button>
        <button onClick={accept} className="btn btn-primary" style={{ padding: '6px 14px', fontSize: 12 }}>
          Accept
        </button>
      </div>
    </div>
  )
}

/** Reset consent — used by admin panel. */
export function resetAdConsent(): void {
  localStorage.removeItem(CONSENT_KEY)
}
