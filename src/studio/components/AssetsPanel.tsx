import { useState, useRef } from 'react'
import { memo } from 'react'
import { IconImage, IconPlus, IconTrash } from '../../components/Icons'
import { sanitizeSvg } from '../../lib/sanitize'
import type { AssetsPanelProps } from './types'

export const AssetsPanel = memo(function AssetsPanel({ assets, onImportAssets, onRemoveAsset }: AssetsPanelProps) {
  const importRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length > 0) onImportAssets(e.dataTransfer.files)
  }

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Import Assets</h3>
        <input ref={importRef} type="file" multiple accept="image/*,.svg" style={{ display: 'none' }}
          onChange={e => { if (e.target.files) onImportAssets(e.target.files); e.currentTarget.value = '' }} />
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => importRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
            borderRadius: 'var(--radius-md)', padding: '24px 16px', textAlign: 'center',
            cursor: 'pointer', transition: 'border var(--transition-fast)',
            background: dragOver ? 'rgba(0, 240, 255, 0.04)' : 'transparent'
          }}
        >
          <div style={{ marginBottom: 8 }}><IconImage size={24} style={{ color: 'var(--text-muted)' }} /></div>
          <div style={{ fontSize: 12, color: 'var(--text-primary)', marginBottom: 4 }}>Drop files here</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>or click to browse</div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 6, fontFamily: 'var(--font-mono)' }}>
            PNG · JPG · GIF · SVG · WebP
          </div>
        </div>
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Library ({assets.length})
          </h3>
          {assets.length > 0 && (
            <button onClick={() => importRef.current?.click()} className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 10 }}>
              <IconPlus size={10} /> Add
            </button>
          )}
        </div>
        {assets.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '24px 12px', fontFamily: 'var(--font-mono)',
            fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)'
          }}>
            No assets yet. Import images or SVGs to use in your project.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {assets.map((asset) => (
              <div key={asset.id} style={{
                background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', overflow: 'hidden',
                border: '1px solid var(--border-subtle)'
              }}>
                <div style={{
                  height: 70, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: '#0D0E12', overflow: 'hidden'
                }}>
                  {asset.type === 'svg' ? (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      ref={el => {
                        if (el) {
                          el.innerHTML = sanitizeSvg(asset.src.replace(/<svg([^>]*)>/, '<svg$1 style="max-width:100%;max-height:100%">'))
                        }
                      }} />
                  ) : (
                    <img src={asset.src} alt={asset.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 6px' }}>
                  <span style={{ flex: 1, fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {asset.name}
                  </span>
                  <button onClick={() => onRemoveAsset(asset.id)}
                    style={{ background: 'none', border: 'none', color: '#FF5F75', cursor: 'pointer', padding: 0 }}>
                    <IconTrash size={10} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div>
        <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Usage Tips</h3>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          <div>• Drag & drop images directly onto the canvas</div>
          <div>• SVG files remain scalable at any size</div>
          <div>• Use assets as sprites or reference images</div>
          <div>• Export preserves embedded images</div>
        </div>
      </div>
    </div>
  )
})
