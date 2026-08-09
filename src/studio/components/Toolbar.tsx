import { memo } from 'react'
import type { ToolbarProps } from './types'
import {
  IconUndo, IconRedo, IconCopy, IconTrash, IconGrid, IconRefresh
} from '../../components/Icons'


export const Toolbar = memo(function Toolbar({ tools, activeTool, onToolChange, fillColor, strokeColor, onFillColorChange, onStrokeColorChange, strokeWidth, onStrokeWidthChange, onUndo, onRedo, toolState, onToolStateChange, onAlign, onDistribute, onZOrder, onRotate, onFlip, onZoomToFit, onClearCanvas, onHandleDuplicate }: ToolbarProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
      background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0, overflowX: 'auto'
    }}>
      <div style={{ display: 'flex', gap: 2 }}>
        {tools.map((tool) => (
          <button key={tool.id} onClick={() => onToolChange(tool.id)} title={`${tool.label} (${tool.shortcut})`}
            style={{
              width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: activeTool === tool.id ? 'rgba(0, 240, 255, 0.15)' : 'transparent',
              border: activeTool === tool.id ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)', color: activeTool === tool.id ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              cursor: 'pointer', transition: 'all var(--transition-fast)', flexShrink: 0
            }}>
            {tool.icon}
          </button>
        ))}
      </div>
      <div style={{ width: 1, height: 24, background: 'var(--border-subtle)', flexShrink: 0 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Fill</label>
        <input type="color" value={fillColor} onChange={e => onFillColorChange(e.target.value)}
          style={{ width: 26, height: 26, border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: 'none' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Stroke</label>
        <input type="color" value={strokeColor} onChange={e => onStrokeColorChange(e.target.value)}
          style={{ width: 26, height: 26, border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: 'none' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>W:</label>
        <input type="number" value={strokeWidth} onChange={e => onStrokeWidthChange(Number(e.target.value))}
          min={0.5} max={50} step={0.5} className="input" style={{ width: 46, padding: '2px 4px', fontSize: 10 }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Brush:</label>
        <input type="range" min={1} max={100} value={toolState.brushSize} onChange={e => onToolStateChange({ ...toolState, brushSize: Number(e.target.value) })}
          style={{ width: 50, accentColor: 'var(--accent-cyan)' }} />
        <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', width: 18 }}>{toolState.brushSize}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Op:</label>
        <input type="range" min={0} max={1} step={0.05} value={toolState.brushOpacity} onChange={e => onToolStateChange({ ...toolState, brushOpacity: Number(e.target.value) })}
          style={{ width: 40, accentColor: 'var(--accent-cyan)' }} />
        <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', width: 20 }}>{Math.round(toolState.brushOpacity * 100)}%</span>
      </div>
      <div style={{ width: 1, height: 24, background: 'var(--border-subtle)', flexShrink: 0 }} />
      <button className="btn btn-ghost" onClick={onUndo} title="Undo (Ctrl+Z)" style={{ padding: '4px 6px', flexShrink: 0 }}>
        <IconUndo size={13} />
      </button>
      <button className="btn btn-ghost" onClick={onRedo} title="Redo (Ctrl+Y)" style={{ padding: '4px 6px', flexShrink: 0 }}>
        <IconRedo size={13} />
      </button>
      <div style={{ width: 1, height: 24, background: 'var(--border-subtle)', flexShrink: 0 }} />
      <button className="btn btn-ghost" onClick={onHandleDuplicate} title="Duplicate (Ctrl+D)" style={{ padding: '4px 6px', flexShrink: 0 }}>
        <IconCopy size={13} />
      </button>
      <button className="btn btn-ghost" onClick={onClearCanvas} title="Clear Canvas" style={{ padding: '4px 6px', flexShrink: 0 }}>
        <IconTrash size={13} />
      </button>
      <div style={{ width: 1, height: 24, background: 'var(--border-subtle)', flexShrink: 0 }} />
      <button className={`btn ${toolState.snapToGrid ? 'btn-cyan' : 'btn-ghost'}`} onClick={() => onToolStateChange({ ...toolState, snapToGrid: !toolState.snapToGrid })} title="Snap to Grid" style={{ padding: '4px 6px', flexShrink: 0 }}>
        <IconGrid size={13} />
      </button>
      <button className="btn btn-ghost" onClick={onZoomToFit} title="Zoom to Fit" style={{ padding: '4px 6px', fontSize: 10, flexShrink: 0 }}>
        Fit
      </button>
      <div style={{ width: 1, height: 24, background: 'var(--border-subtle)', flexShrink: 0 }} />
      <button className="btn btn-ghost" onClick={() => onAlign('left')} title="Align Left" style={{ padding: '4px 5px', fontSize: 10, flexShrink: 0 }}>◧</button>
      <button className="btn btn-ghost" onClick={() => onAlign('center-h')} title="Align Center H" style={{ padding: '4px 5px', fontSize: 10, flexShrink: 0 }}>⊞</button>
      <button className="btn btn-ghost" onClick={() => onAlign('right')} title="Align Right" style={{ padding: '4px 5px', fontSize: 10, flexShrink: 0 }}>◨</button>
      <button className="btn btn-ghost" onClick={() => onDistribute('horizontal')} title="Distribute H" style={{ padding: '4px 5px', fontSize: 10, flexShrink: 0 }}>⋮⋮</button>
      <button className="btn btn-ghost" onClick={() => onZOrder('top')} title="Bring to Front" style={{ padding: '4px 5px', fontSize: 10, flexShrink: 0 }}>⤒</button>
      <button className="btn btn-ghost" onClick={() => onZOrder('bottom')} title="Send to Back" style={{ padding: '4px 5px', fontSize: 10, flexShrink: 0 }}>⤓</button>
      <div style={{ width: 1, height: 24, background: 'var(--border-subtle)', flexShrink: 0 }} />
      <button className="btn btn-ghost" onClick={() => onRotate(90)} title="Rotate 90°" style={{ padding: '4px 6px', flexShrink: 0 }}>
        <IconRefresh size={12} />
      </button>
      <button className="btn btn-ghost" onClick={() => onFlip(true)} title="Flip Horizontal" style={{ padding: '4px 5px', fontSize: 11, flexShrink: 0 }}>⇋</button>
    </div>
  )
})
