import { memo } from 'react'
import { IconMinus, IconFullscreen } from '../../components/Icons'
import type { CanvasAreaProps } from './types'


export const CanvasArea = memo(function CanvasArea({ canvasRef, overlayCanvasRef, zoom, onMouseDown, onMouseMove, onMouseUp, onMouseLeave, onZoomIn, onZoomOut, onZoomReset, onToggleFullscreen, canvasWidth, canvasHeight, canvasBackground, onContextMenu }: CanvasAreaProps) {
  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, overflow: 'hidden', background: 'var(--bg-primary)', position: 'relative'
    }}>
      {/* Zoom is applied inside the canvas 2D context (see renderStage). Do not
          add a CSS transform scale here — it would compound into zoom². */}
      <div style={{ position: 'relative', willChange: 'transform', boxShadow: '0 0 60px rgba(0, 0, 0, 0.5)' }}>
        <canvas ref={canvasRef} width={canvasWidth} height={canvasHeight}
          style={{ display: 'block', background: canvasBackground, borderRadius: 'var(--radius-sm)', maxWidth: canvasWidth, maxHeight: canvasHeight }}
        />
        <canvas
          ref={overlayCanvasRef} width={canvasWidth} height={canvasHeight}
          style={{ position: 'absolute', top: 0, left: 0, width: canvasWidth, height: canvasHeight, pointerEvents: 'auto', cursor: 'crosshair' }}
          onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseLeave}
          onContextMenu={onContextMenu}
        />
      </div>
      <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', flexDirection: 'column', gap: 4, zIndex: 50 }}>
        <button className="btn btn-ghost" onClick={onZoomIn} title="Zoom In" style={{ padding: '4px 8px', fontSize: 12 }}>+</button>
        <button className="btn btn-ghost" onClick={onZoomOut} title="Zoom Out" style={{ padding: '4px 8px', fontSize: 12 }}>
          <IconMinus size={14} />
        </button>
        <button className="btn btn-ghost" onClick={onZoomReset} title="Reset Zoom" style={{ padding: '4px 8px', fontSize: 10, fontFamily: 'var(--font-mono)' }}>{Math.round(zoom * 100)}%</button>
        <button className="btn btn-ghost" onClick={onToggleFullscreen} title="Fullscreen Preview" style={{ padding: '4px 8px' }}>
          <IconFullscreen size={13} />
        </button>
      </div>
      <div style={{ position: 'absolute', bottom: 12, left: 12, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
        Drag: draw &nbsp;•&nbsp; Space: play &nbsp;•&nbsp; V: select
      </div>
    </div>
  )
})
