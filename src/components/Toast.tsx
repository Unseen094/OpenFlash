import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { IconCheck, IconClose, IconWarning } from './Icons'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastItem {
  id: string
  message: string
  type: ToastType
  duration: number
}

export const TOAST_MAX_VISIBLE = 5
export const TOAST_DEDUPE_WINDOW_MS = 3000

let toastListeners: ((_toast: ToastItem) => void)[] = []
let toastSeq = 0
const recentToasts = new Map<string, number>()

const dedupeKey = (message: string, type: ToastType) => `${type}::${message}`

function isDuplicate(message: string, type: ToastType, now: number): boolean {
  const key = dedupeKey(message, type)
  const last = recentToasts.get(key)
  for (const [k, at] of recentToasts) {
    if (now - at >= TOAST_DEDUPE_WINDOW_MS) recentToasts.delete(k)
  }
  if (last !== undefined && now - last < TOAST_DEDUPE_WINDOW_MS) return true
  recentToasts.set(key, now)
  return false
}

export const showToast = (message: string, type: ToastType = 'info', duration = 3000): void => {
  const now = Date.now()
  if (isDuplicate(message, type, now)) return
  toastSeq += 1
  const toast: ToastItem = { id: `toast_${now.toString(36)}_${toastSeq.toString(36)}`, message, type, duration }
  toastListeners.forEach(fn => fn(toast))
}

export const dismissAllToasts = (): void => {
  recentToasts.clear()
  toastListeners.forEach(fn => fn({ id: '__clear__', message: '', type: 'info', duration: 0 }))
}

export interface UseToastApi {
  toast: (_message: string, _type?: ToastType, _duration?: number) => void
  success: (_message: string, _duration?: number) => void
  error: (_message: string, _duration?: number) => void
  info: (_message: string, _duration?: number) => void
  dismissAll: () => void
}

export function useToast(): UseToastApi {
  const toast = useCallback((message: string, type: ToastType = 'info', duration = 3000) => {
    showToast(message, type, duration)
  }, [])
  const success = useCallback((message: string, duration = 3000) => showToast(message, 'success', duration), [])
  const error = useCallback((message: string, duration = 3000) => showToast(message, 'error', duration), [])
  const info = useCallback((message: string, duration = 3000) => showToast(message, 'info', duration), [])
  const dismissAll = useCallback(() => dismissAllToasts(), [])
  return useMemo(
    () => ({ toast, success, error, info, dismissAll }),
    [toast, success, error, info, dismissAll]
  )
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const remove = useCallback((id: string) => {
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  useEffect(() => {
    const active = timers.current
    const handler = (toast: ToastItem) => {
      if (toast.id === '__clear__') {
        active.forEach(timer => clearTimeout(timer))
        active.clear()
        setToasts([])
        return
      }
      setToasts(prev => {
        const next = [...prev, toast]
        const overflow = next.slice(0, Math.max(0, next.length - TOAST_MAX_VISIBLE))
        overflow.forEach(t => {
          const timer = active.get(t.id)
          if (timer) {
            clearTimeout(timer)
            active.delete(t.id)
          }
        })
        return next.slice(-TOAST_MAX_VISIBLE)
      })
      const timer = setTimeout(() => {
        active.delete(toast.id)
        setToasts(prev => prev.filter(t => t.id !== toast.id))
      }, toast.duration)
      active.set(toast.id, timer)
    }
    toastListeners.push(handler)
    return () => {
      toastListeners = toastListeners.filter(l => l !== handler)
      active.forEach(timer => clearTimeout(timer))
      active.clear()
    }
  }, [])

  if (toasts.length === 0) return null

  const colors = { success: 'var(--accent-green)', error: '#FF5F75', info: 'var(--accent-cyan)' }
  const icons = { success: <IconCheck size={14} />, error: <IconWarning size={14} />, info: <IconWarning size={14} /> }

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="false"
      style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 10000, display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      {toasts.map(toast => (
        <div key={toast.id} className="glass-panel animate-slide-up" style={{
          padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, minWidth: 200, maxWidth: 360,
          borderLeft: `3px solid ${colors[toast.type]}`
        }}>
          <span style={{ color: colors[toast.type] }}>{icons[toast.type]}</span>
          <span style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)' }}>{toast.message}</span>
          <button onClick={() => remove(toast.id)} aria-label="Dismiss notification"
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}>
            <IconClose size={12} />
          </button>
        </div>
      ))}
    </div>
  )
}
