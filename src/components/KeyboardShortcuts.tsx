import { IconClose } from './Icons'

const shortcuts = [
  { category: 'Tools', items: [
    { keys: 'V', desc: 'Selection Tool' }, { keys: 'A', desc: 'Node Tool' },
    { keys: 'P', desc: 'Pen Tool' }, { keys: 'B', desc: 'Brush Tool' },
    { keys: 'L', desc: 'Line Tool' }, { keys: 'R', desc: 'Rectangle' },
    { keys: 'O', desc: 'Ellipse' }, { keys: 'T', desc: 'Text Tool' },
    { keys: 'G', desc: 'Paint Bucket' }, { keys: 'I', desc: 'Eyedropper' },
    { keys: 'E', desc: 'Eraser' }
  ]},
  { category: 'Edit', items: [
    { keys: 'Ctrl+Z', desc: 'Undo' }, { keys: 'Ctrl+Shift+Z', desc: 'Redo' },
    { keys: 'Ctrl+D', desc: 'Duplicate' }, { keys: 'Ctrl+G', desc: 'Group' },
    { keys: 'Ctrl+Shift+G', desc: 'Ungroup' }, { keys: 'Delete', desc: 'Delete Selected' },
    { keys: 'Ctrl+A', desc: 'Select All' }
  ]},
  { category: 'Timeline', items: [
    { keys: 'Space', desc: 'Play/Pause' }, { keys: 'F6', desc: 'Add Keyframe' },
    { keys: '← →', desc: 'Prev/Next Frame' }
  ]},
  { category: 'View', items: [
    { keys: '+ / -', desc: 'Zoom In/Out' }, { keys: '0', desc: 'Reset Zoom' },
    { keys: '?', desc: 'Toggle Shortcuts' }
  ]}
]

export function KeyboardShortcuts({ onClose }: { onClose: () => void }) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10000,
      background: 'rgba(5, 6, 10, 0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center'
    }} onClick={onClose}>
      <div className="glass-panel" style={{ padding: 32, maxWidth: 600, width: '90%', maxHeight: '80vh', overflow: 'auto' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 20, fontWeight: 700 }}>Keyboard Shortcuts</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <IconClose size={18} />
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {shortcuts.map(cat => (
            <div key={cat.category}>
              <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-yellow)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                {cat.category}
              </h3>
              {cat.items.map(item => (
                <div key={item.keys} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.desc}</span>
                  <kbd style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10, padding: '2px 6px',
                    background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)'
                  }}>{item.keys}</kbd>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
