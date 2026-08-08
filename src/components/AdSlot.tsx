import { useEffect, useRef, useState } from 'react'
import type { AdSlotConfig } from '../lib/monetization/types'
import { loadAdConfig } from '../lib/monetization/ads'

interface AdSlotProps {
  config: AdSlotConfig
}

/**
 * Renders a single ad slot.
 *
 * Design rules:
 *  - Fixed min-height wrapper prevents CLS (layout shift).
 *  - Lazy-loads via IntersectionObserver (only when scrolled into view).
 *  - Respects global ad toggle + per-slot toggle.
 *  - Supports AdSense (adsbygoogle) and custom HTML/JS injection.
 *  - Renders nothing when disabled (no empty box).
 */
export default function AdSlot({ config }: AdSlotProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [adConfig, setAdConfig] = useState(() => loadAdConfig())

  const globalEnabled = adConfig.enabled && config.enabled

  useEffect(() => {
    const interval = setInterval(() => setAdConfig(loadAdConfig()), 5000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!ref.current || !globalEnabled) return
    const el = ref.current
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true)
            observer.disconnect()
          }
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [globalEnabled])

  if (!globalEnabled) return null

  const minHeight = config.placement === 'header' ? 90
    : config.placement === 'footer' ? 90
    : config.placement === 'sidebar' ? 250
    : 90

  return (
    <div
      ref={ref}
      style={{
        width: '100%',
        minHeight,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden'
      }}
      data-ad-placement={config.placement}
    >
      {visible ? (
        config.type === 'adsense' && config.adsenseSlot ? (
          <AdSenseSlot pub={adConfig.adsensePub || ''} slot={config.adsenseSlot} />
        ) : config.type === 'custom' && config.customCode ? (
          <CustomAd code={config.customCode} />
        ) : (
          <AdPlaceholder placement={config.placement} />
        )
      ) : (
        <AdPlaceholder placement={config.placement} />
      )}
    </div>
  )
}

function AdSenseSlot({ pub, slot }: { pub: string; slot: string }) {
  const ref = useRef<HTMLModElement | null>(null)
  useEffect(() => {
    if (!ref.current) return
    try {
      // Push into AdSense queue — safe to call multiple times
       window.adsbygoogle = window.adsbygoogle || []
       window.adsbygoogle.push({})
     } catch (e) {
       console.warn('[ads] AdSense injection failed:', e)
    }
  }, [pub, slot])

  if (!pub) return <AdPlaceholder placement="adsense" />

  return (
    <ins
      ref={ref}
      className="adsbygoogle"
      style={{ display: 'block', width: '100%', height: '100%' }}
      data-ad-client={pub}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  )
}

function CustomAd({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ref.current) return
    // Execute custom HTML/JS inside the slot
    ref.current.innerHTML = code
    const scripts = ref.current.querySelectorAll('script')
    scripts.forEach(old => {
      const s = document.createElement('script')
      Array.from(old.attributes).forEach(a => s.setAttribute(a.name, a.value))
      s.textContent = old.textContent
      old.replaceWith(s)
    })
  }, [code])
  return <div ref={ref} style={{ width: '100%', height: '100%' }} />
}

function AdPlaceholder({ placement }: { placement: string }) {
  return (
    <div style={{
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      color: 'var(--text-muted)',
      textTransform: 'uppercase',
      letterSpacing: 1,
      opacity: 0.5
    }}>
      Ad · {placement}
    </div>
  )
}
