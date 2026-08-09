import { memo, useRef } from 'react'
import type { ExplorerPanelProps } from './types'
import { sanitizeSvg } from '../../lib/sanitize'
import {
  IconEye, IconLock, IconClose, IconImage, IconTrash
} from '../../components/Icons'


export const ExplorerPanel = memo(function ExplorerPanel({ explorerTab, onTabChange, layers, selectedLayerId, onSelectLayer, onToggleLayerVisibility, onToggleLayerLock, onAddLayer, onDeleteLayer, assets, onImportAssets, onRemoveAsset, shapes, selectedShapeIds, onSelectShape }: ExplorerPanelProps) {
  const importRef = useRef<HTMLInputElement>(null)

  return (
    <div style={{
      width: 200, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-subtle)',
      background: 'var(--bg-secondary)', overflow: 'hidden', flexShrink: 0
    }}>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)' }}>
        {(['layers', 'assets', 'shapes'] as const).map(tab => (
          <button key={tab} onClick={() => onTabChange(tab)}
            style={{
              flex: 1, padding: '8px 6px', fontSize: 10, fontWeight: 500, background: 'none', border: 'none',
              borderBottom: explorerTab === tab ? '2px solid var(--accent-yellow)' : '2px solid transparent',
              color: explorerTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
              cursor: 'pointer', textTransform: 'capitalize', whiteSpace: 'nowrap'
            }}>
            {tab}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {explorerTab === 'layers' && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Layers</span>
              <button onClick={onAddLayer} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, padding: 0 }} title="Add layer">+</button>
            </div>
            {layers.map((layer) => (
              <div key={layer.id} onClick={() => onSelectLayer(layer.id)}
                style={{
                  display: 'flex', alignItems: 'center', padding: '6px 8px', fontSize: 11, cursor: 'pointer',
                  background: selectedLayerId === layer.id ? 'rgba(0, 240, 255, 0.08)' : 'transparent',
                  borderBottom: '1px solid var(--border-subtle)', gap: 4
                }}>
                <button onClick={e => { e.stopPropagation(); onToggleLayerVisibility(layer.id); }}
                  style={{ background: 'none', border: 'none', color: layer.visible ? 'var(--text-secondary)' : 'var(--text-muted)', cursor: 'pointer', padding: 0 }}>
                  {layer.visible ? <IconEye size={12} /> : <span style={{ fontSize: 10, opacity: 0.4 }}>—</span>}
                </button>
                <button onClick={e => { e.stopPropagation(); onToggleLayerLock(layer.id); }}
                  style={{ background: 'none', border: 'none', color: layer.locked ? 'var(--accent-yellow)' : 'var(--text-muted)', cursor: 'pointer', padding: 0 }}>
                  {layer.locked ? <IconLock size={11} /> : <span style={{ fontSize: 10, opacity: 0.4 }}>—</span>}
                </button>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{layer.name}</span>
                <button onClick={e => { e.stopPropagation(); onDeleteLayer(layer.id); }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 10, padding: 0 }}>
                  <IconClose size={10} />
                </button>
              </div>
            ))}
          </div>
        )}
        {explorerTab === 'assets' && (
          <div style={{ display: 'flex', flexDirection: 'column', padding: 8, gap: 8 }}>
            <input ref={importRef} type="file" multiple accept="image/*,.svg" style={{ display: 'none' }}
              onChange={e => { if (e.target.files) onImportAssets(e.target.files); e.currentTarget.value = '' }} />
            <button onClick={() => importRef.current?.click()} className="btn btn-primary" style={{ padding: '6px', fontSize: 11 }}>
              <IconImage size={12} /> Import Assets
            </button>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Import images or SVGs. Supported: PNG, JPG, GIF, SVG, WebP.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {assets.length === 0 ? (
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textAlign: 'center', padding: '12px 0' }}>
                  No assets imported.
                </span>
              ) : assets.map((asset) => (
                <div key={asset.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '6px',
                  background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)'
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 'var(--radius-sm)', overflow: 'hidden',
                    background: '#0D0E12', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    {asset.type === 'svg' ? (
                      <div
                        key={asset.id + '-preview'}
                        style={{ width: 36, height: 36 }}
                        ref={el => {
                          if (el) {
                            el.innerHTML = sanitizeSvg(asset.src.replace(/<svg([^>]*)>/, '<svg$1 width="36" height="36">'))
                          }
                        }}
                      />
                    ) : (
                      <img src={asset.src} alt={asset.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asset.name}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{asset.width}×{asset.height}</div>
                  </div>
                  <button onClick={() => onRemoveAsset(asset.id)}
                    style={{ background: 'none', border: 'none', color: '#FF5F75', cursor: 'pointer', padding: 0 }}>
                    <IconTrash size={11} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        {explorerTab === 'shapes' && (
          <div style={{ display: 'flex', flexDirection: 'column', padding: '6px 0' }}>
            {shapes.length === 0 ? (
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textAlign: 'center', padding: '12px 0' }}>
                No shapes on canvas.
              </span>
            ) : shapes.map((shape, i: number) => (
              <div key={shape.id} onClick={() => onSelectShape(shape.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', fontSize: 11, cursor: 'pointer',
                  background: selectedShapeIds.has(shape.id) ? 'rgba(0, 240, 255, 0.08)' : 'transparent',
                  borderBottom: '1px solid var(--border-subtle)'
                }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 9, fontFamily: 'var(--font-mono)', width: 20 }}>#{i + 1}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {shape.name || shape.type}
                </span>
                <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {shape.type}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
})
