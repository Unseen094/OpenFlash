import React, { memo } from 'react'
import type { SvgElement, SvgMakerPanelProps } from './types'
import {
  IconMove, IconSquare, IconCircle, IconDiagonal, IconTriangle, IconPen, IconText,
  IconClose, IconDownload, IconTrash
} from '../../components/Icons'


export const SvgMakerPanel = memo(function SvgMakerPanel({ elements, selectedId, tool, onToolChange, onAddElement, onUpdateAttr, onUpdateStyle, onRemoveElement, onSelectElement, onExport }: SvgMakerPanelProps) {
  const selected = elements.find((el) => el.id === selectedId)
  const svgTools: Array<{ id: SvgElement['type'] | 'select'; icon: React.ReactNode; label: string }> = [
    { id: 'select', icon: <IconMove size={13} />, label: 'Select' },
    { id: 'rect', icon: <IconSquare size={13} />, label: 'Rect' },
    { id: 'circle', icon: <IconCircle size={13} />, label: 'Circle' },
    { id: 'ellipse', icon: <IconCircle size={13} />, label: 'Ellipse' },
    { id: 'line', icon: <IconDiagonal size={13} />, label: 'Line' },
    { id: 'polygon', icon: <IconTriangle size={13} />, label: 'Poly' },
    { id: 'path', icon: <IconPen size={13} />, label: 'Path' },
    { id: 'text', icon: <IconText size={13} />, label: 'Text' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tool palette */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, padding: '8px', borderBottom: '1px solid var(--border-subtle)' }}>
        {svgTools.map(t => (
          <button key={t.id} onClick={() => { onToolChange(t.id); if (t.id !== 'select') onAddElement(t.id) }}
            title={t.label}
            style={{
              width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: tool === t.id ? 'rgba(0, 240, 255, 0.15)' : 'transparent',
              border: tool === t.id ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)', color: tool === t.id ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              cursor: 'pointer', transition: 'all var(--transition-fast)'
            }}>
            {t.icon}
          </button>
        ))}
      </div>

      {/* Canvas preview */}
      <div style={{
        height: 140, background: '#0D0E12', borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
      }}>
        <svg viewBox="0 0 280 200" width="260" height="130" style={{ background: '#0D0E12' }}>
          <defs><pattern id="svg-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
          </pattern></defs>
          <rect width="280" height="200" fill="url(#svg-grid)" />
          {elements.map((el) => {
            const a = el.attrs
            const style = { fill: el.fill, stroke: el.stroke, strokeWidth: el.strokeWidth }
            const props = { style, onClick: () => onSelectElement(el.id), cursor: 'pointer' }
            switch (el.type) {
              case 'rect': return <rect key={el.id} x={a.x} y={a.y} width={a.width} height={a.height} {...props} />
              case 'circle': return <circle key={el.id} cx={a.cx} cy={a.cy} r={a.r} {...props} />
              case 'ellipse': return <ellipse key={el.id} cx={a.cx} cy={a.cy} rx={a.rx} ry={a.ry} {...props} />
              case 'line': return <line key={el.id} x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} {...props} stroke={el.stroke} />
              case 'polygon': return <polygon key={el.id} points={a.points as string} {...props} />
              case 'path': return <path key={el.id} d={a.d as string} {...props} fill="none" />
              case 'text': return <text key={el.id} x={a.x} y={a.y} fontSize={a.fontSize} textAnchor="middle" {...props}>{a.text}</text>
              default: return null
            }
          })}
        </svg>
      </div>

      {/* Element list */}
      <div style={{ borderBottom: '1px solid var(--border-subtle)', maxHeight: 100, overflow: 'auto' }}>
        <div style={{ padding: '6px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Elements</span>
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{elements.length}</span>
        </div>
        {elements.length === 0 ? (
          <div style={{ padding: '10px 8px', fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
            Click a tool to add shapes.
          </div>
        ) : elements.map((el, i: number) => (
          <div key={el.id} onClick={() => onSelectElement(el.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', fontSize: 10, cursor: 'pointer',
              background: selectedId === el.id ? 'rgba(0, 240, 255, 0.08)' : 'transparent',
              borderBottom: '1px solid var(--border-subtle)'
            }}>
            <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 9, width: 16 }}>#{i + 1}</span>
            <span style={{ flex: 1, textTransform: 'capitalize' }}>{el.type}</span>
            <button onClick={e => { e.stopPropagation(); onRemoveElement(el.id); }}
              style={{ background: 'none', border: 'none', color: '#FF5F75', cursor: 'pointer', padding: 0 }}>
              <IconClose size={10} />
            </button>
          </div>
        ))}
      </div>

      {/* Properties for selected element */}
      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {selected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
              {selected.type} Properties
            </h3>
            {Object.entries(selected.attrs).map(([key, val]) => (
              <div key={key}>
                <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>{key}</label>
                {key === 'text' ? (
                  <input type="text" value={val as string} onChange={e => onUpdateAttr(selected.id, key, e.target.value)}
                    className="input" style={{ width: '100%', padding: '4px 8px', fontSize: 11 }} />
                ) : (
                  <input type="number" value={val as number} onChange={e => onUpdateAttr(selected.id, key, Number(e.target.value))}
                    className="input" style={{ width: '100%', padding: '4px 8px', fontSize: 11 }} />
                )}
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Fill</label>
                <input type="color" value={selected.fill} onChange={e => onUpdateStyle(selected.id, { fill: e.target.value })}
                  style={{ width: '100%', height: 28, border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: 'none' }} />
              </div>
              <div>
                <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Stroke</label>
                <input type="color" value={selected.stroke} onChange={e => onUpdateStyle(selected.id, { stroke: e.target.value })}
                  style={{ width: '100%', height: 28, border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: 'none' }} />
              </div>
            </div>
            <div>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Stroke Width</label>
              <input type="number" value={selected.strokeWidth} onChange={e => onUpdateStyle(selected.id, { strokeWidth: Number(e.target.value) })}
                min={0} max={20} step={0.5} className="input" style={{ width: '100%', padding: '4px 8px', fontSize: 11 }} />
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textAlign: 'center', padding: '20px 0' }}>
            Select an element to edit its properties.
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 6 }}>
        <button onClick={onExport} className="btn btn-primary" style={{ flex: 1, padding: '6px', fontSize: 11 }} disabled={elements.length === 0}>
          <IconDownload size={11} /> Export SVG
        </button>
        <button onClick={() => { if (selectedId) onRemoveElement(selectedId) }} className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: 11 }} disabled={!selectedId}>
          <IconTrash size={11} />
        </button>
      </div>
    </div>
  )
})
