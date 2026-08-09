import { memo } from 'react'
import type { Layer } from '../engine/timeline'
import type { TimelineAreaProps } from './types'
import {
  IconPlay, IconPause, IconSkipBack, IconSkipForward, IconDiamond, IconClose, IconEye, IconLock
} from '../../components/Icons'


export const TimelineArea = memo(function TimelineArea({ timeline, selectedLayerId, isPlaying, onionSkin, onFrameChange, onTotalFramesChange, onTogglePlay, onToggleOnionSkin, onAddKeyframe, onDeleteKeyframe, onAddLayer, onDeleteLayer, onSelectLayer, onToggleLayerVisibility, onToggleLayerLock, playbackSpeed, onPlaybackSpeedChange, fps, onFpsChange, loop, onToggleLoop }: TimelineAreaProps) {
  return (
    <div style={{
      height: 180, background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-subtle)',
      display: 'flex', flexDirection: 'column', flexShrink: 0
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)'
      }}>
        <button className={`btn ${isPlaying ? 'btn-primary' : ''}`} onClick={onTogglePlay} style={{ padding: '4px 10px' }}>
          {isPlaying ? <IconPause size={12} /> : <IconPlay size={12} />}
        </button>
        <button className="btn btn-ghost" onClick={() => onFrameChange(Math.max(1, timeline.currentFrame - 1))} style={{ padding: '4px 8px' }}>
          <IconSkipBack size={12} />
        </button>
        <button className="btn btn-ghost" onClick={() => onFrameChange(Math.min(timeline.totalFrames, timeline.currentFrame + 1))} style={{ padding: '4px 6px' }}>
          <IconSkipForward size={12} />
        </button>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-yellow)',
          padding: '2px 8px', background: 'rgba(255, 230, 0, 0.08)', borderRadius: 'var(--radius-sm)'
        }}>
          Frame {timeline.currentFrame} / {timeline.totalFrames}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <label style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Speed:</label>
          <select value={playbackSpeed} onChange={e => onPlaybackSpeedChange(Number(e.target.value))}
            className="input" style={{ padding: '1px 4px', fontSize: 9, width: 50 }}>
            <option value="0.25">0.25x</option>
            <option value="0.5">0.5x</option>
            <option value="1">1x</option>
            <option value="1.5">1.5x</option>
            <option value="2">2x</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <label style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>FPS:</label>
          <select value={fps} onChange={e => onFpsChange(Number(e.target.value))}
            className="input" style={{ padding: '1px 4px', fontSize: 9, width: 46 }}>
            <option value="12">12</option>
            <option value="24">24</option>
            <option value="30">30</option>
            <option value="60">60</option>
          </select>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <input type="checkbox" checked={loop} onChange={onToggleLoop} style={{ accentColor: 'var(--accent-cyan)' }} />
          Loop
        </label>
        <div style={{ flex: 1 }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <input type="checkbox" checked={onionSkin} onChange={onToggleOnionSkin} style={{ accentColor: 'var(--accent-cyan)' }} />
          Onion
        </label>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>Total:</span>
        <input type="number" value={timeline.totalFrames} onChange={e => onTotalFramesChange(Number(e.target.value))}
          className="input" style={{ width: 50, padding: '1px 4px', fontSize: 9 }} />
        <button onClick={onAddKeyframe} className="btn btn-ghost" style={{ padding: '3px 6px', fontSize: 9 }} title="Insert Keyframe (F6)">
          <IconDiamond size={10} /> KF
        </button>
        <button onClick={onDeleteKeyframe} className="btn btn-ghost" style={{ padding: '3px 6px', fontSize: 9 }} title="Delete Keyframe">
          <IconClose size={10} /> KF
        </button>
      </div>
      <div style={{ flex: 1, display: 'flex', overflow: 'auto' }}>
        <div style={{ width: 140, flexShrink: 0, borderRight: '1px solid var(--border-subtle)' }}>
          <div style={{ height: 22, borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px' }}>
            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Layers</span>
            <button onClick={onAddLayer} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, padding: 0 }}>+</button>
          </div>
          {timeline.layers.map((layer: Layer) => (
            <div key={layer.id} onClick={() => onSelectLayer(layer.id)}
              style={{
                height: 28, display: 'flex', alignItems: 'center', padding: '0 8px', fontSize: 11,
                cursor: 'pointer', background: selectedLayerId === layer.id ? 'rgba(0, 240, 255, 0.08)' : 'transparent',
                borderBottom: '1px solid var(--border-subtle)'
              }}
            >
              <button onClick={e => { e.stopPropagation(); onToggleLayerVisibility(layer.id); }}
                style={{ background: 'none', border: 'none', color: layer.visible ? 'var(--text-secondary)' : 'var(--text-muted)', cursor: 'pointer', padding: '0 4px' }}>
                {layer.visible ? <IconEye size={13} /> : <span style={{ fontSize: 10 }}>—</span>}
              </button>
              <button onClick={e => { e.stopPropagation(); onToggleLayerLock(layer.id); }}
                style={{ background: 'none', border: 'none', color: layer.locked ? 'var(--accent-yellow)' : 'var(--text-muted)', cursor: 'pointer', padding: '0 4px' }}>
                {layer.locked ? <IconLock size={12} /> : <span style={{ fontSize: 9 }}>—</span>}
              </button>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginLeft: 4 }}>{layer.name}</span>
              <button onClick={e => { e.stopPropagation(); onDeleteLayer(layer.id); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 10, padding: '0 2px' }}>
                <IconClose size={12} />
              </button>
            </div>
          ))}
        </div>
        <div style={{ flex: 1, position: 'relative' }}>
          <div style={{ height: 22, display: 'flex', borderBottom: '1px solid var(--border-subtle)' }}>
            {Array.from({ length: timeline.totalFrames }, (_, i) => (
              <div key={i} onClick={() => onFrameChange(i + 1)}
                style={{
                  flex: 1, minWidth: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-mono)', fontSize: 8, color: (i + 1) % 5 === 0 ? 'var(--text-muted)' : 'transparent',
                  cursor: 'pointer', borderRight: '1px solid rgba(255,255,255,0.02)',
                  background: timeline.currentFrame === i + 1 ? 'rgba(0, 240, 255, 0.1)' : 'transparent'
                }}>
                {(i + 1) % 5 === 0 ? i + 1 : ''}
              </div>
            ))}
          </div>
          {timeline.layers.map((layer: Layer) => (
            <div key={layer.id}
              style={{
                height: 28, display: 'flex', borderBottom: '1px solid var(--border-subtle)',
                background: selectedLayerId === layer.id ? 'rgba(0, 240, 255, 0.03)' : 'transparent'
              }}
            >
              {Array.from({ length: timeline.totalFrames }, (_, i) => {
                const hasKeyframe = layer.keyframes.some(kf => kf.frame === i + 1)
                const isFirst = layer.keyframes[0]?.frame === i + 1
                return (
                  <div key={i} style={{
                    flex: 1, minWidth: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRight: '1px solid rgba(255,255,255,0.02)'
                  }} onClick={() => onFrameChange(i + 1)}>
                    {hasKeyframe && (
                      <div style={{
                        width: 10, height: 10, borderRadius: isFirst ? '50%' : '2px',
                        background: isFirst ? 'var(--accent-cyan)' : 'var(--accent-yellow)',
                        border: isFirst ? 'none' : '1px solid var(--accent-yellow)'
                      }} />
                    )}
                  </div>
                )
              })}
            </div>
          ))}
          <div style={{
            position: 'absolute', top: 0, bottom: 0, left: 140 + (timeline.currentFrame - 1) * 20,
            width: 2, background: 'var(--accent-cyan)', pointerEvents: 'none', boxShadow: '0 0 8px var(--accent-cyan)', zIndex: 10
          }} />
        </div>
      </div>
    </div>
  )
})
