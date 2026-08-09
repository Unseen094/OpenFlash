import { useRef, useEffect } from 'react'
import { memo } from 'react'
import { IconClose } from '../../components/Icons'
import { renderShape } from '../engine/shapes'
import { applyShaderOverlay } from '../engine/shaders'
import type { FullscreenPreviewProps } from './types'

export const FullscreenPreview = memo(function FullscreenPreview({ shapes, code, shaders, fps, onClose }: FullscreenPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef(0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const canvas = previewCanvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const fit = () => {
      const cw = container.clientWidth - 40
      const ch = container.clientHeight - 40
      const scale = Math.min(cw / 800, ch / 450)
      canvas.style.width = `${800 * scale}px`
      canvas.style.height = `${450 * scale}px`
    }
    fit()
    window.addEventListener('resize', fit)

    const loop = () => {
      ctx.fillStyle = '#0D0E12'
      ctx.fillRect(0, 0, 800, 450)
      for (const shape of shapes) {
        renderShape(ctx, shape)
      }
      for (const shaderType of shaders) {
        applyShaderOverlay(ctx, shaderType, 800, 450, 0.6)
      }
      animRef.current = requestAnimationFrame(loop)
    }
    animRef.current = requestAnimationFrame(loop)
    return () => {
      window.removeEventListener('resize', fit)
      cancelAnimationFrame(animRef.current)
    }
  }, [shapes, shaders])

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000,
      background: 'rgba(5, 6, 10, 0.94)', display: 'flex', flexDirection: 'column'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>{code ? 'PREVIEW · RUNTIME ACTIVE' : `PREVIEW · ${fps} FPS`}</span>
        <div style={{ flex: 1 }} />
        <button onClick={onClose} className="btn btn-ghost" style={{ padding: '4px 12px', fontSize: 11 }}>
          <IconClose size={14} /> Close (Esc)
        </button>
      </div>
      <div ref={containerRef} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <canvas ref={previewCanvasRef} width={800} height={450}
          style={{ display: 'block', background: '#0D0E12', borderRadius: 'var(--radius-sm)', boxShadow: '0 0 80px rgba(0, 0, 0, 0.7)' }} />
      </div>
    </div>
  )
})
