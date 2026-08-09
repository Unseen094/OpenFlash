import { memo } from 'react'
import type { PropertiesPanelProps } from './types'
import { IconPackage } from '../../components/Icons'


export const PropertiesPanel = memo(function PropertiesPanel({ selectedShape, onUpdateShape, onExportHTML, onExportPNG, onExportSVG, shaders, onToggleShader, fps, cursorPos, shapeCount, toolState, onToolStateChange, recentColors, onAddRecentColor }: PropertiesPanelProps) {
  const t = selectedShape?.transform || { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, alpha: 1 }
  const blendModes = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion']
  const colorPresets = ['#FFE600', '#00F0FF', '#FF00AA', '#00FF88', '#FF6600', '#FFFFFF', '#000000', '#FF5F75', '#7B61FF', '#00B4D8', '#F72585', '#7209B7']

  return (
    <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Transform</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {(['x', 'y', 'scaleX', 'scaleY', 'rotation', 'alpha'] as const).map(prop => (
            <div key={prop}>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>{prop}</label>
              <input type="number" value={Math.round(t[prop] * 100) / 100}
                onChange={e => onUpdateShape({ [prop]: parseFloat(e.target.value) || 0 })}
                className="input" style={{ width: '100%', padding: '3px 6px', fontSize: 10 }}
                disabled={!selectedShape} step={prop === 'rotation' ? 1 : prop.includes('scale') ? 0.1 : 1} />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
          <button onClick={() => onUpdateShape({ x: 0, y: 0 })} className="btn btn-ghost" style={{ flex: 1, padding: '3px', fontSize: 9 }} disabled={!selectedShape}>Reset</button>
          <button onClick={() => onUpdateShape({ scaleX: 1, scaleY: 1 })} className="btn btn-ghost" style={{ flex: 1, padding: '3px', fontSize: 9 }} disabled={!selectedShape}>1:1</button>
          <button onClick={() => onUpdateShape({ rotation: 0 })} className="btn btn-ghost" style={{ flex: 1, padding: '3px', fontSize: 9 }} disabled={!selectedShape}>0°</button>
        </div>
      </div>
      <div>
        <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Color Palettes</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4 }}>
          {colorPresets.map(color => (
            <button key={color} onClick={() => { onToolStateChange({ ...toolState, fillColor: color }); onAddRecentColor(color) }} title={color}
              style={{ width: '100%', height: 22, background: color, border: toolState.fillColor === color ? '2px solid var(--text-primary)' : '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }} />
          ))}
        </div>
        {recentColors.length > 0 && (
          <div style={{ marginTop: 6 }}>
            <label style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Recent</label>
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              {recentColors.slice(0, 12).map((color: string, i: number) => (
                <button key={i} onClick={() => onToolStateChange({ ...toolState, fillColor: color })}
                  style={{ width: 18, height: 18, background: color, border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }} />
              ))}
            </div>
          </div>
        )}
      </div>
      <div>
        <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Blend Mode</h3>
        <select value={toolState.blendMode || 'normal'} onChange={e => onToolStateChange({ ...toolState, blendMode: e.target.value })}
          className="input" style={{ width: '100%', padding: '3px 6px', fontSize: 10 }}>
          {blendModes.map(mode => <option key={mode} value={mode}>{mode}</option>)}
        </select>
      </div>
      <div>
        <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Text & Shape</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <select value={toolState.fontFamily} onChange={e => onToolStateChange({ ...toolState, fontFamily: e.target.value })}
            className="input" style={{ width: '100%', padding: '3px 6px', fontSize: 10 }}>
            <option value="Space Grotesk, sans-serif">Space Grotesk</option>
            <option value="JetBrains Mono, monospace">JetBrains Mono</option>
            <option value="Arial, sans-serif">Arial</option>
            <option value="Georgia, serif">Georgia</option>
            <option value="Courier New, monospace">Courier New</option>
            <option value="Verdana, sans-serif">Verdana</option>
            <option value="Impact, sans-serif">Impact</option>
          </select>
          <div style={{ display: 'flex', gap: 4 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Size</label>
              <input type="number" value={toolState.fontSize} onChange={e => onToolStateChange({ ...toolState, fontSize: Number(e.target.value) })}
                min={6} max={200} className="input" style={{ width: '100%', padding: '3px 6px', fontSize: 10 }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Polygon</label>
              <input type="number" value={toolState.polygonSides} onChange={e => onToolStateChange({ ...toolState, polygonSides: Number(e.target.value) })}
                min={3} max={20} className="input" style={{ width: '100%', padding: '3px 6px', fontSize: 10 }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Star Points</label>
              <input type="number" value={toolState.starPoints} onChange={e => onToolStateChange({ ...toolState, starPoints: Number(e.target.value) })}
                min={3} max={20} className="input" style={{ width: '100%', padding: '3px 6px', fontSize: 10 }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Star Inner</label>
              <input type="number" value={toolState.starInnerRadius} onChange={e => onToolStateChange({ ...toolState, starInnerRadius: Number(e.target.value) })}
                min={0.1} max={0.9} step={0.05} className="input" style={{ width: '100%', padding: '3px 6px', fontSize: 10 }} />
            </div>
          </div>
        </div>
      </div>
      <div>
        <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Filters</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {(['Blur', 'Glow', 'Drop Shadow', 'Bevel'] as const).map(filter => (
            <button key={filter} className="btn btn-ghost" style={{ padding: '3px 8px', fontSize: 10 }}>{filter}</button>
          ))}
        </div>
      </div>
      <div>
        <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Shaders</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {(['crt', 'bloom', 'glow', 'chromatic', 'grain'] as const).map(shader => (
            <button key={shader} onClick={() => onToggleShader(shader)}
              className={`btn ${shaders.has(shader) ? 'btn-cyan' : 'btn-ghost'}`}
              style={{ padding: '3px 8px', fontSize: 10, textTransform: 'uppercase' }}>
              {shader}
            </button>
          ))}
        </div>
      </div>
      <div>
        <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Export</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button className="btn btn-primary" onClick={onExportHTML}>
            <IconPackage size={13} /> Export HTML (Offline)
          </button>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn" onClick={onExportPNG} style={{ flex: 1 }}>PNG Frame</button>
            <button className="btn" onClick={onExportSVG} style={{ flex: 1 }}>SVG Frame</button>
          </div>
        </div>
      </div>
      <div>
        <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Stats</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 10 }}>
          <div><span style={{ color: 'var(--text-muted)' }}>FPS:</span> <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-green)' }}>{fps}</span></div>
          <div><span style={{ color: 'var(--text-muted)' }}>Shapes:</span> <span style={{ fontFamily: 'var(--font-mono)' }}>{shapeCount}</span></div>
          <div><span style={{ color: 'var(--text-muted)' }}>Cursor:</span> <span style={{ fontFamily: 'var(--font-mono)' }}>{cursorPos ? `${cursorPos.x}, ${cursorPos.y}` : '—'}</span></div>
          <div><span style={{ color: 'var(--text-muted)' }}>Selected:</span> <span style={{ fontFamily: 'var(--font-mono)' }}>{selectedShape ? '1' : '0'}</span></div>
        </div>
      </div>
    </div>
  )
})
