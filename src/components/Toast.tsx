import { useEffect, useState } from 'react'
import { IconCheck, IconClose, IconWarning } from './Icons'

export interface ToastItem {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
  duration: number
}

let toastListeners: ((toast: ToastItem) => void)[] = []

export const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info', duration = 3000) => {
  const toast: ToastItem = { id: `toast_${Date.now().toString(36)}`, message, type, duration }
  toastListeners.forEach(fn => fn(toast))
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    const handler = (toast: ToastItem) => {
      setToasts(prev => [...prev, toast])
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== toast.id)), toast.duration)
    }
    toastListeners.push(handler)
    return () => { toastListeners = toastListeners.filter(l => l !== handler) }
  }, [])

  if (toasts.length === 0) return null

  const colors = { success: 'var(--accent-green)', error: '#FF5F75', info: 'var(--accent-cyan)' }
  const icons = { success: <IconCheck size={14} />, error: <IconWarning size={14} />, info: <IconWarning size={14} /> }

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 10000, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toasts.map(toast => (
        <div key={toast.id} className="glass-panel animate-slide-up" style={{
          padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, minWidth: 200, maxWidth: 360,
          borderLeft: `3px solid ${colors[toast.type]}`
        }}>
          <span style={{ color: colors[toast.type] }}>{icons[toast.type]}</span>
          <span style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)' }}>{toast.message}</span>
          <button onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}>
            <IconClose size={12} />
          </button>
        </div>
      ))}
    </div>
  )
}
