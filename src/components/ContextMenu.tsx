import { useEffect, useRef } from 'react'
import { IconCopy, IconTrash, IconUndo, IconRedo, IconLayers, IconCopy as IconPaste } from './Icons'

export interface ContextMenuItem {
  label: string
  icon?: React.ReactNode
  shortcut?: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}

export function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: ContextMenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div ref={ref} className="glass-panel animate-slide-up" style={{
      position: 'fixed', left: Math.min(x, window.innerWidth - 200), top: Math.min(y, window.innerHeight - 300),
      zIndex: 10000, padding: 4, minWidth: 180, boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
    }}>
      {items.map((item, i) => (
        <button key={i} onClick={() => { if (!item.disabled) { item.onClick(); onClose() } }}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 10px',
            background: 'none', border: 'none', borderRadius: 'var(--radius-sm)', cursor: item.disabled ? 'default' : 'pointer',
            fontSize: 12, color: item.danger ? '#FF5F75' : item.disabled ? 'var(--text-muted)' : 'var(--text-primary)',
            opacity: item.disabled ? 0.5 : 1, textAlign: 'left',
            transition: 'background var(--transition-fast)'
          }}
          onMouseEnter={e => { if (!item.disabled) e.currentTarget.style.background = 'var(--bg-tertiary)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
          {item.icon && <span style={{ flexShrink: 0 }}>{item.icon}</span>}
          <span style={{ flex: 1 }}>{item.label}</span>
          {item.shortcut && <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{item.shortcut}</span>}
        </button>
      ))}
    </div>
  )
}
